'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Calendar, Plus, Loader2, X, Trash2, Lock, ChevronDown,
  Receipt, Pencil, AlertCircle, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import Link from 'next/link';
import Header from '@/components/Header';
import { getEmployees, type Employee } from '@/lib/api';
import {
  getVariables, createVariable, updateVariable, deleteVariable, lockPeriod,
  getComponents, getRun, MONTHS_FR,
  type PayVariable, type PayComponent,
} from '@/lib/payrollApi';

// ── Modals ────────────────────────────────────────────────────────────────────

function VariableModal({
  variable,
  employees,
  components,
  runYear,
  runMonth,
  onClose,
  onSaved,
}: {
  variable?: PayVariable;
  employees: Employee[];
  components: PayComponent[];
  runYear: number;
  runMonth: number;
  onClose: () => void;
  onSaved: (v: PayVariable) => void;
}) {
  const [employeeId, setEmployeeId] = useState(variable?.employee_id ?? 0);
  const [componentId, setComponentId] = useState(variable?.component_id ?? 0);
  const [value, setValue] = useState(variable?.value ?? 0);
  const [saving, setSaving] = useState(false);

  const manualComponents = components.filter(c => c.calc_type === 'manual_variable' && c.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeId === 0) return toast.error('Sélectionnez un employé');
    if (componentId === 0) return toast.error('Sélectionnez une rubrique');
    setSaving(true);
    try {
      let result: PayVariable;
      if (variable) {
        result = await updateVariable(variable.id, value);
      } else {
        result = await createVariable({
          employee_id: employeeId,
          component_id: componentId,
          period_year: runYear,
          period_month: runMonth,
          value,
        });
      }
      toast.success(variable ? 'Variable modifiée' : 'Variable ajoutée');
      onSaved(result);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-semibold text-gray-800 text-lg">
            {variable ? 'Modifier la variable' : 'Ajouter une variable'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!variable && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={employeeId}
                  onChange={e => setEmployeeId(parseInt(e.target.value))}
                  required
                >
                  <option value={0}>— Sélectionner —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rubrique *</label>
                {manualComponents.length === 0 ? (
                  <p className="text-xs text-orange-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Aucune rubrique à variable manuelle active
                  </p>
                ) : (
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={componentId}
                    onChange={e => setComponentId(parseInt(e.target.value))}
                    required
                  >
                    <option value={0}>— Sélectionner —</option>
                    {manualComponents.map(c => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}
          {variable && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              <div><span className="text-gray-400">Employé :</span> {variable.component_name}</div>
              <div><span className="text-gray-400">Rubrique :</span> {variable.component_code}</div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valeur (XOF) *</label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={value}
              onChange={e => setValue(parseFloat(e.target.value) || 0)}
              min={0}
              step={1}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
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
              className="px-5 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {variable ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VariablesPage() {
  const params = useParams();
  const runId = params.runId as string;
  const runIdNum = parseInt(runId);

  const [variables, setVariables] = useState<PayVariable[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [components, setComponents] = useState<PayComponent[]>([]);
  const [periodYear, setPeriodYear] = useState(0);
  const [periodMonth, setPeriodMonth] = useState(0);
  const [runStatus, setRunStatus] = useState('draft');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PayVariable | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [locking, setLocking] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; danger?: boolean }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const run = await getRun(runIdNum);
      setPeriodYear(run.period_year);
      setPeriodMonth(run.period_month);
      setRunStatus(run.status);

      const [vars, emps, comps] = await Promise.all([
        getVariables(run.period_year, run.period_month),
        getEmployees({ status: 'active', page_size: 200 }).then(r => r.items ?? []),
        getComponents(false),
      ]);
      setVariables(vars);
      setEmployees(emps);
      setComponents(comps);
    } catch {
      toast.error('Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [runIdNum]);

  useEffect(() => { void load(); }, [load]);

  const handleSaved = (v: PayVariable) => {
    setVariables(prev => {
      const idx = prev.findIndex(x => x.id === v.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = v; return n; }
      return [...prev, v];
    });
    setModalOpen(false);
    setEditing(undefined);
  };

  const handleDelete = (v: PayVariable) => {
    setConfirmDialog({
      open: true,
      title: 'Supprimer la variable',
      message: 'Supprimer cette variable de paie ? Cette action est irréversible.',
      danger: true,
      onConfirm: async () => {
        setDeletingId(v.id);
        try {
          await deleteVariable(v.id);
          toast.success('Variable supprimée');
          setVariables(prev => prev.filter(x => x.id !== v.id));
        } catch {
          toast.error('Erreur suppression');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleLock = () => {
    setConfirmDialog({
      open: true,
      title: 'Verrouiller la période',
      message: `Verrouiller la période ${MONTHS_FR[periodMonth - 1]} ${periodYear} ? Aucune variable ne pourra être modifiée après verrouillage.`,
      danger: true,
      onConfirm: async () => {
        setLocking(true);
        try {
          await lockPeriod(periodYear, periodMonth);
          toast.success('Période verrouillée');
          setRunStatus('simulated'); // hint visuel
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Erreur verrouillage');
        } finally {
          setLocking(false);
        }
      },
    });
  };

  const isLocked = runStatus !== 'draft';

  // Enrichir les variables avec les noms d'employé
  const enriched = variables.map(v => ({
    ...v,
    _empName: employees.find(e => e.id === v.employee_id)
      ? `${employees.find(e => e.id === v.employee_id)!.first_name} ${employees.find(e => e.id === v.employee_id)!.last_name}`
      : `Employé #${v.employee_id}`,
  }));

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Paie" />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* Fil d'Ariane */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <Receipt className="w-4 h-4" />
          <Link href="/dashboard/paie/runs" className="hover:text-primary-600">Runs</Link>
          <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
          <span className="text-gray-700 font-medium">
            Variables — {periodMonth > 0 ? `${MONTHS_FR[periodMonth - 1]} ${periodYear}` : '…'}
          </span>
        </div>

        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary-600" />
              Variables du mois
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {variables.length} variable{variables.length > 1 ? 's' : ''}
              {isLocked && <span className="ml-2 text-orange-500">• Période verrouillée</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLocked && (
              <>
                <button
                  onClick={handleLock}
                  disabled={locking}
                  className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 px-4 py-2 rounded-lg hover:bg-orange-100 transition disabled:opacity-60"
                >
                  {locking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  Verrouiller
                </button>
                <button
                  onClick={() => { setEditing(undefined); setModalOpen(true); }}
                  className="flex items-center gap-2 bg-primary-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Chargement…
          </div>
        ) : enriched.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Aucune variable saisie</p>
            {!isLocked && (
              <p className="text-sm mt-1">Ajoutez des primes, heures sup, etc.</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Employé</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Rubrique</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Valeur (XOF)</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Statut</th>
                  {!isLocked && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {enriched.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <span className="text-gray-800 font-medium">{v._empName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500">{v.component_code}</span>
                      {' '}{v.component_name}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      {v.value.toLocaleString('fr-SN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${
                        v.status === 'locked'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {v.status === 'locked' ? 'Verrouillé' : 'Brouillon'}
                      </span>
                    </td>
                    {!isLocked && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => { setEditing(v); setModalOpen(true); }}
                            disabled={v.status === 'locked'}
                            className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition disabled:opacity-30"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(v)}
                            disabled={deletingId === v.id || v.status === 'locked'}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition disabled:opacity-30"
                          >
                            {deletingId === v.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Lien recap */}
        {(runStatus === 'simulated' || runStatus === 'validated') && (
          <div className="mt-4 text-center">
            <Link
              href={`/dashboard/paie/runs/${runId}/recap`}
              className="text-sm text-primary-600 hover:underline"
            >
              → Voir les bulletins du run
            </Link>
          </div>
        )}
      </main>

      {modalOpen && periodYear > 0 && (
        <VariableModal
          variable={editing}
          employees={employees}
          components={components}
          runYear={periodYear}
          runMonth={periodMonth}
          onClose={() => { setModalOpen(false); setEditing(undefined); }}
          onSaved={handleSaved}
        />
      )}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
      />
    </div>
  );
}