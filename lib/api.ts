// Configuration API
const API_URL = 'https://web-production-06c3.up.railway.app';

// Helper pour obtenir le token
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

// Helper pour les headers authentifiés
function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// Helper pour parser les erreurs API
async function parseApiError(response: Response): Promise<string> {
  try {
    const error = await response.json();
    console.log('API Error response:', error);
    
    if (typeof error === 'string') {
      return error;
    }
    if (error.detail) {
      if (Array.isArray(error.detail)) {
        return error.detail.map((e: { msg?: string; message?: string; loc?: string[] }) => {
          const field = e.loc ? e.loc[e.loc.length - 1] : '';
          const msg = e.msg || e.message || 'Erreur de validation';
          return field ? `${field}: ${msg}` : msg;
        }).join(', ');
      }
      if (typeof error.detail === 'string') {
        return error.detail;
      }
      return JSON.stringify(error.detail);
    }
    if (error.message) {
      return error.message;
    }
    return `Erreur ${response.status}: ${response.statusText}`;
  } catch {
    return `Erreur ${response.status}: ${response.statusText}`;
  }
}

// Types - Valeurs acceptées par l'API (en minuscule)
export type GenderType = 'male' | 'female' | 'other';
export type ContractType = 'cdi' | 'cdd' | 'stage' | 'alternance' | 'consultant' | 'interim';
export type StatusType = 'active' | 'on_leave' | 'suspended' | 'terminated' | 'probation';

export interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  position?: string;
  job_title?: string;
  department_id?: number;
  department_name?: string;
  manager_id?: number;
  manager_name?: string;
  hire_date?: string;
  birth_date?: string;
  date_of_birth?: string;
  gender?: string;
  status: string;
  contract_type?: string;
  salary?: number;
  currency?: string;
  location?: string;
  site?: string;
  is_manager?: boolean;
  role?: EmployeeRole; 
  nationality?: string;
  address?: string;
  created_at: string;
  updated_at?: string;
}

export interface EmployeeCreate {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title?: string;
  department_id?: number;
  manager_id?: number;
  is_manager?: boolean;
  role?: EmployeeRole; 
  hire_date?: string;
  date_of_birth?: string;
  gender?: GenderType;
  status?: StatusType;
  contract_type?: ContractType;
  site?: string;
  salary?: number;
  currency?: string;
  nationality?: string;
  address?: string;
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  on_leave: number;
  by_department: Record<string, number>;
  by_gender: Record<string, number>;
  by_contract_type: Record<string, number>;
  new_this_month?: number;
  managers?: number;
  female?: number;
  male?: number;
}

export interface Department {
  id: number;
  name: string;
  code?: string;
  description?: string;
  color?: string;
  parent_id?: number;
  head_id?: number;
  employee_count?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface DepartmentCreate {
  name: string;
  code?: string;
  description?: string;
  color?: string;
  parent_id?: number;
  head_id?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// API Functions

// Employees
export async function getEmployees(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  department_id?: number;
  status?: string;
}): Promise<PaginatedResponse<Employee>> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.search) queryParams.set('search', params.search);
  if (params?.department_id) queryParams.set('department_id', params.department_id.toString());
  if (params?.status) queryParams.set('status', params.status);

  const response = await fetch(`${API_URL}/api/employees/?${queryParams}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function getEmployee(id: number): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function createEmployee(data: EmployeeCreate): Promise<Employee> {
  // Nettoyer les données - ne pas envoyer les champs vides
  const cleanData: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanData[key] = value;
    }
  });

  console.log('Creating employee with cleaned data:', cleanData);

  const response = await fetch(`${API_URL}/api/employees/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(cleanData),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function updateEmployee(id: number, data: Partial<EmployeeCreate>): Promise<Employee> {
  const cleanData: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanData[key] = value;
    }
  });

  console.log('Updating employee with cleaned data:', cleanData);

  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(cleanData),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function deleteEmployee(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }
}

