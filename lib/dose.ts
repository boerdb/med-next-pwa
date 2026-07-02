export const DOSE_UNITS = ['mg', 'g', 'µg'] as const;
export type DoseUnit = (typeof DOSE_UNITS)[number];

export const DOSE_UNIT_OPTIONS: { value: DoseUnit; label: string }[] = [
  { value: 'mg', label: 'mg' },
  { value: 'g', label: 'gr' },
  { value: 'µg', label: 'µg' },
];

export function normalizeDoseUnit(raw: unknown): DoseUnit {
  if (raw === 'g' || raw === 'gr') return 'g';
  if (raw === 'µg' || raw === 'ug' || raw === 'ugr') return 'µg';
  return 'mg';
}

export function normalizeDoseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function normalizeDose(raw: {
  doseAmount?: unknown;
  doseUnit?: unknown;
}): { doseAmount: number | null; doseUnit: DoseUnit | null } {
  const doseAmount = normalizeDoseAmount(raw.doseAmount);
  if (doseAmount === null) {
    return { doseAmount: null, doseUnit: null };
  }
  return { doseAmount, doseUnit: normalizeDoseUnit(raw.doseUnit) };
}

export function formatDoseLabel(
  doseAmount: number | null | undefined,
  doseUnit: DoseUnit | null | undefined,
): string | null {
  if (doseAmount === null || doseAmount === undefined) return null;
  const unit = doseUnit ?? 'mg';
  const amount =
    Number.isInteger(doseAmount) ? String(doseAmount) : String(doseAmount).replace(/\.?0+$/, '');
  return `${amount} ${unit}`;
}

export function formatMedicationLabel(med: {
  name: string;
  doseAmount?: number | null;
  doseUnit?: DoseUnit | null;
}): string {
  const dose = formatDoseLabel(med.doseAmount, med.doseUnit);
  return dose ? `${med.name} ${dose}` : med.name;
}
