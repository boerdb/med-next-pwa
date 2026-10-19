'use client';

import { useState } from 'react';
import { Check, Loader2, RotateCcw, X } from 'lucide-react';
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
  ) => Promise<unknown> | void;
  onUndo?: (medicationId: string, time: string) => Promise<unknown> | void;
}

const baseBtn =
  'inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60';

export function ScheduleSlotActions({
  medicationId,
  medicationName,
  time,
  status,
  onLog,
  onUndo,
}: ScheduleSlotActionsProps) {
  const logged = status === 'taken' || status === 'skipped';
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Blokkeer de knoppen tot het opslaan klaar is (voorkomt dubbele taps).
  const run = async (action: () => Promise<unknown> | void) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  };

  if (!logged) {
    return (
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void run(() => onLog(medicationId, medicationName, time, 'taken'))}
          disabled={busy}
          className={`${baseBtn} bg-teal-600 hover:bg-teal-500 text-white`}
          aria-label={`${medicationName} om ${time} innemen`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Innemen
        </button>
        <button
          type="button"
          onClick={() => void run(() => onLog(medicationId, medicationName, time, 'skipped'))}
          disabled={busy}
          className={`${baseBtn} bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200`}
          aria-label={`${medicationName} om ${time} overslaan`}
        >
          <X className="w-4 h-4" />
          Overslaan
        </button>
      </div>
    );
  }

  if (!menuOpen) {
    return (
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        disabled={busy}
        className={`${baseBtn} shrink-0 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium`}
        aria-label={`Registratie van ${medicationName} om ${time} wijzigen`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Wijzigen'}
      </button>
    );
  }

  const other: Status = status === 'taken' ? 'skipped' : 'taken';

  return (
    <div className="basis-full flex flex-wrap gap-2 justify-end">
      <button
        type="button"
        onClick={() => void run(() => onLog(medicationId, medicationName, time, other))}
        disabled={busy}
        className={`${baseBtn} ${
          other === 'taken'
            ? 'bg-teal-600 hover:bg-teal-500 text-white'
            : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200'
        }`}
      >
        {other === 'taken' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
        {other === 'taken' ? 'Toch ingenomen' : 'Toch overgeslagen'}
      </button>
      {onUndo && (
        <button
          type="button"
          onClick={() => void run(() => onUndo(medicationId, time))}
          disabled={busy}
          className={`${baseBtn} border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700`}
        >
          <RotateCcw className="w-4 h-4" />
          Ongedaan maken
        </button>
      )}
      <button
        type="button"
        onClick={() => setMenuOpen(false)}
        disabled={busy}
        className={`${baseBtn} text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium`}
      >
        Annuleren
      </button>
    </div>
  );
}
