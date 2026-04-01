'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { teamTips } from '@/config/pageTips';
import {
  Users, CheckCircle, XCircle, Clock, AlertCircle, Calendar,
  ChevronDown, ChevronUp, User, TrendingUp, Briefcase, Target,
  MessageSquare, Cake, Star, Loader2, X, Palmtree, BarChart3,
  ListTodo, CalendarClock
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface UserProfile { id: number; employee_id?: number; }

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  department_name?: string;
  status?: string;
  is_manager?: boolean;
  date_of_birth?: string;
  hire_date?: string;
}

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason?: string;
  status: string;
  created_at: string;
}

interface PerfScore {
  overall_score: number;
  okr_score: number;
  task_score: number;
  validation_score: number;
  feedback_score: number;
}

interface OKRObjective {
  id: number;
  title: string;
  progress: number;
  status: string;
  key_results?: { id: number; title: string; progress: number }[];
}

interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority: string;
  due_date: string;
  is_overdue: boolean;
}

interface LeaveBalance {
  leave_type_name: string;
  allocated: number;
  taken: number;
  pending: number;
  available: number;
}

interface OneOnOne {
  id: number;
  employee_id: number;
  employee_name: string;
  scheduled_date: string;
  status: string;
  topics?: string;
}

interface Anniversary {
  employee: Employee;
  type: 'birthday' | 'work';
  date: Date;
  years?: number;
}

// ============================================
// API
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
}

async function apiFetch(path: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Erreur API');
  return res.json();
}

async function getCurrentUser(): Promise<UserProfile> { return apiFetch('/api/auth/me'); }
async function getEmployee(id: number): Promise<Employee> { return apiFetch(`/api/employees/${id}`); }
async function getDirectReports(managerId: number): Promise<Employee[]> {
  try { return await apiFetch(`/api/employees/${managerId}/direct-reports`); } catch { return []; }
}

