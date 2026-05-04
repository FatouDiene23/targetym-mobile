'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, CheckCircle, XCircle, AlertCircle,
  Download, RefreshCw, Users, Settings, BarChart3, CalendarDays,
  ChevronLeft, ChevronRight, X, Search, Plus, Brain, Sparkles,
  Upload, FileDown, Save, Heart, FileText
} from 'lucide-react';
import Header from '@/components/Header';
import CustomSelect from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';
import { useI18n } from '@/lib/i18n/I18nContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { leavesTips } from '@/config/pageTips';

// ============================================
// TYPES
// ============================================

interface LeaveType {
  id: number;
  name: string;
  code: string;
  default_days: number;
  is_annual?: boolean;
  accrual_rate?: number;
  max_carryover?: number | null;
  is_active: boolean;
  requires_justification?: boolean;
  description?: string;
}

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
  department_name?: string;
  leave_type_id: number;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason?: string;
  status: string;
  created_at: string;
  approved_at?: string;
  approved_by_name?: string;
  rejection_reason?: string;
}

interface LeaveStats {
  total_requests: number;
  pending: number;
  approved: number;
  rejected: number;
  on_leave_today: number;
  avg_days_per_request: number;
}

interface Department {
  id: number;
  name: string;
}

interface EmployeeShort {
  id: number;
  first_name: string;
  last_name: string;
  department_name?: string;
  hire_date?: string;
}

interface EmployeeBalance {
  id: number;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code: string;
  year: number;
  initial_balance: number;
  allocated: number;
  carried_over: number;
  taken: number;
  pending: number;
  available: number;
  accrual_rate?: number;
  is_annual?: boolean;
}

interface OkrAtRisk {
  id: number;
  title: string;
  period: string;
  end_date: string | null;
  progress: number;
  deadline_during_leave: boolean;
  days_until_deadline: number | null;
  key_results: Array<{ title: string; progress: number; current: number; target: number }>;
}

interface OkrImpact {
  has_okrs: boolean;
  okrs_at_risk: OkrAtRisk[];
  warning_level: 'none' | 'low' | 'medium' | 'high';
  message: string | null;
}

interface ManagerSuggestion {
  recommendation: 'approve' | 'caution' | 'review';
  color: string;
  ai_text: string;
  okrs_at_risk: OkrAtRisk[];
  has_okr_issues: boolean;
}

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

async function getLeaveTypes(): Promise<LeaveType[]> {
  const response = await fetch(`${API_URL}/api/leaves/types`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : (data.items || []);
}

async function getLeaveRequests(params: {
  status?: string;
  department_id?: number;
  leave_type_id?: number;
  page?: number;
  page_size?: number;
}): Promise<{ items: LeaveRequest[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.status && params.status !== 'all') searchParams.append('status', params.status);
  if (params.department_id) searchParams.append('department_id', params.department_id.toString());
  if (params.leave_type_id) searchParams.append('leave_type_id', params.leave_type_id.toString());
  searchParams.append('page', (params.page || 1).toString());
  searchParams.append('page_size', (params.page_size || 20).toString());

  const response = await fetch(`${API_URL}/api/leaves/requests?${searchParams}`, { headers: getAuthHeaders() });
  if (!response.ok) return { items: [], total: 0 };
  return response.json();
}

async function getLeaveStats(): Promise<LeaveStats> {
  try {
    const response = await fetch(`${API_URL}/api/leaves/stats`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error();
    const data = await response.json();
    const total = data.total_requests || 0;
    const days = data.total_days_taken || 0;
    return {
      total_requests: total,
      pending: data.pending_requests ?? data.pending ?? 0,
      approved: data.approved_requests ?? data.approved ?? 0,
      rejected: data.rejected_requests ?? data.rejected ?? 0,
      on_leave_today: data.on_leave_today ?? 0,
      avg_days_per_request: total > 0 ? Math.round((days / total) * 10) / 10 : 0,
    };
  } catch {
    return {
      total_requests: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      on_leave_today: 0,
      avg_days_per_request: 0
    };
  }
}

async function getLeaveCalendar(year: number, month: number): Promise<LeaveRequest[]> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    const response = await fetch(
      `${API_URL}/api/leaves/calendar?start_date=${startDate}&end_date=${endDate}`, 
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.entries || [];
  } catch {
    return [];
  }
}
async function getDepartments(): Promise<Department[]> {
  const response = await fetch(`${API_URL}/api/departments`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function approveLeaveRequest(requestId: number, approved: boolean, rejectionReason?: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/requests/${requestId}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approved, rejection_reason: rejectionReason }),
  });
  if (!response.ok) throw new Error('Erreur');
}

async function createLeaveType(data: Partial<LeaveType>): Promise<LeaveType> {
  const response = await fetch(`${API_URL}/api/leaves/types`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function updateLeaveType(id: number, data: Partial<LeaveType>): Promise<LeaveType> {
  const response = await fetch(`${API_URL}/api/leaves/types/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function deleteLeaveType(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/types/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur');
}

async function initializeAllBalances(year: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/balances/initialize-all?year=${year}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur');
}

async function getEmployeesList(): Promise<EmployeeShort[]> {
  const response = await fetch(`${API_URL}/api/employees/?status=active&page_size=500`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || data || [];
}

async function getDirectReports(managerId: number): Promise<EmployeeShort[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/${managerId}/direct-reports`, { headers: getAuthHeaders() });
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : (data.items || data.employees || []);
    }
    // Fallback: query by manager_id
    const fallback = await fetch(`${API_URL}/api/employees/?manager_id=${managerId}&status=active&page_size=500`, { headers: getAuthHeaders() });
    if (!fallback.ok) return [];
    const data = await fallback.json();
    return data.items || data || [];
  } catch {
    return [];
  }
}

async function getEmployeeById(id: number): Promise<EmployeeShort | null> {
  try {
    const response = await fetch(`${API_URL}/api/employees/${id}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function getUserFromStorage(): { role: string; employeeId: number | null; firstName?: string; lastName?: string } {
  if (typeof window === 'undefined') return { role: 'employee', employeeId: null };
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return {
        role: (user.role || 'employee').toLowerCase(),
        employeeId: user.employee_id || null,
        firstName: user.first_name,
        lastName: user.last_name,
      };
    }
  } catch (e) {
    console.error('Error parsing user from localStorage:', e);
  }
  return { role: 'employee', employeeId: null };
}

async function getEmployeeBalancesForYear(employeeId: number, year: number): Promise<EmployeeBalance[]> {
  const response = await fetch(`${API_URL}/api/leaves/balances/${employeeId}?year=${year}`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.balances || [];
}

async function updateBalanceAllocated(balanceId: number, allocated: number, carriedOver: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/balances/${balanceId}?allocated=${allocated}&carried_over=${carriedOver}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur mise à jour');
}

async function resolveMatricule(matricule: string): Promise<number | null> {
  const trimmed = matricule.trim();
  if (!trimmed) return null;
  try {
    const response = await fetch(
      `${API_URL}/api/employees/?employee_id=${encodeURIComponent(trimmed)}&page_size=1`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    console.log(`resolveMatricule(${trimmed}):`, items);
    if (items.length === 0) return null;
    return items[0].id;
  } catch {
    return null;
  }
}

async function setInitialBalance(employeeId: number, leaveTypeId: number, initialBalance: number, year: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/balance/${employeeId}/initialize`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ leave_type_id: leaveTypeId, initial_balance: initialBalance, year }),
  });
  if (!response.ok) throw new Error('Erreur solde initial');
}

async function initializeEmployeeBalances(employeeId: number, year: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/balances/initialize/${employeeId}?year=${year}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur réinitialisation');
}

async function submitLeaveRequest(data: {
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
}): Promise<void> {
  const { employee_id, ...body } = data;
  const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${employee_id}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur création demande');
  }
}

async function getOkrImpact(employeeId: number, startDate: string, endDate: string): Promise<OkrImpact> {
  const response = await fetch(
    `${API_URL}/api/ai/leave-okr-impact?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error('Erreur impact OKR');
  return response.json();
}

async function fetchManagerSuggestion(leaveRequestId: number): Promise<ManagerSuggestion> {
  const response = await fetch(
    `${API_URL}/api/ai/leave-manager-suggestion/${leaveRequestId}`,
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error('Erreur suggestion manager');
  return response.json();
}

// ============================================
// LEAVE RECALLS — API & TYPES
// ============================================

interface LeaveRecall {
  id: number;
  leave_id: number;
  employee_id: number;
  employee_name?: string;
  initiated_by?: number;
  initiated_by_name?: string;
  recall_date: string;
  recall_reason: string;
  nb_days_recalled: number;
  is_urgent: boolean;
  urgency_justification?: string | null;
  resume_leave_after: boolean;
  compensation_type?: string | null;
  compensation_days?: number | null;
  compensation_end_date?: string | null;
  status: string;
  validated_at?: string | null;
  compensation_chosen_at?: string | null;
  compensation_validated_at?: string | null;
  return_declared_at?: string | null;
  closed_at?: string | null;
  notes?: string | null;
  created_at?: string;
}

async function getLeaveRecalls(): Promise<LeaveRecall[]> {
  try {
    const response = await fetch(`${API_URL}/api/leave-recalls/`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : (data.items || []);
  } catch {
    return [];
  }
}

async function createLeaveRecall(payload: {
  leave_id: number;
  recall_date: string;
  recall_reason: string;
  nb_days_recalled: number;
  is_urgent: boolean;
  urgency_justification?: string;
  resume_leave_after: boolean;
  compensation_type?: string;
  compensation_days?: number;
  compensation_end_date?: string;
}): Promise<void> {
  const response = await fetch(`${API_URL}/api/leave-recalls/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur création rappel');
  }
}

