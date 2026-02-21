'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import {
  Users, UserPlus, ClipboardList, Calendar, Plus, Search,
  CheckCircle, XCircle, AlertCircle, Loader2, Eye, Edit, Trash2,
  ChevronDown, ChevronRight, Clock, Target, BookOpen, Monitor,
  Coffee, FileText, UserCheck, Award, TrendingUp, BarChart3,
  Handshake, MapPin, Link2, MessageSquare, Star, Play, Pause,
  X, ArrowLeft, ChevronUp, Building2, Mail, Phone, MoreHorizontal,
  CircleDot, Settings, Rocket, ShieldCheck, GraduationCap
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  total: number;
  not_started: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  avg_progress: number;
  overdue_count: number;
}

interface ActiveOnboarding {
  id: number;
  employee_id: number;
  status: string;
  progress_percentage: number;
  start_date: string;
  expected_end_date: string;
  employee_name: string;
  job_title: string;
  department_name: string;
  program_name: string;
}

interface OverdueTask {
  id: number;
  due_date: string;
  status: string;
  title: string;
  category: string;
  assigned_role: string;
  employee_name: string;
  assignment_id: number;
}

interface UpcomingGTK {
  id: number;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  location?: string;
  status: string;
  topic?: string;
  new_employee_name: string;
  meet_employee_name: string;
}

interface Program {
  id: number;
  name: string;
  description?: string;
  department_id?: number;
  department_name?: string;
  job_title?: string;
  duration_days: number;
  is_default: boolean;
  is_active: boolean;
  task_count: number;
  usage_count: number;
  created_at: string;
}

interface ProgramTask {
  id: number;
  program_id: number;
  title: string;
  description?: string;
  category: string;
  assigned_role: string;
  due_day: number;
  sort_order: number;
  is_required: boolean;
  requires_document: boolean;
  document_type?: string;
}

interface Assignment {
  id: number;
  employee_id: number;
  program_id: number;
  manager_id?: number;
  buddy_id?: number;
  start_date: string;
  expected_end_date?: string;
  status: string;
  progress_percentage: number;
  total_tasks: number;
  completed_tasks: number;
  notes?: string;
  employee_name: string;
  employee_job_title?: string;
  employee_email?: string;
  department_name?: string;
  program_name: string;
  manager_name?: string;
  buddy_name?: string;
  created_at: string;
}

interface AssignmentDetail extends Assignment {
  employee_phone?: string;
  hire_date?: string;
  program_description?: string;
  tasks: TaskProgress[];
  get_to_know_meetings: GTKMeeting[];
}

interface TaskProgress {
  id: number;
  task_id: number;
  assignment_id: number;
  status: string;
  due_date?: string;
  completed_by?: number;
  completed_at?: string;
  completed_by_name?: string;
  notes?: string;
  title: string;
  task_description?: string;
  category: string;
  assigned_role: string;
  due_day: number;
  is_required: boolean;
  requires_document: boolean;
  document_type?: string;
}

interface GTKMeeting {
  id: number;
  assignment_id?: number;
  new_employee_id: number;
  meet_employee_id: number;
  scheduled_date: string;
  scheduled_time?: string;
  duration_minutes: number;
  location?: string;
  meeting_link?: string;
  status: string;
  topic?: string;
  notes?: string;
  new_employee_name?: string;
  new_job_title?: string;
  new_department?: string;
  meet_employee_name?: string;
  meet_job_title?: string;
  meet_department?: string;
  feedback_new?: string;
  feedback_meet?: string;
  rating?: number;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  job_title?: string;
  department_name?: string;
  email?: string;
}

interface Department {
  id: number;
  name: string;
}

// ============================================
// CONSTANTS
// ============================================

