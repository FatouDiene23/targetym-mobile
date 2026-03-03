'use client';

import { useState, useEffect, useCallback } from 'react';
import PageTourTips, { RestartPageTipsButton } from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { performance1Tips } from '@/config/pageTips';
import { 
  Star, Users, ChevronRight, ChevronLeft, Plus, MessageSquare, Target, CheckCircle,
  Send, ThumbsUp, Eye, Edit, X, Loader2, AlertCircle, RotateCcw, Search, Calendar,
  Clock, MapPin, TrendingUp, BarChart3
} from 'lucide-react';
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer
} from 'recharts';

// =============================================
// TYPES
// =============================================

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'super_admin' | 'dg';
type ActiveTab = 'feedback' | 'campaigns' | 'evaluations' | 'objectives' | 'one-on-one';

interface FeedbackItem {
  id: number;
  from_employee_id: number;
  from_employee_name?: string;
  from_employee_initials?: string;
  to_employee_id: number;
  to_employee_name?: string;
  to_employee_initials?: string;
  type: 'recognition' | 'improvement' | 'general';
  message: string;
  is_public: boolean;
  likes_count: number;
  is_liked_by_me?: boolean;
  created_at: string;
}

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
  status: 'pending' | 'in_progress' | 'submitted' | 'validated';
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

interface EvaluationCampaign {
  id: number;
  name: string;
  description?: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  total_evaluations: number;
  completed_evaluations: number;
  progress_percentage: number;
}

interface OneOnOne {
  id: number;
  employee_id: number;
  employee_name?: string;
  employee_initials?: string;
  manager_id: number;
  manager_name?: string;
  scheduled_date: string;
  duration_minutes: number;
  location?: string;
  status: string;
  notes?: string;
  action_items?: string[];
  topics?: string[];
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
}

interface MyStats {
  scope: 'personal' | 'team' | 'global';
  avg_score: number;
  evaluations_total: number;
  evaluations_completed: number;
  evaluations_pending: number;
  evaluations_in_progress: number;
  completion_rate: number;
  feedbacks_received: number;
  feedbacks_given: number;
  one_on_ones_scheduled: number;
  one_on_ones_completed: number;
  okr_achievement: number;
  team_size: number;
}

interface CurrentUser {
  id: number;
  email: string;
  role: string;
  employee_id?: number;
}

interface ValidationError {
  msg?: string;
  message?: string;
}

type FeedbackType = 'recognition' | 'improvement' | 'general';

// =============================================
// API CONFIG
// =============================================

const API_URL = 'https://web-production-06c3.up.railway.app';
const ITEMS_PER_PAGE = 10;

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// =============================================
// API FUNCTIONS
// =============================================

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchMyStats(): Promise<MyStats> {
  try {
    const response = await fetch(`${API_URL}/api/performance/my-stats`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    return response.json();
  } catch {
    return {
      scope: 'personal', avg_score: 0, evaluations_total: 0, evaluations_completed: 0,
      evaluations_pending: 0, evaluations_in_progress: 0, completion_rate: 0,
      feedbacks_received: 0, feedbacks_given: 0, one_on_ones_scheduled: 0,
      one_on_ones_completed: 0, okr_achievement: 0, team_size: 0
    };
  }
}

async function fetchFeedbacks(): Promise<FeedbackItem[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks?page_size=100`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function createFeedback(data: { to_employee_id: number; type: string; message: string; is_public: boolean }): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la création' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion' };
  }
}

async function likeFeedback(feedbackId: number): Promise<number> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks/${feedbackId}/like`, {
      method: 'POST', headers: getAuthHeaders(),
    });
    if (!response.ok) return -1;
    const data = await response.json();
    return data.likes_count;
  } catch {
    return -1;
  }
}

