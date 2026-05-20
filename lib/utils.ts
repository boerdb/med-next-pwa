/** Local date key (YYYY-MM-DD) using local timezone — avoids UTC midnight shift. */
export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey: string): Date | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

export function formatDateKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function normalizeMedication<T extends { stockCount?: number | null | string }>(raw: T): T {
  const parsed = Number(raw.stockCount);
  const stockCount =
    Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
  return { ...raw, stockCount };
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Compare "HH:MM" schedule strings for chronological sort. */
export function compareTimeHHMM(a: string, b: string): number {
  const pa = a.split(':').map(Number);
  const pb = b.split(':').map(Number);
  const ma = (pa[0] ?? 0) * 60 + (pa[1] ?? 0);
  const mb = (pb[0] ?? 0) * 60 + (pb[1] ?? 0);
  return ma - mb;
}

/** Earliest dose time for a medication, or end-of-day if none (sorts last). */
export function earliestMedicationTime(times: string[]): string {
  if (!times.length) return '99:99';
  return [...times].sort(compareTimeHHMM)[0]!;
}

export function sortMedicationsBySchedule<T extends { times: string[] }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    compareTimeHHMM(earliestMedicationTime(a.times), earliestMedicationTime(b.times)),
  );
}