const API_URL = 'https://web-production-06c3.up.railway.app';

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  administratif: { label: 'Administratif', icon: FileText, color: 'text-blue-600 bg-blue-50' },
  materiel: { label: 'Matériel', icon: Monitor, color: 'text-purple-600 bg-purple-50' },
  formation: { label: 'Formation', icon: GraduationCap, color: 'text-green-600 bg-green-50' },
  rencontre: { label: 'Rencontre', icon: Handshake, color: 'text-amber-600 bg-amber-50' },
  documentation: { label: 'Documentation', icon: BookOpen, color: 'text-indigo-600 bg-indigo-50' },
  acces_it: { label: 'Accès IT', icon: ShieldCheck, color: 'text-cyan-600 bg-cyan-50' },
  general: { label: 'Général', icon: ClipboardList, color: 'text-gray-600 bg-gray-50' },
};

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  hr: { label: 'RH', color: 'bg-blue-100 text-blue-700' },
  manager: { label: 'Manager', color: 'bg-green-100 text-green-700' },
  it: { label: 'IT', color: 'bg-purple-100 text-purple-700' },
  employee: { label: 'Employé', color: 'bg-amber-100 text-amber-700' },
  buddy: { label: 'Buddy', color: 'bg-pink-100 text-pink-700' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Non démarré', color: 'text-gray-700', bg: 'bg-gray-100' },
  in_progress: { label: 'En cours', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'Terminé', color: 'text-green-700', bg: 'bg-green-100' },
  cancelled: { label: 'Annulé', color: 'text-red-700', bg: 'bg-red-100' },
  overdue: { label: 'En retard', color: 'text-orange-700', bg: 'bg-orange-100' },
  pending: { label: 'En attente', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  skipped: { label: 'Passé', color: 'text-gray-500', bg: 'bg-gray-50' },
  blocked: { label: 'Bloqué', color: 'text-red-700', bg: 'bg-red-100' },
  scheduled: { label: 'Planifié', color: 'text-blue-700', bg: 'bg-blue-100' },
  confirmed: { label: 'Confirmé', color: 'text-green-700', bg: 'bg-green-100' },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'À faire', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  in_progress: { label: 'En cours', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'Fait', color: 'text-green-700', bg: 'bg-green-100' },
  skipped: { label: 'Passé', color: 'text-gray-500', bg: 'bg-gray-50' },
  blocked: { label: 'Bloqué', color: 'text-red-700', bg: 'bg-red-100' },
};

// ============================================
// HELPERS
// ============================================

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function getUserFromStorage(): { role: string; employeeId: number | null; userId: number | null } {
  if (typeof window === 'undefined') return { role: 'employee', employeeId: null, userId: null };
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return {
        role: (user.role || 'employee').toLowerCase(),
        employeeId: user.employee_id || null,
        userId: user.id || null,
      };
    }
  } catch (e) { console.error(e); }
  return { role: 'employee', employeeId: null, userId: null };
}

