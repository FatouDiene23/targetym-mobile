'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye, Edit, CheckCircle, X, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight, Send, RotateCcw, XCircle
} from 'lucide-react';
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer
} from 'recharts';
import PerformanceStats from '../components/PerformanceStats';
import Header from '@/components/Header';

// =============================================
// TYPES
// =============================================

interface Evaluation {
  id: number;
  employee_id: number;
  employee_name?: string;
  employee_initials?: string;
  employee_department?: string;
  employee_job_title?: string;
  evaluator_id?: number;
  evaluator_name?: string;
  type: 'self' | 'manager' | 'peer' | '360';
  status: 'pending' | 'in_progress' | 'submitted' | 'validated' | 'cancelled';
  scores?: Record<string, { score: number; comment?: string }>;
  overall_score?: number;
  strengths?: string;
  improvements?: string;
  goals?: string;
  manager_comments?: string;
  employee_comments?: string;
  due_date?: string;
  campaign_id?: number;
  campaign_name?: string;
}

interface CurrentUser {
  id: number;
  role: string;
  employee_id?: number;
}

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'super_admin' | 'dg';

interface ValidationError {
  msg?: string;
  message?: string;
}

// =============================================
// API
// =============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';
const ITEMS_PER_PAGE = 10;

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchEvaluations(): Promise<Evaluation[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/evaluations?page_size=100`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function submitEvaluation(evaluationId: number, data: {
  scores: Record<string, { score: number; comment?: string }>; overall_score: number;
  strengths?: string; improvements?: string; goals?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/evaluations/${evaluationId}/submit`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errorMsg = 'Erreur lors de la soumission';
      if (typeof errorData.detail === 'string') errorMsg = errorData.detail;
      else if (Array.isArray(errorData.detail)) {
        errorMsg = errorData.detail.map((e: ValidationError) => e.msg || e.message || JSON.stringify(e)).join(', ');
      }
      return { success: false, error: errorMsg };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion' };
  }
}

async function validateEvaluation(evaluationId: number, data: { approved: boolean; manager_comments?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/evaluations/${evaluationId}/validate`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la validation' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion' };
  }
}

// =============================================
// HELPERS
// =============================================

function normalizeRole(role: string | undefined): UserRole {
  if (!role) return 'employee';
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'super_admin') return 'admin';
  if (r === 'dg') return 'dg';
  if (r === 'rh' || r === 'hr') return 'rh';
  if (r === 'manager') return 'manager';
  return 'employee';
}

function getStatusColor(status: string) {
  switch (status) {
    case 'validated': return 'bg-green-100 text-green-700';
    case 'submitted': return 'bg-blue-100 text-blue-700';
    case 'in_progress': return 'bg-yellow-100 text-yellow-700';
    case 'pending': return 'bg-gray-100 text-gray-600';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'validated': return 'Validé';
    case 'submitted': return 'Soumis';
    case 'in_progress': return 'En cours';
    case 'pending': return 'En attente';
    case 'cancelled': return 'Annulé';
    default: return status;
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'self': return 'Auto-éval';
    case 'manager': return 'Manager';
    case 'peer': return 'Pair';
    case '360': return '360°';
    default: return type;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(name: string | undefined): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function canUserEditEvaluation(evaluation: Evaluation, userRole: UserRole, currentEmployeeId?: number): boolean {
  // Les évaluations annulées ne peuvent pas être modifiées
  if (evaluation.status === 'cancelled') return false;
  
  if (evaluation.status === 'pending' || evaluation.status === 'in_progress') {
    if (evaluation.type === 'self' && evaluation.employee_id === currentEmployeeId) return true;
  }
  if (evaluation.status === 'submitted') {
    if (userRole === 'rh' || userRole === 'admin' || userRole === 'manager' || userRole === 'dg') return true;
  }
  return false;
}

function canUserValidateEvaluation(evaluation: Evaluation, userRole: UserRole, currentEmployeeId?: number): boolean {
  // Les évaluations annulées ne peuvent pas être validées
  if (evaluation.status === 'cancelled') return false;

  if (evaluation.status === 'submitted') {
    // Un manager ne peut valider que les évaluations de ses N-1 (pas les siennes)
    if (userRole === 'manager') {
      return evaluation.employee_id !== currentEmployeeId;
    }
    if (userRole === 'rh' || userRole === 'admin' || userRole === 'dg') return true;
  }
  return false;
}

// =============================================
// COMPONENTS
// =============================================

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) pageNum = i + 1;
          else if (currentPage <= 3) pageNum = i + 1;
          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
          else pageNum = currentPage - 2 + i;
          return (
            <button key={pageNum} onClick={() => onPageChange(pageNum)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum ? 'bg-primary-500 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
              {pageNum}
            </button>
          );
        })}
      </div>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-500 ml-2">Page {currentPage}/{totalPages}</span>
    </div>
  );
}

function EvaluationViewModal({ isOpen, onClose, evaluation }: {
  isOpen: boolean; onClose: () => void; evaluation: Evaluation | null;
}) {
  if (!isOpen || !evaluation) return null;

  const radarData = evaluation.scores ? Object.entries(evaluation.scores).map(([name, data]) => ({
    subject: name.length > 15 ? name.substring(0, 15) + '...' : name, score: data.score, fullMark: 100
  })) : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Détails de l&apos;Évaluation</h2>
            <p className="text-sm text-gray-500">{evaluation.employee_name} - {evaluation.employee_job_title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium text-gray-900">{getTypeLabel(evaluation.type)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(evaluation.status)}`}>{getStatusLabel(evaluation.status)}</span>
            </div>
            {evaluation.due_date && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Date limite</p>
                <p className="font-medium text-gray-900">{formatDate(evaluation.due_date)}</p>
              </div>
            )}
            {evaluation.overall_score && (
              <div className="p-4 bg-primary-50 rounded-lg">
                <p className="text-sm text-gray-500">Score Global</p>
                <p className="text-2xl font-bold text-primary-600">{evaluation.overall_score}/5</p>
              </div>
            )}
          </div>
          
          {/* Message si annulé */}
          {evaluation.status === 'cancelled' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-red-700">Cette évaluation a été annulée et ne peut plus être modifiée.</p>
            </div>
          )}
          
          {radarData.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Scores par Compétence</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {evaluation.strengths && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Points Forts</h4>
              <p className="text-sm text-gray-700 bg-green-50 p-3 rounded-lg">{evaluation.strengths}</p>
            </div>
          )}
          {evaluation.improvements && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Axes d&apos;Amélioration</h4>
              <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg">{evaluation.improvements}</p>
            </div>
          )}
          {evaluation.manager_comments && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Commentaires du Manager</h4>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">{evaluation.manager_comments}</p>
            </div>
          )}
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300">Fermer</button>
        </div>
      </div>
    </div>
  );
}

