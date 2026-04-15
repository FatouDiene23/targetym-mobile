'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, X, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight, ClipboardCheck, Star, Plus, Trash2,
  CheckCircle2, TrendingUp, Award, BookOpen, ListTodo, User,
} from 'lucide-react';
import Header from '@/components/Header';
<<<<<<< HEAD
import { useI18n } from '@/lib/i18n/I18nContext';
=======
import CustomSelect from '@/components/CustomSelect';
>>>>>>> 90601c6384dce26fe07e59cf03eeb6d7d740787d

// =============================================
// TYPES
// =============================================

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
  evaluation_score?: number;
  evaluation_comment?: string;
  action_items?: string[];
  completed_at?: string;
}

interface CurrentUser {
  id: number;
  role: string;
  employee_id?: number;
}

interface TaskDraft {
  id: string;
  title: string;
  assigned_to_id: number;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface EvaluationCriterion {
  key: string;
  label: string;
  score: number;
}

// =============================================
// API
// =============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');
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
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchCompletedSessions(): Promise<OneOnOne[]> {
  try {
    const res = await fetch(`${API_URL}/api/performance/one-on-ones?page_size=100&status=completed`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function submitEvaluation(id: number, payload: {
  notes: string;
  evaluation_score: number;
  evaluation_comment: string;
  action_items: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/performance/one-on-ones/${id}/complete`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || 'Submission error' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Connection error' };
  }
}

async function createTask(data: {
  title: string;
  assigned_to_id: number;
  due_date: string;
  priority: string;
  is_administrative: boolean;
  description?: string;
}): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_URL}/api/tasks/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

// =============================================
// HELPERS
// =============================================

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getInitials(name: string | undefined): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getDefaultCriteria(t: ReturnType<typeof import('@/lib/i18n/I18nContext').useI18n>['t']): EvaluationCriterion[] {
  return [
    { key: 'performance', label: t.performance.overallPerformance, score: 0 },
    { key: 'communication', label: t.performance.communicationCollab, score: 0 },
    { key: 'objectifs', label: t.performance.objectiveAchievement, score: 0 },
    { key: 'competences', label: t.performance.technicalCompetencies, score: 0 },
    { key: 'initiative', label: t.performance.initiativeProactivity, score: 0 },
  ];
}

function getRecommendations(t: ReturnType<typeof import('@/lib/i18n/I18nContext').useI18n>['t']) {
  return [
    { value: t.performance.promotionRecommended, colorClass: 'bg-green-50 border-green-300 text-green-700', activeClass: 'bg-green-500 text-white border-green-500' },
    { value: t.performance.maintainPosition, colorClass: 'bg-blue-50 border-blue-300 text-blue-700', activeClass: 'bg-blue-500 text-white border-blue-500' },
    { value: t.performance.improvementRequired, colorClass: 'bg-yellow-50 border-yellow-300 text-yellow-700', activeClass: 'bg-yellow-500 text-white border-yellow-500' },
    { value: t.performance.excellenceFastTrack, colorClass: 'bg-indigo-50 border-indigo-300 text-indigo-700', activeClass: 'bg-indigo-500 text-white border-indigo-500' },
  ];
}

// =============================================
// STAR RATING
// =============================================

function StarRating({ score, onChange }: { score: number; onChange: (s: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i)}
          className="focus:outline-none"
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              i <= (hovered || score) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
      {score > 0 && <span className="text-xs text-gray-500 ml-1">{score}/5</span>}
    </div>
  );
}

// =============================================
// PAGINATION
// =============================================

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 p-4 border-t">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-8 h-8 rounded-lg text-sm font-medium ${
            currentPage === p ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-500 ml-2">Page {currentPage}/{totalPages}</span>
    </div>
  );
}

// =============================================
// EVALUATION REPORT MODAL
// =============================================

function EvaluationReportModal({ session, onClose, onSuccess }: {
  session: OneOnOne; onClose: () => void; onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>(
    getDefaultCriteria(t).map(c => ({ ...c }))
  );
  const [comments, setComments] = useState('');
  const [trainings, setTrainings] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const defaultDue = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const scoredCriteria = criteria.filter(c => c.score > 0);
  const avgScore = scoredCriteria.length > 0
    ? Math.round(scoredCriteria.reduce((sum, c) => sum + c.score, 0) / scoredCriteria.length)
    : 0;

  const addTask = () => {
    setTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      title: '',
      assigned_to_id: session.employee_id,
      due_date: defaultDue,
      priority: 'medium',
    }]);
  };

  const updateTask = (id: string, field: keyof TaskDraft, value: string | number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  const buildNotes = (): string => {
    const lines: string[] = ["=== RAPPORT D'ÉVALUATION 1-1 ===", ''];
    if (scoredCriteria.length > 0) {
      lines.push('CRITÈRES D\'ÉVALUATION:');
      criteria.forEach(c => { if (c.score > 0) lines.push(`  - ${c.label}: ${c.score}/5`); });
    }
    if (comments.trim()) { lines.push('', 'COMMENTAIRES:', comments.trim()); }
    if (trainings.trim()) { lines.push('', 'FORMATIONS SUGGÉRÉES:', trainings.trim()); }
    if (recommendation) { lines.push('', 'RECOMMANDATION:', recommendation); }
    const taskTitles = tasks.filter(t => t.title.trim());
    if (taskTitles.length > 0) {
      lines.push('', 'PLANS D\'AMÉLIORATION:');
      taskTitles.forEach(t => lines.push(`  - ${t.title.trim()}`));
    }
    return lines.join('\n');
  };

  const handleSubmit = async () => {
    if (scoredCriteria.length === 0) { toast.error(t.performance.rateAtLeastOneCriterion); return; }
    if (!recommendation) { toast.error(t.performance.selectRecommendation); return; }
    if (tasks.some(tk => !tk.title.trim())) { toast.error(t.performance.allTasksMustHaveTitle); return; }

    setSaving(true);
    const toastId = toast.loading(t.performance.savingReport);

    const notes = buildNotes();
    const evalComment = `${t.performance.recommendationPrefix} ${recommendation}`;

    const result = await submitEvaluation(session.id, {
      notes,
      evaluation_score: avgScore || 3,
      evaluation_comment: evalComment,
      action_items: tasks.map(t => t.title.trim()).filter(Boolean),
    });

    if (!result.success) {
      toast.error(result.error || t.common.error, { id: toastId });
      setSaving(false);
      return;
    }

    let taskErrors = 0;
    const taskErrorMessages: string[] = [];
    for (const task of tasks.filter(tk => tk.title.trim())) {
      const res = await createTask({
        title: task.title.trim(),
        assigned_to_id: task.assigned_to_id,
        due_date: task.due_date,
        priority: task.priority,
        is_administrative: true,
        description: t.performance.improvementPlanDesc.replace('{name}', session.manager_name || 'le manager'),
      });
      if (!res.success) {
        taskErrors++;
        if ('error' in res && res.error) taskErrorMessages.push(res.error as string);
      }
    }

    setSaving(false);
    if (taskErrors > 0) {
      const errDetail = taskErrorMessages.length > 0 ? ` (${taskErrorMessages[0]})` : '';
      toast.error(`${t.performance.tasksNotCreated.replace('{count}', String(taskErrors))}${errDetail}`, { id: toastId });
    } else if (tasks.filter(tk => tk.title.trim()).length > 0) {
      toast.success(t.performance.reportSavedWithTasks.replace('{count}', String(tasks.filter(tk => tk.title.trim()).length)), { id: toastId });
    } else {
      toast.success(t.performance.evalReportSaved, { id: toastId });
    }
    onSuccess();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t.performance.evalReportTitle}</h2>
              <p className="text-sm text-gray-500">
                {session.employee_name} · {formatDate(session.scheduled_date)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-6 overflow-y-auto">

          {/* Criteria */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              {t.performance.evalCriteria}
            </h3>
            <div className="space-y-3">
              {criteria.map((c, i) => (
                <div key={c.key} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-700 w-56 shrink-0">{c.label}</span>
                  <StarRating
                    score={c.score}
                    onChange={s => setCriteria(prev =>
                      prev.map((item, idx) => idx === i ? { ...item, score: s } : item)
                    )}
                  />
                </div>
              ))}
            </div>
            {avgScore > 0 && (
              <div className="mt-3 pt-3 border-t flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{t.performance.averageScore} :</span>
                <span className={`text-sm font-bold ${avgScore >= 4 ? 'text-green-600' : avgScore >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {avgScore}/5
                </span>
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary-500" />
              {t.performance.generalComments}
            </h3>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder={t.performance.commentsPlaceholder}
              className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* Training suggestions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-green-500" />
              {t.performance.suggestedTrainings}
            </h3>
            <textarea
              value={trainings}
              onChange={e => setTrainings(e.target.value)}
              rows={2}
              placeholder={t.performance.trainingsPlaceholder}
              className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* Recommendation */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              {t.performance.recommendation} <span className="text-red-500">*</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {getRecommendations(t).map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRecommendation(r.value)}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                    recommendation === r.value ? r.activeClass : r.colorClass
                  }`}
                >
                  {r.value}
                </button>
              ))}
            </div>
          </div>

          {/* Improvement tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-orange-500" />
                {t.performance.improvementPlans}
                <span className="text-xs text-gray-400 font-normal">({t.performance.addedToCollaboratorTasks})</span>
              </h3>
              <button
                type="button"
                onClick={addTask}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.performance.add}
              </button>
            </div>
            {tasks.length === 0 && (
              <p className="text-xs text-gray-400 italic">
                {t.performance.noImprovementPlan}
              </p>
            )}
            <div className="space-y-2">
              {tasks.map(task => (
                <div key={task.id} className="flex gap-2 items-start bg-gray-50 rounded-lg p-3">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={task.title}
                      onChange={e => updateTask(task.id, 'title', e.target.value)}
                      placeholder={t.performance.taskTitlePlaceholder}
                      className="w-full px-2.5 py-1.5 border rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={task.due_date}
                        onChange={e => updateTask(task.id, 'due_date', e.target.value)}
                        className="px-2.5 py-1.5 border rounded text-xs bg-white"
                      />
                      <CustomSelect
                        value={task.priority}
<<<<<<< HEAD
                        onChange={e => updateTask(task.id, 'priority', e.target.value)}
                        className="px-2.5 py-1.5 border rounded text-xs bg-white"
                      >
                        <option value="low">{t.performance.priorityLow}</option>
                        <option value="medium">{t.performance.priorityMedium}</option>
                        <option value="high">{t.performance.priorityHigh}</option>
                        <option value="urgent">{t.performance.priorityUrgent}</option>
                      </select>
=======
                        onChange={val => updateTask(task.id, 'priority', val)}
                        options={[
                          { value: 'low', label: 'Faible' },
                          { value: 'medium', label: 'Moyen' },
                          { value: 'high', label: 'Élevé' },
                          { value: 'urgent', label: 'Urgent' },
                        ]}
                      />
>>>>>>> 90601c6384dce26fe07e59cf03eeb6d7d740787d
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded mt-0.5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            {t.performance.saveReport}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MAIN PAGE
// =============================================

export default function Evaluation1on1Page() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<OneOnOne[]>([]);
  const [filtered, setFiltered] = useState<OneOnOne[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [evaluating, setEvaluating] = useState<OneOnOne | null>(null);
  const [showEvaluated, setShowEvaluated] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [user, data] = await Promise.all([fetchCurrentUser(), fetchCompletedSessions()]);
    setCurrentUser(user);
    setSessions(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    let result = [...sessions];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.employee_name?.toLowerCase().includes(q) ||
        s.manager_name?.toLowerCase().includes(q)
      );
    }
    if (!showEvaluated) {
      result = result.filter(s => !s.evaluation_score);
    }
    setFiltered(result);
    setPage(1);
  }, [sessions, search, showEvaluated]);

  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const stats = {
    total: sessions.length,
    evaluated: sessions.filter(s => s.evaluation_score).length,
    pending: sessions.filter(s => !s.evaluation_score).length,
  };

  return (
    <>
      <Header title={t.performance.eval1on1Title} />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">

        {/* Subtitle + Action */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-gray-500">
            {t.performance.eval1on1Subtitle}
          </p>
          {currentUser && currentUser.role !== 'employee' && (
            <button
              onClick={() => {
                const pending = sessions.find(s => !s.evaluation_score);
                if (pending) setEvaluating(pending);
                else toast(t.performance.noPendingSession, { icon: '\u2139\ufe0f' });
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.performance.newEvaluation}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-primary-50 text-primary-700 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs font-medium opacity-80">{t.performance.completedSessions}</p>
            </div>
          </div>
          <div className="bg-green-50 text-green-700 rounded-xl p-4 flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{stats.evaluated}</p>
              <p className="text-xs font-medium opacity-80">{t.performance.evaluationsDone}</p>
            </div>
          </div>
          <div className="bg-orange-50 text-orange-700 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs font-medium opacity-80">{t.performance.pending}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.performance.searchCollaborator}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showEvaluated}
              onChange={e => setShowEvaluated(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t.performance.showAlreadyEvaluated}
          </label>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-20">
              <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">{t.performance.noSessionFound}</p>
              <p className="text-gray-400 text-sm mt-1">
                {sessions.length === 0
                  ? t.performance.noCompletedCoaching
                  : t.performance.tryModifyFilters}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {paginated.map(session => (
                <div key={session.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                    {getInitials(session.employee_name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {session.employee_name || t.performance.collaborator}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(session.scheduled_date)}
                      </span>
                      {session.manager_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {session.manager_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.duration_minutes} min
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {session.evaluation_score ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        <Star className="w-3 h-3 fill-green-600" />
                        {session.evaluation_score}/5
                      </div>
                      <button
                        onClick={() => setEvaluating(session)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {t.performance.modify}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEvaluating(session)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      {t.performance.evaluate}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </main>

      {evaluating && (
        <EvaluationReportModal
          session={evaluating}
          onClose={() => setEvaluating(null)}
          onSuccess={loadData}
        />
      )}
    </>
  );
}
