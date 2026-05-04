'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import CustomSelect from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';
import {
  Plane, MapPin, Calendar, Clock, Users, FileText, Plus, Search,
  Filter, ChevronDown, ChevronRight, Eye, Edit, Trash2, Download,
  CheckCircle, XCircle, AlertCircle, Loader2, Send, PlayCircle,
  StopCircle, Receipt, Building2, Car, Train, Bus, MoreHorizontal,
  TrendingUp, DollarSign, Briefcase, X, Upload, UserCheck
} from 'lucide-react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { missionsTips } from '@/config/pageTips';
import ConfirmDialog from '@/components/ConfirmDialog';
import CountrySelect from '@/components/CountrySelect';


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
  rh_validator_name?: string;
  rejection_reason?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  mission_report?: string;
  created_by_name?: string;
  employee_job_title?: string;
  expenses: Expense[];
  total_expenses: number;
  total_approved_expenses: number;
  // Signatures électroniques
  employee_signature_url?: string;
  manager_signature_url?: string;
  drh_signature_url?: string;
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
  cloturee: number;
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
  en_cours: { label: 'En cours', color: 'text-primary-600', bg: 'bg-primary-100' },
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

const API_URL = 'https://api.targetym.ai';

// ============================================
// HELPERS
// ============================================

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function getUserFromStorage(): { role: string; employeeId: number | null; userId: number | null } {
  if (typeof window === 'undefined') return { role: 'employee', employeeId: null, userId: null };
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const role = (user.role || 'employee').toLowerCase();
      const employeeId = user.employee_id || null;
      const userId = user.id || null;
      console.log('[Missions] User from localStorage:', { role, employeeId, userId, raw: user });
      return { role, employeeId, userId };
    }
  } catch (e) {
    console.error('[Missions] Error parsing user from localStorage:', e);
  }
  return { role: 'employee', employeeId: null, userId: null };
}

function canManageAll(role: string): boolean {
  return ['rh', 'admin', 'dg', 'superadmin'].includes(role);
}

