'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  User, Calendar, Clock, CheckCircle, XCircle, AlertCircle,
  Plus, FileText, Users, ChevronRight, Edit2, Save, X,
  Briefcase, MapPin, Phone, Mail, Building, CalendarDays
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  employee_id?: number;
  is_active: boolean;
}

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title?: string;
  department_id?: number;
  department_name?: string;
  manager_id?: number;
  manager_name?: string;
  is_manager?: boolean;
  site?: string;
  hire_date?: string;
  status?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  nationality?: string;
}

interface LeaveBalance {
  id: number;
  leave_type_id: number;
  leave_type_name: string;
  leave_type_code: string;
  allocated: number;
  taken: number;
  pending: number;
  carried_over: number;
  available: number;
}

interface LeaveBalanceSummary {
  employee_id: number;
  employee_name: string;
  year: number;
  balances: LeaveBalance[];
  total_available: number;
  total_taken: number;
  total_pending: number;
}

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
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
}

interface LeaveType {
  id: number;
  name: string;
  code: string;
  default_days: number;
  is_active: boolean;
}

// ============================================
// API FUNCTIONS
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getCurrentUser(): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement du profil');
  return response.json();
}

async function getEmployee(id: number): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Employé non trouvé');
  return response.json();
}

async function updateEmployeeProfile(id: number, data: Partial<Employee>): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Erreur de mise à jour');
  return response.json();
}

