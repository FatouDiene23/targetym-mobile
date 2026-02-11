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
  employee_job_title?: string;
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
  receipt_filename?: string;
  validator_name?: string;
  validation_comments?: string;
  rejection_reason?: string;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  employee_id?: string;
  job_title?: string;
  department_name?: string;
}

interface MissionStats {
  total: number;
  brouillon: number;
  en_attente: number;
  approuvee: number;
  en_cours: number;
  terminee: number;
  rejetee: number;
  total_per_diem: number;
  pending_validation: number;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: 'text-gray-600', bg: 'bg-gray-100' },
  en_attente_manager: { label: 'Attente Manager', color: 'text-orange-600', bg: 'bg-orange-100' },
  en_attente_rh: { label: 'Attente RH', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  approuvee: { label: 'Approuvée', color: 'text-green-600', bg: 'bg-green-100' },
  rejetee: { label: 'Rejetée', color: 'text-red-600', bg: 'bg-red-100' },
  en_cours: { label: 'En cours', color: 'text-blue-600', bg: 'bg-blue-100' },
  terminee: { label: 'Terminée', color: 'text-purple-600', bg: 'bg-purple-100' },
  cloturee: { label: 'Clôturée', color: 'text-gray-500', bg: 'bg-gray-50' },
};

const TRANSPORT_LABELS: Record<string, { label: string; icon: any }> = {
  avion: { label: 'Avion', icon: Plane },
  train: { label: 'Train', icon: Train },
  voiture_personnelle: { label: 'Voiture personnelle', icon: Car },
  voiture_service: { label: 'Voiture de service', icon: Car },
  bus: { label: 'Bus', icon: Bus },
  autre: { label: 'Autre', icon: Car },
};

const EXPENSE_LABELS: Record<string, string> = {
  transport: 'Transport',
  hebergement: 'Hébergement',
  repas: 'Repas',
  taxi: 'Taxi',
  carburant: 'Carburant',
  parking: 'Parking',
  communication: 'Communication',
  autre: 'Autre',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// ============================================
// HELPERS
// ============================================

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function getUserRole(): string {
  if (typeof window === 'undefined') return 'employee';
  try {
    const token = getToken();
    if (!token) return 'employee';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.role || 'employee').toLowerCase();
  } catch { return 'employee'; }
}

function getUserId(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || payload.user_id || null;
  } catch { return null; }
}

