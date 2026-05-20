'use client';

import { useState, useCallback } from 'react';
import { upsertLogEntry } from '@/lib/db/transact';
import { uid } from '@/lib/utils';
import type { LogEntry, Status } from '@/lib/db/types';

export function useMedicationLog(logs: LogEntry[], userId: string | undefined) {
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

      setLogError(null);

      const existing = logs.find(
        (l) =>
          l.medicationId === medicationId && l.dateKey === dateKey && l.time === time,
      );
      const id = existing?.id ?? uid();

      try {
        await upsertLogEntry(userId, id, {
          medicationId,
          medicationName,
          dateKey,
          time,
          status,
          updatedAt: new Date().toISOString(),
        });
        return true;
      } catch (e) {
        setLogError(e instanceof Error ? e.message : 'Opslaan mislukt. Probeer opnieuw.');
        return false;
      }
    },
    [logs, userId],
  );

  return { handleLog, logError, setLogError };
}
