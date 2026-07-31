import { API_URL, fetchWithAuth } from '@/lib/api';

export type EmployeeFinanceRequestType = 'advance' | 'loan';
export type EmployeeFinanceStatus =
  | 'pending_hr'
  | 'rejected'
  | 'pending_finance'
  | 'approved'
  | 'paid_out'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface EmployeeFinanceSettings {
  id: number;
  tenant_id: number;
  currency: string;
  advance_settings: Record<string, unknown>;
  loan_settings: Record<string, unknown>;
  finance_approval_settings: Record<string, unknown>;
}

export interface EmployeeFinanceSettingsUpdate {
  currency?: string;
  advance_settings?: Record<string, unknown>;
  loan_settings?: Record<string, unknown>;
  finance_approval_settings?: Record<string, unknown>;
}

export interface EmployeeLoanInstallment {
  id: number;
  period_year: number;
  period_month: number;
  amount_due: number | string;
  amount_deducted: number | string;
  status: string;
}

export interface EmployeeFinanceRequest {
  id: number;
  tenant_id: number;
  employee_id: number;
  employee_name?: string | null;
  employee_department?: string | null;
  employee_job_title?: string | null;
  request_type: EmployeeFinanceRequestType;
  amount_requested: number | string;
  amount_approved?: number | string | null;
  currency: string;
  reason?: string | null;
  status: EmployeeFinanceStatus;
  first_payroll_year: number;
  first_payroll_month: number;
  installments_count?: number | null;
  monthly_amount?: number | string | null;
  remaining_amount?: number | string | null;
  rejection_reason?: string | null;
  paid_at?: string | null;
  payout_method?: string | null;
  payout_reference?: string | null;
  payout_proof_url?: string | null;
  payout_comment?: string | null;
  created_at?: string | null;
  installments: EmployeeLoanInstallment[];
}

export interface EmployeeFinanceSummary {
  pending_hr_count: number;
  pending_finance_count: number;
  active_count: number;
  paid_out_total: number | string;
  remaining_total: number | string;
  monthly_due_total: number | string;
}

export type EmployeeBankLoanStatus = 'active' | 'settled' | 'suspended' | 'closed';

export interface EmployeeBankLoanInstallment {
  id: number;
  period_year: number;
  period_month: number;
  amount_due: number | string;
  status: string;
}

export interface EmployeeBankLoan {
  id: number;
  tenant_id: number;
  employee_id: number;
  employee_name?: string | null;
  employee_department?: string | null;
  bank_name: string;
  loan_reference?: string | null;
  initial_amount: number | string;
  remaining_balance?: number | string | null;
  currency: string;
  start_date: string;
  end_date: string;
  schedule_type: 'fixed' | 'custom';
  monthly_amount?: number | string | null;
  status: EmployeeBankLoanStatus;
  proof_url?: string | null;
  notes?: string | null;
  installments: EmployeeBankLoanInstallment[];
}

export interface EmployeeBankLoanInput {
  employee_id: number;
  bank_name: string;
  loan_reference?: string;
  initial_amount: number;
  remaining_balance?: number;
  currency?: string;
  start_date: string;
  end_date: string;
  schedule_type: 'fixed' | 'custom';
  monthly_amount?: number;
  proof_url?: string;
  notes?: string;
  installments?: Array<{ period_year: number; period_month: number; amount_due: number }>;
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithAuth(`${API_URL}${path}`, options);
  } catch (error) {
    throw new Error(
      "API Avances & Prêts indisponible. Vérifiez que le backend et la migration sont déployés.",
    );
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || 'Erreur API');
  }
  return response.json();
}

export function formatMoney(value: number | string | null | undefined, currency = 'XOF') {
  if (value == null) return '-';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(numericValue);
}

export const EMPLOYEE_FINANCE_STATUS: Record<EmployeeFinanceStatus, { label: string; color: string }> = {
  pending_hr: { label: 'En attente RH', color: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Rejetée', color: 'bg-red-100 text-red-700' },
  pending_finance: { label: 'À décaisser', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approuvée', color: 'bg-indigo-100 text-indigo-700' },
  paid_out: { label: 'Versée', color: 'bg-emerald-100 text-emerald-700' },
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Terminée', color: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-600' },
};

export const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export const employeeFinanceApi = {
  getSettings: () => apiJson<EmployeeFinanceSettings>('/api/cb/employee-finance/settings'),
  updateSettings: (body: EmployeeFinanceSettingsUpdate) =>
    apiJson<EmployeeFinanceSettings>('/api/cb/employee-finance/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  getSummary: () => apiJson<EmployeeFinanceSummary>('/api/cb/employee-finance/summary'),
  listBankLoans: () => apiJson<EmployeeBankLoan[]>('/api/cb/employee-finance/bank-loans'),
  createBankLoan: (body: EmployeeBankLoanInput) =>
    apiJson<EmployeeBankLoan>('/api/cb/employee-finance/bank-loans', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateBankLoan: (id: number, body: Partial<Omit<EmployeeBankLoanInput, 'employee_id'>> & { status?: EmployeeBankLoanStatus }) =>
    apiJson<EmployeeBankLoan>(`/api/cb/employee-finance/bank-loans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  listRequests: () => apiJson<EmployeeFinanceRequest[]>('/api/cb/employee-finance/requests'),
  listMyRequests: () => apiJson<EmployeeFinanceRequest[]>('/api/cb/employee-finance/my-requests'),
  createMyRequest: (body: {
    request_type: EmployeeFinanceRequestType;
    amount_requested: number;
    reason?: string;
    first_payroll_year: number;
    first_payroll_month: number;
    installments_count?: number;
  }) =>
    apiJson<EmployeeFinanceRequest>('/api/cb/employee-finance/my-requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createRequest: (body: {
    employee_id: number;
    request_type: EmployeeFinanceRequestType;
    amount_requested: number;
    reason?: string;
    first_payroll_year: number;
    first_payroll_month: number;
    installments_count?: number;
  }) =>
    apiJson<EmployeeFinanceRequest>('/api/cb/employee-finance/requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  approve: (id: number, body: { amount_approved?: number; installments_count?: number }) =>
    apiJson<EmployeeFinanceRequest>(`/api/cb/employee-finance/requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reject: (id: number, rejection_reason: string) =>
    apiJson<EmployeeFinanceRequest>(`/api/cb/employee-finance/requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejection_reason }),
    }),
  markPaid: (id: number, body: {
    payout_method: string;
    payout_reference?: string;
    payout_proof_url?: string;
    payout_comment?: string;
  }) =>
    apiJson<EmployeeFinanceRequest>(`/api/cb/employee-finance/requests/${id}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  uploadPayoutProof: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiJson<EmployeeFinanceRequest>(`/api/cb/employee-finance/requests/${id}/payout-proof`, {
      method: 'POST',
      body: formData,
    });
  },
  deductInstallment: (id: number, body: { amount_deducted?: number } = {}) =>
    apiJson<EmployeeFinanceRequest>(`/api/cb/employee-finance/installments/${id}/deduct`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postponeInstallment: (id: number, body: { months?: number; reason?: string } = {}) =>
    apiJson<EmployeeFinanceRequest>(`/api/cb/employee-finance/installments/${id}/postpone`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deductRequestRepayment: (id: number, body: { amount_deducted?: number } = {}) =>
    apiJson<EmployeeFinanceRequest>(`/api/cb/employee-finance/requests/${id}/repayment/deduct`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postponeRequestRepayment: (id: number, body: { months?: number; reason?: string } = {}) =>
    apiJson<EmployeeFinanceRequest>(`/api/cb/employee-finance/requests/${id}/repayment/postpone`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
