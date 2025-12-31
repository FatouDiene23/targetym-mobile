'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, ThumbsUp, Send, X, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight
} from 'lucide-react';

// =============================================
// TYPES
// =============================================

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

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
}

type FeedbackType = 'recognition' | 'improvement' | 'general';

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

// =============================================
// HELPERS
// =============================================

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
// STATS TYPES & API
// =============================================

interface MyStats {
  scope: string;
  avg_score: number;
  evaluations_total: number;
  evaluations_completed: number;
  completion_rate: number;
  feedbacks_received: number;
  feedbacks_given: number;
  one_on_ones_scheduled: number;
  one_on_ones_completed: number;
  okr_achievement: number;
}

async function fetchMyStats(): Promise<MyStats | null> {
  try {
    const response = await fetch(`${API_URL}/api/performance/my-stats`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// =============================================
// STATS COMPONENT
// =============================================

function StatsCards({ stats }: { stats: MyStats | null }) {
  if (!stats) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">Score Moyen</p>
        <p className="text-2xl font-bold text-gray-900">{stats.avg_score > 0 ? `${stats.avg_score}/5` : '-'}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">Évaluations</p>
        <p className="text-2xl font-bold text-green-600">{stats.evaluations_completed}/{stats.evaluations_total}</p>
        <p className="text-xs text-gray-400">{stats.evaluations_total > 0 ? `${Math.round(stats.completion_rate)}%` : ''}</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">Feedbacks Reçus</p>
        <p className="text-2xl font-bold text-purple-600">{stats.feedbacks_received}</p>
        <p className="text-xs text-gray-400">{stats.feedbacks_given} donnés</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">OKRs</p>
        <p className="text-2xl font-bold text-orange-600">{stats.okr_achievement}%</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">1-on-1</p>
        <p className="text-2xl font-bold text-blue-600">{stats.one_on_ones_scheduled}</p>
        <p className="text-xs text-gray-400">{stats.one_on_ones_completed} complétés</p>
      </div>
    </div>
  );
}

// =============================================
// MAIN PAGE
// =============================================

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [feedbacksData, employeesData, statsData] = await Promise.all([
      fetchFeedbacks(), 
      fetchEmployees(),
      fetchMyStats()
    ]);
    setFeedbacks(feedbacksData);
    setEmployees(employeesData);
    setStats(statsData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredFeedbacks = feedbacks.filter(f => 
    f.from_employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.to_employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.message.toLowerCase().includes(search.toLowerCase())
  );
  const paginatedFeedbacks = filteredFeedbacks.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredFeedbacks.length / ITEMS_PER_PAGE);

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
    <div className="p-8">
      {/* Stats KPIs */}
      <StatsCards stats={stats} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedback Continu</h1>
          <p className="text-gray-500 mt-1">Partagez et recevez des feedbacks</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600">
          <Plus className="w-4 h-4" />Nouveau Feedback
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
              placeholder="Rechercher un feedback..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
            />
          </div>
        </div>

        {/* Feedbacks List */}
        <div className="space-y-4">
          {paginatedFeedbacks.length > 0 ? paginatedFeedbacks.map(fb => (
            <FeedbackCard key={fb.id} feedback={fb} onLike={() => {}} />
          )) : (
            <p className="text-gray-500 text-center py-8">Aucun feedback trouvé</p>
          )}
        </div>

        {/* Pagination */}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Modal */}
      <CreateFeedbackModal isOpen={showModal} onClose={() => setShowModal(false)} employees={employees} onSuccess={loadData} />
    </div>
  );
}
