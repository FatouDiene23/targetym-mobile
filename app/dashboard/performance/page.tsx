'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, ThumbsUp, Send, X, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight, BarChart3
} from 'lucide-react';

// =============================================
// TYPES
// =============================================

interface AttitudeItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  icon: string;
  is_active: boolean;
  display_order: number;
}

interface FeedbackAttitude {
  attitude_id: number;
  code: string;
  name: string;
  icon: string;
  sentiment: 'recognition' | 'improvement';
}

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
  attitudes?: FeedbackAttitude[];
  created_at: string;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
}

interface AttitudeScoreItem {
  attitude_id: number;
  attitude_code: string;
  attitude_name: string;
  attitude_icon: string;
  total_feedbacks: number;
  recognition_count: number;
  improvement_count: number;
  score: number;
}

interface EmployeeAttitudeScores {
  employee_id: number;
  employee_name: string;
  global_score: number;
  total_feedbacks_with_attitudes: number;
  scores: AttitudeScoreItem[];
}

type FeedbackType = 'recognition' | 'improvement' | 'general';
type TabView = 'feed' | 'attitudes';

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

async function createFeedback(data: { 
  to_employee_id: number; 
  type: string; 
  message: string; 
  is_public: boolean;
  attitudes?: { attitude_id: number; sentiment: string }[];
}): Promise<{ success: boolean; error?: string }> {
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

async function fetchAttitudes(): Promise<AttitudeItem[]> {
  try {
    const response = await fetch(`${API_URL}/api/attitudes?active_only=true`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    return await response.json();
  } catch {
    return [];
  }
}

async function fetchMyAttitudeScores(): Promise<EmployeeAttitudeScores | null> {
  try {
    const response = await fetch(`${API_URL}/api/attitudes/scores/me`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
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

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 30) return 'text-yellow-600';
  if (score >= 0) return 'text-orange-500';
  return 'text-red-500';
}

function getScoreBg(score: number): string {
  if (score >= 70) return 'bg-green-50 border-green-200';
  if (score >= 30) return 'bg-yellow-50 border-yellow-200';
  if (score >= 0) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

function getScoreBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 30) return 'bg-yellow-500';
  if (score >= 0) return 'bg-orange-500';
  return 'bg-red-500';
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

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Il y a moins d\'1h';
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${Math.floor(hours / 24)}j`;
  };

  const attitudes = feedback.attitudes || [];

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
          
          {/* Attitudes tags */}
          {attitudes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {attitudes.map((att, idx) => (
                <span 
                  key={idx} 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    att.sentiment === 'recognition' 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <span>{att.icon}</span>
                  <span>{att.name}</span>
                  <span>{att.sentiment === 'recognition' ? '+' : '−'}</span>
                </span>
              ))}
            </div>
          )}
          
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
// ATTITUDE CHECKBOXES COMPONENT
// =============================================

function AttitudeCheckboxes({ 
  attitudes, 
  selectedAttitudes, 
  onToggle,
  feedbackType 
}: {
  attitudes: AttitudeItem[];
  selectedAttitudes: Map<number, 'recognition' | 'improvement'>;
  onToggle: (attitudeId: number, sentiment: 'recognition' | 'improvement' | null) => void;
  feedbackType: FeedbackType;
}) {
  if (attitudes.length === 0) return null;

  // Grouper par catégorie
  const grouped = attitudes.reduce((acc, att) => {
    const cat = att.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(att);
    return acc;
  }, {} as Record<string, AttitudeItem[]>);

  const categoryLabels: Record<string, string> = {
    soft_skill: 'Soft Skills',
    leadership: 'Leadership',
    technical: 'Technique',
    other: 'Autres'
  };

  // Déterminer le sentiment par défaut basé sur le type de feedback
  const defaultSentiment: 'recognition' | 'improvement' = 
    feedbackType === 'improvement' ? 'improvement' : 'recognition';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Attitudes observées <span className="text-gray-400 font-normal">(optionnel)</span>
      </label>
      <p className="text-xs text-gray-500 mb-3">
        Cochez les attitudes observées chez votre collègue. Cliquez une fois pour 
        <span className="text-green-600 font-medium"> Reconnaissance (+)</span>, 
        deux fois pour 
        <span className="text-amber-600 font-medium"> Amélioration (−)</span>, 
        trois fois pour décocher.
      </p>
      
      <div className="space-y-3">
        {Object.entries(grouped).map(([category, atts]) => (
          <div key={category}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              {categoryLabels[category] || category}
            </p>
            <div className="flex flex-wrap gap-2">
              {atts.map(att => {
                const selected = selectedAttitudes.get(att.id);
                const isRecognition = selected === 'recognition';
                const isImprovement = selected === 'improvement';
                
                return (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => {
                      if (!selected) {
                        // Premier clic: sentiment par défaut
                        onToggle(att.id, defaultSentiment);
                      } else if (selected === 'recognition') {
                        // Deuxième clic: basculer vers improvement
                        onToggle(att.id, 'improvement');
                      } else {
                        // Troisième clic: décocher
                        onToggle(att.id, null);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      isRecognition
                        ? 'bg-green-50 text-green-700 border-green-300 ring-2 ring-green-200'
                        : isImprovement
                        ? 'bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                    title={att.description || att.name}
                  >
                    <span>{att.icon}</span>
                    <span>{att.name}</span>
                    {isRecognition && <span className="text-green-600 font-bold">+</span>}
                    {isImprovement && <span className="text-amber-600 font-bold">−</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {selectedAttitudes.size > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          {Array.from(selectedAttitudes.values()).filter(s => s === 'recognition').length} reconnaissance(s), 
          {' '}{Array.from(selectedAttitudes.values()).filter(s => s === 'improvement').length} amélioration(s)
        </div>
      )}
    </div>
  );
}


// =============================================
// CREATE FEEDBACK MODAL (enrichi avec attitudes)
// =============================================

function CreateFeedbackModal({ isOpen, onClose, employees, attitudes, onSuccess }: {
  isOpen: boolean; 
  onClose: () => void; 
  employees: Employee[]; 
  attitudes: AttitudeItem[];
  onSuccess: () => void;
}) {
  const [toEmployee, setToEmployee] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('recognition');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedAttitudes, setSelectedAttitudes] = useState<Map<number, 'recognition' | 'improvement'>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset attitudes quand le type change
  useEffect(() => {
    setSelectedAttitudes(new Map());
  }, [feedbackType]);

  const handleToggleAttitude = (attitudeId: number, sentiment: 'recognition' | 'improvement' | null) => {
    setSelectedAttitudes(prev => {
      const next = new Map(prev);
      if (sentiment === null) {
        next.delete(attitudeId);
      } else {
        next.set(attitudeId, sentiment);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!toEmployee || !message.trim()) { setError('Veuillez remplir tous les champs obligatoires'); return; }
    if (message.length < 10) { setError('Le message doit contenir au moins 10 caractères'); return; }
    setError(''); setSaving(true);
    
    // Préparer les attitudes
    const attitudesPayload = Array.from(selectedAttitudes.entries()).map(([attitude_id, sentiment]) => ({
      attitude_id,
      sentiment
    }));
    
    const result = await createFeedback({ 
      to_employee_id: parseInt(toEmployee), 
      type: feedbackType, 
      message: message.trim(), 
      is_public: isPublic,
      attitudes: attitudesPayload.length > 0 ? attitudesPayload : undefined
    });
    setSaving(false);
    if (result.success) { 
      setToEmployee(''); 
      setMessage(''); 
      setFeedbackType('recognition'); 
      setIsPublic(true); 
      setSelectedAttitudes(new Map());
      onSuccess(); 
      onClose(); 
    }
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
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Nouveau Feedback</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
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
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Partagez votre feedback..." className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" />
            <p className="text-xs text-gray-400 mt-1">{message.length}/2000 caractères (min. 10)</p>
          </div>
          
          {/* ✅ NOUVEAU: Checkboxes Attitudes */}
          {(feedbackType === 'recognition' || feedbackType === 'improvement') && (
            <AttitudeCheckboxes 
              attitudes={attitudes}
              selectedAttitudes={selectedAttitudes}
              onToggle={handleToggleAttitude}
              feedbackType={feedbackType}
            />
          )}
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
            <span className="text-sm text-gray-700">Feedback public (visible par tous)</span>
          </label>
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl flex-shrink-0">
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
// ATTITUDE SCORES DASHBOARD
// =============================================

function AttitudeScoresDashboard({ scores }: { scores: EmployeeAttitudeScores | null }) {
  if (!scores || scores.scores.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Pas encore de scores d'attitudes</p>
        <p className="text-gray-400 text-sm mt-1">Les scores apparaîtront lorsque vous recevrez des feedbacks avec des attitudes cochées.</p>
      </div>
    );
  }

  const sortedScores = [...scores.scores].sort((a, b) => b.score - a.score);
  const maxBar = Math.max(...sortedScores.map(s => Math.abs(s.score)), 1);

  return (
    <div className="space-y-4">
      {/* Score global */}
      <div className={`rounded-xl p-5 border ${getScoreBg(scores.global_score)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Score Global d'Attitudes</p>
            <p className={`text-3xl font-bold mt-1 ${getScoreColor(scores.global_score)}`}>
              {scores.global_score > 0 ? '+' : ''}{scores.global_score}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">{scores.total_feedbacks_with_attitudes} feedbacks</p>
            <p className="text-xs text-gray-400 mt-1">avec attitudes</p>
          </div>
        </div>
      </div>

      {/* Scores par attitude */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Détail par attitude</h3>
        <div className="space-y-3">
          {sortedScores.map(att => {
            const barWidth = (Math.abs(att.score) / maxBar) * 100;
            
            return (
              <div key={att.attitude_id} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{att.attitude_icon}</span>
                    <span className="text-sm font-medium text-gray-700">{att.attitude_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <span className="text-green-500">{att.recognition_count}+</span>
                      <span>/</span>
                      <span className="text-amber-500">{att.improvement_count}−</span>
                    </div>
                    <span className={`text-sm font-bold ${getScoreColor(att.score)}`}>
                      {att.score > 0 ? '+' : ''}{att.score}%
                    </span>
                  </div>
                </div>
                {/* Barre de progression bidirectionnelle */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                  {att.score >= 0 ? (
                    <div 
                      className={`h-full rounded-full transition-all ${getScoreBarColor(att.score)}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  ) : (
                    <div className="h-full flex justify-end">
                      <div 
                        className="h-full bg-red-400 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  )}
                </div>
                {att.total_feedbacks === 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">Aucune évaluation</p>
                )}
              </div>
            );
          })}
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

function StatsCards({ stats, attitudeScore }: { stats: MyStats | null; attitudeScore: number | null }) {
  if (!stats) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
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
      {/* ✅ NOUVEAU: Score d'attitudes */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">Attitudes</p>
        <p className={`text-2xl font-bold ${attitudeScore !== null ? getScoreColor(attitudeScore) : 'text-gray-300'}`}>
          {attitudeScore !== null ? `${attitudeScore > 0 ? '+' : ''}${attitudeScore}%` : '-'}
        </p>
        <p className="text-xs text-gray-400">score global</p>
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
  const [attitudes, setAttitudes] = useState<AttitudeItem[]>([]);
  const [attitudeScores, setAttitudeScores] = useState<EmployeeAttitudeScores | null>(null);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('feed');
  const [filterType, setFilterType] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [feedbacksData, employeesData, statsData, attitudesData, attScoresData] = await Promise.all([
      fetchFeedbacks(), 
      fetchEmployees(),
      fetchMyStats(),
      fetchAttitudes(),
      fetchMyAttitudeScores()
    ]);
    setFeedbacks(feedbacksData);
    setEmployees(employeesData);
    setStats(statsData);
    setAttitudes(attitudesData);
    setAttitudeScores(attScoresData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredFeedbacks = feedbacks.filter(f => {
    const matchSearch = !search || 
      f.from_employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.to_employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.message.toLowerCase().includes(search.toLowerCase());
    
    const matchType = filterType === 'all' || f.type === filterType;
    
    return matchSearch && matchType;
  });
  
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
      <StatsCards stats={stats} attitudeScore={attitudeScores?.global_score ?? null} />
      
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

      {/* Tabs: Feed / Mes Attitudes */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button 
          onClick={() => setActiveTab('feed')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'feed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📋 Fil d'activité
        </button>
        <button 
          onClick={() => setActiveTab('attitudes')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'attitudes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📊 Mes Attitudes
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'feed' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                placeholder="Rechercher un feedback..." 
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
              />
            </div>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Tous' },
                { value: 'recognition', label: '🎉 Reconnaissance' },
                { value: 'improvement', label: '💡 Amélioration' },
                { value: 'general', label: '💬 Général' },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => { setFilterType(f.value); setPage(1); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    filterType === f.value 
                      ? 'bg-primary-50 text-primary-700 border-primary-200' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feedbacks List */}
          <div className="space-y-4">
            {paginatedFeedbacks.length > 0 ? paginatedFeedbacks.map(fb => (
              <FeedbackCard key={fb.id} feedback={fb} onLike={(id) => {
                setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, is_liked_by_me: !f.is_liked_by_me } : f));
              }} />
            )) : (
              <p className="text-gray-500 text-center py-8">Aucun feedback trouvé</p>
            )}
          </div>

          {/* Pagination */}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : (
        /* Attitudes Dashboard */
        <AttitudeScoresDashboard scores={attitudeScores} />
      )}

      {/* Modal */}
      <CreateFeedbackModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        employees={employees} 
        attitudes={attitudes}
        onSuccess={loadData} 
      />
    </div>
  );
}