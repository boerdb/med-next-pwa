'use client';

import { useId, useState } from 'react';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { notifyDataChanged } from '@/lib/db/refresh';

/** Verplicht inlogscherm (geen gastmodus). */
export function LoginDialog() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const titleId = useId();
  const emailId = useId();
  const passwordId = useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
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
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setHint(data.error ?? 'Mislukt. Probeer opnieuw.');
        return;
      }
      notifyDataChanged();
    } catch {
      setHint('Geen verbinding. Probeer opnieuw.');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setHint(null);
  };

  const inputClass =
    'w-full pl-9 pr-3 py-3 text-base bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="bg-gradient-to-br from-navy-700 to-teal-700 px-6 pt-6 pb-8">
          <h2 id={titleId} className="text-xl font-bold text-white">
            {mode === 'login' ? 'Aanmelden' : 'Account aanmaken'}
          </h2>
          <p className="text-sm text-white/80 mt-1">Sync je medicijnen via je eigen server</p>
        </div>

        <div className="px-6 py-6 -mt-4">
          <form
            onSubmit={(e) => void submit(e)}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 space-y-4"
          >
            <div>
              <label
                htmlFor={emailId}
                className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5"
              >
                E-mailadres
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                <input
                  id={emailId}
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jij@voorbeeld.nl"
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor={passwordId}
                className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5"
              >
                Wachtwoord
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                <input
                  id={passwordId}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min. 8 tekens' : '••••••••'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 8 : undefined}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !email.trim() || !password}
              className="w-full min-h-11 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-label="Bezig" />
              ) : mode === 'login' ? (
                'Inloggen'
              ) : (
                'Registreren'
              )}
            </button>

            {hint && (
              <p
                role="alert"
                className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              >
                {hint}
              </p>
            )}
          </form>

          <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
            {mode === 'login' ? 'Nog geen account?' : 'Al een account?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="min-h-11 px-1 text-teal-700 dark:text-teal-400 font-semibold hover:underline"
            >
              {mode === 'login' ? 'Registreren' : 'Inloggen'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
