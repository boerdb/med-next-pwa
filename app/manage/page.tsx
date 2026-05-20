'use client';

import { useState } from 'react';
import { useInstantData } from '@/hooks/useInstantData';
import { upsertMedication, deleteMedication } from '@/lib/db/transact';
import { uid } from '@/lib/utils';
import {
  Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronUp,
  Loader2, Clock,
} from 'lucide-react';
import type { Medication } from '@/lib/db/types';

function AddMedicationForm({ ownerId, onDone }: { ownerId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [times, setTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('');
  const [stock, setStock] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTime = () => {
    const t = newTime.trim();
    if (!t || times.includes(t)) return;
    setTimes([...times, t].sort());
    setNewTime('');
  };

  const removeTime = (t: string) => setTimes(times.filter((x) => x !== t));

  const submit = async () => {
    if (!name.trim() || times.length === 0) {
      setError('Vul een naam in en voeg minimaal één tijd toe.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const parsedStock = Number(stock.trim());
      const stockCount = stock.trim() && Number.isFinite(parsedStock) && parsedStock >= 0
        ? Math.floor(parsedStock) : null;
      const id = uid();
      await upsertMedication(ownerId, id, { name: name.trim(), times, stockCount });
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

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Naam</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Paracetamol"
          className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
        />
      </div>

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

      {/* Times */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Innaametijden
        </label>
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTime()}
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
            />
          </div>
          <button
            onClick={addTime}
            disabled={!newTime}
            className="px-3 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {times.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-full text-sm font-mono font-medium">
              {t}
              <button onClick={() => removeTime(t)} className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Opslaan
        </button>
        <button
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
  ownerId,
  medication,
  onDone,
}: {
  ownerId: string;
  medication: Medication;
  onDone: () => void;
}) {
  const [name, setName] = useState(medication.name);
  const [times, setTimes] = useState<string[]>([...medication.times]);
  const [newTime, setNewTime] = useState('');
  const [stock, setStock] = useState(medication.stockCount !== null ? String(medication.stockCount) : '');
  const [busy, setBusy] = useState(false);

  const addTime = () => {
    const t = newTime.trim();
    if (!t || times.includes(t)) return;
    setTimes([...times, t].sort());
    setNewTime('');
  };

  const removeTime = (t: string) => setTimes(times.filter((x) => x !== t));

  const save = async () => {
    if (!name.trim() || times.length === 0) return;
    setBusy(true);
    try {
      const parsedStock = Number(stock.trim());
      const stockCount = stock.trim() && Number.isFinite(parsedStock) && parsedStock >= 0
        ? Math.floor(parsedStock) : null;
      await upsertMedication(ownerId, medication.id, { name: name.trim(), times, stockCount });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const deleteMed = async () => {
    if (!confirm(`"${medication.name}" verwijderen?`)) return;
    await deleteMedication(medication.id);
    onDone();
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-navy-200 dark:border-slate-600 p-4 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold dark:text-white"
        />
      </div>

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

      {/* Times */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTime()}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
          />
        </div>
        <button onClick={addTime} disabled={!newTime} className="px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white rounded-xl transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {times.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 rounded-full text-sm font-mono">
            {t}
            <button onClick={() => removeTime(t)} className="hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="flex-1 flex items-center justify-center gap-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Opslaan
        </button>
        <button onClick={onDone} className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors text-sm">
          Annuleren
        </button>
        <button onClick={deleteMed} className="px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function MedicationListCard({ ownerId, medication }: { ownerId?: string; medication: Medication }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (editing && ownerId) {
    return <EditMedicationCard ownerId={ownerId} medication={medication} onDone={() => setEditing(false)} />;
  }

  const daysLeft = medication.stockCount !== null && medication.times.length > 0
    ? Math.floor(medication.stockCount / medication.times.length)
    : null;
  const isLow = daysLeft !== null && daysLeft <= 7;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{medication.name}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {medication.times.map((t) => (
              <span key={t} className="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[11px] font-mono rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {medication.stockCount !== null && (
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${isLow ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              {daysLeft !== null ? `${daysLeft}d` : `${medication.stockCount}st`}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-100 dark:border-slate-700 pt-3">
          {ownerId ? (
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
  const { medications, user } = useInstantData();
  const ownerId = user?.id;
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
      {showAdd && ownerId && (
        <div className="mb-4">
          <AddMedicationForm ownerId={ownerId} onDone={() => setShowAdd(false)} />
        </div>
      )}
      {showAdd && !ownerId && (
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
            <MedicationListCard key={med.id} ownerId={ownerId} medication={med} />
          ))}
        </div>
      )}
    </div>
  );
}
