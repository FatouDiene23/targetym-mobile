'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, Star, Users, Calendar, ChevronRight, Plus, MessageSquare, Award, Target, CheckCircle,
  Send, ThumbsUp, Eye, Edit, User, X, Loader2, ExternalLink, AlertCircle, RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Cell 
} from 'recharts';

// =============================================
// TYPES
// =============================================

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'super_admin' | 'dg';

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
}

interface EvaluationCampaign {
  id: number;
  name: string;
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

// =============================================
// API CONFIG
// =============================================

const API_URL = 'https://web-production-06c3.up.railway.app';

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
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchMyStats(): Promise<MyStats> {
  try {
    const response = await fetch(`${API_URL}/api/performance/my-stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('API error');
    return response.json();
  } catch {
    return {
      scope: 'personal',
      avg_score: 0,
      evaluations_total: 0,
      evaluations_completed: 0,
      evaluations_pending: 0,
      evaluations_in_progress: 0,
      completion_rate: 0,
      feedbacks_received: 0,
      feedbacks_given: 0,
      one_on_ones_scheduled: 0,
      one_on_ones_completed: 0,
      okr_achievement: 0,
      team_size: 0
    };
  }
}

async function fetchFeedbacks(): Promise<FeedbackItem[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks?page_size=50`, {
      headers: getAuthHeaders(),
    });
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
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la création du feedback' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion au serveur' };
  }
}

