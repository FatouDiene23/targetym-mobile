'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import {
  Plane, MapPin, Calendar, Clock, Users, FileText, Plus, Search,
  Filter, ChevronDown, ChevronRight, Eye, Edit, Trash2, Download,
  CheckCircle, XCircle, AlertCircle, Loader2, Send, PlayCircle,
  StopCircle, Receipt, Building2, Car, Train, Bus, MoreHorizontal,
  TrendingUp, DollarSign, Briefcase, X, Upload
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface Mission {
  id: number;
  reference: string;
  subject: string;
  destination: string;
  destination_country?: string;
  start_date: string;
  end_date: string;
  status: string;
  transport_type: string;
  per_diem_amount?: number;
  per_diem_currency?: string;
  initiated_by: string;
  created_at: string;
  employee_id: number;
  employee_name: string;
  employee_code?: string;
  department_name?: string;
  duration_days: number;
}

interface MissionDetail extends Mission {
  description?: string;
  departure_location: string;
  transport_details?: string;
  accommodation_type?: string;
  accommodation_details?: string;
  estimated_budget?: number;
  advance_amount?: number;
  advance_paid?: boolean;
  manager_id?: number;
  manager_name?: string;
  manager_validated_at?: string;
  manager_comments?: string;
  rh_validated_at?: string;
  rh_comments?: string;
  rejection_reason?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  mission_report?: string;
  created_by_id?: number;
  created_by_name?: string;
  employee_job_title?: string;
  expenses: Expense[];
  total_expenses: number;
  total_approved_expenses: number;
}

interface Expense {
  id: number;
  expense_type: string;
  description: string;
  expense_date: string;
  amount: number;
  currency: string;
  status: string;
  receipt_url?: string;
}

interface Stats {
  total: number;
  brouillon: number;
  en_attente: number;
  approuvees: number;
  en_cours: number;
  terminees: number;
  rejetees: number;
  total_per_diem: number;
  total_avances: number;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  employee_id?: string;
  job_title?: string;
  department_name?: string;
}

