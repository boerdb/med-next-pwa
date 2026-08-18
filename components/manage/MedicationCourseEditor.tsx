'use client';

import { cn, toLocalDateKey } from '@/lib/utils';
import { suggestedCourseStock, type MedicationScheduleKind } from '@/lib/schedule';

type Props = {
  kind: MedicationScheduleKind;
  courseStartDate: string;
  courseDays: number;
  timesCount: number;
  stockValue: string;
  onKindChange: (kind: MedicationScheduleKind) => void;
  onStartDateChange: (date: string) => void;
  onCourseDaysChange: (days: number) => void;
  onSuggestStock: (stock: number) => void;
};

const QUICK_DURATIONS = [5, 7, 10, 14] as const;

const KIND_OPTIONS: { value: MedicationScheduleKind; label: string }[] = [
  { value: 'ongoing', label: 'Doorlopend' },
  { value: 'course', label: 'Kuur' },
  { value: 'asNeeded', label: 'Zo nodig' },
];

export function MedicationCourseEditor({
  kind,
  courseStartDate,
  courseDays,
  timesCount,
  stockValue,
  onKindChange,
  onStartDateChange,
  onCourseDaysChange,
  onSuggestStock,
}: Props) {
  const isCourse = kind === 'course';
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

      <div className="grid grid-cols-3 gap-2 mb-3">
        {KIND_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onKindChange(option.value)}
            className={cn(
              'py-2 px-1 text-sm font-semibold rounded-xl border transition-colors',
              kind === option.value
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {kind === 'asNeeded' && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">
          Alleen innemen als het nodig is. Geen vaste tijden, herinneringen of gemiste doses.
        </p>
      )}

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

export function readScheduleKind(med: {
  asNeeded: boolean;
  courseStartDate: string | null;
  courseDays: number | null;
}): MedicationScheduleKind {
  if (med.asNeeded) return 'asNeeded';
  if (med.courseStartDate != null && med.courseDays != null && med.courseDays > 0) return 'course';
  return 'ongoing';
}

export function courseFieldsForSave(
  kind: MedicationScheduleKind,
  courseStartDate: string,
  courseDays: number,
): { courseStartDate: string | null; courseDays: number | null; asNeeded: boolean } {
  if (kind === 'asNeeded') {
    return { courseStartDate: null, courseDays: null, asNeeded: true };
  }
  if (kind === 'course') {
    return { courseStartDate, courseDays, asNeeded: false };
  }
  return { courseStartDate: null, courseDays: null, asNeeded: false };
}
