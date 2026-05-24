/** stockCount = totaal aantal doses (tabletten); dagen = doses / innames per dag */
export function medicationDaysLeft(med: {
  stockCount: number | null;
  times: string[];
}): number | null {
  if (med.stockCount === null || med.stockCount === undefined) return null;
  const perDay = med.times.length;
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