async function getLeaveBalances(employeeId: number): Promise<LeaveBalanceSummary> {
  const response = await fetch(`${API_URL}/api/leaves/balances/${employeeId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement des soldes');
  return response.json();
}

async function getLeaveTypes(): Promise<LeaveType[]> {
  const response = await fetch(`${API_URL}/api/leaves/types`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement des types');
  return response.json();
}

async function getMyLeaveRequests(employeeId: number): Promise<LeaveRequest[]> {
  const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${employeeId}&page_size=50`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur de chargement des demandes');
  const data = await response.json();
  return data.items || [];
}

async function createLeaveRequest(employeeId: number, data: {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
  start_half_day?: boolean;
  end_half_day?: boolean;
}): Promise<LeaveRequest> {
  const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${employeeId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur de création');
  }
  return response.json();
}

async function cancelLeaveRequest(requestId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/requests/${requestId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur d\'annulation');
}

// Manager endpoints
async function getTeamLeaveRequests(managerId: number): Promise<LeaveRequest[]> {
  // Get direct reports first
  const reportsResponse = await fetch(`${API_URL}/api/employees/${managerId}/direct-reports`, {
    headers: getAuthHeaders(),
  });
  if (!reportsResponse.ok) return [];
  const directReports: Employee[] = await reportsResponse.json();
  
  // Get pending requests for each team member
  const allRequests: LeaveRequest[] = [];
  for (const report of directReports) {
    const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${report.id}&status=pending`, {
      headers: getAuthHeaders(),
    });
    if (response.ok) {
      const data = await response.json();
      allRequests.push(...(data.items || []));
    }
  }
  
  return allRequests;
}

async function approveLeaveRequest(requestId: number, approved: boolean, rejectionReason?: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/requests/${requestId}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approved, rejection_reason: rejectionReason }),
  });
  if (!response.ok) throw new Error('Erreur de traitement');
}

async function getDirectReports(managerId: number): Promise<Employee[]> {
  const response = await fetch(`${API_URL}/api/employees/${managerId}/direct-reports`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) return [];
  return response.json();
}

// ============================================
// COMPONENTS
// ============================================

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En attente' },
    approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approuvé' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Refusé' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Annulé' },
  };
  
  const config = configs[status] || configs.pending;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

// Profile Section Component
function ProfileSection({ 
  employee, 
  onUpdate 
}: { 
  employee: Employee; 
  onUpdate: (data: Partial<Employee>) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    phone: employee.phone || '',
    address: employee.address || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <User className="w-5 h-5 text-primary-600" />
          Mon Profil
        </h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <Edit2 className="w-4 h-4" />
            Modifier
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-6">
        {/* Avatar */}
        <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
          {employee.first_name[0]}{employee.last_name[0]}
        </div>

        {/* Info */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Nom complet</p>
            <p className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500">Matricule</p>
            <p className="font-medium text-gray-900">{employee.employee_id}</p>
          </div>

          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Poste</p>
              <p className="font-medium text-gray-900">{employee.job_title || '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Département</p>
              <p className="font-medium text-gray-900">{employee.department_name || '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{employee.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Téléphone</p>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                  placeholder="Ex: +221 77 123 45 67"
                />
              ) : (
                <p className="font-medium text-gray-900">{employee.phone || '-'}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Site</p>
              <p className="font-medium text-gray-900">{employee.site || '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Date d&apos;embauche</p>
              <p className="font-medium text-gray-900">
                {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('fr-FR') : '-'}
              </p>
            </div>
          </div>

          {isEditing && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500 mb-1">Adresse</p>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={2}
                placeholder="Votre adresse..."
              />
            </div>
          )}
        </div>
      </div>

      {employee.manager_name && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">Manager</p>
          <p className="font-medium text-gray-900">{employee.manager_name}</p>
        </div>
      )}
    </div>
  );
}

// Leave Balances Component
function LeaveBalancesSection({ balances }: { balances: LeaveBalanceSummary | null }) {
  if (!balances) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mes Soldes de Congés</h2>
        <p className="text-gray-500 text-center py-8">Aucun solde initialisé</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" />
          Mes Soldes de Congés ({balances.year})
        </h2>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-600">{balances.total_available}</p>
          <p className="text-xs text-gray-500">jours disponibles</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {balances.balances.map((balance) => (
          <div 
            key={balance.id} 
            className="bg-gray-50 rounded-lg p-4 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">{balance.leave_type_name}</span>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                {balance.leave_type_code}
              </span>
            </div>
            <div className="text-2xl font-bold text-primary-600 mb-2">
              {balance.available}
              <span className="text-sm font-normal text-gray-500"> / {balance.allocated}</span>
            </div>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>Pris: {balance.taken}</span>
              {balance.pending > 0 && (
                <span className="text-yellow-600">En attente: {balance.pending}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// New Leave Request Modal
function NewLeaveRequestModal({
  isOpen,
  onClose,
  leaveTypes,
  employeeId,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  leaveTypes: LeaveType[];
  employeeId: number;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    start_half_day: false,
    end_half_day: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await createLeaveRequest(employeeId, {
        leave_type_id: parseInt(formData.leave_type_id),
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason || undefined,
        start_half_day: formData.start_half_day,
        end_half_day: formData.end_half_day,
      });
      onSuccess();
      onClose();
      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        start_half_day: false,
        end_half_day: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Nouvelle demande de congé</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de congé *
              </label>
              <select
                value={formData.leave_type_id}
                onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Sélectionner...</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de début *
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
                <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.start_half_day}
                    onChange={(e) => setFormData({ ...formData, start_half_day: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Demi-journée
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin *
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
                <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.end_half_day}
                    onChange={(e) => setFormData({ ...formData, end_half_day: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Demi-journée
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif (optionnel)
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                placeholder="Précisez le motif de votre demande..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Soumettre'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// My Leave Requests Component
function MyLeaveRequestsSection({
  requests,
  onNewRequest,
  onCancel,
  loading
}: {
  requests: LeaveRequest[];
  onNewRequest: () => void;
  onCancel: (id: number) => void;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-600" />
          Mes Demandes de Congés
        </h2>
        <button
          onClick={onNewRequest}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nouvelle demande
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Aucune demande de congé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div 
              key={request.id} 
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-medium text-gray-900">{request.leave_type_name}</span>
                  <StatusBadge status={request.status} />
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>
                    {new Date(request.start_date).toLocaleDateString('fr-FR')} → {new Date(request.end_date).toLocaleDateString('fr-FR')}
                  </span>
                  <span>{request.days_requested} jour(s)</span>
                </div>
                {request.rejection_reason && (
                  <p className="mt-2 text-sm text-red-600">
                    Motif de refus: {request.rejection_reason}
                  </p>
                )}
              </div>
              
              {request.status === 'pending' && (
                <button
                  onClick={() => onCancel(request.id)}
                  className="text-sm text-red-600 hover:text-red-700 px-3 py-1 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  Annuler
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Manager Section Component
function ManagerSection({
  managerId,
  isManager
}: {
  managerId: number;
  isManager: boolean;
}) {
  const [teamRequests, setTeamRequests] = useState<LeaveRequest[]>([]);
  const [directReports, setDirectReports] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [requests, reports] = await Promise.all([
        getTeamLeaveRequests(managerId),
        getDirectReports(managerId)
      ]);
      setTeamRequests(requests);
      setDirectReports(reports);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  }, [managerId]);

  useEffect(() => {
    if (isManager) {
      loadData();
    }
  }, [isManager, loadData]);

  const handleApprove = async (requestId: number, approved: boolean, reason?: string) => {
    setProcessingId(requestId);
    try {
      await approveLeaveRequest(requestId, approved, reason);
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isManager) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-600" />
          Espace Manager
        </h2>
        <span className="text-sm text-gray-500">
          {directReports.length} collaborateur(s)
        </span>
      </div>

      {/* Team Members */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Mon équipe</h3>
        <div className="flex flex-wrap gap-2">
          {directReports.map((member) => (
            <div 
              key={member.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full text-sm"
            >
              <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-xs text-primary-700 font-medium">
                {member.first_name[0]}{member.last_name[0]}
              </div>
              <span className="text-gray-700">{member.first_name} {member.last_name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Requests */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Demandes en attente ({teamRequests.length})
        </h3>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : teamRequests.length === 0 ? (
          <p className="text-center py-6 text-gray-500 text-sm">
            Aucune demande en attente
          </p>
        ) : (
          <div className="space-y-3">
            {teamRequests.map((request) => (
              <div 
                key={request.id}
                className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{request.employee_name}</p>
                    <p className="text-sm text-gray-600">{request.leave_type_name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(request.start_date).toLocaleDateString('fr-FR')} → {new Date(request.end_date).toLocaleDateString('fr-FR')}
                      <span className="ml-2">({request.days_requested} jour(s))</span>
                    </p>
                    {request.reason && (
                      <p className="text-sm text-gray-500 mt-1 italic">&quot;{request.reason}&quot;</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(request.id, false, 'Refusé par le manager')}
                      disabled={processingId === request.id}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-50"
                      title="Refuser"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleApprove(request.id, true)}
                      disabled={processingId === request.id}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg disabled:opacity-50"
                      title="Approuver"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function MySpacePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [balances, setBalances] = useState<LeaveBalanceSummary | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // 1. Get current user
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (!currentUser.employee_id) {
        setError('Votre compte n\'est pas lié à un profil employé.');
        setLoading(false);
        return;
      }

      // 2. Get employee details
      const emp = await getEmployee(currentUser.employee_id);
      setEmployee(emp);

      // 3. Get leave data
      const [balancesData, typesData, requestsData] = await Promise.all([
        getLeaveBalances(currentUser.employee_id).catch(() => null),
        getLeaveTypes().catch(() => []),
        getMyLeaveRequests(currentUser.employee_id).catch(() => []),
      ]);

      setBalances(balancesData);
      setLeaveTypes(typesData);
      setMyRequests(requestsData);

    } catch (err) {
      console.error('Erreur de chargement:', err);
      setError('Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateProfile = async (data: Partial<Employee>) => {
    if (!employee) return;
    await updateEmployeeProfile(employee.id, data);
    await loadData();
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm('Voulez-vous vraiment annuler cette demande ?')) return;
    try {
      await cancelLeaveRequest(requestId);
      await loadData();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  if (error && !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Erreur</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mon Espace</h1>
          <p className="text-gray-500 mt-1">
            Gérez votre profil et vos demandes de congés
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          {employee && (
            <ProfileSection 
              employee={employee} 
              onUpdate={handleUpdateProfile}
            />
          )}

          {/* Leave Balances */}
          <LeaveBalancesSection balances={balances} />

          {/* My Leave Requests */}
          <MyLeaveRequestsSection
            requests={myRequests}
            onNewRequest={() => setShowNewRequestModal(true)}
            onCancel={handleCancelRequest}
            loading={false}
          />

          {/* Manager Section */}
          {employee && (
            <ManagerSection
              managerId={employee.id}
              isManager={employee.is_manager || false}
            />
          )}
        </div>
      </div>

      {/* New Request Modal */}
      {employee && (
        <NewLeaveRequestModal
          isOpen={showNewRequestModal}
          onClose={() => setShowNewRequestModal(false)}
          leaveTypes={leaveTypes}
          employeeId={employee.id}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
