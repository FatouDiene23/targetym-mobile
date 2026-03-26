'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ThumbsUp, Send, X, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight, BarChart3, Check, Trash2, MessageCircle,
  Hourglass, Bell, Eye, ClipboardList, Handshake, Wrench, Target, Brain,
  Globe, Zap, ShieldCheck, Heart, HeartPulse, TrendingUp, Clock, Cog,
  type LucideProps
} from 'lucide-react';

const ATTITUDE_ICONS: Record<string, React.ComponentType<LucideProps>> = {
  Hourglass, Bell, Eye, ClipboardList, Handshake, Wrench, Target, Brain,
  Globe, Zap, ShieldCheck, Heart, HeartPulse, TrendingUp, Clock, Cog,
};

function AttitudeIcon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const Icon = ATTITUDE_ICONS[name];
  if (!Icon) return <span className="text-xs opacity-60">{name}</span>;
  return <Icon className={className} />;
}
import Header from '@/components/Header';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { performanceTips } from '@/config/pageTips';

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
  score_solde: number;
  score_pct: number;
}

interface EmployeeAttitudeScores {
  employee_id: number;
  employee_name: string;
  global_score: number;
  total_feedbacks_with_attitudes: number;
  scores: AttitudeScoreItem[];
}

interface ReplyItem {
  id: number;
  feedback_id: number;
  employee_id: number;
  employee_name: string;
  employee_initials: string;
  content: string;
  created_at: string;
}

type FeedbackType = 'recognition' | 'improvement' | 'general';
type TabView = 'received' | 'sent' | 'feed' | 'attitudes';

// =============================================
// API
// =============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';
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
  to_employee_id: number; type: string; message: string; is_public: boolean;
  interaction_type?: string;
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
  } catch { return -1; }
}

async function deleteFeedback(feedbackId: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks/${feedbackId}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return response.ok;
  } catch { return false; }
}

