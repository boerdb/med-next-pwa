'use client';

interface DailyProgressProps {
  taken: number;
  total: number;
}

export function DailyProgress({ taken, total }: DailyProgressProps) {
  if (total === 0) return null;

  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const label =
    taken === total
      ? 'Alles ingenomen! 🎉'
      : taken === 0
        ? 'Nog niets ingenomen'
        : `${taken} van ${total} ingenomen`;

  return (
    <div className="flex items-center gap-4 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      {/* SVG ring */}
      <div className="relative flex-shrink-0 w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
          {/* Track */}
          <circle
            cx="44" cy="44" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-100 dark:text-slate-700"
          />
          {/* Progress */}
          <circle
            cx="44" cy="44" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={taken === total ? 'text-emerald-500' : 'text-teal-500'}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">
            {taken}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">/{total}</span>
        </div>
      </div>

      {/* Text */}
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${taken === total ? 'bg-emerald-500' : 'bg-teal-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">{pct}% voltooid vandaag</p>
      </div>
    </div>
  );
}
