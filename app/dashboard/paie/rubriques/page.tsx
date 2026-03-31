'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings2, Plus, Loader2, X, Pencil, Trash2, ChevronUp, ChevronDown,
  ToggleLeft, ToggleRight, Receipt,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import {
  getComponents, createComponent, updateComponent, deactivateComponent,
  COMPONENT_TYPE_LABEL, COMPONENT_TYPE_COLOR,
  type PayComponent, type PayComponentCreate,
} from '@/lib/payrollApi';

// ── Helpers ──────────────────────────────────────────────────────────────────

const CALC_TYPES = [
  { value: 'fixed_amount',           label: 'Montant fixe' },
  { value: 'rate_with_cap',          label: 'Taux avec plafond' },
  { value: 'rate_with_floor_and_cap',label: 'Taux avec plancher et plafond' },
  { value: 'lookup_table',           label: 'Barème (table de taux)' },
  { value: 'progressive',            label: 'Barème progressif (IR)' },
  { value: 'formula',                label: 'Formule personnalisée' },
];

function getDefaultParams(calcType: string): Record<string, unknown> {
  switch (calcType) {
    case 'fixed_amount':            return { amount: 0 };
    case 'rate_with_cap':           return { rate: 0.0, cap: 0, base: 'brut' };
    case 'rate_with_floor_and_cap': return { rate: 0.0, floor: 0, cap: 0, base: 'brut' };
    case 'lookup_table':            return { table_code: '', base: 'brut' };
    case 'progressive':             return { base: 'taxable' };
    case 'formula':                 return { formula: '' };
    default:                        return {};
  }
}

function CalcParamsFields({
  calcType, value, onChange,
}: {
  calcType: string;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const num = (k: string, def = 0) => (value[k] as number) ?? def;
  const str = (k: string, def = '') => (value[k] as string) ?? def;

  const baseSelect = (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Base de calcul</label>
      <select
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={str('base', 'brut')}
        onChange={e => set('base', e.target.value)}
      >
        <option value="brut">Salaire brut</option>
        <option value="taxable">Revenu imposable</option>
        <option value="base_salary">Salaire de base</option>
      </select>
    </div>
  );

  if (calcType === 'fixed_amount') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Montant fixe (XOF) — laisser 0 si variable</label>
        <input
          type="number" min={0} step={1}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={num('amount')}
          onChange={e => set('amount', parseFloat(e.target.value) || 0)}
        />
      </div>
    );
  }

  if (calcType === 'rate_with_cap') {
    return (
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Taux (%)</label>
          <input type="number" min={0} max={100} step={0.001}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={+(num('rate') * 100).toFixed(4)}
            onChange={e => set('rate', parseFloat(e.target.value) / 100 || 0)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Plafond (XOF)</label>
          <input type="number" min={0} step={1}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={num('cap')}
            onChange={e => set('cap', parseFloat(e.target.value) || 0)}
          />
        </div>
        {baseSelect}
      </div>
    );
  }

  if (calcType === 'rate_with_floor_and_cap') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Taux (%)</label>
          <input type="number" min={0} max={100} step={0.001}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={+(num('rate') * 100).toFixed(4)}
            onChange={e => set('rate', parseFloat(e.target.value) / 100 || 0)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Plancher (XOF)</label>
          <input type="number" min={0} step={1}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={num('floor')}
            onChange={e => set('floor', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Plafond (XOF)</label>
          <input type="number" min={0} step={1}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={num('cap')}
            onChange={e => set('cap', parseFloat(e.target.value) || 0)}
          />
        </div>
        {baseSelect}
      </div>
    );
  }

  if (calcType === 'lookup_table') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Code de la table</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={str('table_code')}
            onChange={e => set('table_code', e.target.value.toUpperCase())}
            placeholder="Ex : IPRES_TABLE"
          />
        </div>
        {baseSelect}
      </div>
    );
  }

  if (calcType === 'progressive') {
    return (
      <div>
        {baseSelect}
        <p className="text-xs text-gray-400 mt-2">Les tranches progressives sont configurées séparément dans les paramètres fiscaux.</p>
      </div>
    );
  }

  if (calcType === 'formula') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Expression de calcul</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={str('formula')}
          onChange={e => set('formula', e.target.value)}
          placeholder="Ex : base_salary * 0.3 / 26"
        />
        <p className="text-xs text-gray-400 mt-1">Variables disponibles : base_salary, brut_total, days_worked</p>
      </div>
    );
  }

  return null;
}

const COMPONENT_TYPES = [
  { value: 'earning', label: 'Gain' },
  { value: 'deduction', label: 'Retenue salarié' },
  { value: 'employer_contribution', label: 'Charge patronale' },
  { value: 'info', label: 'Information' },
  { value: 'net_adjustment', label: 'Ajustement net' },
];

const DEFAULT_FORM: PayComponentCreate = {
  code: '',
  name: '',
  component_type: 'earning',
  calc_type: 'fixed_amount',
  calc_params: { amount: 0 },
  is_taxable: false,
  is_subject_to_cotisations: false,
  is_active: true,
  order_index: 0,
};

