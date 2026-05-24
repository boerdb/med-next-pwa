'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { useAppData, type AppUser } from '@/hooks/useAppData';
import { LoginDialog } from './LoginDialog';

type AuthContextValue = ReturnType<typeof useAppData>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAppData();
  const pathname = usePathname();
  const [showLogin, setShowLogin] = useState(false);

  const isSplash = pathname === '/';
  const needsAuth = !isSplash && !auth.isLoading && !auth.user;

  useEffect(() => {
    if (needsAuth) {
      setShowLogin(true);
    } else {
      setShowLogin(false);
    }
  }, [needsAuth]);

  return (
    <AuthContext.Provider value={auth}>
      {children}
      {showLogin && (
        <LoginDialog required onClose={() => setShowLogin(false)} />
      )}
      {needsAuth && !showLogin && (
        <button
          type="button"
          onClick={() => setShowLogin(true)}
          className="fixed bottom-24 left-4 right-4 z-40 max-w-lg mx-auto py-3 px-4 rounded-xl bg-teal-600 text-white text-sm font-semibold shadow-lg"
        >
          Aanmelden of account aanmaken
        </button>
      )}
    </AuthContext.Provider>
  );
}

export type { AppUser };
