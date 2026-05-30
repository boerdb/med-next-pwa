import { createHash } from 'crypto';
import { getPool } from '@/lib/db/mysql';
import type { RowDataPacket } from 'mysql2';
import type { PushSubscriptionJSON } from './types';
import type { ReminderFlags } from '@/lib/reminder-logic';
import { APP_TIMEZONE, toDateKeyInTimeZone } from '@/lib/timezone';

function endpointHash(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex');
}

export async function upsertPushSubscription(
  userId: string,
  sub: PushSubscriptionJSON,
): Promise<void> {
  const pool = getPool();
  const hash = endpointHash(sub.endpoint);
  await pool.query(
    `INSERT INTO push_subscriptions (endpoint_hash, user_id, subscription_json)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), subscription_json = VALUES(subscription_json)`,
    [hash, userId, JSON.stringify(sub)],
  );
}

export async function deletePushSubscription(
  endpoint: string,
  userId?: string,
): Promise<void> {
  const pool = getPool();
  const hash = endpointHash(endpoint);
  if (userId) {
    await pool.query(
      'DELETE FROM push_subscriptions WHERE endpoint_hash = ? AND user_id = ?',
      [hash, userId],
    );
  } else {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint_hash = ?', [hash]);
  }
}

export async function getPushSubscriptionsForUser(
  userId: string,
): Promise<PushSubscriptionJSON[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT subscription_json FROM push_subscriptions WHERE user_id = ?',
    [userId],
  );
  return rows.map((r) => JSON.parse(String(r.subscription_json)) as PushSubscriptionJSON);
}

export async function getUserIdsWithPushSubscriptions(): Promise<string[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT DISTINCT user_id FROM push_subscriptions',
  );
  return rows.map((r) => String(r.user_id));
}

export async function getReminderFlags(userId: string): Promise<ReminderFlags> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT slot_key, first_sent, second_sent FROM push_reminder_flags WHERE user_id = ?',
    [userId],
  );
  const flags: ReminderFlags = {};
  for (const r of rows) {
    flags[String(r.slot_key)] = {
      first: Boolean(r.first_sent),
      second: Boolean(r.second_sent),
    };
  }
  return flags;
}

export async function saveReminderFlags(userId: string, flags: ReminderFlags): Promise<void> {
  const pool = getPool();
  const today = toDateKeyInTimeZone(new Date(), APP_TIMEZONE);

  const entries = Object.entries(flags).filter(([k]) => k.startsWith(`${today}::`));
  await pool.query('DELETE FROM push_reminder_flags WHERE user_id = ?', [userId]);
  for (const [slotKey, val] of entries) {
    await pool.query(
      `INSERT INTO push_reminder_flags (user_id, slot_key, first_sent, second_sent)
       VALUES (?, ?, ?, ?)`,
      [userId, slotKey, val.first ? 1 : 0, val.second ? 1 : 0],
    );
  }
}
