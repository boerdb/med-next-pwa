import type { Medication, ScheduleRow } from './db/types';
import { formatMedicationLabel } from './dose';
import { compareTimeHHMM, parseDateKey } from './utils';

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

export function isMedicationDueOnDate(
  med: { daysOfWeek?: number[] | null },
  dateKey: string,
): boolean {
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
