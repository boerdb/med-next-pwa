export type Medication = {
  id: string;
  name: string;
  times: string[];
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