async function fetchReplies(feedbackId: number): Promise<ReplyItem[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks/${feedbackId}/replies`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    return await response.json();
  } catch { return []; }
}

async function postReply(feedbackId: number, content: string): Promise<ReplyItem | null> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks/${feedbackId}/replies`, {
      method: 'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ content })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/?page_size=200&status=active`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch { return []; }
}

async function fetchAttitudes(): Promise<AttitudeItem[]> {
  try {
    await fetch(`${API_URL}/api/performance/attitudes/initialize`, { method: 'POST', headers: getAuthHeaders() });
    const response = await fetch(`${API_URL}/api/attitudes?active_only=true`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    return await response.json();
  } catch { return []; }
}

async function fetchMyAttitudeScores(): Promise<EmployeeAttitudeScores | null> {
  try {
    const response = await fetch(`${API_URL}/api/attitudes/scores/me`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function fetchCurrentEmployeeId(): Promise<number | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    const data = await response.json();
    return data.employee_id || null;
  } catch { return null; }
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
  if (score >= 95) return 'text-green-600';
  if (score >= 70) return 'text-blue-600';
  if (score >= 50) return 'text-yellow-600';
  if (score >= 25) return 'text-orange-500';
  return 'text-red-500';
}

function getScoreBarColor(score: number): string {
  if (score >= 95) return 'bg-green-500';
  if (score >= 70) return 'bg-blue-500';
  if (score >= 50) return 'bg-yellow-500';
  if (score >= 25) return 'bg-orange-500';
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

function FeedbackCard({ feedback, onLike, onDelete, currentEmployeeId }: { feedback: FeedbackItem; onLike: (id: number) => void; onDelete: (id: number) => void; currentEmployeeId: number | null }) {
  const [liked, setLiked] = useState(feedback.is_liked_by_me || false);
  const [likes, setLikes] = useState(feedback.likes_count);
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const isParticipant = currentEmployeeId !== null &&
    (feedback.from_employee_id === currentEmployeeId || feedback.to_employee_id === currentEmployeeId);

  const loadReplies = async () => {
    if (!repliesLoaded) {
      const data = await fetchReplies(feedback.id);
      setReplies(data);
      setRepliesLoaded(true);
    }
  };

  const handleToggleReplies = async () => {
    if (!showReplies) await loadReplies();
    setShowReplies(!showReplies);
  };

  const handleSendReply = async () => {
    if (!replyContent.trim()) return;
    setSendingReply(true);
    const reply = await postReply(feedback.id, replyContent.trim());
    setSendingReply(false);
    if (reply) {
      setReplies(prev => [...prev, reply]);
      setReplyContent('');
      setShowReplyInput(false);
      setShowReplies(true);
    }
  };

  const handleLike = async () => {
    const newCount = await likeFeedback(feedback.id);
    if (newCount >= 0) { setLikes(newCount); setLiked(!liked); onLike(feedback.id); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const success = await deleteFeedback(feedback.id);
    setDeleting(false);
    if (success) { onDelete(feedback.id); }
    setShowConfirm(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Il y a moins d'1h";
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${Math.floor(hours / 24)}j`;
  };

  const minutesSinceCreation = (Date.now() - new Date(feedback.created_at).getTime()) / (1000 * 60);
  const isAuthor = currentEmployeeId !== null && feedback.from_employee_id === currentEmployeeId;
  const canDelete = isAuthor && minutesSinceCreation <= 15;
  const minutesLeft = Math.max(0, Math.ceil(15 - minutesSinceCreation));

  const attitudes = feedback.attitudes || [];

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm flex-shrink-0">
          {feedback.from_employee_initials || getInitials(feedback.from_employee_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 text-sm">{feedback.from_employee_name}</span>
              <span className="text-gray-400">→</span>
              <span className="font-medium text-primary-600 text-sm">{feedback.to_employee_name}</span>
              <span className="text-lg">{getFeedbackIcon(feedback.type)}</span>
            </div>
            {canDelete && (
              <button
                onClick={() => setShowConfirm(true)}
                className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                title={`Supprimer (${minutesLeft} min restantes)`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-gray-700 text-sm mt-2 leading-relaxed">{feedback.message}</p>

          {attitudes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {attitudes.map((att, idx) => (
                <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  att.sentiment === 'recognition'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <AttitudeIcon name={att.icon} className="w-3 h-3" />
                  <span>{att.name}</span>
                  <span className="font-bold">{att.sentiment === 'recognition' ? '+1' : '−1'}</span>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 mt-3">
            <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? 'text-primary-600' : 'text-gray-400 hover:text-primary-500'}`}>
              <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} /><span>{likes}</span>
            </button>
            {isParticipant && (
              <button onClick={handleToggleReplies} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary-500 transition-colors">
                <MessageCircle className="w-4 h-4" />
                <span>{repliesLoaded ? replies.length : ''}</span>
              </button>
            )}
            {isParticipant && !showReplyInput && (
              <button onClick={() => { setShowReplyInput(true); loadReplies(); setShowReplies(true); }} className="text-xs text-gray-400 hover:text-primary-500 transition-colors">
                Répondre
              </button>
            )}
            <span className="text-xs text-gray-400">{timeAgo(feedback.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Replies thread */}
      {showReplies && replies.length > 0 && (
        <div className="ml-13 mt-3 pl-4 border-l-2 border-gray-100 space-y-3">
          {replies.map(reply => (
            <div key={reply.id} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-xs flex-shrink-0">
                {reply.employee_initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-xs">{reply.employee_name}</span>
                  <span className="text-xs text-gray-400">{timeAgo(reply.created_at)}</span>
                </div>
                <p className="text-gray-700 text-sm mt-0.5">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput && (
        <div className="ml-13 mt-3 pl-4 border-l-2 border-primary-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
              placeholder="Écrire une réponse..."
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
            <button onClick={handleSendReply} disabled={sendingReply || !replyContent.trim()} className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">
              {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
            <button onClick={() => { setShowReplyInput(false); setReplyContent(''); }} className="px-2 py-2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation suppression */}
      {showConfirm && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-700">Supprimer ce feedback ? ({minutesLeft} min restantes)</span>
          <div className="flex gap-2">
            <button onClick={() => setShowConfirm(false)} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-white">Annuler</button>
            <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
              {deleting ? 'Suppression...' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// =============================================
// ATTITUDE CHECKBOXES - Radio per attitude (FBK-01)
// =============================================

function AttitudeSelector({ 
  attitudes, 
  selectedAttitudes, 
  onChange,
  feedbackType
}: {
  attitudes: AttitudeItem[];
  selectedAttitudes: Map<number, 'recognition' | 'improvement'>;
  onChange: (newMap: Map<number, 'recognition' | 'improvement'>) => void;
  feedbackType: FeedbackType;
}) {
  if (attitudes.length === 0) return null;

  // Le sentiment est déterminé par le type de feedback
  const sentiment: 'recognition' | 'improvement' = 
    feedbackType === 'improvement' ? 'improvement' : 'recognition';
  
  const isRecognition = sentiment === 'recognition';
  const label = isRecognition ? 'Reconnaissance' : 'À améliorer';
  const color = isRecognition ? 'green' : 'amber';

  // Grouper par catégorie
  const grouped = attitudes.reduce((acc, att) => {
    const cat = att.category || 'Autre';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(att);
    return acc;
  }, {} as Record<string, AttitudeItem[]>);

  const handleToggle = (attitudeId: number) => {
    const next = new Map(selectedAttitudes);
    if (next.has(attitudeId)) {
      next.delete(attitudeId);
    } else {
      next.set(attitudeId, sentiment);
    }
    onChange(next);
  };

  const allIds = attitudes.map(a => a.id);
  const allSelected = allIds.every(id => selectedAttitudes.has(id));
  
  const handleSelectAll = () => {
    const next = new Map(selectedAttitudes);
    if (allSelected) {
      allIds.forEach(id => next.delete(id));
    } else {
      allIds.forEach(id => next.set(id, sentiment));
    }
    onChange(next);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Attitudes observées <span className="text-gray-400 font-normal">(optionnel)</span>
      </label>
      <p className="text-xs text-gray-500 mb-3">
        Cochez les attitudes dont le collaborateur a fait preuve 
        <span className={`font-medium ${isRecognition ? 'text-green-600' : 'text-amber-600'}`}> ({label})</span>
      </p>
      
      <div className="border rounded-lg overflow-hidden">
        {/* Header avec Tout cocher */}
        <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b">
          <span className="text-xs font-semibold text-gray-500 uppercase">Attitude</span>
          <button 
            type="button"
            onClick={handleSelectAll}
            className={`text-xs font-medium ${isRecognition ? 'text-green-600 hover:text-green-700' : 'text-amber-600 hover:text-amber-700'}`}
          >
            {allSelected ? 'Tout décocher' : 'Tout cocher'}
          </button>
        </div>
        
        {Object.entries(grouped).map(([category, atts]) => (
          <div key={category}>
            <div className="px-3 py-1.5 bg-gray-50/50 border-b">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{category}</span>
            </div>
            {atts.map((att, idx) => {
              const isChecked = selectedAttitudes.has(att.id);
              return (
                <div 
                  key={att.id} 
                  onClick={() => handleToggle(att.id)}
                  className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors ${
                    idx < atts.length - 1 ? 'border-b border-gray-100' : ''
                  } ${isChecked 
                    ? isRecognition ? 'bg-green-50/50' : 'bg-amber-50/50'
                    : 'hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AttitudeIcon name={att.icon} className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">{att.name}</span>
                  </div>
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                    isChecked
                      ? `bg-${color}-500 border-${color}-500 text-white`
                      : `border-gray-300 hover:border-${color}-400`
                  }`}
                    style={isChecked ? { 
                      backgroundColor: isRecognition ? '#22c55e' : '#f59e0b', 
                      borderColor: isRecognition ? '#22c55e' : '#f59e0b' 
                    } : {}}
                  >
                    {isChecked && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      
      {selectedAttitudes.size > 0 && (
        <div className={`mt-2 text-xs ${isRecognition ? 'text-green-600' : 'text-amber-600'}`}>
          {selectedAttitudes.size} attitude(s) cochée(s) en {label.toLowerCase()}
        </div>
      )}
    </div>
  );
}


// =============================================
// CREATE FEEDBACK MODAL
// =============================================

function CreateFeedbackModal({ isOpen, onClose, employees, attitudes, onSuccess }: {
  isOpen: boolean; onClose: () => void; employees: Employee[]; attitudes: AttitudeItem[]; onSuccess: () => void;
}) {
  const [toEmployee, setToEmployee] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('recognition');
  const [interactionType, setInteractionType] = useState('');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedAttitudes, setSelectedAttitudes] = useState<Map<number, 'recognition' | 'improvement'>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset attitudes quand le type change
  useEffect(() => { setSelectedAttitudes(new Map()); }, [feedbackType]);

  const handleSubmit = async () => {
    if (!toEmployee || !message.trim()) { setError('Veuillez remplir tous les champs obligatoires'); return; }
    if (message.length < 10) { setError('Le message doit contenir au moins 10 caractères'); return; }
    setError(''); setSaving(true);
    
    const attitudesPayload = Array.from(selectedAttitudes.entries()).map(([attitude_id, sentiment]) => ({ attitude_id, sentiment }));
    
    const result = await createFeedback({ 
      to_employee_id: parseInt(toEmployee), type: feedbackType, message: message.trim(), is_public: isPublic,
      interaction_type: interactionType || undefined,
      attitudes: attitudesPayload.length > 0 ? attitudesPayload : undefined
    });
    setSaving(false);
    if (result.success) { 
      setToEmployee(''); setMessage(''); setFeedbackType('recognition'); setIsPublic(true); setSelectedAttitudes(new Map()); setInteractionType('');
      onSuccess(); onClose(); 
    } else setError(result.error || 'Erreur lors de la création');
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Type d&apos;interaction</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'request', label: '📋 Requête' },
                { value: 'file', label: '📁 Dossier' },
                { value: 'project', label: '🗂️ Projet' },
                { value: 'mission', label: '🎯 Mission' },
                { value: 'other', label: '💼 Autres' },
              ].map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setInteractionType(interactionType === item.value ? '' : item.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    interactionType === item.value
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Partagez votre feedback..." className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" />
            <p className="text-xs text-gray-400 mt-1">{message.length}/2000 caractères (min. 10)</p>
          </div>
          
          {/* ✅ Grille d'attitudes - visible sauf type "général" */}
          {feedbackType !== 'general' && (
            <AttitudeSelector 
              attitudes={attitudes}
              selectedAttitudes={selectedAttitudes}
              onChange={setSelectedAttitudes}
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
// DASHBOARD ATTITUDES (FBK-03)
// Score Global + détail % par attitude + nb feedbackers
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

  const sortedScores = [...scores.scores].sort((a, b) => b.score_pct - a.score_pct);
  const isCareerReady = scores.global_score >= 95;

  return (
    <div className="space-y-4">
      {/* Score global */}
      <div className={`rounded-xl p-5 border ${isCareerReady ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Score Global Attitudes</p>
            <p className={`text-3xl font-bold mt-1 ${getScoreColor(scores.global_score)}`}>
              {scores.global_score}%
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Moyenne des % de reconnaissance par attitude
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              isCareerReady ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isCareerReady ? '✅ Éligible carrière (≥95%)' : `⏳ ${(95 - scores.global_score).toFixed(1)}% restant pour ≥95%`}
            </div>
            <p className="text-sm text-gray-500 mt-2">{scores.total_feedbacks_with_attitudes} feedbackers</p>
          </div>
        </div>
      </div>
      
      {/* Détail par attitude */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header tableau */}
        <div className="grid grid-cols-[1fr_80px_70px_70px_80px] px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase">
          <span>Attitude</span>
          <span className="text-center">Score %</span>
          <span className="text-center text-green-600">Reconn.</span>
          <span className="text-center text-amber-600">Amélior.</span>
          <span className="text-center">Solde</span>
        </div>
        
        {sortedScores.map((att, idx) => (
          <div key={att.attitude_id} className={`grid grid-cols-[1fr_80px_70px_70px_80px] px-5 py-3 items-center ${idx < sortedScores.length - 1 ? 'border-b border-gray-100' : ''}`}>
            {/* Nom + barre */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AttitudeIcon name={att.attitude_icon} className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{att.attitude_name}</span>
                {att.total_feedbacks > 0 && (
                  <span className="text-xs text-gray-400">({att.total_feedbacks} avis)</span>
                )}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full max-w-[200px]">
                <div 
                  className={`h-full rounded-full transition-all ${getScoreBarColor(att.score_pct)}`}
                  style={{ width: `${Math.min(att.score_pct, 100)}%` }}
                />
              </div>
            </div>
            {/* Score % */}
            <div className="text-center">
              <span className={`text-sm font-bold ${getScoreColor(att.score_pct)}`}>
                {att.score_pct}%
              </span>
            </div>
            {/* Recognition count */}
            <div className="text-center">
              <span className="text-sm text-green-600 font-medium">{att.recognition_count}</span>
            </div>
            {/* Improvement count */}
            <div className="text-center">
              <span className="text-sm text-amber-600 font-medium">{att.improvement_count}</span>
            </div>
            {/* Score solde */}
            <div className="text-center">
              <span className={`text-sm font-bold ${att.score_solde > 0 ? 'text-green-600' : att.score_solde < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {att.score_solde > 0 ? '+' : ''}{att.score_solde}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// =============================================
// STATS
// =============================================

interface MyStats {
  scope: string; avg_score: number; evaluations_total: number; evaluations_completed: number;
  completion_rate: number; feedbacks_received: number; feedbacks_given: number;
  one_on_ones_scheduled: number; one_on_ones_completed: number; okr_achievement: number;
}

async function fetchMyStats(): Promise<MyStats | null> {
  try {
    const response = await fetch(`${API_URL}/api/performance/my-stats`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch { return null; }
}

async function fetchFeedbackCount(params: string): Promise<number> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks?page_size=1&${params}`, { headers: getAuthHeaders() });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.total ?? 0;
  } catch { return 0; }
}

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
        <p className="text-xs text-gray-400">{stats.feedbacks_given} envoyés</p>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <p className="text-sm text-gray-500">Attitudes</p>
        <p className={`text-2xl font-bold ${attitudeScore !== null ? getScoreColor(attitudeScore) : 'text-gray-300'}`}>
          {attitudeScore !== null ? `${attitudeScore}%` : '-'}
        </p>
        <p className="text-xs text-gray-400">{attitudeScore !== null && attitudeScore >= 95 ? '✅ ≥95%' : 'score global'}</p>
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
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('received');
  const [filterType, setFilterType] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [feedbacksData, employeesData, statsData, attitudesData, attScoresData, empId] = await Promise.all([
      fetchFeedbacks(), fetchEmployees(), fetchMyStats(), fetchAttitudes(), fetchMyAttitudeScores(), fetchCurrentEmployeeId()
    ]);
    setFeedbacks(feedbacksData);
    setEmployees(employeesData);
    setAttitudes(attitudesData);
    setAttitudeScores(attScoresData);
    setCurrentEmployeeId(empId);

    if (empId && statsData) {
      const [received, sent] = await Promise.all([
        fetchFeedbackCount(`to_employee_id=${empId}`),
        fetchFeedbackCount(`from_employee_id=${empId}`)
      ]);
      setStats({ ...statsData, feedbacks_received: received, feedbacks_given: sent });
    } else {
      setStats(statsData);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Écouter le bouton "+ Ajouter" du Header
  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener('performance-add', handler);
    return () => window.removeEventListener('performance-add', handler);
  }, []);

  const filteredFeedbacks = feedbacks.filter(f => {
    const matchSearch = !search ||
      f.from_employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.to_employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.message.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || f.type === filterType;
    const matchTab = activeTab === 'received'
      ? currentEmployeeId !== null && f.to_employee_id === currentEmployeeId
      : activeTab === 'sent'
      ? currentEmployeeId !== null && f.from_employee_id === currentEmployeeId
      : activeTab === 'feed'
      ? f.is_public === true
      : true;
    return matchSearch && matchType && matchTab;
  });
  
  const paginatedFeedbacks = filteredFeedbacks.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredFeedbacks.length / ITEMS_PER_PAGE);

  // Page Tour Hook
  const { showTips, dismissTips, resetTips } = usePageTour('performance');

  if (loading) {
    return (
      <>
        <Header title="Feedback Continu" subtitle="Chargement..." />
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Chargement...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips
          tips={performanceTips}
          onDismiss={dismissTips}
          pageTitle="Feedback Continu"
        />
      )}
      <Header title="Feedback Continu" subtitle="Partagez et recevez des feedbacks" />

      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        <div data-tour="performance-stats">
          <StatsCards stats={stats} attitudeScore={attitudeScores?.global_score ?? null} />
        </div>

      {/* Tabs */}
      <div data-tour="feedback-tabs" className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => { setActiveTab('received'); setPage(1); }} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'received' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          📥 Reçus
        </button>
        <button onClick={() => { setActiveTab('sent'); setPage(1); }} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'sent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          📤 Envoyés
        </button>
        <button onClick={() => { setActiveTab('feed'); setPage(1); }} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'feed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          📋 Fil d&apos;actualité
        </button>
        <button onClick={() => setActiveTab('attitudes')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'attitudes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          📊 Mes Attitudes
        </button>
      </div>

      {activeTab !== 'attitudes' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher un feedback..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Tous' },
                { value: 'recognition', label: '🎉 Reconnaissance' },
                { value: 'improvement', label: '💡 Amélioration' },
                { value: 'general', label: '💬 Général' },
              ].map(f => (
                <button key={f.value} onClick={() => { setFilterType(f.value); setPage(1); }} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${filterType === f.value ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {paginatedFeedbacks.length > 0 ? paginatedFeedbacks.map(fb => (
              <FeedbackCard key={fb.id} feedback={fb} onLike={() => {}} onDelete={(id) => setFeedbacks(prev => prev.filter(f => f.id !== id))} currentEmployeeId={currentEmployeeId} />
            )) : (
              <p className="text-gray-500 text-center py-8">Aucun feedback trouvé</p>
            )}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      ) : (
        <AttitudeScoresDashboard scores={attitudeScores} />
      )}

      <CreateFeedbackModal isOpen={showModal} onClose={() => setShowModal(false)} employees={employees} attitudes={attitudes} onSuccess={loadData} />
      </main>
    </>
  );
}
