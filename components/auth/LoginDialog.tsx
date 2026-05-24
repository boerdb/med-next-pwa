'use client';

import { useState } from 'react';
import { Mail, Lock, Loader2, X } from 'lucide-react';
import { notifyDataChanged } from '@/lib/db/refresh';

interface LoginDialogProps {
  onClose?: () => void;
}

export function LoginDialog({ onClose }: LoginDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setHint(null);
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setHint(data.error ?? 'Mislukt. Probeer opnieuw.');
        return;
      }
      notifyDataChanged();
      onClose?.();
    } catch (e) {
      setHint(e instanceof Error ? e.message : 'Mislukt. Probeer opnieuw.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-navy-700 to-teal-700 px-6 pt-6 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {mode === 'login' ? 'Aanmelden' : 'Account aanmaken'}
              </h2>
              <p className="text-sm text-white/70 mt-1">
                Sync je medicijnen via je eigen server
              </p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-white/60 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-6 -mt-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                E-mailadres
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submit()}
                  placeholder="jij@voorbeeld.nl"
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Wachtwoord
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submit()}
                  placeholder={mode === 'register' ? 'Min. 8 tekens' : '••••••••'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !email.trim() || !password}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                'Inloggen'
              ) : (
                'Registreren'
              )}
            </button>

            {hint && (
              <p className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {hint}
              </p>
            )}
          </div>

          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? (
              <>
                Nog geen account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setHint(null);
                  }}
                  className="text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                >
                  Registreren
                </button>
              </>
            ) : (
              <>
                Al een account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setHint(null);
                  }}
                  className="text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                >
                  Inloggen
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
