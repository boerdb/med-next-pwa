'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { deleteLogEntry, upsertLogEntry } from '@/lib/db/transact';
import { uid } from '@/lib/utils';
import type { LogEntry, Status } from '@/lib/db/types';

function isSlot(l: LogEntry, medicationId: string, dateKey: string, time: string) {
  return l.medicationId === medicationId && l.dateKey === dateKey && l.time === time;
}

/**
 * Registreren en ongedaan maken van innames. De lijst wordt direct lokaal bijgewerkt;
 * bij een fout wordt de servertoestand opnieuw geladen.
 */
export function useMedicationLog() {
  const { logs, user, isOffline, patchLogs, refresh } = useAuth();
  const userId = user?.id;
  const [logError, setLogError] = useState<string | null>(null);

  const handleLog = useCallback(
    async (
      dateKey: string,
      medicationId: string,
      medicationName: string,
      time: string,
      status: Status,
    ): Promise<boolean> => {
      if (!userId) return false;
      if (isOffline) {
        setLogError('Geen verbinding — registreren lukt pas als je weer online bent.');
        return false;
      }

      setLogError(null);

      const existing = logs.find((l) => isSlot(l, medicationId, dateKey, time));
      const entry: LogEntry = {
        id: existing?.id ?? uid(),
        medicationId,
        medicationName,
        dateKey,
        time,
        status,
        updatedAt: new Date().toISOString(),
      };

      patchLogs((prev) => [
        ...prev.filter((l) => !isSlot(l, medicationId, dateKey, time)),
        entry,
      ]);

      try {
        const { id, ...fields } = entry;
        await upsertLogEntry(id, fields);
        return true;
      } catch (e) {
        setLogError(e instanceof Error ? e.message : 'Opslaan mislukt. Probeer opnieuw.');
        void refresh();
        return false;
      }
    },
    [logs, userId, isOffline, patchLogs, refresh],
  );

  const handleUndo = useCallback(
    async (dateKey: string, medicationId: string, time: string): Promise<boolean> => {
      if (!userId) return false;
      if (isOffline) {
        setLogError('Geen verbinding — ongedaan maken lukt pas als je weer online bent.');
        return false;
      }

      setLogError(null);
      patchLogs((prev) => prev.filter((l) => !isSlot(l, medicationId, dateKey, time)));

      try {
        await deleteLogEntry({ medicationId, dateKey, time });
        return true;
      } catch (e) {
        setLogError(e instanceof Error ? e.message : 'Ongedaan maken mislukt.');
        void refresh();
        return false;
      }
    },
    [userId, isOffline, patchLogs, refresh],
  );

  return { handleLog, handleUndo, logError, setLogError };
}
