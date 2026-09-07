'use client';
import { resolveApiUrl } from '@/lib/apiUrl';
import { getToken } from '@/lib/api';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, CheckCircle, XCircle, AlertCircle,
  Download, RefreshCw, Users, Settings, BarChart3, CalendarDays,
  ChevronLeft, ChevronRight, X, Search, Plus, Brain, Sparkles,
  Upload, FileDown, Save, Heart, FileText, ArrowLeftRight
} from 'lucide-react';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';
import SearchableSelect from '@/components/SearchableSelect';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { LEGAL_COUNTRY_OPTIONS } from '@/data/countries';
import LeaveWorkflowSettingsCard from '@/components/settings/LeaveWorkflowSettingsCard';

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
  carryover_max_years?: number | null;  // nb années validité du report (null = illimité)
  carryover_expiry_month?: number | null;  // mois d'expiration (1-12, null = fin d'année)
  carryover_expiry_day?: number | null;   // jour d'expiration (null = fin du mois)
  is_active: boolean;
  requires_justification?: boolean;
  eligible_gender?: 'all' | 'female' | 'male';
  family_bonus_enabled?: boolean;
  family_bonus_eligible_gender?: 'female' | 'male';
  family_bonus_min_children?: number;
  family_bonus_days?: number;
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
  current_approval_step?: 'manager_n1' | 'manager_n2' | 'hr' | null;
  approval_steps?: Array<{
    step_order: number;
    approver_type: 'manager_n1' | 'manager_n2' | 'hr';
    approver_employee_id?: number;
    approver_name?: string;
    status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped';
    decided_by_name?: string;
    decided_at?: string;
    comment?: string;
  }>;
}

function canProcessLeaveRequest(request: LeaveRequest): boolean {
  if (typeof window === 'undefined' || !request.current_approval_step) return false;
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = String(user.role || 'employee').toLowerCase();
    if (request.current_approval_step === 'hr') {
      return ['rh', 'admin', 'dg', 'super_admin'].includes(role);
    }
    const current = request.approval_steps?.find(step => step.status === 'pending');
    return Boolean(current?.approver_employee_id && current.approver_employee_id === user.employee_id);
  } catch {
    return false;
  }
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
  employee_id?: string;
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
  recovery_balance?: number | null;
  allocated: number;
  carried_over: number;
  taken: number;
  pending: number;
  available: number;
  accrual_rate?: number;
  accrued_this_year?: number;
  months_elapsed?: number;
  is_annual?: boolean;
  family_bonus?: number;
}

interface LeaveBalanceAuditItem {
  balance_id: number;
  employee_name: string;
  leave_type_name: string;
  available: number;
  issues: Array<'negative_available' | 'negative_component' | 'annual_quota_rate_mismatch' | string>;
}

interface LeaveBalanceAuditResponse {
  total_balances: number;
  negative_balances: number;
  configuration_warnings: number;
  items: LeaveBalanceAuditItem[];
}

type BalanceImportMode = 'previous_year_carryover' | 'current_available';
type LeaveCountingMode = 'working_days' | 'calendar_days' | 'calendar_days_except_sunday';
type LeaveAccrualMode = 'prorata_30_days' | 'calendar_month';
type HonorMedalCode = 'silver' | 'vermeil' | 'gold' | 'grand_gold';
type HonorMedalBonusDays = Record<HonorMedalCode, number>;

interface LeaveConvention {
  code: string;
  country_code: string;
  name: Record<'fr' | 'en' | 'pt', string>;
  version: string;
  reference: string;
  status: string;
  calculation_status: 'reference_only';
  rules: {
    monthly_accrual_working_days: number;
    seniority_bonus_working_days: Array<{ years: number; days: number }>;
    honor_medal_bonus_working_days: number;
    honor_medal_applies_to_all_grades: boolean;
  };
}

const DEFAULT_HONOR_MEDAL_BONUS_DAYS: HonorMedalBonusDays = {
  silver: 0,
  vermeil: 0,
  gold: 0,
  grand_gold: 0,
};

function formatLeaveDays(value?: number | string | null): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

interface TenantHoliday {
  id: number;
  date: string;
  name: string;
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

const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);
const CURRENT_YEAR = new Date().getFullYear();

const HOLIDAY_COUNTRIES = [
  'Sénégal',
  'Bénin',
  'Burkina Faso',
  'Cameroun',
  'Congo-Brazzaville',
  "Côte d'Ivoire",
  'France',
  'Gabon',
  'Guinée',
  'Guinée-Bissau',
  'Mali',
  'Niger',
  'République démocratique du Congo',
  'Togo',
] as const;

type HolidayCountry = typeof HOLIDAY_COUNTRIES[number];
type LegalCountryCode = typeof LEGAL_COUNTRY_OPTIONS[number]['code'];

function isHolidayCountry(value: unknown): value is HolidayCountry {
  return typeof value === 'string' && HOLIDAY_COUNTRIES.includes(value as HolidayCountry);
}

function getAuthHeaders(): HeadersInit {
    const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null);
  const detail = payload?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message;
  }
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
  return fallback;
}

function getPublicHolidaysByCountry(
  year: number,
  country: HolidayCountry,
  t: ReturnType<typeof useI18n>['t']
): { date: string; name: string }[] {
  const common = [
    { date: `${year}-01-01`, name: t.mySpace.calendar.newYear },
    { date: `${year}-05-01`, name: t.mySpace.calendar.laborDay },
    { date: `${year}-12-25`, name: t.mySpace.calendar.christmas },
  ];

  const byCountry: Record<HolidayCountry, { date: string; name: string }[]> = {
    'Sénégal': [
      { date: `${year}-04-04`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
      { date: `${year}-11-01`, name: t.mySpace.calendar.allSaintsDay },
    ],
    'Bénin': [
      { date: `${year}-01-10`, name: 'Fête du Vodoun' },
      { date: `${year}-08-01`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
      { date: `${year}-11-01`, name: t.mySpace.calendar.allSaintsDay },
    ],
    'Burkina Faso': [
      { date: `${year}-08-05`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-12-11`, name: 'Fête nationale' },
      { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
      { date: `${year}-11-01`, name: t.mySpace.calendar.allSaintsDay },
    ],
    'Cameroun': [
      { date: `${year}-02-11`, name: 'Fête de la jeunesse' },
      { date: `${year}-05-20`, name: 'Fête nationale' },
      { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
    ],
    'Congo-Brazzaville': [
      { date: `${year}-06-10`, name: 'Fête de la Réconciliation' },
      { date: `${year}-08-15`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-11-01`, name: t.mySpace.calendar.allSaintsDay },
      { date: `${year}-11-28`, name: 'Journée de la République' },
    ],
    "Côte d'Ivoire": [
      { date: `${year}-08-07`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
      { date: `${year}-11-01`, name: t.mySpace.calendar.allSaintsDay },
      { date: `${year}-11-15`, name: 'Journée nationale de la paix' },
    ],
    'France': [
      { date: `${year}-07-14`, name: 'Fête nationale' },
      { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
      { date: `${year}-11-01`, name: t.mySpace.calendar.allSaintsDay },
      { date: `${year}-11-11`, name: 'Armistice' },
    ],
    'Gabon': [
      { date: `${year}-08-17`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
      { date: `${year}-11-01`, name: t.mySpace.calendar.allSaintsDay },
    ],
    'Guinée': [
      { date: `${year}-10-02`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
    ],
    'Guinée-Bissau': [
      { date: `${year}-01-20`, name: 'Journée des héros nationaux' },
      { date: `${year}-03-08`, name: 'Journée internationale des femmes' },
      { date: `${year}-08-03`, name: 'Journée des martyrs de Pidjiguiti' },
      { date: `${year}-09-24`, name: t.mySpace.calendar.independenceDay },
    ],
    'Mali': [
      { date: `${year}-01-20`, name: 'Fête de l’armée' },
      { date: `${year}-09-22`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-12-11`, name: 'Fête des martyrs' },
    ],
    'Niger': [
      { date: `${year}-04-24`, name: 'Journée de la concorde' },
      { date: `${year}-08-03`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-12-18`, name: 'Fête de la République' },
    ],
    'République démocratique du Congo': [
      { date: `${year}-01-04`, name: 'Journée des martyrs' },
      { date: `${year}-01-16`, name: 'Journée Laurent-Désiré Kabila' },
      { date: `${year}-01-17`, name: 'Journée Patrice Lumumba' },
      { date: `${year}-06-30`, name: t.mySpace.calendar.independenceDay },
    ],
    'Togo': [
      { date: `${year}-04-27`, name: t.mySpace.calendar.independenceDay },
      { date: `${year}-08-15`, name: t.mySpace.calendar.assumption },
      { date: `${year}-11-01`, name: t.mySpace.calendar.allSaintsDay },
    ],
  };

  return [...common, ...byCountry[country]].sort((a, b) => a.date.localeCompare(b.date));
}

async function getTenantLeaveCountingMode(): Promise<LeaveCountingMode> {
  try {
    const response = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
    if (!response.ok) return 'working_days';
    const data = await response.json();
    return (data.leave_counting_mode || 'working_days') as LeaveCountingMode;
  } catch {
    return 'working_days';
  }
}

async function getTenantLeaveAccrualMode(): Promise<LeaveAccrualMode> {
  try {
    const response = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
    if (!response.ok) return 'prorata_30_days';
    const data = await response.json();
    return (data.leave_accrual_mode || 'prorata_30_days') as LeaveAccrualMode;
  } catch {
    return 'prorata_30_days';
  }
}

async function getTenantHolidayCountry(): Promise<HolidayCountry> {
  try {
    const response = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
    if (!response.ok) return 'Sénégal';
    const data = await response.json();
    return isHolidayCountry(data.leave_holiday_country) ? data.leave_holiday_country : 'Sénégal';
  } catch {
    return 'Sénégal';
  }
}

async function getTenantLegalCountry(): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
    if (!response.ok) return '';
    const data = await response.json();
    return typeof data.legal_country_code === 'string' ? data.legal_country_code : '';
  } catch {
    return '';
  }
}

async function getTenantLeaveConvention(): Promise<{ code: string; effectiveDate: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
    if (!response.ok) return { code: '', effectiveDate: '' };
    const data = await response.json();
    return {
      code: typeof data.leave_convention_code === 'string' ? data.leave_convention_code : '',
      effectiveDate: typeof data.leave_convention_effective_date === 'string' ? data.leave_convention_effective_date : '',
    };
  } catch {
    return { code: '', effectiveDate: '' };
  }
}

async function getLeaveConventions(countryCode: string): Promise<LeaveConvention[]> {
  if (!countryCode) return [];
  const response = await fetch(
    `${API_URL}/api/leaves/conventions?country_code=${encodeURIComponent(countryCode)}`,
    { headers: getAuthHeaders() },
  );
  if (!response.ok) return [];
  return response.json();
}

async function getTenantLeaveBalanceImportMode(): Promise<{ mode: BalanceImportMode; effectiveDate: string }> {
  try {
    const response = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
    if (!response.ok) return { mode: 'current_available', effectiveDate: '' };
    const data = await response.json();
    return {
      mode: (data.leave_balance_import_mode || 'current_available') as BalanceImportMode,
      effectiveDate: typeof data.leave_balance_import_effective_date === 'string'
        ? data.leave_balance_import_effective_date
        : '',
    };
  } catch {
    return { mode: 'current_available', effectiveDate: '' };
  }
}

async function updateTenantLeaveCountingMode(value: LeaveCountingMode): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/tenant-settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ leave_counting_mode: value }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la mise à jour du décompte');
  }
}