export async function getEmployeeStats(): Promise<EmployeeStats> {
  const response = await fetch(`${API_URL}/api/employees/stats`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

// Departments
export async function getDepartments(): Promise<Department[]> {
  console.log('Fetching departments from:', `${API_URL}/api/departments/`);
  
  const response = await fetch(`${API_URL}/api/departments/`, {
    headers: getAuthHeaders(),
  });

  console.log('Departments response status:', response.status);

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    console.error('Error fetching departments:', errorMsg);
    throw new Error(errorMsg);
  }

  const data = await response.json();
  console.log('Departments raw response:', data);
  
  // Gérer différents formats de réponse
  if (Array.isArray(data)) {
    console.log('Departments is array:', data.length, 'items');
    return data;
  }
  if (data.items && Array.isArray(data.items)) {
    console.log('Departments from items:', data.items.length, 'items');
    return data.items;
  }
  if (data.data && Array.isArray(data.data)) {
    console.log('Departments from data:', data.data.length, 'items');
    return data.data;
  }
  
  console.log('Departments: unknown format, returning empty array');
  return [];
}

export async function getDepartment(id: number): Promise<Department> {
  const response = await fetch(`${API_URL}/api/departments/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function createDepartment(data: DepartmentCreate): Promise<Department> {
  console.log('Creating department with data:', data);
  
  const response = await fetch(`${API_URL}/api/departments/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  console.log('Create department response status:', response.status);

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    console.error('Error creating department:', errorMsg);
    throw new Error(errorMsg);
  }

  const result = await response.json();
  console.log('Created department:', result);
  return result;
}

export async function updateDepartment(id: number, data: Partial<DepartmentCreate>): Promise<Department> {
  const response = await fetch(`${API_URL}/api/departments/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function deleteDepartment(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/departments/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }
}

// Export employees to CSV
export function exportEmployeesToCSV(employees: Employee[]): void {
  const headers = [
    'Matricule', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Poste',
    'Département', 'Site', 'Date embauche', 'Statut', 'Type contrat', 'Genre'
  ];

  const rows = employees.map(emp => [
    emp.employee_id,
    emp.first_name,
    emp.last_name,
    emp.email,
    emp.phone || '',
    emp.position || emp.job_title || '',
    emp.department_name || '',
    emp.location || emp.site || '',
    emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('fr-FR') : '',
    emp.status,
    emp.contract_type || '',
    emp.gender || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');


  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `employees_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

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


// Types pour les rôles
export type EmployeeRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg';

export interface AccessStatus {
  has_access: boolean;
  user_id: number | null;
  is_active: boolean;
  is_verified: boolean;
  last_login: string | null;
  role: string | null;
}

export interface ActivateAccessResponse {
  message: string;
  user_id: number;
  email: string;
  temp_password: string;
  role: string;
}

// Vérifier si un employé a un compte d'accès
export async function getEmployeeAccessStatus(employeeId: number): Promise<AccessStatus> {
  const response = await fetch(`${API_URL}/api/employees/${employeeId}/access-status`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch access status');
  }

  return response.json();
}

// Activer l'accès pour un employé (créer son compte)
export async function activateEmployeeAccess(
  employeeId: number, 
  sendEmail: boolean = true
): Promise<ActivateAccessResponse> {
  const response = await fetch(
    `${API_URL}/api/employees/${employeeId}/activate-access?send_email=${sendEmail}`, 
    {
      method: 'POST',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to activate access');
  }

  return response.json();
}

// Désactiver l'accès d'un employé
export async function deactivateEmployeeAccess(employeeId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/employees/${employeeId}/deactivate-access`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to deactivate access');
  }
}

// Labels pour les rôles (affichage)
export const ROLE_LABELS: Record<EmployeeRole, string> = {
  employee: 'Employé',
  manager: 'Manager',
  rh: 'RH',
  admin: 'Administrateur',
  dg: 'Direction Générale',
};
