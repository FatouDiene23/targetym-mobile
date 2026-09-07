import { API_URL, fetchWithAuth } from '@/lib/api';


export interface CertificationCatalogItem {
  id: number;
  name: string;
  category?: string | null;
  provider?: string | null;
  description?: string | null;
  validity_months?: number | null;
  is_internal: boolean;
}

export interface CertificationAdminItem extends CertificationCatalogItem {
  provider_id?: number | null;
  total_holders: number;
  expiring_soon: number;
}

export interface CertificationHolder {
  id: number;
  employee_id: number;
  employee_name: string;
  obtained_date: string;
  expiry_date?: string | null;
  status: string;
  credential_id?: string | null;
  credential_url?: string | null;
  certificate_url?: string | null;
  certificate_filename?: string | null;
}

export interface PreparationCourse {
  id: number;
  title: string;
}

export interface PersonalCertification {
  id: number;
  certification_type_id: number;
  name: string;
  provider?: string | null;
  obtained_date: string;
  expiry_date?: string | null;
  status: 'valid' | 'expiring' | 'expired' | 'revoked';
  credential_id?: string | null;
  credential_url?: string | null;
  certificate_filename?: string | null;
  certificate_url?: string | null;
  source: string;
}

export interface CertificationApprovalStep {
  id: number;
  step_order: number;
  step_type: 'manager_n1' | 'manager_n2' | 'learning_admin' | 'finance';
  required: boolean;
  status: 'waiting' | 'pending' | 'approved' | 'rejected' | 'skipped' | 'blocked';
  assigned_employee_id?: number | null;
  decided_by_user_id?: number | null;
  decided_at?: string | null;
  comments?: string | null;
}

export interface CertificationRequest {
  id: number;
  employee_id: number;
  employee_name?: string | null;
  request_origin: 'employee_request' | 'manager_assignment' | 'admin_assignment';
  is_mandatory: boolean;
  certification_type_id?: number | null;
  certification_name: string;
  other_certification_name?: string | null;
  provider?: string | null;
  motivation: string;
  target_date?: string | null;
  preparatory_training_required: boolean;
  preparation_course_id?: number | null;
  preparation_course_name?: string | null;
  training_cost: number;
  exam_cost: number;
  other_cost: number;
  total_cost: number;
  currency: string;
  funding_mode: 'company' | 'employee_reimbursement' | 'self_funded';
  requires_finance: boolean;
  finance_status: 'not_required' | 'pending' | 'approved' | 'paid';
  approved_amount?: number | null;
  paid_amount?: number | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  status: string;
  current_step?: string | null;
  rejection_reason?: string | null;
  quote_filename?: string | null;
  result_filename?: string | null;
  result_outcome?: 'obtained' | 'failed' | 'postponed' | null;
  result_comments?: string | null;
  postponed_until?: string | null;
  result_obtained_date?: string | null;
  result_credential_id?: string | null;
  result_credential_url?: string | null;
  created_at: string;
  steps: CertificationApprovalStep[];
  actionable_step_id?: number;
  actionable_type?: 'approval' | 'payment';
}

export interface CertificationRequestInput {
  certification_type_id?: number | null;
  other_certification_name?: string | null;
  provider?: string | null;
  motivation: string;
  target_date?: string | null;
  preparatory_training_required: boolean;
  preparation_course_id?: number | null;
  training_cost: number;
  exam_cost: number;
  other_cost: number;
  currency: string;
  funding_mode: 'company' | 'employee_reimbursement' | 'self_funded';
  requires_finance: boolean;
}

export interface CertificationAssignmentInput extends CertificationRequestInput {
  employee_ids: number[];
  is_mandatory: boolean;
}

export interface CertificationAssignmentTarget {
  id: number;
  name: string;
  email: string;
  job_title?: string | null;
  employee_number?: string | null;
}

export interface EmployeeCertificationAdminItem extends CertificationHolder {
  certification_type_id: number;
  certification_name: string;
  provider?: string | null;
  source: string;
  source_note?: string | null;
  verified_at?: string | null;
}

export interface EmployeeCertificationImportInput {
  employee_id: number;
  certification_type_id: number;
  obtained_date: string;
  expiry_date?: string | null;
  credential_id?: string | null;
  credential_url?: string | null;
  source: 'manual' | 'legacy_sirh' | 'excel' | 'document' | 'other';
  source_note?: string | null;
}

export interface CertificationWorkflowStep {
  type: 'manager_n1' | 'manager_n2' | 'learning_admin' | 'finance';
  required: boolean;
  conditional?: boolean;
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchWithAuth(`${API_URL}${path}`, options);
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = typeof payload?.detail === 'string'
        ? payload.detail
        : Array.isArray(payload?.detail)
          ? payload.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(', ')
          : '';
    } catch { /* réponse non JSON */ }
    throw new Error(detail || `Erreur ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function listCertificationCatalog(search = ''): Promise<CertificationCatalogItem[]> {
  const params = new URLSearchParams({ page_size: '100' });
  if (search.trim()) params.set('search', search.trim());
  const result = await requestJson<{ items: CertificationCatalogItem[] }>(
    `/api/learning/certification-catalog/?${params}`,
  );
  return result.items;
}

export async function listPreparationCourses(): Promise<PreparationCourse[]> {
  const result = await requestJson<{ items: PreparationCourse[] }>('/api/learning/courses/?page_size=100&is_active=true');
  return result.items;
}

export const listCertificationAdminItems = () =>
  requestJson<CertificationAdminItem[]>('/api/learning/certifications/');

export const listCertificationHolders = (certificationId: number) =>
  requestJson<CertificationHolder[]>(`/api/learning/certifications/${certificationId}/holders`);

export const createCertificationAdminItem = (payload: Omit<CertificationCatalogItem, 'id'>) =>
  requestJson<{ id: number; message: string }>('/api/learning/certifications/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });

export const updateCertificationAdminItem = (id: number, payload: Partial<Omit<CertificationCatalogItem, 'id'>>) =>
  requestJson<{ id: number; message: string }>(`/api/learning/certifications/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });

export const deactivateCertificationAdminItem = (id: number) =>
  requestJson<{ message: string }>(`/api/learning/certifications/${id}`, { method: 'DELETE' });

export const listMyCertifications = () =>
  requestJson<PersonalCertification[]>('/api/learning/my-certifications/');

export const listMyCertificationRequests = () =>
  requestJson<CertificationRequest[]>('/api/learning/certification-requests/my');

export const listMyCertificationWork = () =>
  requestJson<CertificationRequest[]>('/api/learning/certification-requests/to-do');

export const listActionableCertificationRequests = () =>
  requestJson<CertificationRequest[]>('/api/learning/certification-requests/actionable');

export async function listAdminCertificationRequests(page = 1, status = '') {
  const params = new URLSearchParams({ page: String(page), page_size: '20' });
  if (status) params.set('status', status);
  return requestJson<{ items: CertificationRequest[]; total: number; page: number; page_size: number }>(
    `/api/learning/certification-requests/admin?${params}`,
  );
}

export const createCertificationRequest = (payload: CertificationRequestInput) =>
  requestJson<CertificationRequest>('/api/learning/certification-requests/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const listCertificationAssignmentTargets = (search = '') => {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  const query = params.toString();
  return requestJson<CertificationAssignmentTarget[]>(
    `/api/learning/certification-assignment-targets${query ? `?${query}` : ''}`,
  );
};

export const createCertificationAssignments = (payload: CertificationAssignmentInput) =>
  requestJson<{ items: CertificationRequest[]; total: number }>('/api/learning/certification-assignments/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const decideCertificationRequest = (
  requestId: number,
  approved: boolean,
  comments?: string,
  approvedAmount?: number,
) => requestJson<CertificationRequest>(`/api/learning/certification-requests/${requestId}/decision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ approved, comments: comments || null, approved_amount: approvedAmount ?? null }),
});

export const updateCertificationRequestStatus = (requestId: number, status: string) =>
  requestJson<CertificationRequest>(`/api/learning/certification-requests/${requestId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

export const resumeCertificationRequest = (requestId: number) =>
  requestJson<CertificationRequest>(`/api/learning/certification-requests/${requestId}/resume`, { method: 'POST' });

export const submitCertificationResult = (
  requestId: number,
  outcome: 'obtained' | 'failed' | 'postponed',
  obtainedDate?: string,
  credentialId?: string,
  credentialUrl?: string,
  postponedUntil?: string,
  comments?: string,
) => requestJson<CertificationRequest>(`/api/learning/certification-requests/${requestId}/submit-result`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    outcome,
    obtained_date: obtainedDate || null,
    postponed_until: postponedUntil || null,
    comments: comments || null,
    credential_id: credentialId || null,
    credential_url: credentialUrl || null,
  }),
});

export async function listEmployeeCertificationsAdmin(page = 1, search = '') {
  const params = new URLSearchParams({ page: String(page), page_size: '20' });
  if (search.trim()) params.set('search', search.trim());
  return requestJson<{ items: EmployeeCertificationAdminItem[]; total: number; page: number; page_size: number }>(
    `/api/learning/employee-certifications/admin?${params}`,
  );
}

export const addEmployeeCertification = (payload: EmployeeCertificationImportInput) =>
  requestJson<{ id: number; message: string }>('/api/learning/employee-certifications/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const verifyCertificationResult = (requestId: number, approved: boolean, comments?: string) =>
  requestJson<CertificationRequest>(`/api/learning/certification-requests/${requestId}/verify-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved, comments: comments || null }),
  });

export const linkCertificationRequest = (requestId: number, certificationTypeId: number) =>
  requestJson<CertificationRequest>(`/api/learning/certification-requests/${requestId}/link-certification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ certification_type_id: certificationTypeId }),
  });

export const confirmCertificationPayment = (requestId: number, paidAmount: number, paymentReference: string) =>
  requestJson<CertificationRequest>(`/api/learning/certification-requests/${requestId}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paid_amount: paidAmount, payment_reference: paymentReference }),
  });

async function uploadDocument(path: string, file: File): Promise<{ filename: string }> {
  const body = new FormData();
  body.append('file', file);
  return requestJson<{ filename: string }>(path, { method: 'POST', body });
}

export const uploadCertificationQuote = (requestId: number, file: File) =>
  uploadDocument(`/api/learning/certification-requests/${requestId}/quote`, file);

export const uploadCertificationResultDocument = (requestId: number, file: File) =>
  uploadDocument(`/api/learning/certification-requests/${requestId}/result-document`, file);

export const uploadEmployeeCertificationDocument = (certificationId: number, file: File) =>
  uploadDocument(`/api/learning/employee-certifications/${certificationId}/document`, file);

export const getCertificationSettings = () =>
  requestJson<{ validation_workflow: CertificationWorkflowStep[] }>('/api/learning/certification-settings');

export const updateCertificationSettings = (validationWorkflow: CertificationWorkflowStep[]) =>
  requestJson<{ validation_workflow: CertificationWorkflowStep[] }>('/api/learning/certification-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validation_workflow: validationWorkflow }),
  });