function EvaluationEditModal({ isOpen, onClose, evaluation, onSave, userRole, currentEmployeeId }: {
  isOpen: boolean; onClose: () => void; evaluation: Evaluation | null; onSave: () => void; userRole: UserRole; currentEmployeeId?: number;
}) {
  const [scores, setScores] = useState<Record<string, { score: number; comment: string }>>({});
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [goals, setGoals] = useState('');
  const [managerComments, setManagerComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (evaluation) {
      const defaultCompetencies = ['Compétences techniques', 'Communication', 'Leadership', 'Travail d\'équipe', 'Innovation'];
      const initialScores: Record<string, { score: number; comment: string }> = {};
      if (evaluation.scores && Object.keys(evaluation.scores).length > 0) {
        Object.entries(evaluation.scores).forEach(([key, val]) => { initialScores[key] = { score: val.score, comment: val.comment || '' }; });
      } else {
        defaultCompetencies.forEach(comp => { initialScores[comp] = { score: 75, comment: '' }; });
      }
      setScores(initialScores);
      setStrengths(evaluation.strengths || '');
      setImprovements(evaluation.improvements || '');
      setGoals(evaluation.goals || '');
      setManagerComments(evaluation.manager_comments || '');
    }
  }, [evaluation]);

  const calculateOverall = () => {
    const values = Object.values(scores);
    if (values.length === 0) return 0;
    return Math.round((values.reduce((s, v) => s + v.score, 0) / values.length / 100) * 5 * 10) / 10;
  };

  const handleSubmit = async () => {
    if (!evaluation) return;
    setError(''); setSaving(true);
    const result = await submitEvaluation(evaluation.id, { scores, overall_score: calculateOverall(), strengths: strengths || undefined, improvements: improvements || undefined, goals: goals || undefined });
    setSaving(false);
    if (result.success) { onSave(); onClose(); } else setError(result.error || 'Erreur');
  };

  const handleValidate = async (approved: boolean) => {
    if (!evaluation) return;
    setError(''); setSaving(true);
    const result = await validateEvaluation(evaluation.id, { approved, manager_comments: managerComments || undefined });
    setSaving(false);
    if (result.success) { onSave(); onClose(); } else setError(result.error || 'Erreur');
  };

  if (!isOpen || !evaluation) return null;

  // Si annulé, afficher juste un message
  if (evaluation.status === 'cancelled') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
            <h2 className="text-lg font-bold text-gray-900">Évaluation Annulée</h2>
          </div>
          <p className="text-gray-600 mb-6">Cette évaluation a été annulée et ne peut plus être modifiée.</p>
          <button onClick={onClose} className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Fermer</button>
        </div>
      </div>
    );
  }

  const canEdit = canUserEditEvaluation(evaluation, userRole, currentEmployeeId);
  const canValidate = canUserValidateEvaluation(evaluation, userRole, currentEmployeeId);
  const isEmployeeEditing = evaluation.type === 'self' && evaluation.employee_id === currentEmployeeId && (evaluation.status === 'pending' || evaluation.status === 'in_progress');
  const isManagerReviewing = canValidate || (canEdit && !isEmployeeEditing);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isManagerReviewing ? 'Évaluer / Valider' : isEmployeeEditing ? 'Mon Auto-Évaluation' : 'Voir l\'Évaluation'}
            </h2>
            <p className="text-sm text-gray-500">{evaluation.employee_name} - {evaluation.employee_job_title}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(evaluation.status)}`}>{getStatusLabel(evaluation.status)}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-6">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Évaluation des Compétences</h4>
            <div className="space-y-4">
              {Object.entries(scores).map(([comp, data]) => (
                <div key={comp} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-medium text-gray-700">{comp}</label>
                    <span className="text-lg font-bold text-primary-600">{data.score}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={data.score} onChange={(e) => setScores(prev => ({ ...prev, [comp]: { ...prev[comp], score: Number(e.target.value) } }))} disabled={!canEdit} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500 disabled:opacity-50" />
                  <input type="text" placeholder="Commentaire (optionnel)" value={data.comment} onChange={(e) => setScores(prev => ({ ...prev, [comp]: { ...prev[comp], comment: e.target.value } }))} disabled={!canEdit} className="w-full mt-2 px-3 py-2 text-sm border rounded-lg disabled:bg-gray-50" />
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-primary-50 rounded-lg text-center">
              <span className="text-sm text-gray-600">Score Global:</span>
              <span className="text-2xl font-bold text-primary-600 ml-2">{calculateOverall()}/5</span>
            </div>
          </div>

          {isEmployeeEditing && (
            <>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Points Forts</h4>
                <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} placeholder="Décrivez vos points forts..." className="w-full px-3 py-2 text-sm border rounded-lg" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Axes d&apos;Amélioration</h4>
                <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={2} placeholder="Identifiez vos axes d'amélioration..." className="w-full px-3 py-2 text-sm border rounded-lg" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Objectifs</h4>
                <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} placeholder="Vos objectifs pour la prochaine période..." className="w-full px-3 py-2 text-sm border rounded-lg" />
              </div>
            </>
          )}

          {!isEmployeeEditing && evaluation.strengths && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Points Forts</h4>
              <p className="text-sm text-gray-700 bg-green-50 p-3 rounded-lg">{evaluation.strengths}</p>
            </div>
          )}

          {!isEmployeeEditing && evaluation.improvements && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Axes d&apos;Amélioration</h4>
              <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg">{evaluation.improvements}</p>
            </div>
          )}

          {isManagerReviewing && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Commentaires du Manager/RH</h4>
              <textarea value={managerComments} onChange={(e) => setManagerComments(e.target.value)} rows={3} placeholder="Vos commentaires pour l'employé..." className="w-full px-3 py-2 text-sm border rounded-lg" />
            </div>
          )}

          {!isManagerReviewing && evaluation.manager_comments && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Commentaires du Manager</h4>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">{evaluation.manager_comments}</p>
            </div>
          )}
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">{!canEdit && !canValidate ? 'Fermer' : 'Annuler'}</button>
          {isEmployeeEditing && (
            <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Soumettre
            </button>
          )}
          {canValidate && (
            <>
              <button onClick={() => handleValidate(false)} disabled={saving} className="px-4 py-2 border border-orange-500 text-orange-600 text-sm rounded-lg hover:bg-orange-50 flex items-center">
                <RotateCcw className="w-4 h-4 mr-2" />Renvoyer
              </button>
              <button onClick={() => handleValidate(true)} disabled={saving} className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}Valider
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
// MAIN PAGE
// =============================================

export default function EvaluationsPage() {
  const router = useRouter();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCancelled, setShowCancelled] = useState(false); // ← NOUVEAU
  const [page, setPage] = useState(1);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const user = await fetchCurrentUser();
    if (user) { 
      setCurrentUser(user); 
      setUserRole(normalizeRole(user.role)); 
    }
    const evaluationsData = await fetchEvaluations();
    setEvaluations(evaluationsData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => router.push('/dashboard/performance/campaigns');
    window.addEventListener('evaluations-add', handler);
    return () => window.removeEventListener('evaluations-add', handler);
  }, [router]);

  // ✅ FILTRER LES ÉVALUATIONS - EXCLURE CANCELLED PAR DÉFAUT
  const filteredEvaluations = evaluations.filter(e => {
    if (!showCancelled && e.status === 'cancelled') return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      const matchesSearch = (e.employee_name?.toLowerCase().includes(s) ?? false) ||
                            (e.employee_department?.toLowerCase().includes(s) ?? false);
      if (!matchesSearch) return false;
    }
    return true;
  });
  
  const paginatedEvaluations = filteredEvaluations.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredEvaluations.length / ITEMS_PER_PAGE);
  
  // Compteur d'annulées
  const cancelledCount = evaluations.filter(e => e.status === 'cancelled').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header title="Évaluations" subtitle="Consultez et gérez les évaluations" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
      {/* Stats KPIs */}
      <PerformanceStats />

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
              placeholder="Rechercher une évaluation..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
            />
          </div>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="in_progress">En cours</option>
            <option value="submitted">Soumis</option>
            <option value="validated">Validé</option>
            {showCancelled && <option value="cancelled">Annulé</option>}
          </select>
          
          {/* ✅ CHECKBOX AFFICHER LES ANNULÉES */}
          {cancelledCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showCancelled} 
                onChange={(e) => { setShowCancelled(e.target.checked); setPage(1); }} 
                className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span>Afficher annulées ({cancelledCount})</span>
            </label>
          )}
        </div>

        {/* Evaluations List */}
        <div className="space-y-3">
          {paginatedEvaluations.length > 0 ? paginatedEvaluations.map(evaluation => {
            const canEdit = canUserEditEvaluation(evaluation, userRole, currentUser?.employee_id);
            const canValidate = canUserValidateEvaluation(evaluation, userRole, currentUser?.employee_id);
            const isCancelled = evaluation.status === 'cancelled';
            
            return (
              <div 
                key={evaluation.id} 
                className={`p-4 border rounded-xl transition-shadow ${
                  isCancelled 
                    ? 'border-red-200 bg-red-50/30 opacity-75' 
                    : 'border-gray-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm ${
                    isCancelled 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-primary-100 text-primary-600'
                  }`}>
                    {isCancelled ? <XCircle className="w-5 h-5" /> : (evaluation.employee_initials || getInitials(evaluation.employee_name))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium ${isCancelled ? 'text-gray-500' : 'text-gray-900'}`}>
                      {evaluation.employee_name}
                    </h3>
                    <p className="text-sm text-gray-500">{evaluation.employee_job_title} • {evaluation.employee_department}</p>
                    <p className="text-xs text-gray-400 mt-1">{getTypeLabel(evaluation.type)} {evaluation.due_date && `• Deadline: ${formatDate(evaluation.due_date)}`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(evaluation.status)}`}>
                      {getStatusLabel(evaluation.status)}
                    </span>
                    {evaluation.overall_score && !isCancelled && (
                      <span className="font-bold text-primary-600">{evaluation.overall_score}/5</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <button onClick={() => { setSelectedEvaluation(evaluation); setShowViewModal(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Eye className="w-4 h-4" />Voir
                  </button>
                  {canEdit && !isCancelled && (
                    <button onClick={() => { setSelectedEvaluation(evaluation); setShowEditModal(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg">
                      <Edit className="w-4 h-4" />Éditer
                    </button>
                  )}
                  {canValidate && !isCancelled && (
                    <button onClick={() => { setSelectedEvaluation(evaluation); setShowEditModal(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg">
                      <CheckCircle className="w-4 h-4" />Valider
                    </button>
                  )}
                </div>
              </div>
            );
          }) : (
            <p className="text-gray-500 text-center py-8">Aucune évaluation trouvée</p>
          )}
        </div>

        {/* Pagination */}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Modals */}
      <EvaluationViewModal isOpen={showViewModal} onClose={() => setShowViewModal(false)} evaluation={selectedEvaluation} />
      <EvaluationEditModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} evaluation={selectedEvaluation} onSave={loadData} userRole={userRole} currentEmployeeId={currentUser?.employee_id} />
      </main>
    </>
  );
}