// ============================================
// CONFIG
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// ============================================
// CONSTANTES
// ============================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: 'text-gray-600', bg: 'bg-gray-100' },
  en_attente_manager: { label: 'Attente Manager', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  en_attente_rh: { label: 'Attente RH', color: 'text-orange-600', bg: 'bg-orange-100' },
  approuvee: { label: 'Approuvée', color: 'text-blue-600', bg: 'bg-blue-100' },
  rejetee: { label: 'Rejetée', color: 'text-red-600', bg: 'bg-red-100' },
  en_cours: { label: 'En cours', color: 'text-purple-600', bg: 'bg-purple-100' },
  terminee: { label: 'Terminée', color: 'text-green-600', bg: 'bg-green-100' },
  cloturee: { label: 'Clôturée', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const TRANSPORT_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  avion: { label: 'Avion', icon: Plane },
  train: { label: 'Train', icon: Train },
  voiture_personnelle: { label: 'Voiture personnelle', icon: Car },
  voiture_service: { label: 'Voiture de service', icon: Car },
  bus: { label: 'Bus', icon: Bus },
  autre: { label: 'Autre', icon: Car },
};

const EXPENSE_TYPES: Record<string, string> = {
  transport: 'Transport',
  hebergement: 'Hébergement',
  repas: 'Repas',
  taxi: 'Taxi',
  carburant: 'Carburant',
  parking: 'Parking',
  communication: 'Communication',
  autre: 'Autre',
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function MissionsPage() {
  // State
  const [activeTab, setActiveTab] = useState<'list' | 'pending' | 'validated' | 'stats'>('list');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pendingMissions, setPendingMissions] = useState<Mission[]>([]);
  const [validatedMissions, setValidatedMissions] = useState<Mission[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [validatedStatusFilter, setValidatedStatusFilter] = useState<string>('');
  const [validatedSearchQuery, setValidatedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [validatedCurrentPage, setValidatedCurrentPage] = useState(1);
  const [validatedTotalPages, setValidatedTotalPages] = useState(1);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); // FIX #2: Ajout modal édition
  const [selectedMission, setSelectedMission] = useState<MissionDetail | null>(null);
  const [validationType, setValidationType] = useState<'manager' | 'rh'>('manager');
  
  // User info
  const [userRole, setUserRole] = useState<string>('employee');
  const [userId, setUserId] = useState<number | null>(null);

  // ============================================
  // CHARGEMENT DONNÉES
  // ============================================

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserId(user.id);
        const role = (user.role || 'employee').toLowerCase();
        if (['admin', 'dg', 'rh', 'drh'].includes(role)) {
          setUserRole(role === 'drh' ? 'rh' : role);
        } else if (role === 'manager' || user.is_manager) {
          setUserRole('manager');
        } else {
          setUserRole('employee');
        }
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  const fetchMissions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: '20',
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter && { status: statusFilter }),
      });
      
      const res = await fetch(`${API_URL}/api/missions/?${params}`, {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        setMissions(data.items || []);
        setTotalPages(data.pages || 1);
      }
    } catch (e) {
      console.error('Error fetching missions:', e);
    }
  }, [currentPage, searchQuery, statusFilter]);

  const fetchPendingMissions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/missions/pending`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setPendingMissions(data.items || []);
      }
    } catch (e) {
      console.error('Error fetching pending:', e);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/missions/stats`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  }, []);

  const fetchValidatedMissions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: validatedCurrentPage.toString(),
        page_size: '20',
        ...(validatedSearchQuery && { search: validatedSearchQuery }),
        ...(validatedStatusFilter && { status: validatedStatusFilter }),
      });
      
      const res = await fetch(`${API_URL}/api/missions/validated?${params}`, {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        setValidatedMissions(data.items || []);
        setValidatedTotalPages(data.pages || 1);
      }
    } catch (e) {
      console.error('Error fetching validated missions:', e);
    }
  }, [validatedCurrentPage, validatedSearchQuery, validatedStatusFilter]);

  const fetchMissionDetail = async (missionId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/missions/${missionId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedMission(data);
        setShowDetailModal(true);
      } else {
        // FIX #3 & #4: Afficher l'erreur si l'accès est refusé
        const error = await res.json();
        alert(error.detail || 'Erreur lors du chargement de la mission');
      }
    } catch (e) {
      console.error('Error fetching mission detail:', e);
      alert('Erreur de connexion');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchMissions(), fetchPendingMissions(), fetchStats(), fetchValidatedMissions()]);
      setLoading(false);
    };
    loadData();
  }, [fetchMissions, fetchPendingMissions, fetchStats, fetchValidatedMissions]);

  // Recharger les missions validées quand les filtres changent
  useEffect(() => {
    if (activeTab === 'validated') {
      fetchValidatedMissions();
    }
  }, [validatedCurrentPage, validatedSearchQuery, validatedStatusFilter, activeTab, fetchValidatedMissions]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleSubmitMission = async (missionId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/missions/${missionId}/submit`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchMissions();
        fetchPendingMissions();
        setShowDetailModal(false);
      }
    } catch (e) {
      console.error('Error submitting mission:', e);
    }
  };

  const handleStartMission = async (missionId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/missions/${missionId}/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchMissions();
        fetchMissionDetail(missionId);
      }
    } catch (e) {
      console.error('Error starting mission:', e);
    }
  };

  const handleCompleteMission = async (missionId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/missions/${missionId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({})
      });
      if (res.ok) {
        fetchMissions();
        fetchMissionDetail(missionId);
      }
    } catch (e) {
      console.error('Error completing mission:', e);
    }
  };

  const handleDownloadPDF = async (missionId: number, reference: string) => {
    try {
      const res = await fetch(`${API_URL}/api/missions/${missionId}/pdf`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ordre_mission_${reference}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Error downloading PDF:', e);
    }
  };

  const handleDeleteMission = async (missionId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette mission ?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/missions/${missionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchMissions();
        setShowDetailModal(false);
      }
    } catch (e) {
      console.error('Error deleting mission:', e);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  const canManageAll = ['admin', 'dg', 'rh'].includes(userRole);
  const canValidate = ['manager', 'admin', 'dg', 'rh'].includes(userRole);
  const canAssignMission = ['manager', 'admin', 'dg', 'rh'].includes(userRole); // Managers peuvent aussi assigner à leurs N-1

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Gestion des Missions" subtitle="Ordres de mission et frais de déplacement" />

      <main className="p-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <StatCard icon={FileText} label="Total" value={stats.total} color="gray" />
            <StatCard icon={Clock} label="En attente" value={stats.en_attente} color="yellow" />
            <StatCard icon={CheckCircle} label="Approuvées" value={stats.approuvees} color="blue" />
            <StatCard icon={PlayCircle} label="En cours" value={stats.en_cours} color="purple" />
            <StatCard icon={StopCircle} label="Terminées" value={stats.terminees} color="green" />
            <StatCard 
              icon={DollarSign} 
              label="Per diem total" 
              value={`${(stats.total_per_diem / 1000).toFixed(0)}k`} 
              color="emerald" 
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'list' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Mes Missions
            </button>
            {canValidate && (
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors relative ${
                  activeTab === 'pending' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                À valider
                {pendingMissions.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {pendingMissions.length}
                  </span>
                )}
              </button>
            )}
            {canValidate && (
              <button
                onClick={() => setActiveTab('validated')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'validated' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Missions validées
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Search & Filter */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none w-64"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle Mission
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : activeTab === 'list' ? (
          <MissionsList
            missions={missions}
            onViewDetail={fetchMissionDetail}
            onDownloadPDF={handleDownloadPDF}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        ) : activeTab === 'pending' ? (
          <PendingMissionsList
            missions={pendingMissions}
            onViewDetail={fetchMissionDetail}
            userRole={userRole}
          />
        ) : activeTab === 'validated' ? (
          <ValidatedMissionsList
            missions={validatedMissions}
            onViewDetail={fetchMissionDetail}
            onDownloadPDF={handleDownloadPDF}
            currentPage={validatedCurrentPage}
            totalPages={validatedTotalPages}
            onPageChange={setValidatedCurrentPage}
            searchQuery={validatedSearchQuery}
            onSearchChange={setValidatedSearchQuery}
            statusFilter={validatedStatusFilter}
            onStatusFilterChange={setValidatedStatusFilter}
            userRole={userRole}
          />
        ) : null}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateMissionModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchMissions();
            fetchStats();
          }}
          canAssign={canAssignMission}
          userRole={userRole}
        />
      )}

      {showDetailModal && selectedMission && (
        <MissionDetailModal
          mission={selectedMission}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedMission(null);
          }}
          onSubmit={handleSubmitMission}
          onStart={handleStartMission}
          onComplete={handleCompleteMission}
          onDownloadPDF={handleDownloadPDF}
          onDelete={handleDeleteMission}
          onValidate={(type) => {
            setValidationType(type);
            setShowValidationModal(true);
          }}
          onAddExpense={() => setShowExpenseModal(true)}
          onEdit={() => setShowEditModal(true)} // FIX #2: Bouton modifier
          userRole={userRole}
          userId={userId}
          onRefresh={() => fetchMissionDetail(selectedMission.id)}
        />
      )}

      {showValidationModal && selectedMission && (
        <ValidationModal
          mission={selectedMission}
          type={validationType}
          onClose={() => setShowValidationModal(false)}
          onSuccess={() => {
            setShowValidationModal(false);
            fetchMissions();
            fetchPendingMissions();
            fetchMissionDetail(selectedMission.id);
          }}
        />
      )}

      {showExpenseModal && selectedMission && (
        <AddExpenseModal
          missionId={selectedMission.id}
          onClose={() => setShowExpenseModal(false)}
          onSuccess={() => {
            setShowExpenseModal(false);
            fetchMissionDetail(selectedMission.id);
          }}
        />
      )}

      {/* FIX #2: Modal d'édition */}
      {showEditModal && selectedMission && (
        <EditMissionModal
          mission={selectedMission}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchMissions();
            fetchMissionDetail(selectedMission.id);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// COMPOSANTS
// ============================================

function StatCard({ icon: Icon, label, value, color }: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    green: 'bg-green-100 text-green-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function MissionsList({ 
  missions, 
  onViewDetail, 
  onDownloadPDF,
  currentPage,
  totalPages,
  onPageChange
}: { 
  missions: Mission[];
  onViewDetail: (id: number) => void;
  onDownloadPDF: (id: number, ref: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (missions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Plane className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune mission</h3>
        <p className="text-gray-500">Créez votre première demande de mission</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transport</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Per diem</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {missions.map((mission) => {
            const statusConfig = STATUS_CONFIG[mission.status] || STATUS_CONFIG.brouillon;
            const transportConfig = TRANSPORT_CONFIG[mission.transport_type] || TRANSPORT_CONFIG.autre;
            const TransportIcon = transportConfig.icon;

            return (
              <tr key={mission.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-medium text-primary-600">{mission.reference}</span>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{mission.employee_name}</p>
                    <p className="text-xs text-gray-500">{mission.department_name}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">
                      {mission.destination}
                      {mission.destination_country && ` (${mission.destination_country})`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-900">
                    {new Date(mission.start_date).toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-xs text-gray-500">{mission.duration_days} jour(s)</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TransportIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{transportConfig.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {mission.per_diem_amount ? (
                    <span className="text-sm font-medium text-gray-900">
                      {mission.per_diem_amount.toLocaleString()} {mission.per_diem_currency || 'XOF'}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onViewDetail(mission.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {['approuvee', 'en_cours', 'terminee', 'cloturee'].includes(mission.status) && (
                      <button
                        onClick={() => onDownloadPDF(mission.id, mission.reference)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                        title="Télécharger PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {currentPage} sur {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingMissionsList({ 
  missions, 
  onViewDetail,
  userRole
}: { 
  missions: Mission[];
  onViewDetail: (id: number) => void;
  userRole: string;
}) {
  if (missions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune mission en attente</h3>
        <p className="text-gray-500">Toutes les missions ont été traitées</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {missions.map((mission) => (
        <div key={mission.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{mission.subject}</p>
                <p className="text-sm text-gray-500">
                  {mission.employee_name} • {mission.destination} • {mission.duration_days} jour(s)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(mission.start_date).toLocaleDateString('fr-FR')} - {new Date(mission.end_date).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <button
              onClick={() => onViewDetail(mission.id)}
              className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
            >
              Traiter
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// COMPOSANT: MISSIONS VALIDÉES
// ============================================

const VALIDATED_STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'approuvee', label: 'Approuvées' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminées' },
  { value: 'cloturee', label: 'Clôturées' },
];

function ValidatedMissionsList({ 
  missions, 
  onViewDetail, 
  onDownloadPDF,
  currentPage,
  totalPages,
  onPageChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  userRole
}: { 
  missions: Mission[];
  onViewDetail: (id: number) => void;
  onDownloadPDF: (id: number, ref: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  userRole: string;
}) {
  return (
    <div className="space-y-4">
      {/* Filtres spécifiques */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, référence, destination..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            {VALIDATED_STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="text-sm text-gray-500">
            {userRole === 'manager' ? 'Missions de mon équipe' : 'Toutes les missions'}
          </div>
        </div>
      </div>

      {/* Liste */}
      {missions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune mission validée</h3>
          <p className="text-gray-500">
            {userRole === 'manager' 
              ? "Aucune mission validée pour votre équipe" 
              : "Aucune mission validée pour le moment"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Per diem</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {missions.map((mission) => {
                const statusConfig = STATUS_CONFIG[mission.status] || STATUS_CONFIG.brouillon;
                const transportConfig = TRANSPORT_CONFIG[mission.transport_type] || TRANSPORT_CONFIG.autre;

                return (
                  <tr key={mission.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-primary-600">{mission.reference}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{mission.employee_name}</p>
                        <p className="text-xs text-gray-500">{mission.department_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {mission.destination}
                          {mission.destination_country && ` (${mission.destination_country})`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">
                        {new Date(mission.start_date).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-xs text-gray-500">{mission.duration_days} jour(s)</p>
                    </td>
                    <td className="px-4 py-3">
                      {mission.per_diem_amount ? (
                        <span className="text-sm font-medium text-gray-900">
                          {mission.per_diem_amount.toLocaleString()} {mission.per_diem_currency || 'XOF'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onViewDetail(mission.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDownloadPDF(mission.id, mission.reference)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                          title="Télécharger PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {currentPage} sur {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MODAL: CRÉATION
// ============================================

function CreateMissionModal({ 
  onClose, 
  onSuccess, 
  canAssign,
  userRole
}: { 
  onClose: () => void; 
  onSuccess: () => void;
  canAssign: boolean;
  userRole: string;
}) {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState({
    employee_id: '',
    subject: '',
    description: '',
    departure_location: '',
    destination: '',
    destination_country: '',
    start_date: '',
    end_date: '',
    transport_type: 'voiture_service',
    transport_details: '',
    accommodation_type: '',
    accommodation_details: '',
    estimated_budget: '',
  });

  useEffect(() => {
    if (canAssign) {
      // Utiliser l'endpoint team-members qui retourne:
      // - Pour RH/Admin/DG: tous les employés actifs
      // - Pour Manager: seulement ses N-1
      fetch(`${API_URL}/api/missions/team-members`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => setEmployees(Array.isArray(data) ? data : []))
        .catch(console.error);
    }
  }, [canAssign]);

  const isManager = userRole === 'manager';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        employee_id: formData.employee_id ? parseInt(formData.employee_id) : undefined,
        estimated_budget: formData.estimated_budget ? parseFloat(formData.estimated_budget) : undefined,
        accommodation_type: formData.accommodation_type || undefined,
      };

      console.log('Creating mission with payload:', payload);

      const res = await fetch(`${API_URL}/api/missions/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      console.log('Create mission response status:', res.status);

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        console.error('Create mission error:', error);
        alert(error.detail || 'Erreur lors de la création');
      }
    } catch (e) {
      console.error('Error creating mission:', e);
      alert('Erreur de connexion. Vérifiez la console pour plus de détails.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Nouvelle demande de mission</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Employé (si assignation) */}
          {canAssign && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isManager 
                  ? "Membre de mon équipe (laisser vide pour moi-même)" 
                  : "Employé concerné (laisser vide pour vous-même)"}
              </label>
              <select
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Moi-même</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} {emp.employee_id ? `(${emp.employee_id})` : ''}
                  </option>
                ))}
              </select>
              {isManager && employees.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Aucun membre dans votre équipe. Vous pouvez créer une mission pour vous-même.
                </p>
              )}
            </div>
          )}

          {/* Objet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objet de la mission *</label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ex: Participation au salon Tech Africa 2025"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Détails de la mission..."
            />
          </div>

          {/* Lieux */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de départ *</label>
              <input
                type="text"
                required
                value={formData.departure_location}
                onChange={(e) => setFormData({ ...formData, departure_location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Dakar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                required
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Abidjan"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pays de destination (si international)</label>
            <input
              type="text"
              value={formData.destination_country}
              onChange={(e) => setFormData({ ...formData, destination_country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Côte d'Ivoire"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de départ *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de retour *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>

          {/* Transport */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moyen de transport *</label>
              <select
                required
                value={formData.transport_type}
                onChange={(e) => setFormData({ ...formData, transport_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                {Object.entries(TRANSPORT_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hébergement</label>
              <select
                value={formData.accommodation_type}
                onChange={(e) => setFormData({ ...formData, accommodation_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Non spécifié</option>
                <option value="hotel">Hôtel</option>
                <option value="residence">Résidence</option>
                <option value="chez_tiers">Chez un tiers</option>
                <option value="aucun">Aucun</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget estimé (XOF)</label>
            <input
              type="number"
              value={formData.estimated_budget}
              onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="150000"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer la demande
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MODAL: DÉTAIL (MISE À JOUR)
// ============================================

function MissionDetailModal({ 
  mission, 
  onClose, 
  onSubmit,
  onStart,
  onComplete,
  onDownloadPDF,
  onDelete,
  onValidate,
  onAddExpense,
  onEdit, // FIX #2: Ajout prop onEdit
  userRole,
  userId,
  onRefresh
}: { 
  mission: MissionDetail;
  onClose: () => void;
  onSubmit: (id: number) => void;
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  onDownloadPDF: (id: number, ref: string) => void;
  onDelete: (id: number) => void;
  onValidate: (type: 'manager' | 'rh') => void;
  onAddExpense: () => void;
  onEdit: () => void; // FIX #2
  userRole: string;
  userId: number | null;
  onRefresh: () => void;
}) {
  const statusConfig = STATUS_CONFIG[mission.status] || STATUS_CONFIG.brouillon;
  const transportConfig = TRANSPORT_CONFIG[mission.transport_type] || TRANSPORT_CONFIG.autre;
  const TransportIcon = transportConfig.icon;
  
  const isRH = ['admin', 'rh', 'dg'].includes(userRole);
  const isOwner = mission.employee_id === userId || mission.created_by_id === userId;
  
  // FIX #2: Logique de permission étendue pour modification
  // Le demandeur peut modifier tant que pas validée
  const ownerEditableStatuses = ['brouillon', 'rejetee', 'en_attente_manager', 'en_attente_rh'];
  const canEdit = (isOwner && ownerEditableStatuses.includes(mission.status)) || 
                  (isRH && mission.status !== 'cloturee');
  
  const canSubmit = mission.status === 'brouillon' && isOwner;
  const canDelete = mission.status === 'brouillon' && (isOwner || isRH);
  const canValidateManager = mission.status === 'en_attente_manager' && ['manager', 'admin', 'rh', 'dg'].includes(userRole);
  const canValidateRH = mission.status === 'en_attente_rh' && ['admin', 'rh', 'dg'].includes(userRole);
  const canStart = mission.status === 'approuvee';
  const canComplete = ['approuvee', 'en_cours'].includes(mission.status);
  const canAddExpense = ['approuvee', 'en_cours', 'terminee'].includes(mission.status);
  const canDownload = ['approuvee', 'en_cours', 'terminee', 'cloturee'].includes(mission.status);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">{mission.reference}</h2>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{mission.subject}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Infos employé */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-semibold">
                {mission.employee_name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900">{mission.employee_name}</p>
              <p className="text-sm text-gray-500">
                {mission.employee_code || '-'} • {mission.employee_job_title || '-'} • {mission.department_name || '-'}
              </p>
            </div>
          </div>

          {/* Détails mission */}
          <div className="grid grid-cols-2 gap-4">
            <InfoItem icon={MapPin} label="Départ" value={mission.departure_location} />
            <InfoItem 
              icon={MapPin} 
              label="Destination" 
              value={`${mission.destination}${mission.destination_country ? ` (${mission.destination_country})` : ''}`} 
            />
            <InfoItem 
              icon={Calendar} 
              label="Dates" 
              value={`${new Date(mission.start_date).toLocaleDateString('fr-FR')} - ${new Date(mission.end_date).toLocaleDateString('fr-FR')}`} 
            />
            <InfoItem icon={Clock} label="Durée" value={`${mission.duration_days} jour(s)`} />
            <InfoItem icon={TransportIcon} label="Transport" value={transportConfig.label} />
            {mission.accommodation_type && (
              <InfoItem icon={Building2} label="Hébergement" value={mission.accommodation_type} />
            )}
          </div>

          {/* Budget */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-emerald-50 rounded-xl">
            <div>
              <p className="text-xs text-emerald-600 mb-1">Budget estimé</p>
              <p className="text-lg font-semibold text-emerald-700">
                {mission.estimated_budget ? `${mission.estimated_budget.toLocaleString()} XOF` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-600 mb-1">Per diem accordé</p>
              <p className="text-lg font-semibold text-emerald-700">
                {mission.per_diem_amount ? `${mission.per_diem_amount.toLocaleString()} ${mission.per_diem_currency}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-600 mb-1">Avance</p>
              <p className="text-lg font-semibold text-emerald-700">
                {mission.advance_amount ? `${mission.advance_amount.toLocaleString()} XOF` : '-'}
              </p>
            </div>
          </div>

          {/* Description */}
          {mission.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{mission.description}</p>
            </div>
          )}

          {/* Historique validation */}
          {(mission.manager_validated_at || mission.rh_validated_at || mission.rejection_reason) && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Historique</h4>
              <div className="space-y-2">
                {mission.manager_validated_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Validé par manager le {new Date(mission.manager_validated_at).toLocaleDateString('fr-FR')}</span>
                    {mission.manager_comments && <span className="text-gray-500">- {mission.manager_comments}</span>}
                  </div>
                )}
                {mission.rh_validated_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Validé par RH le {new Date(mission.rh_validated_at).toLocaleDateString('fr-FR')}</span>
                    {mission.rh_comments && <span className="text-gray-500">- {mission.rh_comments}</span>}
                  </div>
                )}
                {mission.rejection_reason && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span>Rejetée : {mission.rejection_reason}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Frais de mission */}
          {mission.expenses && mission.expenses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Frais de mission</h4>
                <span className="text-sm text-gray-500">
                  Total : {mission.total_expenses.toLocaleString()} XOF
                </span>
              </div>
              <div className="space-y-2">
                {mission.expenses.map(expense => (
                  <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                      <p className="text-xs text-gray-500">
                        {EXPENSE_TYPES[expense.expense_type]} • {new Date(expense.expense_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{expense.amount.toLocaleString()} {expense.currency}</p>
                      <span className={`text-xs ${expense.status === 'approuve' ? 'text-green-600' : expense.status === 'rejete' ? 'text-red-600' : 'text-yellow-600'}`}>
                        {expense.status === 'approuve' ? 'Approuvé' : expense.status === 'rejete' ? 'Rejeté' : 'En attente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 p-6 border-t border-gray-100">
          {/* FIX #2: Bouton Modifier visible pour les bonnes conditions */}
          {canEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50"
            >
              <Edit className="w-4 h-4" />
              Modifier
            </button>
          )}
          
          {canSubmit && (
            <button
              onClick={() => onSubmit(mission.id)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              <Send className="w-4 h-4" />
              Soumettre
            </button>
          )}
          
          {canValidateManager && (
            <button
              onClick={() => onValidate('manager')}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
            >
              <CheckCircle className="w-4 h-4" />
              Valider (Manager)
            </button>
          )}
          
          {canValidateRH && (
            <button
              onClick={() => onValidate('rh')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              <CheckCircle className="w-4 h-4" />
              Valider (RH)
            </button>
          )}
          
          {canStart && (
            <button
              onClick={() => onStart(mission.id)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              <PlayCircle className="w-4 h-4" />
              Démarrer
            </button>
          )}
          
          {canComplete && (
            <button
              onClick={() => onComplete(mission.id)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <StopCircle className="w-4 h-4" />
              Terminer
            </button>
          )}
          
          {canAddExpense && (
            <button
              onClick={onAddExpense}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Receipt className="w-4 h-4" />
              Ajouter frais
            </button>
          )}
          
          {canDownload && (
            <button
              onClick={() => onDownloadPDF(mission.id, mission.reference)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          )}
          
          {canDelete && (
            <button
              onClick={() => onDelete(mission.id)}
              className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon className="w-5 h-5 text-gray-400" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

// ============================================
// FIX #2: MODAL ÉDITION MISSION
// ============================================

function EditMissionModal({ 
  mission,
  onClose, 
  onSuccess
}: { 
  mission: MissionDetail;
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subject: mission.subject || '',
    description: mission.description || '',
    departure_location: mission.departure_location || '',
    destination: mission.destination || '',
    destination_country: mission.destination_country || '',
    start_date: mission.start_date || '',
    end_date: mission.end_date || '',
    transport_type: mission.transport_type || 'voiture_service',
    transport_details: mission.transport_details || '',
    accommodation_type: mission.accommodation_type || '',
    accommodation_details: mission.accommodation_details || '',
    estimated_budget: mission.estimated_budget?.toString() || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        estimated_budget: formData.estimated_budget ? parseFloat(formData.estimated_budget) : undefined,
        accommodation_type: formData.accommodation_type || undefined,
      };

      const res = await fetch(`${API_URL}/api/missions/${mission.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.detail || 'Erreur lors de la modification');
      }
    } catch (e) {
      console.error('Error updating mission:', e);
      alert('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Modifier la mission {mission.reference}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Objet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objet de la mission *</label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Lieux */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de départ *</label>
              <input
                type="text"
                required
                value={formData.departure_location}
                onChange={(e) => setFormData({ ...formData, departure_location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                required
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pays de destination</label>
            <input
              type="text"
              value={formData.destination_country}
              onChange={(e) => setFormData({ ...formData, destination_country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de départ *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de retour *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>

          {/* Transport */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moyen de transport *</label>
              <select
                required
                value={formData.transport_type}
                onChange={(e) => setFormData({ ...formData, transport_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                {Object.entries(TRANSPORT_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hébergement</label>
              <select
                value={formData.accommodation_type}
                onChange={(e) => setFormData({ ...formData, accommodation_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Non spécifié</option>
                <option value="hotel">Hôtel</option>
                <option value="residence">Résidence</option>
                <option value="chez_tiers">Chez un tiers</option>
                <option value="aucun">Aucun</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget estimé (XOF)</label>
            <input
              type="number"
              value={formData.estimated_budget}
              onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MODAL: VALIDATION
// ============================================

function ValidationModal({ 
  mission, 
  type, 
  onClose, 
  onSuccess 
}: { 
  mission: MissionDetail;
  type: 'manager' | 'rh';
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(true);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [perDiem, setPerDiem] = useState('');
  const [advance, setAdvance] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = type === 'manager' 
        ? `${API_URL}/api/missions/${mission.id}/validate/manager`
        : `${API_URL}/api/missions/${mission.id}/validate/rh`;

      const payload: Record<string, unknown> = {
        approved,
        comments: comments || undefined,
        rejection_reason: !approved ? rejectionReason : undefined,
      };

      if (type === 'rh' && approved) {
        payload.per_diem_amount = perDiem ? parseFloat(perDiem) : undefined;
        payload.advance_amount = advance ? parseFloat(advance) : undefined;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.detail || 'Erreur lors de la validation');
      }
    } catch (e) {
      console.error('Error validating mission:', e);
      alert('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            Validation {type === 'manager' ? 'Manager' : 'RH'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900">{mission.reference}</p>
            <p className="text-sm text-gray-500">{mission.subject}</p>
            <p className="text-sm text-gray-500">{mission.employee_name}</p>
          </div>

          {/* Choix approuver/rejeter */}
          <div className="flex gap-4">
            <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all ${
              approved ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                checked={approved}
                onChange={() => setApproved(true)}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <CheckCircle className={`w-6 h-6 ${approved ? 'text-green-500' : 'text-gray-400'}`} />
                <span className="font-medium">Approuver</span>
              </div>
            </label>
            <label className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all ${
              !approved ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                checked={!approved}
                onChange={() => setApproved(false)}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <XCircle className={`w-6 h-6 ${!approved ? 'text-red-500' : 'text-gray-400'}`} />
                <span className="font-medium">Rejeter</span>
              </div>
            </label>
          </div>

          {/* Per diem (RH uniquement) */}
          {type === 'rh' && approved && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per diem à accorder (XOF)</label>
                <input
                  type="number"
                  value={perDiem}
                  onChange={(e) => setPerDiem(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Ex: 50000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avance à verser (XOF)</label>
                <input
                  type="number"
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Ex: 100000"
                />
              </div>
            </>
          )}

          {/* Commentaires */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commentaires</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Motif de rejet */}
          {!approved && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif du rejet *</label>
              <textarea
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Expliquez la raison du rejet..."
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-2.5 text-white rounded-lg flex items-center justify-center gap-2 ${
                approved ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              } disabled:opacity-50`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {approved ? 'Approuver' : 'Rejeter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MODAL: AJOUTER FRAIS
// ============================================

function AddExpenseModal({ 
  missionId, 
  onClose, 
  onSuccess 
}: { 
  missionId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    expense_type: 'transport',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    amount: '',
    currency: 'XOF',
    receipt_url: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/missions/${missionId}/expenses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        })
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.detail || 'Erreur lors de l\'ajout du frais');
      }
    } catch (e) {
      console.error('Error adding expense:', e);
      alert('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Ajouter un frais</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de frais *</label>
            <select
              required
              value={formData.expense_type}
              onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              {Object.entries(EXPENSE_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ex: Taxi aéroport - hôtel"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant *</label>
              <input
                type="number"
                required
                min="1"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="5000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Justificatif (URL)</label>
            <input
              type="url"
              value={formData.receipt_url}
              onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="https://..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}