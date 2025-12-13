// Configuration API
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

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
  hire_date?: string;
  birth_date?: string;
  date_of_birth?: string;
  gender?: string;
  status: string;
  contract_type?: string;
  salary?: number;
  currency?: string;
  manager_id?: number;
  location?: string;
  site?: string;
  is_manager?: boolean;
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
  parent_id?: number;
  manager_id?: number;
  employee_count?: number;
  created_at?: string;
}

export interface DepartmentCreate {
  name: string;
  code?: string;
  description?: string;
  parent_id?: number;
  manager_id?: number;
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
