/**
 * Client API pour le module Paie (targetym-api /api/payroll/*)
 * Utilise fetchWithAuth depuis lib/api.ts
 */
import { fetchWithAuth, API_URL } from './api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PayrollConfig {
  id: number;
  tenant_id: number;
  country_code: string;
  currency_code: string;
  fiscal_year_start_month: number;
  default_work_days_per_month: number;
  subscription_status: string;
  activated_by_plan: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
  // Identifiants employeur
  ninea: string | null;
  ipres_employer_number: string | null;
  css_employer_number: string | null;
  convention_collective: string | null;
  company_address: string | null;
}

export interface PayrollBulletinHeader {
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  ninea: string | null;
  ipres_employer_number: string | null;
  css_employer_number: string | null;
  convention_collective: string | null;
  currency_code: string;
}

export interface PayComponent {
  id: number;
  tenant_id: number;
  code: string;
  name: string;
  component_type: 'earning' | 'deduction' | 'employer_contribution' | 'info' | 'net_adjustment';
  calc_type: string;
  calc_params: Record<string, unknown>;
  is_taxable: boolean;
  is_subject_to_cotisations: boolean;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface PayComponentCreate {
  code: string;
  name: string;
  component_type: PayComponent['component_type'];
  calc_type: string;
  calc_params: Record<string, unknown>;
  is_taxable: boolean;
  is_subject_to_cotisations: boolean;
  is_active: boolean;
  order_index: number;
}

export interface PayrollRun {
  id: number;
  tenant_id: number;
  period_year: number;
  period_month: number;
  status: 'draft' | 'simulation' | 'validated' | 'cancelled';
  total_brut: number | null;
  total_net: number | null;
  total_charges_patronales: number | null;
  employee_count: number | null;
  notes: string | null;
  validated_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaySlipLine {
  id: number;
  component_id: number;
  component_code: string;
  component_name: string;
  component_type: string;
  base_amount: number | null;
  rate: number | null;
  amount: number;
  order_index: number;
}

export interface PaySlip {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  tenant_id: number;
  period_year: number;
  period_month: number;
  status: string;
  brut_total: number | null;
  cotisations_salariales: number | null;
  ir_amount: number | null;
  net_imposable: number | null;
  net_a_payer: number | null;
  charges_patronales: number | null;
  lines: PaySlipLine[];
  created_at: string;
  updated_at: string;
}

export interface PayVariable {
  id: number;
  tenant_id: number;
  employee_id: number;
  component_id: number;
  component_code: string | null;
  component_name: string | null;
  period_year: number;
  period_month: number;
  value: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

export async function getPayrollConfig(): Promise<PayrollConfig | null> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/config`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export interface PayrollConfigUpdate {
  ninea?: string | null;
  ipres_employer_number?: string | null;
  css_employer_number?: string | null;
  convention_collective?: string | null;
  company_address?: string | null;
  default_work_days_per_month?: number;
  fiscal_year_start_month?: number;
}

export async function deletePayrollProfile(employeeId: number): Promise<void> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/employees/${employeeId}/profile`, {
    method: 'DELETE',
  });
  if (!r.ok && r.status !== 404) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail || `${r.status}`);
  }
}

export async function updatePayrollConfig(data: PayrollConfigUpdate): Promise<PayrollConfig> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/config`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `${r.status}`);
  }
  return r.json();
}

export async function getPayrollBulletinHeader(): Promise<PayrollBulletinHeader> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/config/bulletin-header`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// ── Rubriques ─────────────────────────────────────────────────────────────────

export async function getComponents(includeInactive = false): Promise<PayComponent[]> {
  const url = `${API_URL}/api/payroll/components${includeInactive ? '?include_inactive=true' : ''}`;
  const r = await fetchWithAuth(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function createComponent(data: PayComponentCreate): Promise<PayComponent> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/components`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `${r.status}`);
  }
  return r.json();
}

export async function updateComponent(id: number, data: PayComponentCreate): Promise<PayComponent> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/components/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `${r.status}`);
  }
  return r.json();
}

export async function deactivateComponent(id: number): Promise<void> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/components/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`${r.status}`);
}

// ── Variables mensuelles ──────────────────────────────────────────────────────

export async function getVariables(year: number, month: number, employeeId?: number): Promise<PayVariable[]> {
  const url = `${API_URL}/api/payroll/variables/${year}/${month}${employeeId ? `?employee_id=${employeeId}` : ''}`;
  const r = await fetchWithAuth(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function createVariable(data: {
  employee_id: number;
  component_id: number;
  period_year: number;
  period_month: number;
  value: number;
}): Promise<PayVariable> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/variables`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `${r.status}`);
  }
  return r.json();
}

