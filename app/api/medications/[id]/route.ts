import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db/mysql';
import { requireSession, jsonError, jsonOk } from '@/lib/api/http';
import {
  MEDICATION_WRITE_FIELDS,
  medicationWriteValues,
  parseMedicationInput,
} from '@/lib/api/medication-input';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  const { id } = await params;

  try {
    const pool = getPool();
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM medications WHERE id = ? AND user_id = ?',
      [id, session.userId],
    );
    if (result.affectedRows === 0) {
      return jsonError('Medicijn niet gevonden.', 404);
    }
    return jsonOk({ ok: true });
  } catch (e) {
    console.error('medications DELETE', e);
    return jsonError('Verwijderen mislukt.', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  const { id } = await params;

  try {
    const body = (await req.json()) as {
      name?: string;
      doseAmount?: number | null;
      doseUnit?: string | null;
      times?: string[];
      daysOfWeek?: number[] | null;
      stockCount?: number | null;
      courseStartDate?: string | null;
      courseDays?: number | null;
    };

    const parsed = parseMedicationInput(body);
    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }

    const pool = getPool();
    const [owned] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM medications WHERE id = ? AND user_id = ? LIMIT 1',
      [id, session.userId],
    );
    if (owned.length === 0) {
      return jsonError('Medicijn niet gevonden.', 404);
    }

    await pool.query(
      `UPDATE medications SET ${MEDICATION_WRITE_FIELDS} WHERE id = ? AND user_id = ?`,
      [...medicationWriteValues(parsed.data), id, session.userId],
    );

    return jsonOk({ ok: true });
  } catch (e) {
    console.error('medications PUT', e);
    return jsonError('Opslaan mislukt.', 500);
  }
}
