'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, Maximize2, Minimize2, Download, Mail, Phone, MapPin, Calendar,
  Briefcase, Building2, Users, CreditCard, Globe, Award, TrendingUp,
  BookOpen, GraduationCap, AlertTriangle, ChevronDown, ChevronUp,
  Star, Target, CheckCircle2, Clock, Loader2, Plus, Trash2, MessageSquare,
  ThumbsUp, ExternalLink
} from 'lucide-react';
// ============================================
// AUTH HELPER
// ============================================

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// ============================================
// TYPES
// ============================================

interface Employee {
  id: number;
  employee_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title?: string;
  position?: string;
  department_name?: string;
  department_id?: number;
  manager_name?: string;
  manager_id?: number;
  is_manager?: boolean;
  role?: string;
  hire_date?: string;
  date_of_birth?: string;
  birth_date?: string;
  gender?: string;
  status?: string;
  contract_type?: string;
  site?: string;
  location?: string;
  salary?: number;
  currency?: string;
  classification?: string;
  coefficient?: string;
  nationality?: string;
  address?: string;
  photo_url?: string;
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
  employee_name?: string;
  type?: string;
  strengths?: string[];
  improvements?: string[];
}

interface FeedbackItem {
  id: number;
  from_employee_name?: string;
  from_employee_initials?: string;
  to_employee_name?: string;
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

interface EmployeeModalProps {
  employee: Employee;
  onClose: () => void;
}

// ============================================
// HELPERS
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
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

// ============================================
// MAIN COMPONENT
// ============================================

export default function EmployeeModal({ employee, onClose }: EmployeeModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Performance Score
  const [perfScore, setPerfScore] = useState<PerformanceScore | null>(null);
  const [perfPeriod, setPerfPeriod] = useState('quarter');
  const [isLoadingPerf, setIsLoadingPerf] = useState(false);

  // Evaluations (from performance.py)
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [showAllEvals, setShowAllEvals] = useState(false);
  const [isLoadingEvals, setIsLoadingEvals] = useState(false);

  // Feedbacks (from performance.py)
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [showAllFeedbacks, setShowAllFeedbacks] = useState(false);
  const [isLoadingFeedbacks, setIsLoadingFeedbacks] = useState(false);

  // Trainings / Assignments (from learning.py)
  const [trainings, setTrainings] = useState<TrainingAssignment[]>([]);
  const [showAllTrainings, setShowAllTrainings] = useState(false);
  const [isLoadingTrainings, setIsLoadingTrainings] = useState(false);

  // Skills (from learning.py)
  const [skills, setSkills] = useState<EmployeeSkillItem[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);

  // Sanctions (backend pending)
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [isLoadingSanctions, setIsLoadingSanctions] = useState(false);
  const [showAddSanction, setShowAddSanction] = useState(false);
  const [isSavingSanction, setIsSavingSanction] = useState(false);
  const [newSanction, setNewSanction] = useState({
    type: 'Avertissement',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    notes: '',
  });

  // ============================================
  // DATA LOADING — REAL API ENDPOINTS
  // ============================================

  // 1) Performance Score — GET /api/performance/score/employee/{id}?period=...
  const loadPerformance = useCallback(async () => {
    setIsLoadingPerf(true);
    try {
      const data = await apiFetch(`/api/performance/score/employee/${employee.id}?period=${perfPeriod}`);
      setPerfScore(data);
    } catch (err) {
      console.warn('Performance score not available:', err);
      setPerfScore(null);
    } finally {
      setIsLoadingPerf(false);
    }
  }, [employee.id, perfPeriod]);

  // 2) Evaluations — GET /api/performance/evaluations?employee_id={id}
  const loadEvaluations = useCallback(async () => {
    setIsLoadingEvals(true);
    try {
      const data = await apiFetch(`/api/performance/evaluations?employee_id=${employee.id}&page_size=10`);
      setEvaluations(data.items || []);
    } catch (err) {
      console.warn('Evaluations not available:', err);
      setEvaluations([]);
    } finally {
      setIsLoadingEvals(false);
    }
  }, [employee.id]);

  // 3) Feedbacks reçus — GET /api/performance/feedbacks?to_employee_id={id}
  const loadFeedbacks = useCallback(async () => {
    setIsLoadingFeedbacks(true);
    try {
      const data = await apiFetch(`/api/performance/feedbacks?to_employee_id=${employee.id}&page_size=10`);
      setFeedbacks(data.items || []);
    } catch (err) {
      console.warn('Feedbacks not available:', err);
      setFeedbacks([]);
    } finally {
      setIsLoadingFeedbacks(false);
    }
  }, [employee.id]);

  // 4) Training Assignments — GET /api/learning/assignments/?employee_id={id}
  const loadTrainings = useCallback(async () => {
    setIsLoadingTrainings(true);
    try {
      const data = await apiFetch(`/api/learning/assignments/?employee_id=${employee.id}&page_size=50`);
      setTrainings(data.items || []);
    } catch (err) {
      console.warn('Trainings not available:', err);
      setTrainings([]);
    } finally {
      setIsLoadingTrainings(false);
    }
  }, [employee.id]);

  // 5) Employee Skills — GET /api/learning/employees/{id}/skills
  const loadSkills = useCallback(async () => {
    setIsLoadingSkills(true);
    try {
      const data = await apiFetch(`/api/learning/employees/${employee.id}/skills`);
      setSkills(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Skills not available:', err);
      setSkills([]);
    } finally {
      setIsLoadingSkills(false);
    }
  }, [employee.id]);

  // 6) Sanctions — GET /api/employees/{id}/sanctions (backend pending)
  const loadSanctions = useCallback(async () => {
    setIsLoadingSanctions(true);
    try {
      const data = await apiFetch(`/api/employees/${employee.id}/sanctions`);
      setSanctions(Array.isArray(data) ? data : data.items || []);
    } catch {
      setSanctions([]);
    } finally {
      setIsLoadingSanctions(false);
    }
  }, [employee.id]);

  // Initial load
  useEffect(() => {
    loadPerformance();
    loadEvaluations();
    loadFeedbacks();
    loadTrainings();
    loadSkills();
    loadSanctions();
  }, [loadPerformance, loadEvaluations, loadFeedbacks, loadTrainings, loadSkills, loadSanctions]);

  // Reload performance on period change
  useEffect(() => {
    loadPerformance();
  }, [perfPeriod, loadPerformance]);

  // ESC key handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreen, onClose]);

  // ============================================
  // SANCTIONS ACTIONS
  // ============================================

  const handleAddSanction = async () => {
    if (!newSanction.reason.trim()) return;
    setIsSavingSanction(true);
    try {
      const data = await apiFetch(`/api/employees/${employee.id}/sanctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSanction),
      });
      setSanctions(prev => [data, ...prev]);
    } catch {
      // Fallback local si API pas encore dispo
      const localSanction: Sanction = { id: Date.now(), ...newSanction, issued_by: 'Vous' };
      setSanctions(prev => [localSanction, ...prev]);
    } finally {
      setNewSanction({ type: 'Avertissement', date: new Date().toISOString().split('T')[0], reason: '', notes: '' });
      setShowAddSanction(false);
      setIsSavingSanction(false);
    }
  };

  const handleDeleteSanction = async (sanctionId: number) => {
    if (!confirm('Supprimer cette sanction ?')) return;
    try {
      await apiFetch(`/api/employees/${employee.id}/sanctions/${sanctionId}`, { method: 'DELETE' });
    } catch { /* fallback */ }
    setSanctions(prev => prev.filter(s => s.id !== sanctionId));
  };

  // ============================================
  // DERIVED DATA
  // ============================================

  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`.toUpperCase();
  const fullName = `${employee.first_name} ${employee.last_name}`;
  const jobTitle = employee.job_title || employee.position || '—';
  const department = employee.department_name || '—';
  const hireDate = employee.hire_date;
  const birthDate = employee.date_of_birth || employee.birth_date;
  const seniority = hireDate
    ? Math.floor((Date.now() - new Date(hireDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const completedTrainings = trainings.filter(t => t.status === 'completed').length;
  const inProgressTrainings = trainings.filter(t => ['assigned', 'in_progress', 'pending_validation'].includes(t.status)).length;

  const statusMap: Record<string, { label: string; cls: string }> = {
    active: { label: 'Actif', cls: 'bg-green-100 text-green-700' },
    probation: { label: 'Essai', cls: 'bg-yellow-100 text-yellow-700' },
    on_leave: { label: 'Congé', cls: 'bg-blue-100 text-blue-700' },
    suspended: { label: 'Suspendu', cls: 'bg-red-100 text-red-700' },
    terminated: { label: 'Terminé', cls: 'bg-gray-100 text-gray-600' },
  };
  const empStatus = statusMap[employee.status || 'active'] || statusMap.active;

  const contractMap: Record<string, string> = {
    cdi: 'CDI', cdd: 'CDD', stage: 'Stage', alternance: 'Alternance',
    consultant: 'Consultant', interim: 'Intérim',
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white flex flex-col transition-all duration-300 ${
          isFullscreen
            ? 'w-full h-full max-w-full max-h-full rounded-none'
            : 'w-full max-w-4xl max-h-[90vh] rounded-2xl'
        }`}
      >
        {/* ==================== HEADER ==================== */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{fullName}</h2>
              <p className="text-sm text-gray-500">{jobTitle} · {department}</p>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${empStatus.cls}`}>
              {empStatus.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Exporter PDF">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title={isFullscreen ? 'Réduire' : 'Plein écran'}>
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================== BODY ==================== */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ──────────── INFORMATIONS PERSONNELLES ──────────── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              Informations personnelles
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <InfoItem icon={<Mail className="w-4 h-4" />} label="Email" value={employee.email} />
              <InfoItem icon={<Phone className="w-4 h-4" />} label="Téléphone" value={employee.phone} />
              <InfoItem icon={<Calendar className="w-4 h-4" />} label="Date de naissance" value={formatDate(birthDate)} />
              <InfoItem icon={<Globe className="w-4 h-4" />} label="Nationalité" value={employee.nationality} />
              <InfoItem icon={<MapPin className="w-4 h-4" />} label="Adresse" value={employee.address || employee.site || employee.location} />
              <InfoItem label="Genre" value={employee.gender === 'male' ? 'Homme' : employee.gender === 'female' ? 'Femme' : employee.gender} />
            </div>
          </section>

          {/* ──────────── INFORMATIONS PROFESSIONNELLES ──────────── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gray-400" />
              Informations professionnelles
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <InfoItem label="Matricule" value={employee.employee_id} />
              <InfoItem icon={<Building2 className="w-4 h-4" />} label="Département" value={department} />
              <InfoItem label="Poste" value={jobTitle} />
              <InfoItem label="Manager" value={employee.manager_name} />
              <InfoItem icon={<Calendar className="w-4 h-4" />} label="Date d'embauche" value={formatDate(hireDate)} />
              {seniority !== null && <InfoItem label="Ancienneté" value={`${seniority} an${seniority > 1 ? 's' : ''}`} />}
              <InfoItem label="Contrat" value={contractMap[employee.contract_type || ''] || employee.contract_type} />
              <InfoItem label="Classification" value={employee.classification} />
              <InfoItem label="Rôle système" value={employee.role} />
              {employee.salary != null && employee.salary > 0 && (
                <InfoItem icon={<CreditCard className="w-4 h-4" />} label="Salaire" value={`${employee.salary.toLocaleString('fr-FR')} ${employee.currency || 'XOF'}`} />
              )}
            </div>
          </section>

          {/* ──────────── PERFORMANCE SCORE ──────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                Score de performance
              </h3>
              <select
                value={perfPeriod}
                onChange={e => setPerfPeriod(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-primary-500 outline-none"
              >
                <option value="month">Ce mois</option>
                <option value="quarter">Ce trimestre</option>
                <option value="year">Cette année</option>
                <option value="last_quarter">Trim. précédent</option>
                <option value="last_month">Mois précédent</option>
              </select>
            </div>

            {isLoadingPerf ? (
              <LoadingRow />
            ) : perfScore ? (
              <div className="grid grid-cols-5 gap-3">
                <div className={`col-span-1 p-4 rounded-xl text-center ${getScoreBg(perfScore.overall_score)}`}>
                  <div className={`text-2xl font-bold ${getScoreColor(perfScore.overall_score)}`}>
                    {Math.round(perfScore.overall_score)}%
                  </div>
                  <div className={`text-xs font-medium mt-1 ${getScoreColor(perfScore.overall_score)}`}>
                    {getScoreLabel(perfScore.overall_score)}
                  </div>
                </div>
                <div className="col-span-4 grid grid-cols-4 gap-2">
                  <ScoreCard label="OKRs" value={perfScore.okr_score} weight="40%" icon={<Target className="w-3.5 h-3.5" />} />
                  <ScoreCard label="Tâches" value={perfScore.task_score} weight="25%" icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
                  <ScoreCard label="Validations" value={perfScore.validation_score} weight="20%" icon={<Clock className="w-3.5 h-3.5" />} />
                  <ScoreCard label="Feedbacks" value={perfScore.feedback_score} weight="15%" icon={<Star className="w-3.5 h-3.5" />} />
                </div>
              </div>
            ) : (
              <EmptyState text="Aucun score de performance disponible pour cette période." />
            )}
          </section>

          {/* ──────────── ÉVALUATIONS ──────────── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-gray-400" />
              Évaluations
              {evaluations.length > 0 && (
                <span className="ml-auto text-xs text-gray-400 font-normal">{evaluations.length} évaluation(s)</span>
              )}
            </h3>

            {isLoadingEvals ? (
              <LoadingRow />
            ) : evaluations.length > 0 ? (
              <>
                <div className="space-y-2">
                  {(showAllEvals ? evaluations : evaluations.slice(0, 3)).map(ev => (
                    <div key={ev.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {ev.campaign_name || `Évaluation #${ev.id}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {ev.evaluator_name && `Par ${ev.evaluator_name} · `}
                          {formatDate(ev.submitted_at || ev.validated_at || ev.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {ev.overall_score != null && (
                          <span className={`text-sm font-bold ${getScoreColor(ev.overall_score * 20)}`}>
                            {ev.overall_score}/5
                          </span>
                        )}
                        {getStatusBadge(ev.status)}
                      </div>
                    </div>
                  ))}
                </div>
                {evaluations.length > 3 && (
                  <ToggleButton
                    expanded={showAllEvals}
                    remaining={evaluations.length - 3}
                    onToggle={() => setShowAllEvals(!showAllEvals)}
                  />
                )}
              </>
            ) : (
              <EmptyState text="Aucune évaluation trouvée." />
            )}
          </section>

          {/* ──────────── FEEDBACKS REÇUS ──────────── */}
          {feedbacks.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                Feedbacks reçus
                <span className="ml-auto text-xs text-gray-400 font-normal">{feedbacks.length}</span>
              </h3>
              <div className="space-y-2">
                {(showAllFeedbacks ? feedbacks : feedbacks.slice(0, 3)).map(fb => {
                  const fbType = FEEDBACK_TYPES[fb.type] || { label: fb.type, emoji: '💬', color: 'text-gray-600' };
                  return (
                    <div key={fb.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{fbType.emoji}</span>
                          <span className="text-xs font-medium text-gray-500">{fb.from_employee_name || 'Anonyme'}</span>
                          <span className={`text-xs ${fbType.color}`}>{fbType.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {fb.likes_count > 0 && (
                            <span className="flex items-center gap-0.5">
                              <ThumbsUp className="w-3 h-3" /> {fb.likes_count}
                            </span>
                          )}
                          {formatDate(fb.created_at)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{fb.message}</p>
                    </div>
                  );
                })}
              </div>
              {feedbacks.length > 3 && (
                <ToggleButton
                  expanded={showAllFeedbacks}
                  remaining={feedbacks.length - 3}
                  onToggle={() => setShowAllFeedbacks(!showAllFeedbacks)}
                />
              )}
            </section>
          )}

          {/* ──────────── FORMATIONS ──────────── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-gray-400" />
              Formations
              {trainings.length > 0 && (
                <span className="ml-auto flex items-center gap-2 text-xs font-normal">
                  <span className="text-green-600">✓ {completedTrainings} terminée(s)</span>
                  {inProgressTrainings > 0 && <span className="text-yellow-600">⏳ {inProgressTrainings} en cours</span>}
                </span>
              )}
            </h3>

            {isLoadingTrainings ? (
              <LoadingRow />
            ) : trainings.length > 0 ? (
              <>
                <div className="space-y-2">
                  {(showAllTrainings ? trainings : trainings.slice(0, 4)).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-lg flex-shrink-0">{t.course_image || '📚'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {t.course_title || `Formation #${t.course_id}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t.course_duration && `${t.course_duration}h`}
                            {t.deadline && ` · Échéance: ${formatDate(t.deadline)}`}
                            {t.completed_at && ` · Terminé le ${formatDate(t.completed_at)}`}
                            {t.rejection_reason && (
                              <span className="text-red-500"> · Rejeté: {t.rejection_reason}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.requires_certificate && (
                          <span className="text-xs text-gray-400" title="Certificat requis">📎</span>
                        )}
                        {t.course_external_url && (
                          <a
                            href={t.course_external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-600 transition-opacity"
                            title="Ouvrir la formation"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {getStatusBadge(t.status)}
                      </div>
                    </div>
                  ))}
                </div>
                {trainings.length > 4 && (
                  <ToggleButton
                    expanded={showAllTrainings}
                    remaining={trainings.length - 4}
                    onToggle={() => setShowAllTrainings(!showAllTrainings)}
                  />
                )}
              </>
            ) : (
              <EmptyState text="Aucune formation assignée." />
            )}
          </section>

          {/* ──────────── COMPÉTENCES ──────────── */}
          {skills.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" />
                Compétences
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {skills.map(s => (
                  <div key={s.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{s.skill_name}</p>
                    {s.skill_category && <p className="text-xs text-gray-400 mb-1.5">{s.skill_category}</p>}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${Math.min(s.current_level, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600">
                        {s.current_level}{s.target_level ? `/${s.target_level}` : '%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ──────────── SANCTIONS DISCIPLINAIRES ──────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-gray-400" />
                Sanctions disciplinaires
                {sanctions.length > 0 && (
                  <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {sanctions.length}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowAddSanction(!showAddSanction)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>

            {/* Formulaire d'ajout */}
            {showAddSanction && (
              <div className="mb-3 p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      value={newSanction.type}
                      onChange={e => setNewSanction(p => ({ ...p, type: e.target.value }))}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                    >
                      {Object.keys(SANCTION_TYPES).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                    <input
                      type="date"
                      value={newSanction.date}
                      onChange={e => setNewSanction(p => ({ ...p, date: e.target.value }))}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Motif *</label>
                  <textarea
                    value={newSanction.reason}
                    onChange={e => setNewSanction(p => ({ ...p, reason: e.target.value }))}
                    rows={2}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none resize-none"
                    placeholder="Motif de la sanction..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                  <input
                    type="text"
                    value={newSanction.notes}
                    onChange={e => setNewSanction(p => ({ ...p, notes: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                    placeholder="Observations complémentaires..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddSanction(false)}
                    className="px-3 py-1.5 text-xs text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAddSanction}
                    disabled={!newSanction.reason.trim() || isSavingSanction}
                    className="px-3 py-1.5 text-xs text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSavingSanction && <Loader2 className="w-3 h-3 animate-spin" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* Liste des sanctions */}
            {isLoadingSanctions ? (
              <LoadingRow />
            ) : sanctions.length > 0 ? (
              <div className="space-y-2">
                {sanctions.map(s => {
                  const st = SANCTION_TYPES[s.type] || SANCTION_TYPES['Autre'];
                  return (
                    <div key={s.id} className="group flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <span className="text-lg">{st.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                            {s.type}
                          </span>
                          <span className="text-xs text-gray-400">{formatDate(s.date)}</span>
                        </div>
                        <p className="text-sm text-gray-700">{s.reason}</p>
                        {s.notes && <p className="text-xs text-gray-400 mt-0.5">{s.notes}</p>}
                        {s.issued_by && <p className="text-xs text-gray-400 mt-0.5">Par {s.issued_by}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteSanction(s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : !showAddSanction ? (
              <EmptyState text="Aucune sanction enregistrée." />
            ) : null}
          </section>

        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function InfoItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string | null }) {
  if (!value || value === '—') return null;
  return (
    <div className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg">
      {icon && <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function ScoreCard({ label, value, weight, icon }: { label: string; value: number; weight: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg text-center">
      <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-lg font-bold ${getScoreColor(value)}`}>{Math.round(value)}%</div>
      <div className="text-[10px] text-gray-400">{weight}</div>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
      <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 py-2">{text}</p>;
}

function ToggleButton({ expanded, remaining, onToggle }: { expanded: boolean; remaining: number; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
    >
      {expanded ? (
        <><ChevronUp className="w-3 h-3" /> Réduire</>
      ) : (
        <><ChevronDown className="w-3 h-3" /> Voir les {remaining} autres</>
      )}
    </button>
  );
}