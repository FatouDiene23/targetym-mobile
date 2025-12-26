'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, Star, Users, Calendar, ChevronRight, Plus, MessageSquare, Award, Target, CheckCircle,
  Send, ThumbsUp, Eye, Edit, User, X, Loader2, Clock, AlertCircle, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Cell 
} from 'recharts';

// =============================================
// TYPES
// =============================================

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg';

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

interface PerformanceStats {
  avg_score: number;
  evaluations_total: number;
  evaluations_completed: number;
  feedbacks_this_month: number;
  okr_achievement_avg: number;
  one_on_ones_this_week: number;
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

async function fetchFeedbacks(): Promise<FeedbackItem[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks?page_size=50`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return getMockFeedbacks();
    const data = await response.json();
    return data.items || [];
  } catch {
    return getMockFeedbacks();
  }
}

async function createFeedback(data: { to_employee_id: number; type: string; message: string; is_public: boolean }): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch {
    return false;
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
    if (!response.ok) return getMockCampaigns();
    const data = await response.json();
    return data.items || [];
  } catch {
    return getMockCampaigns();
  }
}

async function fetchEvaluations(): Promise<Evaluation[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/evaluations?page_size=50`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return getMockEvaluations();
    const data = await response.json();
    return data.items || [];
  } catch {
    return getMockEvaluations();
  }
}

