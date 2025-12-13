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

// Types
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
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  contract_type?: 'CDI' | 'CDD' | 'INTERN' | 'FREELANCE' | 'PART_TIME';
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
  gender?: string;
  status?: string;
  contract_type?: string;
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
}

export interface Department {
  id: number;
  name: string;
  code?: string;
  description?: string;
  parent_id?: number;
  manager_id?: number;
  employee_count?: number;
  created_at: string;
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
    throw new Error('Failed to fetch employees');
  }

  return response.json();
}

export async function getEmployee(id: number): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch employee');
  }

  return response.json();
}

export async function createEmployee(data: EmployeeCreate): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create employee');
  }

  return response.json();
}

export async function updateEmployee(id: number, data: Partial<EmployeeCreate>): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update employee');
  }

  return response.json();
}

export async function deleteEmployee(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete employee');
  }
}

export async function getEmployeeStats(): Promise<EmployeeStats> {
  const response = await fetch(`${API_URL}/api/employees/stats`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch employee stats');
  }

  return response.json();
}

// Departments
export async function getDepartments(): Promise<Department[]> {
  const response = await fetch(`${API_URL}/api/departments/`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch departments');
  }

  return response.json();
}

export async function getDepartment(id: number): Promise<Department> {
  const response = await fetch(`${API_URL}/api/departments/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch department');
  }

  return response.json();
}

export async function createDepartment(data: Partial<Department>): Promise<Department> {
  const response = await fetch(`${API_URL}/api/departments/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create department');
  }

  return response.json();
}

export async function updateDepartment(id: number, data: Partial<Department>): Promise<Department> {
  const response = await fetch(`${API_URL}/api/departments/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update department');
  }

  return response.json();
}

export async function deleteDepartment(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/departments/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete department');
  }
}

export async function getDepartmentTree(): Promise<Department[]> {
  const response = await fetch(`${API_URL}/api/departments/tree`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch department tree');
  }

  return response.json();
}

// Export employees to CSV
export function exportEmployeesToCSV(employees: Employee[]): void {
  const headers = [
    'Matricule',
    'Prénom',
    'Nom',
    'Email',
    'Téléphone',
    'Poste',
    'Département',
    'Site',
    'Date embauche',
    'Statut',
    'Type contrat',
    'Genre'
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
