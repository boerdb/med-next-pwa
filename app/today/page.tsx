'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { signOut } from '@/lib/db/transact';
import { useMedicationLog } from '@/hooks/useMedicationLog';
import { useNotifications } from '@/hooks/useNotifications';
import { useNow } from '@/hooks/useNow';
import { DailyProgress } from '@/components/today/DailyProgress';
import { MedicationCard } from '@/components/today/MedicationCard';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Bell, BellOff, Loader2, LogOut } from 'lucide-react';
import { capitalizeFirst, sortMedicationsBySchedule, toLocalDateKey, toLocalTimeHHMM } from '@/lib/utils';
import { getExpectedSlots, isMedicationDueOnDate } from '@/lib/schedule';
import type { Status } from '@/lib/db/types';

let audioCtx: AudioContext | null = null;

/** Korte bevestigingstoon; hergebruikt één AudioContext (browsers beperken het aantal). */
async function playTone(durationMs = 130, frequency = 880, volume = 0.12) {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequency;
    osc.type = 'sine';
    const t0 = ctx.currentTime;
    const dur = durationMs / 1000;
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch {
    // ignore — user hasn't interacted yet or AudioContext unavailable
  }
}

const headerBtn =
  'flex items-center justify-center w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm';

export default function TodayPage() {
  const { isLoading, error, medications, logs, user } = useAuth();
  const { enabled: notifEnabled, pushHint, toggle: toggleNotif } = useNotifications(
    medications,
    logs,
    { dataReady: !isLoading && !!user },
  );
  const now = useNow();
  const todayKey = toLocalDateKey(now);
  const nowHHMM = toLocalTimeHHMM(now);
  const { handleLog: logForDate, handleUndo, logError } = useMedicationLog();

  const todayLogs = useMemo(() => logs.filter((l) => l.dateKey === todayKey), [logs, todayKey]);
  const medicationsDueToday = useMemo(
    () => medications.filter((m) => isMedicationDueOnDate(m, todayKey)),
    [medications, todayKey],
  );
  const medicationsSorted = useMemo(
    () => sortMedicationsBySchedule(medicationsDueToday),
    [medicationsDueToday],
  );
  const expectedSlots = useMemo(() => getExpectedSlots(medications, todayKey), [medications, todayKey]);
  const totalDoses = expectedSlots.length;
  const loggedSlotKeys = useMemo(
    () => new Set(todayLogs.map((l) => `${l.medicationId}::${l.time}`)),
    [todayLogs],
  );
  const takenToday = todayLogs.filter(
    (l) =>
      l.status === 'taken' &&
      expectedSlots.some((s) => s.medicationId === l.medicationId && s.time === l.time),
  ).length;
  // Eerstvolgende tijd met open doses; alle doses op die tijd krijgen "Volgende".
  const nextSlot = expectedSlots.find(
    (s) => s.time > nowHHMM && !loggedSlotKeys.has(`${s.medicationId}::${s.time}`),
  );
  const nextTime = nextSlot?.time ?? null;

  const handleLog = useCallback(
    async (medicationId: string, medicationName: string, time: string, status: Status) => {
      if (!user?.id) return;
      void playTone(status === 'taken' ? 120 : 80, status === 'taken' ? 880 : 660);
      await logForDate(todayKey, medicationId, medicationName, time, status);
    },
    [logForDate, todayKey, user?.id],
  );

  const handleUndoToday = useCallback(
    (medicationId: string, time: string) => handleUndo(todayKey, medicationId, time),
    [handleUndo, todayKey],
  );

  const confirmSignOut = () => {
    if (confirm('Wil je afmelden? Meldingen op dit toestel stoppen dan.')) void signOut();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" aria-label="Laden" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Vandaag</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {capitalizeFirst(
              new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(now),
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={toggleNotif}
            className={headerBtn}
            title={notifEnabled ? 'Meldingen uitschakelen' : 'Meldingen inschakelen'}
            aria-label={notifEnabled ? 'Meldingen uitschakelen' : 'Meldingen inschakelen'}
            aria-pressed={notifEnabled}
          >
            {notifEnabled ? (
              <Bell className="w-5 h-5 text-teal-600" />
            ) : (
              <BellOff className="w-5 h-5 text-slate-400" />
            )}
          </button>
          {user && (
            <button
              type="button"
              onClick={confirmSignOut}
              className={headerBtn}
              title="Afmelden"
              aria-label="Afmelden"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {pushHint && (
        <p className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 mb-4">
          {pushHint}
        </p>
      )}

      {/* Error banner */}
      {(error || logError) && (
        <div
          role="alert"
          className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-800"
        >
          {logError ?? error}
        </div>
      )}

      {/* Progress ring */}
      {totalDoses > 0 && (
        <div className="mb-5">
          <DailyProgress taken={takenToday} total={totalDoses} />
        </div>
      )}

      {/* Medication cards */}
      {medicationsSorted.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <p className="text-lg font-medium">
            {medications.length === 0 ? 'Geen medicijnen' : 'Geen medicijnen gepland vandaag'}
          </p>
          <p className="text-sm mt-1">
            {medications.length === 0
              ? 'Voeg medicijnen toe via het tabblad Beheer'
              : 'Vandaag hoef je geen medicijnen in te nemen'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {medicationsSorted.map((med) => (
            <MedicationCard
              key={med.id}
              medication={med}
              todayKey={todayKey}
              logs={todayLogs}
              nowHHMM={nowHHMM}
              nextTime={nextTime}
              onLog={handleLog}
              onUndo={handleUndoToday}
            />
          ))}
        </div>
      )}
    </div>
  );
}
