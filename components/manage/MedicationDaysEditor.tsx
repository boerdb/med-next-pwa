'use client';

import { cn } from '@/lib/utils';
import { WEEKDAY_OPTIONS } from '@/lib/schedule';

type Props = {
  /** null = elke dag; anders gekozen weekdagen */
  daysOfWeek: number[] | null;
  onChange: (daysOfWeek: number[] | null) => void;
};

export function MedicationDaysEditor({ daysOfWeek, onChange }: Props) {
  const isDaily = daysOfWeek === null;
  const selected = daysOfWeek ?? [];

  const setDaily = () => onChange(null);

  const toggleDay = (day: number) => {
    const next = selected.includes(day)
      ? selected.filter((d) => d !== day)
      : [...selected, day];
    if (next.length === 0) return;
    if (next.length === 7) {
      onChange(null);
      return;
    }
    onChange(next.sort((a, b) => a - b));
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Dagen per week
      </label>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={setDaily}
          className={cn(
            'flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors',
            isDaily
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600',
          )}
        >
          Elke dag
        </button>
        <button
          type="button"
          onClick={() => {
            if (isDaily) onChange([1, 4]);
          }}
          className={cn(
            'flex-1 py-2 text-sm font-semibold rounded-xl border transition-colors',
            !isDaily
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600',
          )}
        >
          Kies dagen
        </button>
      </div>

      {!isDaily && (
        <>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map(({ value, label }) => {
              const active = selected.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDay(value)}
                  className={cn(
                    'w-10 h-10 text-sm font-semibold rounded-xl border transition-colors',
                    active
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600',
                  )}
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {selected.length}× per week
            {selected.length === 1 ? '' : ''}
          </p>
        </>
      )}
    </div>
  );
}