async function fetchOneOnOnes(): Promise<OneOnOne[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones?page_size=50`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return getMockOneOnOnes();
    const data = await response.json();
    return data.items || [];
  } catch {
    return getMockOneOnOnes();
  }
}

async function createOneOnOne(data: { employee_id: number; scheduled_date: string; duration_minutes: number; location?: string; topics?: string[] }): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchStats(): Promise<PerformanceStats> {
  try {
    const response = await fetch(`${API_URL}/api/performance/stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return getMockStats();
    return response.json();
  } catch {
    return getMockStats();
  }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/?page_size=200&status=active`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

// =============================================
// MOCK DATA (fallback si API pas encore prête)
// =============================================

function getMockFeedbacks(): FeedbackItem[] {
  return [
    { id: 1, from_employee_id: 1, from_employee_name: 'Fatou Ndiaye', from_employee_initials: 'FN', to_employee_id: 2, to_employee_name: 'Aissatou Ba', to_employee_initials: 'AB', type: 'recognition', message: 'Excellent travail sur le module Analytics ! Ta rigueur et ta créativité ont vraiment fait la différence.', is_public: true, likes_count: 8, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { id: 2, from_employee_id: 3, from_employee_name: 'Amadou Diallo', from_employee_initials: 'AD', to_employee_id: 4, to_employee_name: 'Moussa Sow', to_employee_initials: 'MS', type: 'recognition', message: 'Merci pour ton leadership sur le projet TARGETYM. Ta capacité à coordonner l\'équipe sous pression est remarquable.', is_public: true, likes_count: 12, created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
    { id: 3, from_employee_id: 5, from_employee_name: 'Ibrahima Fall', from_employee_initials: 'IF', to_employee_id: 6, to_employee_name: 'Ousmane Sy', to_employee_initials: 'OS', type: 'improvement', message: 'Je suggère de travailler sur la présentation des rapports commerciaux.', is_public: false, likes_count: 0, created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    { id: 4, from_employee_id: 2, from_employee_name: 'Aissatou Ba', from_employee_initials: 'AB', to_employee_id: 7, to_employee_name: 'Mamadou Mbaye', to_employee_initials: 'MM', type: 'recognition', message: 'Bravo pour ta montée en compétences sur React ! En 6 mois, tu as fait des progrès impressionnants.', is_public: true, likes_count: 5, created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
  ];
}

function getMockCampaigns(): EvaluationCampaign[] {
  return [
    { id: 1, name: 'Évaluation Annuelle 2024', type: 'annual', status: 'active', start_date: '2024-12-01', end_date: '2024-12-31', total_evaluations: 48, completed_evaluations: 33, progress_percentage: 68 },
    { id: 2, name: 'Feedback 360° - Direction', type: '360', status: 'active', start_date: '2024-12-01', end_date: '2024-12-20', total_evaluations: 12, completed_evaluations: 5, progress_percentage: 45 },
    { id: 3, name: 'Évaluation Mi-Année 2024', type: 'mid_year', status: 'completed', start_date: '2024-06-01', end_date: '2024-06-30', total_evaluations: 45, completed_evaluations: 45, progress_percentage: 100 },
  ];
}

function getMockEvaluations(): Evaluation[] {
  return [
    { id: 1, employee_id: 1, employee_name: 'Aissatou Ba', employee_initials: 'AB', employee_department: 'Technologie', employee_job_title: 'Lead Developer', type: 'self', status: 'validated', overall_score: 4.6, due_date: '2024-12-15', scores: { 'Compétences techniques': { score: 95 }, 'Leadership': { score: 85 }, 'Communication': { score: 90 } } },
    { id: 2, employee_id: 2, employee_name: 'Moussa Sow', employee_initials: 'MS', employee_department: 'Technologie', employee_job_title: 'Chef de Projet', type: 'manager', status: 'in_progress', due_date: '2024-12-20', scores: { 'Gestion projet': { score: 88 }, 'Leadership': { score: 82 } } },
    { id: 3, employee_id: 3, employee_name: 'Ousmane Sy', employee_initials: 'OS', employee_department: 'Commercial', employee_job_title: 'Commercial Senior', type: '360', status: 'pending', due_date: '2024-12-22' },
    { id: 4, employee_id: 4, employee_name: 'Mamadou Mbaye', employee_initials: 'MM', employee_department: 'Technologie', employee_job_title: 'Développeur Junior', type: 'self', status: 'in_progress', due_date: '2024-12-31', scores: { 'Compétences techniques': { score: 78 }, 'Apprentissage': { score: 95 } } },
  ];
}

function getMockOneOnOnes(): OneOnOne[] {
  return [
    { id: 1, employee_id: 1, employee_name: 'Aissatou Ba', employee_initials: 'AB', manager_id: 2, manager_name: 'Amadou Diallo', scheduled_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), duration_minutes: 30, location: 'Bureau', status: 'scheduled', action_items: ['Discuter promotion', 'Plan formation Q1'] },
    { id: 2, employee_id: 3, employee_name: 'Mamadou Mbaye', employee_initials: 'MM', manager_id: 1, manager_name: 'Aissatou Ba', scheduled_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), duration_minutes: 30, location: 'Visio', status: 'completed', notes: 'Progrès excellents sur React.', action_items: ['Assigner feature auth'] },
    { id: 3, employee_id: 4, employee_name: 'Ousmane Sy', employee_initials: 'OS', manager_id: 5, manager_name: 'Ibrahima Fall', scheduled_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), duration_minutes: 45, location: 'Salle Baobab', status: 'scheduled', action_items: ['Review pipeline Q4', 'Objectifs 2025'] },
  ];
}

function getMockStats(): PerformanceStats {
  return {
    avg_score: 4.2,
    evaluations_total: 48,
    evaluations_completed: 33,
    feedbacks_this_month: 127,
    okr_achievement_avg: 78,
    one_on_ones_this_week: 12
  };
}

// =============================================
// HELPERS
// =============================================

function normalizeRole(role: string | undefined): UserRole {
  if (!role) return 'employee';
  const r = role.toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'dg') return 'dg';
  if (r === 'rh' || r === 'hr') return 'rh';
  if (r === 'manager') return 'manager';
  return 'employee';
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    'completed': 'bg-green-100 text-green-700',
    'validated': 'bg-green-100 text-green-700',
    'pending': 'bg-gray-100 text-gray-700',
    'in_progress': 'bg-purple-100 text-purple-700',
    'scheduled': 'bg-blue-100 text-blue-700',
    'submitted': 'bg-indigo-100 text-indigo-700',
    'active': 'bg-green-100 text-green-700',
    'draft': 'bg-gray-100 text-gray-600',
    'cancelled': 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    'completed': 'Terminé',
    'validated': 'Validé',
    'pending': 'En attente',
    'in_progress': 'En cours',
    'scheduled': 'Planifié',
    'submitted': 'Soumis',
    'active': 'Actif',
    'draft': 'Brouillon',
    'cancelled': 'Annulé',
  };
  return labels[status] || status;
}

function getFeedbackTypeStyle(type: string) {
  if (type === 'recognition') return 'bg-green-50 border-green-200';
  if (type === 'improvement') return 'bg-orange-50 border-orange-200';
  return 'bg-blue-50 border-blue-200';
}

function getFeedbackTypeBadge(type: string) {
  if (type === 'recognition') return { label: '🎉 Reconnaissance', class: 'bg-green-100 text-green-700' };
  if (type === 'improvement') return { label: '💡 Suggestion', class: 'bg-orange-100 text-orange-700' };
  return { label: '💬 Général', class: 'bg-blue-100 text-blue-700' };
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `Il y a ${diffMins}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// =============================================
// Chart Data
// =============================================

