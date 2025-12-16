// ============================================
// À AJOUTER À LA FIN DE lib/api.ts
// ============================================

// Types pour les congés
export interface LeaveType {
  id: number;
  tenant_id: number;
  name: string;
  code: string;
  default_days: number;
  is_paid: boolean;
  requires_approval: boolean;
  color: string;
  is_active: boolean;
}

export interface LeaveRequest {
  id: number;
  tenant_id: number;
  employee_id: number;
  employee_name?: string;
  leave_type_id: number;
  leave_type_name?: string;
  leave_type_code?: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  start_half_day?: boolean;
  end_half_day?: boolean;
  reason?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by_id?: number;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
  // Infos enrichies
  department?: string;
  job_title?: string;
  manager_name?: string;
  leave_balance?: number;
}

export interface LeaveRequestsResponse {
  items: LeaveRequest[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface LeaveStats {
  pending_requests: number;
  on_leave_today: number;
  total_requests: number;
  approved_requests: number;
  total_days_taken: number;
  by_type: Record<string, number>;
}

// Fonctions API Congés

// Types de congés
export async function getLeaveTypes(activeOnly: boolean = true): Promise<LeaveType[]> {
  const response = await fetch(`${API_URL}/api/leaves/types?active_only=${activeOnly}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch leave types');
  }

  return response.json();
}

// Demandes de congés
export async function getLeaveRequests(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  employee_id?: number;
  department_id?: number;
  start_date?: string;
  end_date?: string;
}): Promise<LeaveRequestsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.employee_id) queryParams.set('employee_id', params.employee_id.toString());
  if (params?.department_id) queryParams.set('department_id', params.department_id.toString());
  if (params?.start_date) queryParams.set('start_date', params.start_date);
  if (params?.end_date) queryParams.set('end_date', params.end_date);

  const response = await fetch(`${API_URL}/api/leaves/requests?${queryParams}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch leave requests');
  }

  return response.json();
}

// Demandes en attente
export async function getPendingLeaveRequests(): Promise<LeaveRequest[]> {
  const response = await fetch(`${API_URL}/api/leaves/requests/pending`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch pending requests');
  }

  return response.json();
}

// Approuver une demande
export async function approveLeaveRequest(id: number): Promise<LeaveRequest> {
  const response = await fetch(`${API_URL}/api/leaves/requests/${id}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approved: true }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to approve request');
  }

  return response.json();
}

// Refuser une demande
export async function rejectLeaveRequest(id: number, reason: string): Promise<LeaveRequest> {
  const response = await fetch(`${API_URL}/api/leaves/requests/${id}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approved: false, rejection_reason: reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to reject request');
  }

  return response.json();
}

// Stats congés
export async function getLeaveStats(year?: number): Promise<LeaveStats> {
  const queryParams = year ? `?year=${year}` : '';
  const response = await fetch(`${API_URL}/api/leaves/stats${queryParams}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch leave stats');
  }

  return response.json();
}
