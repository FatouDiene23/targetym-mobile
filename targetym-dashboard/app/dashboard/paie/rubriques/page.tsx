'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings2, Plus, Loader2, X, Pencil, Trash2, ChevronUp, ChevronDown,
  ToggleLeft, ToggleRight, Receipt,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';
import {
  getComponents, createComponent, updateComponent, deactivateComponent, seedLegalComponents,
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
  { value: 'manual_variable',        label: 'Variable manuelle (saisie par période)' },
];

function getDefaultParams(calcType: string): Record<string, unknown> {
  switch (calcType) {
    case 'fixed_amount':            return { amount: 0 };
    case 'rate_with_cap':           return { rate: 0.0, cap: 0, base: 'brut' };
    case 'rate_with_floor_and_cap': return { rate: 0.0, floor: 0, cap: 0, base: 'brut' };
    case 'lookup_table':            return { table_code: '', base: 'brut' };
    case 'progressive':             return { base: 'taxable' };
    case 'formula':                 return { formula: '' };
    case 'manual_variable':         return {};
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
  const { t } = useI18n();
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const num = (k: string, def = 0) => (value[k] as number) ?? def;
  const str = (k: string, def = '') => (value[k] as string) ?? def;

  const baseSelect = (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{t.payroll.components.calcBase}</label>
      <select
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        value={str('base', 'brut')}
        onChange={e => set('base', e.target.value)}
      >
        <option value="brut">{t.payroll.components.grossSalary}</option>
        <option value="taxable">{t.payroll.components.taxableIncome}</option>
        <option value="base_salary">{t.payroll.components.baseSalary}</option>
      </select>
    </div>
  );

  if (calcType === 'fixed_amount') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{t.payroll.components.fixedAmountLabel}</label>
        <input
          type="number" min={0} step={1}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <label className="block text-xs font-medium text-gray-500 mb-1">{t.payroll.components.ratePercent}</label>
          <input type="number" min={0} max={100} step={0.001}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={+(num('rate') * 100).toFixed(4)}
            onChange={e => set('rate', parseFloat(e.target.value) / 100 || 0)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t.payroll.components.capXOF}</label>
          <input type="number" min={0} step={1}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <label className="block text-xs font-medium text-gray-500 mb-1">{t.payroll.components.ratePercent}</label>
          <input type="number" min={0} max={100} step={0.001}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={+(num('rate') * 100).toFixed(4)}
            onChange={e => set('rate', parseFloat(e.target.value) / 100 || 0)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t.payroll.components.floorXOF}</label>
          <input type="number" min={0} step={1}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={num('floor')}
            onChange={e => set('floor', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t.payroll.components.capXOF}</label>
          <input type="number" min={0} step={1}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <label className="block text-xs font-medium text-gray-500 mb-1">{t.payroll.components.tableCode}</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
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
        <p className="text-xs text-gray-400 mt-2">{t.payroll.components.progressiveNote}</p>
      </div>
    );
  }

  if (calcType === 'formula') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">{t.payroll.components.formulaExpression}</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
          value={str('formula')}
          onChange={e => set('formula', e.target.value)}
          placeholder="Ex : base_salary * 0.3 / 26"
        />
        <p className="text-xs text-gray-400 mt-1">{t.payroll.components.formulaVarsNote}</p>
      </div>
    );
  }

  return null;
}

