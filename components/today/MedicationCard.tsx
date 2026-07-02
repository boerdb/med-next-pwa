'use client';

import { useMemo } from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';
import { ScheduleSlotActions } from '@/components/ScheduleSlotActions';
import { medicationDaysLeft } from '@/lib/stock';
import { formatMedicationLabel } from '@/lib/dose';
import { cn, compareTimeHHMM } from '@/lib/utils';
import type { Medication, LogEntry, Status } from '@/lib/db/types';

interface MedicationCardProps {
  medication: Medication;
  todayKey: string;
  logs: LogEntry[];
  onLog: (medicationId: string, medicationName: string, time: string, status: Status) => void;
}

export function MedicationCard({ medication, todayKey, logs, onLog }: MedicationCardProps) {
  const timesSorted = useMemo(
    () => [...medication.times].sort(compareTimeHHMM),
    [medication.times],
  );

  const daysLeft = medicationDaysLeft(medication);
  const isLowStock = daysLeft !== null && daysLeft <= 7;

  const allDone = timesSorted.every((time) =>
    logs.some(
      (l) =>
        l.medicationId === medication.id &&
        l.dateKey === todayKey &&
        l.time === time,
    ),
  );

  const displayName = formatMedicationLabel(medication);

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
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
            {displayName}
          </h3>
          {isLowStock && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" />
              Nog {daysLeft} dag{daysLeft === 1 ? '' : 'en'} voorraad
            </span>
          )}
        </div>
        {daysLeft !== null && !isLowStock && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0">
            {daysLeft}d voorraad
          </span>
        )}
        {allDone && (
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
      </div>

      {/* Time slots */}
      <div className="px-4 pb-4 space-y-2">
        {timesSorted.map((time) => {
          const log = logs.find(
            (l) =>
              l.medicationId === medication.id &&
              l.dateKey === todayKey &&
              l.time === time,
          );
          const logged = !!log;
          const status = log?.status;

          return (
            <div
              key={time}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl',
                logged
                  ? status === 'taken'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : 'bg-slate-50 dark:bg-slate-700/50'
                  : 'bg-slate-50 dark:bg-slate-700/50',
              )}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300">
                  {time}
                </span>
                {status === 'taken' && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Ingenomen</span>
                )}
                {status === 'skipped' && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Overgeslagen</span>
                )}
              </div>

              <ScheduleSlotActions
                medicationId={medication.id}
                medicationName={displayName}
                time={time}
                status={status}
                onLog={onLog}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