const performanceDistribution = [
  { rating: 'Exceptionnel', count: 8, color: '#10B981' },
  { rating: 'Dépasse', count: 15, color: '#3B82F6' },
  { rating: 'Atteint', count: 18, color: '#8B5CF6' },
  { rating: 'À améliorer', count: 5, color: '#F59E0B' },
  { rating: 'Insuffisant', count: 2, color: '#EF4444' },
];

const competencyData = [
  { subject: 'Technique', score: 85 },
  { subject: 'Leadership', score: 72 },
  { subject: 'Communication', score: 88 },
  { subject: 'Innovation', score: 75 },
  { subject: 'Collaboration', score: 90 },
  { subject: 'Résolution', score: 82 },
];

const trendData = [
  { month: 'Jan', score: 3.8 },
  { month: 'Fév', score: 3.9 },
  { month: 'Mar', score: 4.0 },
  { month: 'Avr', score: 3.9 },
  { month: 'Mai', score: 4.1 },
  { month: 'Jun', score: 4.2 },
];

// =============================================
// MODAL COMPONENTS
// =============================================

function FeedbackModal({ isOpen, onClose, onSubmit, employees }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { to_employee_id: number; type: string; message: string; is_public: boolean }) => Promise<void>;
  employees: Employee[];
}) {
  const [toEmployeeId, setToEmployeeId] = useState<number | ''>('');
  const [type, setType] = useState<'recognition' | 'improvement' | 'general'>('recognition');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmployeeId || !message.trim()) return;
    
    setSaving(true);
    try {
      await onSubmit({ to_employee_id: Number(toEmployeeId), type, message, is_public: isPublic });
      setToEmployeeId('');
      setMessage('');
      setType('recognition');
      setIsPublic(true);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Donner un Feedback</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">À qui ? *</label>
            <select value={toEmployeeId} onChange={(e) => setToEmployeeId(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Sélectionner un collaborateur...</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-2">
              {(['recognition', 'improvement', 'general'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)} className={`flex-1 px-3 py-2 border-2 text-sm rounded-lg ${type === t ? (t === 'recognition' ? 'border-green-500 bg-green-50' : t === 'improvement' ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50') : 'border-gray-300'}`}>
                  {t === 'recognition' ? '🎉 Reconnaissance' : t === 'improvement' ? '💡 Suggestion' : '💬 Général'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Écrivez votre feedback..." required minLength={10} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-600">Feedback public (visible par tous)</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 flex items-center disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Envoyer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OneOnOneModal({ isOpen, onClose, onSubmit, employees }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { employee_id: number; scheduled_date: string; duration_minutes: number; location?: string }) => Promise<void>;
  employees: Employee[];
}) {
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('14:00');
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !date) return;
    
    setSaving(true);
    try {
      await onSubmit({
        employee_id: Number(employeeId),
        scheduled_date: `${date}T${time}:00`,
        duration_minutes: duration,
        location: location || undefined
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Planifier un 1-on-1</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Collaborateur *</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Sélectionner...</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure *</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1h</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Bureau, Visio..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg">Annuler</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
              Planifier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function PerformancePage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feedback' | 'evaluations' | 'objectives' | 'analytics'>('feedback');
  
  // Data
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [campaigns, setCampaigns] = useState<EvaluationCampaign[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  
  // User context
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [isManager, setIsManager] = useState(false);
  
  // Modals
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showOneOnOneModal, setShowOneOnOneModal] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  // Permissions
  const isHROrAdmin = ['rh', 'admin', 'dg'].includes(userRole);
  const canManageTeam = isHROrAdmin || isManager || userRole === 'manager';

  // Load user data
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUserRole(normalizeRole(userData.role));
        setIsManager(userData.is_manager || userData.role?.toLowerCase() === 'manager');
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [feedbackData, employeeData, oneOnOneData] = await Promise.all([
        fetchFeedbacks(),
        fetchEmployees(),
        fetchOneOnOnes(),
      ]);
      
      setFeedbacks(feedbackData);
      setEmployees(employeeData);
      setOneOnOnes(oneOnOneData);
      
      // Load additional data for HR/Admin
      if (isHROrAdmin) {
        const [campaignData, evalData, statsData] = await Promise.all([
          fetchCampaigns(),
          fetchEvaluations(),
          fetchStats(),
        ]);
        setCampaigns(campaignData);
        setEvaluations(evalData);
        setStats(statsData);
      } else {
        // For regular employees, load their evaluations
        const evalData = await fetchEvaluations();
        setEvaluations(evalData);
        setStats(getMockStats());
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [isHROrAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleCreateFeedback = async (data: { to_employee_id: number; type: string; message: string; is_public: boolean }) => {
    const success = await createFeedback(data);
    if (success) {
      await loadData();
      setShowFeedbackModal(false);
    }
  };

  const handleLikeFeedback = async (feedbackId: number) => {
    const newCount = await likeFeedback(feedbackId);
    if (newCount >= 0) {
      setFeedbacks(prev => prev.map(fb => 
        fb.id === feedbackId ? { ...fb, likes_count: newCount, is_liked_by_me: !fb.is_liked_by_me } : fb
      ));
    }
  };

  const handleCreateOneOnOne = async (data: { employee_id: number; scheduled_date: string; duration_minutes: number; location?: string }) => {
    const success = await createOneOnOne(data);
    if (success) {
      await loadData();
      setShowOneOnOneModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">Performance & Feedback</h1>
        <p className="text-sm text-gray-500 mt-1">Évaluations, feedback continu, objectifs et entretiens</p>
      </div>

      <main className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Score Moyen</p><p className="text-2xl font-bold text-gray-900">{stats?.avg_score || 0}<span className="text-sm text-gray-400">/5</span></p></div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><Star className="w-5 h-5 text-yellow-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Évaluations</p><p className="text-2xl font-bold text-green-600">{stats?.evaluations_completed || 0}<span className="text-sm text-gray-400">/{stats?.evaluations_total || 0}</span></p></div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Feedbacks (Mois)</p><p className="text-2xl font-bold text-purple-600">{stats?.feedbacks_this_month || 0}</p></div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><MessageSquare className="w-5 h-5 text-purple-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">OKRs Atteints</p><p className="text-2xl font-bold text-blue-600">{stats?.okr_achievement_avg || 0}%</p></div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Target className="w-5 h-5 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">1-on-1 (Semaine)</p><p className="text-2xl font-bold text-orange-600">{stats?.one_on_ones_this_week || 0}</p></div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-orange-600" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('feedback')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'feedback' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <MessageSquare className="w-4 h-4 inline mr-2" />Feedback Continu
            </button>
            <button onClick={() => setActiveTab('evaluations')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'evaluations' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Star className="w-4 h-4 inline mr-2" />Évaluations
            </button>
            <button onClick={() => setActiveTab('objectives')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'objectives' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Target className="w-4 h-4 inline mr-2" />Objectifs
            </button>
            {isHROrAdmin && (
              <button onClick={() => setActiveTab('analytics')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'analytics' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
                <TrendingUp className="w-4 h-4 inline mr-2" />Analytics
              </button>
            )}
          </div>
        </div>

        {/* TAB: Feedback */}
        {activeTab === 'feedback' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Fil de Feedback</h3>
                <button onClick={() => setShowFeedbackModal(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4 mr-2" />Donner un Feedback
                </button>
              </div>
              
              {feedbacks.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Aucun feedback pour le moment</p>
                  <p className="text-sm text-gray-400 mt-1">Soyez le premier à donner un feedback !</p>
                </div>
              ) : (
                feedbacks.map((fb) => (
                  <div key={fb.id} className={`bg-white rounded-xl p-5 shadow-sm border ${getFeedbackTypeStyle(fb.type)}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">{fb.from_employee_initials}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{fb.from_employee_name}</span>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{fb.to_employee_name}</span>
                          </div>
                          <span className="text-xs text-gray-500">{formatTimeAgo(fb.created_at)} {fb.is_public ? '• Public' : '• Privé'}</span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getFeedbackTypeBadge(fb.type).class}`}>{getFeedbackTypeBadge(fb.type).label}</span>
                    </div>
                    <p className="text-gray-700 text-sm mb-3">{fb.message}</p>
                    {fb.is_public && (
                      <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                        <button onClick={() => handleLikeFeedback(fb.id)} className={`flex items-center text-sm hover:text-primary-600 ${fb.is_liked_by_me ? 'text-primary-600' : 'text-gray-500'}`}>
                          <ThumbsUp className={`w-4 h-4 mr-1 ${fb.is_liked_by_me ? 'fill-current' : ''}`} />{fb.likes_count}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* 1-on-1 */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary-500" />Prochains 1-on-1</h4>
                <div className="space-y-3">
                  {oneOnOnes.filter(o => o.status === 'scheduled').slice(0, 3).map((meeting) => (
                    <div key={meeting.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs">{meeting.employee_initials}</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{meeting.employee_name}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(meeting.scheduled_date)}</p>
                        </div>
                      </div>
                      {meeting.action_items && meeting.action_items.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {meeting.action_items.slice(0, 2).map((item, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{item}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {oneOnOnes.filter(o => o.status === 'scheduled').length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-2">Aucun 1-on-1 planifié</p>
                  )}
                </div>
                {canManageTeam && (
                  <button onClick={() => setShowOneOnOneModal(true)} className="w-full mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center">
                    <Plus className="w-4 h-4 mr-1" />Planifier un 1-on-1
                  </button>
                )}
              </div>

              {/* Top contributeurs */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-yellow-500" />Top Contributeurs</h4>
                <div className="space-y-3">
                  {[{ name: 'Fatou Ndiaye', count: 24 }, { name: 'Amadou Diallo', count: 18 }, { name: 'Aissatou Ba', count: 15 }].map((person, i) => (
                    <div key={person.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center text-xs font-bold text-yellow-700">{i + 1}</span>
                        <span className="text-sm text-gray-900">{person.name}</span>
                      </div>
                      <span className="text-sm font-medium text-primary-600">{person.count} feedbacks</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Évaluations */}
        {activeTab === 'evaluations' && (
          <div className="space-y-6">
            {/* Campaigns - RH only */}
            {isHROrAdmin && campaigns.length > 0 && (
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-900">Campagnes d&apos;Évaluation</h3>
                  <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                    <Plus className="w-4 h-4 mr-2" />Nouvelle Campagne
                  </button>
                </div>
                <div className="space-y-3">
                  {campaigns.map((camp) => (
                    <div key={camp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${camp.status === 'active' ? 'bg-green-100' : 'bg-gray-200'}`}>
                          <Star className={`w-5 h-5 ${camp.status === 'active' ? 'text-green-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{camp.name}</p>
                          <p className="text-xs text-gray-500">{camp.completed_evaluations}/{camp.total_evaluations} • Deadline: {formatDate(camp.end_date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">{Math.round(camp.progress_percentage)}%</p>
                          <div className="w-24 h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${camp.progress_percentage === 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${camp.progress_percentage}%` }} /></div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(camp.status)}`}>{getStatusLabel(camp.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Evaluations */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">{isHROrAdmin ? 'Toutes les Évaluations' : 'Mes Évaluations'}</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {evaluations.length === 0 ? (
                      <div className="p-8 text-center">
                        <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Aucune évaluation</p>
                      </div>
                    ) : (
                      evaluations.map((ev) => (
                        <div key={ev.id} onClick={() => setSelectedEvaluation(ev)} className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedEvaluation?.id === ev.id ? 'bg-primary-50' : ''}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">{ev.employee_initials}</div>
                              <div>
                                <p className="font-medium text-gray-900">{ev.employee_name}</p>
                                <p className="text-xs text-gray-500">{ev.employee_job_title} • {ev.employee_department}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(ev.status)}`}>{getStatusLabel(ev.status)}</span>
                              {ev.overall_score && <span className="text-lg font-bold text-primary-600">{ev.overall_score}/5</span>}
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span>Type: {ev.type === 'self' ? 'Auto-éval' : ev.type === 'manager' ? 'Manager' : ev.type}</span>
                            {ev.due_date && <span>Deadline: {formatDate(ev.due_date)}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Evaluation Detail */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 h-fit sticky top-6">
                {selectedEvaluation ? (
                  <>
                    <div className="text-center mb-4">
                      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xl font-bold mx-auto mb-2">{selectedEvaluation.employee_initials}</div>
                      <h3 className="font-bold text-gray-900">{selectedEvaluation.employee_name}</h3>
                      <p className="text-sm text-gray-500">{selectedEvaluation.employee_job_title}</p>
                    </div>
                    {selectedEvaluation.scores && (
                      <div className="space-y-3 mb-4">
                        {Object.entries(selectedEvaluation.scores).map(([cat, data]) => (
                          <div key={cat}>
                            <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{cat}</span><span className="font-medium">{data.score}%</span></div>
                            <div className="h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${data.score >= 90 ? 'bg-green-500' : data.score >= 75 ? 'bg-blue-500' : 'bg-yellow-500'}`} style={{ width: `${data.score}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button className="flex-1 flex items-center justify-center px-3 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"><Eye className="w-4 h-4 mr-1" />Voir</button>
                      <button className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><Edit className="w-4 h-4 mr-1" />Éditer</button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-8"><User className="w-12 h-12 mx-auto mb-2 text-gray-300" /><p className="text-sm">Sélectionnez une évaluation</p></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Objectifs - Redirect to OKR */}
        {activeTab === 'objectives' && (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
            <Target className="w-16 h-16 text-primary-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Gestion des Objectifs</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Les objectifs sont gérés dans le module OKR & Objectifs pour un alignement stratégique complet.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/dashboard/okr" className="flex items-center px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium">
                <Target className="w-5 h-5 mr-2" />
                Voir les OKRs
                <ExternalLink className="w-4 h-4 ml-2" />
              </Link>
              <Link href="/dashboard/my-space/objectives" className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                <User className="w-5 h-5 mr-2" />
                Mes Objectifs
              </Link>
            </div>
          </div>
        )}

        {/* TAB: Analytics - RH only */}
        {activeTab === 'analytics' && isHROrAdmin && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Distribution des Notes</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceDistribution} layout="vertical"><XAxis type="number" /><YAxis type="category" dataKey="rating" width={80} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {performanceDistribution.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Bar></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Évolution Score Moyen</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}><XAxis dataKey="month" /><YAxis domain={[3, 5]} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2} dot={{ fill: '#6366F1' }} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Compétences Moyennes</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={competencyData}><PolarGrid /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} /><Radar dataKey="score" stroke="#6366F1" fill="#6366F1" fillOpacity={0.3} /></RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Taux de Complétion par Type</h3>
              <div className="space-y-4">
                {[{ type: 'Annuelle', completed: 33, total: 48 }, { type: '360°', completed: 5, total: 12 }, { type: 'Mi-année', completed: 45, total: 45 }, { type: 'Période essai', completed: 3, total: 5 }].map((item) => (
                  <div key={item.type}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{item.type}</span><span className="font-medium">{item.completed}/{item.total} ({Math.round(item.completed / item.total * 100)}%)</span></div>
                    <div className="h-2 bg-gray-200 rounded-full"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${item.completed / item.total * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} onSubmit={handleCreateFeedback} employees={employees} />
      <OneOnOneModal isOpen={showOneOnOneModal} onClose={() => setShowOneOnOneModal(false)} onSubmit={handleCreateOneOnOne} employees={employees} />
    </div>
  );
}