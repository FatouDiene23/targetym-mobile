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

// Types pour les rôles
export type EmployeeRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg';

// Types pour les niveaux hiérarchiques organisationnels
export type OrganizationalLevel = 'dg' | 'dga' | 'direction_centrale' | 'direction' | 'departement' | 'service';

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
  currency?: string;
  classification?: string;
  coefficient?: string;
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
  salary?: number | null;
  currency?: string;
  classification?: string | null;
  coefficient?: string | null;
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
  level?: OrganizationalLevel;
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
  // FIX: On garde les valeurs null (pour permettre d'effacer un champ comme salary)
  // On ne filtre que undefined et les chaînes vides
  const cleanData: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
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

// ============================================
// DEPARTMENTS API
// ============================================

export async function getDepartments(level?: OrganizationalLevel): Promise<Department[]> {
  console.log('Fetching departments from:', `${API_URL}/api/departments/`);
  
  const queryParams = new URLSearchParams();
  if (level) queryParams.set('level', level);
  
  const url = level 
    ? `${API_URL}/api/departments/?${queryParams}` 
    : `${API_URL}/api/departments/`;
  
  const response = await fetch(url, {
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

export async function getDepartmentsTree(): Promise<Department[]> {
  const response = await fetch(`${API_URL}/api/departments/tree`, {
    headers: getAuthHeaders(),
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
  const response = await fetch(`${API_URL}/api/departments/levels`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorMsg = await parseApiError(response);
    throw new Error(errorMsg);
  }

  return response.json();
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
  const response = await fetch(`${API_URL}/api/leaves/types?active_only=${activeOnly}`, {
    headers: getAuthHeaders(),
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

export async function getPendingLeaveRequests(): Promise<LeaveRequest[]> {
  const response = await fetch(`${API_URL}/api/leaves/requests/pending`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch pending requests');
  }

  return response.json();
}

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
  const response = await fetch(`${API_URL}/api/employees/${employeeId}/access-status`, {
    headers: getAuthHeaders(),
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

  const response = await fetch(`${API_URL}/api/tasks/my-tasks?${queryParams}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getMyTasksToday(): Promise<Task[]> {
  const response = await fetch(`${API_URL}/api/tasks/my-tasks/today`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getMyTaskStats(): Promise<TaskStats> {
  const response = await fetch(`${API_URL}/api/tasks/my-stats`, {
    headers: getAuthHeaders(),
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

  const response = await fetch(`${API_URL}/api/tasks/team-tasks?${queryParams}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const response = await fetch(`${API_URL}/api/tasks/team-members`, {
    headers: getAuthHeaders(),
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

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    console.warn('Could not fetch objectives for linking');
    return [];
  }

  return response.json();
}

export async function createTask(data: TaskCreate): Promise<Task> {
  const response = await fetch(`${API_URL}/api/tasks`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function updateTask(id: number, data: Partial<TaskCreate>): Promise<Task> {
  const response = await fetch(`${API_URL}/api/tasks/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function startTask(id: number): Promise<Task> {
  const response = await fetch(`${API_URL}/api/tasks/${id}/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function completeTask(id: number, note?: string): Promise<Task> {
  const response = await fetch(`${API_URL}/api/tasks/${id}/complete`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ completion_note: note }),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/tasks/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
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
  const response = await fetch(`${API_URL}/api/tasks/daily-validation/my-status`, {
    headers: getAuthHeaders(),
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
  const response = await fetch(`${API_URL}/api/tasks/daily-validation/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}

export async function getPendingValidations(): Promise<PendingValidation[]> {
  const response = await fetch(`${API_URL}/api/tasks/daily-validation/pending`, {
    headers: getAuthHeaders(),
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
  const response = await fetch(`${API_URL}/api/tasks/daily-validation/${validationId}/validate`, {
    method: 'POST',
    headers: getAuthHeaders(),
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

  const response = await fetch(`${API_URL}/api/tasks/daily-validation/history?${queryParams}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error);
  }

  return response.json();
}