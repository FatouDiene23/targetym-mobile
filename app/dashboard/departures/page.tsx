'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import {
  UserMinus, Search, Plus, X, ChevronLeft, ChevronRight, Clock, CheckCircle,
  XCircle, AlertTriangle, Filter, Download, Eye, MoreHorizontal, Calendar,
  Briefcase, FileText, ClipboardCheck, MessageSquare, Users, TrendingDown,
  Star, ThumbsUp, ThumbsDown, ChevronDown, Trash2, Edit2, Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/I18nContext';

// ============================================
// TYPES
// ============================================

interface Departure {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_job_title: string;
  employee_photo_url: string | null;
  employee_department: string;
  employee_hire_date: string | null;
  departure_type: string;
  reason: string | null;
  detailed_reason: string | null;
  legal_reason: string | null;
  notification_date: string | null;
  requested_departure_date: string | null;
  notice_period_days: number;
  notice_end_date: string | null;
  effective_date: string | null;
  last_working_day: string | null;
  status: string;
  leave_balance_days: number;
  leave_compensation_amount: number;
  initiated_by_role: string;
  checklist_total: number;
  checklist_done: number;
  created_at: string | null;
}

interface DepartureDetail extends Departure {
  employee_email: string;
  employee_salary: number;
  employee_currency: string;
  employee_contract_type: string;
  manager_validated_by: number | null;
  manager_validated_at: string | null;
  manager_comment: string | null;
  rh_validated_by: number | null;
  rh_validated_at: string | null;
  rh_comment: string | null;
  direction_validated_by: number | null;
  direction_validated_at: string | null;
  direction_comment: string | null;
  initiated_by: number;
  target_tenant_id: number | null;
  checklist: ChecklistItem[];
  exit_interview: ExitInterview | null;
}

interface ChecklistItem {
  id: number;
  title: string;
  description: string | null;
  category: string;
  assigned_to: string;
  is_completed: boolean;
  completed_by: number | null;
  completed_at: string | null;
  sort_order: number;
  is_required: boolean;
}

interface ExitInterview {
  id: number;
  scheduled_date: string | null;
  scheduled_time: string | null;
  interviewer_id: number | null;
  interviewer_name: string | null;
  location: string | null;
  status: string;
  departure_reason_rating: number | null;
  management_rating: number | null;
  work_environment_rating: number | null;
  career_growth_rating: number | null;
  compensation_rating: number | null;
  primary_departure_reason: string | null;
  would_recommend: boolean | null;
  would_return: boolean | null;
  suggestions: string | null;
  positive_aspects: string | null;
  improvement_areas: string | null;
  additional_notes: string | null;
  completed_at: string | null;
}

interface DepartureStats {
  year: number;
  turnover_rate: number;
  total_departures: number;
  status_counts: Record<string, number>;
  by_type: { type: string; count: number }[];
  monthly: { month: number; count: number }[];
  departure_reasons: { reason: string; count: number }[];
  avg_seniority_years: number;
  total_active_employees: number;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  job_title: string;
  department_name?: string;
  photo_url?: string;
}

// ============================================
// CONSTANTS
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

const DEPARTURE_TYPE_COLORS: Record<string, string> = {
  resignation: 'bg-blue-100 text-blue-800',
  termination: 'bg-red-100 text-red-800',
  mutual_agreement: 'bg-purple-100 text-purple-800',
  retirement: 'bg-amber-100 text-amber-800',
  end_of_contract: 'bg-gray-100 text-gray-800',
  transfer: 'bg-teal-100 text-teal-800',
};

