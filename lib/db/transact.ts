import { unsubscribePush } from '@/lib/push/client';
import { notifyDataChanged } from './refresh';
import type { LogEntry, Medication } from './types';

type MedicationFields = Pick<
  Medication,
  | 'name'
  | 'times'
  | 'daysOfWeek'
  | 'doseAmount'
  | 'doseUnit'
  | 'courseStartDate'
  | 'courseDays'
  | 'asNeeded'
> & {
  stockCount?: number | null;
};
type LogEntryFields = Omit<LogEntry, 'id'>;

async function apiFetch(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Opslaan mislukt.');
  }
  notifyDataChanged();
}

export async function upsertMedication(
  id: string,
  fields: MedicationFields,
): Promise<void> {
  await apiFetch('/api/medications', {
    method: 'POST',
    body: JSON.stringify({ id, ...fields }),
  });
}

export async function upsertLogEntry(
  id: string,
  fields: LogEntryFields,
): Promise<void> {
  await apiFetch('/api/log-entries', {
    method: 'POST',
    body: JSON.stringify({ id, ...fields }),
  });
}

export async function deleteLogEntry(fields: {
  medicationId: string;
  dateKey: string;
  time: string;
}): Promise<void> {
  await apiFetch('/api/log-entries', {
    method: 'DELETE',
    body: JSON.stringify(fields),
  });
}

export async function deleteMedication(id: string): Promise<void> {
  await apiFetch(`/api/medications/${id}`, { method: 'DELETE' });
}

export async function signOut(): Promise<void> {
  // Eerst push afmelden (vereist nog een sessie), anders blijven meldingen binnenkomen.
  await unsubscribePush().catch(() => {});
  await apiFetch('/api/auth/logout', { method: 'POST' });
  notifyDataChanged();
}
