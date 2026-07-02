import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db/mysql';
import { rowToMedication } from '@/lib/db/rows';
import { requireSession, jsonError, jsonOk } from '@/lib/api/http';
import { normalizeMedication } from '@/lib/utils';
import { normalizeDaysOfWeek } from '@/lib/schedule';
import { normalizeDose } from '@/lib/dose';
import type { RowDataPacket } from 'mysql2';

type MedRow = RowDataPacket & {
  id: string;
  name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  times: string;
  days_of_week: string | null;
  stock_count: number | null;
};

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  try {
    const pool = getPool();
    const [rows] = await pool.query<MedRow[]>(
      'SELECT id, name, dose_amount, dose_unit, times, days_of_week, stock_count FROM medications WHERE user_id = ? ORDER BY name',
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
    };
    const id = body.id;
    const name = body.name?.trim();
    const times = body.times;

    if (!id || !name || !Array.isArray(times) || times.length === 0) {
      return jsonError('Ongeldige medicijngegevens.', 400);
    }

    const daysOfWeek = normalizeDaysOfWeek(body.daysOfWeek);
    if (body.daysOfWeek !== undefined && body.daysOfWeek !== null && daysOfWeek === null) {
      return jsonError('Kies minimaal één dag per week.', 400);
    }

    const { doseAmount, doseUnit } = normalizeDose(body);

    const stockCount =
      body.stockCount !== undefined && body.stockCount !== null
        ? Math.floor(Number(body.stockCount))
        : null;

    const pool = getPool();
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT user_id FROM medications WHERE id = ? LIMIT 1',
      [id],
    );
    if (existing.length > 0) {
      if (existing[0]!.user_id !== session.userId) {
        return jsonError('Niet toegestaan.', 403);
      }
      await pool.query(
        'UPDATE medications SET name = ?, dose_amount = ?, dose_unit = ?, times = ?, days_of_week = ?, stock_count = ? WHERE id = ? AND user_id = ?',
        [name, doseAmount, doseUnit, JSON.stringify(times), daysOfWeek ? JSON.stringify(daysOfWeek) : null, stockCount, id, session.userId],
      );
    } else {
      await pool.query(
        'INSERT INTO medications (id, user_id, name, dose_amount, dose_unit, times, days_of_week, stock_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, session.userId, name, doseAmount, doseUnit, JSON.stringify(times), daysOfWeek ? JSON.stringify(daysOfWeek) : null, stockCount],
      );
    }

    return jsonOk({ ok: true });
  } catch (e) {
    console.error('medications POST', e);
    return jsonError('Opslaan mislukt.', 500);
  }
}