const STATUS_CONFIG_COLORS: Record<string, { color: string; icon: typeof Clock }> = {
  draft: { color: 'bg-gray-100 text-gray-700', icon: Edit2 },
  pending_manager: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  pending_rh: { color: 'bg-orange-100 text-orange-800', icon: Clock },
  pending_direction: { color: 'bg-red-100 text-red-800', icon: Clock },
  validated: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  in_progress: { color: 'bg-blue-100 text-blue-800', icon: ClipboardCheck },
  completed: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  cancelled: { color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

const CHECKLIST_CAT_COLORS: Record<string, string> = {
  equipment: 'text-blue-600',
  access: 'text-red-600',
  documents: 'text-amber-600',
  knowledge: 'text-purple-600',
  hr: 'text-green-600',
  other: 'text-gray-600',
  general: 'text-gray-600',
};

// ============================================
// HELPERS
// ============================================

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR');
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchDepartures(page: number, status?: string, dtype?: string, search?: string) {
  const params = new URLSearchParams({ page: String(page), page_size: '10' });
  if (status) params.set('status', status);
  if (dtype) params.set('departure_type', dtype);
  if (search) params.set('search', search);
  const res = await fetch(`${API_URL}/api/departures/?${params}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

async function fetchDepartureDetail(id: number): Promise<DepartureDetail> {
  const res = await fetch(`${API_URL}/api/departures/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

async function fetchStats(year?: number): Promise<DepartureStats> {
  const params = year ? `?year=${year}` : '';
  const res = await fetch(`${API_URL}/api/departures/stats${params}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Erreur chargement');
  return res.json();
}

async function searchEmployees(query: string): Promise<Employee[]> {
  const res = await fetch(`${API_URL}/api/employees/?search=${encodeURIComponent(query)}&page_size=5`, { headers: getAuthHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || data;
}

async function fetchGroupSubsidiaries(): Promise<Array<{id: number, name: string}>> {
  try {
    const ctxRes = await fetch(`${API_URL}/api/platform/groups/my-context`, { headers: getAuthHeaders() });
    if (!ctxRes.ok) return [];
    const ctx = await ctxRes.json();
    if (ctx.is_group && ctx.subsidiaries?.length > 0) {
      return ctx.subsidiaries.map((s: {id: number, name: string}) => ({ id: s.id, name: s.name }));
    }
    // Pour un utilisateur filiale, récupérer les filiales sœurs + le groupe parent comme destinations
    if (ctx.parent_tenant_id) {
      const subsRes = await fetch(`${API_URL}/api/platform/groups/${ctx.parent_tenant_id}/subsidiaries`, { headers: getAuthHeaders() });
      const sisters: Array<{id: number, name: string}> = [];
      if (subsRes.ok) {
        const subs = await subsRes.json();
        const list = subs.subsidiaries || subs;
        sisters.push(
          ...list
            .filter((s: {id: number}) => s.id !== ctx.tenant_id)
            .map((s: {id: number, name: string}) => ({ id: s.id, name: s.name }))
        );
      }
      // Ajouter le tenant groupe lui-même en tête de liste
      const groupName = ctx.parent_tenant_name || `Groupe (${ctx.parent_tenant_id})`;
      return [{ id: ctx.parent_tenant_id, name: groupName }, ...sisters];
    }
    return [];
  } catch {
    return [];
  }
}

// ============================================
// COMPONENT
// ============================================

export default function DeparturesPage() {
  const { t } = useI18n();
  // Tabs
  const [activeTab, setActiveTab] = useState<'en_cours' | 'historique' | 'statistiques'>('en_cours');

  // List state
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Detail panel
  const [selectedDep, setSelectedDep] = useState<DepartureDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'checklist' | 'entretien' | 'documents'>('details');
  const [detailLoading, setDetailLoading] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createLoading, setCreateLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeResults, setEmployeeResults] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formType, setFormType] = useState('resignation');
  const [formReason, setFormReason] = useState('');
  const [formDetailedReason, setFormDetailedReason] = useState('');
  const [formLegalReason, setFormLegalReason] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTargetTenantId, setFormTargetTenantId] = useState<number | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<Array<{id: number, name: string}>>([]);

  // Validation modal
  const [showValidation, setShowValidation] = useState<{ id: number; type: string } | null>(null);
  const [validationComment, setValidationComment] = useState('');
  const [validationLoading, setValidationLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<DepartureStats | null>(null);

  // Exit interview
  const [interviewForm, setInterviewForm] = useState<Partial<ExitInterview>>({});
  const [showInterviewPlan, setShowInterviewPlan] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');

  // Listen for header add button
  useEffect(() => {
    const handler = () => setShowCreate(true);
    window.addEventListener('departures-add', handler);
    return () => window.removeEventListener('departures-add', handler);
  }, []);

  // Load subsidiaries when create modal opens (for transfer type)
  useEffect(() => {
    if (showCreate) {
      fetchGroupSubsidiaries().then(setSubsidiaries);
    }
  }, [showCreate]);

  // Load data
  const loadDepartures = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilter = activeTab === 'en_cours'
        ? (filterStatus || undefined)
        : (activeTab === 'historique' ? (filterStatus || undefined) : undefined);
      const data = await fetchDepartures(page, statusFilter, filterType || undefined, searchTerm || undefined);
      setDepartures(data.items);
      setTotal(data.total);
    } catch {
      toast.error(t.departures.loadError);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterType, filterStatus, activeTab]);

  useEffect(() => { loadDepartures(); }, [loadDepartures]);

  useEffect(() => {
    if (activeTab === 'statistiques') {
      fetchStats().then(setStats).catch(() => toast.error(t.departures.statsLoadError));
    }
  }, [activeTab]);

  // Employee search debounce
  useEffect(() => {
    if (employeeSearch.length < 2) { setEmployeeResults([]); return; }
    const t = setTimeout(async () => {
      const results = await searchEmployees(employeeSearch);
      setEmployeeResults(results);
    }, 300);
    return () => clearTimeout(t);
  }, [employeeSearch]);

  // Load detail
  const openDetail = async (dep: Departure) => {
    setDetailLoading(true);
    setDetailTab('details');
    try {
      const detail = await fetchDepartureDetail(dep.id);
      setSelectedDep(detail);
    } catch {
      toast.error(t.departures.detailLoadError);
    } finally {
      setDetailLoading(false);
    }
  };

  // Create departure
  const handleCreate = async () => {
    if (!selectedEmployee || !formDate) return;
    if (formType === 'transfer' && !formTargetTenantId) {
      toast.error(t.departures.selectDestination);
      return;
    }
    setCreateLoading(true);
    try {
      const body: Record<string, unknown> = {
        employee_id: selectedEmployee.id,
        departure_type: formType,
        reason: formReason || null,
        detailed_reason: formDetailedReason || null,
        requested_departure_date: formDate,
      };
      if (formType === 'termination') body.legal_reason = formLegalReason;
      if (formType === 'transfer' && formTargetTenantId) body.target_tenant_id = formTargetTenantId;

      const res = await fetch(`${API_URL}/api/departures/`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erreur création');
      }

      toast.success(t.departures.transferCreated);

      setShowCreate(false);
      resetCreateForm();
      loadDepartures();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.departures.creationError);
    } finally {
      setCreateLoading(false);
    }
  };

  const resetCreateForm = () => {
    setCreateStep(1);
    setSelectedEmployee(null);
    setEmployeeSearch('');
    setFormType('resignation');
    setFormReason('');
    setFormDetailedReason('');
    setFormLegalReason('');
    setFormDate('');
    setFormTargetTenantId(null);
  };

  // Validate
  const handleValidate = async (approved: boolean) => {
    if (!showValidation) return;
    setValidationLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/departures/${showValidation.id}/validate-${showValidation.type}`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ approved, comment: validationComment || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erreur validation');
      }
      toast.success(approved ? t.departures.departureValidated : t.departures.departureRefused);
      setShowValidation(null);
      setValidationComment('');
      loadDepartures();
      if (selectedDep && selectedDep.id === showValidation.id) {
        openDetail(selectedDep as Departure);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.departures.validationError);
    } finally {
      setValidationLoading(false);
    }
  };

  // Toggle checklist
  const toggleChecklistItem = async (itemId: number) => {
    if (!selectedDep) return;
    try {
      const res = await fetch(`${API_URL}/api/departures/${selectedDep.id}/checklist/${itemId}`, {
        method: 'PUT', headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error();
      // Refresh detail
      const detail = await fetchDepartureDetail(selectedDep.id);
      setSelectedDep(detail);
      loadDepartures();
    } catch {
      toast.error(t.departures.checklistUpdateError);
    }
  };

  // Complete departure
  const handleComplete = async () => {
    if (!selectedDep) return;
    try {
      const res = await fetch(`${API_URL}/api/departures/${selectedDep.id}/complete`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erreur clôture');
      }
      toast.success(t.departures.departureClosed);
      setSelectedDep(null);
      loadDepartures();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.departures.closureError);
    }
  };

  // Execute inter-subsidiary transfer
  const handleExecuteTransfer = async () => {
    if (!selectedDep || !selectedDep.target_tenant_id) return;
    try {
      const res = await fetch(`${API_URL}/api/departures/${selectedDep.id}/execute-transfer`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          target_tenant_id: selectedDep.target_tenant_id,
          transfer_date: selectedDep.effective_date,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erreur lors du transfert');
      }
      const data = await res.json();
      toast.success(data.message || t.departures.transferCreated);
      setSelectedDep(null);
      loadDepartures();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.departures.transferError);
    }
  };

  // Cancel departure
  const handleCancel = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/departures/${id}/cancel`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Erreur annulation');
      }
      toast.success(t.departures.departureCancelled);
      setSelectedDep(null);
      loadDepartures();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.departures.cancellationError);
    }
  };

  // Plan exit interview
  const handlePlanInterview = async () => {
    if (!selectedDep || !interviewDate) return;
    try {
      const res = await fetch(`${API_URL}/api/departures/${selectedDep.id}/exit-interview`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({
          scheduled_date: interviewDate,
          scheduled_time: interviewTime || null,
          location: interviewLocation || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t.departures.interviewPlannedSuccess);
      setShowInterviewPlan(false);
      openDetail(selectedDep as Departure);
    } catch {
      toast.error(t.departures.interviewPlanError);
    }
  };

  // Save exit interview questionnaire
  const handleSaveInterview = async () => {
    if (!selectedDep) return;
    try {
      const res = await fetch(`${API_URL}/api/departures/${selectedDep.id}/exit-interview`, {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({ ...interviewForm, status: 'completed' }),
      });
      if (!res.ok) throw new Error();
      toast.success(t.departures.questionnaireSaved);
      openDetail(selectedDep as Departure);
    } catch {
      toast.error(t.departures.saveError);
    }
  };

  // Generate settlement PDF
  const handleGenerateSettlement = async () => {
    if (!selectedDep) return;
    try {
      const res = await fetch(`${API_URL}/api/departures/${selectedDep.id}/generate-settlement`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solde_tout_compte_${selectedDep.employee_name.replace(/ /g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t.departures.pdfGenerated);
    } catch {
      toast.error(t.departures.pdfGenerationError);
    }
  };

  // Generate certificate (redirect)
  const handleGenerateCertificate = async () => {
    if (!selectedDep) return;
    try {
      const res = await fetch(`${API_URL}/api/certificates/employee/${selectedDep.employee_id}/work-certificate?doc_type=certificat`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificat_travail_${selectedDep.employee_name.replace(/ /g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t.departures.certificateGenerated);
    } catch {
      toast.error(t.departures.certificateGenerationError);
    }
  };

  const totalPages = Math.ceil(total / 10);

  // Filter departures by tab context
  const activeStatuses = activeTab === 'en_cours'
    ? ['draft', 'pending_manager', 'pending_rh', 'pending_direction', 'validated', 'in_progress']
    : ['completed', 'cancelled'];

  const filteredDepartures = departures.filter(d =>
    activeTab === 'statistiques' ? true : activeStatuses.includes(d.status)
  );

  // Stats cards
  const inProgress = departures.filter(d => ['validated', 'in_progress'].includes(d.status)).length;
  const pendingValidation = departures.filter(d => d.status.startsWith('pending_')).length;
  const thisMonth = departures.filter(d => {
    if (!d.created_at) return false;
    const m = new Date(d.created_at);
    const now = new Date();
    return m.getMonth() === now.getMonth() && m.getFullYear() === now.getFullYear();
  }).length;

  // ============================================
  // RENDER
  // ============================================

  const renderStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG_COLORS[status] || STATUS_CONFIG_COLORS.draft;
    const Icon = cfg.icon;
    const label = (t.departures.statuses as Record<string, string>)[status] || status;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
    );
  };

  const renderTypeBadge = (type: string) => {
    const color = DEPARTURE_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700';
    const label = (t.departures.types as Record<string, string>)[type] || type;
    return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>{label}</span>;
  };

  // Render tabs
  const tabs = [
    { id: 'en_cours' as const, label: t.departures.departuresInProgressTab, icon: Clock },
    { id: 'historique' as const, label: t.departures.history, icon: FileText },
    { id: 'statistiques' as const, label: t.departures.statistics, icon: TrendingDown },
  ];

  return (
    <>
      <Header title={t.departures.title} subtitle={t.departures.subtitle} />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t.departures.totalInProgress}</p>
                <p className="text-2xl font-bold text-gray-900">{total}</p>
              </div>
              <div className="p-3 bg-primary-50 rounded-xl"><UserMinus className="w-6 h-6 text-primary-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t.departures.pendingValidation}</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingValidation}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-xl"><Clock className="w-6 h-6 text-yellow-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t.departures.checklistInProgress}</p>
                <p className="text-2xl font-bold text-primary-600">{inProgress}</p>
              </div>
              <div className="p-3 bg-primary-50 rounded-xl"><ClipboardCheck className="w-6 h-6 text-primary-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{t.departures.departuresThisMonth}</p>
                <p className="text-2xl font-bold text-gray-900">{thisMonth}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl"><Calendar className="w-6 h-6 text-gray-600" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPage(1); setSelectedDep(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab !== 'statistiques' ? (
          <div className={`flex gap-6 ${selectedDep ? '' : ''}`}>
            {/* Main table */}
            <div className={`${selectedDep ? 'w-1/2' : 'w-full'} transition-all`}>
              {/* Filters */}
              <div className="bg-white rounded-xl border p-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t.departures.searchCollaborator}
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <select
                    value={filterType}
                    onChange={e => { setFilterType(e.target.value); setPage(1); }}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">{t.departures.allTypes}</option>
                    {Object.keys(DEPARTURE_TYPE_COLORS).map(k => (
                      <option key={k} value={k}>{(t.departures.types as Record<string, string>)[k] || k}</option>
                    ))}
                  </select>
                  {activeTab === 'en_cours' && (
                    <select
                      value={filterStatus}
                      onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                      className="border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">{t.departures.allStatuses}</option>
                      <option value="pending_manager">{t.departures.statusFilterOptions.pending_manager}</option>
                      <option value="pending_rh">{t.departures.statusFilterOptions.pending_rh}</option>
                      <option value="pending_direction">{t.departures.statusFilterOptions.pending_direction}</option>
                      <option value="validated">{t.departures.statusFilterOptions.validated}</option>
                      <option value="in_progress">{t.departures.statusFilterOptions.in_progress}</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
                  </div>
                ) : filteredDepartures.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    <UserMinus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">{t.departures.noDepartureFound}</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.departures.collaborator}</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.departures.type}</th>
                        {!selectedDep && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.departures.effectiveDate}</th>}
                        {!selectedDep && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.departures.checklist}</th>}
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.common.status}</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{t.common.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredDepartures.map(dep => (
                        <tr
                          key={dep.id}
                          onClick={() => openDetail(dep)}
                          className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedDep?.id === dep.id ? 'bg-primary-50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {dep.employee_photo_url ? (
                                <img src={dep.employee_photo_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                  {getInitials(dep.employee_name)}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-900">{dep.employee_name}</p>
                                <p className="text-xs text-gray-500">{dep.employee_job_title}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{renderTypeBadge(dep.departure_type)}</td>
                          {!selectedDep && (
                            <td className="px-4 py-3 text-sm text-gray-600">{formatDate(dep.effective_date)}</td>
                          )}
                          {!selectedDep && (
                            <td className="px-4 py-3">
                              {dep.checklist_total > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-green-500 rounded-full transition-all"
                                      style={{ width: `${(dep.checklist_done / dep.checklist_total) * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500">{dep.checklist_done}/{dep.checklist_total}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3">{renderStatusBadge(dep.status)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                              {dep.status === 'pending_manager' && (
                                <button
                                  onClick={() => setShowValidation({ id: dep.id, type: 'manager' })}
                                  className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg" title={t.departures.validateManagerBtn}
                                ><CheckCircle className="w-4 h-4" /></button>
                              )}
                              {dep.status === 'pending_rh' && (
                                <button
                                  onClick={() => setShowValidation({ id: dep.id, type: 'rh' })}
                                  className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg" title={t.departures.validateRHBtn}
                                ><CheckCircle className="w-4 h-4" /></button>
                              )}
                              {dep.status === 'pending_direction' && (
                                <button
                                  onClick={() => setShowValidation({ id: dep.id, type: 'direction' })}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title={t.departures.validateDirectionBtn}
                                ><CheckCircle className="w-4 h-4" /></button>
                              )}
                              {!['completed', 'cancelled'].includes(dep.status) && (
                                <button
                                  onClick={() => handleCancel(dep.id)}
                                  className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg" title={t.common.cancel}
                                ><Ban className="w-4 h-4" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-gray-500">{total} {t.departures.results}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm">{page} / {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Detail Panel */}
            {selectedDep && (
              <div className="w-1/2 bg-white rounded-xl border overflow-hidden">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="p-4 border-b bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {selectedDep.employee_photo_url ? (
                            <img src={selectedDep.employee_photo_url} className="w-12 h-12 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                              {getInitials(selectedDep.employee_name)}
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-gray-900">{selectedDep.employee_name}</h3>
                            <p className="text-sm text-gray-500">{selectedDep.employee_job_title} — {selectedDep.employee_department}</p>
                            {selectedDep.employee_hire_date && (
                              <p className="text-xs text-gray-400">{t.departures.hiredOn} {formatDate(selectedDep.employee_hire_date)}</p>
                            )}
                          </div>
                        </div>
                        <button onClick={() => setSelectedDep(null)} className="p-1.5 hover:bg-gray-200 rounded-lg">
                          <X className="w-5 h-5 text-gray-400" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {renderTypeBadge(selectedDep.departure_type)}
                        {renderStatusBadge(selectedDep.status)}
                      </div>
                    </div>

                    {/* Detail tabs */}
                    <div className="flex border-b">
                      {([
                        { id: 'details' as const, label: t.departures.details, icon: FileText },
                        { id: 'checklist' as const, label: t.departures.checklist, icon: ClipboardCheck },
                        { id: 'entretien' as const, label: t.departures.interview, icon: MessageSquare },
                        { id: 'documents' as const, label: t.departures.documents, icon: FileText },
                      ]).map(t => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setDetailTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                              detailTab === t.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <Icon className="w-4 h-4" /> {t.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Detail content */}
                    <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                      {detailTab === 'details' && renderDetailTab()}
                      {detailTab === 'checklist' && renderChecklistTab()}
                      {detailTab === 'entretien' && renderInterviewTab()}
                      {detailTab === 'documents' && renderDocumentsTab()}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          renderStatsTab()
        )}
      </div>

      {/* Create Modal */}
      {showCreate && renderCreateModal()}

      {/* Validation Modal */}
      {showValidation && renderValidationModal()}
    </>
  );

  // ============================================
  // TAB RENDERERS
  // ============================================

  function renderDetailTab() {
    if (!selectedDep) return null;
    return (
      <div className="space-y-4">
        {/* Validation timeline */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">{t.departures.validationProcess}</h4>
          <div className="space-y-2">
            {selectedDep.initiated_by_role === 'employee' && (
              <>
                <ValidationStep label={t.departures.validationManager} done={!!selectedDep.manager_validated_at}
                  date={selectedDep.manager_validated_at} comment={selectedDep.manager_comment}
                  active={selectedDep.status === 'pending_manager'} />
                <ValidationStep label={t.departures.validationRH} done={!!selectedDep.rh_validated_at}
                  date={selectedDep.rh_validated_at} comment={selectedDep.rh_comment}
                  active={selectedDep.status === 'pending_rh'} />
              </>
            )}
            {selectedDep.initiated_by_role === 'manager' && (
              <ValidationStep label={t.departures.validationRH} done={!!selectedDep.rh_validated_at}
                date={selectedDep.rh_validated_at} comment={selectedDep.rh_comment}
                active={selectedDep.status === 'pending_rh'} />
            )}
            {selectedDep.departure_type === 'termination' && (
              <ValidationStep label={t.departures.validationDirection} done={!!selectedDep.direction_validated_at}
                date={selectedDep.direction_validated_at} comment={selectedDep.direction_comment}
                active={selectedDep.status === 'pending_direction'} />
            )}
          </div>
        </div>

        <hr />

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          <InfoCard label={t.departures.notificationDate} value={formatDate(selectedDep.notification_date)} />
          <InfoCard label={t.departures.requestedDate} value={formatDate(selectedDep.requested_departure_date)} />
          <InfoCard label={t.departures.noticePeriod} value={`${selectedDep.notice_period_days} ${t.departures.days}`} />
          <InfoCard label={t.departures.noticeEnd} value={formatDate(selectedDep.notice_end_date)} />
          <InfoCard label={t.departures.effectiveDate} value={formatDate(selectedDep.effective_date)} />
          <InfoCard label={t.departures.lastWorkingDay} value={formatDate(selectedDep.last_working_day)} />
        </div>

        <hr />

        {/* Leave & compensation */}
        <div className="bg-primary-50 rounded-lg p-3 space-y-2">
          <h4 className="text-sm font-semibold text-primary-900">{t.departures.leaveBalance}</h4>
          <div className="flex justify-between text-sm">
            <span className="text-primary-700">{t.departures.remainingDays}</span>
            <span className="font-medium text-primary-900">{selectedDep.leave_balance_days} {t.departures.days}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-primary-700">{t.departures.compensationAllowance}</span>
            <span className="font-medium text-primary-900">{selectedDep.leave_compensation_amount.toLocaleString()} {selectedDep.employee_currency}</span>
          </div>
        </div>

        {selectedDep.reason && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">{t.departures.motif}</h4>
            <p className="text-sm text-gray-600">{selectedDep.reason}</p>
          </div>
        )}
        {selectedDep.legal_reason && (
          <div className="bg-red-50 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-red-900 mb-1">{t.departures.legalMotif}</h4>
            <p className="text-sm text-red-700">{selectedDep.legal_reason}</p>
          </div>
        )}
        {selectedDep.detailed_reason && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-1">{t.departures.details}</h4>
            <p className="text-sm text-gray-600">{selectedDep.detailed_reason}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedDep.status === 'pending_manager' && (
            <button onClick={() => setShowValidation({ id: selectedDep.id, type: 'manager' })}
              className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600">
              {t.departures.validateManagerBtn}
            </button>
          )}
          {selectedDep.status === 'pending_rh' && (
            <button onClick={() => setShowValidation({ id: selectedDep.id, type: 'rh' })}
              className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
              {t.departures.validateRHBtn}
            </button>
          )}
          {selectedDep.status === 'pending_direction' && (
            <button onClick={() => setShowValidation({ id: selectedDep.id, type: 'direction' })}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600">
              {t.departures.validateDirectionBtn}
            </button>
          )}
          {['validated', 'in_progress'].includes(selectedDep.status) && selectedDep.departure_type !== 'transfer' && (
            <button onClick={handleComplete}
              className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600">
              {t.departures.closeDeparture}
            </button>
          )}
          {['validated', 'in_progress'].includes(selectedDep.status) && selectedDep.departure_type === 'transfer' && (
            <button onClick={handleExecuteTransfer}
              className="px-3 py-1.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600">
              {t.departures.executeTransfer}
            </button>
          )}
          {!['completed', 'cancelled'].includes(selectedDep.status) && (
            <button onClick={() => handleCancel(selectedDep.id)}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
              {t.common.cancel}
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderChecklistTab() {
    if (!selectedDep) return null;
    const items = selectedDep.checklist;
    const totalItems = items.length;
    const doneItems = items.filter(i => i.is_completed).length;
    const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    // Group by category
    const grouped: Record<string, ChecklistItem[]> = {};
    items.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    return (
      <div className="space-y-4">
        {/* Progress */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{t.departures.progression}</span>
            <span className="text-sm font-bold text-gray-900">{doneItems}/{totalItems} ({progress}%)</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {totalItems === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">{t.departures.checklistGeneratedOnValidation}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat}>
              <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${CHECKLIST_CAT_COLORS[cat] || 'text-gray-600'}`}>
                {(t.departures.checklistCategories as Record<string, string>)[cat] || cat}
              </h4>
              <div className="space-y-1">
                {catItems.map(item => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      item.is_completed ? 'bg-green-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${item.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.departures.assigned} : {item.assigned_to.toUpperCase()}
                        {item.is_required && <span className="ml-2 text-red-400">{t.departures.required}</span>}
                        {item.completed_at && <span className="ml-2">- {t.departures.doneOn} {formatDate(item.completed_at)}</span>}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  function renderInterviewTab() {
    if (!selectedDep) return null;
    const interview = selectedDep.exit_interview;

    if (!interview) {
      return (
        <div className="space-y-4">
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm mb-3">{t.departures.noExitInterview}</p>
            <button onClick={() => setShowInterviewPlan(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">
              {t.departures.planInterview}
            </button>
          </div>

          {showInterviewPlan && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold">{t.departures.planTheInterview}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">{t.departures.date}</label>
                  <input type="date" value={interviewDate} onChange={e => setInterviewDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{t.departures.time}</label>
                  <input type="time" value={interviewTime} onChange={e => setInterviewTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">{t.departures.location}</label>
                <input type="text" value={interviewLocation} onChange={e => setInterviewLocation(e.target.value)}
                  placeholder={t.departures.locationPlaceholder}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1" />
              </div>
              <div className="flex gap-2">
                <button onClick={handlePlanInterview}
                  className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600">{t.departures.plan}</button>
                <button onClick={() => setShowInterviewPlan(false)}
                  className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">{t.common.cancel}</button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Interview exists
    return (
      <div className="space-y-4">
        <div className="bg-primary-50 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary-900">{t.departures.interviewPlanned}</p>
            <p className="text-xs text-primary-700">
              {formatDate(interview.scheduled_date)} {interview.scheduled_time ? `à ${interview.scheduled_time}` : ''}
              {interview.location ? ` — ${interview.location}` : ''}
            </p>
          </div>
          {renderStatusBadge(interview.status)}
        </div>

        {interview.status === 'planned' || interview.status === 'completed' ? (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900">{t.departures.exitQuestionnaire}</h4>

            {/* Ratings */}
            <div className="space-y-3">
              {[
                { key: 'departure_reason_rating', label: t.departures.overallSatisfaction },
                { key: 'management_rating', label: t.departures.managementRating },
                { key: 'work_environment_rating', label: t.departures.workEnvironment },
                { key: 'career_growth_rating', label: t.departures.careerGrowth },
                { key: 'compensation_rating', label: t.departures.compensationRating },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500">{label}</label>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(n => {
                      const val = (interviewForm[key as keyof typeof interviewForm] ?? interview[key as keyof ExitInterview]) as number | null;
                      return (
                        <button
                          key={n}
                          onClick={() => setInterviewForm(prev => ({ ...prev, [key]: n }))}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                            val === n
                              ? 'bg-primary-500 text-white'
                              : val !== null && val >= n
                                ? 'bg-primary-200 text-primary-800'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Primary reason */}
            <div>
              <label className="text-xs text-gray-500">{t.departures.primaryDepartureReason}</label>
              <select
                value={(interviewForm.primary_departure_reason ?? interview.primary_departure_reason) || ''}
                onChange={e => setInterviewForm(prev => ({ ...prev, primary_departure_reason: e.target.value }))}
                className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1"
              >
                <option value="">{t.departures.selectOption}</option>
                {Object.keys(t.departures.departureReasons).map(k => (
                  <option key={k} value={k}>{(t.departures.departureReasons as Record<string, string>)[k]}</option>
                ))}
              </select>
            </div>

            {/* Boolean questions */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">{t.departures.wouldRecommend}</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setInterviewForm(prev => ({ ...prev, would_recommend: true }))}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                      (interviewForm.would_recommend ?? interview.would_recommend) === true ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}><ThumbsUp className="w-3.5 h-3.5" /> {t.common.yes}</button>
                  <button onClick={() => setInterviewForm(prev => ({ ...prev, would_recommend: false }))}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                      (interviewForm.would_recommend ?? interview.would_recommend) === false ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'
                    }`}><ThumbsDown className="w-3.5 h-3.5" /> {t.common.no}</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">{t.departures.wouldReturn}</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setInterviewForm(prev => ({ ...prev, would_return: true }))}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                      (interviewForm.would_return ?? interview.would_return) === true ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}><ThumbsUp className="w-3.5 h-3.5" /> {t.common.yes}</button>
                  <button onClick={() => setInterviewForm(prev => ({ ...prev, would_return: false }))}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                      (interviewForm.would_return ?? interview.would_return) === false ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'
                    }`}><ThumbsDown className="w-3.5 h-3.5" /> {t.common.no}</button>
                </div>
              </div>
            </div>

            {/* Text fields */}
            {[
              { key: 'positive_aspects', label: t.departures.positiveAspects },
              { key: 'improvement_areas', label: t.departures.improvementAreas },
              { key: 'suggestions', label: t.departures.suggestions },
              { key: 'additional_notes', label: t.departures.additionalNotes },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <textarea
                  value={(interviewForm[key as keyof typeof interviewForm] as string) ?? (interview[key as keyof ExitInterview] as string) ?? ''}
                  onChange={e => setInterviewForm(prev => ({ ...prev, [key]: e.target.value }))}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm mt-1 resize-none"
                />
              </div>
            ))}

            <button onClick={handleSaveInterview}
              className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">
              {t.departures.saveQuestionnaire}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderDocumentsTab() {
    if (!selectedDep) return null;
    return (
      <div className="space-y-4">
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">{t.departures.generateDocuments}</h4>

          <button onClick={handleGenerateCertificate}
            className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors text-left">
            <div className="p-2 bg-primary-50 rounded-lg"><FileText className="w-5 h-5 text-primary-600" /></div>
            <div>
              <p className="text-sm font-medium text-gray-900">{t.departures.workCertificate}</p>
              <p className="text-xs text-gray-500">{t.departures.workCertificateDesc}</p>
            </div>
            <Download className="w-4 h-4 text-gray-400 ml-auto" />
          </button>

          <button onClick={handleGenerateSettlement}
            className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors text-left">
            <div className="p-2 bg-green-50 rounded-lg"><FileText className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-sm font-medium text-gray-900">{t.departures.settlement}</p>
              <p className="text-xs text-gray-500">{t.departures.settlementDesc.replace('{days}', String(selectedDep.leave_balance_days))}</p>
            </div>
            <Download className="w-4 h-4 text-gray-400 ml-auto" />
          </button>
        </div>

        <div className="bg-amber-50 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            {t.departures.documentWarning}
          </p>
        </div>
      </div>
    );
  }

  function renderStatsTab() {
    if (!stats) return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );

    const maxMonthly = Math.max(...stats.monthly.map(m => m.count), 1);
    const maxType = Math.max(...stats.by_type.map(t => t.count), 1);

    return (
      <div className="space-y-6">
        {/* Key metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">{t.departures.turnoverRate}</p>
            <p className="text-3xl font-bold text-red-600">{stats.turnover_rate}%</p>
            <p className="text-xs text-gray-400 mt-1">{stats.year}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">{t.departures.totalDepartures}</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total_departures}</p>
            <p className="text-xs text-gray-400 mt-1">{t.departures.onActiveEmployees.replace('{count}', String(stats.total_active_employees))}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">{t.departures.avgSeniority}</p>
            <p className="text-3xl font-bold text-gray-900">{stats.avg_seniority_years} {t.departures.years}</p>
          </div>
          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-gray-500">{t.departures.interviewReasons}</p>
            <p className="text-3xl font-bold text-gray-900">{stats.departure_reasons.length}</p>
            <p className="text-xs text-gray-400 mt-1">{t.departures.distinctCategories}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly evolution */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.departures.monthlyEvolution}</h3>
            <div className="flex items-end gap-2 h-40">
              {Array.from({ length: 12 }, (_, i) => {
                const m = stats.monthly.find(x => x.month === i + 1);
                const count = m?.count || 0;
                const height = maxMonthly > 0 ? (count / maxMonthly) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500">{count || ''}</span>
                    <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '120px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-primary-500 rounded-t transition-all"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{t.departures.monthNames[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By type */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.departures.distributionByType}</h3>
            <div className="space-y-3">
              {stats.by_type.map(bt => {
                const color = DEPARTURE_TYPE_COLORS[bt.type] || 'bg-gray-100 text-gray-700';
                const label = (t.departures.types as Record<string, string>)[bt.type] || bt.type;
                const pct = Math.round((bt.count / Math.max(stats.total_departures, 1)) * 100);
                return (
                  <div key={bt.type} className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color} w-36 text-center`}>{label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-12 text-right">{bt.count}</span>
                  </div>
                );
              })}
              {stats.by_type.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">{t.departures.noData}</p>
              )}
            </div>
          </div>

          {/* Departure reasons */}
          <div className="bg-white rounded-xl border p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.departures.mainDepartureReasons}</h3>
            {stats.departure_reasons.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {stats.departure_reasons.map(r => (
                  <div key={r.reason} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{r.count}</p>
                    <p className="text-xs text-gray-500 mt-1">{(t.departures.departureReasons as Record<string, string>)[r.reason] || r.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">{t.departures.noCompletedInterview}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // MODALS
  // ============================================

  function renderCreateModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => { setShowCreate(false); resetCreateForm(); }} />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-lg font-semibold">{t.departures.newDeparture}</h2>
            <button onClick={() => { setShowCreate(false); resetCreateForm(); }}
              className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-5 space-y-4">
            {/* Steps indicator */}
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= createStep ? 'bg-primary-500' : 'bg-gray-200'}`} />
              ))}
            </div>

            {createStep === 1 && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">{t.departures.selectCollaborator}</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t.departures.searchByName}
                    value={employeeSearch}
                    onChange={e => setEmployeeSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm"
                  />
                </div>
                {selectedEmployee && (
                  <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
                    <div className="w-10 h-10 rounded-full bg-primary-200 flex items-center justify-center text-sm font-bold text-primary-700">
                      {getInitials(`${selectedEmployee.first_name} ${selectedEmployee.last_name}`)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                      <p className="text-xs text-gray-500">{selectedEmployee.job_title}</p>
                    </div>
                    <button onClick={() => setSelectedEmployee(null)} className="text-primary-500 hover:text-primary-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {!selectedEmployee && employeeResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                    {employeeResults.map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => { setSelectedEmployee(emp); setEmployeeSearch(''); setEmployeeResults([]); }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                          {getInitials(`${emp.first_name} ${emp.last_name}`)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-gray-500">{emp.job_title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {createStep === 2 && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">{t.departures.typeAndReason}</h3>
                <div>
                  <label className="text-sm text-gray-600">{t.departures.departureType}</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    {Object.keys(DEPARTURE_TYPE_COLORS).map(k => (
                      <option key={k} value={k}>{(t.departures.types as Record<string, string>)[k] || k}</option>
                    ))}
                  </select>
                </div>
                {formType === 'termination' && (
                  <div>
                    <label className="text-sm text-gray-600">{t.departures.legalReason} <span className="text-red-500">*</span></label>
                    <textarea value={formLegalReason} onChange={e => setFormLegalReason(e.target.value)}
                      placeholder={t.departures.legalReasonPlaceholder}
                      rows={2} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 resize-none" />
                  </div>
                )}
                {formType === 'transfer' && (
                  <div>
                    <label className="text-sm text-gray-600">{t.departures.destinationSubsidiary} <span className="text-red-500">*</span></label>
                    {subsidiaries.length === 0 ? (
                      <p className="text-xs text-amber-600 mt-1 p-2 bg-amber-50 rounded-lg">
                        {t.departures.noSubsidiaryAvailable}
                      </p>
                    ) : (
                      <select
                        value={formTargetTenantId ?? ''}
                        onChange={e => setFormTargetTenantId(Number(e.target.value) || null)}
                        className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                      >
                        <option value="">{t.departures.selectSubsidiary}</option>
                        {subsidiaries.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-600">{t.departures.reason}</label>
                  <input type="text" value={formReason} onChange={e => setFormReason(e.target.value)}
                    placeholder={t.departures.reasonPlaceholder} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">{t.departures.additionalDetails}</label>
                  <textarea value={formDetailedReason} onChange={e => setFormDetailedReason(e.target.value)}
                    rows={2} className="w-full border rounded-lg px-3 py-2 text-sm mt-1 resize-none" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">{t.departures.requestedDepartureDate} <span className="text-red-500">*</span></label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
              </div>
            )}

            {createStep === 3 && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">{t.departures.summaryStep}</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t.departures.collaborator}</span>
                    <span className="font-medium">{selectedEmployee?.first_name} {selectedEmployee?.last_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t.departures.type}</span>
                    <span>{renderTypeBadge(formType)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t.departures.requestedDate}</span>
                    <span className="font-medium">{formDate ? formatDate(formDate) : '-'}</span>
                  </div>
                  {formType === 'transfer' && formTargetTenantId && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t.departures.destinationSubsidiary}</span>
                      <span className="font-medium text-teal-700">{subsidiaries.find(s => s.id === formTargetTenantId)?.name}</span>
                    </div>
                  )}
                  {formReason && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t.departures.motif}</span>
                      <span>{formReason}</span>
                    </div>
                  )}
                </div>
                <div className="bg-primary-50 rounded-lg p-3">
                  <p className="text-xs text-primary-700">
                    {formType === 'transfer'
                      ? t.departures.transferNote.replace('{subsidiary}', subsidiaries.find(s => s.id === formTargetTenantId)?.name ?? '')
                      : formType === 'termination'
                      ? t.departures.terminationNote
                      : t.departures.defaultNote}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-5 border-t">
            <button
              onClick={() => createStep > 1 ? setCreateStep(s => s - 1) : (setShowCreate(false), resetCreateForm())}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              {createStep > 1 ? t.common.previous : t.common.cancel}
            </button>
            {createStep < 3 ? (
              <button
                onClick={() => setCreateStep(s => s + 1)}
                disabled={
                  (createStep === 1 && !selectedEmployee) ||
                  (createStep === 2 && formType === 'transfer' && !formTargetTenantId) ||
                  (createStep === 2 && !formDate)
                }
                className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {t.common.next}
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={createLoading || !formDate}
                className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                {createLoading ? t.departures.creating : t.departures.createDeparture}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderValidationModal() {
    if (!showValidation) return null;
    const typeLabel = showValidation.type === 'manager' ? 'Manager' : showValidation.type === 'rh' ? 'RH' : 'Direction';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowValidation(null)} />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
          <div className="p-5 border-b">
            <h2 className="text-lg font-semibold">{t.departures.validation} {typeLabel}</h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-600">{t.departures.approveOrReject}</p>
            <div>
              <label className="text-sm text-gray-500">{t.departures.commentOptional}</label>
              <textarea
                value={validationComment}
                onChange={e => setValidationComment(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 resize-none"
                placeholder={t.departures.addComment}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 p-5 border-t">
            <button onClick={() => setShowValidation(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">{t.common.cancel}</button>
            <button onClick={() => handleValidate(false)} disabled={validationLoading}
              className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50">
              {t.departures.refuse}
            </button>
            <button onClick={() => handleValidate(true)} disabled={validationLoading}
              className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50">
              {validationLoading ? t.departures.validating : t.common.approve}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ValidationStep({ label, done, date, comment, active }: {
  label: string; done: boolean; date: string | null; comment: string | null; active: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={`flex items-start gap-3 p-2.5 rounded-lg ${active ? 'bg-yellow-50 border border-yellow-200' : done ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
        done ? 'bg-green-500' : active ? 'bg-yellow-500' : 'bg-gray-300'
      }`}>
        {done ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : active ? <Clock className="w-3.5 h-3.5 text-white" /> : <div className="w-2 h-2 bg-white rounded-full" />}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${done ? 'text-green-800' : active ? 'text-yellow-800' : 'text-gray-500'}`}>{label}</p>
        {done && date && <p className="text-xs text-green-600">{t.departures.validatedOn} {formatDate(date)}</p>}
        {done && comment && <p className="text-xs text-green-700 mt-0.5">{comment}</p>}
        {active && <p className="text-xs text-yellow-600">{t.departures.pendingStatus}</p>}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