async function likeFeedback(feedbackId: number): Promise<number> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks/${feedbackId}/like`, {
      method: 'POST',
      headers: getAuthHeaders(),
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
    const response = await fetch(`${API_URL}/api/performance/campaigns?page_size=50`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchEvaluations(): Promise<Evaluation[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/evaluations?page_size=100`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchOneOnOnes(): Promise<OneOnOne[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones?page_size=50`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/?page_size=200&status=active`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function createCampaign(data: {
  name: string;
  description?: string;
  type: string;
  start_date: string;
  end_date: string;
  employee_ids?: number[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/campaigns`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la création de la campagne' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion au serveur' };
  }
}

async function submitEvaluation(evaluationId: number, data: {
  scores: Record<string, { score: number; comment?: string }>;
  overall_score: number;
  strengths?: string;
  improvements?: string;
  goals?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/evaluations/${evaluationId}/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errorMsg = 'Erreur lors de la soumission';
      if (typeof errorData.detail === 'string') {
        errorMsg = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMsg = errorData.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
      }
      return { success: false, error: errorMsg };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion au serveur' };
  }
}

async function validateEvaluation(evaluationId: number, data: {
  approved: boolean;
  manager_comments?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/evaluations/${evaluationId}/validate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la validation' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion au serveur' };
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
    case 'active': return 'bg-primary-100 text-primary-700';
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
    default: return status;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
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
  // Seul l'employé peut éditer son auto-évaluation si status = pending ou in_progress
  if (evaluation.status === 'pending' || evaluation.status === 'in_progress') {
    if (evaluation.type === 'self' && evaluation.employee_id === currentEmployeeId) {
      return true;
    }
  }
  return false;
}

function canUserValidateEvaluation(evaluation: Evaluation, userRole: UserRole): boolean {
  // Manager ou RH peuvent valider si status = submitted
  if (evaluation.status === 'submitted') {
    if (userRole === 'manager' || userRole === 'rh' || userRole === 'admin' || userRole === 'dg') {
      return true;
    }
  }
  return false;
}

function getScopeLabel(scope: string): string {
  switch (scope) {
    case 'personal': return 'Mes statistiques';
    case 'team': return 'Mon équipe';
    case 'global': return 'Entreprise';
    default: return '';
  }
}

// =============================================
// STAT CARD COMPONENT
// =============================================

function StatCard({ title, value, subValue, icon, color }: { 
  title: string; 
  value: string | number; 
  subValue?: string;
  icon: React.ReactNode; 
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-700', '-100')}`}>
          {icon}
        </div>
      </div>
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
    if (newCount >= 0) {
      setLikes(newCount);
      setLiked(!liked);
      onLike(feedback.id);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Il y a moins d\'1h';
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${Math.floor(hours / 24)}j`;
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all">
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
              <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
              <span>{likes}</span>
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
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSuccess: () => void;
}) {
  const [toEmployee, setToEmployee] = useState('');
  const [feedbackType, setFeedbackType] = useState<'recognition' | 'improvement' | 'general'>('recognition');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!toEmployee || !message.trim()) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (message.length < 10) {
      setError('Le message doit contenir au moins 10 caractères');
      return;
    }

    setError('');
    setSaving(true);
    
    const result = await createFeedback({
      to_employee_id: parseInt(toEmployee),
      type: feedbackType,
      message: message.trim(),
      is_public: isPublic
    });

    setSaving(false);
    
    if (result.success) {
      setToEmployee('');
      setMessage('');
      setFeedbackType('recognition');
      setIsPublic(true);
      onSuccess();
      onClose();
    } else {
      setError(result.error || 'Erreur lors de la création');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nouveau Feedback</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destinataire *</label>
            <select value={toEmployee} onChange={(e) => setToEmployee(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
              <option value="">Sélectionner un collègue</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de feedback</label>
            <div className="flex gap-2">
              {[
                { value: 'recognition', label: '🎉 Reconnaissance', color: 'bg-green-100 text-green-700 border-green-300' },
                { value: 'improvement', label: '💡 Amélioration', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
                { value: 'general', label: '💬 Général', color: 'bg-gray-100 text-gray-700 border-gray-300' },
              ].map(type => (
                <button key={type.value} onClick={() => setFeedbackType(type.value as any)} className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${feedbackType === type.value ? type.color : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Partagez votre feedback..." className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none" />
            <p className="text-xs text-gray-400 mt-1">{message.length}/2000 caractères (min. 10)</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
            <span className="text-sm text-gray-700">Feedback public (visible par tous)</span>
          </label>
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors flex items-center disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Envoyer
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
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSuccess: () => void;
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
    if (!name || !startDate || !endDate) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setError('');
    setSaving(true);
    
    const result = await createCampaign({
      name,
      description: description || undefined,
      type: campaignType,
      start_date: startDate,
      end_date: endDate,
      employee_ids: selectedEmployees.length > 0 ? selectedEmployees : undefined
    });

    setSaving(false);
    
    if (result.success) {
      setName('');
      setDescription('');
      setCampaignType('annual');
      setStartDate('');
      setEndDate('');
      setSelectedEmployees([]);
      onSuccess();
      onClose();
    } else {
      setError(result.error || 'Erreur lors de la création');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">Nouvelle Campagne d&apos;Évaluation</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom de la campagne *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Évaluation Annuelle 2025" className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description optionnelle..." className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select value={campaignType} onChange={(e) => setCampaignType(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
              <option value="annual">Évaluation Annuelle</option>
              <option value="mid_year">Évaluation Mi-Année</option>
              <option value="360">Feedback 360°</option>
              <option value="probation">Fin de Période d&apos;Essai</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de début *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin *</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employés concernés</label>
            <p className="text-xs text-gray-500 mb-2">Laissez vide pour inclure tous les employés actifs</p>
            <select multiple value={selectedEmployees.map(String)} onChange={(e) => setSelectedEmployees(Array.from(e.target.selectedOptions, o => parseInt(o.value)))} className="w-full px-3 py-2.5 border rounded-lg text-sm h-32">
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors flex items-center disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Créer
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
  isOpen: boolean;
  onClose: () => void;
  evaluation: Evaluation | null;
}) {
  if (!isOpen || !evaluation) return null;

  const radarData = evaluation.scores ? Object.entries(evaluation.scores).map(([name, data]) => ({
    subject: name.length > 15 ? name.substring(0, 15) + '...' : name,
    score: data.score,
    fullMark: 100
  })) : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Détails de l&apos;Évaluation</h2>
            <p className="text-sm text-gray-500">{evaluation.employee_name} - {evaluation.employee_job_title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium text-gray-900">{getTypeLabel(evaluation.type)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(evaluation.status)}`}>
                {getStatusLabel(evaluation.status)}
              </span>
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
              <div className="mt-4 space-y-2">
                {Object.entries(evaluation.scores || {}).map(([name, data]) => (
                  <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${data.score}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-12 text-right">{data.score}%</span>
                    </div>
                  </div>
                ))}
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
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// EVALUATION EDIT MODAL
// =============================================

function EvaluationEditModal({ isOpen, onClose, evaluation, onSave, userRole, currentEmployeeId }: {
  isOpen: boolean;
  onClose: () => void;
  evaluation: Evaluation | null;
  onSave: () => void;
  userRole: UserRole;
  currentEmployeeId?: number;
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
        Object.entries(evaluation.scores).forEach(([key, val]) => {
          initialScores[key] = { score: val.score, comment: val.comment || '' };
        });
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
    setError(''); 
    setSaving(true);
    const result = await submitEvaluation(evaluation.id, { 
      scores, 
      overall_score: calculateOverall(),
      strengths: strengths || undefined,
      improvements: improvements || undefined,
      goals: goals || undefined
    });
    setSaving(false);
    if (result.success) { onSave(); onClose(); }
    else setError(result.error || 'Erreur');
  };

  const handleValidate = async (approved: boolean) => {
    if (!evaluation) return;
    setError(''); 
    setSaving(true);
    const result = await validateEvaluation(evaluation.id, { approved, manager_comments: managerComments || undefined });
    setSaving(false);
    if (result.success) { onSave(); onClose(); }
    else setError(result.error || 'Erreur');
  };

  if (!isOpen || !evaluation) return null;

  const canEdit = canUserEditEvaluation(evaluation, userRole, currentEmployeeId);
  const canValidate = canUserValidateEvaluation(evaluation, userRole);
  const isReadOnly = !canEdit && !canValidate;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {canValidate ? 'Valider l\'Évaluation' : canEdit ? 'Éditer l\'Évaluation' : 'Voir l\'Évaluation'}
            </h2>
            <p className="text-sm text-gray-500">{evaluation.employee_name} - {evaluation.employee_job_title}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(evaluation.status)}`}>
              {getStatusLabel(evaluation.status)}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-5 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />{error}
            </div>
          )}

          {/* Info si en lecture seule */}
          {isReadOnly && (
            <div className="p-3 bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-lg">
              Cette évaluation est en lecture seule. Status: <strong>{getStatusLabel(evaluation.status)}</strong>
            </div>
          )}

          {/* Info si en attente de validation */}
          {evaluation.status === 'submitted' && !canValidate && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg">
              Cette évaluation a été soumise et est en attente de validation par un Manager ou RH.
            </div>
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
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={data.score} 
                    onChange={(e) => setScores(prev => ({ ...prev, [comp]: { ...prev[comp], score: Number(e.target.value) } }))} 
                    disabled={!canEdit} 
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500 disabled:opacity-50" 
                  />
                  <input 
                    type="text" 
                    placeholder="Commentaire (optionnel)" 
                    value={data.comment} 
                    onChange={(e) => setScores(prev => ({ ...prev, [comp]: { ...prev[comp], comment: e.target.value } }))} 
                    disabled={!canEdit} 
                    className="w-full mt-2 px-3 py-2 text-sm border rounded-lg disabled:bg-gray-50" 
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-primary-50 rounded-lg text-center">
              <span className="text-sm text-gray-600">Score Global:</span>
              <span className="text-2xl font-bold text-primary-600 ml-2">{calculateOverall()}/5</span>
            </div>
          </div>

          {/* Champs pour l'employé */}
          {canEdit && (
            <>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Points Forts</h4>
                <textarea 
                  value={strengths} 
                  onChange={(e) => setStrengths(e.target.value)} 
                  rows={2} 
                  placeholder="Décrivez vos points forts..." 
                  className="w-full px-3 py-2 text-sm border rounded-lg" 
                />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Axes d&apos;Amélioration</h4>
                <textarea 
                  value={improvements} 
                  onChange={(e) => setImprovements(e.target.value)} 
                  rows={2} 
                  placeholder="Identifiez vos axes d'amélioration..." 
                  className="w-full px-3 py-2 text-sm border rounded-lg" 
                />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Objectifs</h4>
                <textarea 
                  value={goals} 
                  onChange={(e) => setGoals(e.target.value)} 
                  rows={2} 
                  placeholder="Vos objectifs pour la prochaine période..." 
                  className="w-full px-3 py-2 text-sm border rounded-lg" 
                />
              </div>
            </>
          )}

          {/* Affichage lecture seule des champs soumis */}
          {!canEdit && evaluation.strengths && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Points Forts</h4>
              <p className="text-sm text-gray-700 bg-green-50 p-3 rounded-lg">{evaluation.strengths}</p>
            </div>
          )}
          {!canEdit && evaluation.improvements && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Axes d&apos;Amélioration</h4>
              <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg">{evaluation.improvements}</p>
            </div>
          )}
          {!canEdit && evaluation.goals && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Objectifs</h4>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">{evaluation.goals}</p>
            </div>
          )}

          {/* Commentaires Manager (pour validation) */}
          {canValidate && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Commentaires du Manager/RH</h4>
              <textarea 
                value={managerComments} 
                onChange={(e) => setManagerComments(e.target.value)} 
                rows={3} 
                placeholder="Vos commentaires pour l'employé..." 
                className="w-full px-3 py-2 text-sm border rounded-lg" 
              />
            </div>
          )}

          {/* Affichage commentaires manager existants */}
          {!canValidate && evaluation.manager_comments && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Commentaires du Manager</h4>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">{evaluation.manager_comments}</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">
            {isReadOnly ? 'Fermer' : 'Annuler'}
          </button>
          
          {/* Bouton Soumettre - uniquement si l'employé peut éditer */}
          {canEdit && (
            <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50 hover:bg-primary-600">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Soumettre
            </button>
          )}
          
          {/* Boutons Renvoyer/Valider - uniquement pour Manager/RH si status = submitted */}
          {canValidate && (
            <>
              <button onClick={() => handleValidate(false)} disabled={saving} className="px-4 py-2 border border-orange-500 text-orange-600 text-sm rounded-lg hover:bg-orange-50 flex items-center">
                <RotateCcw className="w-4 h-4 mr-2" />
                Renvoyer
              </button>
              <button onClick={() => handleValidate(true)} disabled={saving} className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50 hover:bg-green-600">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Valider
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState<'feedback' | 'evaluations' | 'objectives'>('feedback');
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [campaigns, setCampaigns] = useState<EvaluationCampaign[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showEvalViewModal, setShowEvalViewModal] = useState(false);
  const [showEvalEditModal, setShowEvalEditModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // Charger l'utilisateur courant
    const user = await fetchCurrentUser();
    if (user) {
      setCurrentUser(user);
      setUserRole(normalizeRole(user.role));
    }
    
    // Charger toutes les données en parallèle
    const [statsData, feedbacksData, campaignsData, evaluationsData, oneOnOnesData, employeesData] = await Promise.all([
      fetchMyStats(),
      fetchFeedbacks(),
      fetchCampaigns(),
      fetchEvaluations(),
      fetchOneOnOnes(),
      fetchEmployees()
    ]);
    
    setStats(statsData);
    setFeedbacks(feedbacksData);
    setCampaigns(campaignsData);
    setEvaluations(evaluationsData);
    setOneOnOnes(oneOnOnesData);
    setEmployees(employeesData);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleViewEvaluation = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    setShowEvalViewModal(true);
  };

  const handleEditEvaluation = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    setShowEvalEditModal(true);
  };

  // Déterminer quels boutons afficher pour une évaluation
  const getEvaluationActions = (evaluation: Evaluation) => {
    const canEdit = canUserEditEvaluation(evaluation, userRole, currentUser?.employee_id);
    const canValidate = canUserValidateEvaluation(evaluation, userRole);
    
    return { canEdit, canValidate };
  };

  const canManageCampaigns = ['admin', 'rh', 'dg'].includes(userRole);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Performance & Feedback</h1>
          <p className="text-gray-500">Évaluations, feedback continu, objectifs et entretiens</p>
          {stats && (
            <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              {getScopeLabel(stats.scope)}
            </span>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatCard 
              title="Score Moyen" 
              value={stats.avg_score > 0 ? `${stats.avg_score}/5` : '-'} 
              icon={<Star className="w-5 h-5 text-yellow-600" />} 
              color="text-gray-900" 
            />
            <StatCard 
              title="Évaluations" 
              value={`${stats.evaluations_completed}/${stats.evaluations_total}`} 
              subValue={stats.evaluations_total > 0 ? `${Math.round(stats.completion_rate)}% complétées` : undefined}
              icon={<CheckCircle className="w-5 h-5 text-green-600" />} 
              color="text-green-600" 
            />
            <StatCard 
              title="Feedbacks (Reçus)" 
              value={stats.feedbacks_received} 
              subValue={`${stats.feedbacks_given} donnés`}
              icon={<MessageSquare className="w-5 h-5 text-purple-600" />} 
              color="text-purple-600" 
            />
            <StatCard 
              title="OKRs Atteints" 
              value={`${stats.okr_achievement}%`} 
              icon={<Target className="w-5 h-5 text-orange-600" />} 
              color="text-orange-600" 
            />
            <StatCard 
              title="1-on-1 (Planifiés)" 
              value={stats.one_on_ones_scheduled} 
              subValue={`${stats.one_on_ones_completed} complétés`}
              icon={<Users className="w-5 h-5 text-blue-600" />} 
              color="text-blue-600" 
            />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b">
            {[
              { id: 'feedback', label: 'Feedback Continu', icon: MessageSquare },
              { id: 'evaluations', label: 'Évaluations', icon: Star },
              { id: 'objectives', label: 'Objectifs', icon: Target },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'text-primary-600 border-b-2 border-primary-500' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Feedback Tab */}
            {activeTab === 'feedback' && (
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Feedbacks Récents</h2>
                  <button onClick={() => setShowFeedbackModal(true)} className="flex items-center gap-2 px-3 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600">
                    <Plus className="w-4 h-4" />
                    Nouveau
                  </button>
                </div>
                
                <div className="space-y-4">
                  {feedbacks.length > 0 ? feedbacks.slice(0, 10).map(fb => (
                    <FeedbackCard key={fb.id} feedback={fb} onLike={() => {}} />
                  )) : (
                    <p className="text-gray-500 text-center py-8">Aucun feedback pour le moment</p>
                  )}
                </div>
              </div>
            )}

            {/* Evaluations Tab */}
            {activeTab === 'evaluations' && (
              <>
                {/* Campaigns Section (RH/Admin only) */}
                {canManageCampaigns && (
                  <div className="bg-white rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Campagnes d&apos;Évaluation</h2>
                      <button onClick={() => setShowCampaignModal(true)} className="flex items-center gap-2 px-3 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600">
                        <Plus className="w-4 h-4" />
                        Nouvelle Campagne
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {campaigns.length > 0 ? campaigns.map(campaign => (
                        <div key={campaign.id} className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h3 className="font-medium text-gray-900">{campaign.name}</h3>
                              <p className="text-sm text-gray-500">{getTypeLabel(campaign.type)} • {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                              {getStatusLabel(campaign.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${campaign.progress_percentage}%` }} />
                            </div>
                            <span className="text-sm text-gray-600">{campaign.completed_evaluations}/{campaign.total_evaluations}</span>
                          </div>
                        </div>
                      )) : (
                        <p className="text-gray-500 text-center py-4">Aucune campagne</p>
                      )}
                    </div>
                  </div>
                )}

                {/* My Evaluations */}
                <div className="bg-white rounded-xl p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    {userRole === 'employee' ? 'Mes Évaluations' : 'Évaluations'}
                  </h2>
                  
                  <div className="space-y-3">
                    {evaluations.length > 0 ? evaluations.map(evaluation => {
                      const { canEdit, canValidate } = getEvaluationActions(evaluation);
                      
                      return (
                        <div key={evaluation.id} className="p-4 border rounded-lg hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm">
                              {evaluation.employee_initials || getInitials(evaluation.employee_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900">{evaluation.employee_name}</h3>
                              <p className="text-sm text-gray-500">{evaluation.employee_job_title} • {evaluation.employee_department}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                Type: {getTypeLabel(evaluation.type)} 
                                {evaluation.due_date && ` • Deadline: ${formatDate(evaluation.due_date)}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(evaluation.status)}`}>
                                {getStatusLabel(evaluation.status)}
                              </span>
                              {evaluation.overall_score && (
                                <span className="font-bold text-primary-600">{evaluation.overall_score}/5</span>
                              )}
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-3 pt-3 border-t">
                            <button onClick={() => handleViewEvaluation(evaluation)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                              <Eye className="w-4 h-4" />
                              Voir
                            </button>
                            
                            {/* Bouton Éditer - seulement si l'employé peut éditer */}
                            {canEdit && (
                              <button onClick={() => handleEditEvaluation(evaluation)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg">
                                <Edit className="w-4 h-4" />
                                Éditer
                              </button>
                            )}
                            
                            {/* Boutons Valider/Renvoyer - seulement pour Manager/RH si soumis */}
                            {canValidate && (
                              <button onClick={() => handleEditEvaluation(evaluation)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg">
                                <CheckCircle className="w-4 h-4" />
                                Valider / Renvoyer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-gray-500 text-center py-8">Aucune évaluation</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Objectives Tab */}
            {activeTab === 'objectives' && (
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Objectifs & 1-on-1</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-700 mb-3">Prochains 1-on-1</h3>
                    {oneOnOnes.filter(o => o.status === 'scheduled').length > 0 ? (
                      oneOnOnes.filter(o => o.status === 'scheduled').slice(0, 5).map(meeting => (
                        <div key={meeting.id} className="p-3 border rounded-lg mb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-xs">
                                {meeting.employee_initials || getInitials(meeting.employee_name)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{meeting.employee_name}</p>
                                <p className="text-xs text-gray-500">{formatDate(meeting.scheduled_date)} • {meeting.duration_minutes} min</p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>
                              {getStatusLabel(meeting.status)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">Aucun 1-on-1 planifié</p>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t">
                    <Link href="/okr" className="flex items-center justify-between p-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <Target className="w-5 h-5 text-primary-600" />
                        <span className="font-medium text-primary-700">Voir mes OKRs</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-primary-400" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Card */}
            {currentUser && (
              <div className="bg-white rounded-xl p-5 shadow-sm text-center">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-xl mx-auto mb-3">
                  {currentUser.email.charAt(0).toUpperCase()}
                </div>
                <h3 className="font-semibold text-gray-900">{currentUser.email.split('@')[0]}</h3>
                <p className="text-sm text-gray-500 capitalize">{userRole}</p>
                
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setShowEvalViewModal(true)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600">
                    <Eye className="w-4 h-4" />
                    Voir
                  </button>
                  <button onClick={() => {}} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                    <Edit className="w-4 h-4" />
                    Éditer
                  </button>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            {stats && stats.scope === 'team' && stats.team_size > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Mon Équipe</h3>
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary-600">{stats.team_size}</p>
                    <p className="text-sm text-gray-500">collaborateurs</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateFeedbackModal 
        isOpen={showFeedbackModal} 
        onClose={() => setShowFeedbackModal(false)} 
        employees={employees}
        onSuccess={loadData}
      />
      
      <CreateCampaignModal 
        isOpen={showCampaignModal} 
        onClose={() => setShowCampaignModal(false)} 
        employees={employees}
        onSuccess={loadData}
      />
      
      <EvaluationViewModal 
        isOpen={showEvalViewModal} 
        onClose={() => setShowEvalViewModal(false)} 
        evaluation={selectedEvaluation}
      />
      
      <EvaluationEditModal 
        isOpen={showEvalEditModal} 
        onClose={() => setShowEvalEditModal(false)} 
        evaluation={selectedEvaluation}
        onSave={loadData}
        userRole={userRole}
        currentEmployeeId={currentUser?.employee_id}
      />
    </div>
  );
}