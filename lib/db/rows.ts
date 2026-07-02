import { normalizeDose } from '../dose';
import { normalizeDaysOfWeek } from '../schedule';
import type { LogEntry, Medication } from './types';

type MedicationRow = {
  id: string;
  name: string;
  dose_amount?: number | string | null;
  dose_unit?: string | null;
  times: string | string[];
  days_of_week?: string | number[] | null;
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
  let daysRaw: unknown = row.days_of_week ?? null;
  if (typeof daysRaw === 'string') {
    try {
      daysRaw = JSON.parse(daysRaw) as unknown;
    } catch {
      daysRaw = null;
    }
  }
  const { doseAmount, doseUnit } = normalizeDose({
    doseAmount: row.dose_amount,
    doseUnit: row.dose_unit,
  });
  return {
    id: row.id,
    name: row.name,
    doseAmount,
    doseUnit,
    times,
    daysOfWeek: normalizeDaysOfWeek(daysRaw),
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
