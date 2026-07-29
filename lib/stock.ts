import { averageDosesPerDay, courseDaysRemaining, isCourseMedication } from './schedule';
import { toLocalDateKey } from './utils';

/** stockCount = totaal aantal doses (tabletten); dagen = doses / gemiddelde innames per dag */
export function medicationDaysLeft(
  med: {
    stockCount: number | null;
    times: string[];
    daysOfWeek?: number[] | null;
    courseStartDate?: string | null;
    courseDays?: number | null;
  },
  dateKey: string = toLocalDateKey(),
): number | null {
  const courseRemaining = courseDaysRemaining(med, dateKey);

  let stockBased: number | null = null;
  if (med.stockCount !== null && med.stockCount !== undefined) {
    const perDay = isCourseMedication(med)
      ? med.times.length
      : averageDosesPerDay(med);
    if (perDay > 0) {
      stockBased = Math.floor(med.stockCount / perDay);
    }
  }

  if (courseRemaining !== null) {
    if (stockBased === null) return courseRemaining;
    return Math.min(stockBased, courseRemaining);
  }
  return stockBased;
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
