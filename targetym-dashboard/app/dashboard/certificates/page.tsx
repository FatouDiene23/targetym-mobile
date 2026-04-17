'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FileText, Download, Search, Loader2,
  Calendar, User, Clock, ChevronLeft, ChevronRight,
  Building2, RefreshCw, LogOut, FileCheck, X
} from 'lucide-react';
import Header from '@/components/Header';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { useI18n } from '@/lib/i18n/I18nContext';

// ============================================
// TYPES
// ============================================

interface Employee {
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

type DocType = 'attestation' | 'certificat';

// ============================================
// API
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getEmployees(
  page: number = 1,
  search: string = '',
  status: string = ''
): Promise<{ items: Employee[], total: number }> {
  const params = new URLSearchParams({ page: page.toString(), page_size: '10' });
  if (search) params.append('search', search);
  if (status) params.append('status', status);

  const response = await fetch(`${API_URL}/api/employees/?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement');
  return response.json();
}

async function getCertificateHistory(
  page: number = 1
): Promise<{ items: CertificateHistory[], total: number }> {
  const params = new URLSearchParams({ page: page.toString(), page_size: '10' });
  const response = await fetch(`${API_URL}/api/certificates/history?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement');
  return response.json();
}

async function generateDocument(employeeId: number, docType: DocType): Promise<Blob> {
  const token = localStorage.getItem('access_token');
  const response = await fetch(
    `${API_URL}/api/certificates/employee/${employeeId}/work-certificate?doc_type=${docType}`,
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
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_COLORS: Record<string, string> = {
  active:     'bg-green-100 text-green-700',
  terminated: 'bg-red-100 text-red-700',
  inactive:   'bg-gray-100 text-gray-600',
  on_leave:   'bg-blue-100 text-blue-700',
  suspended:  'bg-orange-100 text-orange-700',
  probation:  'bg-yellow-100 text-yellow-700',
};

// ============================================
// MODALE SÉLECTION TYPE DE DOCUMENT
// ============================================

function DocTypeModal({
  employee,
  onConfirm,
  onClose,
}: {
  employee: Employee;
  onConfirm: (docType: DocType) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const isFormer = ['terminated', 'inactive'].includes(employee.status);
  const [selected, setSelected] = useState<DocType>(isFormer ? 'certificat' : 'attestation');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">{t.documents.docTypeTitle}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Employé ciblé */}
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mb-5">
          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">
            {employee.first_name[0]}{employee.last_name[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{employee.first_name} {employee.last_name}</p>
            <p className="text-xs text-gray-500">{employee.job_title || '—'} · {employee.employee_id}</p>
          </div>
        </div>

        {/* Choix */}
        <div className="space-y-3 mb-6">
          {/* Attestation */}
          <button
            onClick={() => setSelected('attestation')}
            className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              selected === 'attestation'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              selected === 'attestation' ? 'bg-primary-500' : 'bg-gray-100'
            }`}>
              <FileCheck className={`w-5 h-5 ${selected === 'attestation' ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{t.documents.attestationTitle}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {t.documents.attestationFullDesc}
              </p>
            </div>
          </button>

          {/* Certificat */}
          <button
            onClick={() => setSelected('certificat')}
            className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              selected === 'certificat'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              selected === 'certificat' ? 'bg-primary-500' : 'bg-gray-100'
            }`}>
              <LogOut className={`w-5 h-5 ${selected === 'certificat' ? 'text-white' : 'text-gray-500'}`} />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{t.documents.certificateTitle}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {t.documents.certificateFullDesc}
              </p>
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
          >
            <Download className="w-4 h-4" />
            {t.documents.generate}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function CertificatesPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  // Onglet génération
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);

  // Modale sélection type de document
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Onglet historique
  const [history, setHistory] = useState<CertificateHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const { showTips, dismissTips, resetTips } = usePageTour('certificates');

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const data = await getEmployees(employeePage, searchTerm, statusFilter);
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
    if (activeTab === 'generate') loadEmployees();
    else loadHistory();
  }, [activeTab, loadEmployees, loadHistory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'generate') { setEmployeePage(1); loadEmployees(); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  const handleConfirmGenerate = async (docType: DocType) => {
    if (!selectedEmployee) return;
    const employee = selectedEmployee;
    setSelectedEmployee(null);
    setGeneratingFor(employee.id);
    try {
      const blob = await generateDocument(employee.id, docType);
      const docLabel = docType === 'attestation' ? 'Attestation_Travail' : 'Certificat_Travail';
      const fullName = `${employee.last_name}_${employee.first_name}`.replace(/\s+/g, '_');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docLabel}_${fullName}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.documents.generationError);
    } finally {
      setGeneratingFor(null);
    }
  };

  const totalEmployeePages = Math.ceil(employeeTotal / 10);
  const totalHistoryPages = Math.ceil(historyTotal / 10);

  return (
    <>
      {showTips && (
        <PageTourTips
          pageId="certificates"
          onDismiss={dismissTips}
          pageTitle={t.documents.title}
        />
      )}
      <Header
        title={t.documents.title}
        subtitle={t.documents.subtitle}
      />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto">

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
                    <FileText className="w-4 h-4" />
                    {t.documents.generateDocument}
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
                    {t.documents.historyTab}
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
                <div data-tour="certificates-generate">
                  {/* Info */}
                  <div className="flex gap-4 mb-5">
                    <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
                      <FileCheck className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700">
                        <strong>{t.documents.attestationTitle}</strong> — {t.documents.attestationDesc}
                      </p>
                    </div>
                    <div className="flex-1 bg-orange-50 border border-orange-100 rounded-lg p-3 flex items-start gap-2">
                      <LogOut className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-700">
                        <strong>{t.documents.certificateTitle}</strong> — {t.documents.certificateDesc}
                      </p>
                    </div>
                  </div>

                  {/* Filtres */}
                  <div className="flex gap-3 mb-5 flex-wrap" data-tour="certificates-search">
                    <div className="flex-1 min-w-[220px] relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder={t.documents.searchEmployee}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setEmployeePage(1); }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">{t.documents.allStatusesFilter}</option>
                      <option value="active">{t.documents.activeFilter}</option>
                      <option value="terminated">{t.documents.terminatedFilter}</option>
                      <option value="inactive">{t.documents.inactiveFilter}</option>
                      <option value="on_leave">{t.documents.onLeaveFilter}</option>
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
                      <p className="font-medium">{t.documents.noEmployeeFound}</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.employeeColumn}</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.positionColumn}</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.statusColumn}</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.departureDateColumn}</th>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.actionColumn}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {employees.map((employee) => {
                              const statusColor = STATUS_COLORS[employee.status] || 'bg-gray-100 text-gray-600';
                              const statusLabel = (t.documents.employeeStatuses as Record<string, string>)[employee.status] || employee.status;
                              return (
                                <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs flex-shrink-0">
                                        {employee.first_name[0]}{employee.last_name[0]}
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900 text-sm">{employee.first_name} {employee.last_name}</p>
                                        <p className="text-xs text-gray-400">{employee.employee_id}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3.5 text-sm text-gray-600">{employee.job_title || '—'}</td>
                                  <td className="px-4 py-3.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5">
                                    {employee.end_date ? (
                                      <span className="flex items-center gap-1 text-sm text-gray-500">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(employee.end_date)}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5 text-right">
                                    <button
                                      onClick={() => setSelectedEmployee(employee)}
                                      disabled={generatingFor === employee.id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white text-xs font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {generatingFor === employee.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Download className="w-3.5 h-3.5" />
                                      )}
                                      {t.documents.generate}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {totalEmployeePages > 1 && (
                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                          <p className="text-sm text-gray-500">{employeeTotal} {t.documents.employeeCount}</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEmployeePage(p => Math.max(1, p - 1))}
                              disabled={employeePage === 1}
                              className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-gray-600">
                              {employeePage} / {totalEmployeePages}
                            </span>
                            <button
                              onClick={() => setEmployeePage(p => Math.min(totalEmployeePages, p + 1))}
                              disabled={employeePage === totalEmployeePages}
                              className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
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
                <div data-tour="certificates-history">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-sm text-gray-500">{t.documents.allGeneratedDocs}</p>
                    <button
                      onClick={loadHistory}
                      disabled={loadingHistory}
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                      {t.documents.refresh}
                    </button>
                  </div>

                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>{t.documents.noDocGenerated}</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.referenceColumn}</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.employeeColumn}</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.dateColumn}</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.generatedByColumn}</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.documents.typeColumn}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {history.map((cert) => (
                              <tr key={cert.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3.5">
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                    {cert.reference_number}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-sm text-gray-900">{cert.employee_name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-sm text-gray-600">
                                  {formatDateTime(cert.generated_at)}
                                </td>
                                <td className="px-4 py-3.5 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                    {cert.generated_by}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    cert.generation_type === 'self'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {cert.generation_type === 'self' ? (
                                      <><User className="w-3 h-3" />{t.documents.selfService}</>
                                    ) : (
                                      <><Building2 className="w-3 h-3" />{t.documents.hr}</>
                                    )}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {totalHistoryPages > 1 && (
                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                          <p className="text-sm text-gray-500">{historyTotal} {t.documents.documentCount}</p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                              disabled={historyPage === 1}
                              className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-gray-600">{historyPage} / {totalHistoryPages}</span>
                            <button
                              onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                              disabled={historyPage === totalHistoryPages}
                              className="p-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
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

      {/* Modale sélection type de document */}
      {selectedEmployee && (
        <DocTypeModal
          employee={selectedEmployee}
          onConfirm={handleConfirmGenerate}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </>
  );
}
