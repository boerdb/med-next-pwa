import { normalizeDose, type DoseUnit } from './dose';
import { isAsNeededMedication, normalizeDaysOfWeek, normalizeCourse } from './schedule';

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

export function normalizeMedication<
  T extends {
    stockCount?: number | null | string;
    daysOfWeek?: unknown;
    doseAmount?: unknown;
    doseUnit?: unknown;
    courseStartDate?: string | null;
    courseDays?: number | null;
    asNeeded?: boolean | number | null;
  },
>(
  raw: T,
): T & {
  daysOfWeek: number[] | null;
  stockCount: number | null;
  doseAmount: number | null;
  doseUnit: DoseUnit | null;
  courseStartDate: string | null;
  courseDays: number | null;
  asNeeded: boolean;
} {
  const parsed = Number(raw.stockCount);
  const stockCount =
    Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
  const { doseAmount, doseUnit } = normalizeDose(raw);
  const asNeeded = isAsNeededMedication(raw);
  const course = asNeeded ? { courseStartDate: null, courseDays: null } : normalizeCourse(raw);
  return {
    ...raw,
    stockCount,
    daysOfWeek: asNeeded ? null : normalizeDaysOfWeek(raw.daysOfWeek),
    doseAmount,
    doseUnit,
    courseStartDate: course.courseStartDate,
    courseDays: course.courseDays,
    asNeeded,
  };
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

export function toLocalTimeHHMM(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Next unused HH:MM for extra zo-nodig logs on the same day. */
export function nextUnusedTimeHHMM(used: string[], preferred: string = toLocalTimeHHMM()): string {
  const occupied = new Set(used);
  const parts = preferred.split(':').map(Number);
  let hours = parts[0] ?? 0;
  let minutes = parts[1] ?? 0;
  for (let i = 0; i < 24 * 60; i++) {
    const candidate = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    if (!occupied.has(candidate)) return candidate;
    minutes += 1;
    if (minutes >= 60) {
      minutes = 0;
      hours = (hours + 1) % 24;
    }
  }
  return preferred;
}
