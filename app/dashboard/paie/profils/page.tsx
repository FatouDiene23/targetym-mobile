'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Pencil, Plus, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import { getEmployees, type Employee } from '@/lib/api';
import {
  getEmployeePayrollProfile, createEmployeePayrollProfile, updateEmployeePayrollProfile,
  formatXOF,
  type EmployeePayrollProfile, type EmployeePayrollProfileCreate,
} from '@/lib/payrollApi';

// ── Types ────────────────────────────────────────────────────────────────────

interface EmployeeWithProfile extends Employee {
  profile?: EmployeePayrollProfile | null;
  profileLoaded: boolean;
}

const CONTRACT_TYPES = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'stage', label: 'Stage' },
  { value: 'consultant', label: 'Consultant' },
];

// ── Modal profil ─────────────────────────────────────────────────────────────

function ProfileModal({
  employee,
  existing,
  onClose,
  onSaved,
}: {
  employee: Employee;
  existing: EmployeePayrollProfile | null;
  onClose: () => void;
  onSaved: (p: EmployeePayrollProfile) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EmployeePayrollProfileCreate>({
    base_salary: existing?.base_salary ?? undefined,
    transport_allowance: existing?.transport_allowance ?? undefined,
    housing_allowance: existing?.housing_allowance ?? undefined,
    family_parts: existing?.family_parts ?? undefined,
    contract_type: existing?.contract_type ?? 'cdi',
    classification: existing?.classification ?? '',
    ipres_enrolled: existing?.ipres_enrolled ?? true,
    ipm_enrolled: existing?.ipm_enrolled ?? true,
    css_enrolled: existing?.css_enrolled ?? true,
    cfce_enrolled: existing?.cfce_enrolled ?? true,
    bank_name: existing?.bank_name ?? '',
    bank_account_number: existing?.bank_account_number ?? '',
  });

  const set = (field: keyof EmployeePayrollProfileCreate, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.base_salary || form.base_salary <= 0) {
      return toast.error('Le salaire de base est requis');
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        classification: form.classification || undefined,
        bank_name: form.bank_name || undefined,
        bank_account_number: form.bank_account_number || undefined,
      };
      let saved: EmployeePayrollProfile;
      if (existing) {
        saved = await updateEmployeePayrollProfile(employee.id, payload);
        toast.success('Profil mis à jour');
      } else {
        saved = await createEmployeePayrollProfile(employee.id, payload);
        toast.success('Profil créé');
      }
      onSaved(saved);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-800 text-lg">
              {existing ? 'Modifier le profil de paie' : 'Configurer le profil de paie'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {employee.first_name} {employee.last_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Contrat et classification */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de contrat</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.contract_type ?? ''}
                onChange={e => set('contract_type', e.target.value as 'cdi' | 'cdd' | 'stage' | 'consultant')}
              >
                {CONTRACT_TYPES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ex. Cadre, Agent de maîtrise…"
                value={form.classification ?? ''}
                onChange={e => set('classification', e.target.value)}
              />
            </div>
          </div>

          {/* Salaires */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Rémunération (XOF)</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salaire de base <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex. 500000"
                  value={form.base_salary ?? ''}
                  onChange={e => set('base_salary', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indemnité transport</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ex. 26000"
                    value={form.transport_allowance ?? ''}
                    onChange={e => set('transport_allowance', e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indemnité logement</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ex. 0"
                    value={form.housing_allowance ?? ''}
                    onChange={e => set('housing_allowance', e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </div>
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Parts fiscales</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  step={1}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1"
                  value={form.family_parts ?? ''}
                  onChange={e => set('family_parts', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
            </div>
          </div>

          {/* Cotisations sociales */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Cotisations sociales</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'ipres_enrolled', label: 'IPRES (retraite)' },
                { key: 'ipm_enrolled', label: 'IPM (maladie)' },
                { key: 'css_enrolled', label: 'CSS / MSAS' },
                { key: 'cfce_enrolled', label: 'CFCE' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600"
                    checked={!!(form as Record<string, unknown>)[key]}
                    onChange={e => set(key as keyof EmployeePayrollProfileCreate, e.target.checked)}
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Banque */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Coordonnées bancaires <span className="font-normal text-gray-400">(optionnel)</span></h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banque</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex. SGBS"
                  value={form.bank_name ?? ''}
                  onChange={e => set('bank_name', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de compte</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex. SN12345678"
                  value={form.bank_account_number ?? ''}
                  onChange={e => set('bank_account_number', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {existing ? 'Enregistrer' : 'Créer le profil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ProfilsPayePage() {
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalEmployee, setModalEmployee] = useState<EmployeeWithProfile | null>(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEmployees({ status: 'active', page_size: 200 });
      const emps: EmployeeWithProfile[] = res.items.map(e => ({ ...e, profileLoaded: false }));
      setEmployees(emps);

      // Charger les profils en parallèle
      const profiles = await Promise.all(
        emps.map(e => getEmployeePayrollProfile(e.id).catch(() => null))
      );
      setEmployees(emps.map((e, i) => ({ ...e, profile: profiles[i], profileLoaded: true })));
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaved = (employeeId: number, profile: EmployeePayrollProfile) => {
    setEmployees(prev => prev.map(e =>
      e.id === employeeId ? { ...e, profile, profileLoaded: true } : e
    ));
    setModalEmployee(null);
  };

  const filtered = employees.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.first_name.toLowerCase().includes(q) ||
      e.last_name.toLowerCase().includes(q) ||
      (e.position ?? '').toLowerCase().includes(q)
    );
  });

  const configured = employees.filter(e => e.profile).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Profils de paie" subtitle="Configurez le salaire et les paramètres de paie de chaque employé" />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Résumé */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Employés actifs</p>
            <p className="text-2xl font-bold text-gray-800">{employees.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Profils configurés</p>
            <p className="text-2xl font-bold text-green-600">{configured}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">À configurer</p>
            <p className="text-2xl font-bold text-orange-500">{employees.length - configured}</p>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="bg-white rounded-xl border p-4">
          <input
            type="text"
            placeholder="Rechercher un employé…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border divide-y">
            {filtered.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">Aucun employé trouvé</div>
            )}
            {filtered.map(emp => {
              const p = emp.profile;
              return (
                <div key={emp.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{emp.position ?? emp.job_title ?? '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {!emp.profileLoaded ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                    ) : p ? (
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-gray-700">
                          {formatXOF(p.base_salary)}
                        </p>
                        <p className="text-xs text-gray-400 uppercase">{p.contract_type ?? '—'}</p>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-orange-500 bg-orange-50 rounded-full px-2.5 py-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Non configuré
                      </span>
                    )}

                    {p && (
                      <span className="hidden sm:flex items-center gap-1 text-xs text-green-600 bg-green-50 rounded-full px-2.5 py-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Configuré
                      </span>
                    )}

                    <button
                      onClick={() => setModalEmployee(emp)}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-gray-600"
                    >
                      {p ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {p ? 'Modifier' : 'Configurer'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalEmployee && (
        <ProfileModal
          employee={modalEmployee}
          existing={modalEmployee.profile ?? null}
          onClose={() => setModalEmployee(null)}
          onSaved={p => handleSaved(modalEmployee.id, p)}
        />
      )}
    </div>
  );
}
