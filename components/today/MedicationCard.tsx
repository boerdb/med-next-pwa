'use client';

import { useMemo, useState } from 'react';
import { Check, Clock, AlertTriangle, Loader2, X } from 'lucide-react';
import { ScheduleSlotActions } from '@/components/ScheduleSlotActions';
import { medicationDaysLeft } from '@/lib/stock';
import { formatMedicationLabel } from '@/lib/dose';
import { formatCourseDayLabel, isAsNeededMedication, isCourseMedication } from '@/lib/schedule';
import { cn, compareTimeHHMM, nextUnusedTimeHHMM } from '@/lib/utils';
import type { Medication, LogEntry, Status } from '@/lib/db/types';

/** Na zoveel minuten na de innametijd heet een dosis "te laat". */
const LATE_AFTER_MIN = 30;

interface MedicationCardProps {
  medication: Medication;
  todayKey: string;
  logs: LogEntry[];
  /** Huidige tijd HH:MM (voor "nu", "te laat"). */
  nowHHMM: string;
  /** Sleutel `medicationId::time` van de eerstvolgende dosis van vandaag. */
  nextSlotKey: string | null;
  onLog: (
    medicationId: string,
    medicationName: string,
    time: string,
    status: Status,
  ) => Promise<unknown> | void;
  onUndo: (medicationId: string, time: string) => Promise<unknown> | void;
}

function minutesBetween(fromHHMM: string, toHHMM: string): number {
  return compareTimeHHMM(toHHMM, fromHHMM);
}

export function MedicationCard({
  medication,
  todayKey,
  logs,
  nowHHMM,
  nextSlotKey,
  onLog,
  onUndo,
}: MedicationCardProps) {
  const timesSorted = useMemo(
    () => [...medication.times].sort(compareTimeHHMM),
    [medication.times],
  );

  const daysLeft = medicationDaysLeft(medication);
  const isCourse = isCourseMedication(medication);
  const isAsNeeded = isAsNeededMedication(medication);
  const isLowStock = !isCourse && !isAsNeeded && daysLeft !== null && daysLeft <= 7;
  const courseDayLabel = formatCourseDayLabel(medication, todayKey);

  const asNeededLogs = useMemo(
    () =>
      logs
        .filter((l) => l.medicationId === medication.id && l.dateKey === todayKey && l.status === 'taken')
        .sort((a, b) => compareTimeHHMM(a.time, b.time)),
    [logs, medication.id, todayKey],
  );

  const allDone =
    !isAsNeeded &&
    timesSorted.every((time) =>
      logs.some(
        (l) =>
          l.medicationId === medication.id &&
          l.dateKey === todayKey &&
          l.time === time,
      ),
    );

  const displayName = formatMedicationLabel(medication);

  const [asNeededBusy, setAsNeededBusy] = useState(false);

  const runAsNeeded = async (action: () => Promise<unknown> | void) => {
    if (asNeededBusy) return;
    setAsNeededBusy(true);
    try {
      await action();
    } finally {
      setAsNeededBusy(false);
    }
  };

  const logAsNeeded = () => {
    const used = logs
      .filter((l) => l.medicationId === medication.id && l.dateKey === todayKey)
      .map((l) => l.time);
    return onLog(medication.id, displayName, nextUnusedTimeHHMM(used), 'taken');
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-800 rounded-2xl shadow-sm border overflow-hidden transition-all',
        allDone
          ? 'border-emerald-200 dark:border-emerald-800'
          : 'border-slate-100 dark:border-slate-700',
      )}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">
            {displayName}
          </h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {isAsNeeded && (
              <span className="inline-flex items-center text-xs font-medium bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full">
                Zo nodig
              </span>
            )}
            {courseDayLabel && (
              <span className="inline-flex items-center text-xs font-medium bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
                {courseDayLabel}
              </span>
            )}
            {isLowStock && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                Nog {daysLeft} dag{daysLeft === 1 ? '' : 'en'} voorraad
              </span>
            )}
          </div>
        </div>
        {daysLeft !== null && !isLowStock && !isCourse && !isAsNeeded && (
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0">
            {daysLeft}d voorraad
          </span>
        )}
        {allDone && (
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-label="Alles geregistreerd" />
          </div>
        )}
      </div>

      {isAsNeeded ? (
        <div className="px-4 pb-4 space-y-2">
          {asNeededLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between gap-3 pl-3 pr-1 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/20"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" aria-hidden />
                <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">
                  {log.time}
                </span>
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Ingenomen</span>
              </div>
              <button
                type="button"
                onClick={() => void runAsNeeded(() => onUndo(medication.id, log.time))}
                disabled={asNeededBusy}
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-slate-500 hover:text-red-600 hover:bg-white/70 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                aria-label={`Inname om ${log.time} ongedaan maken`}
                title="Ongedaan maken"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => void runAsNeeded(logAsNeeded)}
            disabled={asNeededBusy}
            className="w-full min-h-11 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold px-3 rounded-xl transition-all"
          >
            {asNeededBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Innemen
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-2">
          {timesSorted.map((time) => {
            const log = logs.find(
              (l) =>
                l.medicationId === medication.id &&
                l.dateKey === todayKey &&
                l.time === time,
            );
            const status = log?.status;
            const minutesPast = minutesBetween(time, nowHHMM);
            const isLate = !status && minutesPast > LATE_AFTER_MIN;
            const isNow = !status && minutesPast >= 0 && !isLate;
            const isNext = !status && !isNow && !isLate && nextSlotKey === `${medication.id}::${time}`;

            return (
              <div
                key={time}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 rounded-xl',
                  status === 'taken'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : isLate
                      ? 'bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800'
                      : isNow
                        ? 'bg-teal-50 dark:bg-teal-900/20 ring-1 ring-teal-200 dark:ring-teal-800'
                        : 'bg-slate-50 dark:bg-slate-700/50',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
                  <span className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
                    {time}
                  </span>
                  {status === 'taken' && (
                    <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Ingenomen</span>
                  )}
                  {status === 'skipped' && (
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Overgeslagen</span>
                  )}
                  {isLate && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                      Te laat
                    </span>
                  )}
                  {isNow && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
                      Nu
                    </span>
                  )}
                  {isNext && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200">
                      Volgende
                    </span>
                  )}
                </div>

                <ScheduleSlotActions
                  medicationId={medication.id}
                  medicationName={displayName}
                  time={time}
                  status={status}
                  onLog={onLog}
                  onUndo={onUndo}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
