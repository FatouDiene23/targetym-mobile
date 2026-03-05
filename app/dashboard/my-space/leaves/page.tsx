'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { myLeavesTips } from '@/config/pageTips';
import { 
  Calendar, Plus, X, AlertCircle, Clock, CheckCircle, XCircle
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  employee_id?: number;
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
// API
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getCurrentUser(): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function getLeaveBalances(employeeId: number): Promise<LeaveBalanceSummary> {
  const response = await fetch(`${API_URL}/api/leaves/balances/${employeeId}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function getLeaveTypes(): Promise<LeaveType[]> {
  const response = await fetch(`${API_URL}/api/leaves/types`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function getMyLeaveRequests(employeeId: number): Promise<LeaveRequest[]> {
  const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${employeeId}&page_size=50`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
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
    throw new Error(error.detail || 'Erreur');
  }
  return response.json();
}

async function cancelLeaveRequest(requestId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/requests/${requestId}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur');
}

// ============================================
// COMPONENTS
// ============================================

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En attente', icon: <Clock className="w-3.5 h-3.5" /> },
    approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approuvé', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Refusé', icon: <XCircle className="w-3.5 h-3.5" /> },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Annulé', icon: <X className="w-3.5 h-3.5" /> },
  };
  
  const config = configs[status] || configs.pending;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

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
      setError(err instanceof Error ? err.message : 'Erreur');
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
                Type de congé <span className="text-red-500">*</span>
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
                  Date de début <span className="text-red-500">*</span>
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
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Demi-journée (après-midi)
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de fin <span className="text-red-500">*</span>
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
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Demi-journée (matin)
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                placeholder="Précisez le motif de votre demande (optionnel)..."
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>Note :</strong> Les justificatifs (certificat médical, etc.) sont à remettre au service RH.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
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

// ============================================
// MAIN PAGE
// ============================================

export default function MyLeavesPage() {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [balances, setBalances] = useState<LeaveBalanceSummary | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const { showTips, dismissTips, resetTips } = usePageTour('myLeaves');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const user = await getCurrentUser();
      if (!user.employee_id) {
        setError('Compte non lié à un profil employé');
        return;
      }

      setEmployeeId(user.employee_id);

      const [balancesData, typesData, requestsData] = await Promise.all([
        getLeaveBalances(user.employee_id).catch(() => null),
        getLeaveTypes(),
        getMyLeaveRequests(user.employee_id),
      ]);

      setBalances(balancesData);
      setLeaveTypes(typesData);
      setRequests(requestsData);
    } catch (err) {
      console.error(err);
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancel = async (requestId: number) => {
    if (!confirm('Voulez-vous vraiment annuler cette demande ?')) return;
    try {
      await cancelLeaveRequest(requestId);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips tips={myLeavesTips} onDismiss={dismissTips} pageTitle="Mes Congés" />
      )}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes Congés</h1>
            <p className="text-gray-500 mt-1">Gérez vos demandes de congés</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            data-tour="request-leave"
          >
            <Plus className="w-5 h-5" />
            Nouvelle demande
          </button>
        </div>

        {/* Balances */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Mes Soldes ({balances?.year || new Date().getFullYear()})
            </h2>
            {balances && (
              <div className="text-right">
                <p className="text-3xl font-bold text-primary-600">{balances.total_available}</p>
                <p className="text-sm text-gray-500">jours disponibles</p>
              </div>
            )}
          </div>

          {balances && balances.balances.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="leave-balance">
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
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Pris: {balance.taken}</span>
                    {balance.pending > 0 && (
                      <span className="text-yellow-600">En attente: {balance.pending}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-500">Aucun solde initialisé</p>
          )}
        </div>

        {/* Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mes Demandes</h2>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            {[
              { key: 'all', label: 'Toutes' },
              { key: 'pending', label: 'En attente' },
              { key: 'approved', label: 'Approuvées' },
              { key: 'rejected', label: 'Refusées' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.key !== 'all' && (
                  <span className="ml-1 text-xs">
                    ({requests.filter(r => r.status === tab.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Aucune demande</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium text-gray-900">{request.leave_type_name}</span>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        {new Date(request.start_date).toLocaleDateString('fr-FR')} 
                        {request.start_date !== request.end_date && (
                          <> → {new Date(request.end_date).toLocaleDateString('fr-FR')}</>
                        )}
                      </span>
                      <span className="font-medium">{request.days_requested} jour(s)</span>
                    </div>
                    {request.reason && (
                      <p className="mt-1 text-sm text-gray-500 italic">&quot;{request.reason}&quot;</p>
                    )}
                    {request.rejection_reason && (
                      <p className="mt-2 text-sm text-red-600">
                        <strong>Motif de refus:</strong> {request.rejection_reason}
                      </p>
                    )}
                    {request.approved_by_name && request.status === 'approved' && (
                      <p className="mt-1 text-xs text-gray-400">
                        Approuvé par {request.approved_by_name}
                      </p>
                    )}
                  </div>
                  
                  {request.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(request.id)}
                      className="ml-4 text-sm text-red-600 hover:text-red-700 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {employeeId && (
        <NewLeaveRequestModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          leaveTypes={leaveTypes}
          employeeId={employeeId}
          onSuccess={loadData}
        />
      )}
    </div>    </>  );
}
