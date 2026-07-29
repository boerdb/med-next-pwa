import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db/mysql';
import { rowToMedication } from '@/lib/db/rows';
import { requireSession, jsonError, jsonOk } from '@/lib/api/http';
import { normalizeMedication } from '@/lib/utils';
import {
  MEDICATION_SELECT,
  MEDICATION_WRITE_FIELDS,
  medicationWriteValues,
  parseMedicationInput,
} from '@/lib/api/medication-input';
import type { RowDataPacket } from 'mysql2';

type MedRow = RowDataPacket & {
  id: string;
  name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  times: string;
  days_of_week: string | null;
  stock_count: number | null;
  course_start_date: string | null;
  course_days: number | null;
};

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  try {
    const pool = getPool();
    const [rows] = await pool.query<MedRow[]>(
      `${MEDICATION_SELECT} WHERE user_id = ? ORDER BY name`,
      [session.userId],
    );
    const medications = rows.map((r) => normalizeMedication(rowToMedication(r)));
    return jsonOk({ medications });
  } catch (e) {
    console.error('medications GET', e);
    return jsonError('Kon medicijnen niet laden.', 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      id?: string;
      name?: string;
      doseAmount?: number | null;
      doseUnit?: string | null;
      times?: string[];
      daysOfWeek?: number[] | null;
      stockCount?: number | null;
      courseStartDate?: string | null;
      courseDays?: number | null;
    };
    const id = body.id;
    if (!id) {
      return jsonError('Ongeldige medicijngegevens.', 400);
    }

    const parsed = parseMedicationInput(body);
    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }

    const pool = getPool();
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT user_id FROM medications WHERE id = ? LIMIT 1',
      [id],
    );
    const values = medicationWriteValues(parsed.data);
    if (existing.length > 0) {
      if (existing[0]!.user_id !== session.userId) {
        return jsonError('Niet toegestaan.', 403);
      }
      await pool.query(
        `UPDATE medications SET ${MEDICATION_WRITE_FIELDS} WHERE id = ? AND user_id = ?`,
        [...values, id, session.userId],
      );
    } else {
      await pool.query(
        'INSERT INTO medications (id, user_id, name, dose_amount, dose_unit, times, days_of_week, stock_count, course_start_date, course_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, session.userId, ...values],
      );
    }

    return jsonOk({ ok: true });
  } catch (e) {
    console.error('medications POST', e);
    return jsonError('Opslaan mislukt.', 500);
  }
}
