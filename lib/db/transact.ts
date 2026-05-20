import { db } from './instant';
import type { LogEntry, Medication } from './types';

type MedicationFields = Pick<Medication, 'name' | 'times'> & {
  stockCount?: number | null;
};
type LogEntryFields = Omit<LogEntry, 'id'>;

/** Upsert medication and link to owner (required for InstantDB owner permissions). */
export async function upsertMedication(
  ownerId: string,
  id: string,
  fields: MedicationFields,
): Promise<void> {
  const { stockCount, ...rest } = fields;
  await db.transact([
    db.tx.medications[id].update({ ...rest, stockCount: stockCount ?? null }),
    db.tx.medications[id].link({ owner: ownerId }),
  ]);
}

/** Upsert log entry and link to owner (required for InstantDB owner permissions). */
export async function upsertLogEntry(
  ownerId: string,
  id: string,
  fields: LogEntryFields,
): Promise<void> {
  await db.transact([
    db.tx.logEntries[id].update(fields),
    db.tx.logEntries[id].link({ owner: ownerId }),
  ]);
}

export async function deleteMedication(id: string): Promise<void> {
  await db.transact(db.tx.medications[id].delete());
}
