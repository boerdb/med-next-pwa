'use client';

import { cn, toLocalDateKey } from '@/lib/utils';
import { suggestedCourseStock } from '@/lib/schedule';

type Props = {
  isCourse: boolean;
  courseStartDate: string;
  courseDays: number;
  timesCount: number;
  stockValue: string;
  onCourseModeChange: (isCourse: boolean) => void;
  onStartDateChange: (date: string) => void;
  onCourseDaysChange: (days: number) => void;
  onSuggestStock: (stock: number) => void;
};

const QUICK_DURATIONS = [5, 7, 10, 14] as const;

export function MedicationCourseEditor({
  isCourse,
  courseStartDate,
  courseDays,
  timesCount,
  stockValue,
  onCourseModeChange,
  onStartDateChange,
  onCourseDaysChange,
  onSuggestStock,
}: Props) {
  const suggestedStock = suggestedCourseStock(courseDays, timesCount);
  const stockNum = Number(stockValue);
  const showStockHint =
    isCourse &&
    timesCount > 0 &&
    courseDays > 0 &&
    (!stockValue.trim() || stockNum !== suggestedStock);

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Type
      </label>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => onCourseModeChange(false)}
          className={cn(
            'flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors',
            !isCourse
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600',
          )}
        >
          Doorlopend
        </button>
        <button
          type="button"
          onClick={() => onCourseModeChange(true)}
          className={cn(
            'flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors',
            isCourse
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600',
          )}
        >
          Kuur
        </button>
      </div>

      {isCourse && (
        <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Startdatum
            </label>
            <input
              type="date"
              value={courseStartDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Duur (dagen)
            </label>
            <div className="flex gap-2 flex-wrap">
              {QUICK_DURATIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onCourseDaysChange(n)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                    courseDays === n
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600',
                  )}
                >
                  {n} dagen
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={366}
                value={courseDays}
                onChange={(e) => onCourseDaysChange(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 px-2 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
              />
            </div>
          </div>

          {showStockHint && (
            <button
              type="button"
              onClick={() => onSuggestStock(suggestedStock)}
              className="text-xs text-teal-700 dark:text-teal-300 hover:underline"
            >
              Voorraad invullen: {suggestedStock} ({courseDays} dagen × {timesCount}× per dag)
            </button>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Kuurmedicatie verschijnt elke dag tot en met de laatste dag, daarna automatisch uit het schema.
          </p>
        </div>
      )}
    </div>
  );
}

export function defaultCourseStartDate(): string {
  return toLocalDateKey();
}

export function defaultCourseDays(): number {
  return 7;
}

export function readCourseFromMedication(med: {
  courseStartDate: string | null;
  courseDays: number | null;
}): { isCourse: boolean; courseStartDate: string; courseDays: number } {
  const isCourse = med.courseStartDate != null && med.courseDays != null && med.courseDays > 0;
  return {
    isCourse,
    courseStartDate: med.courseStartDate ?? defaultCourseStartDate(),
    courseDays: med.courseDays ?? defaultCourseDays(),
  };
}

export function courseFieldsForSave(
  isCourse: boolean,
  courseStartDate: string,
  courseDays: number,
): { courseStartDate: string | null; courseDays: number | null } {
  if (!isCourse) {
    return { courseStartDate: null, courseDays: null };
  }
  return { courseStartDate, courseDays };
}