async function updateTenantLeaveAccrualMode(value: LeaveAccrualMode): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/tenant-settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ leave_accrual_mode: value }),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Erreur lors de la mise à jour de l'acquisition"));
  }
}

async function updateTenantLegalRegime(
  legalCountryCode: LegalCountryCode | string,
  holidayCountry?: HolidayCountry,
  conventionCode?: string,
  conventionEffectiveDate?: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/tenant-settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      legal_country_code: legalCountryCode,
      ...(holidayCountry ? { leave_holiday_country: holidayCountry } : {}),
      leave_convention_code: conventionCode || null,
      leave_convention_effective_date: conventionCode ? conventionEffectiveDate : null,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la mise à jour du régime juridique');
  }
}

async function getTenantHonorMedalBonusDays(): Promise<HonorMedalBonusDays> {
  try {
    const response = await fetch(`${API_URL}/api/auth/tenant-settings`, { headers: getAuthHeaders() });
    if (!response.ok) return DEFAULT_HONOR_MEDAL_BONUS_DAYS;
    const data = await response.json();
    return { ...DEFAULT_HONOR_MEDAL_BONUS_DAYS, ...(data.honor_medal_leave_bonus_days || {}) };
  } catch {
    return DEFAULT_HONOR_MEDAL_BONUS_DAYS;
  }
}

async function updateTenantHonorMedalBonusDays(value: HonorMedalBonusDays): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/tenant-settings`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ honor_medal_leave_bonus_days: value }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la mise à jour des jours spéciaux');
  }
}

async function updateTenantLeaveBalanceImportMode(
  importMode: BalanceImportMode,
  year: number,
  effectiveDate?: string,
): Promise<{ updated_balances: number }> {
  const response = await fetch(`${API_URL}/api/leaves/balances/import-mode`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      import_mode: importMode,
      year,
      effective_date: importMode === 'current_available' ? effectiveDate : undefined,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de la mise à jour du mode d'import");
  }
  return response.json();
}

async function getTenantHolidays(year: number): Promise<TenantHoliday[]> {
  const response = await fetch(`${API_URL}/api/leaves/holidays?year=${year}`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function upsertTenantHoliday(payload: { date: string; name: string }): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/holidays`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la sauvegarde du jour férié');
  }
}

async function removeTenantHoliday(holidayId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/holidays/${holidayId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors de la suppression du jour férié');
  }
}

async function getLeaveTypes(employeeId?: number): Promise<LeaveType[]> {
  const query = employeeId ? `?employee_id=${employeeId}` : '';
  const response = await fetch(`${API_URL}/api/leaves/types${query}`, { headers: getAuthHeaders() });
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
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "La validation n'a pas pu être enregistrée"));
  }
}

async function createLeaveType(data: Partial<LeaveType>): Promise<LeaveType> {
  const response = await fetch(`${API_URL}/api/leaves/types`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Le type de congé n'a pas pu être créé"));
  }
  return response.json();
}

async function updateLeaveType(id: number, data: Partial<LeaveType>): Promise<LeaveType> {
  const response = await fetch(`${API_URL}/api/leaves/types/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Le type de congé n'a pas pu être modifié"));
  }
  return response.json();
}

async function deleteLeaveType(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/types/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Le type de congé n'a pas pu être supprimé"));
  }
}

async function rolloverBalances(year: number): Promise<{ employees_processed: number; year_closed: number; year_opened: number }> {
  const response = await fetch(`${API_URL}/api/leaves/balance/year-end-rollover?year=${year}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur lors du report des soldes');
  }
  return response.json();
}

async function initializeAllBalances(year: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/balances/initialize-all?year=${year}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "L'initialisation des soldes a échoué"));
  }
}

async function getEmployeesList(): Promise<EmployeeShort[]> {
  const pageSize = 500;
  const firstResponse = await fetch(`${API_URL}/api/employees/?page=1&page_size=${pageSize}`, { headers: getAuthHeaders() });
  if (!firstResponse.ok) return [];
  const firstData = await firstResponse.json();
  const employeesList: EmployeeShort[] = firstData.items || firstData || [];
  const totalPages = firstData.total_pages || 1;

  for (let page = 2; page <= totalPages; page++) {
    const response = await fetch(`${API_URL}/api/employees/?page=${page}&page_size=${pageSize}`, { headers: getAuthHeaders() });
    if (!response.ok) continue;
    const data = await response.json();
    employeesList.push(...(data.items || data || []));
  }

  return employeesList;
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

function getUserFromStorage(): {
  role: string;
  employeeId: number | null;
  firstName?: string;
  lastName?: string;
  hasTeamAccess: boolean;
} {
  if (typeof window === 'undefined') {
    return { role: 'employee', employeeId: null, hasTeamAccess: false };
  }
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const role = (user.role || 'employee').toLowerCase();
      return {
        role,
        employeeId: user.employee_id || null,
        firstName: user.first_name,
        lastName: user.last_name,
        hasTeamAccess:
          role === 'manager' ||
          Boolean(user.has_manager_access) ||
          Number(user.managed_employee_count || 0) > 0,
      };
    }
  } catch (e) {
    console.error('Error parsing user from localStorage:', e);
  }
  return { role: 'employee', employeeId: null, hasTeamAccess: false };
}

async function getEmployeeBalancesForYear(employeeId: number, year: number): Promise<EmployeeBalance[]> {
  const response = await fetch(`${API_URL}/api/leaves/balances/${employeeId}?year=${year}`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.balances || [];
}

async function getLeaveBalanceAudit(year: number): Promise<LeaveBalanceAuditResponse> {
  const response = await fetch(`${API_URL}/api/leaves/balances/audit?year=${year}`, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "L'audit des soldes n'a pas pu être chargé"));
  }
  return response.json();
}

async function updateBalanceAllocated(balanceId: number, allocated: number, carriedOver: number, reason: string): Promise<void> {
  const params = new URLSearchParams({
    allocated: String(allocated),
    carried_over: String(carriedOver),
    reason,
  });
  const response = await fetch(`${API_URL}/api/leaves/balances/${balanceId}?${params}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Erreur lors de la mise à jour du solde'));
}

async function resolveMatricule(matricule: string): Promise<number | null> {
  const trimmed = matricule.trim();
  if (!trimmed) return null;
  try {
    const response = await fetch(
      `${API_URL}/api/employees/?search=${encodeURIComponent(trimmed)}&page_size=50`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    // Correspondance exacte sur le matricule (employee_id)
    const exact = items.find((e: { employee_id?: string; id: number }) =>
      e.employee_id?.trim().toLowerCase() === trimmed.toLowerCase()
    );
    return exact ? exact.id : null;
  } catch {
    return null;
  }
}

async function setInitialBalance(employeeId: number, leaveTypeId: number, initialBalance: number, year: number, reason: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/balance/${employeeId}/initialize`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ leave_type_id: leaveTypeId, initial_balance: initialBalance, year, correction_reason: reason }),
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Erreur lors de la correction du solde initial'));
}

async function bulkSetInitialBalances(items: Array<{
  employee_id: number;
  leave_type_id: number;
  year: number;
  initial_balance: number;
}>, importMode: BalanceImportMode, effectiveDate?: string): Promise<{ success: number; errors: { index: number; error: string }[] }> {
  const response = await fetch(`${API_URL}/api/leaves/balances/bulk-initialize`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      items,
      import_mode: importMode,
      effective_date: importMode === 'current_available' ? effectiveDate : undefined,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Erreur import des soldes initiaux');
  }
  return response.json();
}