async function fetchCampaigns(): Promise<EvaluationCampaign[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/campaigns?page_size=100`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchEvaluations(): Promise<Evaluation[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/evaluations?page_size=200`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchOneOnOnes(): Promise<OneOnOne[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones?page_size=100`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/?page_size=200&status=active`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function createCampaign(data: {
  name: string; description?: string; type: string; start_date: string; end_date: string; employee_ids?: number[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/campaigns`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la création' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion' };
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

async function createOneOnOne(data: {
  employee_id: number; scheduled_date: string; duration_minutes: number; location?: string; topics?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la création' };
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
    case 'validated': case 'completed': return 'bg-green-100 text-green-700';
    case 'submitted': return 'bg-blue-100 text-blue-700';
    case 'in_progress': return 'bg-yellow-100 text-yellow-700';
    case 'pending': case 'scheduled': return 'bg-gray-100 text-gray-600';
    case 'active': return 'bg-green-100 text-green-700';
    case 'draft': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'validated': return 'Validé';
    case 'submitted': return 'Soumis';
    case 'in_progress': return 'En cours';
    case 'pending': return 'En attente';
    case 'completed': return 'Terminé';
    case 'scheduled': return 'Planifié';
    case 'active': return 'Actif';
    case 'draft': return 'Brouillon';
    case 'cancelled': return 'Annulé';
    default: return status;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string | undefined): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getFeedbackIcon(type: string) {
  switch (type) {
    case 'recognition': return '🎉';
    case 'improvement': return '💡';
    default: return '💬';
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'self': return 'Auto-éval';
    case 'manager': return 'Manager';
    case 'peer': return 'Pair';
    case '360': return '360°';
    case 'annual': return 'Annuelle';
    case 'mid_year': return 'Mi-année';
    case 'probation': return 'Période d\'essai';
    default: return type;
  }
}

function canUserEditEvaluation(evaluation: Evaluation, userRole: UserRole, currentEmployeeId?: number): boolean {
  if (evaluation.status === 'pending' || evaluation.status === 'in_progress') {
    if (evaluation.type === 'self' && evaluation.employee_id === currentEmployeeId) return true;
  }
  if (evaluation.status === 'submitted') {
    if (userRole === 'rh' || userRole === 'admin' || userRole === 'manager' || userRole === 'dg') return true;
  }
  return false;
}

function canUserValidateEvaluation(evaluation: Evaluation, userRole: UserRole): boolean {
  if (evaluation.status === 'submitted') {
    if (userRole === 'manager' || userRole === 'rh' || userRole === 'admin' || userRole === 'dg') return true;
  }
  return false;
}

// =============================================
// PAGINATION COMPONENT
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

// =============================================
// SEARCH BAR COMPONENT
// =============================================

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string; }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || 'Rechercher...'} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
    </div>
  );
}

// =============================================
// FEEDBACK CARD COMPONENT
// =============================================

function FeedbackCard({ feedback, onLike }: { feedback: FeedbackItem; onLike: (id: number) => void }) {
  const [liked, setLiked] = useState(feedback.is_liked_by_me || false);
  const [likes, setLikes] = useState(feedback.likes_count);

  const handleLike = async () => {
    const newCount = await likeFeedback(feedback.id);
    if (newCount >= 0) { setLikes(newCount); setLiked(!liked); onLike(feedback.id); }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Il y a moins d\'1h';
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${Math.floor(hours / 24)}j`;
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm flex-shrink-0">
          {feedback.from_employee_initials || getInitials(feedback.from_employee_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{feedback.from_employee_name}</span>
            <span className="text-gray-400">→</span>
            <span className="font-medium text-primary-600 text-sm">{feedback.to_employee_name}</span>
            <span className="text-lg">{getFeedbackIcon(feedback.type)}</span>
          </div>
          <p className="text-gray-700 text-sm mt-2 leading-relaxed">{feedback.message}</p>
          <div className="flex items-center gap-4 mt-3">
            <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? 'text-primary-600' : 'text-gray-400 hover:text-primary-500'}`}>
              <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} /><span>{likes}</span>
            </button>
            <span className="text-xs text-gray-400">{timeAgo(feedback.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// CREATE FEEDBACK MODAL
// =============================================

function CreateFeedbackModal({ isOpen, onClose, employees, onSuccess }: {
  isOpen: boolean; onClose: () => void; employees: Employee[]; onSuccess: () => void;
}) {
  const [toEmployee, setToEmployee] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('recognition');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!toEmployee || !message.trim()) { setError('Veuillez remplir tous les champs obligatoires'); return; }
    if (message.length < 10) { setError('Le message doit contenir au moins 10 caractères'); return; }
    setError(''); setSaving(true);
    const result = await createFeedback({ to_employee_id: parseInt(toEmployee), type: feedbackType, message: message.trim(), is_public: isPublic });
    setSaving(false);
    if (result.success) { setToEmployee(''); setMessage(''); setFeedbackType('recognition'); setIsPublic(true); onSuccess(); onClose(); }
    else setError(result.error || 'Erreur lors de la création');
  };

  if (!isOpen) return null;

  const feedbackTypes: { value: FeedbackType; label: string; color: string }[] = [
    { value: 'recognition', label: '🎉 Reconnaissance', color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'improvement', label: '💡 Amélioration', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    { value: 'general', label: '💬 Général', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nouveau Feedback</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destinataire *</label>
            <select value={toEmployee} onChange={(e) => setToEmployee(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
              <option value="">Sélectionner un collègue</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de feedback</label>
            <div className="flex gap-2">
              {feedbackTypes.map(type => (
                <button key={type.value} onClick={() => setFeedbackType(type.value)} className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${feedbackType === type.value ? type.color : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Partagez votre feedback..." className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" />
            <p className="text-xs text-gray-400 mt-1">{message.length}/2000 caractères (min. 10)</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
            <span className="text-sm text-gray-700">Feedback public (visible par tous)</span>
          </label>
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// CREATE CAMPAIGN MODAL
// =============================================

function CreateCampaignModal({ isOpen, onClose, employees, onSuccess }: {
  isOpen: boolean; onClose: () => void; employees: Employee[]; onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [campaignType, setCampaignType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name || !startDate || !endDate) { setError('Veuillez remplir tous les champs obligatoires'); return; }
    setError(''); setSaving(true);
    const result = await createCampaign({ name, description: description || undefined, type: campaignType, start_date: startDate, end_date: endDate, employee_ids: selectedEmployees.length > 0 ? selectedEmployees : undefined });
    setSaving(false);
    if (result.success) { setName(''); setDescription(''); setCampaignType('annual'); setStartDate(''); setEndDate(''); setSelectedEmployees([]); onSuccess(); onClose(); }
    else setError(result.error || 'Erreur lors de la création');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">Nouvelle Campagne</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom de la campagne *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Évaluation Annuelle 2025" className="w-full px-3 py-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description optionnelle..." className="w-full px-3 py-2.5 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
              <option value="annual">Évaluation Annuelle</option>
              <option value="mid_year">Évaluation Mi-Année</option>
              <option value="360">Feedback 360°</option>
              <option value="probation">Fin de Période d&apos;Essai</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de début *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin *</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employés concernés</label>
            <p className="text-xs text-gray-500 mb-2">Laissez vide pour inclure tous les employés actifs</p>
            <select multiple value={selectedEmployees.map(String)} onChange={(e) => setSelectedEmployees(Array.from(e.target.selectedOptions, o => parseInt(o.value)))} className="w-full px-3 py-2.5 border rounded-lg text-sm h-32">
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// CREATE ONE-ON-ONE MODAL
// =============================================

function CreateOneOnOneModal({ isOpen, onClose, employees, onSuccess }: {
  isOpen: boolean; onClose: () => void; employees: Employee[]; onSuccess: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('');
  const [topics, setTopics] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!employeeId || !scheduledDate) { setError('Veuillez sélectionner un employé et une date'); return; }
    setError(''); setSaving(true);
    const dateTime = `${scheduledDate}T${scheduledTime}:00`;
    const topicsList = topics.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    const result = await createOneOnOne({ employee_id: parseInt(employeeId), scheduled_date: dateTime, duration_minutes: duration, location: location || undefined, topics: topicsList.length > 0 ? topicsList : undefined });
    setSaving(false);
    if (result.success) { setEmployeeId(''); setScheduledDate(''); setScheduledTime('09:00'); setDuration(30); setLocation(''); setTopics(''); onSuccess(); onClose(); }
    else setError(result.error || 'Erreur lors de la création');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Planifier un 1-on-1</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collaborateur *</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
              <option value="">Sélectionner un collaborateur</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Heure</label>
              <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Durée</label>
              <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full px-3 py-2.5 border rounded-lg text-sm">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 heure</option>
                <option value={90}>1h30</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lieu</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bureau, Visio..." className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sujets à aborder</label>
            <textarea value={topics} onChange={(e) => setTopics(e.target.value)} rows={3} placeholder="Un sujet par ligne..." className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" />
          </div>
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}Planifier
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// EVALUATION VIEW MODAL
// =============================================

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

// =============================================
// EVALUATION EDIT MODAL
// =============================================

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

  const canEdit = canUserEditEvaluation(evaluation, userRole, currentEmployeeId);
  const canValidate = canUserValidateEvaluation(evaluation, userRole);
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
          {evaluation.status === 'submitted' && !canValidate && !canEdit && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg">Cette évaluation est en attente de validation.</div>
          )}
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
// SECONDARY MENU ITEM (Style Mon Espace - Dark)
// =============================================

function SecondaryMenuItem({ icon: Icon, label, isActive, onClick }: {
  icon: React.ElementType; label: string; isActive: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all text-sm ${
        isActive
          ? 'bg-primary-500 text-white'
          : 'text-gray-300 hover:bg-white/10'
      }`}
    >
      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
      <span className="font-medium">{label}</span>
    </button>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('feedback');
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [campaigns, setCampaigns] = useState<EvaluationCampaign[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [searchFeedback, setSearchFeedback] = useState('');
  const [searchCampaign, setSearchCampaign] = useState('');
  const [searchEvaluation, setSearchEvaluation] = useState('');
  const [searchOneOnOne, setSearchOneOnOne] = useState('');
  const [filterCampaignStatus, setFilterCampaignStatus] = useState<string>('all');
  const [filterEvalStatus, setFilterEvalStatus] = useState<string>('all');
  
  // Pagination
  const [pageFeedback, setPageFeedback] = useState(1);
  const [pageCampaign, setPageCampaign] = useState(1);
  const [pageEvaluation, setPageEvaluation] = useState(1);
  const [pageOneOnOne, setPageOneOnOne] = useState(1);
  
  // Modals
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showOneOnOneModal, setShowOneOnOneModal] = useState(false);
  const [showEvalViewModal, setShowEvalViewModal] = useState(false);
  const [showEvalEditModal, setShowEvalEditModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  const { showTips, dismissTips, resetTips } = usePageTour('performance1');

  const loadData = useCallback(async () => {
    setLoading(true);
    const user = await fetchCurrentUser();
    if (user) { setCurrentUser(user); setUserRole(normalizeRole(user.role)); }
    const [statsData, feedbacksData, campaignsData, evaluationsData, oneOnOnesData, employeesData] = await Promise.all([
      fetchMyStats(), fetchFeedbacks(), fetchCampaigns(), fetchEvaluations(), fetchOneOnOnes(), fetchEmployees()
    ]);
    setStats(statsData); setFeedbacks(feedbacksData); setCampaigns(campaignsData);
    setEvaluations(evaluationsData); setOneOnOnes(oneOnOnesData); setEmployees(employeesData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered & Paginated Data
  const filteredFeedbacks = feedbacks.filter(f => 
    (f.from_employee_name?.toLowerCase().includes(searchFeedback.toLowerCase()) ||
     f.to_employee_name?.toLowerCase().includes(searchFeedback.toLowerCase()) ||
     f.message.toLowerCase().includes(searchFeedback.toLowerCase()))
  );
  const paginatedFeedbacks = filteredFeedbacks.slice((pageFeedback - 1) * ITEMS_PER_PAGE, pageFeedback * ITEMS_PER_PAGE);
  const totalPagesFeedback = Math.ceil(filteredFeedbacks.length / ITEMS_PER_PAGE);

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchCampaign.toLowerCase()) &&
    (filterCampaignStatus === 'all' || c.status === filterCampaignStatus)
  );
  const paginatedCampaigns = filteredCampaigns.slice((pageCampaign - 1) * ITEMS_PER_PAGE, pageCampaign * ITEMS_PER_PAGE);
  const totalPagesCampaign = Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE);

  const filteredEvaluations = evaluations.filter(e => 
    (e.employee_name?.toLowerCase().includes(searchEvaluation.toLowerCase()) ||
     e.employee_department?.toLowerCase().includes(searchEvaluation.toLowerCase())) &&
    (filterEvalStatus === 'all' || e.status === filterEvalStatus)
  );
  const paginatedEvaluations = filteredEvaluations.slice((pageEvaluation - 1) * ITEMS_PER_PAGE, pageEvaluation * ITEMS_PER_PAGE);
  const totalPagesEvaluation = Math.ceil(filteredEvaluations.length / ITEMS_PER_PAGE);

  const filteredOneOnOnes = oneOnOnes.filter(o => 
    o.employee_name?.toLowerCase().includes(searchOneOnOne.toLowerCase()) ||
    o.manager_name?.toLowerCase().includes(searchOneOnOne.toLowerCase())
  );
  const paginatedOneOnOnes = filteredOneOnOnes.slice((pageOneOnOne - 1) * ITEMS_PER_PAGE, pageOneOnOne * ITEMS_PER_PAGE);
  const totalPagesOneOnOne = Math.ceil(filteredOneOnOnes.length / ITEMS_PER_PAGE);

  const canManageCampaigns = ['admin', 'rh', 'dg'].includes(userRole);
  const canScheduleOneOnOne = ['admin', 'rh', 'dg', 'manager'].includes(userRole);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips tips={performance1Tips} onDismiss={dismissTips} pageTitle="Performance" />
      )}
      <RestartPageTipsButton onClick={resetTips} />
      <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Secondary Sidebar Menu - Style Mon Espace (Dark) */}
        <div className="w-56 bg-[#1e2a3b] min-h-screen sticky top-0">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-white" />
              <span className="font-semibold text-white">Performance</span>
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="p-3 space-y-1">
            <SecondaryMenuItem
              icon={MessageSquare}
              label="Feedback Continu"
              isActive={activeTab === 'feedback'}
              onClick={() => setActiveTab('feedback')}
            />
            <SecondaryMenuItem
              icon={Target}
              label="Campagnes"
              isActive={activeTab === 'campaigns'}
              onClick={() => setActiveTab('campaigns')}
            />
            <SecondaryMenuItem
              icon={Star}
              label="Évaluations"
              isActive={activeTab === 'evaluations'}
              onClick={() => setActiveTab('evaluations')}
            />
            <SecondaryMenuItem
              icon={TrendingUp}
              label="Objectifs"
              isActive={activeTab === 'objectives'}
              onClick={() => setActiveTab('objectives')}
            />
            <SecondaryMenuItem
              icon={Users}
              label="1-on-1"
              isActive={activeTab === 'one-on-one'}
              onClick={() => setActiveTab('one-on-one')}
            />
          </div>
          
          {/* Retour au menu */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
            <a href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
              <ChevronLeft className="w-4 h-4" />
              <span>Retour au menu</span>
            </a>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8" data-tour="performance-stats">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Score Moyen</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avg_score > 0 ? `${stats.avg_score}/5` : '-'}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Évaluations</p>
                <p className="text-2xl font-bold text-green-600">{stats.evaluations_completed}/{stats.evaluations_total}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Feedbacks</p>
                <p className="text-2xl font-bold text-purple-600">{stats.feedbacks_received}</p>
                <p className="text-xs text-gray-400">{stats.feedbacks_given} donnés</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">OKRs</p>
                <p className="text-2xl font-bold text-orange-600">{stats.okr_achievement}%</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">1-on-1</p>
                <p className="text-2xl font-bold text-blue-600">{stats.one_on_ones_scheduled}</p>
                <p className="text-xs text-gray-400">{stats.one_on_ones_completed} complétés</p>
              </div>
            </div>
          )}

          {/* TAB: Feedback Continu */}
          {activeTab === 'feedback' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Feedback Continu</h1>
                  <p className="text-gray-500 mt-1">Partagez et recevez des feedbacks</p>
                </div>
                <button onClick={() => setShowFeedbackModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4" />Nouveau Feedback
                </button>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-6">
                  <SearchBar value={searchFeedback} onChange={(v) => { setSearchFeedback(v); setPageFeedback(1); }} placeholder="Rechercher un feedback..." />
                </div>
                <div className="space-y-4">
                  {paginatedFeedbacks.length > 0 ? paginatedFeedbacks.map(fb => (
                    <FeedbackCard key={fb.id} feedback={fb} onLike={() => {}} />
                  )) : (
                    <p className="text-gray-500 text-center py-8">Aucun feedback trouvé</p>
                  )}
                </div>
                <Pagination currentPage={pageFeedback} totalPages={totalPagesFeedback} onPageChange={setPageFeedback} />
              </div>
            </>
          )}

          {/* TAB: Campagnes */}
          {activeTab === 'campaigns' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Campagnes d&apos;Évaluation</h1>
                  <p className="text-gray-500 mt-1">Gérez les campagnes d&apos;évaluation</p>
                </div>
                {canManageCampaigns && (
                  <button onClick={() => setShowCampaignModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600">
                    <Plus className="w-4 h-4" />Nouvelle Campagne
                  </button>
                )}
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <SearchBar value={searchCampaign} onChange={(v) => { setSearchCampaign(v); setPageCampaign(1); }} placeholder="Rechercher une campagne..." />
                  </div>
                  <select value={filterCampaignStatus} onChange={(e) => { setFilterCampaignStatus(e.target.value); setPageCampaign(1); }} className="px-3 py-2 border rounded-lg text-sm">
                    <option value="all">Tous les statuts</option>
                    <option value="draft">Brouillon</option>
                    <option value="active">Actif</option>
                    <option value="completed">Terminé</option>
                  </select>
                </div>
                <div className="space-y-4">
                  {paginatedCampaigns.length > 0 ? paginatedCampaigns.map(campaign => (
                    <div key={campaign.id} className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                          <p className="text-sm text-gray-500">{getTypeLabel(campaign.type)} • {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>{getStatusLabel(campaign.status)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${campaign.progress_percentage}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-600">{campaign.completed_evaluations}/{campaign.total_evaluations}</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center py-8">Aucune campagne trouvée</p>
                  )}
                </div>
                <Pagination currentPage={pageCampaign} totalPages={totalPagesCampaign} onPageChange={setPageCampaign} />
              </div>
            </>
          )}

          {/* TAB: Évaluations */}
          {activeTab === 'evaluations' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">{userRole === 'employee' ? 'Mes Évaluations' : 'Évaluations'}</h1>
                <p className="text-gray-500 mt-1">Consultez et gérez les évaluations</p>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <SearchBar value={searchEvaluation} onChange={(v) => { setSearchEvaluation(v); setPageEvaluation(1); }} placeholder="Rechercher une évaluation..." />
                  </div>
                  <select value={filterEvalStatus} onChange={(e) => { setFilterEvalStatus(e.target.value); setPageEvaluation(1); }} className="px-3 py-2 border rounded-lg text-sm">
                    <option value="all">Tous les statuts</option>
                    <option value="pending">En attente</option>
                    <option value="in_progress">En cours</option>
                    <option value="submitted">Soumis</option>
                    <option value="validated">Validé</option>
                  </select>
                </div>
                <div className="space-y-3">
                  {paginatedEvaluations.length > 0 ? paginatedEvaluations.map(evaluation => {
                    const canEdit = canUserEditEvaluation(evaluation, userRole, currentUser?.employee_id);
                    const canValidate = canUserValidateEvaluation(evaluation, userRole);
                    return (
                      <div key={evaluation.id} className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm">
                            {evaluation.employee_initials || getInitials(evaluation.employee_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900">{evaluation.employee_name}</h3>
                            <p className="text-sm text-gray-500">{evaluation.employee_job_title} • {evaluation.employee_department}</p>
                            <p className="text-xs text-gray-400 mt-1">{getTypeLabel(evaluation.type)} {evaluation.due_date && `• Deadline: ${formatDate(evaluation.due_date)}`}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(evaluation.status)}`}>{getStatusLabel(evaluation.status)}</span>
                            {evaluation.overall_score && <span className="font-bold text-primary-600">{evaluation.overall_score}/5</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <button onClick={() => { setSelectedEvaluation(evaluation); setShowEvalViewModal(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                            <Eye className="w-4 h-4" />Voir
                          </button>
                          {canEdit && (
                            <button onClick={() => { setSelectedEvaluation(evaluation); setShowEvalEditModal(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg">
                              <Edit className="w-4 h-4" />Éditer
                            </button>
                          )}
                          {canValidate && (
                            <button onClick={() => { setSelectedEvaluation(evaluation); setShowEvalEditModal(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg">
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
                <Pagination currentPage={pageEvaluation} totalPages={totalPagesEvaluation} onPageChange={setPageEvaluation} />
              </div>
            </>
          )}

          {/* TAB: Objectifs */}
          {activeTab === 'objectives' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Objectifs & OKRs</h1>
                <p className="text-gray-500 mt-1">Gérez vos objectifs et résultats clés</p>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <a href="/dashboard/okr" className="flex items-center justify-between p-4 border rounded-xl hover:shadow-md hover:border-primary-300 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-100 rounded-xl group-hover:bg-primary-200 transition-colors">
                      <Target className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">OKR & Objectifs</h3>
                      <p className="text-sm text-gray-500">Gérer vos objectifs et résultats clés</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500" />
                </a>
                
                {stats && (
                  <div className="mt-6 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Taux d&apos;atteinte des OKRs</p>
                        <p className="text-4xl font-bold text-orange-600 mt-1">{stats.okr_achievement}%</p>
                      </div>
                      <div className="w-20 h-20 rounded-full border-4 border-orange-200 flex items-center justify-center bg-white">
                        <span className="text-xl font-bold text-orange-600">{stats.okr_achievement}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB: 1-on-1 */}
          {activeTab === 'one-on-one' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Entretiens 1-on-1</h1>
                  <p className="text-gray-500 mt-1">Planifiez et gérez vos entretiens individuels</p>
                </div>
                {canScheduleOneOnOne && (
                  <button onClick={() => setShowOneOnOneModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600">
                    <Plus className="w-4 h-4" />Planifier un 1-on-1
                  </button>
                )}
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-6">
                  <SearchBar value={searchOneOnOne} onChange={(v) => { setSearchOneOnOne(v); setPageOneOnOne(1); }} placeholder="Rechercher un entretien..." />
                </div>
                <div className="space-y-3">
                  {paginatedOneOnOnes.length > 0 ? paginatedOneOnOnes.map(meeting => (
                    <div key={meeting.id} className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                          {meeting.employee_initials || getInitials(meeting.employee_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900">{meeting.employee_name}</h3>
                          <p className="text-sm text-gray-500">avec {meeting.manager_name}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(meeting.scheduled_date)}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{meeting.duration_minutes} min</span>
                            {meeting.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{meeting.location}</span>}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>{getStatusLabel(meeting.status)}</span>
                      </div>
                      {meeting.topics && meeting.topics.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-gray-500 mb-1">Sujets:</p>
                          <div className="flex flex-wrap gap-1">
                            {meeting.topics.map((topic, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{topic}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center py-8">Aucun 1-on-1 trouvé</p>
                  )}
                </div>
                <Pagination currentPage={pageOneOnOne} totalPages={totalPagesOneOnOne} onPageChange={setPageOneOnOne} />
              </div>
            </>
          )}
        </div>
      </div>
      </div>

      {/* Modals */}
      <CreateFeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} employees={employees} onSuccess={loadData} />
      <CreateCampaignModal isOpen={showCampaignModal} onClose={() => setShowCampaignModal(false)} employees={employees} onSuccess={loadData} />
      <CreateOneOnOneModal isOpen={showOneOnOneModal} onClose={() => setShowOneOnOneModal(false)} employees={employees} onSuccess={loadData} />
      <EvaluationViewModal isOpen={showEvalViewModal} onClose={() => setShowEvalViewModal(false)} evaluation={selectedEvaluation} />
      <EvaluationEditModal isOpen={showEvalEditModal} onClose={() => setShowEvalEditModal(false)} evaluation={selectedEvaluation} onSave={loadData} userRole={userRole} currentEmployeeId={currentUser?.employee_id} />
    </>
  );
}