async function validateRecallRh(recallId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leave-recalls/${recallId}/validate-rh`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur validation RH');
}

async function closeRecall(recallId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leave-recalls/${recallId}/close`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur clôture');
}

async function validateRecallCompensation(recallId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leave-recalls/${recallId}/validate-compensation`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur validation compensation');
}

async function getTenantRecallPolicy(): Promise<'employee_chooses' | 'employer_decides'> {
  try {
    const response = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
    if (!response.ok) return 'employee_chooses';
    const data = await response.json();
    return (data.recall_compensation_policy || 'employee_chooses') as 'employee_chooses' | 'employer_decides';
  } catch {
    return 'employee_chooses';
  }
}

async function updateTenantRecallPolicy(value: 'employee_chooses' | 'employer_decides'): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/tenant-settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ recall_compensation_policy: value }),
  });
  if (!response.ok) throw new Error('Erreur lors de la mise à jour de la politique');
}

const RECALL_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  initie: { bg: 'bg-gray-100', text: 'text-gray-800' },
  valide_rh: { bg: 'bg-blue-100', text: 'text-blue-800' },
  notifie: { bg: 'bg-orange-100', text: 'text-orange-800' },
  compensation_proposee: { bg: 'bg-purple-100', text: 'text-purple-800' },
  compensation_validee: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  retour_declare: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  cloture: { bg: 'bg-green-100', text: 'text-green-800' },
};

function RecallStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const style = RECALL_STATUS_STYLES[status] || RECALL_STATUS_STYLES.initie;
  const label = (t.leaves.recallStatus as Record<string, string>)[status] || (t.leaves.recallStatus as Record<string, string>).initie;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {label}
    </span>
  );
}

function RecallsTab({
  recalls,
  userRole,
  onNew,
  onSelect,
  onRefresh,
}: {
  recalls: LeaveRecall[];
  userRole: string;
  onNew: () => void;
  onSelect: (r: LeaveRecall) => void;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const canCreate = ['manager', 'rh', 'admin', 'dg'].includes(userRole);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{t.leaves.leaveRecalls}</h3>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title={t.leaves.refresh}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          {canCreate && (
            <button
              onClick={onNew}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t.leaves.newRecall}
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.collaborator}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.relatedLeave}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.recallDate}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.nbDays}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.urgency}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.common.status}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.common.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {recalls.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 text-sm font-medium text-gray-900">{r.employee_name || `#${r.employee_id}`}</td>
                <td className="px-4 py-4 text-sm text-gray-500">{t.leaves.leaveHash}{r.leave_id}</td>
                <td className="px-4 py-4 text-sm text-gray-500">{new Date(r.recall_date).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-4 text-sm font-medium text-gray-900">{r.nb_days_recalled}</td>
                <td className="px-4 py-4">
                  {r.is_urgent ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">{t.leaves.urgent}</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-4"><RecallStatusBadge status={r.status} /></td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => onSelect(r)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {t.leaves.view}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recalls.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{t.leaves.noRecall}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NewRecallModal({
  isOpen,
  onClose,
  policy,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  policy: 'employee_chooses' | 'employer_decides';
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [onLeaveList, setOnLeaveList] = useState<LeaveRequest[]>([]);
  const [form, setForm] = useState({
    leave_id: '',
    recall_date: new Date().toISOString().slice(0, 10),
    recall_reason: '',
    nb_days_recalled: 1,
    is_urgent: false,
    urgency_justification: '',
    resume_leave_after: true,
    compensation_type: 'prolongation',
    compensation_days: 0,
    compensation_end_date: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // Fetch approved leaves currently covering today
    (async () => {
      const data = await getLeaveRequests({ status: 'approved', page: 1, page_size: 100 });
      const today = new Date().toISOString().slice(0, 10);
      const filtered = data.items.filter((l) => l.start_date <= today && l.end_date >= today);
      setOnLeaveList(filtered);
    })();
  }, [isOpen]);

  // Pré-remplit compensation_days et compensation_end_date selon le congé sélectionné,
  // le nombre de jours rappelés et le type de compensation choisi.
  const withCompensationDefaults = (next: typeof form) => {
    const days = next.nb_days_recalled || 0;
    const updated = { ...next, compensation_days: days };
    if (next.compensation_type === 'prolongation') {
      const leaveIdNum = parseInt(next.leave_id || '0');
      const selectedLeave = onLeaveList.find((l) => l.id === leaveIdNum);
      if (selectedLeave?.end_date && days > 0) {
        const endDate = new Date(selectedLeave.end_date);
        endDate.setDate(endDate.getDate() + days);
        updated.compensation_end_date = endDate.toISOString().split('T')[0];
      } else {
        updated.compensation_end_date = '';
      }
    } else {
      updated.compensation_end_date = '';
    }
    return updated;
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leave_id || !form.recall_reason) {
      toast.error(t.leaves.requiredFieldsMissing);
      return;
    }
    if (form.is_urgent && !form.urgency_justification) {
      toast.error(t.leaves.urgentJustificationRequired);
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRecall({
        leave_id: parseInt(form.leave_id),
        recall_date: form.recall_date,
        recall_reason: form.recall_reason,
        nb_days_recalled: form.nb_days_recalled,
        is_urgent: form.is_urgent,
        urgency_justification: form.is_urgent ? form.urgency_justification : undefined,
        resume_leave_after: form.resume_leave_after,
        compensation_type: form.compensation_type || undefined,
        compensation_days: form.compensation_type === 'solde' ? form.compensation_days : undefined,
        compensation_end_date: form.compensation_type === 'prolongation' ? form.compensation_end_date : undefined,
      });
      toast.success(t.leaves.recallCreated);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.leaves.error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{t.leaves.newLeaveRecall}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.collaboratorOnLeave} <span className="text-red-500">*</span></label>
              <CustomSelect
                value={form.leave_id}
                onChange={(v) => setForm(withCompensationDefaults({ ...form, leave_id: v }))}
                placeholder={t.leaves.select}
                options={[
                  { value: '', label: t.leaves.select },
                  ...onLeaveList.map((l) => ({
                    value: String(l.id),
                    label: `${l.employee_name} — ${new Date(l.start_date).toLocaleDateString('fr-FR')} → ${new Date(l.end_date).toLocaleDateString('fr-FR')}`,
                  })),
                ]}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.recallDate} <span className="text-red-500">*</span></label>
                <CustomDatePicker value={form.recall_date} onChange={v => setForm({ ...form, recall_date: v })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.nbDaysRecalled} <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min={1}
                  value={form.nb_days_recalled}
                  onChange={(e) => setForm(withCompensationDefaults({ ...form, nb_days_recalled: parseInt(e.target.value || '1') }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.recallReason} <span className="text-red-500">*</span></label>
              <textarea
                value={form.recall_reason}
                onChange={(e) => setForm({ ...form, recall_reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                required
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_urgent}
                onChange={(e) => setForm({ ...form, is_urgent: e.target.checked })}
              />
              <span className="text-sm text-gray-700">{t.leaves.urgentRecall}</span>
            </label>
            {form.is_urgent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.urgencyJustification} <span className="text-red-500">*</span></label>
                <textarea
                  value={form.urgency_justification}
                  onChange={(e) => setForm({ ...form, urgency_justification: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.leaves.resumeAfterRecall}</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.resume_leave_after === true}
                    onChange={() => setForm(withCompensationDefaults({ ...form, resume_leave_after: true, compensation_type: 'prolongation' }))}
                  />
                  {t.leaves.resumeLeaveAutomatically}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.resume_leave_after === false}
                    onChange={() => setForm(withCompensationDefaults({ ...form, resume_leave_after: false, compensation_type: 'solde' }))}
                  />
                  {t.leaves.suspendPermanently}
                </label>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">{t.leaves.compensationType}</label>
                <p className="mt-1 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600 border border-gray-200">
                  {form.compensation_type === 'prolongation'
                    ? t.leaves.leaveExtension
                    : t.leaves.addToLeaveBalance}
                </p>
              </div>
            </div>
            {policy === 'employer_decides' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.daysToCompensate}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.compensation_days}
                    onChange={(e) => setForm({ ...form, compensation_days: parseInt(e.target.value || '0') })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                {form.compensation_type === 'prolongation' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.extendedEndDate}</label>
                    <CustomDatePicker value={form.compensation_end_date} onChange={v => setForm({ ...form, compensation_end_date: v })} className="w-full" />
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {submitting ? t.leaves.sending : t.leaves.createRecall}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function RecallDetailModal({
  recall,
  userRole,
  policy,
  onClose,
  onSuccess,
}: {
  recall: LeaveRecall | null;
  userRole: string;
  policy: 'employee_chooses' | 'employer_decides';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  if (!recall) return null;

  const isRh = ['rh', 'admin', 'dg'].includes(userRole);
  const isManagerOrRh = ['manager', 'rh', 'admin', 'dg'].includes(userRole);

  const steps = [
    { key: 'initie', label: t.leaves.recallStatus.initie, done: true },
    { key: 'valide_rh', label: t.leaves.recallStatus.valide_rh, done: !!recall.validated_at || ['notifie', 'compensation_proposee', 'compensation_validee', 'retour_declare', 'cloture'].includes(recall.status) },
    { key: 'notifie', label: t.leaves.notifiedCollaborator, done: ['notifie', 'compensation_proposee', 'compensation_validee', 'retour_declare', 'cloture'].includes(recall.status) },
    { key: 'compensation', label: `${t.leaves.compensationLabel.replace(' :', '')} (${policy === 'employer_decides' ? t.leaves.compensationDecidedByEmployer : t.leaves.compensationChosenByCollaborator})`, done: ['compensation_validee', 'retour_declare', 'cloture'].includes(recall.status) },
    { key: 'retour_declare', label: t.leaves.recallStatus.retour_declare, done: ['retour_declare', 'cloture'].includes(recall.status) },
    { key: 'cloture', label: t.leaves.recallStatus.cloture, done: recall.status === 'cloture' },
  ];

  const handleValidateRh = async () => {
    try {
      await validateRecallRh(recall.id);
      toast.success(t.leaves.recallValidated);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.leaves.error);
    }
  };

  const handleClose = async () => {
    try {
      await closeRecall(recall.id);
      toast.success(t.leaves.recallClosed);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.leaves.error);
    }
  };

  const handleValidateCompensation = async () => {
    try {
      await validateRecallCompensation(recall.id);
      toast.success(t.leaves.compensationValidated);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.leaves.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t.leaves.recallHash}{recall.id}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-2 text-sm text-gray-700 mb-6">
            <div><span className="text-gray-500">{t.leaves.collaborator} :</span> <span className="font-medium">{recall.employee_name || `#${recall.employee_id}`}</span></div>
            <div><span className="text-gray-500">{t.leaves.recallDateLabel}</span> {new Date(recall.recall_date).toLocaleDateString('fr-FR')}</div>
            <div><span className="text-gray-500">{t.leaves.nbDaysRecalledLabel}</span> {recall.nb_days_recalled}</div>
            <div><span className="text-gray-500">{t.leaves.reasonColon}</span> {recall.recall_reason}</div>
            {recall.is_urgent && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700">
                <strong>Urgent</strong>{recall.urgency_justification ? ` — ${recall.urgency_justification}` : ''}
              </div>
            )}
            <div><span className="text-gray-500">{t.leaves.resumeLabel}</span> {recall.resume_leave_after ? t.leaves.resumeAutomatic : t.leaves.suspendedPermanently}</div>
            {recall.compensation_type && (
              <div><span className="text-gray-500">{t.leaves.compensationLabel}</span> {recall.compensation_type}{recall.compensation_days ? ` (${recall.compensation_days} j)` : ''}{recall.compensation_end_date ? ` (${t.leaves.newEnd} ${new Date(recall.compensation_end_date).toLocaleDateString('fr-FR')})` : ''}</div>
            )}
            <div><span className="text-gray-500">{t.leaves.currentStatus}</span> <RecallStatusBadge status={recall.status} /></div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{t.leaves.workflow}</h4>
            <ol className="space-y-3">
              {steps.map((s, idx) => (
                <li key={s.key} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {s.done ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className={`text-sm ${s.done ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{s.label}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap gap-2 pt-6 border-t border-gray-200 mt-6">
            {isRh && recall.status === 'initie' && (
              <button onClick={handleValidateRh} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t.leaves.validateRh}</button>
            )}
            {isManagerOrRh && recall.status === 'compensation_proposee' && (
              <button onClick={handleValidateCompensation} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700">{t.leaves.validateCompensation}</button>
            )}
            {isManagerOrRh && recall.status === 'retour_declare' && (
              <button onClick={handleClose} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">{t.leaves.closeRecall}</button>
            )}
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 ml-auto">{t.common.close}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: t.leaves.pending },
    approved: { bg: 'bg-green-100', text: 'text-green-800', label: t.leaves.approved },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: t.leaves.refused },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: t.leaves.cancelled },
  };
  const config = configs[status] || configs.pending;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function StatCard({ icon: Icon, value, label, color }: { 
  icon: React.ElementType; 
  value: number | string; 
  label: string; 
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Calendar Component
function LeaveCalendar({ 
  year, 
  month, 
  leaves,
  onPrevMonth,
  onNextMonth
}: { 
  year: number; 
  month: number; 
  leaves: LeaveRequest[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const { t } = useI18n();
  const monthNames = t.leaves.monthNames;
  const dayNames = t.leaves.dayNames;

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = (firstDay.getDay() + 6) % 7; // Lundi = 0

  const days = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getLeavesForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.filter(leave => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const current = new Date(dateStr);
      return current >= start && current <= end && leave.status === 'approved';
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary-600" />
          {t.leaves.absenceCalendar}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={onPrevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-medium text-gray-900 min-w-[150px] text-center">
            {monthNames[month - 1]} {year}
          </span>
          <button onClick={onNextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          const dayLeaves = day ? getLeavesForDay(day) : [];
          const isToday = day === new Date().getDate() && 
                          month === new Date().getMonth() + 1 && 
                          year === new Date().getFullYear();
          
          return (
            <div
              key={index}
              className={`min-h-[80px] p-1 border border-gray-100 rounded-lg ${
                day ? 'bg-white' : 'bg-gray-50'
              } ${isToday ? 'ring-2 ring-primary-500' : ''}`}
            >
              {day && (
                <>
                  <span className={`text-sm ${isToday ? 'font-bold text-primary-600' : 'text-gray-700'}`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayLeaves.slice(0, 2).map((leave, i) => (
                      <div
                        key={i}
                        className="text-xs px-1 py-0.5 bg-orange-100 text-orange-800 rounded truncate"
                        title={`${leave.employee_name} - ${leave.leave_type_name}`}
                      >
                        {leave.employee_name?.split(' ')[0]}
                      </div>
                    ))}
                    {dayLeaves.length > 2 && (
                      <div className="text-xs text-gray-500 px-1">
                        +{dayLeaves.length - 2}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Leave Types Settings Modal
function LeaveTypesModal({ 
  isOpen, 
  onClose,
  leaveTypes,
  onRefresh
}: { 
  isOpen: boolean; 
  onClose: () => void;
  leaveTypes: LeaveType[];
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [newType, setNewType] = useState({ name: '', code: '', default_days: 0, is_annual: false, accrual_rate: 2.0, max_carryover: null as number | null });
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; danger?: boolean }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const handleSaveEdit = async () => {
    if (!editingType) return;
    setSaving(true);
    try {
      await updateLeaveType(editingType.id, editingType);
      onRefresh();
      setEditingType(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddType = async () => {
    if (!newType.name || !newType.code) return;
    setSaving(true);
    try {
      await createLeaveType({ ...newType, is_active: true });
      onRefresh();
      setNewType({ name: '', code: '', default_days: 0, is_annual: false, accrual_rate: 2.0, max_carryover: null });
      setShowAddForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = (type: LeaveType) => {
    setConfirmDialog({
      open: true,
      title: t.leaves.deleteLeaveType,
      message: t.leaves.deleteLeaveTypeConfirm.replace('{name}', type.name),
      danger: true,
      onConfirm: async () => {
        setDeletingId(type.id);
        try {
          await deleteLeaveType(type.id);
          onRefresh();
        } catch (e) {
          console.error(e);
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-600" />
              {t.leaves.leaveTypes}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {leaveTypes.map((type) => (
              <div key={type.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                {editingType?.id === type.id ? (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editingType.name}
                      onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder={t.leaves.nameLabel}
                    />
                    <input
                      type="text"
                      value={editingType.code}
                      onChange={(e) => setEditingType({ ...editingType, code: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder={t.leaves.codeLabel}
                    />
                    <label className="flex items-center gap-2 text-sm col-span-full">
                      <input
                        type="checkbox"
                        checked={!!editingType.is_annual}
                        onChange={(e) => setEditingType({ ...editingType, is_annual: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      {t.leaves.annualLeave}
                    </label>
                    {editingType.is_annual ? (
                      <>
                        <input
                          type="number"
                          step="0.5"
                          value={editingType.accrual_rate ?? 2}
                          onChange={(e) => setEditingType({ ...editingType, accrual_rate: parseFloat(e.target.value) || 0 })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder={t.leaves.monthlyRate}
                        />
                        <input
                          type="number"
                          value={editingType.max_carryover ?? ''}
                          onChange={(e) => setEditingType({ ...editingType, max_carryover: e.target.value ? parseInt(e.target.value) : null })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder={t.leaves.carryoverCap}
                        />
                      </>
                    ) : (
                      <input
                        type="number"
                        value={editingType.default_days}
                        onChange={(e) => setEditingType({ ...editingType, default_days: parseInt(e.target.value) || 0 })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder={t.leaves.quota}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{type.name}</span>
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{type.code}</span>
                      {type.is_annual ? (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t.leaves.annual} &mdash; {type.accrual_rate ?? 2}j/mois</span>
                      ) : (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{t.leaves.special} &mdash; {type.default_days} j</span>
                      )}
                      {!type.is_active && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{t.leaves.inactive}</span>
                      )}
                    </div>
                    {type.is_annual && type.max_carryover != null && (
                      <p className="text-xs text-gray-500 mt-0.5">{t.leaves.carryoverCapLabel} : {type.max_carryover} j</p>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2 ml-4">
                  {editingType?.id === type.id ? (
                    <>
                      <button
                        onClick={() => setEditingType(null)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
                      >
                        {t.common.cancel}
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        {saving ? t.leaves.saving : t.leaves.saveSave}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingType(type)}
                        className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
                      >
                        {t.common.edit}
                      </button>
                      <button
                        onClick={() => handleDeleteType(type)}
                        disabled={deletingId === type.id}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      >
                        {deletingId === type.id ? '...' : t.common.delete}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add new type */}
          {showAddForm ? (
            <div className="mt-4 p-4 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={newType.name}
                  onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder={t.leaves.typeName}
                />
                <input
                  type="text"
                  value={newType.code}
                  onChange={(e) => setNewType({ ...newType, code: e.target.value.toUpperCase() })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder={t.leaves.typeCode}
                />
                <label className="flex items-center gap-2 text-sm col-span-full">
                  <input
                    type="checkbox"
                    checked={newType.is_annual}
                    onChange={(e) => setNewType({ ...newType, is_annual: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  {t.leaves.annualLeave}
                </label>
                {newType.is_annual ? (
                  <>
                    <input
                      type="number"
                      step="0.5"
                      value={newType.accrual_rate}
                      onChange={(e) => setNewType({ ...newType, accrual_rate: parseFloat(e.target.value) || 0 })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder={t.leaves.monthlyRate}
                    />
                    <input
                      type="number"
                      value={newType.max_carryover ?? ''}
                      onChange={(e) => setNewType({ ...newType, max_carryover: e.target.value ? parseInt(e.target.value) : null })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder={t.leaves.carryoverCap}
                    />
                  </>
                ) : (
                  <input
                    type="number"
                    value={newType.default_days || ''}
                    onChange={(e) => setNewType({ ...newType, default_days: parseInt(e.target.value) || 0 })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder={t.leaves.quota}
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleAddType}
                  disabled={saving || !newType.name || !newType.code}
                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? t.leaves.adding : t.common.create}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t.leaves.addLeaveType}
            </button>
          )}
        </div>
      </div>
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

// Initialize Balances Modal
function InitializeBalancesModal({ 
  isOpen, 
  onClose,
  onSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInitialize = async () => {
    setLoading(true);
    setError('');
    try {
      await initializeAllBalances(year);
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      setError(t.leaves.initializationError);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{t.leaves.initializeBalances}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.leaves.year}
            </label>
            <CustomSelect
              value={String(year)}
              onChange={(v) => setYear(parseInt(v))}
              options={[2024, 2025, 2026].map(y => ({ value: String(y), label: String(y) }))}
            />
            <p className="mt-2 text-sm text-gray-500">
              {t.leaves.initializeBalancesDescription.replace('{year}', String(year))}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-amber-800">
              <strong>{t.common.warning} :</strong> {t.leaves.initializeBalancesWarning}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleInitialize}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? t.leaves.initializing : t.leaves.initialize}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Request Action Modal
function RequestActionModal({
  request,
  onClose,
  onSuccess
}: {
  request: LeaveRequest | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<ManagerSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleAction = async (approved: boolean) => {
    if (!request) return;
    if (!approved && !rejectionReason.trim()) {
      toast.error(t.leaves.pleaseIndicateRejectionReason);
      return;
    }
    
    setLoading(true);
    try {
      await approveLeaveRequest(request.id, approved, approved ? undefined : rejectionReason);
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (!request) return;
    setAiLoading(true);
    try {
      const suggestion = await fetchManagerSuggestion(request.id);
      setAiSuggestion(suggestion);
    } catch (e) {
      console.error(e);
      toast.error(t.leaves.aiError);
    } finally {
      setAiLoading(false);
    }
  };

  if (!request) return null;

  const suggestionBg: Record<string, string> = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    orange: 'bg-orange-50 border-orange-200',
    gray: 'bg-gray-50 border-gray-200',
  };
  const suggestionLabel: Record<string, string> = {
    approve: `✅ ${t.leaves.aiRecommendApprove}`,
    caution: `⚠️ ${t.leaves.aiRecommendCaution}`,
    review: `🔍 ${t.leaves.aiRecommendReview}`,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {request.status === 'pending' ? t.leaves.processRequest : t.leaves.requestDetail}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900">{request.employee_name}</p>
            <p className="text-sm text-primary-600">{request.leave_type_name}</p>
            <p className="text-sm text-gray-500 mt-2">
              {new Date(request.start_date).toLocaleDateString('fr-FR')} → {new Date(request.end_date).toLocaleDateString('fr-FR')}
              <span className="ml-2 font-medium">({request.days_requested} {t.leaves.dayCount})</span>
            </p>
            {request.reason && (
              <p className="text-sm text-gray-500 mt-2 italic">&quot;{request.reason}&quot;</p>
            )}
            {request.status !== 'pending' && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <StatusBadge status={request.status} />
                {request.approved_by_name && (
                  <p className="text-xs text-gray-500 mt-1">{t.leaves.by} {request.approved_by_name}</p>
                )}
                {request.rejection_reason && (
                  <p className="text-xs text-red-600 mt-1">{t.leaves.reasonLabel} : {request.rejection_reason}</p>
                )}
              </div>
            )}
          </div>

          {/* AI Suggestion button + panel */}
          {request.status === 'pending' && (
            <div className="mb-4">
              {aiSuggestion ? (
                <div className={`rounded-lg border p-4 ${suggestionBg[aiSuggestion.color] || suggestionBg.gray}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">
                      {suggestionLabel[aiSuggestion.recommendation]}
                    </p>
                    <button
                      onClick={() => setAiSuggestion(null)}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-700 whitespace-pre-line">{aiSuggestion.ai_text}</p>
                  {aiSuggestion.has_okr_issues && (
                    <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                      <p className="text-xs font-medium mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> {t.leaves.aiOkrsConcerned}
                      </p>
                      <ul className="pl-4 list-disc space-y-0.5">
                        {aiSuggestion.okrs_at_risk.map((o) => (
                          <li key={o.id} className="text-xs">
                            {o.title} — {o.progress.toFixed(0)}%
                            {o.deadline_during_leave && <span className="text-red-600 font-medium"> ⚠ {t.leaves.aiDeadline} {o.end_date}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleAiAnalysis}
                  disabled={aiLoading}
                  className="w-full px-4 py-2 border border-purple-300 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  {aiLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      {t.leaves.aiAnalyzing}
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      {t.leaves.aiAnalysis}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {request.status === 'pending' ? (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.leaves.rejectionReason}
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={3}
                  placeholder={t.leaves.rejectionPlaceholder}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  {t.leaves.refuse}
                </button>
                <button
                  onClick={() => handleAction(true)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {t.leaves.approve}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {t.common.close}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// NEW LEAVE REQUEST MODAL (Employee + OKR alert)
// ============================================

function NewLeaveRequestModal({
  isOpen,
  onClose,
  leaveTypes,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  leaveTypes: LeaveType[];
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Role-based employee selector
  const [userRole, setUserRole] = useState('employee');
  const [selfName, setSelfName] = useState('');
  const [employeesList, setEmployeesList] = useState<{ id: number; first_name: string; last_name: string }[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [okrImpact, setOkrImpact] = useState<OkrImpact | null>(null);
  const [okrLoading, setOkrLoading] = useState(false);

  // Load employee list based on role when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setLoadingEmployees(true);
      const stored = getUserFromStorage();
      const role = stored.role;
      const empId = stored.employeeId;
      if (!cancelled) setUserRole(role);

      try {
        if (role === 'employee') {
          // Employee: only themselves
          if (empId) {
            setEmployeeId(String(empId));
            // Fetch name to display
            const me = await getEmployeeById(empId);
            if (!cancelled && me) {
              setSelfName(`${me.first_name} ${me.last_name}`);
            } else if (!cancelled) {
              setSelfName(stored.firstName && stored.lastName ? `${stored.firstName} ${stored.lastName}` : `${t.common.employee} #${empId}`);
            }
          }
          setEmployeesList([]);
        } else if (role === 'manager') {
          // Manager: self + direct reports
          const reports = empId ? await getDirectReports(empId) : [];
          if (cancelled) return;
          const selfEntry = { id: empId!, first_name: stored.firstName || '', last_name: stored.lastName || '' };
          const hasSelf = reports.some(r => r.id === empId);
          const list = hasSelf ? reports : [selfEntry, ...reports];
          setEmployeesList(list);
          if (empId) setEmployeeId(String(empId));
        } else {
          // rh, admin, dg, super_admin: all active employees
          const allEmps = await getEmployeesList();
          if (cancelled) return;
          setEmployeesList(allEmps);
          if (empId) setEmployeeId(String(empId));
        }
      } catch (e) {
        console.error('Error loading employees for leave modal:', e);
      } finally {
        if (!cancelled) setLoadingEmployees(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen]);

  // Fetch OKR impact whenever employee + both dates are set
  useEffect(() => {
    if (!employeeId || !startDate || !endDate) {
      setOkrImpact(null);
      return;
    }
    const id = Number.parseInt(employeeId);
    if (Number.isNaN(id) || endDate < startDate) {
      setOkrImpact(null);
      return;
    }
    let cancelled = false;
    setOkrLoading(true);
    getOkrImpact(id, startDate, endDate)
      .then((data) => { if (!cancelled) setOkrImpact(data); })
      .catch(() => { if (!cancelled) setOkrImpact(null); })
      .finally(() => { if (!cancelled) setOkrLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId, startDate, endDate]);

  const handleSubmit = async () => {
    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      toast.error(t.leaves.fillAllRequired);
      return;
    }
    setSubmitting(true);
    try {
      await submitLeaveRequest({
        employee_id: Number.parseInt(employeeId),
        leave_type_id: Number.parseInt(leaveTypeId),
        start_date: startDate,
        end_date: endDate,
        reason: reason || undefined,
      });
      toast.success(t.leaves.requestCreated);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.leaves.requestCreationError);
    } finally {
      setSubmitting(false);
    }
  };

  const warningColors = {
    none: '',
    low: 'bg-blue-50 border-blue-200 text-blue-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    high: 'bg-red-50 border-red-200 text-red-800',
  };

  const storedUser = getUserFromStorage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              {t.leaves.newLeaveRequest}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Employee — role-based selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.leaves.employee} <span className="text-red-500">*</span>
              </label>
              {loadingEmployees ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                  {t.common.loading}
                </div>
              ) : userRole === 'employee' ? (
                <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700">
                  {selfName || t.common.loading}
                </div>
              ) : (
                <CustomSelect
                  value={employeeId}
                  onChange={(v) => setEmployeeId(v)}
                  placeholder={t.leaves.selectEmployee}
                  options={[
                    { value: '', label: t.leaves.selectEmployee },
                    ...employeesList.map(emp => ({
                      value: String(emp.id),
                      label: `${emp.first_name} ${emp.last_name}${emp.id === storedUser.employeeId ? ` ${t.leaves.me}` : ''}`,
                    })),
                  ]}
                />
              )}
            </div>

            {/* Leave type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.leaves.leaveType} <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={leaveTypeId}
                onChange={(v) => setLeaveTypeId(v)}
                placeholder={t.leaves.selectLeaveType}
                options={[
                  { value: '', label: t.leaves.selectLeaveType },
                  ...leaveTypes.filter(t => t.is_active).map(t => ({ value: String(t.id), label: t.name })),
                ]}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.leaves.startLabel} <span className="text-red-500">*</span>
                </label>
                <CustomDatePicker value={startDate} onChange={setStartDate} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.leaves.endLabel} <span className="text-red-500">*</span>
                </label>
                <CustomDatePicker value={endDate} onChange={setEndDate} min={startDate} className="w-full" />
              </div>
            </div>

            {/* OKR Impact */}
            {okrLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                {t.leaves.okrImpactAnalysis}
              </div>
            )}
            {!okrLoading && okrImpact && okrImpact.has_okrs && okrImpact.warning_level !== 'none' && (
              <div className={`rounded-lg border p-4 ${warningColors[okrImpact.warning_level]}`}>
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">{okrImpact.message}</p>
                </div>
                <ul className="mt-2 space-y-1 pl-6 list-disc text-xs">
                  {okrImpact.okrs_at_risk.map((o) => (
                    <li key={o.id}>
                      <span className="font-medium">{o.title}</span>
                      {' '}— {o.progress.toFixed(0)}% {t.leaves.completed}
                      {o.deadline_during_leave && (
                        <span className="ml-1 font-semibold text-red-700">⚠ {t.leaves.deadlineOn} {o.end_date}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.reasonOptional}</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={2}
                placeholder={t.leaves.reasonPlaceholder}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t.leaves.sending}</>
              ) : (
                <>{t.leaves.sendRequest}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EMPLOYEE BALANCES TAB
// ============================================

function EmployeeBalancesTab({ leaveTypes }: { leaveTypes: LeaveType[] }) {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();
  const [employees, setEmployees] = useState<EmployeeShort[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(false);
  // Inline-editable values for every row (keyed by balance id)
  const [edits, setEdits] = useState<Record<number, { allocated: string; initial_balance: string; carried_over: string }>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // CSV import
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState('');
  const [csvResult, setCsvResult] = useState<{ success: number; errors: { line: number; error: string }[] } | null>(null);

  useEffect(() => {
    getEmployeesList().then((list) => {
      setEmployees(list);
      setLoadingEmployees(false);
    });
  }, []);

  const loadBalances = useCallback(async (empId: number, year: number) => {
    setLoadingBalances(true);
    try {
      const data = await getEmployeeBalancesForYear(empId, year);
      setBalances(data);
      // Pre-populate edits for every row so fields are immediately editable
      const initial: Record<number, { allocated: string; initial_balance: string; carried_over: string }> = {};
      data.forEach((bal) => {
        initial[bal.id] = {
          allocated: String(bal.allocated),
          initial_balance: String(bal.initial_balance),
          carried_over: String(bal.carried_over),
        };
      });
      setEdits(initial);
    } finally {
      setLoadingBalances(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) loadBalances(selectedEmployeeId as number, selectedYear);
  }, [selectedEmployeeId, selectedYear, loadBalances]);

  const handleInitialize = async () => {
    if (!selectedEmployeeId) return;
    setInitializing(true);
    try {
      await initializeEmployeeBalances(selectedEmployeeId as number, selectedYear);
      await loadBalances(selectedEmployeeId as number, selectedYear);
      toast.success(t.leaves.balancesInitialized);
    } catch {
      toast.error(t.leaves.initializationError);
    } finally {
      setInitializing(false);
    }
  };

  // Detect which rows actually changed vs. original balance data
  const getModifiedRows = () => {
    return balances.filter((bal) => {
      const e = edits[bal.id];
      if (!e) return false;
      return (
        String(bal.allocated) !== e.allocated ||
        String(bal.initial_balance) !== e.initial_balance ||
        String(bal.carried_over) !== e.carried_over
      );
    });
  };

  const handleSaveAll = async () => {
    const modified = getModifiedRows();
    if (modified.length === 0) {
      toast(t.leaves.noChangesDetected);
      return;
    }
    setSavingAll(true);
    try {
      const results = await Promise.allSettled(
        modified.map(async (bal) => {
          const e = edits[bal.id];
          const allocated = parseFloat(e.allocated) || 0;
          const carriedOver = parseFloat(e.carried_over) || 0;
          const initialBalance = parseFloat(e.initial_balance) || 0;
          await updateBalanceAllocated(bal.id, allocated, carriedOver);
          await setInitialBalance(selectedEmployeeId as number, bal.leave_type_id, initialBalance, selectedYear);
        })
      );
      const failures = results.filter((r) => r.status === 'rejected');
      const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);
      const empName = selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name}` : '';
      if (failures.length === 0) {
        toast.success(t.leaves.balancesSaved.replace('{name}', empName));
      } else {
        toast.error(t.leaves.balancesSaveErrors.replace('{failures}', String(failures.length)).replace('{total}', String(modified.length)));
      }
      await loadBalances(selectedEmployeeId as number, selectedYear);
    } catch {
      toast.error(t.leaves.balancesSaveError);
    } finally {
      setSavingAll(false);
    }
  };

  const handleCsvImport = async (file: File) => {
    setCsvImporting(true);
    setCsvResult(null);
    setCsvProgress(t.leaves.csvReadingFile);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast.error(t.leaves.csvEmptyFile);
        return;
      }
      const dataLines = lines.slice(1); // skip header
      let success = 0;
      const errors: { line: number; error: string }[] = [];

      // Cache resolved matricules to avoid duplicate API calls
      const matriculeCache = new Map<string, number | null>();

      const resolveLeaveTypeCode = (code: string): number | null => {
        const found = leaveTypes.find(t => t.code.toUpperCase() === code.toUpperCase());
        return found ? found.id : null;
      };

      for (let i = 0; i < dataLines.length; i++) {
        const lineNum = i + 2;
        setCsvProgress(t.leaves.csvProcessingLine.replace('{current}', String(i + 1)).replace('{total}', String(dataLines.length)));
        const cols = dataLines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 4) {
          errors.push({ line: lineNum, error: 'Nombre de colonnes insuffisant (attendu: 4 — matricule, leave_type_code, year, initial_balance)' });
          continue;
        }
        const [matricule, ltCode, yr, bal] = cols;
        if (!matricule || !ltCode || !yr || !bal) {
          errors.push({ line: lineNum, error: 'Valeur(s) manquante(s)' });
          continue;
        }

        // 1. Resolve matricule → employee id
        let employeeId: number | null;
        if (matriculeCache.has(matricule)) {
          employeeId = matriculeCache.get(matricule)!;
        } else {
          employeeId = await resolveMatricule(matricule);
          matriculeCache.set(matricule, employeeId);
        }
        if (employeeId === null) {
          errors.push({ line: lineNum, error: `Matricule "${matricule}" introuvable` });
          continue;
        }

        // 2. Resolve leave type code → leave_type_id
        const leaveTypeId = resolveLeaveTypeCode(ltCode);
        if (leaveTypeId === null) {
          errors.push({ line: lineNum, error: `Type de congé "${ltCode}" introuvable` });
          continue;
        }

        // 3. Validate year
        const yearNum = parseInt(yr);
        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
          errors.push({ line: lineNum, error: `Année invalide "${yr}" (attendu: 2020-2030)` });
          continue;
        }

        // 4. Validate initial_balance
        const balNum = parseFloat(bal);
        if (isNaN(balNum) || balNum < 0) {
          errors.push({ line: lineNum, error: `Solde initial invalide "${bal}" (attendu: nombre >= 0)` });
          continue;
        }

        // 5. Call API
        try {
          await setInitialBalance(employeeId, leaveTypeId, balNum, yearNum);
          success++;
        } catch (err) {
          errors.push({ line: lineNum, error: err instanceof Error ? err.message : 'Erreur API' });
        }
      }
      setCsvResult({ success, errors });
      setCsvProgress('');
      if (success > 0) toast.success(t.leaves.csvImportSuccess.replace('{count}', String(success)));
      if (errors.length > 0) toast.error(t.leaves.csvImportErrors.replace('{count}', String(errors.length)));
      // Reload current view if applicable
      if (selectedEmployeeId) loadBalances(selectedEmployeeId as number, selectedYear);
    } catch (err) {
      toast.error(t.leaves.csvReadError);
      console.error(err);
    } finally {
      setCsvImporting(false);
      setCsvProgress('');
    }
  };

  const downloadCsvTemplate = async () => {
    const { downloadFile } = await import('@/lib/capacitor-plugins');
    const csv = 'matricule,leave_type_code,year,initial_balance\nEMP001,CA,2026,10\nEMP002,RTT,2026,25';
    await downloadFile('\uFEFF' + csv, 'template_soldes_initiaux.csv');
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const hasChanges = getModifiedRows().length > 0;

  return (
    <div className="space-y-6">
      {/* CSV Import section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary-600" />
          {t.leaves.csvImportTitle}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {t.leaves.csvImportDescription}
        </p>
        <div className="flex gap-3">
          <button
            onClick={downloadCsvTemplate}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            <FileDown className="w-4 h-4" />
            {t.leaves.downloadTemplate}
          </button>
          <label className={`px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 text-sm cursor-pointer ${csvImporting ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            {csvImporting ? csvProgress || t.leaves.importing : t.leaves.importCsv}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              disabled={csvImporting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvImport(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {csvResult && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-medium text-gray-900 mb-1">
              {t.leaves.csvResult} : {csvResult.success} {t.leaves.csvSuccess}, {csvResult.errors.length} {t.leaves.csvErrors}
            </p>
            {csvResult.errors.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {csvResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {t.leaves.csvLine} {err.line} : {err.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sélecteurs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.employee}</label>
            {loadingEmployees ? (
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <CustomSelect
                value={selectedEmployeeId ? String(selectedEmployeeId) : ''}
                onChange={(v) => setSelectedEmployeeId(v ? parseInt(v) : '')}
                placeholder="Sélectionner un employé..."
                options={[
                  { value: '', label: 'Sélectionner un employé...' },
                  ...employees.map((emp) => ({
                    value: String(emp.id),
                    label: `${emp.first_name} ${emp.last_name}${emp.department_name ? ` — ${emp.department_name}` : ''}`,
                  })),
                ]}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
            <CustomSelect
              value={String(selectedYear)}
              onChange={(v) => setSelectedYear(parseInt(v))}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>
          {selectedEmployeeId && (
            <button
              onClick={handleInitialize}
              disabled={initializing}
              className="px-4 py-2 border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${initializing ? 'animate-spin' : ''}`} />
              {balances.length === 0 ? 'Initialiser les soldes' : 'Réinitialiser les soldes'}
            </button>
          )}
        </div>
        {selectedEmployee && (
          <p className="mt-3 text-sm text-gray-500">
            {selectedEmployee.first_name} {selectedEmployee.last_name}
            {selectedEmployee.hire_date && ` · Embauché(e) le ${new Date(selectedEmployee.hire_date).toLocaleDateString('fr-FR')}`}
          </p>
        )}
      </div>

      {/* Table des soldes — all fields directly editable */}
      {selectedEmployeeId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Soldes {selectedYear}
              {loadingBalances && <span className="ml-2 text-xs text-gray-400">(chargement...)</span>}
            </h3>
            <span className="text-sm text-gray-500">{balances.length} type{balances.length !== 1 ? 's' : ''}</span>
          </div>

          {!loadingBalances && balances.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>Aucun solde pour {selectedYear}.</p>
              <button
                onClick={handleInitialize}
                disabled={initializing}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                Réinitialiser les soldes
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Type de congé</th>
                      <th className="px-4 py-3 text-right">Alloué</th>
                      <th className="px-4 py-3 text-right">Solde initial</th>
                      <th className="px-4 py-3 text-right">Report N-1</th>
                      <th className="px-4 py-3 text-right">Pris</th>
                      <th className="px-4 py-3 text-right">En attente</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Disponible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {balances.map((bal) => {
                      const e = edits[bal.id] || { allocated: String(bal.allocated), initial_balance: String(bal.initial_balance), carried_over: String(bal.carried_over) };
                      const changed =
                        String(bal.allocated) !== e.allocated ||
                        String(bal.initial_balance) !== e.initial_balance ||
                        String(bal.carried_over) !== e.carried_over;
                      return (
                        <tr key={bal.id} className={changed ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{bal.leave_type_name}</div>
                            <div className="text-xs text-gray-400">{bal.leave_type_code}{bal.accrual_rate ? ` · ${bal.accrual_rate} j/mois` : ''}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number" min="0" step="0.5"
                              value={e.allocated}
                              onChange={(ev) => setEdits((prev) => ({ ...prev, [bal.id]: { ...prev[bal.id], allocated: ev.target.value } }))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-primary-400 focus:border-primary-400"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number" min="0" step="0.5"
                              value={e.initial_balance}
                              onChange={(ev) => setEdits((prev) => ({ ...prev, [bal.id]: { ...prev[bal.id], initial_balance: ev.target.value } }))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-primary-400 focus:border-primary-400"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number" min="0" step="0.5"
                              value={e.carried_over}
                              onChange={(ev) => setEdits((prev) => ({ ...prev, [bal.id]: { ...prev[bal.id], carried_over: ev.target.value } }))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-primary-400 focus:border-primary-400"
                            />
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">{bal.taken} j</td>
                          <td className="px-4 py-3 text-right text-amber-600">{bal.pending} j</td>
                          <td className={`px-4 py-3 text-right font-semibold ${bal.available < 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {bal.available} j
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Global save button */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={handleSaveAll}
                  disabled={savingAll || !hasChanges}
                  className={`px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                    hasChanges
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {savingAll ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enregistrement...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Enregistrer tout</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!selectedEmployeeId && (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Sélectionnez un employé pour voir et modifier ses soldes.</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// SICK DECLARATIONS
// ============================================

interface SickDeclaration {
  id: number;
  leave_id: number;
  employee_id: number;
  declared_by: number;
  sick_start_date: string;
  estimated_duration_days: number;
  estimated_end_date: string;
  actual_end_date?: string | null;
  certificate_url: string;
  certificate_filename?: string | null;
  status: string;
  recovery_type?: string | null;
  days_credited?: number | null;
  notes?: string | null;
  created_at: string;
  employee_name?: string;
}

const SICK_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'En cours', bg: 'bg-orange-100', text: 'text-orange-800' },
  prolongee: { label: 'Prolongée', bg: 'bg-orange-100', text: 'text-orange-800' },
  guerie_conge_repris: { label: 'Congé repris', bg: 'bg-green-100', text: 'text-green-800' },
  guerie_retour_travail: { label: 'Retour travail', bg: 'bg-blue-100', text: 'text-blue-800' },
  cloture: { label: 'Clôturé', bg: 'bg-gray-100', text: 'text-gray-800' },
};

async function getSickDeclarations(params: { status?: string } = {}): Promise<SickDeclaration[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.append('status', params.status);
  const response = await fetch(`${API_URL}/api/leave-sick-declarations/?${qs.toString()}`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function createSickDeclarationRH(payload: {
  leave_id: number;
  sick_start_date: string;
  estimated_duration_days: number;
  notes?: string;
  certificate: File;
}): Promise<void> {
  const fd = new FormData();
  fd.append('leave_id', String(payload.leave_id));
  fd.append('sick_start_date', payload.sick_start_date);
  fd.append('estimated_duration_days', String(payload.estimated_duration_days));
  if (payload.notes) fd.append('notes', payload.notes);
  fd.append('certificate', payload.certificate);
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const response = await fetch(`${API_URL}/api/leave-sick-declarations/`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur');
  }
}

async function recoverSickDeclarationRH(id: number, recovery_type: 'resume_leave' | 'return_to_work'): Promise<void> {
  const response = await fetch(`${API_URL}/api/leave-sick-declarations/${id}/recover`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ recovery_type }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur');
  }
}

function SickStatusBadge({ status }: { status: string }) {
  const cfg = SICK_STATUS_CONFIG[status] || SICK_STATUS_CONFIG.active;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function SickDeclarationsTab({
  declarations,
  onNew,
  onRefresh,
  onRecover,
  statusFilter,
  setStatusFilter,
  searchTerm,
  setSearchTerm,
}: {
  declarations: SickDeclaration[];
  onNew: () => void;
  onRefresh: () => void;
  onRecover: (d: SickDeclaration) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
}) {
  const { t } = useI18n();
  const total = declarations.length;
  const inProgress = declarations.filter((d) => d.status === 'active' || d.status === 'prolongee').length;
  const closed = declarations.filter((d) => d.status === 'cloture' || d.status.startsWith('guerie')).length;
  const totalDays = declarations.reduce((sum, d) => sum + (d.estimated_duration_days || 0), 0);

  const filtered = declarations.filter((d) => {
    if (statusFilter === 'active' && !(d.status === 'active' || d.status === 'prolongee')) return false;
    if (statusFilter === 'closed' && !(d.status === 'cloture' || d.status.startsWith('guerie'))) return false;
    if (searchTerm && !(d.employee_name || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Heart} value={total} label={t.leaves.totalDeclarations} color="bg-orange-500" />
        <StatCard icon={Clock} value={inProgress} label={t.leaves.inProgress} color="bg-yellow-500" />
        <StatCard icon={CheckCircle} value={closed} label={t.leaves.closed} color="bg-green-500" />
        <StatCard icon={Calendar} value={`${totalDays}j`} label={t.leaves.sickDays} color="bg-blue-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Heart className="w-5 h-5 text-orange-500" /> {t.leaves.sickDeclarationsTitle}
          </h3>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.leaves.searchCollaborator}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <CustomSelect
              value={statusFilter}
              onChange={v => setStatusFilter(v)}
              options={[
                { value: 'all', label: t.leaves.allFilter },
                { value: 'active', label: t.leaves.activeFilter },
                { value: 'closed', label: t.leaves.closedFilter },
              ]}
              className="min-w-[130px]"
            />
            <button
              onClick={onRefresh}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              title={t.employees.refresh}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onNew}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t.leaves.newDeclaration}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.collaborator}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.leave}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.sickStart}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.estimatedEnd}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.actualEnd}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.duration}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.common.status}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.certificate}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">{d.employee_name || `#${d.employee_id}`}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">{t.leaves.leave} #{d.leave_id}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">{new Date(d.sick_start_date).toLocaleDateString(t.dashboard.dateLocale)}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">{new Date(d.estimated_end_date).toLocaleDateString(t.dashboard.dateLocale)}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {d.actual_end_date ? new Date(d.actual_end_date).toLocaleDateString(t.dashboard.dateLocale) : '—'}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">{d.estimated_duration_days}j</td>
                  <td className="px-4 py-4"><SickStatusBadge status={d.status} /></td>
                  <td className="px-4 py-4">
                    <a
                      href={d.certificate_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> {t.leaves.view}
                    </a>
                  </td>
                  <td className="px-4 py-4">
                    {(d.status === 'active' || d.status === 'prolongee') && (
                      <button
                        onClick={() => onRecover(d)}
                        className="text-sm text-green-600 hover:text-green-700 font-medium"
                      >
                        {t.leaves.close}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>{t.leaves.noDeclaration}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewSickDeclarationModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [onLeaveList, setOnLeaveList] = useState<LeaveRequest[]>([]);
  const [leaveId, setLeaveId] = useState('');
  const [sickStartDate, setSickStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(1);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const data = await getLeaveRequests({ status: 'approved', page: 1, page_size: 100 });
      const today = new Date().toISOString().slice(0, 10);
      setOnLeaveList(data.items.filter((l) => l.start_date <= today && l.end_date >= today));
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveId || !file) {
      toast.error(t.leaves.collaboratorAndCertificateRequired);
      return;
    }
    setSubmitting(true);
    try {
      await createSickDeclarationRH({
        leave_id: parseInt(leaveId),
        sick_start_date: sickStartDate,
        estimated_duration_days: duration,
        notes: notes || undefined,
        certificate: file,
      });
      toast.success(t.leaves.declarationCreated);
      onSuccess();
      onClose();
      setLeaveId('');
      setDuration(1);
      setNotes('');
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-orange-500" /> {t.leaves.newDeclaration}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.leaves.collaboratorOnLeaveLabel} <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={leaveId}
                onChange={(v) => setLeaveId(v)}
                placeholder={t.leaves.select}
                options={[
                  { value: '', label: t.leaves.select },
                  ...onLeaveList.map((l) => ({
                    value: String(l.id),
                    label: `${l.employee_name} — ${new Date(l.start_date).toLocaleDateString('fr-FR')} → ${new Date(l.end_date).toLocaleDateString('fr-FR')}`,
                  })),
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.leaves.sickStartDate} <span className="text-red-500">*</span>
              </label>
              <CustomDatePicker value={sickStartDate} onChange={setSickStartDate} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.leaves.estimatedDuration} <span className="text-red-500">*</span>
              </label>
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.leaves.medicalCertificate} <span className="text-red-500">*</span>
              </label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-700" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.notes}</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {submitting ? t.leaves.sending : t.leaves.declare}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function RecoverSickModalRH({
  declaration,
  onClose,
  onSuccess,
}: {
  declaration: SickDeclaration | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [recoveryType, setRecoveryType] = useState<'resume_leave' | 'return_to_work'>('resume_leave');
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();

  if (!declaration) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recoverSickDeclarationRH(declaration.id, recoveryType);
      toast.success(t.leaves.declarationClosed);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t.leaves.closeSickness}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                recoveryType === 'resume_leave' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input type="radio" checked={recoveryType === 'resume_leave'} onChange={() => setRecoveryType('resume_leave')} className="mt-1" />
                <div>
                  <div className="font-medium text-gray-900">{t.leaves.resumeLeave}</div>
                  <div className="text-xs text-gray-600">{t.leaves.resumeLeaveDescription}</div>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                recoveryType === 'return_to_work' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input type="radio" checked={recoveryType === 'return_to_work'} onChange={() => setRecoveryType('return_to_work')} className="mt-1" />
                <div>
                  <div className="font-medium text-gray-900">{t.leaves.returnToWork}</div>
                  <div className="text-xs text-gray-600">{t.leaves.returnToWorkDescription}</div>
                </div>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {submitting ? t.leaves.sending : t.leaves.close}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function LeavesManagementPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'requests' | 'calendar' | 'settings' | 'balances' | 'recalls' | 'sick'>('requests');
  const [recalls, setRecalls] = useState<LeaveRecall[]>([]);
  const [sickDeclarations, setSickDeclarations] = useState<SickDeclaration[]>([]);
  const [showNewSickModal, setShowNewSickModal] = useState(false);
  const [recoverSickDecl, setRecoverSickDecl] = useState<SickDeclaration | null>(null);
  const [sickStatusFilter, setSickStatusFilter] = useState('all');
  const [sickSearchTerm, setSickSearchTerm] = useState('');

  const loadSickDeclarations = useCallback(async () => {
    const data = await getSickDeclarations();
    setSickDeclarations(data);
  }, []);
  const [showNewRecallModal, setShowNewRecallModal] = useState(false);
  const [selectedRecall, setSelectedRecall] = useState<LeaveRecall | null>(null);
  const [recallPolicy, setRecallPolicy] = useState<'employee_chooses' | 'employer_decides'>('employee_chooses');
  const [currentUserRole, setCurrentUserRole] = useState<string>('employee');

  const loadRecalls = useCallback(async () => {
    const data = await getLeaveRecalls();
    setRecalls(data);
  }, []);

  useEffect(() => {
    setCurrentUserRole(getUserFromStorage().role);
    getTenantRecallPolicy().then(setRecallPolicy);
  }, []);

  useEffect(() => {
    if (activeTab === 'recalls') loadRecalls();
    if (activeTab === 'sick') loadSickDeclarations();
  }, [activeTab, loadRecalls, loadSickDeclarations]);

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<LeaveStats | null>(null);
  const [calendarLeaves, setCalendarLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Page Tour Hook
  const { showTips, dismissTips, resetTips } = usePageTour('leaves');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>();
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<number | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Calendar
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);

  // Modals
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showNewLeaveModal, setShowNewLeaveModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [typesData, deptData, statsData] = await Promise.all([
        getLeaveTypes(),
        getDepartments(),
        getLeaveStats()
      ]);
      setLeaveTypes(typesData);
      setDepartments(deptData);
      setStats(statsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    const data = await getLeaveRequests({
      status: statusFilter,
      department_id: departmentFilter,
      leave_type_id: leaveTypeFilter,
      page,
      page_size: 10
    });
    setRequests(data.items);
    setTotalRequests(data.total);
  }, [statusFilter, departmentFilter, leaveTypeFilter, page]);

  const loadCalendar = useCallback(async () => {
    const data = await getLeaveCalendar(calendarYear, calendarMonth);
    setCalendarLeaves(data);
  }, [calendarYear, calendarMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (activeTab === 'calendar') {
      loadCalendar();
    }
  }, [activeTab, loadCalendar]);

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const exportToCSV = async () => {
    const { downloadFile } = await import('@/lib/capacitor-plugins');
    const rows = requests.map(r => [
      r.employee_name ?? '',
      r.department_name ?? '',
      r.leave_type_name ?? '',
      r.start_date ?? '',
      r.end_date ?? '',
      r.days_requested ?? '',
      r.status ?? '',
      r.reason ?? '',
    ]);
    const header = ['Employé', 'Département', 'Type', 'Début', 'Fin', 'Jours', 'Statut', 'Motif'];
    const csv = [header, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    await downloadFile('\uFEFF' + csv, `conges_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const filteredRequests = requests.filter(r => {
    if (!searchTerm) return true;
    return r.employee_name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <>
        <Header title={t.leaves.title} subtitle={t.leaves.subtitle} />
        <div className="flex-1 flex items-center justify-center p-20">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={t.leaves.title} subtitle={t.leaves.subtitle} />
      {showTips && (
        <PageTourTips
          tips={leavesTips}
          onDismiss={dismissTips}
          pageTitle={t.leaves.title}
        />
      )}
      <div className="py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mb-6">
            <button
              onClick={() => setShowNewLeaveModal(true)}
              className="px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t.leaves.newRequest}</span>
            </button>
            {['rh', 'admin', 'dg', 'super_admin'].includes(currentUserRole) && (
              <>
                <button
                  onClick={() => setShowInitModal(true)}
                  className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t.leaves.initializeBalances}</span>
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.leaves.exportCsv}</span>
                </button>
              </>
            )}
          </div>

        {/* Stats */}
        {stats && (
          <div data-tour="leaves-stats" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <StatCard icon={BarChart3} value={stats.total_requests} label={t.leaves.stats.totalRequests} color="bg-primary-500" />
            <StatCard icon={Clock} value={stats.pending} label={t.leaves.stats.pending} color="bg-yellow-500" />
            <StatCard icon={CheckCircle} value={stats.approved} label={t.leaves.stats.approved} color="bg-green-500" />
            <StatCard icon={XCircle} value={stats.rejected} label={t.leaves.stats.refused} color="bg-red-500" />
            <StatCard icon={Users} value={stats.on_leave_today} label={t.leaves.stats.onLeaveToday2} color="bg-orange-500" />
            <StatCard icon={Calendar} value={`${stats.avg_days_per_request}j`} label={t.leaves.stats.avgDaysPerRequest} color="bg-purple-500" />
          </div>
        )}

        {/* Tabs */}
        <div data-tour="leaves-tabs" className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg overflow-x-auto max-w-full" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {([
            { key: 'requests', label: t.leaves.tabs.requests, icon: Clock, roles: ['employee', 'manager', 'rh', 'admin', 'dg', 'super_admin'] as string[] },
            { key: 'calendar', label: t.leaves.tabs.calendar, icon: CalendarDays, roles: ['employee', 'manager', 'rh', 'admin', 'dg', 'super_admin'] as string[] },
            { key: 'balances', label: t.leaves.tabs.balances, icon: BarChart3, roles: ['rh', 'admin', 'dg', 'super_admin'] as string[] },
            { key: 'recalls', label: t.leaves.tabs.recalls, icon: AlertCircle, roles: ['manager', 'rh', 'admin', 'dg', 'super_admin'] as string[] },
            { key: 'sick', label: t.leaves.tabs.sickDeclarations, icon: Heart, roles: ['manager', 'rh', 'admin', 'dg', 'super_admin'] as string[] },
            { key: 'settings', label: t.leaves.tabs.settings, icon: Settings, roles: ['rh', 'admin', 'dg', 'super_admin'] as string[] },
          ]).filter((tab) => tab.roles.includes(currentUserRole)).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'requests' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Filters */}
            <div data-tour="leaves-filters" className="p-4 border-b border-gray-200 grid grid-cols-1 sm:flex sm:flex-wrap gap-3 sm:gap-4">
              <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder={t.leaves.searchEmployee}
                />
              </div>
              <CustomSelect
                value={statusFilter}
                onChange={v => { setStatusFilter(v); setPage(1); }}
                options={[
                  { value: 'all', label: t.leaves.allStatuses },
                  { value: 'pending', label: t.leaves.pending },
                  { value: 'approved', label: t.leaves.stats.approved },
                  { value: 'rejected', label: t.leaves.stats.refused },
                ]}
                className="min-w-[140px]"
              />
              {['rh', 'admin', 'dg', 'super_admin'].includes(currentUserRole) && (
                <CustomSelect
                  value={departmentFilter ? String(departmentFilter) : ''}
                  onChange={v => { setDepartmentFilter(v ? parseInt(v) : undefined); setPage(1); }}
                  options={[
                    { value: '', label: t.leaves.allDepartments },
                    ...departments.map(dept => ({ value: String(dept.id), label: dept.name })),
                  ]}
                  className="min-w-[140px]"
                />
              )}
              <CustomSelect
                value={leaveTypeFilter ? String(leaveTypeFilter) : ''}
                onChange={v => { setLeaveTypeFilter(v ? parseInt(v) : undefined); setPage(1); }}
                options={[
                  { value: '', label: t.leaves.allTypes },
                  ...leaveTypes.map(lt => ({ value: String(lt.id), label: lt.name })),
                ]}
                className="min-w-[140px]"
              />
              <button
                onClick={loadRequests}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title={t.employees.refresh}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.employee}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.type}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.period}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.days}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.leaves.status}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{request.employee_name}</p>
                          <p className="text-sm text-gray-500">{request.department_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">{request.leave_type_name}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {new Date(request.start_date).toLocaleDateString('fr-FR')}
                        {request.start_date !== request.end_date && (
                          <> → {new Date(request.end_date).toLocaleDateString('fr-FR')}</>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{request.days_requested}</td>
                      <td className="px-4 py-4"><StatusBadge status={request.status} /></td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {request.status === 'pending' ? t.leaves.process : t.leaves.view}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredRequests.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>{t.leaves.noRequestFound}</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <Pagination page={page} total={totalRequests} pageSize={10} onPageChange={setPage} />
          </div>
        )}

        {activeTab === 'calendar' && (
          <LeaveCalendar
            year={calendarYear}
            month={calendarMonth}
            leaves={calendarLeaves}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        )}

        {activeTab === 'balances' && (
          <EmployeeBalancesTab leaveTypes={leaveTypes} />
        )}

        {activeTab === 'sick' && (
          <SickDeclarationsTab
            declarations={sickDeclarations}
            onNew={() => setShowNewSickModal(true)}
            onRefresh={loadSickDeclarations}
            onRecover={(d) => setRecoverSickDecl(d)}
            statusFilter={sickStatusFilter}
            setStatusFilter={setSickStatusFilter}
            searchTerm={sickSearchTerm}
            setSearchTerm={setSickSearchTerm}
          />
        )}

        {activeTab === 'recalls' && (
          <RecallsTab
            recalls={recalls}
            userRole={currentUserRole}
            onNew={() => setShowNewRecallModal(true)}
            onSelect={(r) => setSelectedRecall(r)}
            onRefresh={loadRecalls}
          />
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600" />
                {t.leaves.leaveTypesSettings}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {t.leaves.leaveTypesSettingsDescription}
              </p>
              <button
                onClick={() => setShowTypesModal(true)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {t.leaves.manageTypes}
              </button>
            </div>

            {['admin', 'rh'].includes(currentUserRole) && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary-600" />
                  {t.leaves.recallCompensationPolicy}
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                  {t.leaves.recallCompensationPolicyDescription}
                </p>
                <div className="space-y-2">
                  {([
                    { value: 'employee_chooses', label: t.leaves.employeeChoosesCompensation },
                    { value: 'employer_decides', label: t.leaves.employerDecidesCompensation },
                  ] as const).map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="recall_compensation_policy"
                        value={opt.value}
                        checked={recallPolicy === opt.value}
                        onChange={async () => {
                          const previous = recallPolicy;
                          setRecallPolicy(opt.value);
                          try {
                            await updateTenantRecallPolicy(opt.value);
                            toast.success(t.leaves.policyUpdated);
                          } catch (err) {
                            setRecallPolicy(previous);
                            toast.error(err instanceof Error ? err.message : 'Erreur');
                          }
                        }}
                        className="w-4 h-4 text-primary-600"
                      />
                      <span className="text-sm text-gray-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary-600" />
                {t.leaves.annualInitialization}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {t.leaves.annualInitializationDescription}
              </p>
              <button
                onClick={() => setShowInitModal(true)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {t.leaves.initializeBalancesBtn}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Modals */}
      <LeaveTypesModal
        isOpen={showTypesModal}
        onClose={() => setShowTypesModal(false)}
        leaveTypes={leaveTypes}
        onRefresh={loadData}
      />

      <InitializeBalancesModal
        isOpen={showInitModal}
        onClose={() => setShowInitModal(false)}
        onSuccess={() => { loadData(); loadRequests(); }}
      />

      <RequestActionModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onSuccess={() => { loadRequests(); loadData(); }}
      />

      <NewLeaveRequestModal
        isOpen={showNewLeaveModal}
        onClose={() => setShowNewLeaveModal(false)}
        leaveTypes={leaveTypes}
        onSuccess={() => { loadRequests(); loadData(); }}
      />

      <NewRecallModal
        isOpen={showNewRecallModal}
        onClose={() => setShowNewRecallModal(false)}
        policy={recallPolicy}
        onSuccess={() => { loadRecalls(); }}
      />

      <RecallDetailModal
        recall={selectedRecall}
        userRole={currentUserRole}
        policy={recallPolicy}
        onClose={() => setSelectedRecall(null)}
        onSuccess={() => { loadRecalls(); }}
      />

      <NewSickDeclarationModal
        isOpen={showNewSickModal}
        onClose={() => setShowNewSickModal(false)}
        onSuccess={loadSickDeclarations}
      />
      <RecoverSickModalRH
        declaration={recoverSickDecl}
        onClose={() => setRecoverSickDecl(null)}
        onSuccess={loadSickDeclarations}
      />
    </>
  );
}