async function getTeamLeaveRequests(teamMembers: Employee[]): Promise<LeaveRequest[]> {
  const allRequests: LeaveRequest[] = [];
  for (const member of teamMembers) {
    try {
      const data = await apiFetch(`/api/leaves/requests?employee_id=${member.id}&status=pending`);
      const requests = (data.items || []).map((r: LeaveRequest) => ({ ...r, employee_name: `${member.first_name} ${member.last_name}` }));
      allRequests.push(...requests);
    } catch {}
  }
  return allRequests.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

async function approveLeaveRequest(requestId: number, approved: boolean, rejectionReason?: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/leaves/requests/${requestId}/approve`, {
    method: 'POST', headers: getAuthHeaders(),
    body: JSON.stringify({ approved, rejection_reason: rejectionReason }),
  });
  if (!res.ok) throw new Error('Erreur');
}

// Member detail API calls
async function getMemberPerformance(id: number): Promise<PerfScore | null> {
  try { return await apiFetch(`/api/performance/score/employee/${id}?period=quarter`); } catch { return null; }
}

async function getMemberOKRs(id: number): Promise<OKRObjective[]> {
  try {
    const data = await apiFetch(`/api/okr/objectives?owner_id=${id}&level=individual&page_size=10`);
    return data.items || data.objectives || [];
  } catch { return []; }
}

async function getMemberTasks(id: number): Promise<{ tasks: TaskItem[]; stats: { total: number; completed: number; in_progress: number; overdue: number } }> {
  try {
    const data = await apiFetch(`/api/tasks/team-tasks?employee_id=${id}&page_size=50`);
    const tasks: TaskItem[] = data.items || data.tasks || [];
    return {
      tasks: tasks.slice(0, 10),
      stats: {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        overdue: tasks.filter(t => t.is_overdue).length,
      }
    };
  } catch { return { tasks: [], stats: { total: 0, completed: 0, in_progress: 0, overdue: 0 } }; }
}

async function getMemberLeaveBalance(id: number): Promise<LeaveBalance[]> {
  try {
    const data = await apiFetch(`/api/leaves/balances/${id}?year=${new Date().getFullYear()}`);
    return data.balances || (Array.isArray(data) ? data : []);
  } catch { return []; }
}

async function getMemberLeaveRequests(id: number): Promise<LeaveRequest[]> {
  try {
    const data = await apiFetch(`/api/leaves/requests?employee_id=${id}&page_size=5`);
    return data.items || [];
  } catch { return []; }
}

async function getTeamOneOnOnes(): Promise<OneOnOne[]> {
  try {
    const data = await apiFetch('/api/performance/one-on-ones?status=scheduled&page_size=20');
    return data.items || [];
  } catch { return []; }
}

async function getMemberOneOnOnes(id: number): Promise<OneOnOne[]> {
  try {
    const data = await apiFetch(`/api/performance/one-on-ones?employee_id=${id}&page_size=5`);
    return data.items || [];
  } catch { return []; }
}

// ============================================
// HELPERS
// ============================================

function formatDate(d?: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getUpcomingAnniversaries(members: Employee[]): Anniversary[] {
  const now = new Date();
  const results: Anniversary[] = [];

  for (const m of members) {
    if (m.date_of_birth) {
      const dob = new Date(m.date_of_birth);
      const next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
      if (next < now) next.setFullYear(next.getFullYear() + 1);
      const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 30) {
        results.push({ employee: m, type: 'birthday', date: next });
      }
    }
    if (m.hire_date) {
      const hd = new Date(m.hire_date);
      const years = now.getFullYear() - hd.getFullYear();
      const next = new Date(now.getFullYear(), hd.getMonth(), hd.getDate());
      if (next < now) next.setFullYear(next.getFullYear() + 1);
      const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 30) {
        results.push({ employee: m, type: 'work', date: next, years: next.getFullYear() - hd.getFullYear() });
      }
    }
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

// ============================================
// COMPONENTS
// ============================================

function TeamMemberCard({ member, selected, onClick }: { member: Employee; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        selected ? 'bg-primary-50 border-primary-300 ring-1 ring-primary-200' : 'bg-gray-50 border-gray-100 hover:border-primary-200 hover:bg-gray-100'
      }`}
    >
      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
        {member.first_name[0]}{member.last_name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{member.first_name} {member.last_name}</p>
        <p className="text-sm text-gray-500 truncate">{member.job_title || 'N/A'}</p>
      </div>
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        member.status === 'active' ? 'bg-green-100 text-green-700'
        : member.status === 'on_leave' ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-700'
      }`}>
        {member.status === 'active' ? 'Actif' : member.status === 'on_leave' ? 'En congé' : member.status}
      </span>
    </div>
  );
}

function LeaveRequestCard({ request, onApprove, onReject, processing }: {
  request: LeaveRequest; onApprove: () => void; onReject: (reason: string) => void; processing: boolean;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div className="bg-white border border-yellow-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">{request.employee_name}</span>
          </div>
          <p className="text-sm text-primary-600 font-medium mb-2">{request.leave_type_name}</p>
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(request.start_date).toLocaleDateString('fr-FR')}
              {request.start_date !== request.end_date && (<> → {new Date(request.end_date).toLocaleDateString('fr-FR')}</>)}
            </span>
            <span className="font-medium">({request.days_requested} jour(s))</span>
          </div>
          {request.reason && <p className="text-sm text-gray-500 italic mt-2">&quot;{request.reason}&quot;</p>}
          <p className="text-xs text-gray-400 mt-2">Demandé le {new Date(request.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button onClick={onApprove} disabled={processing} className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50" title="Approuver"><CheckCircle className="w-6 h-6" /></button>
          <button onClick={() => setShowRejectForm(!showRejectForm)} disabled={processing} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50" title="Refuser"><XCircle className="w-6 h-6" /></button>
        </div>
      </div>
      {showRejectForm && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">Motif du refus</label>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500" rows={2} placeholder="Indiquez le motif du refus..." />
          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowRejectForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
            <button onClick={() => { if (!rejectReason.trim()) { toast.error('Veuillez indiquer un motif'); return; } onReject(rejectReason); }} disabled={processing} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">Confirmer le refus</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MEMBER DETAIL PANEL
// ============================================

function MemberDetailPanel({ member, onClose }: { member: Employee; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'perf' | 'conges' | 'taches' | 'entretiens'>('perf');
  const [perfScore, setPerfScore] = useState<PerfScore | null>(null);
  const [okrs, setOkrs] = useState<OKRObjective[]>([]);
  const [taskData, setTaskData] = useState<{ tasks: TaskItem[]; stats: { total: number; completed: number; in_progress: number; overdue: number } }>({ tasks: [], stats: { total: 0, completed: 0, in_progress: 0, overdue: 0 } });
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);

  const loadTabData = useCallback(async (tab: string) => {
    setLoadingTab(true);
    try {
      switch (tab) {
        case 'perf': {
          const [score, objectives] = await Promise.all([getMemberPerformance(member.id), getMemberOKRs(member.id)]);
          setPerfScore(score);
          setOkrs(objectives);
          break;
        }
        case 'conges': {
          const [balances, requests] = await Promise.all([getMemberLeaveBalance(member.id), getMemberLeaveRequests(member.id)]);
          setLeaveBalances(balances);
          setLeaveRequests(requests);
          break;
        }
        case 'taches': {
          const data = await getMemberTasks(member.id);
          setTaskData(data);
          break;
        }
        case 'entretiens': {
          const meetings = await getMemberOneOnOnes(member.id);
          setOneOnOnes(meetings);
          break;
        }
      }
    } catch (err) { console.error(err); }
    setLoadingTab(false);
  }, [member.id]);

  useEffect(() => { loadTabData(activeTab); }, [activeTab, loadTabData]);

  const tabs = [
    { id: 'perf' as const, label: 'Performance', icon: TrendingUp },
    { id: 'conges' as const, label: 'Congés', icon: Palmtree },
    { id: 'taches' as const, label: 'Tâches', icon: ListTodo },
    { id: 'entretiens' as const, label: 'Entretiens', icon: MessageSquare },
  ];

  const completionRate = taskData.stats.total > 0 ? Math.round((taskData.stats.completed / taskData.stats.total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-fit sticky top-6">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg">
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{member.first_name} {member.last_name}</h3>
              <p className="text-sm text-gray-500">{member.job_title || '-'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mini tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-3 h-3" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {loadingTab ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Performance Tab */}
            {activeTab === 'perf' && (
              <div className="space-y-4">
                {perfScore ? (
                  <>
                    <div className="text-center">
                      <div className="relative w-20 h-20 mx-auto mb-2">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={perfScore.overall_score >= 70 ? '#10b981' : perfScore.overall_score >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${perfScore.overall_score}, 100`} strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">{Math.round(perfScore.overall_score)}%</span>
                      </div>
                      <p className="text-sm font-medium text-gray-700">Score global</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'OKR', value: perfScore.okr_score, icon: Target },
                        { label: 'Tâches', value: perfScore.task_score, icon: ListTodo },
                        { label: 'Feedbacks', value: perfScore.feedback_score, icon: MessageSquare },
                        { label: 'Validation', value: perfScore.validation_score, icon: CheckCircle },
                      ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded-lg p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <item.icon className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                              <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(item.value, 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-700">{Math.round(item.value)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-center text-sm text-gray-400 py-4">Aucune donnée de performance</p>
                )}

                {okrs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />Objectifs</h4>
                    <div className="space-y-2">
                      {okrs.map(obj => (
                        <div key={obj.id} className="bg-gray-50 rounded-lg p-2.5">
                          <p className="text-sm font-medium text-gray-800 mb-1 truncate">{obj.title}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full">
                              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(obj.progress, 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-600">{Math.round(obj.progress)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Congés Tab */}
            {activeTab === 'conges' && (
              <div className="space-y-4">
                {leaveBalances.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Solde de congés</h4>
                    <div className="space-y-2">
                      {leaveBalances.map((b, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5">
                          <span className="text-sm text-gray-700">{b.leave_type_name}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-green-600 font-medium">{b.available}j dispo</span>
                            <span className="text-gray-400">{b.taken}j pris</span>
                            {b.pending > 0 && <span className="text-yellow-600">{b.pending}j en attente</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-400 py-2">Aucun solde de congés</p>
                )}

                {leaveRequests.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Dernières demandes</h4>
                    <div className="space-y-2">
                      {leaveRequests.map(r => (
                        <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5">
                          <div>
                            <p className="text-sm text-gray-800">{r.leave_type_name}</p>
                            <p className="text-xs text-gray-400">{formatDate(r.start_date)} → {formatDate(r.end_date)}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.status === 'approved' ? 'bg-green-100 text-green-700' :
                            r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {r.status === 'approved' ? 'Approuvé' : r.status === 'pending' ? 'En attente' : r.status === 'rejected' ? 'Refusé' : r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tâches Tab */}
            {activeTab === 'taches' && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Total', value: taskData.stats.total, color: 'text-gray-700' },
                    { label: 'En cours', value: taskData.stats.in_progress, color: 'text-blue-600' },
                    { label: 'Terminées', value: taskData.stats.completed, color: 'text-green-600' },
                    { label: 'En retard', value: taskData.stats.overdue, color: 'text-red-600' },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-gray-50 rounded-lg p-2">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Completion bar */}
                {taskData.stats.total > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Taux de complétion</span>
                      <span className="text-xs font-bold text-gray-700">{completionRate}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-200 rounded-full">
                      <div className={`h-full rounded-full transition-all ${completionRate >= 70 ? 'bg-green-500' : completionRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${completionRate}%` }} />
                    </div>
                  </div>
                )}

                {/* Recent tasks */}
                {taskData.tasks.length > 0 ? (
                  <div className="space-y-2">
                    {taskData.tasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2.5">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className={`text-sm truncate ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.title}</p>
                          <p className="text-xs text-gray-400">{formatDate(task.due_date)} {task.is_overdue && <span className="text-red-500 font-medium">En retard</span>}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_COLORS[task.priority] || 'bg-gray-100 text-gray-600'}`}>{task.priority}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-600'}`}>{task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '⏳' : '○'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-400 py-4">Aucune tâche assignée</p>
                )}
              </div>
            )}

            {/* Entretiens Tab */}
            {activeTab === 'entretiens' && (
              <div className="space-y-3">
                {oneOnOnes.length > 0 ? (
                  oneOnOnes.map(o => (
                    <div key={o.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800">{formatDate(o.scheduled_date)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          o.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                          o.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {o.status === 'scheduled' ? 'Planifié' : o.status === 'completed' ? 'Terminé' : o.status}
                        </span>
                      </div>
                      {o.topics && <p className="text-xs text-gray-500 truncate">{o.topics}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-sm text-gray-400 py-4">Aucun entretien planifié</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MyTeamPage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showTeam, setShowTeam] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Employee | null>(null);
  const [teamOneOnOnes, setTeamOneOnOnes] = useState<OneOnOne[]>([]);

  const { showTips, dismissTips } = usePageTour('team');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const user = await getCurrentUser();
      if (!user.employee_id) { setError('Compte non lié à un profil employé'); return; }

      const emp = await getEmployee(user.employee_id);
      setEmployee(emp);

      if (!emp.is_manager) { setError('Vous n\'avez pas accès à cette page'); return; }

      const team = await getDirectReports(user.employee_id);
      setTeamMembers(team);

      const [requests, oneOnOnes] = await Promise.all([
        getTeamLeaveRequests(team),
        getTeamOneOnOnes(),
      ]);
      setPendingRequests(requests);
      setTeamOneOnOnes(oneOnOnes);
    } catch (err) {
      console.error(err);
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (requestId: number) => {
    setProcessingId(requestId);
    try { await approveLeaveRequest(requestId, true); await loadData(); }
    catch { toast.error('Erreur lors de l\'approbation'); }
    finally { setProcessingId(null); }
  };

  const handleReject = async (requestId: number, reason: string) => {
    setProcessingId(requestId);
    try { await approveLeaveRequest(requestId, false, reason); await loadData(); }
    catch { toast.error('Erreur lors du refus'); }
    finally { setProcessingId(null); }
  };

  const anniversaries = getUpcomingAnniversaries(teamMembers);

  // Suppress unused var warning
  void employee;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showTips && <PageTourTips tips={teamTips} onDismiss={dismissTips} pageTitle="Mon Équipe" />}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Mon Équipe</h1>
            <p className="text-gray-500 mt-1">Gérez et suivez les performances de votre équipe</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" data-tour="team-stats">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
                <div><p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p><p className="text-sm text-gray-500">Collaborateurs</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-600" /></div>
                <div><p className="text-2xl font-bold text-gray-900">{pendingRequests.length}</p><p className="text-sm text-gray-500">Demandes en attente</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
                <div><p className="text-2xl font-bold text-gray-900">{teamMembers.filter(m => m.status === 'active').length}</p><p className="text-sm text-gray-500">Actifs aujourd&apos;hui</p></div>
              </div>
            </div>
          </div>

          {/* Pending Requests */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900">Demandes en attente ({pendingRequests.length})</h2>
            </div>
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
                <p>Aucune demande en attente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map(req => (
                  <LeaveRequestCard key={req.id} request={req} onApprove={() => handleApprove(req.id)} onReject={(reason) => handleReject(req.id, reason)} processing={processingId === req.id} />
                ))}
              </div>
            )}
          </div>

          {/* Team Members + Detail Panel */}
          <div className={`grid gap-6 mb-6 ${selectedMember ? 'lg:grid-cols-2' : ''}`}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <button onClick={() => setShowTeam(!showTeam)} className="w-full flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Mon équipe ({teamMembers.length})</h2>
                </div>
                {showTeam ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              {showTeam && (
                <div className="grid grid-cols-1 gap-3" data-tour="team-list">
                  {teamMembers.map(member => (
                    <TeamMemberCard
                      key={member.id}
                      member={member}
                      selected={selectedMember?.id === member.id}
                      onClick={() => setSelectedMember(selectedMember?.id === member.id ? null : member)}
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedMember && (
              <MemberDetailPanel member={selectedMember} onClose={() => setSelectedMember(null)} />
            )}
          </div>

          {/* Activités d'équipe — prochains 1-on-1 */}
          {teamOneOnOnes.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Activités d&apos;équipe</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teamOneOnOnes.slice(0, 6).map(o => (
                  <div key={o.id} className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-medium">
                        {o.employee_name?.split(' ').map(n => n[0]).join('') || '?'}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{o.employee_name}</span>
                    </div>
                    <p className="text-xs text-blue-700 font-medium">{formatDate(o.scheduled_date)}</p>
                    {o.topics && <p className="text-xs text-gray-500 mt-1 truncate">{o.topics}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prochains anniversaires */}
          {anniversaries.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Cake className="w-5 h-5 text-pink-500" />
                <h2 className="text-lg font-semibold text-gray-900">Prochains anniversaires</h2>
                <span className="text-sm text-gray-400">(30 prochains jours)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {anniversaries.map((a, i) => (
                  <div key={i} className={`rounded-lg p-3 border ${a.type === 'birthday' ? 'bg-pink-50 border-pink-100' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex items-center gap-2">
                      {a.type === 'birthday' ? <Cake className="w-4 h-4 text-pink-500" /> : <Star className="w-4 h-4 text-amber-500" />}
                      <span className="text-sm font-medium text-gray-900">{a.employee.first_name} {a.employee.last_name}</span>
                    </div>
                    <p className={`text-xs mt-1 ${a.type === 'birthday' ? 'text-pink-600' : 'text-amber-600'}`}>
                      {a.type === 'birthday' ? 'Anniversaire' : `${a.years} an${(a.years || 0) > 1 ? 's' : ''} dans l'entreprise`}
                      {' — '}
                      {a.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
