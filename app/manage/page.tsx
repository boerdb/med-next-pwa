'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { upsertMedication, deleteMedication } from '@/lib/db/transact';
import { medicationDaysLeft } from '@/lib/stock';
import { uid } from '@/lib/utils';
import {
  Plus, Trash2, Pencil, Check, ChevronDown, ChevronUp,
  Loader2,
} from 'lucide-react';
import type { Medication } from '@/lib/db/types';
import {
  MedicationTimesEditor,
  mergeMedicationTimes,
} from '@/components/manage/MedicationTimesEditor';
import { MedicationDaysEditor } from '@/components/manage/MedicationDaysEditor';
import { MedicationDoseEditor } from '@/components/manage/MedicationDoseEditor';
import {
  MedicationCourseEditor,
  courseFieldsForSave,
  defaultCourseDays,
  defaultCourseStartDate,
  readScheduleKind,
} from '@/components/manage/MedicationCourseEditor';
import { formatDaysOfWeekLabel, formatCourseScheduleLabel, isCourseCompleted, isCourseMedication, isAsNeededMedication, type MedicationScheduleKind } from '@/lib/schedule';
import { formatMedicationLabel, normalizeDose, type DoseUnit } from '@/lib/dose';
import { toLocalDateKey } from '@/lib/utils';

function AddMedicationForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [doseAmount, setDoseAmount] = useState('');
  const [doseUnit, setDoseUnit] = useState<DoseUnit>('mg');
  const [times, setTimes] = useState<string[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState<number[] | null>(null);
  const [kind, setKind] = useState<MedicationScheduleKind>('ongoing');
  const [courseStartDate, setCourseStartDate] = useState(defaultCourseStartDate());
  const [courseDays, setCourseDays] = useState(defaultCourseDays());
  const [pendingTime, setPendingTime] = useState('');
  const [stock, setStock] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const allTimes = kind === 'asNeeded' ? [] : mergeMedicationTimes(times, pendingTime);
    if (!name.trim() || (kind !== 'asNeeded' && allTimes.length === 0)) {
      setError(
        kind === 'asNeeded'
          ? 'Vul een medicijnnaam in.'
          : 'Vul een medicijnnaam in en voeg minimaal één innametijd toe (knop Toevoegen of snelkiezen).',
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const parsedStock = Number(stock.trim());
      const stockCount = stock.trim() && Number.isFinite(parsedStock) && parsedStock >= 0
        ? Math.floor(parsedStock) : null;
      const { doseAmount: normalizedDose, doseUnit: normalizedUnit } = normalizeDose({
        doseAmount: doseAmount.trim() || null,
        doseUnit,
      });
      const id = uid();
      const course = courseFieldsForSave(kind, courseStartDate, courseDays);
      await upsertMedication(id, {
        name: name.trim(),
        doseAmount: normalizedDose,
        doseUnit: normalizedUnit,
        times: allTimes,
        daysOfWeek: kind === 'ongoing' ? daysOfWeek : null,
        stockCount,
        ...course,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-teal-200 dark:border-teal-800 p-4 space-y-4 shadow-sm">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100">Nieuw medicijn</h3>

      {/* Name + dose */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Naam</label>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bijv. Paracetamol"
            className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
          />
          <MedicationDoseEditor
            doseAmount={doseAmount}
            doseUnit={doseUnit}
            onDoseAmountChange={setDoseAmount}
            onDoseUnitChange={setDoseUnit}
          />
        </div>
      </div>

      <MedicationCourseEditor
        kind={kind}
        courseStartDate={courseStartDate}
        courseDays={courseDays}
        timesCount={mergeMedicationTimes(times, pendingTime).length}
        stockValue={stock}
        onKindChange={setKind}
        onStartDateChange={setCourseStartDate}
        onCourseDaysChange={setCourseDays}
        onSuggestStock={(n) => setStock(String(n))}
      />

      {/* Stock */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Voorraad (optioneel)
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Aantal tabletten"
            className="w-36 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
          />
          {[10, 30, 90].map((n) => (
            <button
              key={n}
              onClick={() => setStock(String((Number(stock) || 0) + n))}
              className="px-3 py-2 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-900/70 rounded-lg transition-colors"
            >
              +{n}
            </button>
          ))}
        </div>
      </div>

      {kind === 'ongoing' && (
        <MedicationDaysEditor daysOfWeek={daysOfWeek} onChange={setDaysOfWeek} />
      )}

      {kind !== 'asNeeded' && (
        <MedicationTimesEditor
          times={times}
          onChange={setTimes}
          onPendingTimeChange={setPendingTime}
        />
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Opslaan
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors text-sm font-semibold"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}

function EditMedicationCard({
  medication,
  onDone,
}: {
  medication: Medication;
  onDone: () => void;
}) {
  const [name, setName] = useState(medication.name);
  const [doseAmount, setDoseAmount] = useState(
    medication.doseAmount !== null ? String(medication.doseAmount) : '',
  );
  const [doseUnit, setDoseUnit] = useState<DoseUnit>(medication.doseUnit ?? 'mg');
  const [times, setTimes] = useState<string[]>([...medication.times]);
  const [daysOfWeek, setDaysOfWeek] = useState<number[] | null>(medication.daysOfWeek);
  const [kind, setKind] = useState<MedicationScheduleKind>(readScheduleKind(medication));
  const [courseStartDate, setCourseStartDate] = useState(
    medication.courseStartDate ?? defaultCourseStartDate(),
  );
  const [courseDays, setCourseDays] = useState(medication.courseDays ?? defaultCourseDays());
  const [pendingTime, setPendingTime] = useState('');
  const [stock, setStock] = useState(medication.stockCount !== null ? String(medication.stockCount) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const allTimes = kind === 'asNeeded' ? [] : mergeMedicationTimes(times, pendingTime);
    if (!name.trim() || (kind !== 'asNeeded' && allTimes.length === 0)) {
      setError(kind === 'asNeeded' ? 'Vul een naam in.' : 'Vul een naam in en minimaal één innametijd.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const parsedStock = Number(stock.trim());
      const stockCount = stock.trim() && Number.isFinite(parsedStock) && parsedStock >= 0
        ? Math.floor(parsedStock) : null;
      const { doseAmount: normalizedDose, doseUnit: normalizedUnit } = normalizeDose({
        doseAmount: doseAmount.trim() || null,
        doseUnit,
      });
      await upsertMedication(medication.id, {
        name: name.trim(),
        doseAmount: normalizedDose,
        doseUnit: normalizedUnit,
        times: allTimes,
        daysOfWeek: kind === 'ongoing' ? daysOfWeek : null,
        stockCount,
        ...courseFieldsForSave(kind, courseStartDate, courseDays),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt.');
    } finally {
      setBusy(false);
    }
  };

  const deleteMed = async () => {
    if (!confirm(`"${formatMedicationLabel(medication)}" verwijderen?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMedication(medication.id);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verwijderen mislukt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-navy-200 dark:border-slate-600 p-4 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold dark:text-white"
        />
        <MedicationDoseEditor
          doseAmount={doseAmount}
          doseUnit={doseUnit}
          onDoseAmountChange={setDoseAmount}
          onDoseUnitChange={setDoseUnit}
        />
      </div>

      <MedicationCourseEditor
        kind={kind}
        courseStartDate={courseStartDate}
        courseDays={courseDays}
        timesCount={mergeMedicationTimes(times, pendingTime).length}
        stockValue={stock}
        onKindChange={setKind}
        onStartDateChange={setCourseStartDate}
        onCourseDaysChange={setCourseDays}
        onSuggestStock={(n) => setStock(String(n))}
      />

      {/* Stock */}
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="number"
          min="0"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          placeholder="Voorraad"
          className="w-28 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
        />
        {[10, 30, 90].map((n) => (
          <button
            key={n}
            onClick={() => setStock(String((Number(stock) || 0) + n))}
            className="px-2.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 hover:bg-teal-100 dark:hover:bg-teal-900/70 rounded-lg transition-colors"
          >
            +{n}
          </button>
        ))}
      </div>

      {kind === 'ongoing' && (
        <MedicationDaysEditor daysOfWeek={daysOfWeek} onChange={setDaysOfWeek} />
      )}

      {kind !== 'asNeeded' && (
        <MedicationTimesEditor
          times={times}
          onChange={setTimes}
          onPendingTimeChange={setPendingTime}
        />
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="flex-1 flex items-center justify-center gap-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Opslaan
        </button>
        <button type="button" onClick={onDone} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors text-sm">
          Annuleren
        </button>
        <button type="button" onClick={deleteMed} disabled={busy} aria-label="Verwijderen" className="disabled:opacity-50 px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function MedicationListCard({
  canEdit,
  medication,
}: {
  canEdit: boolean;
  medication: Medication;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (editing && canEdit) {
    return <EditMedicationCard medication={medication} onDone={() => setEditing(false)} />;
  }

  const daysLeft = medicationDaysLeft(medication);
  const isCourse = isCourseMedication(medication);
  const isAsNeeded = isAsNeededMedication(medication);
  const isLow = !isCourse && !isAsNeeded && daysLeft !== null && daysLeft <= 7;
  const courseLabel = formatCourseScheduleLabel(medication);
  const completed = isCourseCompleted(medication, toLocalDateKey());

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
            {formatMedicationLabel(medication)}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {isAsNeeded ? (
              <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
                Zo nodig
              </span>
            ) : courseLabel ? (
              <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${completed ? 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400' : 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'}`}>
                {completed ? 'Kuur afgerond' : courseLabel}
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-medium rounded-full">
                {formatDaysOfWeekLabel(medication.daysOfWeek)}
              </span>
            )}
            {medication.times.map((t) => (
              <span key={t} className="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[11px] font-mono rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {medication.stockCount !== null && !isCourse && !isAsNeeded && (
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${isLow ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              {daysLeft !== null ? `${daysLeft}d` : `${medication.stockCount}st`}
            </span>
          )}
          {medication.stockCount !== null && (isCourse || isAsNeeded) && (
            <span className="text-xs font-medium px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              {medication.stockCount} pillen
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-100 dark:border-slate-700 pt-3">
          {canEdit ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
            >
              <Pencil className="w-4 h-4" /> Bewerken
            </button>
          ) : (
            <p className="text-xs text-slate-400">Meld je aan om te bewerken</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ManagePage() {
  const { medications, user } = useAuth();
  const canEdit = Boolean(user?.id);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="max-w-lg mx-auto px-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Beheer</h1>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Nieuw
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && canEdit && (
        <div className="mb-4">
          <AddMedicationForm onDone={() => setShowAdd(false)} />
        </div>
      )}
      {showAdd && !canEdit && (
        <p className="mb-4 text-sm text-amber-600 dark:text-amber-400 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
          Meld je aan om medicijnen toe te voegen.
        </p>
      )}

      {/* Medication list */}
      {medications.length === 0 && !showAdd ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <p className="text-lg font-medium">Geen medicijnen</p>
          <p className="text-sm mt-1">Klik op &ldquo;Nieuw&rdquo; om er een toe te voegen</p>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {medications.map((med) => (
            <MedicationListCard key={med.id} canEdit={canEdit} medication={med} />
          ))}
        </div>
      )}
    </div>
  );
}
