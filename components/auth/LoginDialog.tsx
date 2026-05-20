'use client';

import { useState } from 'react';
import { db } from '@/lib/db/instant';
import { Mail, KeyRound, Loader2, X } from 'lucide-react';

interface LoginDialogProps {
  onClose?: () => void;
}

export function LoginDialog({ onClose }: LoginDialogProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const sendCode = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setHint(null);
    try {
      await db.auth.sendMagicCode({ email: email.trim() });
      setStep('code');
      setHint('Controleer je e-mail voor de 6-cijferige code.');
    } catch (e) {
      setHint(e instanceof Error ? e.message : 'Kon de code niet versturen.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setHint(null);
    try {
      await db.auth.signInWithMagicCode({ email: email.trim(), code: code.trim() });
      onClose?.();
    } catch (e) {
      setHint(e instanceof Error ? e.message : 'Ongeldige code. Probeer opnieuw.');
    } finally {
      setBusy(false);
    }
  };

  const useAnonymous = async () => {
    setBusy(true);
    setHint(null);
    try {
      await db.auth.signInAsGuest();
      onClose?.();
    } catch (e) {
      setHint(e instanceof Error ? e.message : 'Anoniem inloggen mislukt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-navy-700 to-teal-700 px-6 pt-6 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Aanmelden</h2>
              <p className="text-sm text-white/70 mt-1">Sync je gegevens naar de cloud</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-white/60 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 -mt-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 space-y-4">
            {step === 'email' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    E-mailadres
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                        placeholder="jij@voorbeeld.nl"
                        autoComplete="email"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={sendCode}
                      disabled={busy || !email.trim()}
                      className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verstuur'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    Verificatiecode
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitCode()}
                        placeholder="123456"
                        autoComplete="one-time-code"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={submitCode}
                      disabled={busy || !code.trim()}
                      className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aanmelden'}
                    </button>
                  </div>
                  <button
                    onClick={() => { setStep('email'); setCode(''); setHint(null); }}
                    className="text-xs text-teal-600 dark:text-teal-400 mt-2 hover:underline"
                  >
                    ← Ander e-mailadres
                  </button>
                </div>
              </>
            )}

            {hint && (
              <p className={`text-xs px-3 py-2 rounded-lg ${step === 'code' && !hint.includes('fout') && !hint.includes('Ongeld') ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                {hint}
              </p>
            )}
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => void useAnonymous()}
              disabled={busy}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Bezig…' : 'Anoniem op dit apparaat verder gaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
