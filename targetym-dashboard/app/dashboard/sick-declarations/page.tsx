'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, FileText, Heart, Loader2, Plus, RefreshCw, Search, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import SearchableSelect from '@/components/SearchableSelect';
import { API_URL, fetchWithAuth, getEmployee, getEmployees, type Employee } from '@/lib/api';
import CustomDatePicker from '@/components/CustomDatePicker';
import CustomSelect from '@/components/CustomSelect';

interface SickDeclaration {
  id: number;
  employee_id: number;
  employee_name?: string;
  sick_start_date: string;
  estimated_duration_days: number;
  estimated_end_date: string;
  actual_end_date?: string | null;
  certificate_url?: string | null;
  certificate_filename?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-FR');
}

function statusLabel(status: string) {
  if (status === 'active' || status === 'prolongee') return 'En cours';
  if (status === 'guerie_retour_travail' || status === 'cloture') return 'Cloturee';
  return status;
}

function statusClass(status: string) {
  if (status === 'active' || status === 'prolongee') return 'bg-orange-100 text-orange-800';
  if (status === 'guerie_retour_travail' || status === 'cloture') return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-800';
}

async function getDeclarations(): Promise<SickDeclaration[]> {
  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/?standalone=true`);
  if (!res.ok) throw new Error('Erreur lors du chargement des declarations');
  return res.json();
}

function getStoredUserScope(): {
  role: string;
  employeeId: number | null;
  hasTeamAccess: boolean;
} {
  if (typeof window === 'undefined') {
    return { role: 'employee', employeeId: null, hasTeamAccess: false };
  }
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = String(user.role || 'employee').toLowerCase();
    return {
      role,
      employeeId: user.employee_id || null,
      hasTeamAccess:
        role === 'manager' ||
        Boolean(user.has_manager_access) ||
        Number(user.managed_employee_count || 0) > 0,
    };
  } catch {
    return { role: 'employee', employeeId: null, hasTeamAccess: false };
  }
}

async function getAccessibleEmployees(): Promise<Employee[]> {
  const scope = getStoredUserScope();
  if (['rh', 'admin', 'dg', 'super_admin'].includes(scope.role)) {
    const response = await getEmployees({ page_size: 500, status: 'active' });
    return response.items || [];
  }
  if (!scope.employeeId) return [];

  const self = await getEmployee(scope.employeeId);
  if (!scope.hasTeamAccess) return [self];

  const reportsResponse = await fetchWithAuth(
    `${API_URL}/api/employees/${scope.employeeId}/direct-reports`,
  );
  if (!reportsResponse.ok) return [self];
  const reports = await reportsResponse.json();
  return [
    self,
    ...(Array.isArray(reports)
      ? reports.filter((employee: Employee) => employee.id !== self.id)
      : []),
  ];
}

async function createDeclaration(payload: {
  employee_id: number;
  sick_start_date: string;
  estimated_duration_days: number;
  notes?: string;
  certificate?: File | null;
}) {
  const formData = new FormData();
  formData.append('employee_id', String(payload.employee_id));
  formData.append('sick_start_date', payload.sick_start_date);
  formData.append('estimated_duration_days', String(payload.estimated_duration_days));
  if (payload.notes) formData.append('notes', payload.notes);
  if (payload.certificate) formData.append('certificate', payload.certificate);

  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la declaration');
  }
}

async function closeDeclaration(id: number) {
  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/${id}/recover`, {
    method: 'PUT',
    body: JSON.stringify({ recovery_type: 'return_to_work' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la cloture');
  }
}

async function uploadCertificate(id: number, certificate: File) {
  const formData = new FormData();
  formData.append('certificate', certificate);

  const res = await fetchWithAuth(`${API_URL}/api/leave-sick-declarations/${id}/certificate`, {
    method: 'PUT',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de l'envoi du justificatif");
  }
}

function CertificateModal({
  declaration,
  onClose,
  onSuccess,
}: {
  declaration: SickDeclaration;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error('Justificatif requis');
      return;
    }
    setSubmitting(true);
    try {
      await uploadCertificate(declaration.id, file);
      toast.success('Justificatif enregistré');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <form onSubmit={submit} className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-500" />
              Justificatif maladie
            </h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-500">
            {declaration.employee_name || `Collaborateur #${declaration.employee_id}`}
          </p>

          <input
            type="file"
            required
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="w-full text-sm text-gray-700"
          />

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50">
              {submitting ? 'Envoi...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewDeclarationModal({
  employees,
  onClose,
  onSuccess,
}: {
  employees: Employee[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [sickStartDate, setSickStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(1);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeId) {
      toast.error('Collaborateur requis');
      return;
    }
    setSubmitting(true);
    try {
      await createDeclaration({
        employee_id: Number(employeeId),
        sick_start_date: sickStartDate,
        estimated_duration_days: duration,
        notes: notes || undefined,
        certificate: file,
      });
      toast.success('Declaration maladie enregistree');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <form onSubmit={submit} className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-orange-500" />
              Nouvelle declaration maladie
            </h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Collaborateur</label>
            <SearchableSelect
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="Selectionner un collaborateur"
              options={employees.map((employee) => ({
                value: String(employee.id),
                label: `${employee.first_name} ${employee.last_name}`.trim(),
                subtitle: employee.department_name || employee.email,
              }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de debut</label>
            <CustomDatePicker
              value={sickStartDate}
              onChange={setSickStartDate}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duree estimee (jours)</label>
            <input
              type="number"
              min={1}
              required
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value) || 1)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Justificatif (facultatif)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="w-full text-sm text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50">
              {submitting ? 'Envoi...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SickDeclarationsPage() {
  const [declarations, setDeclarations] = useState<SickDeclaration[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [showModal, setShowModal] = useState(false);
  const [certificateDeclaration, setCertificateDeclaration] = useState<SickDeclaration | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [declarationsData, employeesData] = await Promise.all([
        getDeclarations(),
        getAccessibleEmployees(),
      ]);
      setDeclarations(declarationsData);
      setEmployees(employeesData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCount = declarations.filter((item) => item.status === 'active' || item.status === 'prolongee').length;
  const closedCount = declarations.length - activeCount;

  const filteredDeclarations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return declarations.filter((item) => {
      const isActive = item.status === 'active' || item.status === 'prolongee';
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'closed' && isActive) return false;
      if (normalizedSearch && !(item.employee_name || '').toLowerCase().includes(normalizedSearch)) return false;
      return true;
    });
  }, [declarations, search, statusFilter]);

  return (
    <>
      <Header title="Declarations maladie" />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Declarations maladie</h1>
            <p className="text-sm text-gray-500 mt-1">Suivi RH des declarations hors conges. Les maladies pendant conges restent dans le module Conges.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            <Plus className="w-4 h-4" />
            Nouvelle declaration
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">Total</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{declarations.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">En cours</div>
            <div className="mt-1 text-2xl font-bold text-orange-600">{activeCount}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-500">Cloturees</div>
            <div className="mt-1 text-2xl font-bold text-green-600">{closedCount}</div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un collaborateur"
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <CustomSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: 'all', label: 'Tous' },
                  { value: 'active', label: 'En cours' },
                  { value: 'closed', label: 'Cloturees' },
                ]}
                className="w-full sm:w-40"
              />
              <button onClick={loadData} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Actualiser">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Chargement...
            </div>
          ) : filteredDeclarations.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucune declaration maladie.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Collaborateur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Debut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Fin estimee</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Duree</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Justificatif</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDeclarations.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{item.employee_name || `#${item.employee_id}`}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{formatDate(item.sick_start_date)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{formatDate(item.actual_end_date || item.estimated_end_date)}</td>
                      <td className="px-4 py-4 text-sm text-gray-900">{item.estimated_duration_days}j</td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClass(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {item.certificate_url ? (
                          <a href={item.certificate_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                            <FileText className="w-4 h-4" />
                            Voir
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">Aucun</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {(item.status === 'active' || item.status === 'prolongee') && (
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              onClick={() => setCertificateDeclaration(item)}
                              className="inline-flex items-center gap-1 text-sm font-medium text-orange-700 hover:text-orange-800"
                            >
                              <Upload className="w-4 h-4" />
                              {item.certificate_url ? 'Remplacer' : 'Ajouter'}
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await closeDeclaration(item.id);
                                  toast.success('Declaration cloturee');
                                  await loadData();
                                } catch (error) {
                                  toast.error(error instanceof Error ? error.message : 'Erreur');
                                }
                              }}
                              className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Cloturer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewDeclarationModal
          employees={employees}
          onClose={() => setShowModal(false)}
          onSuccess={loadData}
        />
      )}
      {certificateDeclaration && (
        <CertificateModal
          declaration={certificateDeclaration}
          onClose={() => setCertificateDeclaration(null)}
          onSuccess={loadData}
        />
      )}
    </>
  );
}
