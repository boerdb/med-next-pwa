import type { LogEntry, Medication } from './types';

type MedicationRow = {
  id: string;
  name: string;
  times: string | string[];
  stock_count: number | null;
};

type LogRow = {
  id: string;
  medication_id: string;
  medication_name: string;
  date_key: string;
  time: string;
  status: 'taken' | 'skipped';
  updated_at: string;
};

export function rowToMedication(row: MedicationRow): Medication {
  const times =
    typeof row.times === 'string' ? (JSON.parse(row.times) as string[]) : row.times;
  return {
    id: row.id,
    name: row.name,
    times,
    stockCount: row.stock_count,
  };
}

export function rowToLogEntry(row: LogRow): LogEntry {
  return {
    id: row.id,
    medicationId: row.medication_id,
    medicationName: row.medication_name,
    dateKey: row.date_key,
    time: row.time,
    status: row.status,
    updatedAt: row.updated_at,
  };
}
