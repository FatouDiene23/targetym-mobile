// Configuration API
export const API_URL = 'https://api.targetym.ai';

// Helper pour obtenir le token
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

// Helper pour obtenir le refresh token
function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

// Helper pour les headers authentifiés
function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// Rafraîchir le token d'accès
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  // Éviter les appels multiples simultanés
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        console.log('No refresh token available');
        return false;
      }

      const response = await fetchWithAuth(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        console.log('Refresh token failed:', response.status);
        // Token refresh échoué, rediriger vers login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = 'https://targetym-website.vercel.app/login';
        return false;
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Wrapper pour fetch avec gestion automatique du refresh token
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  // Si 401, essayer de rafraîchir le token et réessayer
  // MAIS : ne jamais refresher pendant une impersonation (le refresh_token est celui du super admin,
  // pas de l'utilisateur impersonné — cela remplacerait silencieusement le token d'impersonation)
  const isImpersonating = typeof window !== 'undefined' && localStorage.getItem('is_impersonating') === 'true';
  if (response.status === 401 && !isImpersonating) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Réessayer la requête avec le nouveau token
      response = await fetch(url, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...options.headers,
        },
      });
    }
  }

  return response;
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

// Types pour les rôles
export type EmployeeRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg';

// Types pour les niveaux hiérarchiques organisationnels
export type OrganizationalLevel = 'president' | 'vice_president' | 'dg' | 'dga' | 'direction_centrale' | 'direction' | 'departement' | 'service';
// Types pour les tâches
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskSource = 'manual' | 'asana' | 'jira' | 'notion' | 'trello' | 'monday' | 'other';
export type DailyValidationStatusType = 'pending' | 'approved' | 'rejected';

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
  net_salary?: number;
  salaire_brut?: number;
  part_variable?: number;
  currency?: string;
  classification?: string;
  coefficient?: string;
  location?: string;
  site?: string;
  is_manager?: boolean;
  role?: EmployeeRole;
  nationality?: string;
  address?: string;
  photo_url?: string;
  signature_url?: string;
  created_at: string;
  updated_at?: string;
  probation_end_date?: string;
  contract_end_date?: string;
  // Famille
  marital_status?: string;
  spouse_name?: string;
  spouse_birth_date?: string;
  // Adresse pro
  work_email?: string;
  work_phone?: string;
  // Médical
  has_disability?: boolean;
  disability_description?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  // Organisation
  comex_member?: string;
  hrbp?: string;
  salary_category?: string;
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
  salary?: number | null;
  net_salary?: number | null;
  salaire_brut?: number | null;
  part_variable?: number | null;
  currency?: string;
  classification?: string | null;
  coefficient?: string | null;
  nationality?: string;
  address?: string;
  photo_url?: string;
  probation_end_date?: string;
  contract_end_date?: string;
  // Famille
  marital_status?: string;
  spouse_name?: string;
  spouse_birth_date?: string;
  // Adresse pro
  work_email?: string;
  work_phone?: string;
  // Médical
  has_disability?: boolean;
  disability_description?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  // Organisation
  comex_member?: string;
  hrbp?: string;
  salary_category?: string;
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
  level?: OrganizationalLevel;
  parent_id?: number;
  head_id?: number;
  employee_count?: number;
  is_active?: boolean;
  created_at?: string;
  has_open_manager_position?: boolean;
}

export interface DepartmentWithChildren extends Department {
  children: DepartmentWithChildren[];
  employee_count?: number;
}