const COMPONENT_TYPES = [
  { value: 'earning', label: 'Gain' },
  { value: 'deduction_employee', label: 'Retenue salarié' },
  { value: 'deduction_employer', label: 'Charge patronale (retenue)' },
  { value: 'employer_contribution', label: 'Charge patronale' },
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
  const { t } = useI18n();
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
      toast.success(initial ? t.payroll.components.componentUpdated : t.payroll.components.componentCreated);
      onSaved(result);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.common.error);
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
            {initial ? t.payroll.components.editComponent : t.payroll.components.newComponent}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.components.code} *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="Ex: SALBASE"
                required
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.components.displayOrder}</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.order_index}
                onChange={e => set('order_index', parseInt(e.target.value) || 0)}
                min={0}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.components.label} *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ex: Salaire de base"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.components.type}</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.component_type}
                onChange={e => set('component_type', e.target.value as PayComponent['component_type'])}
              >
                {[
                  { value: 'earning', label: t.payroll.components.componentTypes.earning },
                  { value: 'deduction_employee', label: t.payroll.components.componentTypes.deductionEmployee },
                  { value: 'deduction_employer', label: t.payroll.components.componentTypes.deductionEmployer },
                  { value: 'employer_contribution', label: t.payroll.components.componentTypes.employerContribution },
                  { value: 'net_adjustment', label: t.payroll.components.componentTypes.netAdjustment },
                ].map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.components.calcMode}</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.calc_type}
                onChange={e => handleCalcTypeChange(e.target.value)}
              >
                {[
                  { value: 'fixed_amount', label: t.payroll.components.calcTypes.fixedAmount },
                  { value: 'rate_with_cap', label: t.payroll.components.calcTypes.rateWithCap },
                  { value: 'rate_with_floor_and_cap', label: t.payroll.components.calcTypes.rateWithFloorAndCap },
                  { value: 'lookup_table', label: t.payroll.components.calcTypes.lookupTable },
                  { value: 'progressive', label: t.payroll.components.calcTypes.progressive },
                  { value: 'formula', label: t.payroll.components.calcTypes.formula },
                  { value: 'manual_variable', label: t.payroll.components.calcTypes.manualVariable },
                ].map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.components.calcParams}</label>
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
                className="w-4 h-4 accent-primary-600"
                checked={form.is_taxable}
                onChange={e => set('is_taxable', e.target.checked)}
              />
              {t.payroll.components.taxableIR}
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary-600"
                checked={form.is_subject_to_cotisations}
                onChange={e => set('is_subject_to_cotisations', e.target.checked)}
              />
              {t.payroll.components.subjectToContributions}
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary-600"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
              />
              {t.payroll.components.active}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {initial ? t.common.save : t.common.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function RubriquesPage() {
  const { t } = useI18n();
  const [components, setComponents] = useState<PayComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PayComponent | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getComponents(showInactive);
      setComponents(data);
    } catch {
      toast.error(t.payroll.components.loadingError);
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setEditing(undefined); setModalOpen(true); };
  const openEdit = (c: PayComponent) => { setEditing(c); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const handleSeedLegal = async () => {
    if (!confirm(t.payroll.components.seedConfirm)) return;
    setSeeding(true);
    try {
      const result = await seedLegalComponents();
      toast.success(t.payroll.components.seedSuccess.replace('{count}', String(result.count)));
      setComponents(result.components);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSeeding(false);
    }
  };

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
    if (!confirm(t.payroll.components.deactivateConfirm.replace('{name}', c.name))) return;
    setDeactivating(c.id);
    try {
      await deactivateComponent(c.id);
      toast.success(t.payroll.components.deactivated);
      setComponents(prev => prev.map(x => x.id === c.id ? { ...x, is_active: false } : x));
    } catch {
      toast.error(t.payroll.components.deactivateError);
    } finally {
      setDeactivating(null);
    }
  };

  const visible = showInactive ? components : components.filter(c => c.is_active);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title={t.payroll.title} />

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Fil d'Ariane */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <Receipt className="w-4 h-4" />
          <span>{t.payroll.components.breadcrumbPayroll}</span>
          <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
          <span className="text-gray-700 font-medium">{t.payroll.components.breadcrumbComponents}</span>
        </div>

        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-primary-600" />
              {t.payroll.components.title}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {visible.length > 1
                ? t.payroll.components.componentCountPlural.replace('{count}', String(visible.length))
                : t.payroll.components.componentCount.replace('{count}', String(visible.length))}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary-600"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
              />
              {t.payroll.components.showInactive}
            </label>
            <button
              onClick={handleSeedLegal}
              disabled={seeding}
              className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
              {t.payroll.components.legalComponentsSN}
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-primary-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-700 transition"
            >
              <Plus className="w-4 h-4" />
              {t.payroll.components.newComponent}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            {t.payroll.components.loading}
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Settings2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">{showInactive ? t.payroll.components.noComponent : t.payroll.components.noActiveComponent}</p>
            <p className="text-sm mt-1">{t.payroll.components.createFirstComponent}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-12">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t.payroll.components.code}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t.payroll.components.label}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t.payroll.components.type}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">{t.payroll.components.calcMode}</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">IR</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Cot.</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">{t.payroll.components.status}</th>
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
                          <ToggleRight className="w-3 h-3" />{t.payroll.components.active}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          <ToggleLeft className="w-3 h-3" />{t.payroll.components.inactive}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition"
                          title={t.common.edit}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {c.is_active && (
                          <button
                            onClick={() => handleDeactivate(c)}
                            disabled={deactivating === c.id}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                            title={t.common.delete}
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
