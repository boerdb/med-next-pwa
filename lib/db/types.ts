import type { DoseUnit } from '../dose';

export type Medication = {
  id: string;
  name: string;
  /** null = niet ingevuld */
  doseAmount: number | null;
  doseUnit: DoseUnit | null;
  times: string[];
  /** null = elke dag; anders gekozen weekdagen (0=zondag … 6=zaterdag) */
  daysOfWeek: number[] | null;
  stockCount: number | null;
};

export type LogEntry = {
  id: string;
  medicationId: string;
  medicationName: string;
  dateKey: string;
  time: string;
  status: 'taken' | 'skipped';
  updatedAt: string;
};

export type Tab = 'today' | 'manage' | 'history';
export type Status = 'taken' | 'skipped';

export type ScheduleRow = {
  id: string;
  medicationId: string;
  medicationName: string;
  time: string;
  status?: Status;
};

export type HistoryDayGroup = {
  dateKey: string;
  label: string;
  entries: LogEntry[];
  scheduleRows: ScheduleRow[];
  orphanEntries: LogEntry[];
  takenCount: number;
  skippedCount: number;
  expectedCount: number;
  allTaken: boolean;
  /** Every scheduled slot has taken or skipped (nothing missed). */
  isComplete: boolean;
};
