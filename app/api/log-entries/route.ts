import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db/mysql';
import { rowToLogEntry } from '@/lib/db/rows';
import { requireSession, jsonError, jsonOk } from '@/lib/api/http';
import { stockDeltaForStatusChange } from '@/lib/stock';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

type LogRow = RowDataPacket & {
  id: string;
  medication_id: string;
  medication_name: string;
  date_key: string;
  time: string;
  status: 'taken' | 'skipped';
  updated_at: string;
};

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  try {
    const pool = getPool();
    const [rows] = await pool.query<LogRow[]>(
      `SELECT id, medication_id, medication_name, date_key, time, status, updated_at
       FROM log_entries WHERE user_id = ? ORDER BY date_key DESC, time ASC`,
      [session.userId],
    );
    const logEntries = rows.map(rowToLogEntry);
    return jsonOk({ logEntries });
  } catch (e) {
    console.error('log-entries GET', e);
    return jsonError('Kon geschiedenis niet laden.', 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      id?: string;
      medicationId?: string;
      medicationName?: string;
      dateKey?: string;
      time?: string;
      status?: 'taken' | 'skipped';
      updatedAt?: string;
    };

    const {
      id,
      medicationId,
      medicationName,
      dateKey,
      time,
      status,
      updatedAt,
    } = body;

    if (
      !id ||
      !medicationId ||
      !medicationName ||
      !dateKey ||
      !time ||
      (status !== 'taken' && status !== 'skipped') ||
      !updatedAt
    ) {
      return jsonError('Ongeldige loggegevens.', 400);
    }

    const pool = getPool();

    const [slotRows] = await pool.query<RowDataPacket[]>(
      `SELECT status FROM log_entries
       WHERE user_id = ? AND medication_id = ? AND date_key = ? AND time = ?
       LIMIT 1`,
      [session.userId, medicationId, dateKey, time],
    );
    const previousStatus = slotRows[0]?.status as 'taken' | 'skipped' | undefined;

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT user_id FROM log_entries WHERE id = ? LIMIT 1',
      [id],
    );
    if (existing.length > 0) {
      if (existing[0]!.user_id !== session.userId) {
        return jsonError('Niet toegestaan.', 403);
      }
      await pool.query(
        `UPDATE log_entries SET medication_name = ?, status = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
        [medicationName, status, updatedAt, id, session.userId],
      );
    } else {
      try {
        await pool.query(
          `INSERT INTO log_entries
             (id, user_id, medication_id, medication_name, date_key, time, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            session.userId,
            medicationId,
            medicationName,
            dateKey,
            time,
            status,
            updatedAt,
          ],
        );
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === 'ER_DUP_ENTRY') {
          await pool.query<ResultSetHeader>(
            `UPDATE log_entries SET medication_name = ?, status = ?, updated_at = ?, id = ?
             WHERE user_id = ? AND medication_id = ? AND date_key = ? AND time = ?`,
            [
              medicationName,
              status,
              updatedAt,
              id,
              session.userId,
              medicationId,
              dateKey,
              time,
            ],
          );
        } else {
          throw err;
        }
      }
    }

    const stockDelta = stockDeltaForStatusChange(previousStatus, status);
    if (stockDelta !== 0) {
      await pool.query(
        `UPDATE medications
         SET stock_count = GREATEST(0, stock_count + ?)
         WHERE id = ? AND user_id = ? AND stock_count IS NOT NULL`,
        [stockDelta, medicationId, session.userId],
      );
    }

    return jsonOk({ ok: true });
  } catch (e) {
    console.error('log-entries POST', e);
    return jsonError('Opslaan mislukt.', 500);
  }
}
