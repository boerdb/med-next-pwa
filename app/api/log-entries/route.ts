import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/db/mysql';
import { rowToLogEntry } from '@/lib/db/rows';
import { requireSession, jsonError, jsonOk } from '@/lib/api/http';
import { stockDeltaForStatusChange } from '@/lib/stock';
import type { RowDataPacket } from 'mysql2';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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

  const since = req.nextUrl.searchParams.get('since');
  if (since && !DATE_KEY_RE.test(since)) {
    return jsonError('Ongeldige datum.', 400);
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query<LogRow[]>(
      `SELECT id, medication_id, medication_name, date_key, time, status, updated_at
       FROM log_entries WHERE user_id = ? AND date_key >= ? ORDER BY date_key DESC, time ASC`,
      [session.userId, since ?? '0000-00-00'],
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

    if (!DATE_KEY_RE.test(dateKey) || !TIME_RE.test(time)) {
      return jsonError('Ongeldige loggegevens.', 400);
    }

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();

      // Vergrendel het medicijn: gelijktijdige taps op hetzelfde medicijn lopen na elkaar,
      // zodat de voorraad niet dubbel wordt afgeboekt.
      const [medRows] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM medications WHERE id = ? AND user_id = ? FOR UPDATE',
        [medicationId, session.userId],
      );
      if (medRows.length === 0) {
        await conn.rollback();
        return jsonError('Medicijn niet gevonden.', 404);
      }

      const [slotRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, status FROM log_entries
         WHERE user_id = ? AND medication_id = ? AND date_key = ? AND time = ?
         LIMIT 1`,
        [session.userId, medicationId, dateKey, time],
      );
      const previousStatus = slotRows[0]?.status as 'taken' | 'skipped' | undefined;

      if (slotRows.length > 0) {
        await conn.query(
          `UPDATE log_entries SET medication_name = ?, status = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`,
          [medicationName, status, updatedAt, slotRows[0]!.id, session.userId],
        );
      } else {
        const [existing] = await conn.query<RowDataPacket[]>(
          'SELECT user_id FROM log_entries WHERE id = ? LIMIT 1',
          [id],
        );
        if (existing.length > 0) {
          await conn.rollback();
          return jsonError('Niet toegestaan.', 403);
        }
        await conn.query(
          `INSERT INTO log_entries
             (id, user_id, medication_id, medication_name, date_key, time, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, session.userId, medicationId, medicationName, dateKey, time, status, updatedAt],
        );
      }

      const stockDelta = stockDeltaForStatusChange(previousStatus, status);
      if (stockDelta !== 0) {
        await conn.query(
          `UPDATE medications
           SET stock_count = GREATEST(0, stock_count + ?)
           WHERE id = ? AND user_id = ? AND stock_count IS NOT NULL`,
          [stockDelta, medicationId, session.userId],
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }

    return jsonOk({ ok: true });
  } catch (e) {
    console.error('log-entries POST', e);
    return jsonError('Opslaan mislukt.', 500);
  }
}

/** Registratie van één slot verwijderen (ongedaan maken); voorraad terug als die ingenomen was. */
export async function DELETE(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      medicationId?: string;
      dateKey?: string;
      time?: string;
    };
    const { medicationId, dateKey, time } = body;
    if (
      !medicationId ||
      !dateKey ||
      !time ||
      !DATE_KEY_RE.test(dateKey) ||
      !TIME_RE.test(time)
    ) {
      return jsonError('Ongeldige loggegevens.', 400);
    }

    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();

      // Zelfde volgorde van vergrendelen als bij POST.
      await conn.query(
        'SELECT id FROM medications WHERE id = ? AND user_id = ? FOR UPDATE',
        [medicationId, session.userId],
      );
      const [slotRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, status FROM log_entries
         WHERE user_id = ? AND medication_id = ? AND date_key = ? AND time = ?
         LIMIT 1 FOR UPDATE`,
        [session.userId, medicationId, dateKey, time],
      );
      if (slotRows.length === 0) {
        await conn.rollback();
        return jsonError('Registratie niet gevonden.', 404);
      }

      await conn.query('DELETE FROM log_entries WHERE id = ? AND user_id = ?', [
        slotRows[0]!.id,
        session.userId,
      ]);
      if (slotRows[0]!.status === 'taken') {
        await conn.query(
          `UPDATE medications SET stock_count = stock_count + 1
           WHERE id = ? AND user_id = ? AND stock_count IS NOT NULL`,
          [medicationId, session.userId],
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }

    return jsonOk({ ok: true });
  } catch (e) {
    console.error('log-entries DELETE', e);
    return jsonError('Ongedaan maken mislukt.', 500);
  }
}
