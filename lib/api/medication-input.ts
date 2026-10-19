import { normalizeDose } from '@/lib/dose';
import { isAsNeededMedication, normalizeCourse, normalizeDaysOfWeek } from '@/lib/schedule';

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
  const name = body.name?.trim();
  const asNeeded = isAsNeededMedication({ asNeeded: body.asNeeded });
  const times = Array.isArray(body.times) ? body.times : [];

  if (!name) {
    return { ok: false, error: 'Ongeldige medicijngegevens.' };
  }
  if (!asNeeded && times.length === 0) {
    return { ok: false, error: 'Ongeldige medicijngegevens.' };
  }

  if (asNeeded) {
    const stockCount =
      body.stockCount !== undefined && body.stockCount !== null
        ? Math.floor(Number(body.stockCount))
        : null;
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

  const stockCount =
    body.stockCount !== undefined && body.stockCount !== null
      ? Math.floor(Number(body.stockCount))
      : null;

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
