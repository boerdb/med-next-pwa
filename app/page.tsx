'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from 'lucide-react';

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace('/today');
    }, 900);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e3a5f] to-[#0f766e] select-none">
      <div className="animate-fade-scale flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl">
          <Pill className="w-10 h-10 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">MedTracker</h1>
          <p className="text-white/60 text-sm mt-1">Medicijnen bijhouden</p>
        </div>
      </div>
    </div>
  );
}
