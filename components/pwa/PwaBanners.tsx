'use client';

import { useState, useEffect } from 'react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { X, Download, Share2, RefreshCw } from 'lucide-react';

// ─── Install Banner ────────────────────────────────────────────────────────────

export function InstallBanner() {
  const { showAndroid, showIos, install, dismiss } = usePwaInstall();

  if (!showAndroid && !showIos) return null;

  return (
    <div className="fixed bottom-20 inset-x-3 z-50 max-w-sm mx-auto">
      <div className="bg-navy-800 dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-4 flex gap-3 items-start animate-slide-up">
        <div className="flex-shrink-0 w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">App installeren</p>
          {showIos ? (
            <p className="text-xs text-slate-300 mt-0.5">
              Tik op <Share2 className="inline w-3 h-3 mx-0.5" /> en kies{' '}
              <strong>&ldquo;Zet op beginscherm&rdquo;</strong>
            </p>
          ) : (
            <p className="text-xs text-slate-300 mt-0.5">
              Installeer voor snellere toegang en offline gebruik
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex gap-2 items-start">
          {showAndroid && (
            <button
              onClick={install}
              className="text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Installeren
            </button>
          )}
          <button
            onClick={dismiss}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
            aria-label="Sluiten"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Update Banner ─────────────────────────────────────────────────────────────

const UPDATE_SNOOZE_KEY = 'medtracker:updateSnooze';
const SNOOZE_MS = 4 * 60 * 60 * 1000; // 4 hours

export function UpdateBanner() {
  const [show, setShow] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const snooze = Number(localStorage.getItem(UPDATE_SNOOZE_KEY) ?? '0');
    if (Date.now() - snooze < SNOOZE_MS) return;

    navigator.serviceWorker.getRegistration().then((r) => {
      if (!r) return;
      setReg(r);

      const checkWaiting = () => {
        if (r.waiting) setShow(true);
      };

      checkWaiting();
      r.addEventListener('updatefound', () => {
        const newWorker = r.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShow(true);
          }
        });
      });
    });
  }, []);

  const snooze = () => {
    localStorage.setItem(UPDATE_SNOOZE_KEY, String(Date.now()));
    setShow(false);
  };

  const applyUpdate = () => {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setShow(false);
    // Reload once the new SW takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });
    // Fallback reload
    setTimeout(() => window.location.reload(), 1500);
  };

  if (!show) return null;

  return (
    <div className="fixed safe-top-offset inset-x-3 z-50 max-w-sm mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 flex gap-3 items-center animate-slide-down">
        <div className="flex-shrink-0 w-9 h-9 bg-teal-100 dark:bg-teal-900 rounded-xl flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Update beschikbaar</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Herlaad voor de nieuwste versie</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={snooze}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 px-2 py-1.5"
          >
            Later
          </button>
          <button
            onClick={applyUpdate}
            className="text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Bijwerken
          </button>
        </div>
      </div>
    </div>
  );
}
