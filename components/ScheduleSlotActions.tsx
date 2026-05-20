'use client';

import { Check, X } from 'lucide-react';
import type { Status } from '@/lib/db/types';

interface ScheduleSlotActionsProps {
  medicationId: string;
  medicationName: string;
  time: string;
  status?: Status;
  onLog: (
    medicationId: string,
    medicationName: string,
    time: string,
    status: Status,
  ) => void;
}

export function ScheduleSlotActions({
  medicationId,
  medicationName,
  time,
  status,
  onLog,
}: ScheduleSlotActionsProps) {
  const logged = status === 'taken' || status === 'skipped';

  if (!logged) {
    return (
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onLog(medicationId, medicationName, time, 'taken')}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
        >
          <Check className="w-3.5 h-3.5" />
          Innemen
        </button>
        <button
          type="button"
          onClick={() => onLog(medicationId, medicationName, time, 'skipped')}
          className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 active:scale-95 text-slate-600 dark:text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
        >
          <X className="w-3.5 h-3.5" />
          Slaan over
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        onLog(medicationId, medicationName, time, status === 'taken' ? 'skipped' : 'taken')
      }
      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline transition-colors flex-shrink-0"
    >
      Wijzigen
    </button>
  );
}
