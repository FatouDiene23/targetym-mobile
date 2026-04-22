 "use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Settings, Upload, Download, Plus, Pencil, Trash2, Save,
  CheckCircle, XCircle, AlertTriangle, ArrowLeft, FileSpreadsheet,
  Lock, Unlock, Calendar, Tag, List, RefreshCw, ChevronDown,
} from "lucide-react";
import { fetchWithAuth, API_URL } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nContext";
import { useBudgetYear } from "@/hooks/useBudgetYear";
import CustomSelect from "@/components/CustomSelect";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface BudgetConfig {
  id: number;
  budget_year: number;
  currency: string;
  is_locked: boolean;
  projection_rates: Record<string, number>;
}

interface Category {
  id: number;
  code: string;
  label: string;
  parent_code: string | null;
  level: number;
  order_index: number;
  is_active: boolean;
}

interface BudgetLine {
  id?: number;
  month: number;
  category_code: string;
  amount_budget: number;
  amount_actual?: number;
  source: string;
}

interface ImportResult {
  status: string;
  rows_imported: number;
  rows_errors: number;
  errors: string[];
}

interface ImportHistory {
  id: number;
  filename: string;
  imported_at: string;
  status: string;
  rows_imported: number;
  rows_errors: number;
  data_type: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const CURRENCIES = ["XOF", "XAF", "EUR", "USD", "MAD", "TND", "GNF", "MGA"];

function fmt(val: number): string {
  if (!val) return "";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(val);
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function ImportModal({ year, onClose, onSuccess }: { year: number; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dataType, setDataType] = useState<"budget" | "actuals">("budget");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetchWithAuth(`${API_URL}/api/budget-rh/import?year=${year}&data_type=${dataType}`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setResult(data);
    setImporting(false);
    if (data.status === "success") {
      setTimeout(onSuccess, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-600" />
            Importer un fichier Excel
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Type de données</label>
            <div className="flex gap-3">
              {([["budget", "Budget"], ["actuals", "Réalisé"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setDataType(val)}
                  className={`flex-1 py-2 px-4 rounded-xl border text-sm font-medium transition-all ${
                    dataType === val
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* File */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              file ? "border-primary-400 bg-primary-50" : "border-gray-300 hover:border-primary-400 hover:bg-primary-50"
            }`}
          >
            <FileSpreadsheet className={`w-10 h-10 mx-auto mb-2 ${file ? "text-primary-500" : "text-gray-300"}`} />
            {file ? (
              <>
                <p className="text-sm font-semibold text-primary-700">{file.name}</p>
                <p className="text-xs text-primary-500">{(file.size / 1024).toFixed(0)} Ko</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-600">Cliquez pour choisir un fichier</p>
                <p className="text-xs text-gray-400 mt-1">Fichiers .xlsx uniquement</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Template download */}
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Besoin du modèle Excel ?</p>
              <p className="text-xs text-gray-500">Téléchargez le template pré-rempli avec vos catégories</p>
            </div>
            <a
              href={`${API_URL}/api/budget-rh/template?year=${year}`}
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium"
              download
            >
              <Download className="w-4 h-4" />
              Template
            </a>
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 ${
              result.status === "success" ? "bg-emerald-50 border border-emerald-200"
              : result.status === "partial" ? "bg-amber-50 border border-amber-200"
              : "bg-red-50 border border-red-200"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {result.status === "success"
                  ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                  : result.status === "partial"
                  ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                  : <XCircle className="w-4 h-4 text-red-600" />}
                <span className="font-semibold text-sm">
                  {result.rows_imported} lignes importées
                  {result.rows_errors > 0 && `, ${result.rows_errors} erreurs`}
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="text-xs text-red-600 space-y-0.5 mt-2">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                  {result.errors.length > 5 && <li>...et {result.errors.length - 5} autres</li>}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl border transition-colors">
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-5 py-2 text-sm bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY MODAL
// ─────────────────────────────────────────────────────────────────────────────

function CategoryModal({
  existing,
  categories,
  onClose,
  onSave,
}: {
  existing?: Category;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    code: existing?.code ?? "",
    label: existing?.label ?? "",
    parent_code: existing?.parent_code ?? "",
    level: existing?.level ?? 3,
    order_index: existing?.order_index ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.code || !form.label) { setError("Code et libellé requis"); return; }
    setSaving(true);
    const url = existing ? `${API_URL}/api/budget-rh/categories/${existing.id}` : `${API_URL}/api/budget-rh/categories`;
    const res = await fetchWithAuth(url, {
      method: existing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, parent_code: form.parent_code || null }),
    });
    setSaving(false);
    if (res.ok) { onSave(); onClose(); }
    else { const d = await res.json(); setError(d.detail || "Erreur lors de la sauvegarde"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">{existing ? "Modifier" : "Nouvelle"} catégorie</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Code NRG *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400" placeholder="Ex: NRG111" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Niveau</label>
              <CustomSelect value={String(form.level)} onChange={(v) => setForm({ ...form, level: +v })}
                options={[
                  { value: '1', label: '1 — Section' },
                  { value: '2', label: '2 — Groupe' },
                  { value: '3', label: '3 — Rubrique' },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Libellé *</label>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400" placeholder="Salaire de base..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Catégorie parente</label>
            <CustomSelect value={form.parent_code} onChange={(v) => setForm({ ...form, parent_code: v })}
              options={[
                { value: '', label: '— Aucune (niveau racine) —' },
                ...categories.filter((c) => c.id !== existing?.id && c.level < form.level).map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` })),
              ]}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Ordre d&apos;affichage</label>
            <input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: +e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl border">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET ENTRY GRID
// ─────────────────────────────────────────────────────────────────────────────

function BudgetEntryGrid({
  year,
  config,
  categories,
  lines,
  onSaved,
}: {
  year: number;
  config: BudgetConfig | null;
  categories: Category[];
  lines: BudgetLine[];
  onSaved: () => void;
}) {
  // Build a nested map: category_code -> month -> amount
  const [gridData, setGridData] = useState<Record<string, Record<number, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize from lines
  useEffect(() => {
    const initial: Record<string, Record<number, string>> = {};
    lines.forEach((line) => {
      if (!initial[line.category_code]) initial[line.category_code] = {};
      initial[line.category_code][line.month] = line.amount_budget > 0 ? String(line.amount_budget) : "";
    });
    setGridData(initial);
    setDirty(false);
  }, [lines]);

  const handleChange = (code: string, month: number, val: string) => {
    setGridData((prev) => ({ ...prev, [code]: { ...(prev[code] ?? {}), [month]: val } }));
    setDirty(true);
  };

  const isLocked = config?.is_locked ?? false;

  const handleSave = async () => {
    setSaving(true);
    const batch: Array<{ month: number; category_code: string; amount_budget: number }> = [];
    Object.entries(gridData).forEach(([code, months]) => {
      Object.entries(months).forEach(([m, val]) => {
        const amount = parseFloat(val.replace(/\s/g, "").replace(",", "."));
        if (!isNaN(amount)) {
          batch.push({ month: +m, category_code: code, amount_budget: amount });
        }
      });
    });

    const res = await fetchWithAuth(`${API_URL}/api/budget-rh/lines/batch`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, lines: batch }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setDirty(false);
      setTimeout(() => { setSaved(false); onSaved(); }, 2000);
    }
  };

  // Only level-3 (leaf) categories are editable; show level-1 and 2 as headers
  const leafCats = categories.filter((c) => c.level === 3 && c.is_active);
  const sectionCats = categories.filter((c) => c.level === 1 && c.is_active);
  const groupCats = categories.filter((c) => c.level === 2 && c.is_active);

  // Build ordered list with section / group separators
  const ordered: Array<{ type: "section" | "group" | "leaf"; cat: Category }> = [];
  sectionCats.sort((a, b) => a.order_index - b.order_index).forEach((section) => {
    ordered.push({ type: "section", cat: section });
    const groups = groupCats.filter((g) => g.parent_code === section.code).sort((a, b) => a.order_index - b.order_index);
    groups.forEach((group) => {
      ordered.push({ type: "group", cat: group });
      leafCats.filter((l) => l.parent_code === group.code).sort((a, b) => a.order_index - b.order_index).forEach((leaf) => {
        ordered.push({ type: "leaf", cat: leaf });
      });
    });
    // Leaves directly under section
    leafCats.filter((l) => l.parent_code === section.code).sort((a, b) => a.order_index - b.order_index).forEach((leaf) => {
      ordered.push({ type: "leaf", cat: leaf });
    });
  });
  // Orphan leaves
  leafCats.filter((l) => !l.parent_code).forEach((leaf) => ordered.push({ type: "leaf", cat: leaf }));

  const allZero = lines.length === 0 || lines.every((l) => !l.amount_budget || l.amount_budget === 0);

  return (
    <div className="space-y-4">
      {/* Info banner — payroll actuals are on pilotage, not here */}
      {allZero && !isLocked && (
        <div className="flex items-start gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
          <div className="w-5 h-5 text-primary-600 shrink-0 mt-0.5">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-primary-800">Aucun budget saisi pour {year}</p>
            <p className="text-xs text-primary-600 mt-0.5">
              Les montants affichés ici sont les <strong>prévisions budgétaires</strong> à saisir manuellement. 
              Le réalisé issu de la paie est visible sur la
              <a href="/dashboard/budget-rh" className="underline font-medium ml-1">page Pilotage →</a>
            </p>
          </div>
        </div>
      )}

    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-700">Saisie manuelle — {year}</h3>
          {isLocked && (
            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" /> Budget verrouillé
            </span>
          )}
          {dirty && !isLocked && (
            <span className="text-xs text-primary-600 font-medium">● Modifications non sauvegardées</span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> Sauvegardé
            </span>
          )}
        </div>
        {!isLocked && (
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-2 text-sm bg-primary-500 text-white px-4 py-1.5 rounded-xl hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sauvegarder
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="text-left py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide w-64 sticky left-0 bg-gray-50">
                Rubrique
              </th>
              {MONTHS.map((m) => (
                <th key={m} className="text-center py-2.5 px-1 font-semibold text-gray-500 uppercase tracking-wide">
                  {m}
                </th>
              ))}
              <th className="text-right py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide">Total</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(({ type, cat }) => {
              const isSection = type === "section";
              const isGroup = type === "group";
              const isLeaf = type === "leaf";

              if (isSection) {
                return (
                  <tr key={cat.code} className="bg-primary-500">
                    <td className="py-2 px-4 font-bold text-white sticky left-0 bg-primary-500 uppercase text-xs tracking-wider" colSpan={14}>
                      {cat.label}
                    </td>
                  </tr>
                );
              }

              if (isGroup) {
                return (
                  <tr key={cat.code} className="bg-primary-50 border-b border-primary-100">
                    <td className="py-2 px-4 font-semibold text-primary-800 sticky left-0 bg-primary-50 pl-6" colSpan={14}>
                      {cat.label}
                    </td>
                  </tr>
                );
              }

              // Leaf — editable
              const monthTotal = Array.from({ length: 12 }, (_, i) => {
                const val = gridData[cat.code]?.[i + 1] ?? "";
                return parseFloat(val.replace(/\s/g, "").replace(",", ".")) || 0;
              }).reduce((a, b) => a + b, 0);

              return (
                <tr key={cat.code} className="border-b border-gray-50 hover:bg-gray-50 group">
                  <td className="py-1.5 px-4 text-gray-700 sticky left-0 bg-white group-hover:bg-gray-50 pl-10">
                    {cat.label}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <td key={m} className="px-1 py-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        disabled={isLocked}
                        value={gridData[cat.code]?.[m] ?? ""}
                        onChange={(e) => handleChange(cat.code, m, e.target.value)}
                        className="w-20 text-right px-1.5 py-1 border border-transparent rounded focus:border-primary-400 focus:bg-white bg-transparent text-gray-700 tabular-nums disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-200 transition-colors"
                        placeholder="0"
                      />
                    </td>
                  ))}
                  <td className="text-right py-1.5 px-4 font-semibold text-gray-800 tabular-nums">
                    {monthTotal > 0 ? fmt(monthTotal) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BudgetRHSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const { year, setYear, currentYear } = useBudgetYear();
  const [activeTab, setActiveTab] = useState<"entry" | "import" | "categories" | "config">(
    (searchParams.get("tab") as any) ?? "entry"
  );
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState<BudgetConfig | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // Ensure any new default categories (e.g. Déjeuner) are present for this tenant
    await fetchWithAuth(`${API_URL}/api/budget-rh/categories/sync-defaults`, { method: "POST" }).catch(() => {});
    const [cfgRes, catRes, linesRes, importRes] = await Promise.allSettled([
      fetchWithAuth(`${API_URL}/api/budget-rh/config?year=${year}`),
      fetchWithAuth(`${API_URL}/api/budget-rh/categories`),
      fetchWithAuth(`${API_URL}/api/budget-rh/lines?year=${year}`),
      fetchWithAuth(`${API_URL}/api/budget-rh/imports`),
    ]);

    if (cfgRes.status === "fulfilled" && cfgRes.value.ok) setConfig(await cfgRes.value.json());
    if (catRes.status === "fulfilled" && catRes.value.ok) setCategories(await catRes.value.json());
    if (linesRes.status === "fulfilled" && linesRes.value.ok) setLines(await linesRes.value.json());
    if (importRes.status === "fulfilled" && importRes.value.ok) setImportHistory(await importRes.value.json());
    setLoading(false);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const toggleLock = async () => {
    if (!config) return;
    const res = await fetchWithAuth(`${API_URL}/api/budget-rh/config?year=${year}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_locked: !config.is_locked }),
    });
    if (res.ok) setConfig(await res.json());
  };

  const updateCurrency = async (currency: string) => {
    const res = await fetchWithAuth(`${API_URL}/api/budget-rh/config?year=${year}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency }),
    });
    if (res.ok) setConfig(await res.json());
  };

  const deleteCategory = async (id: number) => {
    if (!confirm("Désactiver cette catégorie ?")) return;
    await fetchWithAuth(`${API_URL}/api/budget-rh/categories/${id}`, { method: "DELETE" });
    load();
  };

  const seedCategories = async () => {
    setSeeding(true);
    const res = await fetchWithAuth(`${API_URL}/api/budget-rh/categories/seed-default`, { method: "POST" });
    setSeeding(false);
    if (res.ok) { setSeedMsg("Nomenclature NRG importée avec succès !"); load(); }
    else if (res.status === 409) setSeedMsg("Les catégories existent déjà pour cette entreprise.");
    else setSeedMsg("Erreur lors de l'import.");
    setTimeout(() => setSeedMsg(""), 4000);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      success: "bg-emerald-100 text-emerald-700",
      partial: "bg-amber-100 text-amber-700",
      error: "bg-red-100 text-red-700",
      pending: "bg-gray-100 text-gray-600",
    };
    return map[status] ?? "bg-gray-100 text-gray-600";
  };

  // ───────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/dashboard/budget-rh")} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-gray-600" />
            Paramètres — Budget RH
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Saisie, import, catégories et configuration</p>
        </div>
        <div className="ml-auto flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <CustomSelect value={String(year)} onChange={(v) => setYear(+v)}
            options={[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => ({ value: String(y), label: String(y) }))}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {([
          ["entry", "Saisie budget", Settings],
          ["import", "Import Excel", Upload],
          ["categories", "Catégories NRG", Tag],
          ["config", "Configuration", List],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: ENTRY ═══ */}
      {activeTab === "entry" && (
        <BudgetEntryGrid year={year} config={config} categories={categories} lines={lines} onSaved={load} />
      )}

      {/* ═══ TAB: IMPORT ═══ */}
      {activeTab === "import" && (
        <div className="space-y-6">
          {/* Action buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                  <Upload className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">Importer un fichier Excel</h3>
                  <p className="text-gray-500 text-xs mb-3">Importez vos données budget ou réalisé depuis un fichier .xlsx</p>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="text-sm bg-primary-500 text-white px-4 py-2 rounded-xl hover:bg-primary-600 transition-colors"
                  >
                    Choisir un fichier
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Download className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">Télécharger le template</h3>
                  <p className="text-gray-500 text-xs mb-3">Template Excel pré-formaté avec vos catégories NRG</p>
                  <a
                    href={`${API_URL}/api/budget-rh/template?year=${year}`}
                    download
                    className="inline-block text-sm bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors"
                  >
                    Télécharger (.xlsx)
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Import history */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b">
              <h3 className="text-sm font-semibold text-gray-700">Historique des imports</h3>
            </div>
            {importHistory.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun import pour le moment</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Fichier</th>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-center py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Lignes</th>
                  </tr>
                </thead>
                <tbody>
                  {importHistory.map((imp) => (
                    <tr key={imp.id} className="border-b hover:bg-gray-50">
                      <td className="py-2.5 px-4 text-gray-700">{imp.filename}</td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">
                        {new Date(imp.imported_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs capitalize">{imp.data_type}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge(imp.status)}`}>
                          {imp.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-600 text-xs">
                        {imp.rows_imported} importées{imp.rows_errors > 0 && `, ${imp.rows_errors} erreurs`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: CATEGORIES ═══ */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => { setEditingCategory(undefined); setShowCategoryModal(true); }}
              className="flex items-center gap-2 text-sm bg-primary-500 text-white px-4 py-2 rounded-xl hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle catégorie
            </button>
            {categories.length === 0 && (
              <button
                onClick={seedCategories}
                disabled={seeding}
                className="flex items-center gap-2 text-sm border border-primary-200 text-primary-700 px-4 py-2 rounded-xl hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                {seeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Importer nomenclature NRG standard
              </button>
            )}
            {seedMsg && (
              <span className={`text-sm font-medium ${seedMsg.includes("succès") ? "text-emerald-600" : seedMsg.includes("déjà") ? "text-amber-600" : "text-red-600"}`}>
                {seedMsg}
              </span>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Code</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Libellé</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Niveau</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Parent</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="py-3 px-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : categories.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">
                    Aucune catégorie. Importez la nomenclature NRG ou créez manuellement.
                  </td></tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className={`border-b transition-colors ${!cat.is_active ? "opacity-50" : ""} ${
                      cat.level === 1 ? "bg-primary-50 hover:bg-primary-100" : cat.level === 2 ? "bg-gray-50 hover:bg-gray-100" : "hover:bg-gray-50"
                    }`}>
                      <td className="py-2.5 px-4 font-mono text-primary-600 font-medium"
                        style={{ paddingLeft: `${(cat.level - 1) * 20 + 16}px` }}>
                        {cat.code}
                      </td>
                      <td className={`py-2.5 px-4 ${cat.level === 1 ? "font-bold text-gray-800" : cat.level === 2 ? "font-semibold text-gray-700" : "text-gray-600"}`}>
                        {cat.label}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          cat.level === 1 ? "bg-primary-100 text-primary-700" : cat.level === 2 ? "bg-secondary-100 text-secondary-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {cat.level === 1 ? "Section" : cat.level === 2 ? "Groupe" : "Rubrique"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs font-mono">{cat.parent_code ?? "—"}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {cat.is_active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }}
                            className="text-gray-400 hover:text-primary-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteCategory(cat.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: CONFIG ═══ */}
      {activeTab === "config" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Configuration — {year}</h3>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Devise</label>
              <CustomSelect
                value={config?.currency ?? "XOF"}
                onChange={(v) => updateCurrency(v)}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border transition-colors"
              style={{ borderColor: config?.is_locked ? "#F59E0B" : "#E5E7EB", background: config?.is_locked ? "#FFFBEB" : "white" }}>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {config?.is_locked ? "Budget verrouillé" : "Budget modifiable"}
                </p>
                <p className="text-xs text-gray-500">
                  {config?.is_locked
                    ? "Les saisies sont désactivées pour cette année"
                    : "La saisie et l'import sont autorisés"}
                </p>
              </div>
              <button
                onClick={toggleLock}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  config?.is_locked
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                }`}
              >
                {config?.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                {config?.is_locked ? "Déverrouiller" : "Verrouiller"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Export complet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Exportez l&apos;intégralité du budget {year} (budget vs réalisé) en Excel.
            </p>
            <a
              href={`${API_URL}/api/budget-rh/export?year=${year}`}
              download
              className="inline-flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter Budget {year}
            </a>
          </div>
        </div>
      )}

      {/* Modals */}
      {showImportModal && (
        <ImportModal
          year={year}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); load(); }}
        />
      )}
      {showCategoryModal && (
        <CategoryModal
          existing={editingCategory}
          categories={categories}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(undefined); }}
          onSave={load}
        />
      )}
    </div>
  );
}