function canManageAll(role: string): boolean {
  return ['rh', 'admin', 'dg', 'superadmin'].includes(role);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

function daysFromNow(dateStr: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
  return res.json();
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatusBadge({ status, config }: { status: string; config?: Record<string, { label: string; color: string; bg: string }> }) {
  const cfg = (config || STATUS_CONFIG)[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>;
}

function ProgressBar({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const color = value >= 100 ? 'bg-green-500' : value >= 50 ? 'bg-blue-500' : value >= 25 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className={`w-full bg-gray-200 rounded-full ${h}`}>
      <div className={`${color} ${h} rounded-full transition-all duration-500`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: number | string; icon: any; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}><Icon size={22} /></div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="text-center py-12">
      <Icon size={48} className="mx-auto text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-500">{title}</h3>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ============================================
// SEARCHABLE SELECT COMPONENT
// ============================================

interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
}

function SearchableSelect({ 
  options, value, onChange, placeholder = 'Rechercher...', emptyLabel = 'Aucun résultat', className = ''
}: { 
  options: SelectOption[]; value: string; onChange: (val: string) => void; 
  placeholder?: string; emptyLabel?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o => 
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.subtitle && o.subtitle.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="w-full border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between hover:border-gray-400 transition-colors"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 bg-gray-50 rounded-md px-2 py-1.5">
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="flex-1 text-sm outline-none bg-transparent"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch('')} className="p-0.5 hover:bg-gray-200 rounded">
                  <X size={12} className="text-gray-400" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {placeholder && (
              <button
                onClick={() => { onChange(''); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!value ? 'bg-blue-50 text-blue-700' : 'text-gray-400'}`}
              >
                {placeholder}
              </button>
            )}
            {filtered.length > 0 ? filtered.map(o => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${o.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
              >
                <span>{o.label}</span>
                {o.subtitle && <span className="text-xs text-gray-400 ml-1">— {o.subtitle}</span>}
              </button>
            )) : (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">{emptyLabel}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

type TabType = 'dashboard' | 'programmes' | 'suivi' | 'get_to_know';

export default function OnboardingPage() {
  const [role, setRole] = useState('employee');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dashboard
  const [dashData, setDashData] = useState<{
    stats: DashboardStats;
    active_onboardings: ActiveOnboarding[];
    overdue_tasks: OverdueTask[];
    upcoming_get_to_know: UpcomingGTK[];
  } | null>(null);

  // Programmes
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<(Program & { tasks: ProgramTask[] }) | null>(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ProgramTask | null>(null);

  // Suivi (Assignments)
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentDetail | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [suiviFilter, setSuiviFilter] = useState('all');

  // Get to Know
  const [gtkMeetings, setGtkMeetings] = useState<GTKMeeting[]>([]);
  const [showGTKModal, setShowGTKModal] = useState(false);
  const [gtkFilter, setGtkFilter] = useState('upcoming');

  // Shared
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Init
  useEffect(() => {
    const { role: r, employeeId: eid } = getUserFromStorage();
    setRole(r);
    setEmployeeId(eid);
  }, []);

  // Fetch employees & departments
  useEffect(() => {
    if (!canManageAll(role)) return;
    apiFetch('/api/employees/?limit=200').then(res => setEmployees(res.employees || res.items || res || [])).catch(() => {});
    apiFetch('/api/departments/').then(res => setDepartments(res.departments || res.items || res || [])).catch(() => {});
  }, [role]);

  // Fetch data per tab
  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboard();
    if (activeTab === 'programmes') fetchPrograms();
    if (activeTab === 'suivi') fetchAssignments();
    if (activeTab === 'get_to_know') fetchGTK();
  }, [activeTab, suiviFilter, gtkFilter]);

  // Écouter l'event du header "+Ajouter"
  useEffect(() => {
    const handler = () => setShowAssignModal(true);
    window.addEventListener('onboarding-add', handler);
    return () => window.removeEventListener('onboarding-add', handler);
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/onboarding/dashboard');
      setDashData(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/onboarding/programs');
      setPrograms(data.items || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const fetchProgramDetail = async (id: number) => {
    try {
      const data = await apiFetch(`/api/onboarding/programs/${id}`);
      setSelectedProgram(data);
    } catch (e: any) { setError(e.message); }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      let url = '/api/onboarding/assignments';
      if (suiviFilter !== 'all') url += `?status=${suiviFilter}`;
      const data = await apiFetch(url);
      setAssignments(data.items || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const fetchAssignmentDetail = async (id: number) => {
    try {
      const data = await apiFetch(`/api/onboarding/assignments/${id}`);
      setSelectedAssignment(data);
    } catch (e: any) { setError(e.message); }
  };

  const fetchGTK = async () => {
    setLoading(true);
    try {
      let url = '/api/onboarding/get-to-know';
      if (gtkFilter === 'upcoming') url += '?upcoming=true';
      else if (gtkFilter !== 'all') url += `?status=${gtkFilter}`;
      const data = await apiFetch(url);
      setGtkMeetings(data.items || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const updateTaskStatus = async (progressId: number, status: string) => {
    try {
      await apiFetch(`/api/onboarding/progress/${progressId}`, {
        method: 'PUT', body: JSON.stringify({ status })
      });
      if (selectedAssignment) fetchAssignmentDetail(selectedAssignment.id);
    } catch (e: any) { setError(e.message); }
  };

  const isHR = canManageAll(role);

  // ============================================
  // TAB: DASHBOARD
  // ============================================

  const renderDashboard = () => {
    if (!dashData) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={32} /></div>;
    const { stats, active_onboardings, overdue_tasks, upcoming_get_to_know } = dashData;

    return (
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total onboardings" value={stats.total} icon={Users} color="bg-blue-50 text-blue-600" />
          <StatCard label="En cours" value={stats.in_progress} icon={Rocket} color="bg-amber-50 text-amber-600" sub={`${stats.avg_progress}% progrès moyen`} />
          <StatCard label="Terminés" value={stats.completed} icon={CheckCircle} color="bg-green-50 text-green-600" />
          <StatCard label="En retard" value={stats.overdue_count} icon={AlertCircle} color="bg-red-50 text-red-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Onboardings actifs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Onboardings actifs</h3>
              <span className="text-xs text-gray-400">{active_onboardings.length} en cours</span>
            </div>
            <div className="divide-y divide-gray-50">
              {active_onboardings.length === 0 ? (
                <EmptyState icon={Users} title="Aucun onboarding actif" />
              ) : active_onboardings.map(ob => (
                <div key={ob.id} className="px-5 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => { setActiveTab('suivi'); fetchAssignmentDetail(ob.id); }}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="font-medium text-sm">{ob.employee_name}</span>
                      <span className="text-xs text-gray-400 ml-2">{ob.job_title}</span>
                    </div>
                    <StatusBadge status={ob.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    <span>{ob.program_name}</span>
                    <span>•</span>
                    <span>{ob.department_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressBar value={ob.progress_percentage} size="sm" />
                    <span className="text-xs font-medium text-gray-600 whitespace-nowrap">{ob.progress_percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tâches en retard + GTK à venir */}
          <div className="space-y-6">
            {/* Overdue */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                <h3 className="font-semibold text-gray-900">Tâches en retard</h3>
                {overdue_tasks.length > 0 && <span className="ml-auto bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{overdue_tasks.length}</span>}
              </div>
              <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {overdue_tasks.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Aucune tâche en retard 🎉</p>
                ) : overdue_tasks.map(t => (
                  <div key={t.id} className="px-5 py-2.5 flex items-center justify-between hover:bg-red-50/30">
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.employee_name} • dû le {formatDate(t.due_date)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_CONFIG[t.assigned_role]?.color || 'bg-gray-100'}`}>
                      {ROLE_CONFIG[t.assigned_role]?.label || t.assigned_role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming GTK */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Handshake size={16} className="text-amber-500" />
                <h3 className="font-semibold text-gray-900">Prochains Get to Know</h3>
              </div>
              <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {upcoming_get_to_know.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Aucune rencontre planifiée</p>
                ) : upcoming_get_to_know.map(g => (
                  <div key={g.id} className="px-5 py-2.5 hover:bg-amber-50/30">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{g.new_employee_name} ↔ {g.meet_employee_name}</p>
                      <StatusBadge status={g.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <Calendar size={12} /> {formatDate(g.scheduled_date)}
                      <Clock size={12} /> {formatTime(g.scheduled_time)}
                      {g.location && <><MapPin size={12} /> {g.location}</>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // TAB: PROGRAMMES
  // ============================================

  const renderProgrammes = () => {
    if (selectedProgram) return renderProgramDetail();

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Programmes d'intégration</h3>
          {isHR && (
            <button onClick={() => { setEditingProgram(null); setShowProgramModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Plus size={16} /> Nouveau programme
            </button>
          )}
        </div>

        {programs.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Aucun programme" subtitle="Créez votre premier programme d'onboarding" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map(p => (
              <div key={p.id} onClick={() => fetchProgramDetail(p.id)}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-blue-600">{p.name}</h4>
                    {p.department_name && <span className="text-xs text-gray-400">{p.department_name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.is_default && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Par défaut</span>}
                    {!p.is_active && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactif</span>}
                  </div>
                </div>
                {p.description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{p.description}</p>}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><ClipboardList size={13} /> {p.task_count} tâches</span>
                  <span className="flex items-center gap-1"><Calendar size={13} /> {p.duration_days} jours</span>
                  <span className="flex items-center gap-1"><Users size={13} /> {p.usage_count} utilisé{p.usage_count > 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderProgramDetail = () => {
    if (!selectedProgram) return null;
    const p = selectedProgram;
    const grouped: Record<string, ProgramTask[]> = {};
    (p.tasks || []).forEach(t => {
      const cat = t.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });

    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedProgram(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Retour aux programmes
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">{p.name}</h3>
              {p.description && <p className="text-sm text-gray-500 mt-1">{p.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                {p.department_name && <span className="flex items-center gap-1"><Building2 size={12} /> {p.department_name}</span>}
                <span className="flex items-center gap-1"><Calendar size={12} /> {p.duration_days} jours</span>
                <span className="flex items-center gap-1"><ClipboardList size={12} /> {(p.tasks || []).length} tâches</span>
              </div>
            </div>
            {isHR && (
              <div className="flex gap-2">
                <button onClick={() => { setEditingProgram(p); setShowProgramModal(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"><Edit size={14} /> Modifier</button>
                <button onClick={() => { setEditingTask(null); setShowTaskModal(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus size={14} /> Tâche</button>
              </div>
            )}
          </div>
        </div>

        {/* Tasks grouped by category */}
        {Object.entries(grouped).map(([cat, tasks]) => {
          const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.general;
          const CatIcon = cfg.icon;
          return (
            <div key={cat} className="bg-white rounded-xl border border-gray-200">
              <div className={`px-5 py-3 border-b border-gray-100 flex items-center gap-2`}>
                <span className={`p-1.5 rounded-lg ${cfg.color}`}><CatIcon size={15} /></span>
                <h4 className="font-semibold text-sm">{cfg.label}</h4>
                <span className="text-xs text-gray-400 ml-auto">{tasks.length} tâche{tasks.length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {tasks.sort((a, b) => a.due_day - b.due_day).map(t => (
                  <div key={t.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      {t.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs ml-4">
                      <span className="text-gray-400">J+{t.due_day}</span>
                      <span className={`px-2 py-0.5 rounded-full ${ROLE_CONFIG[t.assigned_role]?.color || 'bg-gray-100'}`}>
                        {ROLE_CONFIG[t.assigned_role]?.label || t.assigned_role}
                      </span>
                      {t.is_required && <span className="text-red-400" title="Obligatoire">*</span>}
                      {t.requires_document && <span className="text-gray-400" title="Document requis"><FileText size={13} /></span>}
                      {isHR && (
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditingTask(t); setShowTaskModal(true); }}
                            className="text-gray-300 hover:text-blue-500"><Edit size={14} /></button>
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('Supprimer cette tâche ?')) {
                              await apiFetch(`/api/onboarding/tasks/${t.id}`, { method: 'DELETE' });
                              fetchProgramDetail(p.id);
                            }
                          }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ============================================
  // TAB: SUIVI
  // ============================================

  const renderSuivi = () => {
    if (selectedAssignment) return renderAssignmentDetail();

    const filteredAssignments = assignments.filter(a =>
      !searchTerm || a.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.program_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Suivi des onboardings</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Rechercher..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-56" />
            </div>
            {isHR && (
              <button onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <UserPlus size={16} /> Assigner
              </button>
            )}
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: 'all', label: 'Tous' },
            { value: 'not_started', label: 'Non démarrés' },
            { value: 'in_progress', label: 'En cours' },
            { value: 'completed', label: 'Terminés' },
          ].map(f => (
            <button key={f.value} onClick={() => setSuiviFilter(f.value)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                suiviFilter === f.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}>{f.label}</button>
          ))}
        </div>

        {filteredAssignments.length === 0 ? (
          <EmptyState icon={Users} title="Aucun onboarding trouvé" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Employé</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Programme</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Progression</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Début</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAssignments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => fetchAssignmentDetail(a.id)}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{a.employee_name}</p>
                      <p className="text-xs text-gray-400">{a.employee_job_title} • {a.department_name}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{a.program_name}</td>
                    <td className="px-5 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={a.progress_percentage} size="sm" />
                        <span className="text-xs font-medium whitespace-nowrap">{a.progress_percentage}%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{a.completed_tasks}/{a.total_tasks} tâches</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(a.start_date)}</td>
                    <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-3 text-right">
                      <button className="text-gray-400 hover:text-blue-600"><Eye size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderAssignmentDetail = () => {
    if (!selectedAssignment) return null;
    const a = selectedAssignment;
    const tasksByCategory: Record<string, TaskProgress[]> = {};
    (a.tasks || []).forEach(t => {
      const cat = t.category || 'general';
      if (!tasksByCategory[cat]) tasksByCategory[cat] = [];
      tasksByCategory[cat].push(t);
    });

    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedAssignment(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Retour au suivi
        </button>

        {/* Employee info header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">{a.employee_name}</h3>
              <p className="text-sm text-gray-500">{a.employee_job_title} • {a.department_name}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-400">
                {a.employee_email && <span className="flex items-center gap-1"><Mail size={12} /> {a.employee_email}</span>}
                {a.hire_date && <span className="flex items-center gap-1"><Calendar size={12} /> Embauche: {formatDate(a.hire_date)}</span>}
                {a.manager_name && <span className="flex items-center gap-1"><UserCheck size={12} /> Manager: {a.manager_name}</span>}
                {a.buddy_name && <span className="flex items-center gap-1"><Handshake size={12} /> Buddy: {a.buddy_name}</span>}
              </div>
            </div>
            <div className="text-right">
              <StatusBadge status={a.status} />
              <div className="mt-2 w-48">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-400">Progression</span>
                  <span className="font-semibold">{a.progress_percentage}%</span>
                </div>
                <ProgressBar value={a.progress_percentage} />
                <p className="text-xs text-gray-400 mt-1">{a.completed_tasks}/{a.total_tasks} tâches • {a.program_name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks checklist */}
        {Object.entries(tasksByCategory).map(([cat, tasks]) => {
          const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.general;
          const CatIcon = cfg.icon;
          const done = tasks.filter(t => t.status === 'completed').length;

          return (
            <div key={cat} className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className={`p-1.5 rounded-lg ${cfg.color}`}><CatIcon size={15} /></span>
                <h4 className="font-semibold text-sm">{cfg.label}</h4>
                <span className="text-xs text-gray-400 ml-auto">{done}/{tasks.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {tasks.sort((x, y) => (x.due_day || 0) - (y.due_day || 0)).map(t => {
                  const isOverdue = t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date();
                  return (
                    <div key={t.id} className={`px-5 py-3 flex items-center gap-3 ${isOverdue ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>
                      {/* Checkbox */}
                      <button
                        onClick={() => updateTaskStatus(t.id, t.status === 'completed' ? 'pending' : 'completed')}
                        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          t.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-blue-400'
                        }`}>
                        {t.status === 'completed' && <CheckCircle size={14} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${t.status === 'completed' ? 'line-through text-gray-400' : ''}`}>{t.title}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded ${ROLE_CONFIG[t.assigned_role]?.color || 'bg-gray-100'}`}>
                            {ROLE_CONFIG[t.assigned_role]?.label || t.assigned_role}
                          </span>
                          {t.due_date && <span className={isOverdue ? 'text-red-500 font-medium' : ''}>Dû le {formatDate(t.due_date)}</span>}
                          {t.completed_by_name && <span className="text-green-500">✓ {t.completed_by_name}</span>}
                          {t.is_required && <span className="text-red-400">Obligatoire</span>}
                        </div>
                      </div>

                      {/* Status dropdown */}
                      {t.status !== 'completed' && (
                        <select value={t.status} onChange={e => updateTaskStatus(t.id, e.target.value)}
                          className="text-xs border rounded px-2 py-1 bg-white">
                          <option value="pending">À faire</option>
                          <option value="in_progress">En cours</option>
                          <option value="completed">Fait</option>
                          <option value="skipped">Passé</option>
                          <option value="blocked">Bloqué</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Get to Know meetings */}
        {a.get_to_know_meetings && a.get_to_know_meetings.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Handshake size={16} className="text-amber-500" />
              <h4 className="font-semibold text-sm">Rencontres Get to Know</h4>
            </div>
            <div className="divide-y divide-gray-50">
              {a.get_to_know_meetings.map(m => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Rencontre avec {m.meet_employee_name}</p>
                    <p className="text-xs text-gray-400">{m.meet_job_title} • {m.meet_department}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <Calendar size={12} /> {formatDate(m.scheduled_date)}
                      {m.scheduled_time && <><Clock size={12} /> {formatTime(m.scheduled_time)}</>}
                      {m.location && <><MapPin size={12} /> {m.location}</>}
                    </div>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // TAB: GET TO KNOW
  // ============================================

  const renderGetToKnow = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Rencontres Get to Know</h3>
        {isHR && (
          <button onClick={() => setShowGTKModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600">
            <Plus size={16} /> Planifier
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { value: 'upcoming', label: 'À venir' },
          { value: 'all', label: 'Tous' },
          { value: 'completed', label: 'Terminés' },
          { value: 'cancelled', label: 'Annulés' },
        ].map(f => (
          <button key={f.value} onClick={() => setGtkFilter(f.value)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              gtkFilter === f.value ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}>{f.label}</button>
        ))}
      </div>

      {gtkMeetings.length === 0 ? (
        <EmptyState icon={Handshake} title="Aucune rencontre" subtitle="Planifiez des rencontres Get to Know pour les nouveaux employés" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gtkMeetings.map(g => (
            <div key={g.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Handshake size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{g.new_employee_name}</p>
                    <p className="text-xs text-gray-400">rencontre</p>
                    <p className="font-semibold text-sm">{g.meet_employee_name}</p>
                  </div>
                </div>
                <StatusBadge status={g.status} />
              </div>

              {g.topic && <p className="text-sm text-gray-600 mb-2">{g.topic}</p>}

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-3">
                <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(g.scheduled_date)}</span>
                {g.scheduled_time && <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(g.scheduled_time)}</span>}
                <span className="flex items-center gap-1"><Clock size={12} /> {g.duration_minutes} min</span>
                {g.location && <span className="flex items-center gap-1"><MapPin size={12} /> {g.location}</span>}
              </div>

              <div className="flex items-center gap-3 text-xs">
                {g.new_department && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{g.new_department}</span>}
                {g.meet_department && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{g.meet_department}</span>}
              </div>

              {(g.feedback_new || g.rating) && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {g.rating && (
                    <div className="flex items-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={14} className={s <= g.rating! ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
                      ))}
                    </div>
                  )}
                  {g.feedback_new && <p className="text-xs text-gray-500 italic">"{g.feedback_new}"</p>}
                </div>
              )}

              {g.meeting_link && (
                <a href={g.meeting_link} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <Link2 size={12} /> Lien de la réunion
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================
  // MODALS
  // ============================================

  const ProgramModal = () => {
    const [name, setName] = useState(editingProgram?.name || '');
    const [desc, setDesc] = useState(editingProgram?.description || '');
    const [deptId, setDeptId] = useState<string>(editingProgram?.department_id?.toString() || '');
    const [jobTitle, setJobTitle] = useState(editingProgram?.job_title || '');
    const [days, setDays] = useState(editingProgram?.duration_days || 90);
    const [isDefault, setIsDefault] = useState(editingProgram?.is_default || false);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
      if (!name.trim()) return;
      setSaving(true);
      try {
        const body: any = { name, description: desc || null, department_id: deptId ? parseInt(deptId) : null, job_title: jobTitle || null, duration_days: days, is_default: isDefault };
        if (editingProgram) {
          await apiFetch(`/api/onboarding/programs/${editingProgram.id}`, { method: 'PUT', body: JSON.stringify(body) });
        } else {
          await apiFetch('/api/onboarding/programs', { method: 'POST', body: JSON.stringify(body) });
        }
        setShowProgramModal(false);
        fetchPrograms();
      } catch (e: any) { setError(e.message); }
      setSaving(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">{editingProgram ? 'Modifier le programme' : 'Nouveau programme'}</h3>
            <button onClick={() => setShowProgramModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nom *</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Programme Standard" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Description du programme..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Département</label>
                <select value={deptId} onChange={e => setDeptId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Tous les départements</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Durée (jours)</label>
                <input type="number" value={days} onChange={e => setDays(parseInt(e.target.value) || 90)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Poste visé</label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optionnel" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded" />
              Programme par défaut
            </label>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button onClick={() => setShowProgramModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Annuler</button>
            <button onClick={handleSave} disabled={saving || !name.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : editingProgram ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const TaskModal = () => {
    const [title, setTitle] = useState(editingTask?.title || '');
    const [desc, setDesc] = useState(editingTask?.description || '');
    const [category, setCategory] = useState(editingTask?.category || 'administratif');
    const [assignedRole, setAssignedRole] = useState(editingTask?.assigned_role || 'hr');
    const [dueDay, setDueDay] = useState(editingTask?.due_day || 1);
    const [isRequired, setIsRequired] = useState(editingTask?.is_required ?? true);
    const [requiresDoc, setRequiresDoc] = useState(editingTask?.requires_document || false);
    const [docType, setDocType] = useState(editingTask?.document_type || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
      if (!title.trim() || !selectedProgram) return;
      setSaving(true);
      try {
        if (editingTask) {
          await apiFetch(`/api/onboarding/tasks/${editingTask.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              title, description: desc || null, category, assigned_role: assignedRole,
              due_day: dueDay, is_required: isRequired, requires_document: requiresDoc,
              document_type: requiresDoc && docType ? docType : null
            })
          });
        } else {
          await apiFetch('/api/onboarding/tasks', {
            method: 'POST',
            body: JSON.stringify({
              program_id: selectedProgram.id, title, description: desc || null,
              category, assigned_role: assignedRole, due_day: dueDay,
              is_required: isRequired, requires_document: requiresDoc,
              document_type: requiresDoc && docType ? docType : null
            })
          });
        }
        setShowTaskModal(false);
        setEditingTask(null);
        fetchProgramDetail(selectedProgram.id);
      } catch (e: any) { setError(e.message); }
      setSaving(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">{editingTask ? 'Modifier la tâche' : 'Ajouter une tâche'}</h3>
            <button onClick={() => { setShowTaskModal(false); setEditingTask(null); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Titre *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Catégorie</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Assigné à</label>
                <select value={assignedRole} onChange={e => setAssignedRole(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Jour d'échéance (J+)</label>
              <input type="number" value={dueDay} onChange={e => setDueDay(parseInt(e.target.value) || 1)} min={1} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-1">Nombre de jours après le début de l'onboarding</p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="rounded" /> Obligatoire
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={requiresDoc} onChange={e => setRequiresDoc(e.target.checked)} className="rounded" /> Document requis
              </label>
            </div>
            {requiresDoc && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Type de document</label>
                <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Sélectionner</option>
                  <option value="contrat_travail">Contrat de travail</option>
                  <option value="cni">CNI</option>
                  <option value="passeport">Passeport</option>
                  <option value="diplome">Diplôme</option>
                  <option value="cv">CV</option>
                  <option value="rib">RIB</option>
                  <option value="photo_identite">Photo d'identité</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button onClick={() => { setShowTaskModal(false); setEditingTask(null); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Annuler</button>
            <button onClick={handleSave} disabled={saving || !title.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : editingTask ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AssignModal = () => {
    const [empId, setEmpId] = useState('');
    const [progId, setProgId] = useState('');
    const [managerId, setManagerId] = useState('');
    const [buddyId, setBuddyId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (programs.length === 0) fetchPrograms();
    }, []);

    const handleSave = async () => {
      if (!empId || !progId) return;
      setSaving(true);
      try {
        await apiFetch('/api/onboarding/assignments', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: parseInt(empId), program_id: parseInt(progId),
            manager_id: managerId ? parseInt(managerId) : null,
            buddy_id: buddyId ? parseInt(buddyId) : null,
            start_date: startDate, notes: notes || null
          })
        });
        setShowAssignModal(false);
        fetchAssignments();
        if (activeTab === 'dashboard') fetchDashboard();
      } catch (e: any) { setError(e.message); }
      setSaving(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Assigner un onboarding</h3>
            <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Employé *</label>
              <SearchableSelect
                value={empId}
                onChange={setEmpId}
                placeholder="Sélectionner un employé"
                options={employees.map(e => ({ value: String(e.id), label: `${e.first_name} ${e.last_name}`, subtitle: e.job_title || '' }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Programme *</label>
              <SearchableSelect
                value={progId}
                onChange={setProgId}
                placeholder="Sélectionner un programme"
                options={programs.filter(p => p.is_active).map(p => ({ value: String(p.id), label: p.name, subtitle: `${p.task_count} tâches` }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Manager</label>
                <SearchableSelect
                  value={managerId}
                  onChange={setManagerId}
                  placeholder="Auto (depuis fiche)"
                  options={employees.map(e => ({ value: String(e.id), label: `${e.first_name} ${e.last_name}`, subtitle: e.job_title || '' }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Buddy / Parrain</label>
                <SearchableSelect
                  value={buddyId}
                  onChange={setBuddyId}
                  placeholder="Aucun"
                  options={employees.map(e => ({ value: String(e.id), label: `${e.first_name} ${e.last_name}`, subtitle: e.job_title || '' }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date de début</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Informations complémentaires..." />
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Annuler</button>
            <button onClick={handleSave} disabled={saving || !empId || !progId} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Assigner'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const GTKModal = () => {
    const [newEmpId, setNewEmpId] = useState('');
    const [meetEmpId, setMeetEmpId] = useState('');
    const [assignId, setAssignId] = useState('');
    const [date_, setDate_] = useState('');
    const [time_, setTime_] = useState('10:00');
    const [duration, setDuration] = useState(30);
    const [location, setLocation] = useState('');
    const [link, setLink] = useState('');
    const [topic, setTopic] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
      if (!newEmpId || !meetEmpId || !date_) return;
      setSaving(true);
      try {
        await apiFetch('/api/onboarding/get-to-know', {
          method: 'POST',
          body: JSON.stringify({
            new_employee_id: parseInt(newEmpId), meet_employee_id: parseInt(meetEmpId),
            assignment_id: assignId ? parseInt(assignId) : null,
            scheduled_date: date_, scheduled_time: time_, duration_minutes: duration,
            location: location || null, meeting_link: link || null, topic: topic || null
          })
        });
        setShowGTKModal(false);
        fetchGTK();
      } catch (e: any) { setError(e.message); }
      setSaving(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Planifier un Get to Know</h3>
            <button onClick={() => setShowGTKModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nouvel employé *</label>
              <SearchableSelect
                value={newEmpId}
                onChange={setNewEmpId}
                placeholder="Sélectionner"
                options={employees.map(e => ({ value: String(e.id), label: `${e.first_name} ${e.last_name}`, subtitle: e.job_title || '' }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Rencontre avec *</label>
              <SearchableSelect
                value={meetEmpId}
                onChange={setMeetEmpId}
                placeholder="Sélectionner"
                options={employees.filter(e => e.id.toString() !== newEmpId).map(e => ({ value: String(e.id), label: `${e.first_name} ${e.last_name}`, subtitle: e.job_title || '' }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Onboarding lié</label>
              <select value={assignId} onChange={e => setAssignId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Aucun</option>
                {assignments.filter(a => a.status === 'in_progress' || a.status === 'not_started').map(a => <option key={a.id} value={a.id}>{a.employee_name} - {a.program_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Date *</label>
                <input type="date" value={date_} onChange={e => setDate_(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Heure</label>
                <input type="time" value={time_} onChange={e => setTime_(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Durée (min)</label>
                <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 30)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Lieu</label>
                <input value={location} onChange={e => setLocation(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Salle de réunion, etc." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Lien visio</label>
                <input value={link} onChange={e => setLink(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Sujet / Thème</label>
              <input value={topic} onChange={e => setTopic(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Présentation de l'équipe, etc." />
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button onClick={() => setShowGTKModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Annuler</button>
            <button onClick={handleSave} disabled={saving || !newEmpId || !meetEmpId || !date_} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Planifier'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // TABS
  // ============================================

  const tabs: { id: TabType; label: string; icon: any; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'programmes', label: 'Programmes', icon: ClipboardList },
    { id: 'suivi', label: 'Suivi', icon: Users, badge: dashData?.stats.in_progress },
    { id: 'get_to_know', label: 'Get to Know', icon: Handshake },
  ];

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Onboarding" subtitle="Gestion de l'intégration des nouveaux collaborateurs" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Error banner */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X size={16} /></button>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setSelectedAssignment(null); setSelectedProgram(null); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <Icon size={16} />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        )}

        {/* Content */}
        {!loading && (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'programmes' && renderProgrammes()}
            {activeTab === 'suivi' && renderSuivi()}
            {activeTab === 'get_to_know' && renderGetToKnow()}
          </>
        )}
      </div>

      {/* Modals */}
      {showProgramModal && <ProgramModal />}
      {showTaskModal && <TaskModal />}
      {showAssignModal && <AssignModal />}
      {showGTKModal && <GTKModal />}
    </div>
  );
}