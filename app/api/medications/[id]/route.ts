import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db/mysql';
import { requireSession, jsonError, jsonOk } from '@/lib/api/http';
import { normalizeDaysOfWeek } from '@/lib/schedule';
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
      times?: string[];
      daysOfWeek?: number[] | null;
      stockCount?: number | null;
    };
    const name = body.name?.trim();
    const times = body.times;

    if (!name || !Array.isArray(times) || times.length === 0) {
      return jsonError('Ongeldige medicijngegevens.', 400);
    }

    const daysOfWeek = normalizeDaysOfWeek(body.daysOfWeek);
    if (body.daysOfWeek !== undefined && body.daysOfWeek !== null && daysOfWeek === null) {
      return jsonError('Kies minimaal één dag per week.', 400);
    }

    const stockCount =
      body.stockCount !== undefined && body.stockCount !== null
        ? Math.floor(Number(body.stockCount))
        : null;

    const pool = getPool();
    const [owned] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM medications WHERE id = ? AND user_id = ? LIMIT 1',
      [id, session.userId],
    );
    if (owned.length === 0) {
      return jsonError('Medicijn niet gevonden.', 404);
    }

    await pool.query(
      'UPDATE medications SET name = ?, times = ?, days_of_week = ?, stock_count = ? WHERE id = ? AND user_id = ?',
      [name, JSON.stringify(times), daysOfWeek ? JSON.stringify(daysOfWeek) : null, stockCount, id, session.userId],
    );

    return jsonOk({ ok: true });
  } catch (e) {
    console.error('medications PUT', e);
    return jsonError('Opslaan mislukt.', 500);
  }
}
