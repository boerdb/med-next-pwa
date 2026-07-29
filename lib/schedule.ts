import type { Medication, ScheduleRow } from './db/types';
import { formatMedicationLabel } from './dose';
import { compareTimeHHMM, parseDateKey, toLocalDateKey } from './utils';

export type CourseFields = {
  courseStartDate?: string | null;
  courseDays?: number | null;
};

/** JavaScript weekday: 0 = zondag … 6 = zaterdag */
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Ma' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Wo' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Vr' },
  { value: 6, label: 'Za' },
  { value: 0, label: 'Zo' },
] as const;

export function normalizeDaysOfWeek(raw: unknown): number[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const days = [...new Set(raw.map(Number).filter((d) => d >= 0 && d <= 6))].sort(
    (a, b) => a - b,
  );
  if (days.length === 0) return null;
  if (days.length === ALL_WEEKDAYS.length) return null;
  return days;
}

export function effectiveDaysOfWeek(med: { daysOfWeek?: number[] | null }): number[] {
  return med.daysOfWeek ?? [...ALL_WEEKDAYS];
}

export function isDailySchedule(med: { daysOfWeek?: number[] | null }): boolean {
  return med.daysOfWeek === null || med.daysOfWeek === undefined;
}

export function getWeekdayFromDateKey(dateKey: string): number | null {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  return date.getDay();
}

export function normalizeCourse(raw: CourseFields): {
  courseStartDate: string | null;
  courseDays: number | null;
} {
  const start = raw.courseStartDate?.trim();
  const daysRaw = raw.courseDays;
  if (!start || daysRaw == null || daysRaw === undefined) {
    return { courseStartDate: null, courseDays: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !parseDateKey(start)) {
    return { courseStartDate: null, courseDays: null };
  }
  const days = Math.floor(Number(daysRaw));
  if (!Number.isFinite(days) || days < 1 || days > 366) {
    return { courseStartDate: null, courseDays: null };
  }
  return { courseStartDate: start, courseDays: days };
}

export function isCourseMedication(med: CourseFields): boolean {
  return (
    med.courseStartDate != null &&
    med.courseDays != null &&
    med.courseDays > 0
  );
}

export function courseEndDate(med: CourseFields & { courseStartDate: string; courseDays: number }): string {
  const start = parseDateKey(med.courseStartDate);
  if (!start) return med.courseStartDate;
  const end = new Date(start);
  end.setDate(end.getDate() + med.courseDays - 1);
  return toLocalDateKey(end);
}

export function isCourseCompleted(med: CourseFields, dateKey: string = toLocalDateKey()): boolean {
  if (!isCourseMedication(med)) return false;
  return dateKey > courseEndDate(med as CourseFields & { courseStartDate: string; courseDays: number });
}

export function courseDaysRemaining(
  med: CourseFields,
  dateKey: string = toLocalDateKey(),
): number | null {
  if (!isCourseMedication(med)) return null;
  const end = courseEndDate(med as CourseFields & { courseStartDate: string; courseDays: number });
  if (dateKey > end) return 0;
  const endDate = parseDateKey(end);
  const current = parseDateKey(dateKey);
  if (!endDate || !current) return null;
  return Math.floor((endDate.getTime() - current.getTime()) / 86_400_000) + 1;
}

export function courseDayNumber(med: CourseFields, dateKey: string): number | null {
  if (!isCourseMedication(med)) return null;
  const start = parseDateKey(med.courseStartDate!);
  const current = parseDateKey(dateKey);
  if (!start || !current) return null;
  const dayNum = Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1;
  if (dayNum < 1 || dayNum > med.courseDays!) return null;
  return dayNum;
}

export function formatCourseDayLabel(med: CourseFields, dateKey: string): string | null {
  const dayNum = courseDayNumber(med, dateKey);
  if (dayNum === null) return null;
  return `Kuur dag ${dayNum}/${med.courseDays}`;
}

export function formatCourseScheduleLabel(med: CourseFields): string | null {
  if (!isCourseMedication(med)) return null;
  return `Kuur ${med.courseDays} dagen`;
}

export function suggestedCourseStock(courseDays: number, timesCount: number): number {
  return courseDays * timesCount;
}

export function isMedicationDueOnDate(
  med: { daysOfWeek?: number[] | null } & CourseFields,
  dateKey: string,
): boolean {
  if (isCourseMedication(med)) {
    if (dateKey < med.courseStartDate!) return false;
    if (dateKey > courseEndDate(med as CourseFields & { courseStartDate: string; courseDays: number })) {
      return false;
    }
    return true;
  }

  const weekday = getWeekdayFromDateKey(dateKey);
  if (weekday === null) return false;
  return effectiveDaysOfWeek(med).includes(weekday);
}

export function formatDaysOfWeekLabel(daysOfWeek: number[] | null | undefined): string {
  if (isDailySchedule({ daysOfWeek })) return 'Elke dag';
  const labels = new Map(WEEKDAY_OPTIONS.map((d) => [d.value, d.label]));
  return (daysOfWeek ?? [])
    .slice()
    .sort((a, b) => {
      const order = (d: number) => (d === 0 ? 7 : d);
      return order(a) - order(b);
    })
    .map((d) => labels.get(d as (typeof WEEKDAY_OPTIONS)[number]['value']) ?? '?')
    .join(', ');
}

export function getExpectedSlots(
  medications: Medication[],
  dateKey: string,
): ScheduleRow[] {
  return medications
    .filter((m) => isMedicationDueOnDate(m, dateKey))
    .flatMap((m) =>
      m.times.map((time) => ({
        id: `${m.id}-${time}`,
        medicationId: m.id,
        medicationName: formatMedicationLabel(m),
        time,
      })),
    )
    .sort((a, b) => compareTimeHHMM(a.time, b.time));
}

export function countExpectedDoses(
  medications: Medication[],
  dateKey: string,
): number {
  return getExpectedSlots(medications, dateKey).length;
}

/** Gemiddeld aantal doses per kalenderdag (voor voorraadberekening). */
export function averageDosesPerDay(med: { times: string[]; daysOfWeek?: number[] | null }): number {
  const daysPerWeek = effectiveDaysOfWeek(med).length;
  const dosesPerWeek = med.times.length * daysPerWeek;
  return dosesPerWeek / 7;
}