// ── Modal ─────────────────────────────────────────────────────────────────────

function ComponentModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: PayComponent;
  onClose: () => void;
  onSaved: (c: PayComponent) => void;
}) {
  const [form, setForm] = useState<PayComponentCreate>(
    initial
      ? {
          code: initial.code,
          name: initial.name,
          component_type: initial.component_type,
          calc_type: initial.calc_type,
          calc_params: initial.calc_params,
          is_taxable: initial.is_taxable,
          is_subject_to_cotisations: initial.is_subject_to_cotisations,
          is_active: initial.is_active,
          order_index: initial.order_index,
        }
      : DEFAULT_FORM,
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof PayComponentCreate, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }));

  // Quand le type de calcul change, réinitialiser calc_params aux valeurs par défaut
  const handleCalcTypeChange = (newType: string) => {
    setForm(f => ({ ...f, calc_type: newType, calc_params: getDefaultParams(newType) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      const result = initial
        ? await updateComponent(initial.id, payload)
        : await createComponent(payload);
      toast.success(initial ? 'Rubrique mise à jour' : 'Rubrique créée');
      onSaved(result);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-800 text-lg">
            {initial ? 'Modifier la rubrique' : 'Nouvelle rubrique'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="Ex: SALBASE"
                required
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordre affiché</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.order_index}
                onChange={e => set('order_index', parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ex: Salaire de base"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.component_type}
                onChange={e => set('component_type', e.target.value as PayComponent['component_type'])}
              >
                {COMPONENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode de calcul</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.calc_type}
                onChange={e => handleCalcTypeChange(e.target.value)}
              >
                {CALC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paramètres de calcul</label>
            <div className="bg-gray-50 rounded-lg p-3 border">
              <CalcParamsFields
                calcType={form.calc_type}
                value={form.calc_params as Record<string, unknown>}
                onChange={v => set('calc_params', v)}
              />
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                className="w-4 h-4 accent-blue-600"
                checked={form.is_taxable}
                onChange={e => set('is_taxable', e.target.checked)}
              />
              Imposable (IR)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                className="w-4 h-4 accent-blue-600"
                checked={form.is_subject_to_cotisations}
                onChange={e => set('is_subject_to_cotisations', e.target.checked)}
              />
              Soumis cotisations
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                className="w-4 h-4 accent-blue-600"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
              />
              Actif
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {initial ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function RubriquesPage() {
  const [components, setComponents] = useState<PayComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PayComponent | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getComponents(showInactive);
      setComponents(data);
    } catch {
      toast.error('Erreur lors du chargement des rubriques');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setEditing(undefined); setModalOpen(true); };
  const openEdit = (c: PayComponent) => { setEditing(c); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleSaved = (c: PayComponent) => {
    setComponents(prev => {
      const idx = prev.findIndex(x => x.id === c.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = c;
        return next;
      }
      return [...prev, c];
    });
    setModalOpen(false);
  };

  const handleDeactivate = async (c: PayComponent) => {
    if (!confirm(`Désactiver « ${c.name} » ?`)) return;
    setDeactivating(c.id);
    try {
      await deactivateComponent(c.id);
      toast.success('Rubrique désactivée');
      setComponents(prev => prev.map(x => x.id === c.id ? { ...x, is_active: false } : x));
    } catch {
      toast.error('Erreur désactivation');
    } finally {
      setDeactivating(null);
    }
  };

  const visible = showInactive ? components : components.filter(c => c.is_active);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Paie" />

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Fil d'Ariane */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <Receipt className="w-4 h-4" />
          <span>Paie</span>
          <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
          <span className="text-gray-700 font-medium">Rubriques de paie</span>
        </div>

        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-blue-600" />
              Rubriques de paie
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {visible.length} rubrique{visible.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
              <input
                type="checkbox"
                className="w-4 h-4 accent-blue-600"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
              />
              Afficher inactives
            </label>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Nouvelle rubrique
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Chargement…
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Settings2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Aucune rubrique{showInactive ? '' : ' active'}</p>
            <p className="text-sm mt-1">Créez votre première rubrique de paie</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Libellé</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Calcul</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">IR</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Cot.</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.map((c, i) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-gray-50 transition ${!c.is_active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-400">{c.order_index || i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-gray-800">{c.code}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COMPONENT_TYPE_COLOR[c.component_type]}`}>
                        {COMPONENT_TYPE_LABEL[c.component_type] ?? c.component_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {CALC_TYPES.find(t => t.value === c.calc_type)?.label ?? c.calc_type}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.is_taxable
                        ? <span className="text-green-600">✓</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.is_subject_to_cotisations
                        ? <span className="text-green-600">✓</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          <ToggleRight className="w-3 h-3" />Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          <ToggleLeft className="w-3 h-3" />Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {c.is_active && (
                          <button
                            onClick={() => handleDeactivate(c)}
                            disabled={deactivating === c.id}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                            title="Désactiver"
                          >
                            {deactivating === c.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modalOpen && (
        <ComponentModal
          initial={editing}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
