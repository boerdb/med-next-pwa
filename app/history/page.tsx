'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { useMedicationLog } from '@/hooks/useMedicationLog';
import { ScheduleSlotActions } from '@/components/ScheduleSlotActions';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { toLocalDateKey, parseDateKey } from '@/lib/utils';
import { Check, Minus, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { LogEntry, Medication, HistoryDayGroup, Status } from '@/lib/db/types';

const HISTORY_DAYS = 15;

function startOfDayLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function buildHistoryDays(
  medications: Medication[],
  logs: LogEntry[],
): HistoryDayGroup[] {
  const now = new Date();
  const days: HistoryDayGroup[] = [];

  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = startOfDayLocal(now);
    d.setDate(d.getDate() - i);
    const dateKey = toLocalDateKey(d);

    const dayLogs = logs.filter((l) => l.dateKey === dateKey);
    const activeMedIds = new Set(medications.map((m) => m.id));

    const scheduleRows = medications.flatMap((m) =>
      m.times.map((time) => ({
        id: `${m.id}-${time}`,
        medicationId: m.id,
        medicationName: m.name,
        time,
        status: dayLogs.find((l) => l.medicationId === m.id && l.time === time)?.status,
      })),
    ).sort((a, b) => a.time.localeCompare(b.time));

    const orphanEntries = dayLogs.filter((l) => !activeMedIds.has(l.medicationId));
    const takenCount = dayLogs.filter((l) => l.status === 'taken').length;
    const skippedCount = dayLogs.filter((l) => l.status === 'skipped').length;
    const expectedCount = scheduleRows.length;
    const allTaken = expectedCount > 0 && takenCount === expectedCount;
    const isComplete =
      expectedCount > 0 && takenCount + skippedCount >= expectedCount;

    if (scheduleRows.length === 0 && dayLogs.length === 0) continue;

    const date = parseDateKey(dateKey);
    const label = date
      ? new Intl.DateTimeFormat('nl-NL', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(date)
      : dateKey;

    days.push({
      dateKey,
      label,
      entries: dayLogs,
      scheduleRows,
      orphanEntries,
      takenCount,
      skippedCount,
      expectedCount,
      allTaken,
      isComplete,
    });
  }

  return days;
}

function AdherenceBar({ taken, skipped, expected }: { taken: number; skipped: number; expected: number }) {
  if (expected === 0) return null;

  return (
    <div className="flex gap-0.5 h-2 rounded-full overflow-hidden w-full mt-1.5">
      {Array.from({ length: expected }).map((_, i) => {
        let color = 'bg-slate-200 dark:bg-slate-700';
        if (i < taken) color = 'bg-emerald-500';
        else if (i < taken + skipped) color = 'bg-amber-400';
        return <div key={i} className={`flex-1 ${color} rounded-full`} />;
      })}
    </div>
  );
}

function DayHeaderContent({
  group,
  isToday,
  missedCount,
}: {
  group: HistoryDayGroup;
  isToday: boolean;
  missedCount: number;
}) {
  return (
    <>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold capitalize ${isToday ? 'text-teal-700 dark:text-teal-400' : 'text-slate-700 dark:text-slate-200'}`}
        >
          {isToday ? `Vandaag — ${group.label}` : group.label}
        </p>
        {group.expectedCount > 0 && (
          <AdherenceBar
            taken={group.takenCount}
            skipped={group.skippedCount}
            expected={group.expectedCount}
          />
        )}
      </div>
      <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
        {group.takenCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
            <Check className="w-3 h-3" />
            {group.takenCount}
          </span>
        )}
        {group.skippedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
            <Minus className="w-3 h-3" />
            {group.skippedCount}
          </span>
        )}
        {missedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400">
            <X className="w-3 h-3" />
            {missedCount}
          </span>
        )}
        {group.isComplete && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
            {group.allTaken ? '✓' : 'Onvolledig'}
          </span>
        )}
      </div>
    </>
  );
}

function DayRow({
  group,
  isToday,
  onLog,
}: {
  group: HistoryDayGroup;
  isToday: boolean;
  onLog: (
    dateKey: string,
    medicationId: string,
    medicationName: string,
    time: string,
    status: Status,
  ) => void;
}) {
  const missedCount = Math.max(0, group.expectedCount - group.takenCount - group.skippedCount);
  const canCollapse = group.isComplete;

  const [expanded, setExpanded] = useState(() => !canCollapse);
  const wasComplete = useRef(group.isComplete);

  useEffect(() => {
    if (group.isComplete && !wasComplete.current) {
      setExpanded(false);
    }
    wasComplete.current = group.isComplete;
  }, [group.isComplete]);

  const headerClass = `px-4 py-3 flex items-center justify-between gap-3 w-full text-left ${
    canCollapse ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors' : ''
  }`;

  const borderClass = isToday
    ? 'border-teal-200 dark:border-teal-800'
    : group.isComplete
      ? 'border-emerald-200 dark:border-emerald-800/60'
      : 'border-slate-100 dark:border-slate-700';

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm overflow-hidden ${borderClass}`}>
      {canCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={headerClass}
          aria-expanded={expanded}
        >
          <DayHeaderContent group={group} isToday={isToday} missedCount={missedCount} />
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" aria-hidden />
          )}
        </button>
      ) : (
        <div className={headerClass}>
          <DayHeaderContent group={group} isToday={isToday} missedCount={missedCount} />
        </div>
      )}

      {expanded && group.scheduleRows.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700/50">
          {group.scheduleRows.map((row) => (
            <div
              key={row.id}
              className={`flex items-center justify-between px-4 py-2.5 gap-3 ${
                row.status === 'taken'
                  ? 'bg-emerald-50/50 dark:bg-emerald-900/10'
                  : row.status === 'skipped'
                    ? 'bg-slate-50/50 dark:bg-slate-800/30'
                    : ''
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-11 shrink-0">{row.time}</span>
                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{row.medicationName}</span>
                {row.status === 'taken' && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline">Ingenomen</span>
                )}
                {row.status === 'skipped' && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">Overgeslagen</span>
                )}
              </div>
              <ScheduleSlotActions
                medicationId={row.medicationId}
                medicationName={row.medicationName}
                time={row.time}
                status={row.status}
                onLog={(medId, medName, time, status) =>
                  onLog(group.dateKey, medId, medName, time, status)
                }
              />
            </div>
          ))}
        </div>
      )}

      {expanded && group.orphanEntries.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2">
          <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide mb-1">Verwijderd medicijn</p>
          {group.orphanEntries.map((e) => (
            <div key={e.id} className="flex items-center gap-2 py-0.5">
              <span className="text-xs font-mono text-slate-400 w-11">{e.time}</span>
              <span className="text-xs text-slate-500 truncate">{e.medicationName}</span>
              <span className={`ml-auto text-xs ${e.status === 'taken' ? 'text-emerald-500' : 'text-amber-400'}`}>
                {e.status === 'taken' ? 'Ingenomen' : 'Overgeslagen'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const { medications, logs, isLoading, user } = useAppData();
  const [showLogin, setShowLogin] = useState(false);
  const { handleLog: logForDate, logError } = useMedicationLog(logs, user?.id);
  const todayKey = toLocalDateKey();

  const handleLog = useCallback(
    async (
      dateKey: string,
      medicationId: string,
      medicationName: string,
      time: string,
      status: Status,
    ) => {
      if (!user?.id) {
        setShowLogin(true);
        return;
      }
      await logForDate(dateKey, medicationId, medicationName, time, status);
    },
    [logForDate, user?.id],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const days = buildHistoryDays(medications, logs);

  const totalExpected = days.reduce((s, d) => s + d.expectedCount, 0);
  const totalTaken = days.reduce((s, d) => s + d.takenCount, 0);
  const adherencePct = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : null;

  return (
    <div className="max-w-lg mx-auto px-4 pb-4">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Geschiedenis</h1>
        {adherencePct !== null && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Naleving afgelopen {HISTORY_DAYS} dagen:{' '}
            <span
              className={`font-semibold ${adherencePct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : adherencePct >= 60 ? 'text-amber-500' : 'text-red-500'}`}
            >
              {adherencePct}%
            </span>
          </p>
        )}
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Gemiste doses kun je hier voor eerdere dagen alsnog aftekenen. Voltooide dagen kun je inklappen.
      </p>

      {logError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-800">
          {logError}
        </div>
      )}

      <div className="flex gap-4 mb-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Ingenomen
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Overgeslagen
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700" />
          Gemist
        </span>
      </div>

      {days.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-lg font-medium">Geen geschiedenis</p>
          <p className="text-sm mt-1">Begin met innemen via het tabblad Vandaag</p>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((group) => (
            <DayRow
              key={group.dateKey}
              group={group}
              isToday={group.dateKey === todayKey}
              onLog={handleLog}
            />
          ))}
        </div>
      )}

      {showLogin && <LoginDialog onClose={() => setShowLogin(false)} />}
    </div>
  );
}