export async function updateVariable(id: number, value: number): Promise<PayVariable> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/variables/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function deleteVariable(id: number): Promise<void> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/variables/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`${r.status}`);
}

export async function lockPeriod(year: number, month: number): Promise<void> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/variables/lock/${year}/${month}`, { method: 'POST' });
  if (!r.ok) throw new Error(`${r.status}`);
}

// ── Profils de paie employés ──────────────────────────────────────────────────

export interface EmployeePayrollProfile {
  id: number;
  employee_id: number;
  tenant_id: number;
  classification: string | null;
  salary_scale_id: number | null;
  contract_type: 'cdi' | 'cdd' | 'stage' | 'consultant' | null;
  base_salary: number | null;
  transport_allowance: number | null;
  housing_allowance: number | null;
  family_parts: number | null;
  ipres_enrolled: boolean;
  ipm_enrolled: boolean;
  css_enrolled: boolean;
  cfce_enrolled: boolean;
  bank_name: string | null;
  bank_account_number: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EmployeePayrollProfileCreate {
  base_salary?: number;
  transport_allowance?: number;
  housing_allowance?: number;
  family_parts?: number;
  contract_type?: 'cdi' | 'cdd' | 'stage' | 'consultant';
  classification?: string;
  ipres_enrolled: boolean;
  ipm_enrolled: boolean;
  css_enrolled: boolean;
  cfce_enrolled: boolean;
  bank_name?: string;
  bank_account_number?: string;
}

export async function getBulkPayrollProfiles(employeeIds: number[]): Promise<Record<string, EmployeePayrollProfile>> {
  if (employeeIds.length === 0) return {};
  const params = employeeIds.map(id => `employee_ids=${id}`).join('&');
  const r = await fetchWithAuth(`${API_URL}/api/payroll/employees/profiles/bulk?${params}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function getEmployeePayrollProfile(employeeId: number): Promise<EmployeePayrollProfile | null> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/employees/${employeeId}/profile`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function createEmployeePayrollProfile(
  employeeId: number,
  data: EmployeePayrollProfileCreate,
): Promise<EmployeePayrollProfile> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/employees/${employeeId}/profile`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `${r.status}`);
  }
  return r.json();
}

export async function updateEmployeePayrollProfile(
  employeeId: number,
  data: Partial<EmployeePayrollProfileCreate>,
): Promise<EmployeePayrollProfile> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/employees/${employeeId}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `${r.status}`);
  }
  return r.json();
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export async function getRuns(): Promise<{ items: PayrollRun[]; total: number }> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/runs`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function createRun(data: {
  period_year: number;
  period_month: number;
  notes?: string;
}): Promise<PayrollRun> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/runs`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `${r.status}`);
  }
  return r.json();
}

export async function getRun(runId: number): Promise<PayrollRun> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/runs/${runId}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function simulateRun(runId: number): Promise<PayrollRun> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/runs/${runId}/simulate`, { method: 'POST' });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `${r.status}`);
  }
  return r.json();
}

export async function validateRun(runId: number): Promise<PayrollRun> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/runs/${runId}/validate`, { method: 'POST' });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `${r.status}`);
  }
  return r.json();
}

export async function getSlips(runId: number): Promise<PaySlip[]> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/runs/${runId}/slips`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function getSlip(runId: number, employeeId: number): Promise<PaySlip> {
  const r = await fetchWithAuth(`${API_URL}/api/payroll/runs/${runId}/slips/${employeeId}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export function formatXOF(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount);
}

export const RUN_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Brouillon',  color: 'bg-gray-100 text-gray-700' },
  simulation: { label: 'Simulé',     color: 'bg-blue-100 text-blue-700' },
  validated: { label: 'Validé',     color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Annulé',     color: 'bg-red-100 text-red-700' },
};

export const COMPONENT_TYPE_LABEL: Record<string, string> = {
  earning: 'Gain',
  deduction: 'Retenue salarié',
  employer_contribution: 'Charge patronale',
  info: 'Information',
  net_adjustment: 'Ajustement net',
};

export const COMPONENT_TYPE_COLOR: Record<string, string> = {
  earning: 'bg-green-100 text-green-700',
  deduction: 'bg-red-100 text-red-700',
  employer_contribution: 'bg-orange-100 text-orange-700',
  info: 'bg-gray-100 text-gray-600',
  net_adjustment: 'bg-purple-100 text-purple-700',
};
