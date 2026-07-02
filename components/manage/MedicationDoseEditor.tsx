'use client';

import { DOSE_UNIT_OPTIONS, type DoseUnit } from '@/lib/dose';

type Props = {
  doseAmount: string;
  doseUnit: DoseUnit;
  onDoseAmountChange: (value: string) => void;
  onDoseUnitChange: (value: DoseUnit) => void;
};

export function MedicationDoseEditor({
  doseAmount,
  doseUnit,
  onDoseAmountChange,
  onDoseUnitChange,
}: Props) {
  return (
    <div className="flex gap-2 items-center flex-shrink-0">
      <input
        type="number"
        min="0"
        step="any"
        value={doseAmount}
        onChange={(e) => onDoseAmountChange(e.target.value)}
        placeholder="75"
        aria-label="Dosering"
        className="w-20 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
      />
      <select
        value={doseUnit}
        onChange={(e) => onDoseUnitChange(e.target.value as DoseUnit)}
        aria-label="Eenheid"
        className="w-20 px-2 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
      >
        {DOSE_UNIT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
