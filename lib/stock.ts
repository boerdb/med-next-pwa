import { averageDosesPerDay, isCourseMedication } from './schedule';
import { toLocalDateKey } from './utils';

/** Voorraad in dagen — alleen voor doorlopende medicatie, niet voor kuren. */
export function medicationDaysLeft(
  med: {
    stockCount: number | null;
    times: string[];
    daysOfWeek?: number[] | null;
    courseStartDate?: string | null;
    courseDays?: number | null;
  },
  _dateKey: string = toLocalDateKey(),
): number | null {
  if (isCourseMedication(med)) return null;
  if (med.stockCount === null || med.stockCount === undefined) return null;
  const perDay = averageDosesPerDay(med);
  if (perDay <= 0) return null;
  return Math.floor(med.stockCount / perDay);
}

/** Delta voor stock_count bij statuswijziging van een slot. */
export function stockDeltaForStatusChange(
  previous: 'taken' | 'skipped' | null | undefined,
  next: 'taken' | 'skipped',
): number {
  const wasTaken = previous === 'taken';
  const isTaken = next === 'taken';
  if (wasTaken && !isTaken) return 1;
  if (!wasTaken && isTaken) return -1;
  return 0;
}
