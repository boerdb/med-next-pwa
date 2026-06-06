import type { ReminderEvent } from '@/lib/reminder-logic';

export type BundledReminderEvent = {
  kind: 'first' | 'second';
  time: string;
  dateKey: string;
  medications: { medicationId: string; medicationName: string }[];
};

export function formatMedicationList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} en ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]}`;
}

export function bundleReminderEvents(
  events: ReminderEvent[],
  dateKey: string,
): BundledReminderEvent[] {
  const groups = new Map<string, BundledReminderEvent>();

  for (const ev of events) {
    const key = `${ev.kind}::${ev.time}`;
    let group = groups.get(key);
    if (!group) {
      group = { kind: ev.kind, time: ev.time, dateKey, medications: [] };
      groups.set(key, group);
    }
    group.medications.push({
      medicationId: ev.medicationId,
      medicationName: ev.medicationName,
    });
  }

  for (const group of groups.values()) {
    group.medications.sort((a, b) =>
      a.medicationName.localeCompare(b.medicationName, 'nl'),
    );
  }

  return Array.from(groups.values());
}

export function bundledReminderTag(
  dateKey: string,
  time: string,
  kind: 'first' | 'second',
): string {
  const raw = `${dateKey}-${time.replace(':', '')}-${kind}`;
  return `mt-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export function bundledReminderTitle(kind: 'first' | 'second'): string {
  return kind === 'first' ? 'Medicijn innemen' : 'Nog niet geregistreerd';
}

export function bundledReminderBody(bundle: BundledReminderEvent): string {
  const names = bundle.medications.map((m) => m.medicationName);
  const list = formatMedicationList(names);

  if (bundle.kind === 'first') {
    return `${list} — ${bundle.time}. Tik in de app op Innemen.`;
  }
  return `${list} (${bundle.time}): nog niet als ingenomen gemarkeerd. Open de app en tik op Innemen.`;
}

export function bundledReminderVibrate(kind: 'first' | 'second'): number[] {
  return kind === 'first' ? [160] : [180, 100, 180];
}
