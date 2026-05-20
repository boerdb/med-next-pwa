'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db/instant';
import { useInstantData } from '@/hooks/useInstantData';
import { useMedicationLog } from '@/hooks/useMedicationLog';
import { useNotifications } from '@/hooks/useNotifications';
import { DailyProgress } from '@/components/today/DailyProgress';
import { MedicationCard } from '@/components/today/MedicationCard';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Bell, BellOff, Loader2, LogOut, User } from 'lucide-react';
import { toLocalDateKey } from '@/lib/utils';
import type { Status } from '@/lib/db/types';

async function playTone(durationMs = 130, frequency = 880, volume = 0.12) {
  try {
    const ctx = new AudioContext();
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

export default function TodayPage() {
  const { isLoading, error, medications, logs, user } = useInstantData();
  const { enabled: notifEnabled, toggle: toggleNotif } = useNotifications(medications, logs);
  const [showLogin, setShowLogin] = useState(false);
  const todayKey = toLocalDateKey();
  const { handleLog: logForDate, logError } = useMedicationLog(logs, user?.id);

  // Show login dialog if cloud is configured and user is not logged in after loading
  useEffect(() => {
    if (!isLoading && !user) {
      // Small delay so the page renders first
      const t = setTimeout(() => setShowLogin(true), 800);
      return () => clearTimeout(t);
    }
  }, [isLoading, user]);

  const todayLogs = logs.filter((l) => l.dateKey === todayKey);
  const totalDoses = medications.reduce((sum, m) => sum + m.times.length, 0);
  const takenToday = todayLogs.filter((l) => l.status === 'taken').length;

  const handleLog = useCallback(
    async (medicationId: string, medicationName: string, time: string, status: Status) => {
      if (!user?.id) {
        setShowLogin(true);
        return;
      }
      await playTone(status === 'taken' ? 120 : 80, status === 'taken' ? 880 : 660);
      await logForDate(todayKey, medicationId, medicationName, time, status);
    },
    [logForDate, todayKey, user?.id],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Vandaag</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={toggleNotif}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title={notifEnabled ? 'Meldingen uitschakelen' : 'Meldingen inschakelen'}
          >
            {notifEnabled ? (
              <Bell className="w-4 h-4 text-teal-600" />
            ) : (
              <BellOff className="w-4 h-4 text-slate-400" />
            )}
          </button>
          {user ? (
            <button
              onClick={() => db.auth.signOut()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              title="Afmelden"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              title="Aanmelden"
            >
              <User className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {(error || logError) && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-800">
          {logError ?? error}
        </div>
      )}

      {/* Progress ring */}
      {medications.length > 0 && (
        <div className="mb-5">
          <DailyProgress taken={takenToday} total={totalDoses} />
        </div>
      )}

      {/* Medication cards */}
      {medications.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-lg font-medium">Geen medicijnen</p>
          <p className="text-sm mt-1">Voeg medicijnen toe via het tabblad Beheer</p>
        </div>
      ) : (
        <div className="space-y-3">
          {medications.map((med) => (
            <MedicationCard
              key={med.id}
              medication={med}
              todayKey={todayKey}
              logs={todayLogs}
              onLog={handleLog}
            />
          ))}
        </div>
      )}

      {/* Login dialog */}
      {showLogin && <LoginDialog onClose={() => setShowLogin(false)} />}
    </div>
  );
}