function detectCsvDelimiter(header: string): ',' | ';' {
  const commaCount = (header.match(/,/g) || []).length;
  const semicolonCount = (header.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvNumber(value: string): number {
  const normalized = value
    .replace(/\s/g, '')
    .replace(',', '.')
    .trim();
  return Number(normalized);
}

function normalizeCsvHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getCsvCell(
  cols: string[],
  headerIndex: Map<string, number>,
  aliases: string[],
  fallbackIndex?: number,
): string {
  for (const alias of aliases) {
    const index = headerIndex.get(normalizeCsvHeader(alias));
    if (index !== undefined) return cols[index] ?? '';
  }
  return fallbackIndex !== undefined ? cols[fallbackIndex] ?? '' : '';
}

function escapeCsvCell(value: string | number, delimiter: ',' | ';' = ';'): string {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes('\n') || text.includes('\r') || text.includes(delimiter)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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
    const detail = err.detail;
    throw new Error(
      typeof detail === 'object' && detail?.code
        ? detail.code
        : (typeof detail === 'string' ? detail : 'Erreur création demande')
    );
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
              <SearchableSelect
                value={form.leave_id}
                onChange={(val) => setForm(withCompensationDefaults({ ...form, leave_id: val }))}
                placeholder={t.leaves.select}
                options={onLeaveList.map((l) => ({
                  value: String(l.id),
                  label: `${l.employee_name ?? ''} — ${new Date(l.start_date).toLocaleDateString('fr-FR')} → ${new Date(l.end_date).toLocaleDateString('fr-FR')}`,
                  subtitle: l.leave_type_name,
                }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.recallDate} <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.recall_date}
                  onChange={(e) => setForm({ ...form, recall_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
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
                    <input
                      type="date"
                      value={form.compensation_end_date}
                      onChange={(e) => setForm({ ...form, compensation_end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
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

function StatusBadge({
  status,
  currentApprovalStep,
}: {
  status: string;
  currentApprovalStep?: LeaveRequest['current_approval_step'];
}) {
  const { t } = useI18n();
  const pendingLabel = currentApprovalStep === 'manager_n1'
    ? t.leaves.pendingN1
    : currentApprovalStep === 'manager_n2'
      ? t.leaves.pendingN2
      : currentApprovalStep === 'hr'
        ? t.leaves.pendingRh
        : t.leaves.pending;
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: pendingLabel },
    manager_approved: { bg: 'bg-blue-100', text: 'text-blue-800', label: pendingLabel },
    n2_approved: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: pendingLabel },
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
  const [editCarryoverEnabled, setEditCarryoverEnabled] = useState(false);
  const [newCarryoverEnabled, setNewCarryoverEnabled] = useState(false);
  const [newType, setNewType] = useState({ name: '', code: '', default_days: 0, is_annual: false, accrual_rate: 2.0, eligible_gender: 'all' as 'all' | 'female' | 'male', family_bonus_enabled: false, family_bonus_eligible_gender: 'female' as 'female' | 'male', family_bonus_min_children: 4, family_bonus_days: 2, max_carryover: null as number | null, carryover_max_years: 1 as number | null, carryover_expiry_month: null as number | null, carryover_expiry_day: null as number | null });
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
      const message = e instanceof Error ? e.message : "La validation n'a pas pu être enregistrée";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddType = async () => {
    if (!newType.name || !newType.code) return;
    setSaving(true);
    try {
      await createLeaveType({ 
        ...newType, 
        is_active: true,
        // Si report non activé, effacer les champs politique
        ...(newCarryoverEnabled ? {} : { max_carryover: null, carryover_max_years: null, carryover_expiry_month: null, carryover_expiry_day: null })
      });
      onRefresh();
      setNewType({ name: '', code: '', default_days: 0, is_annual: false, accrual_rate: 2.0, eligible_gender: 'all', family_bonus_enabled: false, family_bonus_eligible_gender: 'female', family_bonus_min_children: 4, family_bonus_days: 2, max_carryover: null, carryover_max_years: 1, carryover_expiry_month: null, carryover_expiry_day: null });
      setNewCarryoverEnabled(false);
      setShowAddForm(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Le type de congé n'a pas pu être créé";
      toast.error(message);
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
          const message = e instanceof Error ? e.message : "Le type de congé n'a pas pu être supprimé";
          toast.error(message);
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
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <label className="text-sm col-span-full">
                      <span className="block font-medium text-gray-700 mb-1">{t.leaves.genderEligibility}</span>
                      <select
                        value={editingType.eligible_gender ?? 'all'}
                        onChange={(e) => setEditingType({ ...editingType, eligible_gender: e.target.value as 'all' | 'female' | 'male' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                      >
                        <option value="all">{t.leaves.eligibilityAll}</option>
                        <option value="female">{t.leaves.eligibilityFemale}</option>
                        <option value="male">{t.leaves.eligibilityMale}</option>
                      </select>
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
                        <div className="col-span-full border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-3">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!editingType.family_bonus_enabled}
                              onChange={(e) => setEditingType({ ...editingType, family_bonus_enabled: e.target.checked })}
                              className="rounded border-gray-300 text-primary-600"
                            />
                            {t.leaves.familyBonusTitle}
                          </label>
                          <p className="text-xs text-gray-600">{t.leaves.familyBonusHint}</p>
                          {editingType.family_bonus_enabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <label className="text-xs text-gray-700">
                                <span className="block mb-1">{t.leaves.familyBonusGender}</span>
                                <select
                                  value={editingType.family_bonus_eligible_gender ?? 'female'}
                                  onChange={(e) => setEditingType({ ...editingType, family_bonus_eligible_gender: e.target.value as 'female' | 'male' })}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-sm"
                                >
                                  <option value="female">{t.leaves.eligibilityFemale}</option>
                                  <option value="male">{t.leaves.eligibilityMale}</option>
                                </select>
                              </label>
                              <label className="text-xs text-gray-700">
                                <span className="block mb-1">{t.leaves.familyBonusMinChildren}</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={editingType.family_bonus_min_children ?? 4}
                                  onChange={(e) => setEditingType({ ...editingType, family_bonus_min_children: Math.max(1, parseInt(e.target.value) || 1) })}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </label>
                              <label className="text-xs text-gray-700">
                                <span className="block mb-1">{t.leaves.familyBonusDays}</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={366}
                                  step="0.5"
                                  value={editingType.family_bonus_days ?? 2}
                                  onChange={(e) => setEditingType({ ...editingType, family_bonus_days: Math.max(0, parseFloat(e.target.value) || 0) })}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                />
                              </label>
                            </div>
                          )}
                          {editingType.family_bonus_enabled && (
                            <p className="text-xs text-emerald-800">{t.leaves.familyDataVerificationHint}</p>
                          )}
                        </div>
                        {/* Politique de report — toujours visible pour les congés annuels */}
                        <div className="col-span-full border border-gray-200 rounded-lg p-3 space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editCarryoverEnabled}
                              onChange={(e) => {
                                setEditCarryoverEnabled(e.target.checked);
                                if (!e.target.checked) {
                                  setEditingType({ ...editingType, max_carryover: null, carryover_max_years: null, carryover_expiry_month: null, carryover_expiry_day: null });
                                } else {
                                  setEditingType({ ...editingType, carryover_max_years: 1 });
                                }
                              }}
                              className="rounded border-gray-300 text-primary-600"
                            />
                            Autoriser le report des jours non pris
                          </label>
                          {editCarryoverEnabled && (
                            <div className="space-y-2 pt-1">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Plafond de jours reportables (vide = illimité)</label>
                                  <input
                                    type="number"
                                    value={editingType.max_carryover ?? ''}
                                    onChange={(e) => setEditingType({ ...editingType, max_carryover: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    placeholder="Illimité"
                                    min={0}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Validité du report</label>
                                  <select
                                    value={editingType.carryover_max_years ?? ''}
                                    onChange={(e) => setEditingType({ ...editingType, carryover_max_years: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="">Illimité</option>
                                    <option value="1">1 an (N+1 seulement)</option>
                                    <option value="2">2 ans</option>
                                    <option value="3">3 ans</option>
                                    <option value="4">4 ans</option>
                                    <option value="5">5 ans</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Date limite de consommation dans l'année cible (optionnel)</label>
                                <div className="flex gap-1 items-center">
                                  <select
                                    value={editingType.carryover_expiry_month ?? ''}
                                    onChange={(e) => setEditingType({ ...editingType, carryover_expiry_month: e.target.value ? parseInt(e.target.value) : null, carryover_expiry_day: e.target.value ? editingType.carryover_expiry_day : null })}
                                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                  >
                                    <option value="">Fin d'année (31 déc.)</option>
                                    <option value="1">Janvier</option>
                                    <option value="2">Février</option>
                                    <option value="3">Mars</option>
                                    <option value="4">Avril</option>
                                    <option value="5">Mai</option>
                                    <option value="6">Juin</option>
                                    <option value="7">Juillet</option>
                                    <option value="8">Août</option>
                                    <option value="9">Septembre</option>
                                    <option value="10">Octobre</option>
                                    <option value="11">Novembre</option>
                                    <option value="12">Décembre</option>
                                  </select>
                                  {editingType.carryover_expiry_month && (
                                    <>
                                      <span className="text-xs text-gray-500">jour</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={editingType.carryover_expiry_day ?? ''}
                                        onChange={(e) => setEditingType({ ...editingType, carryover_expiry_day: e.target.value ? parseInt(e.target.value) : null })}
                                        className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                        placeholder="Fin"
                                      />
                                    </>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-blue-600 italic bg-blue-50 rounded px-2 py-1">
                                {editingType.carryover_max_years
                                  ? `Les jours non pris seront report\u00e9s pour ${editingType.carryover_max_years} an${editingType.carryover_max_years > 1 ? 's' : ''} maximum${editingType.carryover_expiry_month ? `, jusqu\u2019au ${editingType.carryover_expiry_day ? editingType.carryover_expiry_day + '/' : 'fin '}${editingType.carryover_expiry_month} de l\u2019ann\u00e9e cible` : ', jusqu\u2019au 31/12 de l\u2019ann\u00e9e cible'}.`
                                  : `Les jours non pris seront report\u00e9s sans limite de dur\u00e9e${editingType.carryover_expiry_month ? `, jusqu\u2019au ${editingType.carryover_expiry_day ? editingType.carryover_expiry_day + '/' : 'fin '}${editingType.carryover_expiry_month} de chaque ann\u00e9e` : ''}.`}
                                {editingType.max_carryover ? ` Plafond : ${editingType.max_carryover} j.` : ' Aucun plafond.'}
                              </p>
                            </div>
                          )}
                        </div>
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
                      {(type.eligible_gender ?? 'all') !== 'all' && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                          {type.eligible_gender === 'female' ? t.leaves.eligibilityFemale : t.leaves.eligibilityMale}
                        </span>
                      )}
                    </div>
                    {type.is_annual && (type.max_carryover != null || type.carryover_max_years != null) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Report autorisé
                        {type.max_carryover != null ? ` · max ${type.max_carryover} j` : ' · sans plafond'}
                        {type.carryover_max_years != null
                          ? ` · ${type.carryover_max_years} an${type.carryover_max_years > 1 ? 's' : ''}`
                          : ' · durée illimitée'}
                        {type.carryover_expiry_month
                          ? ` · expire le ${type.carryover_expiry_day ? type.carryover_expiry_day + '/' : ''}${type.carryover_expiry_month}`
                          : ''}
                      </p>
                    )}
                    {type.is_annual && type.family_bonus_enabled && (
                      <p className="text-xs text-emerald-700 mt-0.5">
                        {t.leaves.familyBonusSummary
                          .replace('{days}', formatLeaveDays(type.family_bonus_days ?? 2))
                          .replace('{children}', String(type.family_bonus_min_children ?? 4))
                          .replace('{gender}', type.family_bonus_eligible_gender === 'male' ? t.leaves.eligibilityMale : t.leaves.eligibilityFemale)}
                      </p>
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
                        onClick={() => {
                          setEditingType(type);
                          setEditCarryoverEnabled(type.carryover_max_years != null || type.max_carryover != null);
                        }}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
                <label className="text-sm col-span-full">
                  <span className="block font-medium text-gray-700 mb-1">{t.leaves.genderEligibility}</span>
                  <select
                    value={newType.eligible_gender}
                    onChange={(e) => setNewType({ ...newType, eligible_gender: e.target.value as 'all' | 'female' | 'male' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="all">{t.leaves.eligibilityAll}</option>
                    <option value="female">{t.leaves.eligibilityFemale}</option>
                    <option value="male">{t.leaves.eligibilityMale}</option>
                  </select>
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
                    <div className="col-span-full border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newType.family_bonus_enabled}
                          onChange={(e) => setNewType({ ...newType, family_bonus_enabled: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600"
                        />
                        {t.leaves.familyBonusTitle}
                      </label>
                      <p className="text-xs text-gray-600">{t.leaves.familyBonusHint}</p>
                      {newType.family_bonus_enabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="text-xs text-gray-700">
                            <span className="block mb-1">{t.leaves.familyBonusGender}</span>
                            <select
                              value={newType.family_bonus_eligible_gender}
                              onChange={(e) => setNewType({ ...newType, family_bonus_eligible_gender: e.target.value as 'female' | 'male' })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-sm"
                            >
                              <option value="female">{t.leaves.eligibilityFemale}</option>
                              <option value="male">{t.leaves.eligibilityMale}</option>
                            </select>
                          </label>
                          <label className="text-xs text-gray-700">
                            <span className="block mb-1">{t.leaves.familyBonusMinChildren}</span>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={newType.family_bonus_min_children}
                              onChange={(e) => setNewType({ ...newType, family_bonus_min_children: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            />
                          </label>
                          <label className="text-xs text-gray-700">
                            <span className="block mb-1">{t.leaves.familyBonusDays}</span>
                            <input
                              type="number"
                              min={0}
                              max={366}
                              step="0.5"
                              value={newType.family_bonus_days}
                              onChange={(e) => setNewType({ ...newType, family_bonus_days: Math.max(0, parseFloat(e.target.value) || 0) })}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            />
                          </label>
                        </div>
                      )}
                      {newType.family_bonus_enabled && (
                        <p className="text-xs text-emerald-800">{t.leaves.familyDataVerificationHint}</p>
                      )}
                    </div>
                    {/* Politique de report */}
                    <div className="col-span-full border border-gray-200 rounded-lg p-3 space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCarryoverEnabled}
                          onChange={(e) => {
                            setNewCarryoverEnabled(e.target.checked);
                            if (!e.target.checked) {
                              setNewType({ ...newType, max_carryover: null, carryover_max_years: null, carryover_expiry_month: null, carryover_expiry_day: null });
                            } else {
                              setNewType({ ...newType, carryover_max_years: 1 });
                            }
                          }}
                          className="rounded border-gray-300 text-primary-600"
                        />
                        Autoriser le report des jours non pris
                      </label>
                      {newCarryoverEnabled && (
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Plafond de jours reportables (vide = illimité)</label>
                              <input
                                type="number"
                                value={newType.max_carryover ?? ''}
                                onChange={(e) => setNewType({ ...newType, max_carryover: e.target.value ? parseInt(e.target.value) : null })}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                placeholder="Illimité"
                                min={0}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Validité du report</label>
                              <select
                                value={newType.carryover_max_years ?? ''}
                                onChange={(e) => setNewType({ ...newType, carryover_max_years: e.target.value ? parseInt(e.target.value) : null })}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                              >
                                <option value="">Illimité</option>
                                <option value="1">1 an (N+1 seulement)</option>
                                <option value="2">2 ans</option>
                                <option value="3">3 ans</option>
                                <option value="4">4 ans</option>
                                <option value="5">5 ans</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Date limite de consommation dans l'année cible (optionnel)</label>
                            <div className="flex gap-1 items-center">
                              <select
                                value={newType.carryover_expiry_month ?? ''}
                                onChange={(e) => setNewType({ ...newType, carryover_expiry_month: e.target.value ? parseInt(e.target.value) : null, carryover_expiry_day: e.target.value ? newType.carryover_expiry_day : null })}
                                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                              >
                                <option value="">Fin d'année (31 déc.)</option>
                                <option value="1">Janvier</option>
                                <option value="2">Février</option>
                                <option value="3">Mars</option>
                                <option value="4">Avril</option>
                                <option value="5">Mai</option>
                                <option value="6">Juin</option>
                                <option value="7">Juillet</option>
                                <option value="8">Août</option>
                                <option value="9">Septembre</option>
                                <option value="10">Octobre</option>
                                <option value="11">Novembre</option>
                                <option value="12">Décembre</option>
                              </select>
                              {newType.carryover_expiry_month && (
                                <>
                                  <span className="text-xs text-gray-500">jour</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={newType.carryover_expiry_day ?? ''}
                                    onChange={(e) => setNewType({ ...newType, carryover_expiry_day: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm"
                                    placeholder="Fin"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
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
      const message = e instanceof Error ? e.message : t.leaves.initializationError;
      toast.error(message);
      setError(message);
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
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
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
      const message = e instanceof Error ? e.message : "La validation n'a pas pu être enregistrée";
      toast.error(message);
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
  const canProcess = canProcessLeaveRequest(request);
  const approvalStepLabel = (type: string) => ({
    manager_n1: t.leaves.managerN1Approval,
    manager_n2: t.leaves.managerN2Approval,
    hr: t.leaves.finalHrApproval,
  }[type] || type);
  const approvalStatusLabel = (status: string) => ({
    waiting: t.leaves.approvalWaiting,
    pending: t.leaves.pending,
    approved: t.leaves.approved,
    rejected: t.leaves.refused,
    skipped: t.leaves.approvalSkipped,
  }[status] || status);

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
              {canProcess ? t.leaves.processRequest : t.leaves.requestDetail}
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
            <div className="mt-3 pt-3 border-t border-gray-200">
              <StatusBadge status={request.status} currentApprovalStep={request.current_approval_step} />
              {!['pending', 'manager_approved', 'n2_approved'].includes(request.status) && (
                <>
                  {request.approved_by_name && (
                    <p className="text-xs text-gray-500 mt-1">{t.leaves.by} {request.approved_by_name}</p>
                  )}
                  {request.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1">{t.leaves.reasonLabel} : {request.rejection_reason}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {!!request.approval_steps?.length && (
            <div className="mb-4 rounded-lg border border-gray-200 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-900">{t.leaves.approvalWorkflow}</p>
              <ol className="space-y-2">
                {request.approval_steps.map(step => (
                  <li key={step.step_order} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{approvalStepLabel(step.approver_type)}</p>
                      {step.approver_name && <p className="text-xs text-gray-500">{step.approver_name}</p>}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      step.status === 'approved' ? 'bg-green-100 text-green-700' :
                      step.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      step.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{approvalStatusLabel(step.status)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* AI Suggestion button + panel */}
          {canProcess && (
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

          {canProcess ? (
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
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
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
  const [eligibleLeaveTypes, setEligibleLeaveTypes] = useState<LeaveType[]>([]);
  const [loadingEligibleTypes, setLoadingEligibleTypes] = useState(false);

  const [okrImpact, setOkrImpact] = useState<OkrImpact | null>(null);
  const [okrLoading, setOkrLoading] = useState(false);

  // Load employee list based on role when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setLoadingEmployees(true);
      const stored = getUserFromStorage();
      const role =
        stored.role === 'employee' && stored.hasTeamAccess
          ? 'manager'
          : stored.role;
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

  useEffect(() => {
    if (!isOpen || !employeeId) {
      setEligibleLeaveTypes([]);
      setLeaveTypeId('');
      return;
    }
    let cancelled = false;
    setLoadingEligibleTypes(true);
    getLeaveTypes(Number.parseInt(employeeId))
      .then((types) => {
        if (cancelled) return;
        setEligibleLeaveTypes(types);
        setLeaveTypeId((current) => types.some((type) => String(type.id) === current) ? current : '');
      })
      .catch(() => {
        if (!cancelled) setEligibleLeaveTypes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingEligibleTypes(false);
      });
    return () => { cancelled = true; };
  }, [employeeId, isOpen]);

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
      toast.error(
        e instanceof Error && e.message === 'leave_type_gender_ineligible'
          ? t.leaves.leaveTypeGenderIneligible
          : (e instanceof Error ? e.message : t.leaves.requestCreationError)
      );
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
                <SearchableSelect
                  value={employeeId}
                  onChange={(val) => {
                    setEmployeeId(val);
                    setLeaveTypeId('');
                  }}
                  placeholder={t.leaves.selectEmployee}
                  options={employeesList.map(emp => ({
                    value: String(emp.id),
                    label: `${emp.first_name} ${emp.last_name}${emp.id === storedUser.employeeId ? ` ${t.leaves.me}` : ''}`.trim(),
                  }))}
                />
              )}
            </div>

            {/* Leave type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.leaves.leaveType} <span className="text-red-500">*</span>
              </label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">{t.leaves.selectLeaveType}</option>
                {loadingEligibleTypes && <option disabled>{t.common.loading}</option>}
                {eligibleLeaveTypes.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.leaves.startLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.leaves.endLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* OKR Impact */}
            {okrLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
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
  const todayIso = new Date().toISOString().slice(0, 10);
  const [employees, setEmployees] = useState<EmployeeShort[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [balances, setBalances] = useState<EmployeeBalance[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [balanceAudit, setBalanceAudit] = useState<LeaveBalanceAuditResponse | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  // Inline-editable values for every row (keyed by balance id)
  const [edits, setEdits] = useState<Record<number, { allocated: string; initial_balance: string; carried_over: string }>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [initializing, setInitializing] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // CSV import
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState('');
  const [csvResult, setCsvResult] = useState<{ success: number; errors: { line: number; error: string }[] } | null>(null);
  const [csvImportMode, setCsvImportMode] = useState<BalanceImportMode>('current_available');
  const [csvEffectiveDate, setCsvEffectiveDate] = useState(todayIso);
  const [updatingImportMode, setUpdatingImportMode] = useState(false);

  useEffect(() => {
    getEmployeesList()
      .then((list) => setEmployees(list))
      .finally(() => setLoadingEmployees(false));
  }, []);

  useEffect(() => {
    getTenantLeaveBalanceImportMode().then(({ mode, effectiveDate }) => {
      setCsvImportMode(mode);
      if (effectiveDate) setCsvEffectiveDate(effectiveDate);
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
        const editableRecoveryBalance = bal.recovery_balance ?? bal.initial_balance;
        initial[bal.id] = {
          allocated: String(bal.allocated),
          initial_balance: String(editableRecoveryBalance),
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

  const loadBalanceAudit = useCallback(async (year: number) => {
    setLoadingAudit(true);
    try {
      setBalanceAudit(await getLeaveBalanceAudit(year));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.leaves.balanceAuditLoadError);
    } finally {
      setLoadingAudit(false);
    }
  }, [t.leaves.balanceAuditLoadError]);

  useEffect(() => {
    loadBalanceAudit(selectedYear);
  }, [selectedYear, loadBalanceAudit]);

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
        String(bal.recovery_balance ?? bal.initial_balance) !== e.initial_balance ||
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
    if (correctionReason.trim().length < 3) {
      toast.error(t.leaves.balanceCorrectionReasonRequired);
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
          await updateBalanceAllocated(bal.id, allocated, carriedOver, correctionReason.trim());
          await setInitialBalance(selectedEmployeeId as number, bal.leave_type_id, initialBalance, selectedYear, correctionReason.trim());
        })
      );
      const failures = results.filter((r) => r.status === 'rejected');
      const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);
      const empName = selectedEmp ? `${selectedEmp.first_name} ${selectedEmp.last_name}` : '';
      if (failures.length === 0) {
        toast.success(t.leaves.balancesSaved.replace('{name}', empName));
        setCorrectionReason('');
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
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast.error(t.leaves.csvEmptyFile);
        return;
      }
      const delimiter = detectCsvDelimiter(lines[0]);
      const headerCols = parseCsvLine(lines[0], delimiter);
      const headerIndex = new Map(headerCols.map((header, index) => [normalizeCsvHeader(header), index]));
      const hasIdColumn = ['id', 'employee_id', 'employee_db_id'].some((alias) => headerIndex.has(alias));
      const dataLines = lines.slice(1); // skip header
      let success = 0;
      const errors: { line: number; error: string }[] = [];
      const validRows: Array<{
        line: number;
        employee_id: number;
        leave_type_id: number;
        year: number;
        initial_balance: number;
      }> = [];

      // Cache resolved matricules to avoid duplicate API calls
      const matriculeCache = new Map<string, number | null>();

      const resolveLeaveTypeCode = (code: string): number | null => {
        const found = leaveTypes.find(t => t.code.toUpperCase() === code.toUpperCase());
        return found ? found.id : null;
      };

      for (let i = 0; i < dataLines.length; i++) {
        const lineNum = i + 2;
        setCsvProgress(t.leaves.csvProcessingLine.replace('{current}', String(i + 1)).replace('{total}', String(dataLines.length)));
        const cols = parseCsvLine(dataLines[i], delimiter);
        if (cols.length < 4) {
          errors.push({ line: lineNum, error: 'Nombre de colonnes insuffisant (attendu: id, matricule, leave_type_code, year, available_balance)' });
          continue;
        }
        const trimmedCols = cols.map(c => c.trim());
        const employeeIdSource = getCsvCell(trimmedCols, headerIndex, ['id', 'employee_id', 'employee_db_id']);
        const matricule = getCsvCell(trimmedCols, headerIndex, ['matricule', 'registration_number'], hasIdColumn ? 1 : 0);
        const ltCode = getCsvCell(trimmedCols, headerIndex, ['leave_type_code', 'type_conge', 'type_congé'], hasIdColumn ? 2 : 1);
        const yr = getCsvCell(trimmedCols, headerIndex, ['year', 'annee', 'année'], hasIdColumn ? 3 : 2);
        const bal = getCsvCell(trimmedCols, headerIndex, ['available_balance', 'solde_disponible', 'carryover_balance', 'solde_report', 'initial_balance', 'solde_initial'], hasIdColumn ? 4 : 3);
        if ((!employeeIdSource && !matricule) || !ltCode || !yr || bal === '') {
          errors.push({ line: lineNum, error: 'Valeur(s) manquante(s)' });
          continue;
        }

        // 1. Resolve employee id. The technical ID is preferred; matricule is kept for old files.
        let employeeId: number | null;
        if (employeeIdSource) {
          const parsedEmployeeId = Number(employeeIdSource);
          employeeId = Number.isInteger(parsedEmployeeId) && parsedEmployeeId > 0 ? parsedEmployeeId : null;
          if (employeeId === null) {
            errors.push({ line: lineNum, error: `ID employé invalide "${employeeIdSource}"` });
            continue;
          }
        } else if (matriculeCache.has(matricule)) {
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
        const balNum = parseCsvNumber(bal);
        if (isNaN(balNum) || balNum < 0) {
          errors.push({ line: lineNum, error: `Solde invalide "${bal}" (attendu: nombre >= 0)` });
          continue;
        }

        validRows.push({
          line: lineNum,
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          year: yearNum,
          initial_balance: balNum,
        });
      }

      if (validRows.length > 0) {
        setCsvProgress(`Import de ${validRows.length} solde(s)...`);
        const result = await bulkSetInitialBalances(
          validRows.map(({ line, ...item }) => item),
          csvImportMode,
          csvEffectiveDate,
        );
        success = result.success;
        result.errors.forEach((err) => {
          const sourceRow = validRows[err.index - 1];
          errors.push({ line: sourceRow?.line || err.index, error: err.error });
        });
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

  const applyImportModeSettings = async () => {
    if (csvImportMode === 'current_available' && !csvEffectiveDate) {
      toast.error(t.settings.leaveRecoveryDateRequired);
      return;
    }
    setUpdatingImportMode(true);
    try {
      const result = await updateTenantLeaveBalanceImportMode(csvImportMode, selectedYear, csvEffectiveDate);
      if (selectedEmployeeId) {
        await loadBalances(selectedEmployeeId as number, selectedYear);
      }
      toast.success(t.settings.leaveRecoveryApplied.replace('{count}', String(result.updated_balances)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.settings.leaveRecoveryApplyError);
    } finally {
      setUpdatingImportMode(false);
    }
  };

  const downloadCsvTemplate = async () => {
    setDownloadingTemplate(true);
    let templateEmployees = employees;
    try {
      templateEmployees = await getEmployeesList();
      setEmployees(templateEmployees);
    } catch (err) {
      console.error('Template employees loading failed', err);
    } finally {
      setDownloadingTemplate(false);
    }

    if (templateEmployees.length === 0) {
      toast.error("Aucun employé disponible pour générer le template");
      return;
    }

    const activeLeaveTypes = leaveTypes.filter((type) => type.is_active);
    const balanceColumn = csvImportMode === 'previous_year_carryover' ? 'carryover_balance' : 'available_balance';
    const rows = templateEmployees.flatMap((employee) =>
      activeLeaveTypes.map((leaveType) => [
        employee.id,
        employee.employee_id || String(employee.id),
        leaveType.code,
        selectedYear,
        0,
      ])
    );
    const csv = [
      ['id', 'matricule', 'leave_type_code', 'year', balanceColumn].join(';'),
      ...rows.map((row) => row.map((cell) => escapeCsvCell(cell, ';')).join(';')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_soldes_initiaux.csv';
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] items-end mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.leaveImportMode}</label>
            <select
              value={csvImportMode}
              onChange={(e) => setCsvImportMode(e.target.value as BalanceImportMode)}
              disabled={updatingImportMode}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="current_available">{t.settings.leaveRecoveryCurrentAvailable}</option>
              <option value="previous_year_carryover">{t.settings.leaveRecoveryCarryover}</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {csvImportMode === 'previous_year_carryover'
                ? t.settings.leaveRecoveryCarryoverHint
                : t.settings.leaveRecoveryCurrentAvailableHint}
            </p>
          </div>
          {csvImportMode === 'current_available' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.leaveRecoveryDate}</label>
              <input
                type="date"
                value={csvEffectiveDate}
                onChange={(e) => setCsvEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
          <button
            type="button"
            onClick={applyImportModeSettings}
            disabled={updatingImportMode || (csvImportMode === 'current_available' && !csvEffectiveDate)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
          >
            {updatingImportMode ? t.settings.applying : t.settings.applyLeaveRecovery}
          </button>
        </div>
        <p className="-mt-2 mb-4 text-xs text-amber-700">
          {t.settings.leaveRecoveryPendingHint}
        </p>
        <div className="flex gap-3">
          <button
            onClick={downloadCsvTemplate}
            disabled={downloadingTemplate}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            <FileDown className={`w-4 h-4 ${downloadingTemplate ? 'animate-pulse' : ''}`} />
            {downloadingTemplate ? 'Préparation...' : t.leaves.downloadTemplate}
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
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">{t.leaves.balanceAuditTitle}</h3>
            <p className="mt-1 text-sm text-gray-500">{t.leaves.balanceAuditDescription}</p>
          </div>
          <button
            type="button"
            onClick={() => loadBalanceAudit(selectedYear)}
            disabled={loadingAudit}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loadingAudit ? 'animate-spin' : ''}`} />
            {t.settings.refresh}
          </button>
        </div>
        {balanceAudit && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <span className="text-gray-500">{t.leaves.balanceAuditChecked}</span>
                <strong className="ml-2 text-gray-900">{balanceAudit.total_balances}</strong>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-sm">
                <span className="text-red-700">{t.leaves.balanceAuditNegative}</span>
                <strong className="ml-2 text-red-800">{balanceAudit.negative_balances}</strong>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-sm">
                <span className="text-amber-700">{t.leaves.balanceAuditWarnings}</span>
                <strong className="ml-2 text-amber-800">{balanceAudit.configuration_warnings}</strong>
              </div>
            </div>
            {balanceAudit.items.some(item => item.issues.length > 0) && (
              <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
                {balanceAudit.items.filter(item => item.issues.length > 0).map(item => (
                  <div key={item.balance_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">{item.employee_name} · {item.leave_type_name}</span>
                    <span className={item.available < 0 ? 'font-semibold text-red-700' : 'text-amber-800'}>
                      {item.issues.map(issue => t.leaves.balanceAuditIssues[issue as keyof typeof t.leaves.balanceAuditIssues] || issue).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.leaves.employee}</label>
            {loadingEmployees ? (
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <SearchableSelect
                value={selectedEmployeeId === '' ? '' : String(selectedEmployeeId)}
                onChange={(val) => setSelectedEmployeeId(val ? parseInt(val) : '')}
                placeholder={t.leaves.selectEmployee}
                options={employees.map((emp) => ({
                  value: String(emp.id),
                  label: `${emp.first_name} ${emp.last_name}`.trim(),
                  subtitle: emp.department_name,
                }))}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
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
                      <th className="px-4 py-3 text-right">
                        {csvImportMode === 'current_available' ? t.settings.balanceAtRecoveryDate : t.settings.initialBalance}
                      </th>
                      <th className="px-4 py-3 text-right">Report N-1</th>
                      <th className="px-4 py-3 text-right">Pris</th>
                      <th className="px-4 py-3 text-right">En attente</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Disponible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {balances.map((bal) => {
                      const editableRecoveryBalance = bal.recovery_balance ?? bal.initial_balance;
                      const e = edits[bal.id] || { allocated: String(bal.allocated), initial_balance: String(editableRecoveryBalance), carried_over: String(bal.carried_over) };
                      const changed =
                        String(bal.allocated) !== e.allocated ||
                        String(editableRecoveryBalance) !== e.initial_balance ||
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
                          <td className="px-4 py-3 text-right text-gray-500">{formatLeaveDays(bal.taken)} j</td>
                          <td className="px-4 py-3 text-right text-amber-600">{formatLeaveDays(bal.pending)} j</td>
                          <td className={`px-4 py-3 text-right font-semibold ${bal.available < 0 ? 'text-red-600' : 'text-green-700'}`}>
                            <div>{formatLeaveDays(bal.available)} j</div>
                            {bal.is_annual !== false && Number(bal.accrued_this_year || 0) > 0 && (
                              <div className="text-[11px] font-normal text-gray-400">
                                {t.settings.includesAccruedDays.replace('{days}', formatLeaveDays(bal.accrued_this_year))}
                              </div>
                            )}
                            {Number(bal.family_bonus || 0) > 0 && (
                              <div className="text-[11px] font-normal text-emerald-600">
                                {t.leaves.familyBonusIncluded.replace('{days}', formatLeaveDays(bal.family_bonus))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Global save button */}
              <div className="px-6 py-4 border-t border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full sm:max-w-xl">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t.leaves.balanceCorrectionReason}
                  </label>
                  <input
                    type="text"
                    value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                    placeholder={t.leaves.balanceCorrectionReasonPlaceholder}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <button
                  onClick={handleSaveAll}
                  disabled={savingAll || !hasChanges || correctionReason.trim().length < 3}
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
  leave_id?: number | null;
  employee_id: number;
  declared_by: number;
  sick_start_date: string;
  estimated_duration_days: number;
  estimated_end_date: string;
  actual_end_date?: string | null;
  certificate_url?: string | null;
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
  qs.append('standalone', 'false');
  if (params.status) qs.append('status', params.status);
  const response = await fetch(`${API_URL}/api/leave-sick-declarations/?${qs.toString()}`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function createSickDeclarationRH(payload: {
  employee_id: number;
  leave_id?: number | null;
  sick_start_date: string;
  estimated_duration_days: number;
  notes?: string;
  certificate?: File | null;
}): Promise<void> {
  const fd = new FormData();
  fd.append('employee_id', String(payload.employee_id));
  if (payload.leave_id) fd.append('leave_id', String(payload.leave_id));
  fd.append('sick_start_date', payload.sick_start_date);
  fd.append('estimated_duration_days', String(payload.estimated_duration_days));
  if (payload.notes) fd.append('notes', payload.notes);
  if (payload.certificate) fd.append('certificate', payload.certificate);
    const token = getToken();
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
            <Heart className="w-5 h-5 text-orange-500" /> Maladie pendant congé
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">{t.leaves.allFilter}</option>
              <option value="active">{t.leaves.activeFilter}</option>
              <option value="closed">{t.leaves.closedFilter}</option>
            </select>
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
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {d.leave_id ? `${t.leaves.leave} #${d.leave_id}` : 'Hors congé'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">{new Date(d.sick_start_date).toLocaleDateString(t.dashboard.dateLocale)}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">{new Date(d.estimated_end_date).toLocaleDateString(t.dashboard.dateLocale)}</td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {d.actual_end_date ? new Date(d.actual_end_date).toLocaleDateString(t.dashboard.dateLocale) : '—'}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">{d.estimated_duration_days}j</td>
                  <td className="px-4 py-4"><SickStatusBadge status={d.status} /></td>
                  <td className="px-4 py-4">
                    {d.certificate_url ? (
                      <a
                        href={d.certificate_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" /> {t.leaves.view}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-500">Aucun justificatif</span>
                    )}
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
  const [employees, setEmployees] = useState<EmployeeShort[]>([]);
  const [onLeaveList, setOnLeaveList] = useState<LeaveRequest[]>([]);
  const [employeeId, setEmployeeId] = useState('');
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
      const stored = getUserFromStorage();
      let employeesData: EmployeeShort[] = [];

      if (['rh', 'admin', 'dg', 'super_admin'].includes(stored.role)) {
        employeesData = await getEmployeesList();
      } else if (stored.employeeId) {
        const self = await getEmployeeById(stored.employeeId);
        const reports = stored.hasTeamAccess
          ? await getDirectReports(stored.employeeId)
          : [];
        employeesData = [
          ...(self ? [self] : []),
          ...reports.filter((employee) => employee.id !== stored.employeeId),
        ];
      }

      const today = new Date().toISOString().slice(0, 10);
      setOnLeaveList(data.items.filter((l) => l.start_date <= today && l.end_date >= today));
      setEmployees(employeesData);
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !leaveId) {
      toast.error('Collaborateur en congé requis');
      return;
    }
    setSubmitting(true);
    try {
      await createSickDeclarationRH({
        employee_id: parseInt(employeeId),
        leave_id: leaveId ? parseInt(leaveId) : undefined,
        sick_start_date: sickStartDate,
        estimated_duration_days: duration,
        notes: notes || undefined,
        certificate: file,
      });
      toast.success(t.leaves.declarationCreated);
      onSuccess();
      onClose();
      setEmployeeId('');
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
                {t.leaves.collaborator} <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={employeeId}
                onChange={(val) => {
                  setEmployeeId(val);
                  const matchingLeave = onLeaveList.find((l) => String(l.employee_id) === val);
                  setLeaveId(matchingLeave ? String(matchingLeave.id) : '');
                }}
                placeholder={t.leaves.select}
                options={employees.map((employee) => ({
                  value: String(employee.id),
                  label: `${employee.first_name} ${employee.last_name}`.trim(),
                  subtitle: employee.department_name,
                }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Congé lié <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={leaveId}
                onChange={(val) => setLeaveId(val)}
                placeholder={t.leaves.select}
                options={onLeaveList.filter((l) => !employeeId || String(l.employee_id) === employeeId).map((l) => ({
                  value: String(l.id),
                  label: `${l.employee_name ?? ''} — ${new Date(l.start_date).toLocaleDateString('fr-FR')} → ${new Date(l.end_date).toLocaleDateString('fr-FR')}`,
                  subtitle: l.leave_type_name,
                }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t.leaves.sickStartDate} <span className="text-red-500">*</span>
              </label>
              <input type="date" value={sickStartDate} onChange={(e) => setSickStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
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
                {t.leaves.medicalCertificate}
              </label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-700" />
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
  const hasLinkedLeave = Boolean(declaration.leave_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recoverSickDeclarationRH(declaration.id, hasLinkedLeave ? recoveryType : 'return_to_work');
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
              {hasLinkedLeave && (
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                  recoveryType === 'resume_leave' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input type="radio" checked={recoveryType === 'resume_leave'} onChange={() => setRecoveryType('resume_leave')} className="mt-1" />
                  <div>
                    <div className="font-medium text-gray-900">{t.leaves.resumeLeave}</div>
                    <div className="text-xs text-gray-600">{t.leaves.resumeLeaveDescription}</div>
                  </div>
                </label>
              )}
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
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
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
  const [leaveCountingMode, setLeaveCountingMode] = useState<LeaveCountingMode>('working_days');
  const [leaveAccrualMode, setLeaveAccrualMode] = useState<LeaveAccrualMode>('prorata_30_days');
  const [holidayCountry, setHolidayCountry] = useState<HolidayCountry>('Sénégal');
  const [legalCountryCode, setLegalCountryCode] = useState('');
  const [leaveConventions, setLeaveConventions] = useState<LeaveConvention[]>([]);
  const [leaveConventionCode, setLeaveConventionCode] = useState('');
  const [leaveConventionEffectiveDate, setLeaveConventionEffectiveDate] = useState('');
  const [alignHolidayCalendar, setAlignHolidayCalendar] = useState(false);
  const [savingLegalRegime, setSavingLegalRegime] = useState(false);
  const [showLegalRegimeConfirm, setShowLegalRegimeConfirm] = useState(false);
  const [honorMedalBonusDays, setHonorMedalBonusDays] = useState<HonorMedalBonusDays>(DEFAULT_HONOR_MEDAL_BONUS_DAYS);
  const [savingHonorMedalBonus, setSavingHonorMedalBonus] = useState(false);
  const [tenantHolidays, setTenantHolidays] = useState<TenantHoliday[]>([]);
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '' });
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [seedingHolidays, setSeedingHolidays] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('employee');
  const canManageLeaveSettings = ['rh', 'admin', 'dg', 'super_admin'].includes(currentUserRole);

  const loadRecalls = useCallback(async () => {
    const data = await getLeaveRecalls();
    setRecalls(data);
  }, []);

  useEffect(() => {
    const stored = getUserFromStorage();
    setCurrentUserRole(
      stored.role === 'employee' && stored.hasTeamAccess
        ? 'manager'
        : stored.role,
    );
    getTenantRecallPolicy().then(setRecallPolicy);
    getTenantLeaveCountingMode().then(setLeaveCountingMode);
    getTenantLeaveAccrualMode().then(setLeaveAccrualMode);
    getTenantHolidayCountry().then(setHolidayCountry);
    getTenantLegalCountry().then(setLegalCountryCode);
    getTenantLeaveConvention().then(({ code, effectiveDate }) => {
      setLeaveConventionCode(code);
      setLeaveConventionEffectiveDate(effectiveDate);
    });
    getTenantHonorMedalBonusDays().then(setHonorMedalBonusDays);
  }, []);

  useEffect(() => {
    getLeaveConventions(legalCountryCode).then(setLeaveConventions);
  }, [legalCountryCode]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['requests', 'calendar', 'settings', 'balances', 'recalls', 'sick'].includes(tab)) {
      setActiveTab(tab === 'settings' && !canManageLeaveSettings ? 'requests' : tab as typeof activeTab);
    }
  }, [canManageLeaveSettings, searchParams]);

  useEffect(() => {
    if (activeTab === 'recalls') loadRecalls();
    if (activeTab === 'sick') loadSickDeclarations();
    if (activeTab === 'settings') loadTenantHolidays();
  }, [activeTab, loadRecalls, loadSickDeclarations]);

  const loadTenantHolidays = async () => {
    const data = await getTenantHolidays(CURRENT_YEAR);
    setTenantHolidays(data);
  };

  const handleLeaveCountingModeChange = async (mode: LeaveCountingMode) => {
    const previous = leaveCountingMode;
    setLeaveCountingMode(mode);
    try {
      await updateTenantLeaveCountingMode(mode);
      toast.success(t.leaves.policyUpdated);
    } catch (err) {
      setLeaveCountingMode(previous);
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleLeaveAccrualModeChange = async (mode: LeaveAccrualMode) => {
    const previous = leaveAccrualMode;
    setLeaveAccrualMode(mode);
    try {
      await updateTenantLeaveAccrualMode(mode);
      toast.success(t.leaves.policyUpdated);
    } catch (err) {
      setLeaveAccrualMode(previous);
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const saveLegalRegime = async () => {
    const option = LEGAL_COUNTRY_OPTIONS.find(country => country.code === legalCountryCode);
    if (!legalCountryCode || (!option && legalCountryCode.length !== 2)) return;
    setSavingLegalRegime(true);
    try {
      const alignedHolidayCountry = alignHolidayCalendar && option
        ? option.holidayCountry as HolidayCountry
        : undefined;
      await updateTenantLegalRegime(
        legalCountryCode,
        alignedHolidayCountry,
        leaveConventionCode,
        leaveConventionEffectiveDate,
      );
      if (alignedHolidayCountry) setHolidayCountry(alignedHolidayCountry);
      setAlignHolidayCalendar(false);
      toast.success(t.settings.legalCountrySaved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingLegalRegime(false);
    }
  };

  const saveHonorMedalBonusDays = async () => {
    setSavingHonorMedalBonus(true);
    try {
      await updateTenantHonorMedalBonusDays(honorMedalBonusDays);
      toast.success(t.settings.honorMedalBonusSaved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingHonorMedalBonus(false);
    }
  };

  const saveTenantHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name.trim()) {
      toast.error(t.settings.holidayRequired);
      return;
    }
    setSavingHoliday(true);
    try {
      await upsertTenantHoliday({ date: holidayForm.date, name: holidayForm.name.trim() });
      setHolidayForm({ date: '', name: '' });
      await loadTenantHolidays();
      toast.success(t.settings.holidaySaved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingHoliday(false);
    }
  };

  const seedDefaultPublicHolidays = async () => {
    setSeedingHolidays(true);
    try {
      await Promise.all(getPublicHolidaysByCountry(CURRENT_YEAR, holidayCountry, t).map(upsertTenantHoliday));
      await loadTenantHolidays();
      toast.success(t.settings.defaultHolidaysLoaded);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSeedingHolidays(false);
    }
  };

  const deleteTenantHoliday = async (holidayId: number) => {
    try {
      await removeTenantHoliday(holidayId);
      setTenantHolidays(prev => prev.filter(h => h.id !== holidayId));
      toast.success(t.settings.holidayDeleted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  };

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
  const [rolloverYear, setRolloverYear] = useState(new Date().getFullYear() - 1);
  const [rolloverLoading, setRolloverLoading] = useState(false);
  const [rolloverResult, setRolloverResult] = useState<{ employees_processed: number; year_closed: number; year_opened: number } | null>(null);
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

  const exportToCSV = () => {
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
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conges_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          pageId="leaves"
          onDismiss={dismissTips}
          pageTitle={t.leaves.title}
        />
      )}
      <div className="py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Actions */}
        <div className="flex justify-end gap-3 mb-6">
            <button
              onClick={() => setShowNewLeaveModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t.leaves.newRequest}
            </button>
            {['rh', 'admin', 'dg', 'super_admin'].includes(currentUserRole) && (
              <>
                <Link
                  href="/dashboard/leaves/handovers"
                  className="px-4 py-2 border border-primary-200 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 flex items-center gap-2"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Passations
                </Link>
                <button
                  onClick={() => setShowInitModal(true)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t.leaves.initializeBalances}
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t.leaves.exportCsv}
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
        <div data-tour="leaves-tabs" className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {([
            { key: 'requests', label: t.leaves.tabs.requests, icon: Clock, roles: ['employee', 'manager', 'rh', 'admin', 'dg', 'super_admin'] as string[] },
            { key: 'calendar', label: t.leaves.tabs.calendar, icon: CalendarDays, roles: ['employee', 'manager', 'rh', 'admin', 'dg', 'super_admin'] as string[] },
            { key: 'balances', label: t.leaves.tabs.balances, icon: BarChart3, roles: ['rh', 'admin', 'dg', 'super_admin'] as string[] },
            { key: 'recalls', label: t.leaves.tabs.recalls, icon: AlertCircle, roles: ['manager', 'rh', 'admin', 'dg', 'super_admin'] as string[] },
            { key: 'sick', label: 'Maladie pendant congé', icon: Heart, roles: ['manager', 'rh', 'admin', 'dg', 'super_admin'] as string[] },
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
            <div data-tour="leaves-filters" className="p-4 border-b border-gray-200 flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder={t.leaves.searchEmployee}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">{t.leaves.allStatuses}</option>
                <option value="pending">{t.leaves.pending}</option>
                <option value="manager_approved">{t.leaves.pendingNextApproval}</option>
                <option value="n2_approved">{t.leaves.pendingRh}</option>
                <option value="approved">{t.leaves.stats.approved}</option>
                <option value="rejected">{t.leaves.stats.refused}</option>
              </select>
              {['rh', 'admin', 'dg', 'super_admin'].includes(currentUserRole) && (
                <SearchableSelect
                  className="min-w-[200px]"
                  value={departmentFilter ? String(departmentFilter) : ''}
                  onChange={(val) => { setDepartmentFilter(val ? parseInt(val) : undefined); setPage(1); }}
                  placeholder={t.leaves.allDepartments}
                  options={departments.map(dept => ({
                    value: String(dept.id),
                    label: dept.name,
                  }))}
                />
              )}
              <select
                value={leaveTypeFilter || ''}
                onChange={(e) => { setLeaveTypeFilter(e.target.value ? parseInt(e.target.value) : undefined); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">{t.leaves.allTypes}</option>
                {leaveTypes.map(lt => (
                  <option key={lt.id} value={lt.id}>{lt.name}</option>
                ))}
              </select>
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
                      <td className="px-4 py-4"><StatusBadge status={request.status} currentApprovalStep={request.current_approval_step} /></td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {canProcessLeaveRequest(request) ? t.leaves.process : t.leaves.view}
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

        {activeTab === 'settings' && canManageLeaveSettings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LeaveWorkflowSettingsCard />

            <div className="bg-white rounded-xl border border-gray-200 p-6 md:col-span-2">
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

            <div className="bg-white rounded-xl border border-primary-200 p-6 md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                {t.settings.legalRegimeTitle}
              </h3>
              <p className="text-gray-500 text-sm mb-4">{t.settings.legalRegimeHint}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-2">{t.settings.legalCountry}</span>
                  <select
                    value={legalCountryCode}
                    onChange={(event) => {
                      setLegalCountryCode(event.target.value);
                      setLeaveConventionCode('');
                      setLeaveConventionEffectiveDate('');
                      setAlignHolidayCalendar(false);
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="">{t.settings.selectLegalCountry}</option>
                    {legalCountryCode && !LEGAL_COUNTRY_OPTIONS.some(country => country.code === legalCountryCode) && (
                      <option value={legalCountryCode}>{t.settings.unsupportedLegalCountry} ({legalCountryCode})</option>
                    )}
                    {LEGAL_COUNTRY_OPTIONS.map(country => (
                      <option key={country.code} value={country.code}>
                        {country[locale]} ({country.code})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-gray-400">{t.settings.legalCountryHint}</p>
                </label>

                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-2">{t.settings.leaveConvention}</span>
                  <select
                    value={leaveConventionCode}
                    onChange={(event) => {
                      setLeaveConventionCode(event.target.value);
                      if (event.target.value && !leaveConventionEffectiveDate) {
                        setLeaveConventionEffectiveDate(new Date().toISOString().slice(0, 10));
                      }
                    }}
                    disabled={!legalCountryCode}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                  >
                    <option value="">{t.settings.customLeaveConfiguration}</option>
                    {leaveConventions.map(convention => (
                      <option key={convention.code} value={convention.code}>
                        {convention.name[locale]} · v{convention.version}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-gray-400">
                    {leaveConventions.length === 0 && legalCountryCode
                      ? t.settings.noLeaveConventionAvailable
                      : t.settings.leaveConventionHint}
                  </p>
                </label>

                {leaveConventionCode && (
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-2">{t.settings.conventionEffectiveDate}</span>
                    <input
                      type="date"
                      value={leaveConventionEffectiveDate}
                      onChange={(event) => setLeaveConventionEffectiveDate(event.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                    <p className="mt-1.5 text-xs text-gray-400">{t.settings.conventionEffectiveDateHint}</p>
                  </label>
                )}

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm text-gray-500">{t.settings.currentHolidayCalendar}</div>
                  <div className="mt-1 font-semibold text-gray-900">{holidayCountry}</div>
                  <label className={`mt-4 flex items-start gap-3 ${legalCountryCode ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={alignHolidayCalendar}
                      disabled={!legalCountryCode || !LEGAL_COUNTRY_OPTIONS.some(country => country.code === legalCountryCode)}
                      onChange={(event) => setAlignHolidayCalendar(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{t.settings.alignHolidayCalendar}</span>
                      <span className="mt-1 block text-xs text-gray-500">{t.settings.alignHolidayCalendarHint}</span>
                    </span>
                  </label>
                </div>
              </div>

              {(() => {
                const convention = leaveConventions.find(item => item.code === leaveConventionCode);
                if (!convention) return null;
                return (
                  <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-gray-900">{convention.name[locale]}</div>
                        <div className="text-xs text-gray-500">{convention.reference} · v{convention.version}</div>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                        {t.settings.referenceOnly}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="rounded-lg bg-white p-3 border border-primary-100">
                        <div className="text-gray-500">{t.settings.monthlyAccrualRule}</div>
                        <div className="mt-1 font-semibold text-gray-900">{convention.rules.monthly_accrual_working_days} {t.settings.workingDaysPerMonth}</div>
                      </div>
                      <div className="rounded-lg bg-white p-3 border border-primary-100">
                        <div className="text-gray-500">{t.settings.seniorityRule}</div>
                        <div className="mt-1 font-semibold text-gray-900">
                          {convention.rules.seniority_bonus_working_days.map(rule => `${rule.years} ${t.settings.years}: +${rule.days}`).join(' · ')}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white p-3 border border-primary-100">
                        <div className="text-gray-500">{t.settings.honorMedalConventionRule}</div>
                        <div className="mt-1 font-semibold text-gray-900">+{convention.rules.honor_medal_bonus_working_days} {t.settings.workingDayAllMedals}</div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-amber-800">{t.settings.referenceOnlyHint}</p>
                  </div>
                );
              })()}

              <div className="mt-5 border-t border-gray-200 pt-5">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  {t.settings.companyMedalBenefitTitle}
                </h4>
                <p className="mt-1 text-sm text-gray-500">{t.settings.companyMedalBenefitHint}</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {([
                    ['silver', t.components.addEmployee.fields.silverMedal],
                    ['vermeil', t.components.addEmployee.fields.vermeilMedal],
                    ['gold', t.components.addEmployee.fields.goldMedal],
                    ['grand_gold', t.components.addEmployee.fields.grandGoldMedal],
                  ] as const).map(([code, label]) => (
                    <label key={code} className="block">
                      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0} max={365} step={0.5}
                          value={honorMedalBonusDays[code]}
                          onChange={(event) => setHonorMedalBonusDays(previous => ({
                            ...previous,
                            [code]: Math.max(0, Math.min(365, Number(event.target.value) || 0)),
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                        />
                        <span className="text-sm text-gray-500">{t.settings.days}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={saveHonorMedalBonusDays} disabled={savingHonorMedalBonus}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-primary-300 text-primary-700 font-medium rounded-lg hover:bg-primary-50 disabled:opacity-50">
                    <Save className="w-4 h-4" />
                    {savingHonorMedalBonus ? t.settings.saving : t.settings.saveCompanyBenefit}
                  </button>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowLegalRegimeConfirm(true)}
                  disabled={!legalCountryCode || savingLegalRegime || (!!leaveConventionCode && !leaveConventionEffectiveDate)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingLegalRegime ? t.settings.saving : t.settings.saveLegalRegime}
                </button>
              </div>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary-600" />
                {t.settings.leaveCountingMode}
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                {t.settings.leaveCountingHint}
              </p>
              <select
                value={leaveCountingMode}
                onChange={(e) => handleLeaveCountingModeChange(e.target.value as LeaveCountingMode)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
              >
                <option value="working_days">{t.settings.leaveCountingWorkingDays}</option>
                <option value="calendar_days">{t.settings.leaveCountingCalendarDays}</option>
                <option value="calendar_days_except_sunday">{t.settings.leaveCountingCalendarExceptSunday}</option>
              </select>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-600" />
                {t.settings.leaveAccrualMode}
              </h3>
              <p className="text-gray-500 text-sm mb-4">{t.settings.leaveAccrualHint}</p>
              <select
                value={leaveAccrualMode}
                onChange={(event) => handleLeaveAccrualModeChange(event.target.value as LeaveAccrualMode)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
              >
                <option value="prorata_30_days">{t.settings.leaveAccrualProrata}</option>
                <option value="calendar_month">{t.settings.leaveAccrualCalendarMonth}</option>
              </select>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary-600" />
                    {t.settings.publicHolidays} {CURRENT_YEAR}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">{t.settings.publicHolidaysHint}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                    {holidayCountry}
                  </span>
                  <button
                    type="button"
                    onClick={seedDefaultPublicHolidays}
                    disabled={seedingHolidays}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Calendar className={`w-4 h-4 ${seedingHolidays ? 'animate-pulse' : ''}`} />
                    {t.settings.loadYearHolidays}
                  </button>
                  <button
                    type="button"
                    onClick={loadTenantHolidays}
                    className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title={t.settings.refresh}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3">
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm(prev => ({ ...prev, date: e.target.value }))}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
                <input
                  type="text"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm(prev => ({ ...prev, name: e.target.value }))}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder={t.settings.publicHolidayNamePlaceholder}
                />
                <button
                  type="button"
                  onClick={saveTenantHoliday}
                  disabled={savingHoliday}
                  className="inline-flex items-center justify-center px-4 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  <Save className={`w-4 h-4 ${savingHoliday ? 'animate-pulse' : ''}`} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {tenantHolidays.length === 0 ? (
                  <p className="text-sm text-gray-400 md:col-span-2">{t.settings.noPublicHolidays}</p>
                ) : tenantHolidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{holiday.name}</p>
                      <p className="text-xs text-gray-500">{new Date(`${holiday.date}T00:00:00`).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTenantHoliday(holiday.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={t.settings.delete}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

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

            {/* Carte report annuel des soldes */}
            {['admin', 'rh', 'dg', 'super_admin'].includes(currentUserRole) && (
              <div className="bg-white rounded-xl border border-amber-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-amber-600" />
                  Report des soldes N → N+1
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                  Reporte les jours non pris de l'année sélectionnée vers l'année suivante,
                  selon la politique configurée sur chaque type de congé (plafond, durée, date d'expiration).
                </p>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Année à clôturer</label>
                    <select
                      value={rolloverYear}
                      onChange={(e) => { setRolloverYear(parseInt(e.target.value)); setRolloverResult(null); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {[new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()].map(y => (
                        <option key={y} value={y}>{y} → {y + 1}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {rolloverResult && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    ✓ Report {rolloverResult.year_closed} → {rolloverResult.year_opened} effectué pour <strong>{rolloverResult.employees_processed} employés</strong>.
                  </div>
                )}
                <button
                  onClick={async () => {
                    setRolloverLoading(true);
                    setRolloverResult(null);
                    try {
                      const result = await rolloverBalances(rolloverYear);
                      setRolloverResult(result);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Erreur lors du report');
                    } finally {
                      setRolloverLoading(false);
                    }
                  }}
                  disabled={rolloverLoading}
                  className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${rolloverLoading ? 'animate-spin' : ''}`} />
                  {rolloverLoading ? 'Report en cours…' : `Reporter les soldes ${rolloverYear} → ${rolloverYear + 1}`}
                </button>
              </div>
            )}
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
      <ConfirmDialog
        isOpen={showLegalRegimeConfirm}
        onClose={() => setShowLegalRegimeConfirm(false)}
        onConfirm={saveLegalRegime}
        title={t.settings.confirmLegalCountryTitle}
        message={(alignHolidayCalendar
          ? t.settings.confirmLegalCountryAlignCalendar
          : t.settings.confirmLegalCountryKeepCalendar
        ).replace(
          '{country}',
          alignHolidayCalendar
            ? (LEGAL_COUNTRY_OPTIONS.find(country => country.code === legalCountryCode)?.[locale] || legalCountryCode)
            : holidayCountry,
        ) + (leaveConventionCode ? ` ${t.settings.confirmConventionReference}` : '')}
        confirmText={t.common.confirm}
        cancelText={t.common.cancel}
      />
    </>
  );
}