function canManageAll(role: string): boolean {
  return ['rh', 'admin', 'dg', 'superadmin'].includes(role);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(amount: number | null | undefined, currency: string = 'XOF'): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + currency;
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
  return res.json();
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function MissionsPage() {
  const [activeTab, setActiveTab] = useState<'mes_missions' | 'a_valider' | 'toutes'>('mes_missions');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pendingMissions, setPendingMissions] = useState<Mission[]>([]);
  const [stats, setStats] = useState<MissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [selectedMission, setSelectedMission] = useState<MissionDetail | null>(null);
  const [missionToValidate, setMissionToValidate] = useState<Mission | null>(null);

  const role = getUserRole();
  const userId = getUserId();
  const isManagerOrAbove = role === 'manager' || canManageAll(role);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchMissions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);

      // Pour "Mes missions", on filtre côté frontend pour ne montrer que les siennes
      const data = await apiFetch(`/api/missions/?${params.toString()}`);
      
      if (activeTab === 'mes_missions') {
        // Filtrer uniquement les missions de l'utilisateur connecté
        setMissions(data.missions.filter((m: Mission) => m.employee_id === userId));
      } else {
        setMissions(data.missions);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, activeTab, userId]);

  const fetchPending = useCallback(async () => {
    if (!isManagerOrAbove) return;
    try {
      const data = await apiFetch('/api/missions/pending');
      setPendingMissions(data.missions);
    } catch (err) {
      console.error('Erreur pending:', err);
    }
  }, [isManagerOrAbove]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch('/api/missions/stats');
      setStats(data);
    } catch (err) {
      console.error('Erreur stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchMissions();
    fetchPending();
    fetchStats();
  }, [fetchMissions, fetchPending, fetchStats]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleViewMission = async (mission: Mission) => {
    try {
      const data = await apiFetch(`/api/missions/${mission.id}`);
      setSelectedMission(data);
      setShowDetailModal(true);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleEditMission = async (mission: Mission) => {
    try {
      const data = await apiFetch(`/api/missions/${mission.id}`);
      setSelectedMission(data);
      setShowEditModal(true);
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleValidateMission = (mission: Mission) => {
    setMissionToValidate(mission);
    setShowValidateModal(true);
  };

  const handleSubmitMission = async (missionId: number) => {
    try {
      await apiFetch(`/api/missions/${missionId}/submit`, { method: 'POST' });
      fetchMissions();
      fetchPending();
      fetchStats();
      alert('Mission soumise avec succès');
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleStartMission = async (missionId: number) => {
    try {
      await apiFetch(`/api/missions/${missionId}/start`, { method: 'POST' });
      fetchMissions();
      fetchStats();
      alert('Mission démarrée');
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleDeleteMission = async (missionId: number) => {
    if (!confirm('Supprimer cette mission ?')) return;
    try {
      await apiFetch(`/api/missions/${missionId}`, { method: 'DELETE' });
      fetchMissions();
      fetchStats();
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    }
  };

  // ============================================
  // RENDER: Stats Cards
  // ============================================

  const renderStats = () => {
    if (!stats) return null;
    const cards = [
      { label: 'Total', value: stats.total, icon: Briefcase, color: 'text-gray-700', bg: 'bg-gray-50' },
      { label: 'En attente', value: stats.en_attente, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
      { label: 'Approuvées', value: stats.approuvee, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
      { label: 'En cours', value: stats.en_cours, icon: PlayCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    ];

    if (isManagerOrAbove && stats.pending_validation > 0) {
      cards.push({ label: 'À valider', value: stats.pending_validation, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' });
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-xl p-4 border`}>
            <div className="flex items-center justify-between mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className={`text-2xl font-bold ${card.color}`}>{card.value}</span>
            </div>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>
    );
  };

  // ============================================
  // RENDER: Mission Row
  // ============================================

  const renderMissionRow = (mission: Mission, showActions: boolean = true) => {
    const statusConf = STATUS_CONFIG[mission.status] || STATUS_CONFIG.brouillon;
    const transport = TRANSPORT_LABELS[mission.transport_type] || TRANSPORT_LABELS.autre;
    const TransportIcon = transport.icon;

    return (
      <tr key={mission.id} className="hover:bg-gray-50 border-b">
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-sm text-gray-900">{mission.reference}</p>
            <p className="text-xs text-gray-500">{formatDate(mission.created_at)}</p>
          </div>
        </td>
        <td className="px-4 py-3">
          <div>
            <p className="text-sm font-medium">{mission.subject}</p>
            {activeTab !== 'mes_missions' && (
              <p className="text-xs text-gray-500">{mission.employee_name}</p>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm">{mission.destination}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm">
            <p>{formatDate(mission.start_date)}</p>
            <p className="text-xs text-gray-500">{mission.duration_days} jour(s)</p>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <TransportIcon className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs">{transport.label}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConf.bg} ${statusConf.color}`}>
            {statusConf.label}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-sm font-medium">
          {mission.per_diem_amount ? formatAmount(mission.per_diem_amount) : '-'}
        </td>
        {showActions && (
          <td className="px-4 py-3">
            <div className="flex items-center gap-1">
              {/* Bouton Voir */}
              <button
                onClick={() => handleViewMission(mission)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                title="Voir"
              >
                <Eye className="w-4 h-4" />
              </button>

              {/* Bouton Modifier (brouillon ou rejeté) */}
              {(mission.status === 'brouillon' || mission.status === 'rejetee') && (
                <button
                  onClick={() => handleEditMission(mission)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-yellow-600"
                  title="Modifier"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}

              {/* Bouton Soumettre (brouillon) */}
              {mission.status === 'brouillon' && (
                <button
                  onClick={() => handleSubmitMission(mission.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-600"
                  title="Soumettre"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}

              {/* Bouton Démarrer (approuvée) */}
              {mission.status === 'approuvee' && (
                <button
                  onClick={() => handleStartMission(mission.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                  title="Démarrer"
                >
                  <PlayCircle className="w-4 h-4" />
                </button>
              )}

              {/* Bouton Supprimer (brouillon) */}
              {mission.status === 'brouillon' && (
                <button
                  onClick={() => handleDeleteMission(mission.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Bouton Traiter (pour validation) */}
              {activeTab === 'a_valider' && ['en_attente_manager', 'en_attente_rh'].includes(mission.status) && (
                <button
                  onClick={() => handleValidateMission(mission)}
                  className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700"
                >
                  Traiter
                </button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  };

  // ============================================
  // RENDER: Tabs
  // ============================================

  const tabs = [
    { id: 'mes_missions' as const, label: 'Mes missions', icon: Briefcase },
    ...(isManagerOrAbove ? [{ id: 'a_valider' as const, label: `À valider${stats?.pending_validation ? ` (${stats.pending_validation})` : ''}`, icon: CheckCircle }] : []),
    ...(canManageAll(role) ? [{ id: 'toutes' as const, label: 'Toutes les missions', icon: Users }] : []),
  ];

  const displayMissions = activeTab === 'a_valider' ? pendingMissions : missions;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Gestion des Missions" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Title + New button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Missions</h1>
            <p className="text-sm text-gray-500">Ordres de mission et déplacements professionnels</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouvelle mission
          </button>
        </div>

        {/* Stats */}
        {renderStats()}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 bg-white rounded-xl p-1 border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une mission..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-500">Chargement...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : displayMissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Plane className="w-12 h-12 mb-3" />
              <p>Aucune mission trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objet</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transport</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Per Diem</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayMissions.map((m) => renderMissionRow(m))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* MODAL: Créer une mission */}
      {/* ============================================ */}
      {showCreateModal && (
        <CreateMissionModal
          role={role}
          userId={userId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchMissions();
            fetchStats();
          }}
        />
      )}

      {/* ============================================ */}
      {/* MODAL: Détail mission */}
      {/* ============================================ */}
      {showDetailModal && selectedMission && (
        <MissionDetailModal
          mission={selectedMission}
          role={role}
          onClose={() => { setShowDetailModal(false); setSelectedMission(null); }}
        />
      )}

      {/* ============================================ */}
      {/* MODAL: Modifier mission */}
      {/* ============================================ */}
      {showEditModal && selectedMission && (
        <EditMissionModal
          mission={selectedMission}
          onClose={() => { setShowEditModal(false); setSelectedMission(null); }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedMission(null);
            fetchMissions();
            fetchStats();
          }}
        />
      )}

      {/* ============================================ */}
      {/* MODAL: Valider mission */}
      {/* ============================================ */}
      {showValidateModal && missionToValidate && (
        <ValidateMissionModal
          mission={missionToValidate}
          role={role}
          onClose={() => { setShowValidateModal(false); setMissionToValidate(null); }}
          onSuccess={() => {
            setShowValidateModal(false);
            setMissionToValidate(null);
            fetchMissions();
            fetchPending();
            fetchStats();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// MODAL: Créer une mission
// ============================================

function CreateMissionModal({ role, userId, onClose, onSuccess }: {
  role: string; userId: number | null; onClose: () => void; onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    employee_id: userId || 0,
    subject: '',
    description: '',
    departure_location: '',
    destination: '',
    destination_country: '',
    start_date: '',
    end_date: '',
    transport_type: 'avion',
    transport_details: '',
    accommodation_type: '',
    accommodation_details: '',
    estimated_budget: '',
    as_draft: false,
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Charger les employés si manager ou RH
    if (role === 'manager') {
      // Manager ne voit que ses N-1
      apiFetch(`/api/employees/?manager_id=${userId}&status=active`)
        .then((data) => setEmployees(data.employees || data))
        .catch(() => {});
    } else if (canManageAll(role)) {
      apiFetch('/api/employees/?status=active')
        .then((data) => setEmployees(data.employees || data))
        .catch(() => {});
    }
  }, [role, userId]);

  const handleSubmit = async () => {
    if (!formData.subject || !formData.departure_location || !formData.destination || !formData.start_date || !formData.end_date) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/api/missions/', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          employee_id: formData.employee_id || userId,
          estimated_budget: formData.estimated_budget ? parseFloat(formData.estimated_budget) : null,
          accommodation_type: formData.accommodation_type || null,
        }),
      });
      onSuccess();
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold">Nouvelle demande de mission</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Sélection employé (manager/RH uniquement) */}
          {(role === 'manager' || canManageAll(role)) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label>
              <select
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              >
                <option value={userId || 0}>Moi-même</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} - {emp.job_title || ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Objet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objet de la mission *</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-sm"
              placeholder="Ex: Participation au salon RH Africa 2025"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-sm"
              rows={3}
              placeholder="Détails de la mission..."
            />
          </div>

          {/* Lieux */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de départ *</label>
              <input
                type="text"
                value={formData.departure_location}
                onChange={(e) => setFormData({ ...formData, departure_location: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
                placeholder="Dakar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
                placeholder="Abidjan"
              />
            </div>
          </div>

          {/* Pays destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pays de destination</label>
            <input
              type="text"
              value={formData.destination_country}
              onChange={(e) => setFormData({ ...formData, destination_country: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-sm"
              placeholder="Côte d'Ivoire (si international)"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de départ *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de retour *</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Transport */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moyen de transport *</label>
              <select
                value={formData.transport_type}
                onChange={(e) => setFormData({ ...formData, transport_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              >
                <option value="avion">Avion</option>
                <option value="train">Train</option>
                <option value="voiture_personnelle">Voiture personnelle</option>
                <option value="voiture_service">Voiture de service</option>
                <option value="bus">Bus</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hébergement</label>
              <select
                value={formData.accommodation_type}
                onChange={(e) => setFormData({ ...formData, accommodation_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              >
                <option value="">-- Choisir --</option>
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
              className="w-full px-3 py-2 border rounded-xl text-sm"
              placeholder="500000"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
            Annuler
          </button>
          <button
            onClick={() => { formData.as_draft = true; handleSubmit(); }}
            className="px-4 py-2 text-sm border rounded-xl hover:bg-gray-50"
            disabled={submitting}
          >
            Enregistrer brouillon
          </button>
          <button
            onClick={() => { formData.as_draft = false; handleSubmit(); }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2"
            disabled={submitting}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MODAL: Détail mission
// ============================================

function MissionDetailModal({ mission, role, onClose }: {
  mission: MissionDetail; role: string; onClose: () => void;
}) {
  const statusConf = STATUS_CONFIG[mission.status] || STATUS_CONFIG.brouillon;
  const transport = TRANSPORT_LABELS[mission.transport_type] || TRANSPORT_LABELS.autre;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold">{mission.reference}</h2>
            <p className="text-sm text-gray-500">{mission.subject}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConf.bg} ${statusConf.color}`}>
              {statusConf.label}
            </span>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Info employé */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Missionnaire</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Nom:</span> <span className="font-medium">{mission.employee_name}</span></div>
              <div><span className="text-gray-500">Matricule:</span> <span className="font-medium">{mission.employee_code || '-'}</span></div>
              <div><span className="text-gray-500">Poste:</span> <span className="font-medium">{mission.employee_job_title || '-'}</span></div>
              <div><span className="text-gray-500">Département:</span> <span className="font-medium">{mission.department_name || '-'}</span></div>
            </div>
          </div>

          {/* Détails mission */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Itinéraire
              </h3>
              <p className="text-sm"><span className="text-gray-500">De:</span> {mission.departure_location}</p>
              <p className="text-sm"><span className="text-gray-500">À:</span> {mission.destination} {mission.destination_country && `(${mission.destination_country})`}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Dates
              </h3>
              <p className="text-sm"><span className="text-gray-500">Du:</span> {formatDate(mission.start_date)}</p>
              <p className="text-sm"><span className="text-gray-500">Au:</span> {formatDate(mission.end_date)}</p>
              <p className="text-sm font-medium">{mission.duration_days} jour(s)</p>
            </div>
          </div>

          {/* Transport & Hébergement */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Transport</h3>
              <p className="text-sm">{transport.label}</p>
              {mission.transport_details && <p className="text-xs text-gray-500 mt-1">{mission.transport_details}</p>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Hébergement</h3>
              <p className="text-sm">{mission.accommodation_type || '-'}</p>
              {mission.accommodation_details && <p className="text-xs text-gray-500 mt-1">{mission.accommodation_details}</p>}
            </div>
          </div>

          {/* Budget */}
          <div className="bg-green-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Budget & Per Diem
            </h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-500">Budget estimé:</span><br /><span className="font-medium">{formatAmount(mission.estimated_budget)}</span></div>
              <div><span className="text-gray-500">Per diem:</span><br /><span className="font-medium">{formatAmount(mission.per_diem_amount, mission.per_diem_currency)}</span></div>
              <div><span className="text-gray-500">Avance:</span><br /><span className="font-medium">{formatAmount(mission.advance_amount)}</span></div>
            </div>
          </div>

          {/* Validation timeline */}
          {(mission.manager_validated_at || mission.rh_validated_at || mission.rejection_reason) && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Historique de validation</h3>
              <div className="space-y-2 text-sm">
                {mission.manager_validated_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Manager validé le {formatDate(mission.manager_validated_at)}</span>
                    {mission.manager_comments && <span className="text-gray-500">- {mission.manager_comments}</span>}
                  </div>
                )}
                {mission.rh_validated_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>RH validé le {formatDate(mission.rh_validated_at)}</span>
                    {mission.rh_comments && <span className="text-gray-500">- {mission.rh_comments}</span>}
                  </div>
                )}
                {mission.rejection_reason && (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-600">Rejeté: {mission.rejection_reason}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {mission.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Description</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{mission.description}</p>
            </div>
          )}

          {/* Frais de mission */}
          {mission.expenses && mission.expenses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Frais de mission
              </h3>
              <div className="space-y-2">
                {mission.expenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <span className="font-medium">{EXPENSE_LABELS[exp.expense_type] || exp.expense_type}</span>
                      <span className="text-gray-500 ml-2">- {exp.description}</span>
                      <span className="text-gray-400 ml-2">({formatDate(exp.expense_date)})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{formatAmount(exp.amount, exp.currency)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        exp.status === 'approuve' ? 'bg-green-100 text-green-600' :
                        exp.status === 'rejete' ? 'bg-red-100 text-red-600' :
                        exp.status === 'rembourse' ? 'bg-purple-100 text-purple-600' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>
                        {exp.status}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end text-sm font-medium pt-2 border-t">
                  Total: {formatAmount(mission.total_expenses)}
                </div>
              </div>
            </div>
          )}

          {/* Rapport de mission */}
          {mission.mission_report && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Rapport de mission</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">{mission.mission_report}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 border-t sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MODAL: Modifier mission
// ============================================

function EditMissionModal({ mission, onClose, onSuccess }: {
  mission: MissionDetail; onClose: () => void; onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    subject: mission.subject,
    description: mission.description || '',
    departure_location: mission.departure_location,
    destination: mission.destination,
    destination_country: mission.destination_country || '',
    start_date: mission.start_date,
    end_date: mission.end_date,
    transport_type: mission.transport_type,
    transport_details: mission.transport_details || '',
    accommodation_type: mission.accommodation_type || '',
    accommodation_details: mission.accommodation_details || '',
    estimated_budget: mission.estimated_budget?.toString() || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await apiFetch(`/api/missions/${mission.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...formData,
          estimated_budget: formData.estimated_budget ? parseFloat(formData.estimated_budget) : null,
          accommodation_type: formData.accommodation_type || null,
        }),
      });
      onSuccess();
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold">Modifier - {mission.reference}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objet *</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-sm"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de départ *</label>
              <input
                type="text"
                value={formData.departure_location}
                onChange={(e) => setFormData({ ...formData, departure_location: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de départ *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de retour *</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transport</label>
              <select
                value={formData.transport_type}
                onChange={(e) => setFormData({ ...formData, transport_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              >
                <option value="avion">Avion</option>
                <option value="train">Train</option>
                <option value="voiture_personnelle">Voiture personnelle</option>
                <option value="voiture_service">Voiture de service</option>
                <option value="bus">Bus</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hébergement</label>
              <select
                value={formData.accommodation_type}
                onChange={(e) => setFormData({ ...formData, accommodation_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              >
                <option value="">-- Choisir --</option>
                <option value="hotel">Hôtel</option>
                <option value="residence">Résidence</option>
                <option value="chez_tiers">Chez un tiers</option>
                <option value="aucun">Aucun</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget estimé (XOF)</label>
            <input
              type="number"
              value={formData.estimated_budget}
              onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2"
            disabled={submitting}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MODAL: Valider mission
// ============================================

function ValidateMissionModal({ mission, role, onClose, onSuccess }: {
  mission: Mission; role: string; onClose: () => void; onSuccess: () => void;
}) {
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [perDiem, setPerDiem] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRHStep = mission.status === 'en_attente_rh' || canManageAll(role);
  const endpoint = isRHStep
    ? `/api/missions/${mission.id}/validate/rh`
    : `/api/missions/${mission.id}/validate/manager`;

  const handleValidate = async (approved: boolean) => {
    if (!approved && !rejectionReason) {
      alert('Veuillez indiquer la raison du rejet');
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          approved,
          comments,
          rejection_reason: rejectionReason || null,
          per_diem_amount: perDiem ? parseFloat(perDiem) : null,
          advance_amount: advanceAmount ? parseFloat(advanceAmount) : null,
        }),
      });
      onSuccess();
    } catch (err: any) {
      alert('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold">Traiter la mission</h2>
            <p className="text-sm text-gray-500">{mission.reference} - {mission.subject}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Résumé */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
            <p><span className="text-gray-500">Employé:</span> {mission.employee_name}</p>
            <p><span className="text-gray-500">Destination:</span> {mission.destination}</p>
            <p><span className="text-gray-500">Dates:</span> {formatDate(mission.start_date)} → {formatDate(mission.end_date)} ({mission.duration_days}j)</p>
          </div>

          {/* Per diem (RH step) */}
          {isRHStep && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per diem (XOF)</label>
                <input
                  type="number"
                  value={perDiem}
                  onChange={(e) => setPerDiem(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  placeholder="50000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avance (XOF)</label>
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* Commentaires */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commentaires</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm"
              rows={3}
              placeholder="Commentaires optionnels..."
            />
          </div>

          {/* Raison de rejet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raison du rejet (si rejeté)</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm"
              rows={2}
              placeholder="Obligatoire en cas de rejet..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
            Annuler
          </button>
          <button
            onClick={() => handleValidate(false)}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center gap-2"
            disabled={submitting}
          >
            <XCircle className="w-4 h-4" />
            Rejeter
          </button>
          <button
            onClick={() => handleValidate(true)}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center gap-2"
            disabled={submitting}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Approuver
          </button>
        </div>
      </div>
    </div>
  );
}