'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  X, Mail, Phone, MapPin, Calendar, Briefcase, User, FileText,
  GraduationCap, Award, Clock, Palmtree, TrendingUp, Edit2, Download,
  Key, Loader2, CheckCircle, XCircle, Shield, DollarSign, Printer,
  Target, CheckCircle2, Star, MessageSquare, ThumbsUp, ExternalLink,
  BookOpen, AlertTriangle, Plus, Trash2, ChevronDown, ChevronUp, Maximize2, Minimize2, Gift,
  UserMinus, UserCheck
} from 'lucide-react';
import { getEmployeeAccessStatus, activateEmployeeAccess, type AccessStatus } from '@/lib/api';
import EmployeeDocuments from '@/components/EmployeeDocuments';
import ConfirmDialog from '@/components/ConfirmDialog';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ============================================
// TYPES
// ============================================

interface Employee {
  id: number;
  employee_id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  department?: string;
  department_name?: string;
  position?: string;
  job_title?: string;
  location?: string;
  site?: string;
  startDate?: string;
  hire_date?: string;
  status: string;
  manager?: string;
  manager_name?: string;
  gender?: string;
  birthYear?: number;
  date_of_birth?: string;
  isManager?: boolean;
  is_manager?: boolean;
  isTopManager?: boolean;
  onLeave?: boolean;
  role?: string;
  salary?: number;
  net_salary?: number;
  salaire_brut?: number;
  part_variable?: number;
  currency?: string;
  contract_type?: string;
  classification?: string;
  coefficient?: string;
  contract_end_date?: string;
  probation_end_date?: string;
  nationality?: string;
  address?: string;
  photo_url?: string;
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

interface EmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onEdit?: () => void;
  isReadOnly?: boolean;
}

interface LeaveBalanceItem {
  id: number;
  leave_type_name: string;
  leave_type_code: string;
  allocated: number;
  taken: number;
  pending: number;
  carried_over: number;
  available: number;
}

interface LeaveBalanceData {
  employee_id: number;
  year: number;
  balances: LeaveBalanceItem[];
  total_available: number;
  total_taken: number;
  total_pending: number;
}

interface PerformanceScore {
  overall_score: number;
  okr_score: number;
  task_score: number;
  validation_score: number;
  feedback_score: number;
  period: { start: string; end: string };
  weights: Record<string, number>;
  breakdown: Record<string, any>;
}

interface EvaluationItem {
  id: number;
  campaign_name?: string;
  overall_score?: number;
  status: string;
  submitted_at?: string;
  validated_at?: string;
  created_at?: string;
  evaluator_name?: string;
  type?: string;
}

interface FeedbackItem {
  id: number;
  from_employee_name?: string;
  from_employee_initials?: string;
  type: string;
  message: string;
  is_public: boolean;
  likes_count: number;
  created_at: string;
  is_liked_by_me?: boolean;
}

interface TrainingAssignment {
  id: number;
  course_id: number;
  course_title?: string;
  course_image?: string;
  course_duration?: number;
  course_external_url?: string;
  requires_certificate?: boolean;
  status: string;
  deadline?: string;
  assigned_at?: string;
  completed_at?: string;
  completion_note?: string;
  certificate_file?: string;
  certificate_filename?: string;
  rejection_reason?: string;
}

interface EmployeeSkillItem {
  id: number;
  skill_id: number;
  skill_name?: string;
  skill_category?: string;
  current_level: number;
  target_level?: number;
}

interface Sanction {
  id: number;
  type: string;
  date: string;
  reason: string;
  notes?: string;
  issued_by?: string;
}

interface Benefit {
  id: number;
  label: string;
  category: string;
  amount?: number | null;
  currency: string;
  frequency: string;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  notes?: string | null;
  created_by?: string | null;
}

interface SalaryHistoryItem {
  id: number;
  effective_date: string;
  amount: number;
  currency: string;
  previous_amount?: number | null;
  change_percentage?: number | null;
  reason?: string | null;
  created_at?: string | null;
}

// ============================================
// CONSTANTS
// ============================================

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employé', manager: 'Manager', rh: 'RH', admin: 'Administrateur', dg: 'Direction Générale',
};