function isManagerOrAbove(role: string): boolean {
  return role === 'manager' || canManageAll(role);
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

type TabType = 'mes_missions' | 'a_valider' | 'equipe' | 'toutes';

export default function MissionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('mes_missions');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pendingMissions, setPendingMissions] = useState<Mission[]>([]);
  const [teamMissions, setTeamMissions] = useState<Mission[]>([]);
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

  // User info
  const [role, setRole] = useState('employee');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  const showValidateTab = isManagerOrAbove(role);
  const showTeamTab = isManagerOrAbove(role);

  // Sélection multiple
  const [selectedMissionIds, setSelectedMissionIds] = useState<Set<number>>(new Set());
  const [bulkMissionLoading, setBulkMissionLoading] = useState(false);

  // Tour tips
  const { showTips, dismissTips, resetTips } = usePageTour('missions');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ pending: Mission[] } | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState('');

  useEffect(() => {
    const userInfo = getUserFromStorage();
    setRole(userInfo.role);
    setEmployeeId(userInfo.employeeId);
    setInitialized(true);
  }, []);

  // Écouter l'event du header "+Ajouter" → ouvrir le modal de création
  useEffect(() => {
    const handler = () => setShowCreateModal(true);
    window.addEventListener('missions-add', handler);
    return () => window.removeEventListener('missions-add', handler);
  }, []);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchMyMissions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      if (employeeId) params.set('employee_id', employeeId.toString());

      const data = await apiFetch(`/api/missions/?${params.toString()}`);
      const allMissions = data.missions || data.items || data || [];
      console.log('[Missions] Mes missions:', allMissions.length, '| employeeId:', employeeId);
      const myMissions = (canManageAll(role) && employeeId) 
        ? allMissions.filter((m: Mission) => m.employee_id === employeeId)
        : allMissions;
      setMissions(myMissions);
    } catch (err: any) {
      console.error('[Missions] Erreur fetch:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, employeeId]);

  const fetchPending = useCallback(async () => {
    if (!showValidateTab) return;
    try {
      const data = await apiFetch('/api/missions/pending');
      const pendingList = data.missions || data.items || data || [];
      console.log('[Missions] Pending:', pendingList.length);
      setPendingMissions(pendingList);
    } catch (err) {
      console.error('Erreur pending:', err);
    }
  }, [showValidateTab]);

  const fetchTeamMissions = useCallback(async () => {
    if (!showTeamTab) return;
    try {
      const params = new URLSearchParams();
      if (statusFilter && activeTab === 'equipe') params.set('status', statusFilter);
      if (searchTerm && activeTab === 'equipe') params.set('search', searchTerm);

      const data = await apiFetch(`/api/missions/?${params.toString()}`);
      const allMissions = data.missions || data.items || data || [];
      
      if (canManageAll(role)) {
        console.log('[Missions] Equipe (RH/Admin): toutes =', allMissions.length);
        setTeamMissions(allMissions);
      } else if (role === 'manager') {
        const filtered = allMissions.filter((m: Mission) => m.employee_id !== employeeId);
        console.log('[Missions] Equipe (Manager): N-1 =', filtered.length);
        setTeamMissions(filtered);
      }
    } catch (err) {
      console.error('Erreur team missions:', err);
    }
  }, [showTeamTab, role, employeeId, statusFilter, searchTerm, activeTab]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch('/api/missions/stats');
      setStats(data);
    } catch (err) {
      console.error('Erreur stats:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchMyMissions(), fetchPending(), fetchTeamMissions(), fetchStats()]);
  }, [fetchMyMissions, fetchPending, fetchTeamMissions, fetchStats]);

  useEffect(() => {
    if (initialized) fetchAll();
  }, [fetchAll, initialized]);

  useEffect(() => {
    if (!initialized) return;
    if (activeTab === 'equipe') {
      fetchTeamMissions();
    } else if (activeTab === 'mes_missions') {
      fetchMyMissions();
    } else if (activeTab === 'a_valider') {
      fetchPending();
    }
  }, [activeTab, initialized]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleViewMission = async (mission: Mission) => {
    try {
      const data = await apiFetch(`/api/missions/${mission.id}`);
      setSelectedMission(data);
      setShowDetailModal(true);
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleEditMission = async (mission: Mission) => {
    try {
      const data = await apiFetch(`/api/missions/${mission.id}`);
      setSelectedMission(data);
      setShowEditModal(true);
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleValidateMission = (mission: Mission) => {
    setMissionToValidate(mission);
    setShowValidateModal(true);
  };

  const handleSubmitMission = async (missionId: number) => {
    try {
      await apiFetch(`/api/missions/${missionId}/submit`, { method: 'POST' });
      fetchAll();
      toast.success('Mission soumise avec succès');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleStartMission = async (missionId: number) => {
    try {
      await apiFetch(`/api/missions/${missionId}/start`, { method: 'POST' });
      fetchAll();
      toast.success('Mission démarrée');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleDeleteMission = async (missionId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer la mission',
      message: 'Êtes-vous sûr de vouloir supprimer cette mission ?',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiFetch(`/api/missions/${missionId}`, { method: 'DELETE' });
          fetchAll();
          toast.success('Mission supprimée');
        } catch (err: any) {
          toast.error('Erreur: ' + err.message);
        }
      },
    });
  };

  // ============================================
  // BULK ACTIONS
  // ============================================

  const toggleSelectAllMissions = (missionList: Mission[]) => {
    const allSelected = missionList.length > 0 && missionList.every(m => selectedMissionIds.has(m.id));
    if (allSelected) setSelectedMissionIds(new Set());
    else setSelectedMissionIds(new Set(missionList.map(m => m.id)));
  };

  const toggleSelectMission = (id: number) => {
    setSelectedMissionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkApproveMissions = async () => {
    const pending = pendingMissions.filter(m => selectedMissionIds.has(m.id) && ['en_attente_manager', 'en_attente_rh'].includes(m.status));
    if (pending.length === 0) { toast.error('Aucune mission à valider dans la sélection'); return; }
    setConfirmDialog({
      isOpen: true,
      title: `Approuver ${pending.length} mission(s) ?`,
      message: `Valider en masse ${pending.length} mission(s) sélectionnée(s) ?`,
      danger: false,
      onConfirm: async () => {
        setBulkMissionLoading(true);
        try {
          for (const m of pending) {
            await apiFetch(`/api/missions/${m.id}/validate`, { method: 'POST', body: JSON.stringify({ decision: 'approuvee', comment: 'Approbation groupée' }) });
          }
          setSelectedMissionIds(new Set());
          toast.success(`${pending.length} mission(s) approuvée(s)`);
          fetchAll();
        } catch (err: any) { toast.error('Erreur: ' + err.message); }
        setBulkMissionLoading(false);
      },
    });
  };

  const handleBulkRejectMissions = async () => {
    const pending = pendingMissions.filter(m => selectedMissionIds.has(m.id) && ['en_attente_manager', 'en_attente_rh'].includes(m.status));
    if (pending.length === 0) { toast.error('Aucune mission à rejeter dans la sélection'); return; }
    setRejectReasonText('');
    setRejectDialog({ pending });
  };

  const doRejectMissions = async (pending: Mission[], reason: string) => {
    setBulkMissionLoading(true);
    try {
      for (const m of pending) {
        await apiFetch(`/api/missions/${m.id}/validate`, { method: 'POST', body: JSON.stringify({ decision: 'rejetee', comment: reason }) });
      }
      setSelectedMissionIds(new Set());
      toast.success(`${pending.length} mission(s) rejetée(s)`);
      fetchAll();
    } catch (err: any) { toast.error('Erreur: ' + err.message); }
    setBulkMissionLoading(false);
  };

  const handleBulkExportMissions = async (missionList: Mission[]) => {
    const selected = missionList.filter(m => selectedMissionIds.has(m.id));
    const headers = ['Référence', 'Employé', 'Objet', 'Destination', 'Début', 'Fin', 'Durée', 'Transport', 'Statut', 'Per Diem'];
    const rows = selected.map(m => [
      m.reference, m.employee_name, m.subject, m.destination,
      formatDate(m.start_date), formatDate(m.end_date), `${m.duration_days}j`,
      TRANSPORT_LABELS[m.transport_type]?.label || m.transport_type,
      STATUS_CONFIG[m.status]?.label || m.status,
      m.per_diem_amount ? formatAmount(m.per_diem_amount) : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const { downloadFile } = await import('@/lib/capacitor-plugins');
    await downloadFile(blob, `missions_selection_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleBulkDeleteMissions = async (missionList: Mission[]) => {
    const deletable = missionList.filter(m => selectedMissionIds.has(m.id) && m.status === 'brouillon');
    if (deletable.length === 0) { toast.error('Seules les missions en brouillon peuvent être supprimées'); return; }
    setConfirmDialog({
      isOpen: true,
      title: `Supprimer ${deletable.length} mission(s) ?`,
      message: `Supprimer définitivement ${deletable.length} mission(s) en brouillon ? Cette action est irréversible.`,
      danger: true,
      onConfirm: async () => {
        setBulkMissionLoading(true);
        try {
          for (const m of deletable) {
            await apiFetch(`/api/missions/${m.id}`, { method: 'DELETE' });
          }
          setSelectedMissionIds(new Set());
          fetchAll();
        } catch (err: any) { toast.error('Erreur: ' + err.message); }
        setBulkMissionLoading(false);
      },
    });
  };

  // ============================================
  // PDF GENERATION - Ordre de Mission
  // ============================================

  const handleDownloadPDF = async (missionId: number, reference: string) => {
    try {
      const data = await apiFetch(`/api/missions/${missionId}`);
      const m = data as MissionDetail;
      const transport = TRANSPORT_LABELS[m.transport_type] || TRANSPORT_LABELS.autre;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Veuillez autoriser les popups pour télécharger le PDF');
        return;
      }

      // Helper pour générer le bloc signature avec image ou ligne vide
      const renderSignatureBlock = (
        title: string,
        name: string,
        signatureUrl: string | null | undefined,
        dateStr: string | null | undefined
      ) => {
        const sigImage = signatureUrl
          ? `<div class="sig-image"><img src="${signatureUrl}" alt="Signature" /></div>`
          : `<div class="sig-placeholder"></div>`;
        
        const sigDate = dateStr
          ? formatDate(dateStr)
          : '_______________';

        return `
          <div class="sig-box">
            <div class="title">${title}</div>
            ${sigImage}
            <div class="name">${name || '_______________'}</div>
            <div class="date-sig">Date: ${sigDate}</div>
          </div>
        `;
      };

      printWindow.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ordre de Mission - ${m.reference}</title>
  <style>
    @media print { body { margin: 0; } @page { margin: 1.5cm; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #222; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 24px; }
    .header h1 { font-size: 20pt; color: #1e40af; margin-bottom: 4px; letter-spacing: 1px; }
    .header .ref { font-size: 12pt; color: #555; font-weight: 600; }
    .header .date { font-size: 9pt; color: #888; margin-top: 6px; }
    .section { margin-bottom: 18px; }
    .section-title { font-size: 11pt; font-weight: 700; color: #1e40af; border-bottom: 1.5px solid #dbeafe; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    td { padding: 6px 10px; vertical-align: top; font-size: 10.5pt; }
    .label { font-weight: 600; color: #555; width: 180px; }
    .value { color: #111; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .grid2 td { border-bottom: 1px solid #f3f4f6; }
    .budget-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-top: 8px; }
    .budget-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; text-align: center; }
    .budget-item .amount { font-size: 14pt; font-weight: 700; color: #16a34a; }
    .budget-item .blabel { font-size: 8pt; color: #666; margin-top: 2px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 40px; text-align: center; }
    .sig-box { padding-top: 8px; }
    .sig-box .title { font-size: 9pt; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .sig-box .sig-image { height: 60px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
    .sig-box .sig-image img { max-height: 60px; max-width: 150px; object-fit: contain; }
    .sig-box .sig-placeholder { height: 60px; border-bottom: 1.5px solid #ccc; margin-bottom: 6px; }
    .sig-box .name { font-size: 9pt; color: #333; font-weight: 600; }
    .sig-box .date-sig { font-size: 8pt; color: #888; margin-top: 4px; }
    .status-badge { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 9pt; font-weight: 600; background: #dcfce7; color: #166534; }
    .footer { margin-top: 30px; text-align: center; font-size: 8pt; color: #aaa; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    .validation-timeline { margin-top: 8px; }
    .validation-step { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 10pt; }
    .validation-step .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
    .print-btn { display: block; margin: 20px auto; padding: 10px 30px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 12pt; cursor: pointer; }
    .print-btn:hover { background: #1e3a8a; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
  
  <div class="header">
    <h1>ORDRE DE MISSION</h1>
    <div class="ref">${m.reference}</div>
    <div class="date">Émis le ${formatDate(m.created_at)}</div>
    <div style="margin-top: 6px;"><span class="status-badge">✓ ${(STATUS_CONFIG[m.status] || STATUS_CONFIG.brouillon).label}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Employé</div>
    <table>
      <tr><td class="label">Nom complet</td><td class="value">${m.employee_name}</td></tr>
      <tr><td class="label">Matricule</td><td class="value">${m.employee_code || '-'}</td></tr>
      <tr><td class="label">Poste</td><td class="value">${m.employee_job_title || '-'}</td></tr>
      <tr><td class="label">Département</td><td class="value">${m.department_name || '-'}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Objet de la mission</div>
    <table>
      <tr><td class="label">Objet</td><td class="value">${m.subject}</td></tr>
      ${m.description ? `<tr><td class="label">Description</td><td class="value">${m.description}</td></tr>` : ''}
    </table>
  </div>

  <div class="section">
    <div class="section-title">Itinéraire & Dates</div>
    <table>
      <tr><td class="label">Lieu de départ</td><td class="value">${m.departure_location}</td></tr>
      <tr><td class="label">Destination</td><td class="value">${m.destination}${m.destination_country ? ` (${m.destination_country})` : ''}</td></tr>
      <tr><td class="label">Date de départ</td><td class="value">${formatDate(m.start_date)}</td></tr>
      <tr><td class="label">Date de retour</td><td class="value">${formatDate(m.end_date)}</td></tr>
      <tr><td class="label">Durée</td><td class="value">${m.duration_days} jour(s)</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Transport & Hébergement</div>
    <table>
      <tr><td class="label">Moyen de transport</td><td class="value">${transport.label}</td></tr>
      ${m.transport_details ? `<tr><td class="label">Détails transport</td><td class="value">${m.transport_details}</td></tr>` : ''}
      <tr><td class="label">Hébergement</td><td class="value">${m.accommodation_type || '-'}</td></tr>
      ${m.accommodation_details ? `<tr><td class="label">Détails hébergement</td><td class="value">${m.accommodation_details}</td></tr>` : ''}
    </table>
  </div>



  ${m.manager_validated_at || m.rh_validated_at ? `
  <div class="section">
    <div class="section-title">Validations</div>
    <div class="validation-timeline">
      ${m.manager_validated_at ? `<div class="validation-step"><span class="dot"></span> Validé par le Responsable le ${formatDate(m.manager_validated_at)} ${m.manager_comments ? `— ${m.manager_comments}` : ''}</div>` : ''}
      ${m.rh_validated_at ? `<div class="validation-step"><span class="dot"></span> Validé par la DRH le ${formatDate(m.rh_validated_at)} ${m.rh_comments ? `— ${m.rh_comments}` : ''}</div>` : ''}
    </div>
  </div>
  ` : ''}

  <div class="signatures">
    ${renderSignatureBlock(
      'Direction des Ressources Humaines',
      m.rh_validator_name || '',
      m.drh_signature_url,
      m.rh_validated_at
    )}
    ${renderSignatureBlock(
      'Le Responsable',
      m.manager_name || '',
      m.manager_signature_url,
      m.manager_validated_at
    )}
    ${renderSignatureBlock(
      "L'Employé",
      m.employee_name,
      m.employee_signature_url,
      null
    )}
  </div>

  <div class="footer">
    Document généré automatiquement par TARGETYM AI — ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}
  </div>
</body>
</html>
      `);
      printWindow.document.close();
    } catch (err: any) {
      toast.error('Erreur lors de la génération: ' + err.message);
    }
  };

  // ============================================
  // RENDER: Stats Cards
  // ============================================

  const renderStats = () => {
    if (!stats) return null;
    const cards: { label: string; value: string | number; icon: any; color: string; bg: string }[] = [
      { label: 'Total', value: stats.total, icon: Briefcase, color: 'text-gray-700', bg: 'bg-gray-50' },
      { label: 'En attente', value: stats.en_attente, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
      { label: 'En cours', value: stats.en_cours, icon: PlayCircle, color: 'text-primary-600', bg: 'bg-primary-50' },
      { label: 'Terminées', value: stats.terminee, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
      { label: 'Per Diem Total', value: formatAmount(stats.total_per_diem), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    if (showValidateTab && stats.pending_validation > 0) {
      cards.splice(5, 0, { label: 'À valider', value: stats.pending_validation, icon: UserCheck, color: 'text-red-600', bg: 'bg-red-50' });
    }

    return (
      <div className="flex md:grid md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 mb-6 overflow-x-auto scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0 pb-1">
        {cards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-xl p-3 md:p-4 border min-w-[120px] md:min-w-0 shrink-0 md:shrink`}>
            <div className="flex items-center justify-between mb-1 md:mb-2">
              <card.icon className={`w-4 md:w-5 h-4 md:h-5 ${card.color}`} />
            </div>
            <p className={`text-base md:text-lg font-bold ${card.color}`}>{card.value}</p>
            <p className="text-[10px] md:text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>
    );
  };

  // ============================================
  // RENDER: Mission Row
  // ============================================

  const renderMissionRow = (mission: Mission, context: 'mes_missions' | 'a_valider' | 'equipe' | 'toutes') => {
    const statusConf = STATUS_CONFIG[mission.status] || STATUS_CONFIG.brouillon;
    const transport = TRANSPORT_LABELS[mission.transport_type] || TRANSPORT_LABELS.autre;
    const TransportIcon = transport.icon;

    return (
      <tr key={mission.id} className={`hover:bg-gray-50 border-b ${selectedMissionIds.has(mission.id) ? 'bg-primary-50/50' : ''}`}>
        {context !== 'mes_missions' && (
          <td className="w-10 px-3 py-3">
            <input type="checkbox" checked={selectedMissionIds.has(mission.id)} onChange={() => toggleSelectMission(mission.id)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
          </td>
        )}
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-sm text-gray-900">{mission.reference}</p>
            <p className="text-xs text-gray-500">{formatDate(mission.created_at)}</p>
          </div>
        </td>
        {context !== 'mes_missions' && (
          <td className="px-4 py-3">
            <div>
              <p className="text-sm font-medium">{mission.employee_name}</p>
              <p className="text-xs text-gray-500">{mission.department_name || ''}</p>
            </div>
          </td>
        )}
        <td className="px-4 py-3">
          <p className="text-sm font-medium">{mission.subject}</p>
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
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleViewMission(mission)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary-600"
              title="Voir"
            >
              <Eye className="w-4 h-4" />
            </button>

            {(
              (context === 'mes_missions' && ['brouillon', 'rejetee'].includes(mission.status)) ||
              ((context === 'equipe' || context === 'a_valider') && isManagerOrAbove(role) && ['brouillon', 'en_attente_manager', 'en_attente_rh', 'rejetee'].includes(mission.status))
            ) && (
              <button
                onClick={() => handleEditMission(mission)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-yellow-600"
                title="Modifier"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}

            {context === 'mes_missions' && mission.status === 'brouillon' && (
              <button
                onClick={() => handleSubmitMission(mission.id)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-600"
                title="Soumettre"
              >
                <Send className="w-4 h-4" />
              </button>
            )}

            {mission.status === 'approuvee' && (
              <button
                onClick={() => handleStartMission(mission.id)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-primary-600"
                title="Démarrer"
              >
                <PlayCircle className="w-4 h-4" />
              </button>
            )}

            {['approuvee', 'en_cours', 'terminee', 'cloturee'].includes(mission.status) && (
              <button
                onClick={() => handleDownloadPDF(mission.id, mission.reference)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-emerald-600"
                title="Télécharger l'ordre de mission"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {context === 'mes_missions' && mission.status === 'brouillon' && (
              <button
                onClick={() => handleDeleteMission(mission.id)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {context === 'a_valider' && ['en_attente_manager', 'en_attente_rh'].includes(mission.status) && (
              <button
                onClick={() => handleValidateMission(mission)}
                className="px-3 py-1 rounded-lg bg-primary-600 text-white text-xs hover:bg-primary-700"
              >
                Traiter
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // ============================================
  // RENDER: Table
  // ============================================

  const renderTable = (missionList: Mission[], context: TabType) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          <span className="ml-2 text-gray-500">Chargement...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-12 text-red-500">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      );
    }

    if (missionList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Plane className="w-12 h-12 mb-3" />
          <p>{context === 'a_valider' ? 'Aucune mission en attente de validation' : 'Aucune mission trouvée'}</p>
        </div>
      );
    }

    const showSelection = context !== 'mes_missions';
    const allMissionsSelected = showSelection && missionList.length > 0 && missionList.every(m => selectedMissionIds.has(m.id));
    const someMissionsSelected = showSelection && selectedMissionIds.size > 0;

    return (
      <>
        {/* Barre d'actions groupées */}
        {someMissionsSelected && (
          <div className="mx-4 mt-3 mb-1 flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
            <span className="text-sm font-medium text-primary-700">{selectedMissionIds.size} sélectionnée{selectedMissionIds.size > 1 ? 's' : ''}</span>
            <div className="h-5 w-px bg-blue-200" />
            <button onClick={() => handleBulkExportMissions(missionList)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-3.5 h-3.5" />Exporter
            </button>
            {context === 'a_valider' && (
              <>
                <button onClick={handleBulkApproveMissions} disabled={bulkMissionLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" />Approuver
                </button>
                <button onClick={handleBulkRejectMissions} disabled={bulkMissionLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                  <XCircle className="w-3.5 h-3.5" />Rejeter
                </button>
              </>
            )}
            {context === 'equipe' && (
              <button onClick={() => handleBulkDeleteMissions(missionList)} disabled={bulkMissionLoading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />Supprimer
              </button>
            )}
            <div className="flex-1" />
            <button onClick={() => setSelectedMissionIds(new Set())} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
            {bulkMissionLoading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                {showSelection && (
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={allMissionsSelected} onChange={() => toggleSelectAllMissions(missionList)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                {context !== 'mes_missions' && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                )}
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
              {missionList.map((m) => renderMissionRow(m, context))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  // ============================================
  // RENDER: Tabs
  // ============================================

  const tabs: { id: TabType; label: string; icon: any; badge?: number }[] = [
    { id: 'mes_missions', label: 'Mes missions', icon: Briefcase },
    ...(showValidateTab ? [{
      id: 'a_valider' as TabType,
      label: 'À valider',
      icon: UserCheck,
      badge: stats?.pending_validation || 0,
    }] : []),
    ...(showTeamTab ? [{
      id: 'equipe' as TabType,
      label: canManageAll(role) ? 'Toutes les missions' : 'Missions équipe',
      icon: Users,
    }] : []),
  ];

  const getDisplayMissions = (): Mission[] => {
    switch (activeTab) {
      case 'mes_missions': return missions;
      case 'a_valider': return pendingMissions;
      case 'equipe': return teamMissions;
      default: return missions;
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (!initialized) {
    return (
      <div className="min-h-screen">
        <Header title="Gestion des Missions" subtitle="Ordres de missions & déplacements professionnels" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {showTips && (
        <PageTourTips
          tips={missionsTips}
          onDismiss={dismissTips}
          pageTitle="Missions"
        />
      )}
      
      <Header title="Gestion des Missions" subtitle="Ordres de missions & déplacements professionnels"/>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div data-tour="missions-stats">
          {renderStats()}
        </div>

        <div className="flex items-center gap-1 mb-4 bg-white rounded-xl p-1 border overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedMissionIds(new Set()); }}
              className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id ? 'bg-white text-primary-600' : 'bg-red-500 text-white'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          <button
            data-tour="create-mission"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-primary-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">Nouvelle mission</span>
            <span className="xs:hidden sm:hidden">Nouvelle</span>
          </button>
        </div>

        {activeTab !== 'a_valider' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4" data-tour="missions-filters">
            <div className="relative w-full sm:flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher une mission..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <CustomSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Tous les statuts"
              className="w-full sm:w-auto sm:min-w-[160px]"
              options={[
                { value: '', label: 'Tous les statuts' },
                ...Object.entries(STATUS_CONFIG).map(([key, val]) => ({ value: key, label: val.label })),
              ]}
            />
          </div>
        )}

        <div className="bg-white rounded-xl border overflow-hidden">
          {renderTable(getDisplayMissions(), activeTab)}
        </div>
      </div>

      {/* MODALS */}

      {showCreateModal && (
        <CreateMissionModal
          role={role}
          employeeId={employeeId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchAll();
          }}
        />
      )}

      {showDetailModal && selectedMission && (
        <MissionDetailModal
          mission={selectedMission}
          role={role}
          onClose={() => { setShowDetailModal(false); setSelectedMission(null); }}
        />
      )}

      {showEditModal && selectedMission && (
        <EditMissionModal
          mission={selectedMission}
          onClose={() => { setShowEditModal(false); setSelectedMission(null); }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedMission(null);
            fetchAll();
          }}
        />
      )}

      {showValidateModal && missionToValidate && (
        <ValidateMissionModal
          mission={missionToValidate}
          role={role}
          onClose={() => { setShowValidateModal(false); setMissionToValidate(null); }}
          onSuccess={() => {
            setShowValidateModal(false);
            setMissionToValidate(null);
            fetchAll();
          }}
        />
      )}
      
      {rejectDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Motif de rejet</h2>
            <p className="text-sm text-gray-600 mb-4">Refuser {rejectDialog.pending.length} mission(s)</p>
            <textarea
              value={rejectReasonText}
              onChange={e => setRejectReasonText(e.target.value)}
              placeholder="Motif de rejet obligatoire..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectDialog(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
              <button
                onClick={() => {
                  if (!rejectReasonText.trim()) { toast.error('Motif requis'); return; }
                  const p = rejectDialog.pending;
                  setRejectDialog(null);
                  doRejectMissions(p, rejectReasonText.trim());
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
              >Confirmer le rejet</button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
          danger={confirmDialog.danger}
        />
      )}
    </div>
  );
}

// ============================================
// MODAL: Créer une mission
// ============================================

function CreateMissionModal({ role, employeeId, onClose, onSuccess }: {
  role: string; employeeId: number | null; onClose: () => void; onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    employee_id: employeeId || 0,
    subject: '',
    description: '',
    departure_location: '',
    destination: '',
    destination_country: '',
    trip_type: 'aller_retour',
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
    if (canManageAll(role)) {
      apiFetch('/api/employees/?status=active&page_size=500')
        .then((data) => {
          const emps = data.items || data.employees || data;
          setEmployees(Array.isArray(emps) ? emps : []);
        })
        .catch((err) => console.error('[CreateMission] Erreur employés:', err));
    } else if (role === 'manager') {
      apiFetch(`/api/employees/${employeeId}/direct-reports`)
        .then((data) => {
          const emps = Array.isArray(data) ? data : (data.items || data.employees || []);
          setEmployees(emps);
        })
        .catch(() => {
          apiFetch(`/api/employees/?manager_id=${employeeId}&status=active&page_size=500`)
            .then((data) => {
              const emps = data.items || data.employees || data;
              setEmployees(Array.isArray(emps) ? emps : []);
            })
            .catch(() => {});
        });
    }
  }, [role, employeeId]);

  const handleSubmit = async () => {
    const effectiveEmployeeId = formData.employee_id || employeeId;
    if (!effectiveEmployeeId) {
      toast.error('Employé non identifié. Veuillez rafraîchir la page.');
      return;
    }
    if (!formData.subject || !formData.departure_location || !formData.destination || !formData.start_date || !formData.end_date) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const payload = {
      employee_id: effectiveEmployeeId,
      subject: formData.subject,
      description: formData.description || null,
      departure_location: formData.departure_location,
      destination: formData.destination,
      destination_country: formData.destination_country || null,
      trip_type: formData.trip_type || null,
      start_date: formData.start_date,
      end_date: formData.end_date,
      transport_type: formData.transport_type,
      transport_details: formData.transport_details || null,
      accommodation_type: formData.accommodation_type || null,
      accommodation_details: formData.accommodation_details || null,
      estimated_budget: formData.estimated_budget ? parseFloat(formData.estimated_budget) : null,
      as_draft: formData.as_draft,
    };

    console.log('[CreateMission] Payload envoyé:', payload);

    try {
      setSubmitting(true);
      await apiFetch('/api/missions/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onSuccess();
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const showEmployeeSelect = role === 'manager' || canManageAll(role);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">Nouvelle demande de mission</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {showEmployeeSelect && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employé concerné *
                <span className="text-xs text-gray-400 ml-2">
                  {canManageAll(role) ? '(Tous les employés)' : '(Vos collaborateurs directs)'}
                </span>
              </label>
              <CustomSelect
                value={String(formData.employee_id)}
                onChange={(v) => setFormData({ ...formData, employee_id: parseInt(v) })}
                placeholder="Sélectionner..."
                options={[
                  { value: String(employeeId || 0), label: 'Moi-même' },
                  ...employees.map(emp => ({
                    value: String(emp.id),
                    label: `${emp.first_name} ${emp.last_name}${emp.job_title ? ` — ${emp.job_title}` : ''}${emp.department_name ? ` (${emp.department_name})` : ''}`,
                  })),
                ]}
              />
            </div>
          )}

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pays de destination</label>
            <CountrySelect
              value={formData.destination_country}
              onChange={(val) => setFormData({ ...formData, destination_country: val })}
              placeholder="Sélectionner un pays…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de trajet</label>
            <CustomSelect
              value={formData.trip_type}
              onChange={(v) => setFormData({ ...formData, trip_type: v })}
              placeholder="Type de trajet"
              options={[
                { value: 'aller_retour', label: 'Aller-retour' },
                { value: 'aller_simple', label: 'Aller simple' },
                { value: 'multi_destination', label: 'Multi-destinations' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de départ *</label>
              <CustomDatePicker
                value={formData.start_date}
                onChange={(v) => setFormData({ ...formData, start_date: v })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de retour *</label>
              <CustomDatePicker
                value={formData.end_date}
                onChange={(v) => setFormData({ ...formData, end_date: v })}
                min={formData.start_date || undefined}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moyen de transport *</label>
              <CustomSelect
                value={formData.transport_type}
                onChange={(v) => setFormData({ ...formData, transport_type: v })}
                placeholder="Transport"
                options={[
                  { value: 'avion', label: 'Avion' },
                  { value: 'train', label: 'Train' },
                  { value: 'voiture_personnelle', label: 'Voiture personnelle' },
                  { value: 'voiture_service', label: 'Voiture de service' },
                  { value: 'bus', label: 'Bus' },
                  { value: 'autre', label: 'Autre' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hébergement</label>
              <CustomSelect
                value={formData.accommodation_type}
                onChange={(v) => setFormData({ ...formData, accommodation_type: v })}
                placeholder="-- Choisir --"
                options={[
                  { value: '', label: '-- Choisir --' },
                  { value: 'hotel', label: 'Hôtel' },
                  { value: 'residence', label: 'Résidence' },
                  { value: 'chez_tiers', label: 'Chez un tiers' },
                  { value: 'aucun', label: 'Aucun' },
                  { value: 'autre', label: 'Autre' },
                ]}
              />
            </div>
          </div>

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

        <div className="flex items-center justify-end gap-2 p-3 sm:p-6 border-t sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-600 hover:bg-gray-100 rounded-xl whitespace-nowrap">
            Annuler
          </button>
          <button
            onClick={() => { formData.as_draft = true; handleSubmit(); }}
            className="px-2 sm:px-4 py-2 text-xs sm:text-sm border rounded-xl hover:bg-gray-50 whitespace-nowrap"
            disabled={submitting}
          >
            Brouillon
          </button>
          <button
            onClick={() => { formData.as_draft = false; handleSubmit(); }}
            className="px-2 sm:px-4 py-2 text-xs sm:text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-700 flex items-center gap-1 sm:gap-2 whitespace-nowrap"
            disabled={submitting}
          >
            {submitting && <Loader2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 animate-spin" />}
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
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
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
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Employé</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Nom:</span> <span className="font-medium">{mission.employee_name}</span></div>
              <div><span className="text-gray-500">Matricule:</span> <span className="font-medium">{mission.employee_code || '-'}</span></div>
              <div><span className="text-gray-500">Poste:</span> <span className="font-medium">{mission.employee_job_title || '-'}</span></div>
              <div><span className="text-gray-500">Département:</span> <span className="font-medium">{mission.department_name || '-'}</span></div>
            </div>
          </div>

          {/* Itinéraire + Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-primary-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-primary-700 mb-2 flex items-center gap-2">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Budget & Per Diem */}
          <div className="bg-green-50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Budget & Per Diem
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
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
                    <span>Responsable validé le {formatDate(mission.manager_validated_at)}</span>
                    {mission.manager_comments && <span className="text-gray-500">- {mission.manager_comments}</span>}
                  </div>
                )}
                {mission.rh_validated_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>DRH validé le {formatDate(mission.rh_validated_at)}</span>
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

          {/* Frais */}
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

          {/* Rapport */}
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
      toast.error('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">Modifier - {mission.reference}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objet *</label>
            <input type="text" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" rows={3} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de départ *</label>
              <input type="text" value={formData.departure_location} onChange={(e) => setFormData({ ...formData, departure_location: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input type="text" value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de départ *</label>
              <CustomDatePicker value={formData.start_date} onChange={v => setFormData({ ...formData, start_date: v })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de retour *</label>
              <CustomDatePicker value={formData.end_date} onChange={v => setFormData({ ...formData, end_date: v })} min={formData.start_date} className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transport</label>
              <CustomSelect
                value={formData.transport_type}
                onChange={(v) => setFormData({ ...formData, transport_type: v })}
                placeholder="Transport"
                options={[
                  { value: 'avion', label: 'Avion' },
                  { value: 'train', label: 'Train' },
                  { value: 'voiture_personnelle', label: 'Voiture personnelle' },
                  { value: 'voiture_service', label: 'Voiture de service' },
                  { value: 'bus', label: 'Bus' },
                  { value: 'autre', label: 'Autre' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hébergement</label>
              <CustomSelect
                value={formData.accommodation_type}
                onChange={(v) => setFormData({ ...formData, accommodation_type: v })}
                placeholder="-- Choisir --"
                options={[
                  { value: '', label: '-- Choisir --' },
                  { value: 'hotel', label: 'Hôtel' },
                  { value: 'residence', label: 'Résidence' },
                  { value: 'chez_tiers', label: 'Chez un tiers' },
                  { value: 'aucun', label: 'Aucun' },
                  { value: 'autre', label: 'Autre' },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget estimé (XOF)</label>
            <input type="number" value={formData.estimated_budget} onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-700 flex items-center gap-2" disabled={submitting}>
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
  const [missionDetail, setMissionDetail] = useState<MissionDetail | null>(null);

  useEffect(() => {
    apiFetch(`/api/missions/${mission.id}`)
      .then(setMissionDetail)
      .catch(console.error);
  }, [mission.id]);

  const isRHStep = mission.status === 'en_attente_rh' || (canManageAll(role) && mission.status === 'en_attente_manager');
  const endpoint = isRHStep
    ? `/api/missions/${mission.id}/validate/rh`
    : `/api/missions/${mission.id}/validate/manager`;

  const handleValidate = async (approved: boolean) => {
    if (!approved && !rejectionReason) {
      toast.error('Veuillez indiquer la raison du rejet');
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
      toast.error('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold">Traiter la mission</h2>
            <p className="text-sm text-gray-500">{mission.reference} - {mission.subject}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <p><span className="text-gray-500">Employé:</span> <span className="font-medium">{mission.employee_name}</span></p>
            <p><span className="text-gray-500">Destination:</span> <span className="font-medium">{mission.destination}</span></p>
            <p><span className="text-gray-500">Dates:</span> <span className="font-medium">{formatDate(mission.start_date)} → {formatDate(mission.end_date)} ({mission.duration_days}j)</span></p>
            {missionDetail?.estimated_budget && (
              <p><span className="text-gray-500">Budget estimé:</span> <span className="font-medium">{formatAmount(missionDetail.estimated_budget)}</span></p>
            )}
            {missionDetail?.description && (
              <p className="pt-2 border-t mt-2"><span className="text-gray-500">Description:</span> {missionDetail.description}</p>
            )}
          </div>

          <div className={`p-3 rounded-xl text-sm font-medium ${
            isRHStep ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' : 'bg-orange-50 text-orange-800 border border-orange-200'
          }`}>
            {isRHStep ? '📋 Validation RH - Définissez le per diem et l\'avance' : '👤 Validation Manager - Validez le besoin opérationnel'}
          </div>

          {isRHStep && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per diem journalier (XOF) *</label>
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

        <div className="flex items-center justify-end gap-3 p-6 border-t sticky bottom-0 bg-white rounded-b-2xl">
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
