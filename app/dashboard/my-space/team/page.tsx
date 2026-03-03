'use client';

import { useState, useEffect, useCallback } from 'react';
import PageTourTips, { RestartPageTipsButton } from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { teamTips } from '@/config/pageTips';
import { 
  Users, CheckCircle, XCircle, Clock, AlertCircle, Calendar,
  ChevronDown, ChevronUp, User
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  employee_id?: number;
}

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  department_name?: string;
  status?: string;
  is_manager?: boolean;
}

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason?: string;
  status: string;
  created_at: string;
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

async function getEmployee(id: number): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function getDirectReports(managerId: number): Promise<Employee[]> {
  const response = await fetch(`${API_URL}/api/employees/${managerId}/direct-reports`, { headers: getAuthHeaders() });
  if (!response.ok) return [];
  return response.json();
}

async function getTeamLeaveRequests(teamMembers: Employee[]): Promise<LeaveRequest[]> {
  const allRequests: LeaveRequest[] = [];
  
  for (const member of teamMembers) {
    try {
      const response = await fetch(
        `${API_URL}/api/leaves/requests?employee_id=${member.id}&status=pending`, 
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        const requests = (data.items || []).map((r: LeaveRequest) => ({
          ...r,
          employee_name: `${member.first_name} ${member.last_name}`
        }));
        allRequests.push(...requests);
      }
    } catch (e) {
      console.error('Error fetching requests for', member.id, e);
    }
  }
  
  return allRequests.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

async function approveLeaveRequest(requestId: number, approved: boolean, rejectionReason?: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/leaves/requests/${requestId}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approved, rejection_reason: rejectionReason }),
  });
  if (!response.ok) throw new Error('Erreur');
}

// ============================================
// COMPONENTS
// ============================================

function TeamMemberCard({ member }: { member: Employee }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
        {member.first_name[0]}{member.last_name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {member.first_name} {member.last_name}
        </p>
        <p className="text-sm text-gray-500 truncate">{member.job_title || 'N/A'}</p>
      </div>
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        member.status === 'active' 
          ? 'bg-green-100 text-green-700' 
          : member.status === 'on_leave'
          ? 'bg-yellow-100 text-yellow-700'
          : 'bg-gray-100 text-gray-700'
      }`}>
        {member.status === 'active' ? 'Actif' : member.status === 'on_leave' ? 'En congé' : member.status}
      </span>
    </div>
  );
}

function LeaveRequestCard({ 
  request, 
  onApprove, 
  onReject,
  processing 
}: { 
  request: LeaveRequest; 
  onApprove: () => void;
  onReject: (reason: string) => void;
  processing: boolean;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('Veuillez indiquer un motif de refus');
      return;
    }
    onReject(rejectReason);
  };

  return (
    <div className="bg-white border border-yellow-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">{request.employee_name}</span>
          </div>
          <p className="text-sm text-primary-600 font-medium mb-2">{request.leave_type_name}</p>
          
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(request.start_date).toLocaleDateString('fr-FR')} 
              {request.start_date !== request.end_date && (
                <> → {new Date(request.end_date).toLocaleDateString('fr-FR')}</>
              )}
            </span>
            <span className="font-medium">({request.days_requested} jour(s))</span>
          </div>
          
          {request.reason && (
            <p className="text-sm text-gray-500 italic mt-2">&quot;{request.reason}&quot;</p>
          )}
          
          <p className="text-xs text-gray-400 mt-2">
            Demandé le {new Date(request.created_at).toLocaleDateString('fr-FR')}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onApprove}
            disabled={processing}
            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
            title="Approuver"
          >
            <CheckCircle className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowRejectForm(!showRejectForm)}
            disabled={processing}
            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refuser"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
      </div>

      {showRejectForm && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Motif du refus
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            rows={2}
            placeholder="Indiquez le motif du refus..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowRejectForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleReject}
              disabled={processing}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Confirmer le refus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MyTeamPage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showTeam, setShowTeam] = useState(true);

  const { showTips, dismissTips, resetTips } = usePageTour('team');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const user = await getCurrentUser();
      if (!user.employee_id) {
        setError('Compte non lié à un profil employé');
        return;
      }

      const emp = await getEmployee(user.employee_id);
      setEmployee(emp);

      if (!emp.is_manager) {
        setError('Vous n\'avez pas accès à cette page');
        return;
      }

      const team = await getDirectReports(user.employee_id);
      setTeamMembers(team);

      const requests = await getTeamLeaveRequests(team);
      setPendingRequests(requests);

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

  const handleApprove = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      await approveLeaveRequest(requestId, true);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'approbation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: number, reason: string) => {
    setProcessingId(requestId);
    try {
      await approveLeaveRequest(requestId, false, reason);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors du refus');
    } finally {
      setProcessingId(null);
    }
  };

  // Pour éviter le warning ESLint sur employee non utilisé
  console.log('Employee loaded:', employee?.first_name);

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
        <PageTourTips tips={teamTips} onDismiss={dismissTips} pageTitle="Mon Équipe" />
      )}
      <RestartPageTipsButton onClick={resetTips} />
      <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mon Équipe</h1>
          <p className="text-gray-500 mt-1">
            Gérez les demandes de congés de votre équipe
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" data-tour="team-stats">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
                <p className="text-sm text-gray-500">Collaborateurs</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingRequests.length}</p>
                <p className="text-sm text-gray-500">Demandes en attente</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {teamMembers.filter(m => m.status === 'active').length}
                </p>
                <p className="text-sm text-gray-500">Actifs aujourd&apos;hui</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-yellow-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Demandes en attente ({pendingRequests.length})
            </h2>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
              <p>Aucune demande en attente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <LeaveRequestCard
                  key={request.id}
                  request={request}
                  onApprove={() => handleApprove(request.id)}
                  onReject={(reason) => handleReject(request.id, reason)}
                  processing={processingId === request.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Team Members */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <button
            onClick={() => setShowTeam(!showTeam)}
            className="w-full flex items-center justify-between mb-4"
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Mon équipe ({teamMembers.length})
              </h2>
            </div>
            {showTeam ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showTeam && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-tour="team-list">
              {teamMembers.map((member) => (
                <TeamMemberCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
