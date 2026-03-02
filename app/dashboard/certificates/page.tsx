'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Download, Search, Loader2,
  Calendar, User, Clock, ChevronLeft, ChevronRight,
  Building2, RefreshCw, LogOut
} from 'lucide-react';
import Header from '@/components/Header';

// ============================================
// TYPES
// ============================================

interface FormerEmployee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  department_name?: string;
  status: string;
  end_date?: string;
}

interface CertificateHistory {
  id: number;
  reference_number: string;
  employee_id: number;
  employee_name: string;
  generated_at: string;
  generated_by: string;
  generation_type: string;
}

// ============================================
// API
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getFormerEmployees(
  page: number = 1,
  search: string = '',
  status: string = 'terminated'
): Promise<{ items: FormerEmployee[], total: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: '10',
    status,
  });
  if (search) params.append('search', search);

  const response = await fetch(`${API_URL}/api/employees/?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement');
  return response.json();
}

async function getCertificateHistory(
  page: number = 1,
  employeeId?: number
): Promise<{ items: CertificateHistory[], total: number }> {
  const params = new URLSearchParams({ page: page.toString(), page_size: '10' });
  if (employeeId) params.append('employee_id', employeeId.toString());

  const response = await fetch(`${API_URL}/api/certificates/history?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement');
  return response.json();
}

async function generateCertificateForEmployee(employeeId: number): Promise<Blob> {
  const token = localStorage.getItem('access_token');
  const response = await fetch(
    `${API_URL}/api/certificates/employee/${employeeId}/work-certificate`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la génération');
  }

  return response.blob();
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// COMPONENT
// ============================================

export default function CertificatesPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  // Onglet génération
  const [employees, setEmployees] = useState<FormerEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'terminated' | 'inactive'>('terminated');

  // Onglet historique
  const [history, setHistory] = useState<CertificateHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const data = await getFormerEmployees(employeePage, searchTerm, statusFilter);
      setEmployees(data.items);
      setEmployeeTotal(data.total);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoadingEmployees(false);
    }
  }, [employeePage, searchTerm, statusFilter]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await getCertificateHistory(historyPage);
      setHistory(data.items);
      setHistoryTotal(data.total);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyPage]);

  useEffect(() => {
    if (activeTab === 'generate') {
      loadEmployees();
    } else {
      loadHistory();
    }
  }, [activeTab, loadEmployees, loadHistory]);

  // Recherche avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'generate') {
        setEmployeePage(1);
        loadEmployees();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  const handleGenerateCertificate = async (employee: FormerEmployee) => {
    setGeneratingFor(employee.id);
    try {
      const blob = await generateCertificateForEmployee(employee.id);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificat_travail_${employee.last_name}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (activeTab === 'history') loadHistory();
    } catch (error) {
      console.error('Erreur:', error);
      alert(error instanceof Error ? error.message : 'Erreur lors de la génération');
    } finally {
      setGeneratingFor(null);
    }
  };

  const totalEmployeePages = Math.ceil(employeeTotal / 10);
  const totalHistoryPages = Math.ceil(historyTotal / 10);

  return (
    <>
      <Header
        title="Certificats de Travail"
        subtitle="Générez les certificats pour les employés ayant quitté l'entreprise"
      />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <LogOut className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              Le <strong>certificat de travail</strong> est un document remis aux employés ayant quitté
              l&apos;entreprise. Il retrace leur parcours complet : tous les postes occupés avec les dates.
              Seul le service RH peut le générer.
            </p>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('generate')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'generate'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Générer un certificat
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'history'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Historique
                    {historyTotal > 0 && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                        {historyTotal}
                      </span>
                    )}
                  </div>
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* ===== TAB: GÉNÉRER ===== */}
              {activeTab === 'generate' && (
                <div>
                  {/* Filtres */}
                  <div className="flex gap-3 mb-6 flex-wrap">
                    <div className="flex-1 min-w-[220px] relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Rechercher un ex-employé..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value as 'terminated' | 'inactive');
                        setEmployeePage(1);
                      }}
                      className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="terminated">Démissionnaires / Licenciés</option>
                      <option value="inactive">Inactifs</option>
                    </select>
                  </div>

                  {/* Liste */}
                  {loadingEmployees ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                  ) : employees.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="font-medium">Aucun ex-employé trouvé</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Les employés ayant quitté l&apos;entreprise apparaîtront ici
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Employé</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Matricule</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Dernier poste</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Département</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">
                                <div className="flex items-center gap-1">
                                  <LogOut className="w-3.5 h-3.5" />
                                  Date de départ
                                </div>
                              </th>
                              <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employees.map((employee) => (
                              <tr key={employee.id} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm">
                                      {employee.first_name[0]}{employee.last_name[0]}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900 text-sm">
                                        {employee.first_name} {employee.last_name}
                                      </p>
                                      <p className="text-xs text-gray-400">{employee.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-500">
                                  {employee.employee_id}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600">
                                  {employee.job_title || '—'}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600">
                                  {employee.department_name || '—'}
                                </td>
                                <td className="px-4 py-4">
                                  {employee.end_date ? (
                                    <span className="inline-flex items-center gap-1 text-sm text-red-600">
                                      <Calendar className="w-3.5 h-3.5" />
                                      {formatDate(employee.end_date)}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <button
                                    onClick={() => handleGenerateCertificate(employee)}
                                    disabled={generatingFor === employee.id}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {generatingFor === employee.id ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Génération...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-4 h-4" />
                                        Générer
                                      </>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {totalEmployeePages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                          <p className="text-sm text-gray-500">{employeeTotal} ex-employé(s)</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEmployeePage(p => Math.max(1, p - 1))}
                              disabled={employeePage === 1}
                              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-gray-600">
                              Page {employeePage} sur {totalEmployeePages}
                            </span>
                            <button
                              onClick={() => setEmployeePage(p => Math.min(totalEmployeePages, p + 1))}
                              disabled={employeePage === totalEmployeePages}
                              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ===== TAB: HISTORIQUE ===== */}
              {activeTab === 'history' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-gray-500">
                      Tous les certificats générés par l&apos;entreprise
                    </p>
                    <button
                      onClick={loadHistory}
                      disabled={loadingHistory}
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                      Actualiser
                    </button>
                  </div>

                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>Aucun certificat généré pour le moment</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Référence</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Employé</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Date de génération</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Généré par</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((cert) => (
                              <tr key={cert.id} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-4 py-4">
                                  <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                    {cert.reference_number}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-900">{cert.employee_name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-600">{formatDateTime(cert.generated_at)}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                    {cert.generated_by}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {totalHistoryPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                          <p className="text-sm text-gray-500">{historyTotal} certificat(s) généré(s)</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                              disabled={historyPage === 1}
                              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-gray-600">
                              Page {historyPage} sur {totalHistoryPages}
                            </span>
                            <button
                              onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                              disabled={historyPage === totalHistoryPages}
                              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
