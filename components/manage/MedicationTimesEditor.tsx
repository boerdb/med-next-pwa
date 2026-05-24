'use client';

import { useState } from 'react';
import { Clock, Plus, X } from 'lucide-react';
import { compareTimeHHMM } from '@/lib/utils';

const QUICK_TIMES = ['08:00', '12:00', '18:00', '22:00'];

export function mergeMedicationTimes(times: string[], pending: string): string[] {
  const t = pending.trim();
  const list = [...times];
  if (t && !list.includes(t)) list.push(t);
  return list.sort(compareTimeHHMM);
}

interface MedicationTimesEditorProps {
  times: string[];
  onChange: (times: string[]) => void;
  /** Huidige waarde in het tijdveld (voor meenemen bij Opslaan). */
  onPendingTimeChange?: (value: string) => void;
}

export function MedicationTimesEditor({
  times,
  onChange,
  onPendingTimeChange,
}: MedicationTimesEditorProps) {
  const [newTime, setNewTime] = useState('');

  const setPending = (value: string) => {
    setNewTime(value);
    onPendingTimeChange?.(value);
  };

  const addTime = (value?: string) => {
    const t = (value ?? newTime).trim();
    if (!t) return;
    if (times.includes(t)) {
      setPending('');
      return;
    }
    onChange(mergeMedicationTimes(times, t));
    setPending('');
  };

  const removeTime = (t: string) => onChange(times.filter((x) => x !== t));

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        Innaametijden
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        Voeg elke tijd apart toe. Meerdere tijden per dag kan — kies een tijd en tik op{' '}
        <strong className="font-semibold">Tijd toevoegen</strong>.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_TIMES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => addTime(t)}
            disabled={times.includes(t)}
            className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-900/40 hover:text-teal-700 dark:hover:text-teal-300 disabled:opacity-40 transition-colors"
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setPending(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTime();
              }
            }}
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => addTime()}
          disabled={!newTime.trim()}
          className="flex items-center gap-1 px-3 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Toevoegen
        </button>
      </div>

      {times.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {times.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-full text-sm font-mono font-medium"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTime(t)}
                className="hover:text-red-500 transition-colors"
                aria-label={`${t} verwijderen`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-amber-600 dark:text-amber-400">Nog geen tijd toegevoegd.</p>
      )}
    </div>
  );
}
