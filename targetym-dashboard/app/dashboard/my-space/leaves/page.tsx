'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import {
  Calendar, Plus, X, AlertCircle, Clock, CheckCircle, XCircle, Info, ChevronDown, ChevronUp, Heart, FileText
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  employee_id?: number;
}

interface LeaveBalance {
  id: number;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code: string;
  allocated: number;
  taken: number;
  pending: number;
  carried_over: number;
  available: number;
  initial_balance?: number;
  accrued?: number;
  accrual_rate?: number;
}

interface LeaveBalanceSummary {
  employee_id: number;
  employee_name: string;
  year: number;
  balances: LeaveBalance[];
  total_available: number;
  total_taken: number;
  total_pending: number;
}

interface LeaveRequest {
  id: number;
  employee_id: number;
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

interface LeaveType {
  id: number;
  name: string;
  code: string;
  default_days: number;
  is_active: boolean;
  is_annual?: boolean;
  accrual_rate?: number;
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

async function getCurrentUser(): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function getLeaveBalances(employeeId: number): Promise<LeaveBalanceSummary> {
  const response = await fetch(`${API_URL}/api/leaves/balances/${employeeId}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function getLeaveTypes(): Promise<LeaveType[]> {
  const response = await fetch(`${API_URL}/api/leaves/types`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function getMyLeaveRequests(employeeId: number): Promise<LeaveRequest[]> {
  const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${employeeId}&page_size=50`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

async function createLeaveRequest(employeeId: number, data: {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
  start_half_day?: boolean;
  end_half_day?: boolean;
}): Promise<LeaveRequest> {
  const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${employeeId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur');
  }
  return response.json();
}

interface MyLeaveRecall {
  id: number;
  leave_id: number;
  recall_date: string;
  recall_reason: string;
  nb_days_recalled: number;
  is_urgent: boolean;
  status: string;
  compensation_type?: string | null;
  compensation_days?: number | null;
  compensation_end_date?: string | null;
}

async function getMyRecalls(employeeId: number): Promise<MyLeaveRecall[]> {
  try {
    const response = await fetch(`${API_URL}/api/leave-recalls/?employee_id=${employeeId}`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : (data.items || []);
  } catch {
    return [];
  }
}

async function proposeRecallCompensation(recallId: number, payload: {
  compensation_type: 'solde' | 'prolongation';
}): Promise<void> {
  const response = await fetch(`${API_URL}/api/leave-recalls/${recallId}/propose-compensation`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur');
  }
}

async function declareRecallReturn(recallId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leave-recalls/${recallId}/declare-return`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur');
}

async function getMyTenantRecallPolicy(): Promise<'employee_chooses' | 'employer_decides'> {
  try {
    const response = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
    if (!response.ok) return 'employee_chooses';
    const data = await response.json();
    return (data.recall_compensation_policy || 'employee_chooses') as 'employee_chooses' | 'employer_decides';
  } catch {
    return 'employee_chooses';
  }
}

function getRecallStatusLabels(t: any): Record<string, { label: string; className: string }> {
  return {
    initie: { label: t.mySpace.recallStatusInitiated, className: 'bg-gray-100 text-gray-800' },
    valide_rh: { label: t.mySpace.recallStatusValidatedHR, className: 'bg-blue-100 text-blue-800' },
    notifie: { label: t.mySpace.recallStatusNotified, className: 'bg-orange-100 text-orange-800' },
    compensation_proposee: { label: t.mySpace.recallStatusCompensationProposed, className: 'bg-purple-100 text-purple-800' },
    compensation_validee: { label: t.mySpace.recallStatusCompensationValidated, className: 'bg-cyan-100 text-cyan-800' },
    retour_declare: { label: t.mySpace.recallStatusReturnDeclared, className: 'bg-yellow-100 text-yellow-800' },
    cloture: { label: t.mySpace.recallStatusClosed, className: 'bg-green-100 text-green-800' },
  };
}

// ============================================
// SICK DECLARATIONS
// ============================================

interface SickDeclaration {
  id: number;
  leave_id: number;
  employee_id: number;
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
  is_extension?: boolean;
  extension_certificate_url?: string | null;
  created_at: string;
}

function getSickStatusLabels(t: any): Record<string, { label: string; className: string; border: string }> {
  return {
    active: { label: t.mySpace.sickStatusActive, className: 'bg-orange-100 text-orange-800', border: 'border-l-orange-500' },
    prolongee: { label: t.mySpace.sickStatusExtended, className: 'bg-orange-100 text-orange-800', border: 'border-l-orange-500' },
    guerie_conge_repris: { label: t.mySpace.sickStatusResumedLeave, className: 'bg-green-100 text-green-800', border: 'border-l-green-500' },
    guerie_retour_travail: { label: t.mySpace.sickStatusReturnedWork, className: 'bg-blue-100 text-blue-800', border: 'border-l-blue-500' },
    cloture: { label: t.mySpace.sickStatusClosed, className: 'bg-gray-100 text-gray-800', border: 'border-l-gray-400' },
  };
}

async function getMySickDeclarations(employeeId: number): Promise<SickDeclaration[]> {
  try {
    const response = await fetch(`${API_URL}/api/leave-sick-declarations/?employee_id=${employeeId}`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function createSickDeclaration(payload: {
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

async function extendSickDeclaration(id: number, payload: {
  additional_days: number;
  notes?: string;
  certificate: File;
}): Promise<void> {
  const fd = new FormData();
  fd.append('additional_days', String(payload.additional_days));
  if (payload.notes) fd.append('notes', payload.notes);
  fd.append('certificate', payload.certificate);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const response = await fetch(`${API_URL}/api/leave-sick-declarations/${id}/extend`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur');
  }
}

async function recoverSickDeclaration(id: number, recovery_type: 'resume_leave' | 'return_to_work'): Promise<void> {
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

async function cancelLeaveRequest(requestId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/requests/${requestId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur');
}

// ============================================
// COMPONENTS
// ============================================

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const configs: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: t.mySpace.statusPending, icon: <Clock className="w-3.5 h-3.5" /> },
    approved: { bg: 'bg-green-100', text: 'text-green-800', label: t.mySpace.statusApproved, icon: <CheckCircle className="w-3.5 h-3.5" /> },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: t.mySpace.statusRejected, icon: <XCircle className="w-3.5 h-3.5" /> },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: t.mySpace.statusCancelled, icon: <X className="w-3.5 h-3.5" /> },
    suspendu_maladie: { bg: 'bg-orange-100', text: 'text-orange-800', label: t.mySpace.statusSuspendedSick, icon: <Heart className="w-3.5 h-3.5" /> },
  };
  
  const config = configs[status] || configs.pending;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function BalanceCard({ balance }: { balance: LeaveBalance }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900">{balance.leave_type_name}</span>
        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
          {balance.leave_type_code}
        </span>
      </div>
      <div className="text-2xl font-bold text-primary-600 mb-2">
        {balance.available}
        <span className="text-sm font-normal text-gray-500"> {t.mySpace.daysAvailable}</span>
      </div>
      <div className="flex gap-4 text-xs text-gray-500 mb-2">
        <span>{t.mySpace.taken}: {balance.taken}</span>
        {balance.pending > 0 && (
          <span className="text-yellow-600">{t.mySpace.pendingTab}: {balance.pending}</span>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        <Info className="w-3.5 h-3.5" />
        {t.mySpace.balanceDetail}
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5 text-xs text-gray-600">
          {balance.initial_balance !== undefined && (
            <div className="flex justify-between">
              <span>{t.mySpace.initialBalance}</span>
              <span className="font-medium text-gray-900">{balance.initial_balance} j</span>
            </div>
          )}
          {balance.carried_over > 0 && (
            <div className="flex justify-between">
              <span>{t.mySpace.carryOver}</span>
              <span className="font-medium text-gray-900">{balance.carried_over} j</span>
            </div>
          )}
          {balance.accrued !== undefined && (
            <div className="flex justify-between">
              <span>{t.mySpace.accruedThisYear} {balance.accrual_rate ? `(${balance.accrual_rate}×mois)` : ''}</span>
              <span className="font-medium text-gray-900">{balance.accrued} j</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t.mySpace.taken}</span>
            <span className="font-medium text-gray-900">-{balance.taken} j</span>
          </div>
          {balance.pending > 0 && (
            <div className="flex justify-between">
              <span>{t.mySpace.pendingTab}</span>
              <span className="font-medium text-yellow-600">-{balance.pending} j</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t border-gray-200 font-semibold text-gray-900">
            <span>{t.mySpace.available}</span>
            <span>{balance.available} j</span>
          </div>
        </div>
      )}
    </div>
  );
}

function NewLeaveRequestModal({
  isOpen,
  onClose,
  leaveTypes,
  employeeId,
  balances,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  leaveTypes: LeaveType[];
  employeeId: number;
  balances: LeaveBalanceSummary | null;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    start_half_day: false,
    end_half_day: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setError(t.mySpace.fillRequired);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await createLeaveRequest(employeeId, {
        leave_type_id: parseInt(formData.leave_type_id),
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason || undefined,
        start_half_day: formData.start_half_day,
        end_half_day: formData.end_half_day,
      });
      onSuccess();
      onClose();
      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        start_half_day: false,
        end_half_day: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{t.mySpace.newLeaveRequest}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.mySpace.leaveTypeLabel} <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={formData.leave_type_id}
                onChange={(v) => setFormData({ ...formData, leave_type_id: v })}
                placeholder={t.mySpace.selectType}
                options={[
                  { value: '', label: t.mySpace.selectType },
                  ...leaveTypes.map((type) => {
                    const bal = balances?.balances.find((b) => b.leave_type_id === type.id);
                    let suffix = '';
                    if (bal) suffix = ` — ${bal.available} j disponibles`;
                    else if (type.is_annual) suffix = type.accrual_rate ? ` — ${type.accrual_rate} j/mois` : '';
                    else if (type.default_days > 0) suffix = ` — quota : ${type.default_days} j/an`;
                    else suffix = ' — sans quota fixe';
                    return { value: String(type.id), label: `${type.name} (${type.code})${suffix}` };
                  }),
                ]}
              />
            </div>

            {formData.leave_type_id && (() => {
              const typeId = parseInt(formData.leave_type_id);
              const bal = balances?.balances.find((b) => b.leave_type_id === typeId);
              const leaveType = leaveTypes.find((lt) => lt.id === typeId);
              if (bal) {
                return (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
                    {t.mySpace.availableBalance} <span className="font-bold">{bal.available} {bal.available !== 1 ? t.mySpace.daysWord : t.mySpace.dayWord}</span>
                    {bal.pending > 0 && <span className="ml-2 text-xs text-amber-600">({bal.pending} j {t.mySpace.inPending})</span>}
                  </div>
                );
              } else if (leaveType) {
                if (leaveType.is_annual) {
                  return (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                      {t.mySpace.monthlyAccrual} <span className="font-bold">{leaveType.accrual_rate ?? 2} {t.mySpace.perMonth}</span>
                      <span className="ml-2 text-xs text-blue-600">({t.mySpace.balanceToInitialize})</span>
                    </div>
                  );
                } else if (leaveType.default_days > 0) {
                  return (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                      {t.mySpace.annualAllowance} <span className="font-bold">{leaveType.default_days} {t.mySpace.daysWord}</span>
                      <span className="ml-2 text-xs text-blue-600">({t.mySpace.balanceToInitialize})</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                      {t.mySpace.noPresetBalance}
                    </div>
                  );
                }
              }
              return null;
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.mySpace.startDate} <span className="text-red-500">*</span>
                </label>
                <CustomDatePicker
                  value={formData.start_date}
                  onChange={(v) => setFormData({ ...formData, start_date: v })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.mySpace.endDate} <span className="text-red-500">*</span>
                </label>
                <CustomDatePicker
                  value={formData.end_date}
                  onChange={(v) => setFormData({ ...formData, end_date: v })}
                  min={formData.start_date || undefined}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.mySpace.reasonLabel}
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                placeholder={t.mySpace.reasonPlaceholder}
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>Note :</strong> {t.mySpace.justificativeNote}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? t.mySpace.sending : t.common.submit}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ChooseCompensationModal({
  recall,
  onClose,
  onSuccess,
}: {
  recall: MyLeaveRecall | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<'solde' | 'prolongation'>('solde');
  const [submitting, setSubmitting] = useState(false);

  if (!recall) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await proposeRecallCompensation(recall.id, {
        compensation_type: type,
      });
      toast.success(t.mySpace.compensationProposed);
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
            <h3 className="text-lg font-semibold text-gray-900">{t.mySpace.chooseMyCompensation}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">
              Compensation : <span className="font-medium text-gray-900">{recall.nb_days_recalled} {t.mySpace.dayCount}</span>
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setType('solde')}
                className={`w-full px-4 py-3 rounded-lg border text-sm text-left transition-colors ${
                  type === 'solde'
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {t.mySpace.addToBalance}
              </button>
              <button
                type="button"
                onClick={() => setType('prolongation')}
                className={`w-full px-4 py-3 rounded-lg border text-sm text-left transition-colors ${
                  type === 'prolongation'
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {t.mySpace.extendLeave}
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {submitting ? t.mySpace.sending : t.mySpace.validate}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SICK MODALS
// ============================================

function ReportSickModal({ leave, onClose, onSuccess }: {
  leave: LeaveRequest | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [sickStartDate, setSickStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(1);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!leave) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error(t.mySpace.medicalCertificateRequired);
      return;
    }
    setSubmitting(true);
    try {
      await createSickDeclaration({
        leave_id: leave.id,
        sick_start_date: sickStartDate,
        estimated_duration_days: duration,
        notes: notes || undefined,
        certificate: file,
      });
      toast.success(t.mySpace.sickDeclared);
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
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-orange-500" /> {t.mySpace.reportSickTitle}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.mySpace.sickStartDate} <span className="text-red-500">*</span>
              </label>
              <CustomDatePicker value={sickStartDate} onChange={setSickStartDate} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.mySpace.estimatedDuration} <span className="text-red-500">*</span>
              </label>
              <input type="number" min={1} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.mySpace.medicalCertificate} <span className="text-red-500">*</span>
              </label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-700" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.notes}</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {submitting ? t.mySpace.sending : t.mySpace.declare}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ExtendSickModal({ declaration, onClose, onSuccess }: {
  declaration: SickDeclaration | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [additionalDays, setAdditionalDays] = useState(1);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!declaration) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error(t.mySpace.newCertificateRequired);
      return;
    }
    setSubmitting(true);
    try {
      await extendSickDeclaration(declaration.id, {
        additional_days: additionalDays,
        notes: notes || undefined,
        certificate: file,
      });
      toast.success(t.mySpace.sickExtended);
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
            <h3 className="text-lg font-semibold text-gray-900">{t.mySpace.extendSickTitle}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.mySpace.additionalDays} <span className="text-red-500">*</span>
              </label>
              <input type="number" min={1} value={additionalDays} onChange={(e) => setAdditionalDays(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.mySpace.newMedicalCertificate} <span className="text-red-500">*</span>
              </label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-700" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.notes}</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {submitting ? t.mySpace.sending : t.mySpace.extendBtn}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function RecoverSickModal({ declaration, onClose, onSuccess }: {
  declaration: SickDeclaration | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [recoveryType, setRecoveryType] = useState<'resume_leave' | 'return_to_work'>('resume_leave');
  const [submitting, setSubmitting] = useState(false);

  if (!declaration) return null;

  const today = new Date();
  const sickStart = new Date(declaration.sick_start_date);
  const days = Math.max(0, Math.floor((today.getTime() - sickStart.getTime()) / 86400000) + 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recoverSickDeclaration(declaration.id, recoveryType);
      toast.success(t.mySpace.recoveryRecorded);
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
            <h3 className="text-lg font-semibold text-gray-900">{t.mySpace.recoveredTitle}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                recoveryType === 'resume_leave' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input type="radio" name="recovery" checked={recoveryType === 'resume_leave'}
                  onChange={() => setRecoveryType('resume_leave')} className="mt-1" />
                <div>
                  <div className="font-medium text-gray-900">{t.mySpace.resumeLeave}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{t.mySpace.resumeLeaveDesc} {days} {t.mySpace.dayCount}</div>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                recoveryType === 'return_to_work' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input type="radio" name="recovery" checked={recoveryType === 'return_to_work'}
                  onChange={() => setRecoveryType('return_to_work')} className="mt-1" />
                <div>
                  <div className="font-medium text-gray-900">{t.mySpace.returnToWork}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{t.mySpace.returnToWorkDesc}</div>
                </div>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
              <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {submitting ? t.mySpace.sending : t.common.confirm}
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

export default function MyLeavesPage() {
  const { t } = useI18n();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [balances, setBalances] = useState<LeaveBalanceSummary | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const { showTips, dismissTips, resetTips } = usePageTour('myLeaves');
  const [myRecalls, setMyRecalls] = useState<MyLeaveRecall[]>([]);
  const [recallPolicy, setRecallPolicy] = useState<'employee_chooses' | 'employer_decides'>('employee_chooses');
  const [compRecall, setCompRecall] = useState<MyLeaveRecall | null>(null);
  const [sickDeclarations, setSickDeclarations] = useState<SickDeclaration[]>([]);
  const [reportSickLeave, setReportSickLeave] = useState<LeaveRequest | null>(null);
  const [extendSickDecl, setExtendSickDecl] = useState<SickDeclaration | null>(null);
  const [recoverSickDecl, setRecoverSickDecl] = useState<SickDeclaration | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const user = await getCurrentUser();
      if (!user.employee_id) {
        setError(t.mySpace.accountNotLinked);
        return;
      }

      setEmployeeId(user.employee_id);

      const [balancesData, typesData, requestsData] = await Promise.all([
        getLeaveBalances(user.employee_id).catch(() => null),
        getLeaveTypes(),
        getMyLeaveRequests(user.employee_id),
      ]);

      setBalances(balancesData);
      setLeaveTypes(typesData);
      setRequests(requestsData);

      const [recallsData, policy, sickData] = await Promise.all([
        getMyRecalls(user.employee_id),
        getMyTenantRecallPolicy(),
        getMySickDeclarations(user.employee_id),
      ]);
      setMyRecalls(recallsData);
      setRecallPolicy(policy);
      setSickDeclarations(sickData);
    } catch (err) {
      console.error(err);
      setError(t.mySpace.loadingError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancel = async (requestId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: t.mySpace.cancelRequestTitle,
      message: 'Voulez-vous vraiment annuler cette demande ?',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await cancelLeaveRequest(requestId);
          await loadData();
          toast.success(t.mySpace.requestCancelled);
        } catch (err) {
          console.error(err);
          toast.error(t.mySpace.cancelError);
        }
      },
    });
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips pageId="myLeaves" onDismiss={dismissTips} pageTitle={t.mySpace.myLeavesTitle} />
      )}
      <Header title={t.mySpace.myLeavesTitle} subtitle={t.mySpace.myLeavesSubtitle} />
      <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-end mb-8">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            data-tour="request-leave"
          >
            <Plus className="w-5 h-5" />
            {t.mySpace.newRequest}
          </button>
        </div>

        {/* Balances */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              {t.mySpace.myBalances} ({balances?.year || new Date().getFullYear()})
            </h2>
            {balances && (
              <div className="text-right">
                <p className="text-3xl font-bold text-primary-600">{balances.total_available}</p>
                <p className="text-sm text-gray-500">{t.mySpace.daysAvailable}</p>
              </div>
            )}
          </div>

          {balances && balances.balances.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="leave-balance">
              {balances.balances.map((balance) => (
                <BalanceCard key={balance.id} balance={balance} />
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-500">{t.mySpace.noBalanceInitialized}</p>
          )}
        </div>

        {/* Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.mySpace.myRequests}</h2>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            {[
              { key: 'all', label: t.mySpace.allTab },
              { key: 'pending', label: t.mySpace.pendingTab },
              { key: 'approved', label: t.mySpace.approvedTab },
              { key: 'rejected', label: t.mySpace.rejectedTab },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.key !== 'all' && (
                  <span className="ml-1 text-xs">
                    ({requests.filter(r => r.status === tab.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>{t.mySpace.noRequestFound}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => {
                const todayStr = new Date().toISOString().split('T')[0];
                const isInProgress =
                  request.status === 'approved' &&
                  request.start_date <= todayStr &&
                  request.end_date >= todayStr;
                const activeSickDecl = sickDeclarations.find(
                  (d) => d.leave_id === request.id && d.status === 'active'
                );
                return (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-gray-900">{request.leave_type_name}</span>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        {new Date(request.start_date).toLocaleDateString('fr-FR')} 
                        {request.start_date !== request.end_date && (
                          <> → {new Date(request.end_date).toLocaleDateString('fr-FR')}</>
                        )}
                      </span>
                      <span className="font-medium">{request.days_requested} {t.mySpace.dayCount}</span>
                    </div>
                    {request.reason && (
                      <p className="mt-1 text-sm text-gray-500 italic">&quot;{request.reason}&quot;</p>
                    )}
                    {request.rejection_reason && (
                      <p className="mt-2 text-sm text-red-600">
                        <strong>{t.mySpace.rejectionReasonLabel}</strong> {request.rejection_reason}
                      </p>
                    )}
                    {request.approved_by_name && request.status === 'approved' && (
                      <p className="mt-1 text-xs text-gray-400">
                        {t.mySpace.approvedByLabel} {request.approved_by_name}
                      </p>
                    )}
                  </div>
                  
                  <div className="ml-4 flex flex-col gap-2 items-end">
                    {request.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(request.id)}
                        className="text-sm text-red-600 hover:text-red-700 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Annuler
                      </button>
                    )}
                    {isInProgress && (
                      <button
                        onClick={() => setReportSickLeave(request)}
                        className="text-sm text-orange-700 px-3 py-1.5 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors flex items-center gap-1"
                      >
                        <Heart className="w-3.5 h-3.5" /> {t.mySpace.reportSickness}
                      </button>
                    )}
                    {request.status === 'suspendu_maladie' && activeSickDecl && (
                      <>
                        <button
                          onClick={() => setExtendSickDecl(activeSickDecl)}
                          className="text-sm text-orange-700 px-3 py-1.5 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
                        >
                          {t.mySpace.extendSickness}
                        </button>
                        <button
                          onClick={() => setRecoverSickDecl(activeSickDecl)}
                          className="text-sm text-green-700 px-3 py-1.5 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                        >
                          {t.mySpace.recovered}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mes rappels de congé */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary-600" />
            {t.mySpace.myRecalls}
          </h2>
          {myRecalls.length === 0 ? (
            <p className="text-center py-6 text-gray-500 text-sm">{t.mySpace.noRecall}</p>
          ) : (
            <div className="space-y-3">
              {myRecalls.map((r, index) => {
                const MY_RECALL_STATUS_LABELS = getRecallStatusLabels(t);
                const cfg = MY_RECALL_STATUS_LABELS[r.status] || MY_RECALL_STATUS_LABELS.initie;
                return (
                  <div key={r.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{t.mySpace.recallLabel} #{index + 1}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>
                        {r.is_urgent && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">{t.mySpace.urgent}</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{new Date(r.recall_date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{r.recall_reason}</p>
                    <p className="text-xs text-gray-500 mb-2">{r.nb_days_recalled} {t.mySpace.daysRecalled}</p>
                    <div className="flex gap-2 flex-wrap">
                      {r.status === 'notifie' && recallPolicy === 'employee_chooses' && (
                        <button
                          onClick={() => setCompRecall(r)}
                          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          {t.mySpace.chooseCompensation}
                        </button>
                      )}
                      {r.status === 'notifie' && recallPolicy === 'employer_decides' && (
                        <p className="text-sm text-gray-500 italic">
                          {t.mySpace.compensationByEmployer}
                        </p>
                      )}
                      {r.status === 'compensation_validee' && (
                        <button
                          onClick={async () => {
                            try {
                              await declareRecallReturn(r.id);
                              toast.success(t.mySpace.returnDeclared);
                              await loadData();
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Erreur');
                            }
                          }}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          {t.mySpace.declareReturn}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mes déclarations de maladie */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6 overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-orange-500" />
            {t.mySpace.mySickDeclarations}
          </h2>
          {sickDeclarations.length === 0 ? (
            <p className="text-center py-6 text-gray-500 text-sm">{t.mySpace.noDeclaration}</p>
          ) : (
            <div className="space-y-3">
              {sickDeclarations.map((d) => {
                const SICK_STATUS_LABELS = getSickStatusLabels(t);
                const cfg = SICK_STATUS_LABELS[d.status] || SICK_STATUS_LABELS.active;
                const linkedLeave = requests.find((r) => r.id === d.leave_id);
                const endDate = d.actual_end_date || d.estimated_end_date;
                return (
                  <div key={d.id} className={`p-4 bg-gray-50 rounded-lg border border-gray-100 border-l-4 ${cfg.border}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{t.mySpace.declarationLabel} #{d.id}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    {linkedLeave && (
                      <p className="text-sm text-gray-600 mb-1">
                        {t.mySpace.leaveRef} <span className="font-medium">{linkedLeave.leave_type_name}</span>{' '}
                        ({new Date(linkedLeave.start_date).toLocaleDateString('fr-FR')} → {new Date(linkedLeave.end_date).toLocaleDateString('fr-FR')})
                      </p>
                    )}
                    <p className="text-sm text-gray-700 mb-1">
                      {t.mySpace.sicknessRef} {new Date(d.sick_start_date).toLocaleDateString('fr-FR')} → {new Date(endDate).toLocaleDateString('fr-FR')}
                      {!d.actual_end_date && <span className="text-xs text-gray-500"> ({t.mySpace.estimated})</span>}
                    </p>
                    {d.days_credited != null && (
                      <p className="text-xs text-gray-600 mb-1">{d.days_credited} {t.mySpace.daysCredited}</p>
                    )}
                    <div className="flex gap-2 flex-wrap mt-2">
                      <a
                        href={d.certificate_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" /> {t.mySpace.viewCertificate}
                      </a>
                      {d.extension_certificate_url && (
                        <a
                          href={d.extension_certificate_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" /> {t.mySpace.extensionCertificate}
                        </a>
                      )}
                      {d.status === 'active' && (
                        <>
                          <button
                            onClick={() => setExtendSickDecl(d)}
                            className="text-sm text-orange-700 px-3 py-1 border border-orange-200 rounded-lg hover:bg-orange-50"
                          >
                            {t.mySpace.extendBtn}
                          </button>
                          <button
                            onClick={() => setRecoverSickDecl(d)}
                            className="text-sm text-green-700 px-3 py-1 border border-green-200 rounded-lg hover:bg-green-50"
                          >
                            {t.mySpace.recovered}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {employeeId && (
        <NewLeaveRequestModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          leaveTypes={leaveTypes}
          employeeId={employeeId}
          balances={balances}
          onSuccess={loadData}
        />
      )}
      
      <ChooseCompensationModal
        recall={compRecall}
        onClose={() => setCompRecall(null)}
        onSuccess={loadData}
      />

      <ReportSickModal
        leave={reportSickLeave}
        onClose={() => setReportSickLeave(null)}
        onSuccess={loadData}
      />
      <ExtendSickModal
        declaration={extendSickDecl}
        onClose={() => setExtendSickDecl(null)}
        onSuccess={loadData}
      />
      <RecoverSickModal
        declaration={recoverSickDecl}
        onClose={() => setRecoverSickDecl(null)}
        onSuccess={loadData}
      />

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
          danger={confirmDialog.danger}
        />
      )}
    </div>    </>  );
}
