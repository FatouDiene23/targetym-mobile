'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PlayCircle, Plus, Loader2, X, ClipboardList, ChevronDown,
  Receipt, Eye, Zap, CheckCircle2, Calendar, Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/CustomSelect';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';
import {
  getRuns, createRun, simulateRun, validateRun,
  getPayrollConfig, updatePayrollConfig,
  formatXOF, MONTHS_FR, RUN_STATUS,
  type PayrollRun, type PayrollConfig,
} from '@/lib/payrollApi';

// ── Composant badge statut ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = RUN_STATUS[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

// ── Modal création d'un run ───────────────────────────────────────────────────

function NewRunModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: PayrollRun) => void;
}) {
  const { t } = useI18n();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const run = await createRun({ period_year: year, period_month: month, notes: notes || undefined });
      toast.success(t.payroll.runsPage.runCreated.replace('{period}', `${MONTHS_FR[month - 1]} ${year}`));
      onCreated(run);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-800 text-lg">{t.payroll.runsPage.newRunTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.runsPage.year} *</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={year}
                onChange={e => setYear(parseInt(e.target.value))}
                min={2020}
                max={2099}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.runsPage.month} *</label>
              <CustomSelect
                value={String(month)}
                onChange={(v) => setMonth(parseInt(v))}
                options={MONTHS_FR.map((m, i) => ({ value: String(i + 1), label: m }))}
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.runsPage.notes}</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t.payroll.runsPage.optionalPlaceholder}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
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
              {t.payroll.runsPage.createRun}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal configuration employeur ────────────────────────────────────────────

function ConfigModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: PayrollConfig | null;
  onClose: () => void;
  onSaved: (c: PayrollConfig) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    ninea: initial?.ninea ?? '',
    ipres_employer_number: initial?.ipres_employer_number ?? '',
    css_employer_number: initial?.css_employer_number ?? '',
    convention_collective: initial?.convention_collective ?? '',
    company_address: initial?.company_address ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = (field: string, value: string) =>
    setForm(p => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await updatePayrollConfig({
        ninea: form.ninea || null,
        ipres_employer_number: form.ipres_employer_number || null,
        css_employer_number: form.css_employer_number || null,
        convention_collective: form.convention_collective || null,
        company_address: form.company_address || null,
      });
      toast.success(t.payroll.runsPage.configSaved);
      onSaved(saved);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-800 text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-600" />
            {t.payroll.runsPage.configTitle}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-gray-500">
            {t.payroll.runsPage.configInfoNote}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.runsPage.ninea}</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.ninea}
                onChange={e => set('ninea', e.target.value)}
                placeholder="Ex: 00123456 7Z1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.runsPage.ipresEmployerNumber}</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.ipres_employer_number}
                onChange={e => set('ipres_employer_number', e.target.value)}
                placeholder="Ex: A012345"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.runsPage.cssEmployerNumber}</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.css_employer_number}
                onChange={e => set('css_employer_number', e.target.value)}
                placeholder="Ex: CSS-00456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.runsPage.collectiveAgreement}</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={form.convention_collective}
                onChange={e => set('convention_collective', e.target.value)}
                placeholder="Ex: Convention nationale"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.payroll.runsPage.companyAddress}</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={2}
              value={form.company_address}
              onChange={e => set('company_address', e.target.value)}
              placeholder="Ex: 12 Avenue Léopold Sédar Senghor, Dakar"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
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
              {t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RunsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; danger?: boolean }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, config] = await Promise.all([getRuns(), getPayrollConfig()]);
      setRuns(data.items);
      setPayrollConfig(config);
    } catch {
      toast.error(t.payroll.runsPage.loadingError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreated = (r: PayrollRun) => {
    setRuns(prev => [r, ...prev]);
    setModalOpen(false);
  };

  const handleSimulate = (run: PayrollRun) => {
    setConfirmDialog({
      open: true,
      title: t.payroll.runsPage.simulateTitle,
      message: t.payroll.runsPage.simulateMessage.replace('{period}', `${MONTHS_FR[run.period_month - 1]} ${run.period_year}`),
      onConfirm: async () => {
        setActionLoading(run.id);
        try {
          const updated = await simulateRun(run.id);
          toast.success(t.payroll.runsPage.simulationDone);
          setRuns(prev => prev.map(r => r.id === updated.id ? updated : r));
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : t.payroll.runsPage.simulationError);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleValidate = (run: PayrollRun) => {
    setConfirmDialog({
      open: true,
      title: t.payroll.runsPage.validateTitle,
      message: t.payroll.runsPage.validateMessage.replace('{period}', `${MONTHS_FR[run.period_month - 1]} ${run.period_year}`),
      danger: true,
      onConfirm: async () => {
        setActionLoading(run.id);
        try {
          const updated = await validateRun(run.id);
          toast.success(t.payroll.runsPage.validated);
          setRuns(prev => prev.map(r => r.id === updated.id ? updated : r));
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : t.payroll.runsPage.validationError);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title={t.payroll.title} />

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Fil d'Ariane */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <Receipt className="w-4 h-4" />
          <span>{t.payroll.title}</span>
          <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
          <span className="text-gray-700 font-medium">{t.payroll.runsPage.breadcrumbRuns}</span>
        </div>

        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <PlayCircle className="w-6 h-6 text-primary-600" />
              {t.payroll.runsPage.title}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {runs.length > 1
                ? t.payroll.runsPage.runCountPlural.replace('{count}', String(runs.length))
                : t.payroll.runsPage.runCount.replace('{count}', String(runs.length))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfigModalOpen(true)}
              className="flex items-center gap-2 text-gray-600 text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            >
              <Settings className="w-4 h-4" />
              {t.payroll.config}
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 bg-primary-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-700 transition"
            >
              <Plus className="w-4 h-4" />
              {t.payroll.runsPage.newRun}
            </button>
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            {t.payroll.runsPage.loading}
          </div>
        ) : runs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <PlayCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">{t.payroll.runsPage.noRun}</p>
            <p className="text-sm mt-1">{t.payroll.runsPage.createFirstRun}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map(run => (
              <div
                key={run.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition"
              >
                {/* Période */}
                <div className="flex-shrink-0 w-28 text-center">
                  <div className="text-lg font-bold text-gray-800">
                    {MONTHS_FR[run.period_month - 1]}
                  </div>
                  <div className="text-sm text-gray-400">{run.period_year}</div>
                </div>

                <div className="w-px h-10 bg-gray-100 flex-shrink-0" />

                {/* Statut */}
                <div className="flex-shrink-0">
                  <StatusBadge status={run.status} />
                </div>

                {/* Chiffres */}
                <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400 text-xs mb-0.5">{t.payroll.runsPage.grossTotal}</div>
                    <div className="font-semibold text-gray-800">{formatXOF(run.total_brut)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs mb-0.5">{t.payroll.runsPage.netToPay}</div>
                    <div className="font-semibold text-green-700">{formatXOF(run.total_net)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs mb-0.5">{t.payroll.runsPage.employerCharges}</div>
                    <div className="font-semibold text-orange-600">{formatXOF(run.total_charges_patronales)}</div>
                  </div>
                </div>

                {/* Employés */}
                {run.employee_count != null && (
                  <div className="flex-shrink-0 text-center">
                    <div className="text-lg font-bold text-gray-700">{run.employee_count}</div>
                    <div className="text-xs text-gray-400">{t.payroll.runsPage.employees}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* Variables */}
                  <button
                    onClick={() => router.push(`/dashboard/paie/runs/${run.id}/variables`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                    title={t.payroll.runsPage.variablesOfMonth}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {t.payroll.runsPage.variables}
                  </button>

                  {/* Récap */}
                  {(run.status === 'simulation' || run.status === 'validated') && (
                    <button
                      onClick={() => router.push(`/dashboard/paie/runs/${run.id}/recap`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition"
                      title={t.payroll.runsPage.payslips}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {t.payroll.runsPage.payslips}
                    </button>
                  )}

                  {/* Simuler */}
                  {(run.status === 'draft') && (
                    <button
                      onClick={() => handleSimulate(run)}
                      disabled={actionLoading === run.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition disabled:opacity-60"
                    >
                      {actionLoading === run.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Zap className="w-3.5 h-3.5" />}
                      {t.payroll.runsPage.simulate}
                    </button>
                  )}

                  {/* Valider */}
                  {run.status === 'simulation' && (
                    <button
                      onClick={() => handleValidate(run)}
                      disabled={actionLoading === run.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-60"
                    >
                      {actionLoading === run.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {t.payroll.runsPage.validate}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {modalOpen && (
        <NewRunModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />
      )}
      {configModalOpen && (
        <ConfigModal
          initial={payrollConfig}
          onClose={() => setConfigModalOpen(false)}
          onSaved={(c) => { setPayrollConfig(c); setConfigModalOpen(false); }}
        />
      )}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog(p => ({ ...p, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
      />
    </div>
  );
}
