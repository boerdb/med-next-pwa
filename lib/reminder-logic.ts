import { parseScheduleMsInTimeZone } from './timezone';
import { isMedicationDueOnDate } from './schedule';
import { formatMedicationLabel } from './dose';
import type { DoseUnit } from './dose';

export type ReminderFlags = Record<string, { first?: boolean; second?: boolean }>;

export type MedicationLite = {
  id: string;
  name: string;
  doseAmount?: number | null;
  doseUnit?: DoseUnit | null;
  times: string[];
  daysOfWeek?: number[] | null;
};
export type LogLite = {
  medicationId: string;
  dateKey: string;
  time: string;
  status: 'taken' | 'skipped';
};

export type ReminderEvent =
  | { kind: 'first'; medicationId: string; medicationName: string; time: string }
  | { kind: 'second'; medicationId: string; medicationName: string; time: string };

export function slotKey(dateKey: string, medicationId: string, time: string) {
  return `${dateKey}::${medicationId}::${time}`;
}

export function parseLocalScheduleMs(
  dateKey: string,
  timeHHMM: string,
  timeZone?: string,
): number {
  if (timeZone) {
    return parseScheduleMsInTimeZone(dateKey, timeHHMM, timeZone);
  }
  const [y, mo, d] = dateKey.split('-').map(Number);
  const [hh, mm] = timeHHMM.split(':').map(Number);
  return new Date(y, mo - 1, d, hh, mm, 0, 0).getTime();
}

export function pruneOldDays(flags: ReminderFlags, keepDateKey: string): ReminderFlags {
  const next: ReminderFlags = {};
  for (const [key, val] of Object.entries(flags)) {
    const datePrefix = key.split('::')[0];
    if (datePrefix === keepDateKey) next[key] = val;
  }
  return next;
}

export function runReminderTick(params: {
  now: number;
  dateKey: string;
  medications: MedicationLite[];
  logs: LogLite[];
  flags: ReminderFlags;
  /** IANA zone for server cron (e.g. Europe/Amsterdam). Omit on client = device local time. */
  scheduleTimeZone?: string;
}): { nextFlags: ReminderFlags; events: ReminderEvent[] } {
  const { now, dateKey, medications, logs, scheduleTimeZone } = params;
  const flags = { ...pruneOldDays(params.flags, dateKey) };
  const events: ReminderEvent[] = [];

  const statusBySlot = new Map(
    logs
      .filter((item) => item.dateKey === dateKey)
      .map((item) => [`${item.medicationId}::${item.time}`, item.status]),
  );

  const medNameById = new Map(
    medications.map((m) => [m.id, formatMedicationLabel(m)]),
  );

  for (const med of medications) {
    if (!isMedicationDueOnDate(med, dateKey)) continue;

    for (const time of med.times) {
      const status = statusBySlot.get(`${med.id}::${time}`);
      if (status === 'taken' || status === 'skipped') continue;

      const sk = slotKey(dateKey, med.id, time);
      const dueMs = parseLocalScheduleMs(dateKey, time, scheduleTimeZone);
      const duePlus5 = dueMs + 5 * 60 * 1000;
      const entry = flags[sk] ?? {};

      // Eerste melding zodra de tijd is (ook als cron/server later pas draait — niet meteen de +5 min-tekst).
      if (now >= dueMs && !entry.first) {
        flags[sk] = { ...entry, first: true };
        events.push({
          kind: 'first',
          medicationId: med.id,
          medicationName: medNameById.get(med.id) ?? 'Medicijn',
          time,
        });
        continue;
      }

      // Tweede melding alleen ≥5 min na inname-tijd én ná de eerste push.
      if (now >= duePlus5 && entry.first && !entry.second) {
        flags[sk] = { ...entry, first: true, second: true };
        events.push({
          kind: 'second',
          medicationId: med.id,
          medicationName: medNameById.get(med.id) ?? 'Medicijn',
          time,
        });
      }
    }
  }

  return { nextFlags: flags, events };
}
