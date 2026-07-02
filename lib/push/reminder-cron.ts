import { getPool } from '@/lib/db/mysql';
import { rowToLogEntry, rowToMedication } from '@/lib/db/rows';
import { bundleReminderEvents } from '@/lib/reminder-bundle';
import { runReminderTick, type LogLite, type MedicationLite } from '@/lib/reminder-logic';
import { APP_TIMEZONE, toDateKeyInTimeZone } from '@/lib/timezone';
import type { RowDataPacket } from 'mysql2';
import {
  deletePushSubscription,
  getPushSubscriptionsForUser,
  getReminderFlags,
  getUserIdsWithPushSubscriptions,
  saveReminderFlags,
} from './store';
import { bundledReminderToPushPayload } from './reminder-payload';
import { isPushConfigured, sendMedicationPush } from './web-push';

type MedRow = RowDataPacket & {
  id: string;
  name: string;
  times: string;
  days_of_week: string | null;
  stock_count: number | null;
};

type LogRow = RowDataPacket & {
  medication_id: string;
  date_key: string;
  time: string;
  status: 'taken' | 'skipped';
};

async function loadUserReminderData(userId: string): Promise<{
  medications: MedicationLite[];
  logs: LogLite[];
}> {
  const pool = getPool();
  const dateKey = toDateKeyInTimeZone(new Date(), APP_TIMEZONE);

  const [medRows] = await pool.query<MedRow[]>(
    'SELECT id, name, times, days_of_week, stock_count FROM medications WHERE user_id = ?',
    [userId],
  );
  const medications: MedicationLite[] = medRows.map((r) => {
    const med = rowToMedication(r as MedRow & { stock_count: number | null });
    return { id: med.id, name: med.name, times: med.times, daysOfWeek: med.daysOfWeek };
  });

  const [logRows] = await pool.query<LogRow[]>(
    `SELECT medication_id, date_key, time, status
     FROM log_entries WHERE user_id = ? AND date_key = ?`,
    [userId, dateKey],
  );
  const logs: LogLite[] = logRows.map((r) => {
    const entry = rowToLogEntry({ ...r, id: '', medication_name: '', updated_at: '' });
    return {
      medicationId: entry.medicationId,
      dateKey: entry.dateKey,
      time: entry.time,
      status: entry.status,
    };
  });

  return { medications, logs };
}

export async function processMedicationReminderPush(): Promise<{
  ok: boolean;
  users: number;
  sent: number;
  failed: number;
  skipped: boolean;
  timezone?: string;
  dateKey?: string;
}> {
  if (!isPushConfigured()) {
    return { ok: true, users: 0, sent: 0, failed: 0, skipped: true };
  }

  const userIds = await getUserIdsWithPushSubscriptions();
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const subs = await getPushSubscriptionsForUser(userId);
    if (subs.length === 0) continue;

    const { medications, logs } = await loadUserReminderData(userId);
    const flags = await getReminderFlags(userId);
    const dateKey = toDateKeyInTimeZone(new Date(), APP_TIMEZONE);
    const { nextFlags, events } = runReminderTick({
      now: Date.now(),
      dateKey,
      medications,
      logs,
      flags,
      scheduleTimeZone: APP_TIMEZONE,
    });
    await saveReminderFlags(userId, nextFlags);

    const bundles = bundleReminderEvents(events, dateKey);
    for (const bundle of bundles) {
      const payload = bundledReminderToPushPayload(bundle);
      for (const sub of subs) {
        const result = await sendMedicationPush(sub, payload);
        if (result.ok) {
          sent++;
        } else {
          failed++;
          if (result.statusCode === 410 || result.statusCode === 404) {
            await deletePushSubscription(sub.endpoint);
          }
        }
      }
    }
  }

  return {
    ok: true,
    users: userIds.length,
    sent,
    failed,
    skipped: false,
    timezone: APP_TIMEZONE,
    dateKey: toDateKeyInTimeZone(new Date(), APP_TIMEZONE),
  };
}