const LEAVE_COLORS: Record<string, { bg: string; text: string }> = {
  'ANNUAL': { bg: 'bg-green-100', text: 'text-green-700' },
  'annual': { bg: 'bg-green-100', text: 'text-green-700' },
  'RTT': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'rtt': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'SENIORITY': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'seniority': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'SICK': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'sick': { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const FEEDBACK_TYPES: Record<string, { label: string; emoji: string; color: string }> = {
  recognition: { label: 'Reconnaissance', emoji: '🌟', color: 'text-yellow-600' },
  encouragement: { label: 'Encouragement', emoji: '💪', color: 'text-blue-600' },
  constructive: { label: 'Constructif', emoji: '🔧', color: 'text-orange-600' },
  suggestion: { label: 'Suggestion', emoji: '💡', color: 'text-purple-600' },
  gratitude: { label: 'Gratitude', emoji: '🙏', color: 'text-green-600' },
};

const SANCTION_TYPES: Record<string, { icon: string; color: string }> = {
  'Avertissement': { icon: '⚠️', color: 'bg-yellow-100 text-yellow-800' },
  'Blâme': { icon: '📋', color: 'bg-orange-100 text-orange-800' },
  'Mise à pied': { icon: '🚫', color: 'bg-red-100 text-red-800' },
  'Rétrogradation': { icon: '⬇️', color: 'bg-red-100 text-red-800' },
  'Licenciement': { icon: '❌', color: 'bg-red-200 text-red-900' },
  'Rappel à l\'ordre': { icon: '📝', color: 'bg-blue-100 text-blue-800' },
  'Autre': { icon: '📄', color: 'bg-gray-100 text-gray-800' },
};

const CONTRACT_LABELS: Record<string, string> = {
  'cdi': 'CDI', 'CDI': 'CDI', 'cdd': 'CDD', 'CDD': 'CDD',
  'stage': 'Stage', 'STAGE': 'Stage', 'alternance': 'Alternance', 'ALTERNANCE': 'Alternance',
  'consultant': 'Consultant', 'CONSULTANT': 'Consultant', 'interim': 'Intérim', 'INTERIM': 'Intérim',
  'freelance': 'Freelance', 'FREELANCE': 'Freelance',
};

// ============================================
// HELPERS
// ============================================

function getLeaveColor(code: string) {
  return LEAVE_COLORS[code] || { bg: 'bg-gray-100', text: 'text-gray-700' };
}

function calculateSeniority(hireDate: string): { years: number; months: number; text: string } {
  const hire = new Date(hireDate);
  const now = new Date();
  let years = now.getFullYear() - hire.getFullYear();
  let months = now.getMonth() - hire.getMonth();
  if (months < 0) { years--; months += 12; }
  if (now.getDate() < hire.getDate()) { months--; if (months < 0) { years--; months += 12; } }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} an${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mois`);
  if (parts.length === 0) parts.push("Moins d'un mois");
  return { years, months, text: parts.join(' ') };
}

function formatCurrency(amount: number, currency: string = 'XOF'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' ' + currency;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-blue-100';
  if (score >= 40) return 'bg-yellow-100';
  return 'bg-red-100';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Exceptionnel';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Très bien';
  if (score >= 60) return 'Bien';
  if (score >= 50) return 'Satisfaisant';
  if (score >= 40) return 'À améliorer';
  return 'Insuffisant';
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Terminé', cls: 'bg-green-100 text-green-700' },
    validated: { label: 'Validé', cls: 'bg-green-100 text-green-700' },
    submitted: { label: 'Soumis', cls: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'En cours', cls: 'bg-yellow-100 text-yellow-700' },
    pending: { label: 'En attente', cls: 'bg-gray-100 text-gray-600' },
    pending_validation: { label: 'Validation', cls: 'bg-orange-100 text-orange-700' },
    assigned: { label: 'Assigné', cls: 'bg-purple-100 text-purple-700' },
    rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Annulé', cls: 'bg-gray-100 text-gray-500' },
  };
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function EmployeeModal({ employee, onClose, onEdit, isReadOnly = false }: EmployeeModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---- Original states ----
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalanceData | null>(null);
  const [isLoadingLeave, setIsLoadingLeave] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [employeeStatus, setEmployeeStatus] = useState<string>(employee.status || 'active');

  // ---- Performance states ----
  const [perfScore, setPerfScore] = useState<PerformanceScore | null>(null);
  const [perfPeriod, setPerfPeriod] = useState('quarter');
  const [isLoadingPerf, setIsLoadingPerf] = useState(false);
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [isLoadingEvals, setIsLoadingEvals] = useState(false);
  const [showAllEvals, setShowAllEvals] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false);
  const [showAllFeedbacks, setShowAllFeedbacks] = useState(false);

  // ---- Training states ----
  const [trainings, setTrainings] = useState<TrainingAssignment[]>([]);
  const [isLoadingTrainings, setIsLoadingTrainings] = useState(false);
  const [showAllTrainings, setShowAllTrainings] = useState(false);
  const [skills, setSkills] = useState<EmployeeSkillItem[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);

  // ---- Benefits states ----
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [isLoadingBenefits, setIsLoadingBenefits] = useState(false);
  const [showAddBenefit, setShowAddBenefit] = useState(false);
  const [isSavingBenefit, setIsSavingBenefit] = useState(false);
  const [newBenefit, setNewBenefit] = useState({ label: '', category: 'financier', amount: '', currency: 'XOF', frequency: 'mensuel', start_date: '', notes: '' });

  // ---- Sanctions states ----
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [isLoadingSanctions, setIsLoadingSanctions] = useState(false);
  const [showAddSanction, setShowAddSanction] = useState(false);
  const [isSavingSanction, setIsSavingSanction] = useState(false);
  const [newSanction, setNewSanction] = useState({ type: 'Avertissement', date: new Date().toISOString().split('T')[0], reason: '', notes: '' });

  // ---- Salary History states ----
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryItem[]>([]);
  const [isLoadingSalaryHistory, setIsLoadingSalaryHistory] = useState(false);
  const [showAllSalaryHistory, setShowAllSalaryHistory] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    onConfirm: () => void; danger?: boolean;
  } | null>(null);

  // ---- Derived data ----
  const displayName = employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
  const displayPosition = employee.position || employee.job_title || 'Poste non défini';
  const displayDepartment = employee.department || employee.department_name || '-';
  const displayLocation = employee.location || employee.site || '-';
  const displayManager = employee.manager || employee.manager_name || 'Aucun';
  const displayHireDate = employee.startDate || employee.hire_date || '';
  const empIsManager = employee.isManager || employee.is_manager || false;
  const isOnLeave = employee.onLeave || employee.status === 'on_leave';

  let age = 0;
  if (employee.birthYear) { age = new Date().getFullYear() - employee.birthYear; }
  else if (employee.date_of_birth) { age = new Date().getFullYear() - new Date(employee.date_of_birth).getFullYear(); }

  const seniority = displayHireDate ? calculateSeniority(displayHireDate) : null;
  const contractTypeDisplay = CONTRACT_LABELS[employee.contract_type || ''] || employee.contract_type || '-';

  const completedTrainings = trainings.filter(t => t.status === 'completed').length;
  const inProgressTrainings = trainings.filter(t => ['assigned', 'in_progress', 'pending_validation'].includes(t.status)).length;

  // ============================================
  // DATA LOADING
  // ============================================

  async function loadAccessStatus() {
    setIsLoadingAccess(true);
    try { const status = await getEmployeeAccessStatus(employee.id); setAccessStatus(status); }
    catch (err) { console.error('Error loading access status:', err); }
    finally { setIsLoadingAccess(false); }
  }

  async function loadLeaveBalance() {
    setIsLoadingLeave(true);
    try {
      const year = new Date().getFullYear();
      const res = await fetch(`${API_URL}/api/leaves/balance/${employee.id}?year=${year}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const balances = data as LeaveBalanceItem[];
          setLeaveBalance({
            employee_id: employee.id, year, balances,
            total_available: balances.reduce((s, b) => s + (b.available || 0), 0),
            total_taken: balances.reduce((s, b) => s + (b.taken || 0), 0),
            total_pending: balances.reduce((s, b) => s + (b.pending || 0), 0),
          });
        } else if (data.balances) { setLeaveBalance(data); }
      }
    } catch (err) { console.error('Error loading leave balance:', err); }
    finally { setIsLoadingLeave(false); }
  }

  const loadPerformance = useCallback(async () => {
    setIsLoadingPerf(true);
    try {
      const data = await apiFetch(`/api/performance/score/employee/${employee.id}?period=${perfPeriod}`);
      setPerfScore(data);
    } catch { setPerfScore(null); }
    finally { setIsLoadingPerf(false); }
  }, [employee.id, perfPeriod]);

  const loadEvaluations = useCallback(async () => {
    setIsLoadingEvals(true);
    try {
      const data = await apiFetch(`/api/performance/evaluations?employee_id=${employee.id}&page_size=10`);
      setEvaluations(data.items || []);
    } catch { setEvaluations([]); }
    finally { setIsLoadingEvals(false); }
  }, [employee.id]);

  const loadFeedbacks = useCallback(async () => {
    setIsLoadingFeedbacks(true);
    try {
      const data = await apiFetch(`/api/performance/feedbacks?to_employee_id=${employee.id}&page_size=10`);
      setFeedbacks(data.items || []);
    } catch { setFeedbacks([]); }
    finally { setIsLoadingFeedbacks(false); }
  }, [employee.id]);

  const loadTrainings = useCallback(async () => {
    setIsLoadingTrainings(true);
    try {
      const data = await apiFetch(`/api/learning/assignments/?employee_id=${employee.id}&page_size=50`);
      setTrainings(data.items || []);
    } catch { setTrainings([]); }
    finally { setIsLoadingTrainings(false); }
  }, [employee.id]);

  const loadSkills = useCallback(async () => {
    setIsLoadingSkills(true);
    try {
      const data = await apiFetch(`/api/learning/employees/${employee.id}/skills`);
      setSkills(Array.isArray(data) ? data : []);
    } catch { setSkills([]); }
    finally { setIsLoadingSkills(false); }
  }, [employee.id]);

  const loadBenefits = useCallback(async () => {
    setIsLoadingBenefits(true);
    try {
      const data = await apiFetch(`/api/benefits/employee/${employee.id}`);
      setBenefits(Array.isArray(data) ? data : data.items || []);
    } catch { setBenefits([]); }
    finally { setIsLoadingBenefits(false); }
  }, [employee.id]);

  const loadSanctions = useCallback(async () => {
    setIsLoadingSanctions(true);
    try {
      const data = await apiFetch(`/api/employees/${employee.id}/sanctions/`);
      setSanctions(Array.isArray(data) ? data : data.items || []);
    } catch { setSanctions([]); }
    finally { setIsLoadingSanctions(false); }
  }, [employee.id]);

  const loadSalaryHistory = useCallback(async () => {
    setIsLoadingSalaryHistory(true);
    try {
      const data = await apiFetch(`/api/employees/${employee.id}/salary-history`);
      setSalaryHistory(Array.isArray(data) ? data : []);
    } catch { setSalaryHistory([]); }
    finally { setIsLoadingSalaryHistory(false); }
  }, [employee.id]);

  useEffect(() => {
    loadAccessStatus();
    loadLeaveBalance();
    loadPerformance();
    loadEvaluations();
    loadFeedbacks();
    loadTrainings();
    loadSkills();
    loadBenefits();
    loadSanctions();
    loadSalaryHistory();
  }, [employee.id]);

  useEffect(() => { loadPerformance(); }, [perfPeriod, loadPerformance]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (isFullscreen) setIsFullscreen(false); else onClose(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, onClose]);

  // ============================================
  // ACTIONS
  // ============================================

  async function handleActivateAccess() {
    setIsActivating(true); setError('');
    try {
      const result = await activateEmployeeAccess(employee.id, false);
      setTempPassword(result.temp_password);
      setAccessStatus({ has_access: true, user_id: result.user_id, is_active: true, is_verified: false, last_login: null, role: result.role });
    } catch (err) { setError(err instanceof Error ? err.message : "Erreur lors de l'activation"); }
    finally { setIsActivating(false); }
  }

  async function handleToggleStatus() {
    const isActive = employeeStatus === 'active';
    setConfirmDialog({
      isOpen: true,
      title: isActive ? 'Désactiver le collaborateur' : 'Réactiver le collaborateur',
      message: isActive
        ? `Désactiver ${displayName} ? Il n'apparaîtra plus comme actif sur la plateforme.`
        : `Réactiver ${displayName} ? Son profil repassera en statut actif.`,
      danger: isActive,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsTogglingStatus(true);
        try {
          const res = await fetch(`${API_URL}/api/employees/${employee.id}/toggle-status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
          });
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          const data = await res.json();
          setEmployeeStatus(data.status);
          toast.success(data.message);
        } catch {
          toast.error('Erreur lors du changement de statut');
        } finally {
          setIsTogglingStatus(false);
        }
      },
    });
  }

  const handleAddSanction = async () => {
    if (!newSanction.reason.trim()) return;
    setIsSavingSanction(true);
    try {
      const data = await apiFetch(`/api/employees/${employee.id}/sanctions/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSanction),
      });
      setSanctions(prev => [data, ...prev]);
    } catch {
      const localSanction: Sanction = { id: Date.now(), ...newSanction, issued_by: 'Vous' };
      setSanctions(prev => [localSanction, ...prev]);
    } finally {
      setNewSanction({ type: 'Avertissement', date: new Date().toISOString().split('T')[0], reason: '', notes: '' });
      setShowAddSanction(false);
      setIsSavingSanction(false);
    }
  };

  const handleDeleteSanction = async (sanctionId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Supprimer la sanction',
      message: 'Voulez-vous vraiment supprimer cette sanction ?',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try { await apiFetch(`/api/employees/${employee.id}/sanctions/${sanctionId}/`, { method: 'DELETE' }); } catch {}
        setSanctions(prev => prev.filter(s => s.id !== sanctionId));
      },
    });
  };

  function handleExportPDF() {
    setIsExporting(true);
    try {
      const hireFmt = displayHireDate ? new Date(displayHireDate).toLocaleDateString('fr-FR') : '-';
      const senText = seniority?.text || '-';
      const genderText = employee.gender === 'female' || employee.gender === 'F' ? 'Femme' : 'Homme';

      const leaveRows = leaveBalance?.balances?.map(b => `
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">${b.leave_type_name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${b.allocated}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${b.taken}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${b.pending}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">${b.available}</td></tr>
      `).join('') || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#999;">Aucun solde configuré</td></tr>';

      const trainingsRows = trainings.length > 0 ? trainings.map(t => `
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">${t.course_image || '📚'} ${t.course_title || 'Formation #' + t.course_id}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${t.course_duration ? t.course_duration + 'h' : '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${t.status === 'completed' ? '✅ Terminé' : t.status === 'in_progress' ? '⏳ En cours' : t.status === 'assigned' ? '📋 Assigné' : t.status}</td></tr>
      `).join('') : '<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;">Aucune formation</td></tr>';

      const perfSection = perfScore ? `
        <div class="section"><h2>📊 Performance (${perfPeriod})</h2><div class="grid">
        <div class="field"><div class="label">Score global</div><div class="value" style="font-size:20px;">${Math.round(perfScore.overall_score)}%</div></div>
        <div class="field"><div class="label">OKRs (40%)</div><div class="value">${Math.round(perfScore.okr_score)}%</div></div>
        <div class="field"><div class="label">Tâches (25%)</div><div class="value">${Math.round(perfScore.task_score)}%</div></div>
        <div class="field"><div class="label">Feedbacks (15%)</div><div class="value">${Math.round(perfScore.feedback_score)}%</div></div>
        </div></div>` : '';

      const sanctionsRows = sanctions.length > 0 ? sanctions.map(s => `
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">${s.type}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${new Date(s.date).toLocaleDateString('fr-FR')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${s.reason}</td></tr>
      `).join('') : '';

      const salaryHistoryRows = salaryHistory.length > 0 ? salaryHistory.map(sh => `
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">${new Date(sh.effective_date).toLocaleDateString('fr-FR')}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${formatCurrency(sh.amount, sh.currency)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${sh.change_percentage ? (sh.change_percentage > 0 ? '+' : '') + sh.change_percentage.toFixed(1) + '%' : '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${sh.reason || '—'}</td></tr>
      `).join('') : '';

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dossier - ${displayName}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:40px;color:#333}
.header{background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white;padding:30px;border-radius:12px;margin-bottom:30px}
.header h1{margin:0 0 5px 0;font-size:24px}.header p{margin:0;opacity:0.9}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;background:rgba(255,255,255,0.2);margin-top:8px}
.section{margin-bottom:25px}.section h2{font-size:16px;color:#4F46E5;border-bottom:2px solid #E5E7EB;padding-bottom:8px;margin-bottom:15px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.field{margin-bottom:10px}.field .label{font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px}
.field .value{font-size:14px;font-weight:500;margin-top:2px}
table{width:100%;border-collapse:collapse}th{background:#F9FAFB;padding:10px 8px;text-align:left;font-size:12px;color:#6B7280;text-transform:uppercase;border-bottom:2px solid #E5E7EB}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;text-align:center}
@media print{body{padding:20px}.header{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head>
<body>
<div class="header"><h1>${displayName}</h1><p>${displayPosition} — ${displayDepartment}</p>
<span class="badge">${employee.status === 'active' ? 'Actif' : employee.status}</span>
${empIsManager ? '<span class="badge" style="margin-left:8px;">Manager</span>' : ''}</div>

<div class="section"><h2>📋 Informations Personnelles</h2><div class="grid">
<div class="field"><div class="label">Email</div><div class="value">${employee.email}</div></div>
<div class="field"><div class="label">Téléphone</div><div class="value">${employee.phone || '-'}</div></div>
<div class="field"><div class="label">Localisation</div><div class="value">${displayLocation}</div></div>
<div class="field"><div class="label">Genre</div><div class="value">${genderText}</div></div>
${age > 0 ? `<div class="field"><div class="label">Âge</div><div class="value">${age} ans</div></div>` : ''}
</div></div>

<div class="section"><h2>💼 Poste & Organisation</h2><div class="grid">
<div class="field"><div class="label">Poste</div><div class="value">${displayPosition}</div></div>
<div class="field"><div class="label">Département</div><div class="value">${displayDepartment}</div></div>
<div class="field"><div class="label">Manager</div><div class="value">${displayManager}</div></div>
<div class="field"><div class="label">Site</div><div class="value">${displayLocation}</div></div>
</div></div>

<div class="section"><h2>📄 Contrat</h2><div class="grid">
<div class="field"><div class="label">Type de contrat</div><div class="value">${contractTypeDisplay}</div></div>
<div class="field"><div class="label">Date d'entrée</div><div class="value">${hireFmt}</div></div>
${employee.classification ? `<div class="field"><div class="label">Classification</div><div class="value">${employee.classification}</div></div>` : ''}
${employee.coefficient ? `<div class="field"><div class="label">Coefficient</div><div class="value">${employee.coefficient}</div></div>` : ''}
<div class="field"><div class="label">Ancienneté</div><div class="value">${senText}</div></div>
${employee.salary ? `<div class="field"><div class="label">Salaire brut mensuel</div><div class="value">${formatCurrency(employee.salary, employee.currency || 'XOF')}</div></div>` : ''}
</div></div>

${salaryHistory.length > 0 ? `<div class="section"><h2>💰 Historique Salarial</h2>
<table><thead><tr><th>Date</th><th style="text-align:right;">Montant</th><th style="text-align:center;">Variation</th><th>Motif</th></tr></thead>
<tbody>${salaryHistoryRows}</tbody></table></div>` : ''}

${perfSection}

<div class="section"><h2>🌴 Solde de Congés ${leaveBalance?.year || new Date().getFullYear()}</h2>
<table><thead><tr><th>Type</th><th style="text-align:center;">Alloués</th><th style="text-align:center;">Pris</th><th style="text-align:center;">En attente</th><th style="text-align:center;">Disponibles</th></tr></thead>
<tbody>${leaveRows}</tbody></table></div>

<div class="section"><h2>🎓 Formations</h2>
<table><thead><tr><th>Formation</th><th style="text-align:center;">Durée</th><th style="text-align:center;">Statut</th></tr></thead>
<tbody>${trainingsRows}</tbody></table></div>

${sanctions.length > 0 ? `<div class="section"><h2>⚠️ Sanctions Disciplinaires</h2>
<table><thead><tr><th>Type</th><th>Date</th><th>Motif</th></tr></thead>
<tbody>${sanctionsRows}</tbody></table></div>` : ''}

<div class="footer">Dossier employé exporté depuis TARGETYM AI — ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
</body></html>`;

      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
    } catch (err) { console.error('Export error:', err); }
    finally { setIsExporting(false); }
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white flex flex-col transition-all duration-300 ${
        isFullscreen
          ? 'w-full h-full max-w-full max-h-full rounded-none'
          : 'w-full max-w-5xl max-h-[90vh] rounded-2xl'
      } overflow-hidden`}>

        {/* ==================== HEADER ==================== */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-primary-500 to-primary-600">
          <div className="flex items-center">
            <div className="w-16 h-16 rounded-full overflow-hidden mr-4 flex-shrink-0">
              {employee.photo_url ? (
                <img src={employee.photo_url} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center text-white text-xl font-bold">
                  {displayName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
              )}
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{displayName}</h2>
              <p className="text-primary-100">{displayPosition}</p>
              {employee.employee_id && <p className="text-white/70 text-xs mt-0.5">Matricule : {employee.employee_id}</p>}
              <div className="flex items-center gap-2 mt-1">
                {isOnLeave ? (
                  <span className="px-2 py-0.5 bg-green-400/30 text-white text-xs rounded-full">En congés</span>
                ) : (
                  <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full">
                    {employeeStatus === 'active' ? 'Actif' : employeeStatus === 'inactive' ? 'Inactif' : employeeStatus}
                  </span>
                )}
                {employee.role && (
                  <span className="px-2 py-0.5 bg-purple-400/30 text-white text-xs rounded-full">
                    {ROLE_LABELS[employee.role] || employee.role}
                  </span>
                )}
                {empIsManager && (
                  <span className="px-2 py-0.5 bg-yellow-400/30 text-white text-xs rounded-full">Manager</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button onClick={onEdit} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg" title="Modifier">
                <Edit2 className="w-5 h-5" />
              </button>
            )}
            {!isReadOnly && <button
              onClick={handleToggleStatus}
              disabled={isTogglingStatus}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
              title={employeeStatus === 'active' ? 'Désactiver le collaborateur' : 'Réactiver le collaborateur'}
            >
              {isTogglingStatus
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : employeeStatus === 'active'
                  ? <UserMinus className="w-5 h-5" />
                  : <UserCheck className="w-5 h-5" />
              }
            </button>}
            <button onClick={handleExportPDF} disabled={isExporting} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg" title="Télécharger le dossier">
              {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg" title={isFullscreen ? 'Réduire' : 'Plein écran'}>
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================== CONTENT ==================== */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Temp password alert */}
          {tempPassword && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <Key className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Compte créé avec succès !</p>
                  <p className="text-sm text-yellow-700 mt-1">Mot de passe temporaire :</p>
                  <p className="font-mono text-lg font-bold text-yellow-900 select-all mt-1">{tempPassword}</p>
                  <p className="text-xs text-yellow-600 mt-2">⚠️ Notez ce mot de passe et communiquez-le à l&apos;employé. Il ne sera plus affiché.</p>
                </div>
              </div>
            </div>
          )}

          {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          {/* ==================== 3-COLUMN GRID ==================== */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* ──────── Colonne 1 ──────── */}
            <div className="space-y-6">
              {/* Accès plateforme */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="w-4 h-4 mr-2 text-primary-500" />Accès Plateforme
                </h3>
                {isLoadingAccess ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : accessStatus?.has_access ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Statut</span>
                      {accessStatus.is_active ? (
                        <span className="flex items-center text-sm text-green-600"><CheckCircle className="w-4 h-4 mr-1" />Actif</span>
                      ) : (
                        <span className="flex items-center text-sm text-red-600"><XCircle className="w-4 h-4 mr-1" />Désactivé</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Vérifié</span>
                      <span className="text-sm text-gray-900">{accessStatus.is_verified ? 'Oui' : 'Non (mot de passe temporaire)'}</span>
                    </div>
                    {accessStatus.last_login && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Dernière connexion</span>
                        <span className="text-sm text-gray-900">{new Date(accessStatus.last_login).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">Aucun compte d&apos;accès</p>
                    {!isReadOnly && <button onClick={handleActivateAccess} disabled={isActivating}
                      className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center mx-auto">
                      {isActivating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                      Activer l&apos;accès
                    </button>}
                  </div>
                )}
              </div>

              {/* Infos personnelles */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-4 h-4 mr-2 text-primary-500" />Informations Personnelles
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center text-sm"><Mail className="w-4 h-4 mr-3 text-gray-400" /><span className="text-gray-600">{employee.email}</span></div>
                  <div className="flex items-center text-sm"><Phone className="w-4 h-4 mr-3 text-gray-400" /><span className="text-gray-600">{employee.phone || '-'}</span></div>
                  <div className="flex items-center text-sm"><MapPin className="w-4 h-4 mr-3 text-gray-400" /><span className="text-gray-600">{displayLocation}</span></div>
                  {age > 0 && <div className="flex items-center text-sm"><Calendar className="w-4 h-4 mr-3 text-gray-400" /><span className="text-gray-600">{age} ans</span></div>}
                  <div className="flex items-center text-sm">
                    <span className="w-4 h-4 mr-3 text-gray-400 text-center">{employee.gender === 'female' || employee.gender === 'F' ? '♀' : '♂'}</span>
                    <span className="text-gray-600">{employee.gender === 'female' || employee.gender === 'F' ? 'Femme' : 'Homme'}</span>
                  </div>
                  {employee.nationality && (
                    <div className="flex items-center text-sm"><span className="w-4 h-4 mr-3 text-gray-400 text-center">🌍</span><span className="text-gray-600">{employee.nationality}</span></div>
                  )}
                  {employee.address && (
                    <div className="flex items-start text-sm"><MapPin className="w-4 h-4 mr-3 mt-0.5 text-gray-400 shrink-0" /><span className="text-gray-600">{employee.address}</span></div>
                  )}
                  {(employee.work_email || employee.work_phone) && (
                    <div className="border-t border-gray-200 pt-3 mt-1 space-y-2">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Coordonnées pro</p>
                      {employee.work_email && <div className="flex items-center text-sm"><Mail className="w-4 h-4 mr-3 text-primary-400" /><span className="text-gray-600">{employee.work_email}</span></div>}
                      {employee.work_phone && <div className="flex items-center text-sm"><Phone className="w-4 h-4 mr-3 text-primary-400" /><span className="text-gray-600">{employee.work_phone}</span></div>}
                    </div>
                  )}
                </div>
              </div>

              {/* Info Familiale */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-4 h-4 mr-2 text-center">👨‍👩‍👧</span>Informations Familiales
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Situation</span><span className="text-sm font-medium text-gray-900 capitalize">{employee.marital_status || '-'}</span></div>
                  {employee.spouse_name && (
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Conjoint(e)</span><span className="text-sm font-medium text-gray-900">{employee.spouse_name}</span></div>
                  )}
                  {employee.spouse_birth_date && (
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Naissance conjoint(e)</span><span className="text-sm font-medium text-gray-900">{new Date(employee.spouse_birth_date).toLocaleDateString('fr-FR')}</span></div>
                  )}
                </div>
              </div>

              {/* Info Médicale & Urgence */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="w-4 h-4 mr-2 text-center">🏥</span>Information Médicale
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Situation de handicap</span>
                    <span className="text-sm font-medium text-gray-900">{employee.has_disability ? 'Oui' : 'Non'}</span>
                  </div>
                  {employee.has_disability && employee.disability_description && (
                    <p className="text-sm text-gray-600">{employee.disability_description}</p>
                  )}
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Contact d&apos;urgence</p>
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Nom</span><span className="text-sm font-medium text-gray-900">{employee.emergency_contact_name || '-'}</span></div>
                    {employee.emergency_contact_phone && <div className="flex justify-between mt-1"><span className="text-sm text-gray-500">Téléphone</span><span className="text-sm font-medium text-gray-900">{employee.emergency_contact_phone}</span></div>}
                  </div>
                </div>
              </div>

              {/* Poste & Organisation */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Briefcase className="w-4 h-4 mr-2 text-primary-500" />Poste & Organisation
                </h3>
                <div className="space-y-3">
                  {employee.employee_id && <div><p className="text-xs text-gray-500">Matricule</p><p className="text-sm font-medium text-gray-900">{employee.employee_id}</p></div>}
                  <div><p className="text-xs text-gray-500">Poste</p><p className="text-sm font-medium text-gray-900">{displayPosition}</p></div>
                  <div><p className="text-xs text-gray-500">Département</p><p className="text-sm font-medium text-gray-900">{displayDepartment}</p></div>
                  <div><p className="text-xs text-gray-500">Manager</p><p className="text-sm font-medium text-gray-900">{displayManager}</p></div>
                  <div><p className="text-xs text-gray-500">Site</p><p className="text-sm font-medium text-gray-900">{displayLocation}</p></div>
                  <div><p className="text-xs text-gray-500">Membre COMEX</p><p className="text-sm font-medium text-gray-900">{employee.comex_member || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">HRBP</p><p className="text-sm font-medium text-gray-900">{employee.hrbp || '-'}</p></div>
                  <div><p className="text-xs text-gray-500">Catégorie salariale</p><p className="text-sm font-medium text-gray-900">{employee.salary_category || '-'}</p></div>
                </div>
              </div>
            </div>

            {/* ──────── Colonne 2 ──────── */}
            <div className="space-y-6">
              {/* Contrat */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-primary-500" />Contrat
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Type</span><span className="text-sm font-medium text-gray-900">{contractTypeDisplay}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Date d&apos;entrée</span><span className="text-sm font-medium text-gray-900">{displayHireDate ? new Date(displayHireDate).toLocaleDateString('fr-FR') : '-'}</span></div>
                  {(employee as any).contract_end_date && <div className="flex justify-between"><span className="text-sm text-gray-500">Fin de contrat</span><span className="text-sm font-medium text-gray-900">{new Date((employee as any).contract_end_date).toLocaleDateString('fr-FR')}</span></div>}
                  {(employee as any).probation_end_date && <div className="flex justify-between"><span className="text-sm text-gray-500">Fin période d&apos;essai</span><span className="text-sm font-medium text-gray-900">{new Date((employee as any).probation_end_date).toLocaleDateString('fr-FR')}</span></div>}
                  {employee.classification && <div className="flex justify-between"><span className="text-sm text-gray-500">Classification</span><span className="text-sm font-medium text-gray-900">{employee.classification}</span></div>}
                  {employee.coefficient && <div className="flex justify-between"><span className="text-sm text-gray-500">Coefficient</span><span className="text-sm font-medium text-gray-900">{employee.coefficient}</span></div>}
                </div>
              </div>

              {/* Rémunération */}
              {(employee.salaire_brut != null || employee.net_salary != null || employee.part_variable != null || (employee.salary != null && employee.salary > 0)) && (
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-primary-500" />Rémunération
                  </h3>
                  <div className="space-y-2">
                    {employee.salaire_brut != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Salaire brut mensuel</span>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(employee.salaire_brut, employee.currency || 'XOF')}</span>
                      </div>
                    )}
                    {employee.net_salary != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Salaire net mensuel</span>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(employee.net_salary, employee.currency || 'XOF')}</span>
                      </div>
                    )}
                    {employee.part_variable != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Part variable</span>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(employee.part_variable, employee.currency || 'XOF')}</span>
                      </div>
                    )}
                    {employee.salary != null && employee.salary > 0 && employee.salaire_brut == null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Salaire brut mensuel</span>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(employee.salary, employee.currency || 'XOF')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ====== NEW: Historique Salarial ====== */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-green-500" />Historique Salarial
                  {salaryHistory.length > 0 && (
                    <span className="ml-auto text-xs text-gray-400 font-normal">{salaryHistory.length} entrée(s)</span>
                  )}
                </h3>
                {isLoadingSalaryHistory ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : salaryHistory.length > 0 ? (
                  <div className="space-y-2">
                    {(showAllSalaryHistory ? [...salaryHistory].reverse() : [...salaryHistory].reverse().slice(0, 4)).map((sh, idx) => {
                      const isLatest = idx === 0;
                      return (
                        <div key={sh.id} className={`p-3 rounded-lg border ${isLatest ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">{formatDateShort(sh.effective_date)}</span>
                            {sh.change_percentage != null && sh.change_percentage !== 0 && (
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                sh.change_percentage > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {sh.change_percentage > 0 ? '+' : ''}{sh.change_percentage.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(sh.amount, sh.currency)}</span>
                            {sh.reason && <span className="text-xs text-gray-400 truncate ml-2">{sh.reason}</span>}
                          </div>
                          {sh.previous_amount != null && (
                            <p className="text-xs text-gray-400 mt-0.5">Avant: {formatCurrency(sh.previous_amount, sh.currency)}</p>
                          )}
                        </div>
                      );
                    })}
                    {salaryHistory.length > 4 && (
                      <ToggleButton
                        expanded={showAllSalaryHistory}
                        remaining={salaryHistory.length - 4}
                        onToggle={() => setShowAllSalaryHistory(!showAllSalaryHistory)}
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-3">Aucun historique salarial</p>
                )}
              </div>

              {/* Solde de Congés */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <Palmtree className="w-4 h-4 mr-2 text-green-500" />Solde de Congés
                </h3>
                {isLoadingLeave ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : leaveBalance && leaveBalance.balances.length > 0 ? (
                  <div className="space-y-3">
                    {leaveBalance.balances.map((b) => {
                      const c = getLeaveColor(b.leave_type_code);
                      return (
                        <div key={b.id} className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">{b.leave_type_name}</span>
                          <span className={`px-2 py-1 ${c.bg} ${c.text} text-sm font-medium rounded-lg`}>{b.available} jours</span>
                        </div>
                      );
                    })}
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Pris cette année</span>
                        <span className="text-sm font-medium text-gray-900">{leaveBalance.total_taken} jours</span>
                      </div>
                      {leaveBalance.total_pending > 0 && (
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-500">En attente</span>
                          <span className="text-sm font-medium text-yellow-600">{leaveBalance.total_pending} jours</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-sm text-gray-400">Aucun solde configuré</p>
                    <p className="text-xs text-gray-400 mt-1">Initialisez les soldes dans le module Congés</p>
                  </div>
                )}
              </div>

              {/* Ancienneté */}
              {seniority && (
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-primary-600">Ancienneté</p><p className="text-2xl font-bold text-primary-700">{seniority.text}</p></div>
                    <Clock className="w-10 h-10 text-primary-300" />
                  </div>
                </div>
              )}
            </div>

            {/* ──────── Colonne 3 ──────── */}
            <div className="space-y-6">
              <EmployeeDocuments employeeId={employee.id} employeeName={displayName} readOnly={false} />

              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center justify-between">
                  <span className="flex items-center">
                    <BookOpen className="w-4 h-4 mr-2 text-primary-500" />Compétences
                  </span>
                  {skills.length > 0 && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      Math.round(skills.reduce((a,s)=>a+s.current_level,0)/skills.length) >= 70
                        ? 'bg-green-100 text-green-700'
                        : Math.round(skills.reduce((a,s)=>a+s.current_level,0)/skills.length) >= 40
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      Score global : {Math.round(skills.reduce((a,s)=>a+s.current_level,0)/skills.length)}%
                    </span>
                  )}
                </h3>
                {isLoadingSkills ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : skills.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {skills.map(s => (
                        <div key={s.id}>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-700">{s.skill_name}</span>
                            <span className="text-xs font-medium text-gray-500">{s.current_level}{s.target_level ? `/${s.target_level}` : '%'}</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${Math.min(s.current_level, 100)}%`,
                              backgroundColor: s.current_level >= 70 ? '#22c55e' : s.current_level >= 40 ? '#f59e0b' : '#ef4444'
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Recommandation IA */}
                    {(() => {
                      const weak = skills.filter(s => s.current_level < 50).sort((a,b) => a.current_level - b.current_level);
                      if (weak.length === 0) return (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-start gap-2">
                          <span>✅</span>
                          <span>Toutes les compétences sont à un niveau satisfaisant. Continuez à maintenir ce niveau.</span>
                        </div>
                      );
                      return (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                          <p className="font-semibold mb-1">💡 Recommandation IA</p>
                          <p>
                            {weak.length === 1
                              ? `La compétence "${weak[0].skill_name}" (${weak[0].current_level}%) nécessite un renforcement prioritaire.`
                              : `${weak.length} compétences à renforcer en priorité : ${weak.slice(0,3).map(s=>`"${s.skill_name}" (${s.current_level}%)`).join(', ')}${weak.length > 3 ? '...' : '.'}`
                            }
                          </p>
                          <p className="mt-1 text-amber-700">Consultez le module Learning & Development pour les formations disponibles.</p>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-3">Aucune compétence évaluée</p>
                )}
              </div>
            </div>
          </div>

          {/* ==================== FULL-WIDTH SECTIONS ==================== */}
          <div className="mt-6 space-y-6">

            {/* PERFORMANCE SCORE */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-primary-500" />Score de Performance
                </h3>
                <select value={perfPeriod} onChange={e => setPerfPeriod(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-primary-500 outline-none">
                  <option value="month">Ce mois</option>
                  <option value="quarter">Ce trimestre</option>
                  <option value="year">Cette année</option>
                  <option value="last_quarter">Trim. précédent</option>
                  <option value="last_month">Mois précédent</option>
                </select>
              </div>
              {isLoadingPerf ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : perfScore ? (
                <div className="grid grid-cols-5 gap-3">
                  <div className={`p-4 rounded-xl text-center ${getScoreBg(perfScore.overall_score)}`}>
                    <div className={`text-2xl font-bold ${getScoreColor(perfScore.overall_score)}`}>{Math.round(perfScore.overall_score)}%</div>
                    <div className={`text-xs font-medium mt-1 ${getScoreColor(perfScore.overall_score)}`}>{getScoreLabel(perfScore.overall_score)}</div>
                  </div>
                  <div className="col-span-4 grid grid-cols-4 gap-2">
                    <ScoreCard label="OKRs" value={perfScore.okr_score} weight="40%" icon={<Target className="w-3.5 h-3.5" />} />
                    <ScoreCard label="Tâches" value={perfScore.task_score} weight="25%" icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
                    <ScoreCard label="Validations" value={perfScore.validation_score} weight="20%" icon={<Clock className="w-3.5 h-3.5" />} />
                    <ScoreCard label="Feedbacks" value={perfScore.feedback_score} weight="15%" icon={<Star className="w-3.5 h-3.5" />} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-3">Aucun score de performance disponible pour cette période.</p>
              )}
            </div>

            {/* ÉVALUATIONS */}
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Award className="w-4 h-4 mr-2 text-primary-500" />Évaluations
                {evaluations.length > 0 && <span className="ml-auto text-xs text-gray-400 font-normal">{evaluations.length} évaluation(s)</span>}
              </h3>
              {isLoadingEvals ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : evaluations.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {(showAllEvals ? evaluations : evaluations.slice(0, 3)).map(ev => (
                      <div key={ev.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{ev.campaign_name || `Évaluation #${ev.id}`}</p>
                          <p className="text-xs text-gray-500">{ev.evaluator_name && `Par ${ev.evaluator_name} · `}{formatDate(ev.submitted_at || ev.validated_at || ev.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {ev.overall_score != null && <span className={`text-sm font-bold ${getScoreColor(ev.overall_score * 20)}`}>{ev.overall_score}/5</span>}
                          {getStatusBadge(ev.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {evaluations.length > 3 && <ToggleButton expanded={showAllEvals} remaining={evaluations.length - 3} onToggle={() => setShowAllEvals(!showAllEvals)} />}
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-3">Aucune évaluation trouvée.</p>
              )}
            </div>

            {/* FEEDBACKS REÇUS */}
            {(isLoadingFeedbacks || feedbacks.length > 0) && (
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2 text-primary-500" />Feedbacks reçus
                  {feedbacks.length > 0 && <span className="ml-auto text-xs text-gray-400 font-normal">{feedbacks.length}</span>}
                </h3>
                {isLoadingFeedbacks ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {(showAllFeedbacks ? feedbacks : feedbacks.slice(0, 3)).map(fb => {
                        const fbType = FEEDBACK_TYPES[fb.type] || { label: fb.type, emoji: '💬', color: 'text-gray-600' };
                        return (
                          <div key={fb.id} className="p-3 bg-white rounded-lg border border-gray-100">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{fbType.emoji}</span>
                                <span className="text-xs font-medium text-gray-500">{fb.from_employee_name || 'Anonyme'}</span>
                                <span className={`text-xs ${fbType.color}`}>{fbType.label}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                {fb.likes_count > 0 && <span className="flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" /> {fb.likes_count}</span>}
                                {formatDate(fb.created_at)}
                              </div>
                            </div>
                            <p className="text-sm text-gray-700">{fb.message}</p>
                          </div>
                        );
                      })}
                    </div>
                    {feedbacks.length > 3 && <ToggleButton expanded={showAllFeedbacks} remaining={feedbacks.length - 3} onToggle={() => setShowAllFeedbacks(!showAllFeedbacks)} />}
                  </>
                )}
              </div>
            )}

            {/* FORMATIONS */}
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <GraduationCap className="w-4 h-4 mr-2 text-primary-500" />Formations
                {trainings.length > 0 && (
                  <span className="ml-auto flex items-center gap-3 text-xs font-normal">
                    <span className="text-green-600">✓ {completedTrainings} terminée(s)</span>
                    {inProgressTrainings > 0 && <span className="text-yellow-600">⏳ {inProgressTrainings} en cours</span>}
                  </span>
                )}
              </h3>
              {isLoadingTrainings ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : trainings.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {(showAllTrainings ? trainings : trainings.slice(0, 4)).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 group">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-lg flex-shrink-0">{t.course_image || '📚'}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{t.course_title || `Formation #${t.course_id}`}</p>
                            <p className="text-xs text-gray-500">
                              {t.course_duration && `${t.course_duration}h`}
                              {t.deadline && ` · Échéance: ${formatDate(t.deadline)}`}
                              {t.completed_at && ` · Terminé le ${formatDate(t.completed_at)}`}
                              {t.rejection_reason && <span className="text-red-500"> · Rejeté: {t.rejection_reason}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {t.requires_certificate && <span className="text-xs text-gray-400" title="Certificat requis">📎</span>}
                          {t.course_external_url && (
                            <a href={t.course_external_url} target="_blank" rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-600 transition-opacity" title="Ouvrir">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {getStatusBadge(t.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {trainings.length > 4 && <ToggleButton expanded={showAllTrainings} remaining={trainings.length - 4} onToggle={() => setShowAllTrainings(!showAllTrainings)} />}
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-3">Aucune formation assignée.</p>
              )}
            </div>

            {/* AVANTAGES EMPLOYÉ */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <Gift className="w-4 h-4 mr-2 text-emerald-500" />Avantages
                  {benefits.length > 0 && <span className="ml-2 bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">{benefits.length}</span>}
                </h3>
                {!isReadOnly && <button onClick={() => setShowAddBenefit(!showAddBenefit)} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>}
              </div>

              {showAddBenefit && (
                <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Intitulé *</label>
                    <input type="text" value={newBenefit.label} onChange={e => setNewBenefit(p => ({ ...p, label: e.target.value }))}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                      placeholder="Ex : Prime de transport, Voiture de fonction…" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
                      <select value={newBenefit.category} onChange={e => setNewBenefit(p => ({ ...p, category: e.target.value }))}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none">
                        <option value="financier">Financier</option>
                        <option value="nature">En nature</option>
                        <option value="sante">Santé</option>
                        <option value="retraite">Retraite</option>
                        <option value="transport">Transport</option>
                        <option value="repas">Repas</option>
                        <option value="formation">Formation</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Périodicité</label>
                      <select value={newBenefit.frequency} onChange={e => setNewBenefit(p => ({ ...p, frequency: e.target.value }))}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none">
                        <option value="mensuel">Mensuel</option>
                        <option value="trimestriel">Trimestriel</option>
                        <option value="semestriel">Semestriel</option>
                        <option value="annuel">Annuel</option>
                        <option value="unique">Versement unique</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Montant (optionnel)</label>
                      <input type="number" value={newBenefit.amount} onChange={e => setNewBenefit(p => ({ ...p, amount: e.target.value }))}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                        placeholder="0" min="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Devise</label>
                      <select value={newBenefit.currency} onChange={e => setNewBenefit(p => ({ ...p, currency: e.target.value }))}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none">
                        <option value="XOF">XOF (FCFA)</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GNF">GNF</option>
                        <option value="XAF">XAF</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date de début</label>
                    <input type="date" value={newBenefit.start_date} onChange={e => setNewBenefit(p => ({ ...p, start_date: e.target.value }))}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                    <input type="text" value={newBenefit.notes} onChange={e => setNewBenefit(p => ({ ...p, notes: e.target.value }))}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                      placeholder="Observations complémentaires…" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAddBenefit(false)} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300">Annuler</button>
                    <button
                      onClick={async () => {
                        if (!newBenefit.label.trim()) return;
                        setIsSavingBenefit(true);
                        try {
                          const payload = {
                            employee_id: employee.id,
                            label: newBenefit.label.trim(),
                            category: newBenefit.category,
                            amount: newBenefit.amount ? parseFloat(newBenefit.amount) : null,
                            currency: newBenefit.currency,
                            frequency: newBenefit.frequency,
                            start_date: newBenefit.start_date || null,
                            notes: newBenefit.notes || null,
                          };
                          const data = await apiFetch('/api/benefits', { method: 'POST', body: JSON.stringify(payload) });
                          setBenefits(prev => [data, ...prev]);
                          setShowAddBenefit(false);
                          setNewBenefit({ label: '', category: 'financier', amount: '', currency: 'XOF', frequency: 'mensuel', start_date: '', notes: '' });
                        } catch { /* silent */ }
                        finally { setIsSavingBenefit(false); }
                      }}
                      disabled={!newBenefit.label.trim() || isSavingBenefit}
                      className="px-3 py-1.5 text-xs text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-1">
                      {isSavingBenefit && <Loader2 className="w-3 h-3 animate-spin" />}Enregistrer
                    </button>
                  </div>
                </div>
              )}

              {isLoadingBenefits ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : benefits.length > 0 ? (
                <div className="space-y-2">
                  {benefits.map(b => (
                    <div key={b.id} className="group flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-emerald-200 transition-colors">
                      <Gift className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-medium text-gray-800">{b.label}</span>
                          <span className="px-1.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">{b.category}</span>
                          <span className="text-xs text-gray-400">{b.frequency}</span>
                          {b.status !== 'actif' && <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">{b.status}</span>}
                        </div>
                        {b.amount != null && (
                          <p className="text-xs text-gray-600">{b.amount.toLocaleString('fr-FR')} {b.currency}</p>
                        )}
                        {b.notes && <p className="text-xs text-gray-400 mt-0.5">{b.notes}</p>}
                        {b.start_date && <p className="text-xs text-gray-400">Depuis le {formatDate(b.start_date)}</p>}
                      </div>
                      <button
                        onClick={async () => {
                          try { await apiFetch(`/api/benefits/${b.id}`, { method: 'DELETE' }); } catch {}
                          setBenefits(prev => prev.filter(x => x.id !== b.id));
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : !showAddBenefit ? (
                <p className="text-sm text-gray-400 text-center py-3">Aucun avantage enregistré.</p>
              ) : null}
            </div>

            {/* SANCTIONS DISCIPLINAIRES */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />Sanctions disciplinaires
                  {sanctions.length > 0 && <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">{sanctions.length}</span>}
                </h3>
                {!isReadOnly && <button onClick={() => setShowAddSanction(!showAddSanction)} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>}
              </div>

              {showAddSanction && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                      <select value={newSanction.type} onChange={e => setNewSanction(p => ({ ...p, type: e.target.value }))}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none">
                        {Object.keys(SANCTION_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                      <input type="date" value={newSanction.date} onChange={e => setNewSanction(p => ({ ...p, date: e.target.value }))}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Motif *</label>
                    <textarea value={newSanction.reason} onChange={e => setNewSanction(p => ({ ...p, reason: e.target.value }))}
                      rows={2} className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none resize-none"
                      placeholder="Motif de la sanction..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                    <input type="text" value={newSanction.notes} onChange={e => setNewSanction(p => ({ ...p, notes: e.target.value }))}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                      placeholder="Observations complémentaires..." />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAddSanction(false)} className="px-3 py-1.5 text-xs text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300">Annuler</button>
                    <button onClick={handleAddSanction} disabled={!newSanction.reason.trim() || isSavingSanction}
                      className="px-3 py-1.5 text-xs text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1">
                      {isSavingSanction && <Loader2 className="w-3 h-3 animate-spin" />}Enregistrer
                    </button>
                  </div>
                </div>
              )}

              {isLoadingSanctions ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : sanctions.length > 0 ? (
                <div className="space-y-2">
                  {sanctions.map(s => {
                    const st = SANCTION_TYPES[s.type] || SANCTION_TYPES['Autre'];
                    return (
                      <div key={s.id} className="group flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-orange-200 transition-colors">
                        <span className="text-lg">{st.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{s.type}</span>
                            <span className="text-xs text-gray-400">{formatDate(s.date)}</span>
                          </div>
                          <p className="text-sm text-gray-700">{s.reason}</p>
                          {s.notes && <p className="text-xs text-gray-400 mt-0.5">{s.notes}</p>}
                          {s.issued_by && <p className="text-xs text-gray-400 mt-0.5">Par {s.issued_by}</p>}
                        </div>
                        <button onClick={() => handleDeleteSanction(s.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : !showAddSanction ? (
                <p className="text-sm text-gray-400 text-center py-3">Aucune sanction enregistrée.</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* ==================== FOOTER ==================== */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium hover:bg-gray-200 rounded-lg">Fermer</button>
          <div className="flex gap-2">
            <button onClick={handleExportPDF} disabled={isExporting}
              className="px-4 py-2 text-sm text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}Exporter PDF
            </button>
            {onEdit && (
              <button onClick={onEdit} className="px-4 py-2 text-sm text-white font-medium bg-primary-500 rounded-lg hover:bg-primary-600">
                Modifier le dossier
              </button>
            )}
          </div>
        </div>
      </div>

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
// SUB-COMPONENTS
// ============================================

function ScoreCard({ label, value, weight, icon }: { label: string; value: number; weight: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 bg-white rounded-lg border border-gray-100 text-center">
      <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">{icon}<span className="text-xs">{label}</span></div>
      <div className={`text-lg font-bold ${getScoreColor(value)}`}>{Math.round(value)}%</div>
      <div className="text-[10px] text-gray-400">{weight}</div>
    </div>
  );
}

function ToggleButton({ expanded, remaining, onToggle }: { expanded: boolean; remaining: number; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
      {expanded ? <><ChevronUp className="w-3 h-3" /> Réduire</> : <><ChevronDown className="w-3 h-3" /> Voir les {remaining} autres</>}
    </button>
  );
}
