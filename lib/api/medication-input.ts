import { normalizeDose } from '@/lib/dose';
import { isAsNeededMedication, normalizeCourse, normalizeDaysOfWeek } from '@/lib/schedule';
import { compareTimeHHMM } from '@/lib/utils';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ParsedMedicationInput = {
  name: string;
  doseAmount: number | null;
  doseUnit: ReturnType<typeof normalizeDose>['doseUnit'];
  times: string[];
  daysOfWeek: number[] | null;
  stockCount: number | null;
  courseStartDate: string | null;
  courseDays: number | null;
  asNeeded: boolean;
};

export function parseMedicationInput(body: {
  name?: string;
  doseAmount?: number | null;
  doseUnit?: string | null;
  times?: string[];
  daysOfWeek?: number[] | null;
  stockCount?: number | null;
  courseStartDate?: string | null;
  courseDays?: number | null;
  asNeeded?: boolean | number | null;
}): { ok: true; data: ParsedMedicationInput } | { ok: false; error: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const asNeeded = isAsNeededMedication({ asNeeded: body.asNeeded });
  const rawTimes = Array.isArray(body.times) ? body.times : [];

  if (!name || name.length > 255) {
    return { ok: false, error: 'Vul een geldige medicijnnaam in.' };
  }
  if (!rawTimes.every((t) => typeof t === 'string' && TIME_RE.test(t))) {
    return { ok: false, error: 'Ongeldige innametijd.' };
  }
  const times = [...new Set(rawTimes)].sort(compareTimeHHMM);
  if (!asNeeded && (times.length === 0 || times.length > 24)) {
    return { ok: false, error: 'Voeg minimaal één innametijd toe.' };
  }

  let stockCount: number | null = null;
  if (body.stockCount !== undefined && body.stockCount !== null) {
    const n = Number(body.stockCount);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      return { ok: false, error: 'Ongeldige voorraad.' };
    }
    stockCount = Math.floor(n);
  }

  if (asNeeded) {
    const { doseAmount, doseUnit } = normalizeDose(body);
    return {
      ok: true,
      data: {
        name,
        doseAmount,
        doseUnit,
        times: [],
        daysOfWeek: null,
        stockCount,
        courseStartDate: null,
        courseDays: null,
        asNeeded: true,
      },
    };
  }

  const course = normalizeCourse(body);
  const hasPartialCourse =
    (body.courseStartDate != null && body.courseStartDate !== '') ||
    (body.courseDays != null && body.courseDays !== undefined);

  if (hasPartialCourse && !course.courseStartDate) {
    return { ok: false, error: 'Vul een geldige kuur in (startdatum en aantal dagen).' };
  }

  let daysOfWeek = normalizeDaysOfWeek(body.daysOfWeek);
  if (course.courseStartDate) {
    daysOfWeek = null;
  } else if (body.daysOfWeek !== undefined && body.daysOfWeek !== null && daysOfWeek === null) {
    return { ok: false, error: 'Kies minimaal één dag per week.' };
  }

  const { doseAmount, doseUnit } = normalizeDose(body);

  return {
    ok: true,
    data: {
      name,
      doseAmount,
      doseUnit,
      times,
      daysOfWeek,
      stockCount,
      courseStartDate: course.courseStartDate,
      courseDays: course.courseDays,
      asNeeded: false,
    },
  };
}

export const MEDICATION_SELECT =
  'SELECT id, name, dose_amount, dose_unit, times, days_of_week, stock_count, course_start_date, course_days, as_needed, created_date FROM medications';

export const MEDICATION_WRITE_FIELDS =
  'name = ?, dose_amount = ?, dose_unit = ?, times = ?, days_of_week = ?, stock_count = ?, course_start_date = ?, course_days = ?, as_needed = ?';

export function medicationWriteValues(data: ParsedMedicationInput): unknown[] {
  return [
    data.name,
    data.doseAmount,
    data.doseUnit,
    JSON.stringify(data.times),
    data.daysOfWeek ? JSON.stringify(data.daysOfWeek) : null,
    data.stockCount,
    data.courseStartDate,
    data.courseDays,
    data.asNeeded ? 1 : 0,
  ];
}