export interface DepartmentCreate {
  name: string;
  code?: string;
  description?: string;
  color?: string;
  level?: OrganizationalLevel;
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

// ============================================
// TASK TYPES
// ============================================

export interface Task {
  id: number;
  tenant_id: number;
  title: string;
  description?: string;
  assigned_to_id: number;
  assigned_to_name?: string;
  created_by_id: number;
  created_by_name?: string;
  due_date: string;
  completed_at?: string;
  status: TaskStatus;
  priority: TaskPriority;
  completion_note?: string;
  incomplete_reason?: string;
  is_overdue: boolean;
  // Source externe
  source?: TaskSource;
  external_id?: string;
  external_url?: string;
  // Lien OKR
  objective_id?: number;
  objective_title?: string;
  key_result_id?: number;
  key_result_title?: string;
  // Tâche administrative
  is_administrative?: boolean;
  // Timestamps
  created_at: string;
  updated_at?: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  assigned_to_id: number;
  due_date: string;
  priority?: TaskPriority;
  // Lien OKR (obligatoire sauf si is_administrative=true)
  objective_id?: number;
  key_result_id?: number;
  // Tâche administrative (pas de lien OKR requis)
  is_administrative?: boolean;
}

export interface TasksPageResponse {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  due_today: number;
}

export interface DailyValidation {
  id: number;
  tenant_id: number;
  employee_id: number;
  employee_name?: string;
  validation_date: string;
  status: DailyValidationStatusType;
  submitted_at?: string;
  submission_note?: string;
  validated_by_id?: number;
  validated_by_name?: string;
  validated_at?: string;
  validation_comment?: string;
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  created_at: string;
}

export interface DailyValidationStatus {
  validation: DailyValidation | null;
  can_submit: boolean;
  tasks_total: number;
  tasks_completed: number;
  all_completed: boolean;
}

export interface PendingValidation {
  validation: DailyValidation;
  tasks: Task[];
}

export type TeamMember = {
  id: number;
  name: string;
  job_title?: string;
  email?: string;
};

// ============================================
// OKR TYPES (pour lier aux tâches)
// ============================================

export interface KeyResultForLinking {
  id: number;
  title: string;
  current: number;
  target: number;
  unit?: string;
}

export interface ObjectiveForLinking {
  id: number;
  title: string;
  level: 'enterprise' | 'department' | 'team' | 'individual';
  progress: number;
  key_results: KeyResultForLinking[];
}

// ============================================
// EMPLOYEES API
// ============================================

export async function getEmployees(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  department_id?: number;
  status?: string;
  subsidiary_tenant_id?: number;
}): Promise<PaginatedResponse<Employee>> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.search) queryParams.set('search', params.search);
  if (params?.department_id) queryParams.set('department_id', params.department_id.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.subsidiary_tenant_id) queryParams.set('subsidiary_tenant_id', params.subsidiary_tenant_id.toString());

  const response = await fetchWithAuth(`${API_URL}/api/employees/?${queryParams}`, {
    
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function getEmployee(id: number): Promise<Employee> {
  const response = await fetchWithAuth(`${API_URL}/api/employees/${id}`, {
    
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function createEmployee(data: EmployeeCreate): Promise<Employee> {
  const cleanData: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanData[key] = value;
    }
  });

  console.log('Creating employee with cleaned data:', cleanData);

  const response = await fetchWithAuth(`${API_URL}/api/employees/`, {
    method: 'POST',
    
    body: JSON.stringify(cleanData),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function updateEmployee(id: number, data: Partial<EmployeeCreate>): Promise<Employee> {
  // FIX: On garde les valeurs null (pour permettre d'effacer un champ comme salary)
  // On ne filtre que undefined et les chaînes vides
  const cleanData: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  });

  console.log('Updating employee with cleaned data:', cleanData);

  const response = await fetchWithAuth(`${API_URL}/api/employees/${id}`, {
    method: 'PUT',
    
    body: JSON.stringify(cleanData),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function deleteEmployee(id: number): Promise<void> {
  const response = await fetchWithAuth(`${API_URL}/api/employees/${id}`, {
    method: 'DELETE',
    
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }
}

export async function uploadEmployeePhoto(id: number, file: File): Promise<{ photo_url: string }> {
  const token = localStorage.getItem('access_token');
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/employees/${id}/photo`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function getEmployeeStats(params?: { subsidiary_tenant_id?: number }): Promise<EmployeeStats> {
  const queryParams = new URLSearchParams();
  if (params?.subsidiary_tenant_id) queryParams.set('subsidiary_tenant_id', params.subsidiary_tenant_id.toString());
  const url = queryParams.toString()
    ? `${API_URL}/api/employees/stats?${queryParams.toString()}`
    : `${API_URL}/api/employees/stats`;

  const response = await fetchWithAuth(url, {
    
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

// ============================================
// DEPARTMENTS API
// ============================================

export async function getDepartments(level?: OrganizationalLevel, subsidiaryTenantId?: number): Promise<Department[]> {
  console.log('Fetching departments from:', `${API_URL}/api/departments/`);
  
  const queryParams = new URLSearchParams();
  if (level) queryParams.set('level', level);
  if (subsidiaryTenantId) queryParams.set('subsidiary_tenant_id', subsidiaryTenantId.toString());
  
  const url = queryParams.toString()
    ? `${API_URL}/api/departments/?${queryParams.toString()}`
    : `${API_URL}/api/departments/`;
  
  const response = await fetchWithAuth(url, {
    
  });

  console.log('Departments response status:', response.status);

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    console.error('Error fetching departments:', errorMsg);
    throw new Error(errorMsg);
  }

  const data = await response.json();
  console.log('Departments raw response:', data);
  
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

export async function getDepartmentsTree(): Promise<DepartmentWithChildren[]> {
  const response = await fetchWithAuth(`${API_URL}/api/departments/tree`, {

  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function getOrganizationalLevels(): Promise<{
  value: string;
  label: string;
  order: number;
  allowed_parents: string[];
}[]> {
  const response = await fetchWithAuth(`${API_URL}/api/departments/levels`, {
    
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function getDepartment(id: number): Promise<Department> {
  const response = await fetchWithAuth(`${API_URL}/api/departments/${id}`, {
    
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function createDepartment(data: DepartmentCreate): Promise<Department> {
  console.log('Creating department with data:', data);
  
  const response = await fetchWithAuth(`${API_URL}/api/departments/`, {
    method: 'POST',
    
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
  const response = await fetchWithAuth(`${API_URL}/api/departments/${id}`, {
    method: 'PUT',
    
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function deleteDepartment(id: number): Promise<void> {
  const response = await fetchWithAuth(`${API_URL}/api/departments/${id}`, {
    method: 'DELETE',
    
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }
}

// ============================================
// EXPORT CSV
// ============================================

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
// IMPORT EMPLOYEES
// ============================================

export interface ImportEmployeesResult {
  total: number;
  created: number;
  skipped: number;
  errors: { row: number; email: string; error: string }[];
}

export async function importEmployeesFromFile(file: File): Promise<ImportEmployeesResult> {
  const token = localStorage.getItem('access_token');
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/employees/import`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await parseApiError(response);
    throw new Error(err);
  }

  return response.json();
}

export function downloadEmployeeImportTemplate(): void {
  const headers = [
    'matricule', 'prenom', 'nom', 'email', 'telephone', 'genre',
    'date_naissance', 'nationalite', 'adresse', 'poste', 'departement',
    'est_manager', 'role', 'site', 'type_contrat', 'date_embauche',
    'salaire_brut', 'salaire_net', 'devise', 'statut'
  ];
  const example = [
    'EMP-001', 'Marie', 'Koné', 'marie.kone@entreprise.com', '+225 07 00 00 00', 'female',
    '1990-05-20', 'Ivoirienne', 'Abidjan, Plateau', 'Responsable RH', 'Ressources Humaines',
    'non', 'rh', 'Abidjan', 'CDI', '2023-01-15',
    '500000', '400000', 'XOF', 'active'
  ];
  const csvContent = [headers.join(','), example.map(v => `"${v}"`).join(',')].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'template_import_collaborateurs.csv';
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================
// LEAVE MANAGEMENT (Congés)
// ============================================

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

export async function getLeaveTypes(activeOnly: boolean = true): Promise<LeaveType[]> {
  const response = await fetchWithAuth(`${API_URL}/api/leaves/types?active_only=${activeOnly}`, {
    
  });

  if (!response.ok) {
    throw new Error('Failed to fetch leave types');
  }

  return response.json();
}

export async function getLeaveRequests(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  employee_id?: number;
  department_id?: number;
  start_date?: string;
  end_date?: string;
  subsidiary_tenant_id?: number;
}): Promise<LeaveRequestsResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.employee_id) queryParams.set('employee_id', params.employee_id.toString());
  if (params?.department_id) queryParams.set('department_id', params.department_id.toString());
  if (params?.start_date) queryParams.set('start_date', params.start_date);
  if (params?.end_date) queryParams.set('end_date', params.end_date);
  if (params?.subsidiary_tenant_id) queryParams.set('subsidiary_tenant_id', params.subsidiary_tenant_id.toString());

  const response = await fetchWithAuth(`${API_URL}/api/leaves/requests?${queryParams}`, {
    
  });

  if (!response.ok) {
    throw new Error('Failed to fetch leave requests');
  }

  return response.json();
}

export async function getPendingLeaveRequests(): Promise<LeaveRequest[]> {
  const response = await fetchWithAuth(`${API_URL}/api/leaves/requests/pending`, {
    
  });

  if (!response.ok) {
    throw new Error('Failed to fetch pending requests');
  }

  return response.json();
}

export async function approveLeaveRequest(id: number): Promise<LeaveRequest> {
  const response = await fetchWithAuth(`${API_URL}/api/leaves/requests/${id}/approve`, {
    method: 'POST',
    
    body: JSON.stringify({ approved: true }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to approve request');
  }

  return response.json();
}

export async function rejectLeaveRequest(id: number, reason: string): Promise<LeaveRequest> {
  const response = await fetchWithAuth(`${API_URL}/api/leaves/requests/${id}/approve`, {
    method: 'POST',
    
    body: JSON.stringify({ approved: false, rejection_reason: reason }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to reject request');
  }

  return response.json();
}

export async function getLeaveStats(year?: number): Promise<LeaveStats> {
  const queryParams = year ? `?year=${year}` : '';
  const response = await fetchWithAuth(`${API_URL}/api/leaves/stats${queryParams}`, {
    
  });

  if (!response.ok) {
    throw new Error('Failed to fetch leave stats');
  }

  return response.json();
}

// ============================================
// EMPLOYEE ACCESS (Gestion des accès)
// ============================================

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

export async function getEmployeeAccessStatus(employeeId: number): Promise<AccessStatus> {
  const response = await fetchWithAuth(`${API_URL}/api/employees/${employeeId}/access-status`, {
    
  });

  if (!response.ok) {
    throw new Error('Failed to fetch access status');
  }

  return response.json();
}

export async function activateEmployeeAccess(
  employeeId: number, 
  sendEmail: boolean = true
): Promise<ActivateAccessResponse> {
  const response = await fetchWithAuth(
    `${API_URL}/api/employees/${employeeId}/activate-access?send_email=${sendEmail}`, 
    {
      method: 'POST',
      
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to activate access');
  }

  return response.json();
}

export async function deactivateEmployeeAccess(employeeId: number): Promise<void> {
  const response = await fetchWithAuth(`${API_URL}/api/employees/${employeeId}/deactivate-access`, {
    method: 'DELETE',
    
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to deactivate access');
  }
}

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  employee: 'Employé',
  manager: 'Manager',
  rh: 'RH',
  admin: 'Administrateur',
  dg: 'Direction Générale',
};

// ============================================
// TASKS API
// ============================================

export async function getMyTasks(params?: {
  page?: number;
  page_size?: number;
  status?: TaskStatus;
  due_date?: string;
}): Promise<TasksPageResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.due_date) queryParams.set('due_date', params.due_date);

  const response = await fetchWithAuth(`${API_URL}/api/tasks/my-tasks?${queryParams}`, {
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getMyTasksToday(): Promise<Task[]> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/my-tasks/today`, {
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getMyTaskStats(): Promise<TaskStats> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/my-stats`, {
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getTeamTasks(params?: {
  page?: number;
  page_size?: number;
  employee_id?: number;
  status?: TaskStatus;
}): Promise<TasksPageResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.employee_id) queryParams.set('employee_id', params.employee_id.toString());
  if (params?.status) queryParams.set('status', params.status);

  const response = await fetchWithAuth(`${API_URL}/api/tasks/team-tasks?${queryParams}`, {
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/team-members`, {
    
  });

  if (!response.ok) {
    // Retourner un tableau vide si l'utilisateur n'a pas d'équipe
    return [];
  }

  return response.json();
}

export async function getObjectivesForLinking(employeeId?: number): Promise<ObjectiveForLinking[]> {
  const queryParams = new URLSearchParams();
  if (employeeId) queryParams.set('employee_id', employeeId.toString());
  
  const url = employeeId 
    ? `${API_URL}/api/tasks/objectives-for-linking?${queryParams}`
    : `${API_URL}/api/tasks/objectives-for-linking`;

  const response = await fetchWithAuth(url, {
    
  });

  if (!response.ok) {
    console.warn('Could not fetch objectives for linking');
    return [];
  }

  return response.json();
}

export async function createTask(data: TaskCreate): Promise<Task> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks`, {
    method: 'POST',
    
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function updateTask(id: number, data: Partial<TaskCreate>): Promise<Task> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/${id}`, {
    method: 'PUT',
    
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function startTask(id: number): Promise<Task> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/${id}/start`, {
    method: 'POST',
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function completeTask(id: number, note?: string): Promise<Task> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/${id}/complete`, {
    method: 'POST',
    
    body: JSON.stringify({ completion_note: note }),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function deleteTask(id: number): Promise<void> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/${id}`, {
    method: 'DELETE',
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
}

// ============================================
// DAILY VALIDATION API
// ============================================

export async function getMyDailyValidationStatus(): Promise<DailyValidationStatus> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/daily-validation/my-status`, {
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function submitDailyValidation(data: {
  submission_note?: string;
  incomplete_tasks?: { task_id: number; reason: string }[];
}): Promise<DailyValidation> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/daily-validation/submit`, {
    method: 'POST',
    
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getPendingValidations(): Promise<PendingValidation[]> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/daily-validation/pending`, {
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function validateDaily(
  validationId: number,
  approved: boolean,
  comment?: string
): Promise<DailyValidation> {
  const response = await fetchWithAuth(`${API_URL}/api/tasks/daily-validation/${validationId}/validate`, {
    method: 'POST',
    
    body: JSON.stringify({ approved, comment }),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getValidationHistory(params?: {
  page?: number;
  page_size?: number;
  employee_id?: number;
  status?: string;
}): Promise<{
  items: DailyValidation[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.page_size) queryParams.set('page_size', params.page_size.toString());
  if (params?.employee_id) queryParams.set('employee_id', params.employee_id.toString());
  if (params?.status) queryParams.set('status', params.status);

  const response = await fetchWithAuth(`${API_URL}/api/tasks/daily-validation/history?${queryParams}`, {
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

// ============================================
// DAILY CHECKLIST
// ============================================

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface ChecklistItem {
  id: number;
  tenant_id: number;
  employee_id: number;
  employee_name?: string;
  created_by_id: number;
  created_by_name?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  days_of_week: DayOfWeek[];
  objective_id?: number;
  objective_title?: string;
  key_result_id?: number;
  key_result_title?: string;
  kr_contribution?: number;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ChecklistTodayItem {
  item_id: number;
  task_id?: number;
  title: string;
  description?: string;
  priority: TaskPriority;
  objective_id?: number;
  key_result_id?: number;
  kr_contribution?: number;
  status: TaskStatus;
  completed_at?: string;
}

export interface DailyChecklistToday {
  date: string;
  day_name: DayOfWeek;
  items: ChecklistTodayItem[];
  total: number;
  completed: number;
  completion_rate: number;
}

export interface ChecklistItemCreate {
  title: string;
  description?: string;
  priority?: TaskPriority;
  days_of_week?: DayOfWeek[];
  objective_id?: number;
  key_result_id?: number;
  kr_contribution?: number;
  order?: number;
}

export interface ChecklistTeamMember {
  id: number;
  name: string;
  job_title?: string;
  checklist_items_count: number;
}

export async function getTodayChecklist(): Promise<DailyChecklistToday> {
  const response = await fetchWithAuth(`${API_URL}/api/daily-checklist/today`, {
    
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function getEmployeeChecklist(employeeId: number): Promise<ChecklistItem[]> {
  const response = await fetchWithAuth(`${API_URL}/api/daily-checklist/team/${employeeId}`, {
    
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function getTeamChecklistMembers(): Promise<ChecklistTeamMember[]> {
  const response = await fetchWithAuth(`${API_URL}/api/daily-checklist/team`, {
    
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function createChecklistItem(
  employeeId: number,
  data: ChecklistItemCreate
): Promise<ChecklistItem> {
  const response = await fetchWithAuth(`${API_URL}/api/daily-checklist/team/${employeeId}/items`, {
    method: 'POST',
    
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function updateChecklistItem(
  itemId: number,
  data: Partial<ChecklistItemCreate> & { is_active?: boolean }
): Promise<ChecklistItem> {
  const response = await fetchWithAuth(`${API_URL}/api/daily-checklist/items/${itemId}`, {
    method: 'PUT',
    
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function deleteChecklistItem(itemId: number): Promise<void> {
  const response = await fetchWithAuth(`${API_URL}/api/daily-checklist/items/${itemId}`, {
    method: 'DELETE',
    
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}

// ============================================
// APP TOUR (Guide Applicatif)
// ============================================

export interface AppTourStatus {
  has_completed: boolean;
  completed_at: string | null;
  user_role: string;
}

/**
 * Récupère le statut du tour applicatif pour l'utilisateur connecté
 */
export async function getAppTourStatus(): Promise<AppTourStatus> {
  const response = await fetchWithAuth(`${API_URL}/api/app-tour/status`, {
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Marque le tour applicatif comme complété
 */
export async function completeAppTour(): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/app-tour/complete`, {
    method: 'POST',
    
    body: JSON.stringify({ force_reset: false }),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Réinitialise le tour applicatif pour le revoir
 */
export async function resetAppTour(): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/app-tour/reset`, {
    method: 'POST',
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

// ============================================
// AI CHATBOT
// ============================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  created_at: string;
  tokens_used?: number;
}

export interface ChatConversation {
  id: number;
  employee_id: number;
  title: string | null;
  is_active: number;
  created_at: string;
  updated_at?: string;
  message_count?: number;
}

export interface ChatConversationWithMessages extends ChatConversation {
  messages: ChatMessage[];
}

export interface SendMessageRequest {
  content: string;
  conversation_id?: number;
}

export interface HumanEscalation {
  needs_human: boolean;
  reason: string;
  contact_email: string;
  contact_whatsapp: string;
  message: string;
}

export interface ChatbotStatus {
  enabled: boolean;
  model: string | null;
  message: string;
}

/**
 * Récupère toutes les conversations de l'utilisateur
 */
export async function getChatConversations(): Promise<ChatConversation[]> {
  const response = await fetchWithAuth(`${API_URL}/api/ai-chat/conversations`, {
    method: 'GET',
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Récupère une conversation avec tous ses messages
 */
export async function getChatConversation(conversationId: number): Promise<ChatConversationWithMessages> {
  const response = await fetchWithAuth(`${API_URL}/api/ai-chat/conversations/${conversationId}`, {
    method: 'GET',
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Crée une nouvelle conversation
 */
export async function createChatConversation(title?: string, initialMessage?: string): Promise<ChatConversation> {
  const response = await fetchWithAuth(`${API_URL}/api/ai-chat/conversations`, {
    method: 'POST',
    
    body: JSON.stringify({ title, initial_message: initialMessage }),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Archive une conversation
 */
export async function deleteChatConversation(conversationId: number): Promise<{ message: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/ai-chat/conversations/${conversationId}`, {
    method: 'DELETE',
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Envoie un message au chatbot et obtient une réponse
 */
export async function sendChatMessage(data: SendMessageRequest): Promise<ChatMessage> {
  const response = await fetchWithAuth(`${API_URL}/api/ai-chat/message`, {
    method: 'POST',
    
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Vérifie le statut du chatbot (activé/configuré)
 */
export async function getChatbotStatus(): Promise<ChatbotStatus> {
  const response = await fetchWithAuth(`${API_URL}/api/ai-chat/status`, {
    method: 'GET',
    
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}
// ============================================
// PLATFORM ADMIN (SUPER_ADMIN ONLY)
// ============================================

export interface PlatformStats {
  total_tenants: number;
  active_tenants: number;
  trial_tenants: number;
  total_users: number;
  active_users: number;
  total_employees: number;
  total_messages_today: number;
  total_leave_requests_pending: number;
  new_tenants_this_month: number;
  new_users_this_month: number;
}

export interface TenantListItem {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  plan: string;
  is_trial: boolean;
  is_active: boolean;
  trial_starts_at?: string;
  trial_ends_at?: string;
  activation_note?: string;
  block_reason?: string;
  max_employees: number;
  created_at: string;
  // Statut calculé côté backend
  computed_status?: 'pending' | 'trial_active' | 'trial_expired' | 'subscribed' | 'blocked';
  trial_days_remaining?: number;
  users_count: number;
  employees_count: number;
  // Groupe / Filiales
  group_type?: 'standalone' | 'group' | 'subsidiary';
  is_group?: boolean;
  parent_tenant_id?: number;
}

export interface UserListItem {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  tenant_id?: number;
  tenant_name?: string;
  employee_id?: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login?: string;
}

export interface UserCreateData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  tenant_id?: number;
  employee_id?: number;
  is_active?: boolean;
}

export interface UserUpdateData {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  tenant_id?: number;
  employee_id?: number;
  is_active?: boolean;
  is_verified?: boolean;
}

/**
 * Récupère les statistiques globales de la plateforme
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/stats`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Récupère la liste de tous les tenants
 */
export async function getAllTenants(params?: {
  skip?: number;
  limit?: number;
  search?: string;
  plan?: string;
  is_active?: boolean;
  status?: 'pending' | 'active' | 'expired' | 'subscribed' | 'all';
}): Promise<TenantListItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.skip !== undefined) searchParams.append('skip', params.skip.toString());
  if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
  if (params?.search) searchParams.append('search', params.search);
  if (params?.plan) searchParams.append('plan', params.plan);
  if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
  if (params?.status) searchParams.append('status', params.status);

  const response = await fetchWithAuth(`${API_URL}/api/platform/tenants?${searchParams}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Active un tenant en attente (back-office SUPER_ADMIN)
 */
export async function activateTenant(
  tenantId: number,
  data: { activation_note?: string }
): Promise<{ success: boolean; tenant_id: number; trial_ends_at: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/tenants/${tenantId}/activate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

/**
 * Bloque un tenant avec motif (back-office SUPER_ADMIN)
 */
export async function blockTenant(
  tenantId: number,
  data: { reason: string }
): Promise<{ success: boolean; tenant_id: number; reason: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/tenants/${tenantId}/block`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

/**
 * Récupère la liste de tous les users (cross-tenant)
 */
export async function getAllUsers(params?: {
  skip?: number;
  limit?: number;
  search?: string;
  role?: string;
  tenant_id?: number;
  is_active?: boolean;
}): Promise<UserListItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.skip !== undefined) searchParams.append('skip', params.skip.toString());
  if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
  if (params?.search) searchParams.append('search', params.search);
  if (params?.role) searchParams.append('role', params.role);
  if (params?.tenant_id !== undefined) searchParams.append('tenant_id', params.tenant_id.toString());
  if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());

  const response = await fetchWithAuth(`${API_URL}/api/platform/users?${searchParams}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Récupère un user par son ID
 */
export async function getUserById(userId: number): Promise<UserListItem> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/users/${userId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Crée un nouveau user
 */
export async function createPlatformUser(data: UserCreateData): Promise<UserListItem> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/users`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export interface TenantCreateData {
  company_name: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  plan?: 'basique' | 'professional' | 'enterprise';
  max_employees?: number;
  is_trial?: boolean;
}

export async function createPlatformTenant(data: TenantCreateData): Promise<{ id: number; name: string; slug: string; email: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/tenants`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

/**
 * Met à jour un user
 */
export async function updatePlatformUser(userId: number, data: UserUpdateData): Promise<UserListItem> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

/**
 * Supprime un user
 */
export async function deletePlatformUser(userId: number): Promise<{ message: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/users/${userId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

// ---- Nouvelles interfaces ----

export interface TenantDetail extends TenantListItem {
  phone?: string;
  address?: string;
  logo_url?: string;
  currency: string;
  timezone: string;
  require_2fa: boolean;
  intowork_company_id?: number;
  intowork_linked_at?: string;
  updated_at?: string;
  trial_days_remaining: number;
}

export interface SubsidiaryItem {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  plan?: string;
  is_active: boolean;
  is_trial: boolean;
  employee_count: number;
}

export interface GroupStatsResponse {
  group_id: number;
  group_name: string;
  total_employees: number;
  total_subsidiaries: number;
  pending_leaves: number;
  subsidiaries: Array<{
    id: number;
    name: string;
    slug: string;
    employee_count: number;
    pending_leaves: number;
    is_active: boolean;
  }>;
}

export interface TenantUpdateData {
  name?: string;
  email?: string;
  phone?: string;
  plan?: string;
  max_employees?: number;
  is_active?: boolean;
  is_trial?: boolean;
  trial_ends_at?: string;
  require_2fa?: boolean;
  currency?: string;
  timezone?: string;
}

export interface ImpersonationResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  impersonated_user_id: number;
  impersonated_user_email: string;
  impersonated_tenant_id?: number;
  first_name?: string;
  last_name?: string;
  employee_role?: string;
  user_role?: string;
  is_manager?: boolean;
  tenant_slug?: string;
  warning: string;
}

export interface AuditLogItem {
  id: number;
  agent_email: string;
  target_user_email?: string;
  target_tenant_name?: string;
  action_type: string;
  action_detail?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface SearchResult {
  query: string;
  tenants: TenantListItem[];
  users: UserListItem[];
  total_tenants: number;
  total_users: number;
}

/** Détail complet d'un tenant */
export async function getTenantDetail(tenantId: number): Promise<TenantDetail> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/tenants/${tenantId}`, {
    method: 'GET',
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

/** Modifier la config d'un tenant */
export async function updatePlatformTenant(tenantId: number, data: TenantUpdateData): Promise<TenantDetail> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/tenants/${tenantId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

/** Générer un token d'impersonation (30 min TTL) */
export async function impersonateUser(userId: number): Promise<ImpersonationResponse> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/impersonate/${userId}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

/** Historique des actions support */
export async function getAuditLogs(params?: {
  skip?: number;
  limit?: number;
  action_type?: string;
  tenant_id?: number;
  target_user_id?: number;
}): Promise<AuditLogItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.skip !== undefined) searchParams.append('skip', params.skip.toString());
  if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
  if (params?.action_type) searchParams.append('action_type', params.action_type);
  if (params?.tenant_id !== undefined) searchParams.append('tenant_id', params.tenant_id.toString());
  if (params?.target_user_id !== undefined) searchParams.append('target_user_id', params.target_user_id.toString());

  const response = await fetchWithAuth(`${API_URL}/api/platform/audit-logs?${searchParams}`, {
    method: 'GET',
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

/** Recherche unifiée cross-tables (tenants + users) */
export async function platformSearch(query: string): Promise<SearchResult> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

// ============================================
// GROUPS & SUBSIDIARIES
// ============================================

/** Convertir un tenant standalone en groupe */
export async function convertTenantToGroup(tenantId: number, nbSubsidiaries: number = 1): Promise<{ success: boolean; message: string; max_subsidiaries: number }> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/tenants/${tenantId}/convert-to-group`, {
    method: 'POST',
    body: JSON.stringify({ confirm: true, nb_subsidiaries: nbSubsidiaries }),
  });
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

/** Modifier le quota de filiales d'un groupe (SuperAdmin) */
export async function updateGroupMaxSubsidiaries(
  tenantId: number,
  maxSubsidiaries: number,
): Promise<{ success: boolean; message: string; max_subsidiaries: number; used_subsidiaries: number; remaining_subsidiaries: number }> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/tenants/${tenantId}/max-subsidiaries`, {
    method: 'PATCH',
    body: JSON.stringify({ max_subsidiaries: maxSubsidiaries }),
  });
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

/** Repasser un groupe en standalone */
export async function revertTenantToStandalone(tenantId: number): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/tenants/${tenantId}/revert-to-standalone`, {
    method: 'POST',
  });
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

/** Lister les filiales d'un groupe */
export async function getSubsidiaries(groupId: number): Promise<SubsidiaryItem[]> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/${groupId}/subsidiaries`);
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

/** Rattacher un tenant existant ou créer une nouvelle filiale */
export async function addSubsidiary(
  groupId: number,
  data: { existing_tenant_slug?: string; name?: string; slug?: string; email?: string }
): Promise<{ success: boolean; message: string; subsidiary_id: number }> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/${groupId}/subsidiaries`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

/** Détacher une filiale de son groupe */
export async function detachSubsidiary(groupId: number, subsidiaryId: number): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/${groupId}/subsidiaries/${subsidiaryId}`, {
    method: 'DELETE',
  });
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

/** Stats agrégées d'un groupe */
export async function getGroupStats(groupId: number): Promise<GroupStatsResponse> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/${groupId}/stats`);
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

/** Contexte groupe de l'utilisateur courant */
export interface MyGroupContext {
  is_group: boolean;
  group_type: 'standalone' | 'group' | 'subsidiary';
  tenant_id: number;
  tenant_name: string;
  subsidiaries: SubsidiaryItem[];
  allowed_subsidiaries: number;
  used_subsidiaries: number;
  remaining_subsidiaries: number;
  parent_tenant_id?: number;
  parent_tenant_name?: string;
}

export interface MyGroupStats {
  group_id: number;
  group_name: string;
  total_employees: number;
  total_subsidiaries: number;
  pending_leaves: number;
  subsidiaries_stats: Array<{
    id: number;
    name: string;
    slug: string;
    employee_count: number;
    pending_leaves: number;
  }>;
}

export async function getMyGroupContext(): Promise<MyGroupContext> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/my-context`);
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

export async function getMyGroupStats(): Promise<MyGroupStats> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/my-stats`);
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

export interface SubsidiaryDashboardStats {
  subsidiary_id: number;
  subsidiary_name: string;
  total_employees: number;
  active_employees: number;
  pending_leaves: number;
  departments_count: number;
  is_active: boolean;
}

export async function getSubsidiaryDashboardStats(subsidiaryTenantId: number): Promise<SubsidiaryDashboardStats> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/my-subsidiary/${subsidiaryTenantId}/stats`);
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

export interface GroupGlobalDashboardStats {
  group_id: number;
  group_name: string;
  subsidiaries_count: number;
  total_employees: number;
  active_employees: number;
  pending_leaves: number;
  departments_count: number;
  subsidiaries: {
    subsidiary_id: number;
    subsidiary_name: string;
    total_employees: number;
    active_employees: number;
    pending_leaves: number;
    departments_count: number;
    is_active: boolean;
  }[];
}

export async function getGroupGlobalDashboardStats(): Promise<GroupGlobalDashboardStats> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/global-dashboard`);
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

export interface ConversionRequestItem {
  id: number;
  tenant_id: number;
  tenant_name?: string;
  requested_by_email?: string;
  reason?: string;
  nb_subsidiaries?: number;
  contact_phone?: string;
  quote_amount?: number;
  payment_status: 'unpaid' | 'paid';
  payment_ref?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_email?: string;
  review_note?: string;
  created_at: string;
  reviewed_at?: string;
}

export async function requestGroupConversion(reason?: string, nb_subsidiaries?: number, contact_phone?: string): Promise<ConversionRequestItem> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/request-conversion`, {
    method: 'POST',
    body: JSON.stringify({ reason, nb_subsidiaries: nb_subsidiaries || 1, contact_phone }),
  });
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

export async function getMyConversionRequestStatus(): Promise<ConversionRequestItem | null> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/request-conversion/status`);
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

export async function createMySubsidiary(
  name: string,
  slug: string,
  email?: string,
  adminEmail?: string,
  adminPassword?: string,
): Promise<{
  success: boolean;
  message: string;
  subsidiary_id: number;
  subsidiary_slug: string;
  admin_email?: string;
  admin_user_id?: number;
  quota_allowed?: number;
  quota_used?: number;
  quota_remaining?: number;
}> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/my-group/subsidiaries`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      slug,
      email: email || undefined,
      admin_email: adminEmail || undefined,
      admin_password: adminPassword || undefined,
    }),
  });
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

export async function listConversionRequests(status?: string): Promise<ConversionRequestItem[]> {
  const url = status
    ? `${API_URL}/api/platform/groups/conversion-requests?status_filter=${status}`
    : `${API_URL}/api/platform/groups/conversion-requests`;
  const response = await fetchWithAuth(url);
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

export async function reviewConversionRequest(requestId: number, approved: boolean, note?: string): Promise<ConversionRequestItem> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/conversion-requests/${requestId}/review`, {
    method: 'POST',
    body: JSON.stringify({ approved, note }),
  });
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}

export async function markConversionAsPaid(requestId: number, paymentRef?: string): Promise<ConversionRequestItem> {
  const response = await fetchWithAuth(`${API_URL}/api/platform/groups/conversion-requests/${requestId}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({ payment_ref: paymentRef || '' }),
  });
  if (!response.ok) { const error = await parseApiError(response); throw new Error(error); }
  return response.json();
}


// ============================================
// 2FA STATUS
// ============================================

export async function check2FAStatus(): Promise<{
  require_2fa: boolean;
  totp_enabled: boolean;
  needs_setup: boolean;
}> {
  const response = await fetchWithAuth(`${API_URL}/api/auth/2fa-status`);
  if (!response.ok) {
    throw new Error('Erreur lors de la vérification 2FA');
  }
  return response.json();
}

export async function setup2FAAuthenticated(): Promise<{
  secret: string;
  provisioning_uri: string;
  qr_code_base64: string;
}> {
  const response = await fetchWithAuth(`${API_URL}/api/auth/2fa/setup-authenticated`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

export async function verify2FAAuthenticated(code: string): Promise<{ success: boolean; totp_enabled: boolean }> {
  const response = await fetchWithAuth(`${API_URL}/api/auth/2fa/verify-authenticated`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}


// ============================================
// INTEGRATIONS
// ============================================

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: string[];
  connected: boolean;
  connected_at: string | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
}

export async function getIntegrations(): Promise<Integration[]> {
  const response = await fetchWithAuth(`${API_URL}/api/integrations/`);
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

export async function connectIntegration(provider: string): Promise<{ auth_url: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/integrations/${provider}/connect`);
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

export async function disconnectIntegration(provider: string): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/integrations/${provider}/disconnect`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

export async function syncIntegration(provider: string): Promise<{ success: boolean; result: Record<string, unknown> }> {
  const response = await fetchWithAuth(`${API_URL}/api/integrations/${provider}/sync`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}
// ============================================
// AI AGENT - CHAT CONTEXTUEL + ACTIONS
// ============================================

export interface AgentMessageRequest {
  message: string;
  page_path: string;
  file_text?: string;
  conversation_history?: Array<{ role: string; content: string }>;
}

export interface AgentActionPreviewData {
  tool_name: string;
  data: Record<string, any>;
  display_label: string;
}

export interface AgentMessageResponse {
  reply: string;
  action_preview: AgentActionPreviewData | null;
}

export interface ExecuteActionRequest {
  action_type: string;
  data: Record<string, any>;
}

export interface ExecuteActionResponse {
  success: boolean;
  message: string;
  [key: string]: any;
}

/**
 * Envoie un message au chat agentique contextuel.
 * Peut retourner un action_preview si Claude génère du contenu structuré.
 */
export async function sendAgentMessage(data: AgentMessageRequest): Promise<AgentMessageResponse> {
  const response = await fetchWithAuth(`${API_URL}/api/ai-chat/agent`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

/**
 * Exécute une action agentique après validation utilisateur.
 * Insère réellement les données en base.
 */
export async function executeAgentAction(data: ExecuteActionRequest): Promise<ExecuteActionResponse> {
  const response = await fetchWithAuth(`${API_URL}/api/ai-chat/execute-action`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}

// ─── Billing / Facturation ─────────────────────────────────────────────────────

export interface InvoiceItem {
  id: number;
  tenant_id: number;
  amount: number;
  currency: string;
  description?: string;
  status: 'pending' | 'paid' | 'cancelled';
  payment_provider: string;
  payment_ref?: string;
  invoice_date: string;
  due_date?: string;
  pdf_url?: string;
  created_by_email?: string;
  created_at: string;
}

export interface CurrentPlan {
  tenant_id: number;
  tenant_name: string;
  plan: string;
  is_trial: boolean;
  is_active: boolean;
  trial_ends_at?: string;
  trial_days_remaining: number;
  max_employees: number;
  current_employees: number;
  currency: string;
}

export async function getMyInvoices(): Promise<InvoiceItem[]> {
  const response = await fetchWithAuth(`${API_URL}/api/billing/invoices`);
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function getCurrentPlan(): Promise<CurrentPlan> {
  const response = await fetchWithAuth(`${API_URL}/api/billing/current-plan`);
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function requestUpgrade(data: { desired_plan: string; message?: string }): Promise<{ message: string }> {
  const response = await fetchWithAuth(`${API_URL}/api/billing/upgrade-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

// Admin billing
export async function adminGetInvoices(tenantId: number): Promise<InvoiceItem[]> {
  const response = await fetchWithAuth(`${API_URL}/api/billing/admin/invoices/${tenantId}`);
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function adminCreateInvoice(tenantId: number, data: {
  amount: number;
  currency?: string;
  description?: string;
  due_date?: string;
  pdf_url?: string;
}): Promise<InvoiceItem> {
  const response = await fetchWithAuth(`${API_URL}/api/billing/admin/invoices/${tenantId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function adminPayInvoice(invoiceId: number, payment_ref?: string): Promise<InvoiceItem> {
  const response = await fetchWithAuth(`${API_URL}/api/billing/admin/invoices/${invoiceId}/pay`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_ref }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function adminCancelInvoice(invoiceId: number): Promise<InvoiceItem> {
  const response = await fetchWithAuth(`${API_URL}/api/billing/admin/invoices/${invoiceId}/cancel`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function adminChangePlan(tenantId: number, data: {
  plan: string;
  max_employees?: number;
  is_trial?: boolean;
  trial_ends_at?: string;
  note?: string;
}): Promise<{ message: string; tenant_id: number; plan: string; max_employees: number }> {
  const response = await fetchWithAuth(`${API_URL}/api/billing/admin/tenants/${tenantId}/plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

/**
 * Extrait le texte d'un fichier PDF pour le fournir au chat agentique.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pages: number; filename?: string; warning?: string; cv_tmp_path?: string; cv_filename?: string }> {
  const formData = new FormData();
  formData.append('file', file);

  // fetchWithAuth sans Content-Type (FormData le gère automatiquement)
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const response = await fetch(`${API_URL}/api/ai-chat/extract-pdf`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }
  return response.json();
}
