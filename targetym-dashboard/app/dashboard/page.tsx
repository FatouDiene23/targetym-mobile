'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, Clock, CheckCircle, Target, Users,
  ArrowRight, UserPlus, BarChart3,
  CalendarDays, ClipboardList, Bell, ChevronRight, TrendingUp, PieChart,
  Star, MessageSquare, Zap, ThumbsUp,
  Briefcase, UserCheck, Activity, Sparkles, GraduationCap, BookOpen, Building2
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/Header';
import {
  BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';

import { 
  getEmployees, 
  getEmployeeStats,
  getDepartments,
  getLeaveRequests,
  getSubsidiaryDashboardStats,
  getGroupGlobalDashboardStats,
  type Employee,
  type EmployeeStats,
  type SubsidiaryDashboardStats,
  type GroupGlobalDashboardStats
} from '@/lib/api';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { useGroupContext } from '@/hooks/useGroupContext';
import { useI18n } from '@/lib/i18n/I18nContext';

// ============================================
// TYPES
// ============================================

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg';

interface UserData { id: number; email: string; first_name?: string; last_name?: string; role?: string; employee_id?: number; }
interface LeaveBalance { leave_type_name: string; available: number; taken: number; allocated: number; }
interface LeaveBalanceSummary { total_available: number; total_taken: number; balances: LeaveBalance[]; }
interface LeaveRequest { id: number; employee_name?: string; leave_type_name?: string; start_date: string; end_date: string; days_requested: number; status: string; }
interface HRStats { total_employees: number; active_employees: number; on_leave_today: number; pending_requests: number; new_hires_this_month: number; departments_count: number; }
interface TeamMember { id: number; first_name: string; last_name: string; status: string; job_title?: string; birth_date?: string; }
interface DepartmentData { name: string; count: number; [key: string]: string | number; }
interface MonthlyData { month: string; entrees: number; sorties: number; }
interface LeavesByMonth { month: string; jours: number; }
interface OKRStats { total: number; by_level: Record<string, number>; by_status: Record<string, number>; avg_progress: number; completed: number; in_progress: number; not_started: number; overdue: number; by_department: Record<string, { count: number; avg_progress: number }>; }
interface OKRObjective { id: number; title: string; level: string; progress: number; status: string; owner_name?: string; department_name?: string; }
interface MyObjectiveData { id: number; title: string; progress: number; status: string; }
interface MyPerformanceStats { avg_score: number; evaluations_total: number; evaluations_completed: number; feedbacks_received: number; feedbacks_given: number; }
interface FeedbackItem { id: number; from_employee_name?: string; type: string; message: string; created_at: string; }
interface MyAssignment { id: number; course_title: string; course_image?: string; course_duration?: number; status: string; progress?: number; deadline?: string; completed_at?: string; }
interface TaskStats { pending: number; in_progress: number; completed: number; overdue: number; due_today: number; }

// ============================================
// API
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
}

async function getCurrentUser(): Promise<UserData | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch { return null; }
}

async function getEmployeeById(id: number): Promise<Employee | null> {
  try {
    const response = await fetch(`${API_URL}/api/employees/${id}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch { return null; }
}

async function getMyLeaveBalances(employeeId: number): Promise<LeaveBalanceSummary | null> {
  try {
    const response = await fetch(`${API_URL}/api/leaves/balances/${employeeId}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch { return null; }
}

async function getTeamMembers(managerId: number): Promise<TeamMember[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/${managerId}/direct-reports`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    return response.json();
  } catch { return []; }
}

async function getTeamPendingRequests(teamMembers: TeamMember[]): Promise<LeaveRequest[]> {
  const allRequests: LeaveRequest[] = [];
  for (const member of teamMembers.slice(0, 10)) {
    try {
      const data = await getLeaveRequests({ employee_id: member.id, status: 'pending' });
      const requests = (data.items || []).map((r: LeaveRequest) => ({ ...r, employee_name: `${member.first_name} ${member.last_name}` }));
      allRequests.push(...requests);
    } catch { /* ignore */ }
  }
  return allRequests;
}

async function getAllEmployees(subsidiaryTenantId?: number): Promise<Employee[]> {
  try { const data = await getEmployees({ page_size: 500, subsidiary_tenant_id: subsidiaryTenantId }); return data.items || []; } 
  catch { return []; }
}

async function getHRStatsData(subsidiaryTenantId?: number): Promise<HRStats> {
  try {
    const stats: EmployeeStats = await getEmployeeStats({ subsidiary_tenant_id: subsidiaryTenantId });
    const departments = await getDepartments(undefined, subsidiaryTenantId);
    let pendingRequests = 0;
    try { const reqData = await getLeaveRequests({ status: 'pending', page_size: 100, subsidiary_tenant_id: subsidiaryTenantId }); pendingRequests = (reqData.items || []).length; } catch {}
    return { total_employees: stats.total || 0, active_employees: stats.active || 0, on_leave_today: stats.on_leave || 0, pending_requests: pendingRequests, new_hires_this_month: stats.new_this_month || 0, departments_count: departments.length };
  } catch { return { total_employees: 0, active_employees: 0, on_leave_today: 0, pending_requests: 0, new_hires_this_month: 0, departments_count: 0 }; }
}

async function getAllPendingRequests(subsidiaryTenantId?: number): Promise<LeaveRequest[]> {
  try { const data = await getLeaveRequests({ status: 'pending', page_size: 10, subsidiary_tenant_id: subsidiaryTenantId }); return data.items || []; } catch { return []; }
}

async function getAllLeaveRequests(subsidiaryTenantId?: number): Promise<LeaveRequest[]> {
  try { const data = await getLeaveRequests({ page_size: 100, subsidiary_tenant_id: subsidiaryTenantId }); return data.items || []; } catch { return []; }
}

async function getOKRStats(): Promise<OKRStats> {
  try {
    const response = await fetch(`${API_URL}/api/okr/stats`, { headers: getAuthHeaders() });
    if (!response.ok) return { total: 0, by_level: {}, by_status: {}, avg_progress: 0, completed: 0, in_progress: 0, not_started: 0, overdue: 0, by_department: {} };
    return response.json();
  } catch { return { total: 0, by_level: {}, by_status: {}, avg_progress: 0, completed: 0, in_progress: 0, not_started: 0, overdue: 0, by_department: {} }; }
}

async function getCriticalOKRs(): Promise<OKRObjective[]> {
  try {
    const response = await fetch(`${API_URL}/api/okr/objectives?page_size=100`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.items || []).filter((o: OKRObjective) => o.status === 'at_risk' || o.status === 'behind').slice(0, 5);
  } catch { return []; }
}

async function getMyObjectives(employeeId: number): Promise<MyObjectiveData[]> {
  try {
    const response = await fetch(`${API_URL}/api/okr/objectives?employee_id=${employeeId}`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items || data) ? (data.items || data) : [];
  } catch { return []; }
}

async function getMyPerformanceStats(): Promise<MyPerformanceStats | null> {
  try {
    const response = await fetch(`${API_URL}/api/performance/my-stats`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch { return null; }
}

async function getRecentFeedbacks(employeeId: number): Promise<FeedbackItem[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/feedbacks?to_employee_id=${employeeId}&page_size=5`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch { return []; }
}

async function getMyAssignments(): Promise<MyAssignment[]> {
  try {
    const response = await fetch(`${API_URL}/api/learning/assignments/?my_assignments=true`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch { return []; }
}

async function getMyTaskStats(): Promise<TaskStats | null> {
  try {
    const response = await fetch(`${API_URL}/api/tasks/my-stats`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch { return null; }
}

// ============================================
// HELPERS
// ============================================

function normalizeRole(role: string | undefined): UserRole {
  if (!role) return 'employee';
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'dg' || r === 'director') return 'dg';
  if (r === 'rh' || r === 'hr') return 'rh';
  if (r === 'manager') return 'manager';
  return 'employee';
}

function getGreeting(greetingTranslations: { morning: string; afternoon: string; evening: string }): string {
  const hour = new Date().getHours();
  if (hour < 12) return greetingTranslations.morning;
  if (hour < 18) return greetingTranslations.afternoon;
  return greetingTranslations.evening;
}

function getMonthName(monthIndex: number, monthNames?: string[]): string {
  const defaultNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return (monthNames || defaultNames)[monthIndex];
}

function calculateDepartmentData(employees: Employee[], notAssignedLabel?: string): DepartmentData[] {
  const deptCounts: Record<string, number> = {};
  employees.forEach(emp => { const dept = emp.department_name || (notAssignedLabel || 'Non assigné'); deptCounts[dept] = (deptCounts[dept] || 0) + 1; });
  return Object.entries(deptCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
}

function calculateMonthlyEvolution(employees: Employee[], monthNames?: string[]): MonthlyData[] {
  const now = new Date();
  const data: MonthlyData[] = [];
  for (let i = 11; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const entrees = employees.filter(emp => { if (!emp.hire_date) return false; const hireDate = new Date(emp.hire_date); return hireDate >= monthStart && hireDate <= monthEnd; }).length;
    const sorties = employees.filter(emp => { const termDate = (emp as Employee & { termination_date?: string }).termination_date; if (!termDate) return false; const date = new Date(termDate); return date >= monthStart && date <= monthEnd; }).length;
    data.push({ month: getMonthName(targetDate.getMonth(), monthNames), entrees, sorties });
  }
  return data;
}

function calculateLeavesByMonth(requests: LeaveRequest[], monthNames?: string[]): LeavesByMonth[] {
  const now = new Date();
  const data: LeavesByMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const jours = requests.filter(req => { if (req.status !== 'approved') return false; const startDate = new Date(req.start_date); return startDate >= monthStart && startDate <= monthEnd; }).reduce((acc, req) => acc + parseFloat(String(req.days_requested)), 0);
    data.push({ month: getMonthName(targetDate.getMonth(), monthNames), jours: Math.round(jours) });
  }
  return data;
}

function timeAgo(date: string, timeAgoTranslations?: { lessThanOneHour: string; hoursAgo: string; daysAgo: string }): string {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (timeAgoTranslations) {
    if (hours < 1) return timeAgoTranslations.lessThanOneHour;
    if (hours < 24) return timeAgoTranslations.hoursAgo.replace('{hours}', String(hours));
    return timeAgoTranslations.daysAgo.replace('{days}', String(Math.floor(hours / 24)));
  }
  if (hours < 1) return "Il y a moins d'1h";
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)}j`;
}

const COLORS = ['#066C6C', '#0AAE8E', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// ============================================
// WIDGET COMPONENTS
// ============================================

// Welcome Card
function WelcomeCard({ userName, role }: { userName: string; role: UserRole }) {
  const { t } = useI18n();
  const roleLabels: Record<UserRole, string> = t.dashboard.roleLabels;
  const RoleIcon = role === 'manager' ? Users : role === 'rh' ? Briefcase : role === 'admin' ? Zap : UserCheck;

  return (
    <div data-tour="welcome" className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-2xl p-6 text-white shadow-lg">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>
      <div className="relative flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span className="text-primary-200 text-sm">{t.dashboard.welcomeOnTargetym}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{getGreeting(t.dashboard.greeting)}, {userName} 👋</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
              <RoleIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{roleLabels[role]}</span>
            </div>
            <span className="text-primary-200 text-sm">{new Date().toLocaleDateString(t.dashboard.dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center px-3 md:px-4 py-1.5 md:py-2 bg-white/10 rounded-xl backdrop-blur-sm">
            <Activity className="w-4 md:w-5 h-4 md:h-5 mx-auto mb-0.5 md:mb-1 text-green-300" />
            <p className="text-[10px] md:text-xs text-primary-200">{t.employees.active}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick Actions
function QuickActions({ role, isManager }: { role: UserRole; isManager: boolean }) {
  const { t } = useI18n();
  const actions = [
    { label: t.dashboard.quickActionLabels.requestLeave, href: '/dashboard/my-space/leaves', icon: Calendar, color: 'bg-primary-500', roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
    { label: t.dashboard.quickActionLabels.myObjectives, href: '/dashboard/my-space/objectives', icon: Target, color: 'bg-green-500', roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
    { label: t.dashboard.quickActionLabels.myTeam, href: '/dashboard/my-space/team', icon: Users, color: 'bg-purple-500', roles: ['manager'], managerOnly: true },
    { label: t.dashboard.quickActionLabels.personnelManagement, href: '/dashboard/employees', icon: Users, color: 'bg-indigo-500', roles: ['rh', 'admin', 'dg'] },
    { label: t.dashboard.quickActionLabels.leaveManagement, href: '/dashboard/leaves', icon: CalendarDays, color: 'bg-orange-500', roles: ['rh', 'admin', 'dg'] },
    { label: t.dashboard.quickActionLabels.recruitment, href: '/dashboard/recruitment', icon: UserPlus, color: 'bg-pink-500', roles: ['rh', 'admin', 'dg'] },
  ];
  const filteredActions = actions.filter(action => { if (action.managerOnly && isManager) return true; return action.roles.includes(role); }).slice(0, 4);

  return (
    <div data-tour="quick-actions" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {t.dashboard.quickActions}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {filteredActions.map((action) => (
          <Link key={action.href} href={action.href} className="group flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gradient-to-r hover:from-primary-50 hover:to-primary-100 transition-all duration-200 hover:scale-[1.02]">
            <div className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
              <action.icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// My Leave Balance Widget
function MyLeaveBalanceWidget({ balances }: { balances: LeaveBalanceSummary | null }) {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          {t.sidebar.myLeaves}
        </h2>
        <div className="text-right">
          <span className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-600 bg-clip-text text-transparent">{balances?.total_available || 0}j</span>
          <p className="text-xs text-gray-400">{t.dashboard.available}</p>
        </div>
      </div>
      {balances && balances.balances.length > 0 ? (
        <div className="space-y-3 mb-4">
          {balances.balances.slice(0, 3).map((balance, i) => (
            <div key={i} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
              <span className="text-xs sm:text-sm text-gray-600 truncate flex-1 min-w-0">{balance.leave_type_name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-12 sm:w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full" style={{ width: `${balance.allocated > 0 ? (balance.available / balance.allocated) * 100 : 0}%` }} />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">{balance.available}/{balance.allocated}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-center py-4 text-sm">{t.dashboard.balancesNotInitialized}</p>
      )}
      <Link href="/dashboard/my-space/leaves" className="flex items-center justify-center gap-1 text-primary-600 text-sm font-medium hover:underline py-2 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
        {t.dashboard.viewAllMyLeaves} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// My Learning Widget - NEW
function MyLearningWidget({ assignments }: { assignments: MyAssignment[] }) {
  const { t } = useI18n();
  const inProgress = assignments.filter(a => a.status === 'in_progress' || a.status === 'assigned');
  const completed = assignments.filter(a => a.status === 'completed');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          {t.dashboard.myTrainings}
        </h2>
        <Link href="/dashboard/learning" className="text-primary-600 text-xs hover:underline flex items-center gap-1">{t.dashboard.view} <ChevronRight className="w-3 h-3" /></Link>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-6">
          <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-200" />
          <p className="text-gray-400 text-sm">{t.dashboard.noTrainingAssigned}</p>
          <Link href="/dashboard/learning" className="text-primary-600 text-xs hover:underline mt-2 inline-block">{t.dashboard.viewCatalog} →</Link>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center p-3 bg-gradient-to-br from-primary-50 to-indigo-50 rounded-xl">
              <p className="text-2xl font-bold text-primary-600">{inProgress.length}</p>
              <p className="text-xs text-primary-700">{t.dashboard.inProgress}</p>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{completed.length}</p>
              <p className="text-xs text-green-700">{t.dashboard.completed}</p>
            </div>
          </div>

          {/* Formations en cours */}
          {inProgress.length > 0 && (
            <div className="space-y-2">
              {inProgress.slice(0, 3).map((assignment) => (
                <div key={assignment.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <span className="text-2xl">{assignment.course_image || '📚'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{assignment.course_title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full" style={{ width: `${assignment.progress || 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{assignment.progress || 0}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {inProgress.length > 3 && (
            <p className="text-center text-xs text-gray-400 mt-2">+{inProgress.length - 3} {t.dashboard.others}</p>
          )}
        </>
      )}
    </div>
  );
}

// My Performance Widget
function MyPerformanceWidget({ stats }: { stats: MyPerformanceStats | null }) {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center">
            <Star className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">{t.dashboard.myPerformance}</h2>
        </div>
        <Link href="/dashboard/performance" className="text-primary-600 text-xs hover:underline flex items-center gap-1">{t.dashboard.view} <ChevronRight className="w-3 h-3" /></Link>
      </div>
      {stats ? (
        <>
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                <circle cx="48" cy="48" r="40" stroke="url(#scoreGradient)" strokeWidth="8" fill="none" strokeDasharray={`${(stats.avg_score / 5) * 251} 251`} strokeLinecap="round" />
                <defs><linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#a855f7" /></linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{stats.avg_score > 0 ? stats.avg_score.toFixed(1) : '-'}</span>
                <span className="text-xs text-gray-400">/5</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 mb-1"><ThumbsUp className="w-4 h-4 text-green-500" /><span className="text-lg font-bold text-green-600">{stats.feedbacks_received}</span></div>
              <p className="text-xs text-green-700">{t.dashboard.feedbacksReceived}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-primary-50 to-indigo-50 rounded-xl text-center">
              <div className="flex items-center justify-center gap-1 mb-1"><CheckCircle className="w-4 h-4 text-primary-500" /><span className="text-lg font-bold text-primary-600">{stats.evaluations_completed}/{stats.evaluations_total}</span></div>
              <p className="text-xs text-primary-700">{t.dashboard.evaluations}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-6 text-gray-400"><Star className="w-10 h-10 mx-auto mb-2 text-gray-200" /><p className="text-sm">{t.dashboard.noData}</p></div>
      )}
    </div>
  );
}

// Recent Feedbacks Widget
function RecentFeedbacksWidget({ feedbacks }: { feedbacks: FeedbackItem[] }) {
  const { t } = useI18n();
  if (feedbacks.length === 0) return null;
  const getFeedbackIcon = (type: string) => { switch (type) { case 'recognition': return '🎉'; case 'improvement': return '💡'; default: return '💬'; } };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-rose-600 rounded-lg flex items-center justify-center"><MessageSquare className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-gray-900">{t.dashboard.recentFeedbacks}</h2>
        </div>
        <Link href="/dashboard/performance" className="text-primary-600 text-xs hover:underline flex items-center gap-1">{t.dashboard.viewAll} <ChevronRight className="w-3 h-3" /></Link>
      </div>
      <div className="space-y-3">
        {feedbacks.slice(0, 3).map((fb) => (
          <div key={fb.id} className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
            <div className="flex items-start gap-2">
              <span className="text-lg">{getFeedbackIcon(fb.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 line-clamp-2">{fb.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-medium text-primary-600">{fb.from_employee_name}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-400">{timeAgo(fb.created_at, t.dashboard.timeAgo)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Team Overview Widget
function TeamOverviewWidget({ teamMembers, pendingRequests }: { teamMembers: TeamMember[]; pendingRequests: LeaveRequest[] }) {
  const { t } = useI18n();
  const activeCount = teamMembers.filter(m => m.status === 'active').length;
  const onLeaveCount = teamMembers.filter(m => m.status === 'on_leave').length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-gray-900">{t.dashboard.myTeam}</h2>
        </div>
        <Link href="/dashboard/my-space/team" className="text-primary-600 text-xs hover:underline flex items-center gap-1">{t.dashboard.view} <ChevronRight className="w-3 h-3" /></Link>
      </div>
      <div className="grid grid-cols-3 keep-cols gap-2 sm:gap-3 mb-4">
        <div className="text-center p-2 sm:p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl"><p className="text-lg sm:text-2xl font-bold text-gray-900">{teamMembers.length}</p><p className="text-[10px] sm:text-xs text-gray-500">{t.dashboard.teamTotal}</p></div>
        <div className="text-center p-2 sm:p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl"><p className="text-lg sm:text-2xl font-bold text-green-600">{activeCount}</p><p className="text-[10px] sm:text-xs text-green-700">{t.dashboard.teamActive}</p></div>
        <div className="text-center p-2 sm:p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl"><p className="text-lg sm:text-2xl font-bold text-orange-600">{onLeaveCount}</p><p className="text-[10px] sm:text-xs text-orange-700">{t.dashboard.teamOnLeave}</p></div>
      </div>
      {pendingRequests.length > 0 && (
        <Link href="/dashboard/leaves" className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-800 rounded-xl hover:from-yellow-100 hover:to-amber-100 transition-colors">
          <Bell className="w-5 h-5 text-yellow-600" />
          <span className="text-sm font-medium">{pendingRequests.length} {t.dashboard.requestsToValidate}</span>
          <ChevronRight className="w-4 h-4 ml-auto" />
        </Link>
      )}
    </div>
  );
}

// HR Stats Widget
function HRStatsWidget({ stats }: { stats: HRStats }) {
  const { t } = useI18n();
  const statItems = [
    { label: t.dashboard.totalEmployeesLabel, value: stats.total_employees, icon: Users, color: 'from-primary-400 to-primary-600', bg: 'bg-primary-50', href: '/dashboard/employees', badge: 0 },
    { label: t.dashboard.activeLabel, value: stats.active_employees, icon: UserCheck, color: 'from-green-400 to-green-600', bg: 'bg-green-50', href: '/dashboard/employees?filter=active', badge: 0 },
    { label: t.dashboard.onLeaveLabel, value: stats.on_leave_today, icon: Calendar, color: 'from-orange-400 to-orange-600', bg: 'bg-orange-50', href: '/dashboard/leaves', badge: 0 },
    { label: t.dashboard.pendingRequestsLabel, value: stats.pending_requests, icon: Clock, color: 'from-yellow-400 to-yellow-600', bg: 'bg-yellow-50', href: '/dashboard/leaves?status=pending', badge: 0 },
    { label: t.dashboard.newThisMonth, value: stats.new_hires_this_month, icon: UserPlus, color: 'from-purple-400 to-purple-600', bg: 'bg-purple-50', href: '/dashboard/employees?filter=new_this_month', badge: stats.new_hires_this_month },
    { label: t.dashboard.departments, value: stats.departments_count, icon: Briefcase, color: 'from-indigo-400 to-indigo-600', bg: 'bg-indigo-50', href: '/dashboard/employees?tab=departments', badge: 0 },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center"><BarChart3 className="w-4 h-4 text-white" /></div>
        <h2 className="text-base font-semibold text-gray-900">{t.dashboard.hrOverview}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {statItems.map((item, i) => (
          <Link key={i} href={item.href} className={`relative ${item.bg} rounded-xl p-4 hover:scale-[1.02] hover:shadow-md transition-all cursor-pointer block`}>
            {item.badge > 0 && (
              <span className="absolute top-2 right-2 min-w-[20px] h-5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1.5 shadow-sm">+{item.badge}</span>
            )}
            <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center mb-2 shadow-sm`}><item.icon className="w-5 h-5 text-white" /></div>
            <p className="text-2xl font-bold text-gray-900">{item.value}</p>
            <p className="text-xs text-gray-600">{item.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Evolution Chart Widget
function EvolutionChartWidget({ data }: { data: MonthlyData[] }) {
  const { t } = useI18n();
  if (!data || data.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-white" /></div>
        <h2 className="text-base font-semibold text-gray-900">{t.dashboard.staffEvolution}</h2>
      </div>
      <div className="h-48 flex items-center justify-center text-gray-400"><p className="text-sm">{t.dashboard.noData}</p></div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center"><TrendingUp className="w-4 h-4 text-white" /></div>
        <h2 className="text-base font-semibold text-gray-900">{t.dashboard.staffEvolution}</h2>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorEntrees" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
              <linearGradient id="colorSorties" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
            <Area type="monotone" dataKey="entrees" name={t.dashboard.entries} stroke="#10b981" strokeWidth={2} fill="url(#colorEntrees)" />
            <Area type="monotone" dataKey="sorties" name={t.dashboard.exits} stroke="#ef4444" strokeWidth={2} fill="url(#colorSorties)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Department Chart Widget
function DepartmentChartWidget({ data }: { data: DepartmentData[] }) {
  const { t } = useI18n();
  if (data.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center"><PieChart className="w-4 h-4 text-white" /></div>
        <h2 className="text-base font-semibold text-gray-900">{t.dashboard.departmentDistribution}</h2>
      </div>
      <div className="h-48 flex items-center justify-center text-gray-400"><p className="text-sm">{t.dashboard.noData}</p></div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center"><PieChart className="w-4 h-4 text-white" /></div>
        <h2 className="text-base font-semibold text-gray-900">{t.dashboard.departmentDistribution}</h2>
      </div>
      <div className="h-48 flex items-center">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="count" nameKey="name">
                {data.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} formatter={(value: number) => [`${value} ${t.dashboard.employeesUnit}`, '']} />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 space-y-1.5">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="text-xs text-gray-600 truncate flex-1">{item.name}</span>
              <span className="text-xs font-semibold text-gray-900">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Leaves Chart Widget
function LeavesChartWidget({ data }: { data: LeavesByMonth[] }) {
  const { t } = useI18n();
  if (!data || data.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center"><CalendarDays className="w-4 h-4 text-white" /></div>
        <h2 className="text-base font-semibold text-gray-900">{t.dashboard.leavesByMonth}</h2>
      </div>
      <div className="h-48 flex items-center justify-center text-gray-400"><p className="text-sm">{t.dashboard.noData}</p></div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center"><CalendarDays className="w-4 h-4 text-white" /></div>
        <h2 className="text-base font-semibold text-gray-900">{t.dashboard.leavesByMonth}</h2>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs><linearGradient id="colorConges" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={1}/><stop offset="95%" stopColor="#fb923c" stopOpacity={0.8}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} formatter={(value: number) => [`${Math.round(value)} ${t.dashboard.daysUnit}`, t.dashboard.leavesLabel]} />
            <Bar dataKey="jours" name={t.dashboard.leaveDays} fill="url(#colorConges)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// OKR Stats Widget
function OKRStatsWidget({ stats, criticalOKRs }: { stats: OKRStats; criticalOKRs: OKRObjective[] }) {
  const { t } = useI18n();
  const onTrack = stats.by_status?.['on_track'] || 0;
  const atRisk = stats.by_status?.['at_risk'] || 0;
  const behind = stats.by_status?.['behind'] || 0;
  const exceeded = stats.by_status?.['exceeded'] || 0;
  const completed = stats.by_status?.['completed'] || 0;

  const pieData = [
    { name: t.dashboard.onTrackFull, value: onTrack, color: '#10b981' },
    { name: t.dashboard.atRisk, value: atRisk, color: '#f59e0b' },
    { name: t.dashboard.behind, value: behind, color: '#ef4444' },
    { name: t.dashboard.exceeded, value: exceeded, color: '#6366f1' },
    { name: t.dashboard.completedFull, value: completed, color: '#059669' },
  ].filter(d => d.value > 0);

  if (stats.total === 0) return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center"><Target className="w-4 h-4 text-white" /></div>
        <h2 className="text-base font-semibold text-gray-900">{t.dashboard.objectivesOKR}</h2>
      </div>
      <div className="h-48 flex items-center justify-center text-gray-400"><div className="text-center"><Target className="w-10 h-10 mx-auto mb-2 text-gray-200" /><p className="text-sm">{t.dashboard.noObjective}</p></div></div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center"><Target className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-gray-900">{t.dashboard.objectivesOKR}</h2>
        </div>
        <Link href="/dashboard/okr" className="text-primary-600 text-xs hover:underline flex items-center gap-1">{t.dashboard.view} <ChevronRight className="w-3 h-3" /></Link>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="26" stroke="#e5e7eb" strokeWidth="5" fill="none" />
              <circle cx="32" cy="32" r="26" stroke={stats.avg_progress >= 70 ? '#10b981' : stats.avg_progress >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="5" fill="none" strokeDasharray={`${stats.avg_progress * 1.63} 163`} strokeLinecap="round" />
            </svg>
            <span className="absolute text-sm font-bold text-gray-900">{Math.round(stats.avg_progress)}%</span>
          </div>
        </div>
        {pieData.length > 0 && (
          <div className="h-16 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={15} outerRadius={28} dataKey="value" paddingAngle={2}>{pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie></RechartsPieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="text-center p-2 bg-green-50 rounded-lg"><p className="text-base font-bold text-green-600">{onTrack}</p><p className="text-xs text-green-700">{t.dashboard.onTrack}</p></div>
        <div className="text-center p-2 bg-yellow-50 rounded-lg"><p className="text-base font-bold text-yellow-600">{atRisk}</p><p className="text-xs text-yellow-700">{t.dashboard.atRisk}</p></div>
        <div className="text-center p-2 bg-red-50 rounded-lg"><p className="text-base font-bold text-red-600">{behind}</p><p className="text-xs text-red-700">{t.dashboard.behind}</p></div>
        <div className="text-center p-2 bg-indigo-50 rounded-lg"><p className="text-base font-bold text-indigo-600">{exceeded + completed}</p><p className="text-xs text-indigo-700">{t.dashboard.completedStatus}</p></div>
      </div>
      {criticalOKRs.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">🚨 {t.dashboard.toWatch}</p>
          <div className="space-y-1.5">
            {criticalOKRs.slice(0, 2).map((okr) => (
              <div key={okr.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${okr.status === 'behind' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                <p className="text-xs text-gray-700 truncate flex-1">{okr.title}</p>
                <span className="text-xs font-medium text-gray-500">{Math.round(okr.progress)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Pending Requests Widget
function PendingRequestsWidget({ requests }: { requests: LeaveRequest[] }) {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-lg flex items-center justify-center"><Clock className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-gray-900">{t.dashboard.requestsToProcess} ({requests.length})</h2>
        </div>
        <Link href="/dashboard/leaves" className="text-primary-600 text-xs hover:underline flex items-center gap-1">{t.dashboard.viewAll} <ChevronRight className="w-3 h-3" /></Link>
      </div>
      {requests.length === 0 ? (
        <div className="text-center py-6"><CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-2" /><p className="text-gray-400 text-sm">{t.dashboard.allRequestsProcessed} ✓</p></div>
      ) : (
        <div className="space-y-2">
          {requests.slice(0, 4).map((request) => (
            <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{request.employee_name}</p><p className="text-xs text-gray-500">{request.leave_type_name} • {request.days_requested}j</p></div>
              <Link href="/dashboard/leaves" className="px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs rounded-lg hover:from-primary-600 hover:to-primary-700 shadow-sm">{t.dashboard.process}</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Alerts Widget
function AlertsWidget({ pendingCount, onLeaveCount }: { pendingCount: number; onLeaveCount: number }) {
  const { t } = useI18n();
  const alerts = [];
  if (pendingCount > 0) alerts.push({ type: 'warning', message: `${pendingCount} ${t.dashboard.pendingLeaveRequests}`, link: '/dashboard/leaves', icon: Clock });
  if (onLeaveCount > 0) alerts.push({ type: 'info', message: `${onLeaveCount} ${t.dashboard.employeesOnLeaveToday}`, link: '/dashboard/leaves', icon: Calendar });
  if (alerts.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-red-400 to-rose-600 rounded-lg flex items-center justify-center"><Bell className="w-4 h-4 text-white" /></div>
        <h2 className="text-base font-semibold text-gray-900">{t.dashboard.alerts}</h2>
      </div>
      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <Link key={i} href={alert.link} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${alert.type === 'warning' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 text-yellow-800 hover:from-yellow-100 hover:to-amber-100' : 'bg-gradient-to-r from-primary-50 to-indigo-50 text-primary-800 hover:from-primary-100 hover:to-indigo-100'}`}>
            <alert.icon className="w-5 h-5 shrink-0" /><span className="text-sm flex-1">{alert.message}</span><ChevronRight className="w-4 h-4" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// Tasks Widget - Version dynamique
function TasksWidget({ stats }: { stats: TaskStats | null }) {
  const { t } = useI18n();
  const hasTasks = stats && (stats.pending + stats.in_progress + stats.completed + stats.overdue > 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center"><ClipboardList className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-gray-900">{t.dashboard.myTasks}</h2>
        </div>
        <Link href="/dashboard/my-space/tasks" className="text-primary-600 text-xs hover:underline flex items-center gap-1">{t.dashboard.view} <ChevronRight className="w-3 h-3" /></Link>
      </div>

      {!hasTasks ? (
        <div className="text-center py-6">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-200" />
          <p className="text-gray-400 text-sm">{t.dashboard.noTaskInProgress}</p>
          <Link href="/dashboard/my-space/tasks" className="text-primary-600 text-xs hover:underline mt-2 inline-block">{t.dashboard.createTask} →</Link>
        </div>
      ) : (
        <>
          {/* Stats rapides */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center p-3 bg-gradient-to-br from-primary-50 to-indigo-50 rounded-xl">
              <p className="text-2xl font-bold text-primary-600">{(stats?.pending || 0) + (stats?.in_progress || 0)}</p>
              <p className="text-xs text-primary-700">{t.dashboard.toDo}</p>
            </div>
            <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{stats?.completed || 0}</p>
              <p className="text-xs text-green-700">{t.dashboard.taskCompleted}</p>
            </div>
          </div>

          {/* Alertes */}
          <div className="space-y-2">
            {(stats?.overdue || 0) > 0 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                <Clock className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-700 font-medium">{stats?.overdue} {t.dashboard.overdue}</span>
              </div>
            )}
            {(stats?.due_today || 0) > 0 && (
              <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                <Calendar className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-orange-700 font-medium">{stats?.due_today} {t.dashboard.dueToday}</span>
              </div>
            )}
            {(stats?.overdue || 0) === 0 && (stats?.due_today || 0) === 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-700 font-medium">{t.dashboard.allUpToDate}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// My Objectives Progress Widget
function MyObjectivesProgressWidget({ objectives }: { objectives: MyObjectiveData[] }) {
  const { t } = useI18n();
  if (objectives.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center"><Target className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-gray-900">{t.dashboard.myObjectives}</h2>
        </div>
        <Link href="/dashboard/my-space/objectives" className="text-primary-600 text-xs hover:underline flex items-center gap-1">{t.dashboard.view} <ChevronRight className="w-3 h-3" /></Link>
      </div>
      <div className="text-center py-6"><Target className="w-10 h-10 mx-auto mb-2 text-gray-200" /><p className="text-gray-400 text-sm">{t.dashboard.noObjectiveAssigned}</p></div>
    </div>
  );

  const avgProgress = Math.round(objectives.reduce((acc, o) => acc + o.progress, 0) / objectives.length);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center"><Target className="w-4 h-4 text-white" /></div>
          <h2 className="text-base font-semibold text-gray-900">{t.dashboard.myObjectives}</h2>
        </div>
        <Link href="/dashboard/my-space/objectives" className="text-primary-600 text-xs hover:underline flex items-center gap-1">{t.dashboard.view} <ChevronRight className="w-3 h-3" /></Link>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle cx="40" cy="40" r="32" stroke="#e5e7eb" strokeWidth="6" fill="none" />
            <circle cx="40" cy="40" r="32" stroke={avgProgress >= 70 ? '#10b981' : avgProgress >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="6" fill="none" strokeDasharray={`${avgProgress * 2.01} 201`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">{avgProgress}%</span>
        </div>
        <div><p className="text-sm font-medium text-gray-900">{t.dashboard.globalProgress}</p><p className="text-xs text-gray-500">{objectives.length} {t.dashboard.objectivesAssigned}</p></div>
      </div>
      <div className="space-y-2">
        {objectives.slice(0, 4).map((obj) => (
          <div key={obj.id} className="p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-1"><p className="text-xs font-medium text-gray-700 truncate flex-1">{obj.title}</p><span className="text-xs font-semibold text-gray-900 ml-2">{obj.progress}%</span></div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${obj.progress >= 70 ? 'bg-green-500' : obj.progress >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${obj.progress}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

function isPlatformAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase().replace(/[^a-z_]/g, '');
  return ['super_admin', 'superadmin', 'superadmintech', 'platform_admin'].includes(r);
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{ name: string; role: UserRole; isManager: boolean; employeeId: number | null }>({ name: '', role: 'employee', isManager: false, employeeId: null });
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceSummary | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamPendingRequests, setTeamPendingRequests] = useState<LeaveRequest[]>([]);
  const [hrStats, setHRStats] = useState<HRStats | null>(null);
  const [allPendingRequests, setAllPendingRequests] = useState<LeaveRequest[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [evolutionData, setEvolutionData] = useState<MonthlyData[]>([]);
  const [leavesData, setLeavesData] = useState<LeavesByMonth[]>([]);
  const [okrStats, setOkrStats] = useState<OKRStats>({ total: 0, by_level: {}, by_status: {}, avg_progress: 0, completed: 0, in_progress: 0, not_started: 0, overdue: 0, by_department: {} });
  const [criticalOKRs, setCriticalOKRs] = useState<OKRObjective[]>([]);
  const [myObjectives, setMyObjectives] = useState<MyObjectiveData[]>([]);
  const [myPerformance, setMyPerformance] = useState<MyPerformanceStats | null>(null);
  const [recentFeedbacks, setRecentFeedbacks] = useState<FeedbackItem[]>([]);
  const [myAssignments, setMyAssignments] = useState<MyAssignment[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [subsidiaryStats, setSubsidiaryStats] = useState<SubsidiaryDashboardStats | null>(null);
  const [subsidiaryStatsLoading, setSubsidiaryStatsLoading] = useState(false);
  const [groupGlobalStats, setGroupGlobalStats] = useState<GroupGlobalDashboardStats | null>(null);
  const [groupGlobalStatsLoading, setGroupGlobalStatsLoading] = useState(false);

  // Page Tour - Suggestions contextuelles pour la première visite
  const { showTips, dismissTips, resetTips } = usePageTour('dashboard');

  // Contexte groupe : sélecteur de filiale
  const { context, selectedTenantId, selectedSubsidiary, isGlobalDashboardMode } = useGroupContext();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // ÉTAPE 1: Récupérer les tokens depuis l'URL si présents
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('token');
        const refreshFromUrl = urlParams.get('refresh');
        const userFromUrl = urlParams.get('user');

        if (tokenFromUrl && userFromUrl) {
          console.log('Dashboard: Storing tokens from URL');
          localStorage.setItem('access_token', tokenFromUrl);
          if (refreshFromUrl) {
            localStorage.setItem('refresh_token', refreshFromUrl);
          }
          try {
            localStorage.setItem('user', decodeURIComponent(userFromUrl));
          } catch (e) {
            console.error('Dashboard: Error decoding user:', e);
          }
          // Nettoyer l'URL et recharger la page pour que le layout se réinitialise
          window.location.href = window.location.pathname;
          return; // Stop execution, page will reload
        }
      }

      // ÉTAPE 2: Vérifier que le token existe
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      if (!token) {
        console.error('No token available');
        setLoading(false);
        return;
      }

      // ÉTAPE 3: Charger les données utilisateur
      let user = await getCurrentUser();
      
      // Fallback sur localStorage si l'API échoue
      if (!user) {
        const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        if (userStr) {
          try {
            const localUser = JSON.parse(userStr);
            user = {
              id: localUser.id,
              email: localUser.email,
              first_name: localUser.first_name,
              last_name: localUser.last_name,
              role: localUser.role,
              employee_id: localUser.employee_id,
            };
          } catch { /* ignore */ }
        }
      }

      if (!user) {
        console.error('Impossible de récupérer les informations utilisateur');
        setLoading(false);
        return;
      }

      // Redirectionfn vers platform-admin si rôle super admin
      if (isPlatformAdminRole(user.role)) {
        router.replace('/dashboard/platform-admin');
        return;
      }

      const role = normalizeRole(user.role);
      let isManager = role === 'manager';
      const employeeId = user.employee_id || null;

      if (employeeId) {
        try {
          const employee = await getEmployeeById(employeeId);
          if (employee) {
            isManager = isManager || (employee.is_manager === true);
          }
        } catch { /* ignore */ }
      }

      setUserData({ name: user.first_name || user.email?.split('@')[0] || 'Utilisateur', role, isManager, employeeId });

      const promises: Promise<void>[] = [];

      if (employeeId) {
        promises.push(
          getMyLeaveBalances(employeeId).then(setLeaveBalances).catch(() => {}),
          getMyObjectives(employeeId).then(setMyObjectives).catch(() => {}),
          getMyPerformanceStats().then(setMyPerformance).catch(() => {}),
          getRecentFeedbacks(employeeId).then(setRecentFeedbacks).catch(() => {}),
          getMyAssignments().then(setMyAssignments).catch(() => {}),
          getMyTaskStats().then(setTaskStats).catch(() => {})
        );
      }

      if (isManager && employeeId) {
        promises.push(
          getTeamMembers(employeeId).then(async (members) => {
            setTeamMembers(members);
            const teamRequests = await getTeamPendingRequests(members);
            setTeamPendingRequests(teamRequests);
          }).catch(() => {})
        );
      }

      if (['rh', 'admin', 'dg'].includes(role)) {
        if (selectedTenantId) {
          setOkrStats({ total: 0, by_level: {}, by_status: {}, avg_progress: 0, completed: 0, in_progress: 0, not_started: 0, overdue: 0, by_department: {} });
          setCriticalOKRs([]);
        }

        promises.push(
          getHRStatsData(selectedTenantId || undefined).then(d => { console.log('[Dashboard] hrStats OK:', d); setHRStats(d); }).catch(e => console.error('[Dashboard] hrStats ERR:', e?.message || e)),
          getAllPendingRequests(selectedTenantId || undefined).then(setAllPendingRequests).catch(e => console.error('[Dashboard] pendingRequests ERR:', e?.message || e)),
          getAllEmployees(selectedTenantId || undefined).then(employees => { setDepartmentData(calculateDepartmentData(employees, t.dashboard.notAssigned)); setEvolutionData(calculateMonthlyEvolution(employees, t.dashboard.monthNames)); }).catch(e => console.error('[Dashboard] employees ERR:', e?.message || e)),
          getAllLeaveRequests(selectedTenantId || undefined).then(requests => { setLeavesData(calculateLeavesByMonth(requests, t.dashboard.monthNames)); }).catch(e => console.error('[Dashboard] leaves ERR:', e?.message || e)),
          ...(selectedTenantId ? [] : [
            getOKRStats().then(setOkrStats).catch(() => {}),
            getCriticalOKRs().then(setCriticalOKRs).catch(() => {}),
          ])
        );
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, t]);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch stats de la filiale sélectionnée
  useEffect(() => {
    if (!selectedTenantId) { setSubsidiaryStats(null); return; }
    setSubsidiaryStatsLoading(true);
    getSubsidiaryDashboardStats(selectedTenantId)
      .then(data => { console.log('[Dashboard] subsidiaryStats OK:', data); setSubsidiaryStats(data); })
      .catch(err => { console.error('[Dashboard] subsidiaryStats ERROR:', err?.message || err); setSubsidiaryStats(null); })
      .finally(() => setSubsidiaryStatsLoading(false));
  }, [selectedTenantId]);

  // Fetch stats globales du groupe (toutes filiales agrégées)
  useEffect(() => {
    if (!isGlobalDashboardMode || !context?.is_group) { setGroupGlobalStats(null); return; }
    console.log('[Dashboard] loading groupGlobalStats… context.is_group=', context?.is_group);
    setGroupGlobalStatsLoading(true);
    getGroupGlobalDashboardStats()
      .then(data => { console.log('[Dashboard] groupGlobalStats OK:', data); setGroupGlobalStats(data); })
      .catch(err => { console.error('[Dashboard] groupGlobalStats ERROR:', err?.message || err); setGroupGlobalStats(null); })
      .finally(() => setGroupGlobalStatsLoading(false));
  }, [isGlobalDashboardMode, context?.is_group]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">{t.dashboard.loadingDashboard}</p>
        </div>
      </div>
    );
  }

  const { name, role, isManager, employeeId } = userData;
  const isHROrAdmin = ['rh', 'admin', 'dg'].includes(role);
  const isSimpleEmployee = role === 'employee' && !isManager;
  const isSubsidiaryView = Boolean(selectedTenantId);

  // ============================================
  // LAYOUT EMPLOYÉ SIMPLE - 2 colonnes équilibrées
  // ============================================
  if (isSimpleEmployee) {
    return (
      <div className="py-6 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        {/* Page Tour Tips - Suggestions contextuelles */}
        {showTips && (
          <PageTourTips
            pageId="dashboard"
            onDismiss={dismissTips}
            pageTitle={t.sidebar.dashboard}
          />
        )}
        
        {/* Bouton pour relancer les suggestions */}
        
        <div className="max-w-6xl mx-auto space-y-6">
          <WelcomeCard userName={name} role={role} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Colonne gauche */}
            <div className="space-y-6">
              {employeeId && <MyLeaveBalanceWidget balances={leaveBalances} />}
              {employeeId && <MyLearningWidget assignments={myAssignments} />}
            </div>

            {/* Colonne droite */}
            <div className="space-y-6">
              <QuickActions role={role} isManager={isManager} />
              {employeeId && <MyPerformanceWidget stats={myPerformance} />}
              {recentFeedbacks.length > 0 && <RecentFeedbacksWidget feedbacks={recentFeedbacks} />}
            </div>
          </div>

          {/* Mes Objectifs et Mes Tâches sur la même ligne */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {employeeId && <MyObjectivesProgressWidget objectives={myObjectives} />}
            <TasksWidget stats={taskStats} />
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // LAYOUT HR/ADMIN/DG/MANAGER - 3 colonnes
  // ============================================
  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <Header hideAddButton transparent />

      {/* Page Tour Tips - Suggestions contextuelles */}
      {showTips && (
        <PageTourTips
          pageId="dashboard"
          onDismiss={dismissTips}
          pageTitle="Tableau de Bord"
        />
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        <WelcomeCard userName={name} role={role} />

        {/* Panel Dashboard global du groupe — toutes filiales agrégées */}
        {isGlobalDashboardMode && context?.is_group && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shadow">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-900">{t.dashboard.groupDashboard}</p>
                  <p className="text-xs text-purple-500">{t.dashboard.allSubsidiaries}</p>
                </div>
              </div>
              {groupGlobalStats && (
                <span className="text-xs font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                  {groupGlobalStats.subsidiaries_count} {groupGlobalStats.subsidiaries_count > 1 ? t.dashboard.subsidiaries : t.dashboard.subsidiary}
                </span>
              )}
            </div>
            {groupGlobalStatsLoading ? (
              <div className="flex items-center gap-2 text-purple-400 text-sm">
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                {t.dashboard.loadingConsolidatedData}
              </div>
            ) : groupGlobalStats ? (
              <>
                {/* Debug info visible uniquement si total = 0 */}
                {groupGlobalStats.total_employees === 0 && groupGlobalStats.subsidiaries_count === 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                    ⚠️ {t.dashboard.noSubsidiaryFound}
                  </div>
                )}
                {/* KPIs consolidés */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                  <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-purple-100">
                    <p className="text-3xl font-bold text-purple-700">{groupGlobalStats.active_employees}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{t.dashboard.activeEmployees}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-purple-100">
                    <p className="text-3xl font-bold text-gray-900">{groupGlobalStats.total_employees}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{t.dashboard.totalEmployeesLabel}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-orange-100">
                    <p className="text-3xl font-bold text-orange-500">{groupGlobalStats.pending_leaves}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{t.dashboard.pendingLeaves}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-purple-100">
                    <p className="text-3xl font-bold text-gray-900">{groupGlobalStats.departments_count}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{t.dashboard.departments}</p>
                  </div>
                </div>
                {/* Tableau par filiale */}
                {groupGlobalStats.subsidiaries.length > 0 && (
                  <div className="bg-white rounded-xl border border-purple-100 overflow-hidden">
                    <div className="px-4 py-2 bg-purple-50 border-b border-purple-100">
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">{t.dashboard.subsidiaryDetail}</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {groupGlobalStats.subsidiaries.map(sub => (
                        <div key={sub.subsidiary_id} className="flex items-center gap-4 px-4 py-3">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <p className="flex-1 text-sm font-medium text-gray-900 truncate">{sub.subsidiary_name}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span><span className="font-semibold text-gray-900">{sub.active_employees}</span> {t.dashboard.active}</span>
                            <span><span className="font-semibold text-gray-900">{sub.total_employees}</span> {t.dashboard.total}</span>
                            {sub.pending_leaves > 0 && (
                              <span className="text-orange-500 font-semibold">{sub.pending_leaves} {sub.pending_leaves > 1 ? t.dashboard.leavesCount : t.dashboard.leaveCount}</span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full font-medium ${
                              sub.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                            }`}>{sub.is_active ? t.dashboard.activeStatus : t.dashboard.inactiveStatus}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">
                ⚠️ {t.dashboard.unableToLoadGroupStats}
              </div>
            )}
          </div>
        )}

        {/* Panel stats filiale sélectionnée */}
        {selectedSubsidiary && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-indigo-900">{selectedSubsidiary.name}</p>
                  <p className="text-xs text-indigo-500">{t.dashboard.subsidiaryView}</p>
                </div>
              </div>
              <a href="/dashboard/analytics" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2">{t.dashboard.fullAnalytics} →</a>
            </div>
            {subsidiaryStatsLoading ? (
              <div className="flex items-center gap-2 text-indigo-400 text-sm">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                {t.common.loading}
              </div>
            ) : subsidiaryStats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-indigo-100">
                  <p className="text-3xl font-bold text-indigo-700">{subsidiaryStats.active_employees}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{t.dashboard.activeEmployees}</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-indigo-100">
                  <p className="text-3xl font-bold text-gray-900">{subsidiaryStats.total_employees}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{t.dashboard.totalEmployeesLabel}</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-orange-100">
                  <p className="text-3xl font-bold text-orange-500">{subsidiaryStats.pending_leaves}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{t.dashboard.pendingLeaves}</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-indigo-100">
                  <p className="text-3xl font-bold text-gray-900">{subsidiaryStats.departments_count}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{t.dashboard.departments}</p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {!isGlobalDashboardMode && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {isHROrAdmin && hrStats && <HRStatsWidget stats={hrStats} />}
            {isManager && !isSubsidiaryView && <TeamOverviewWidget teamMembers={teamMembers} pendingRequests={teamPendingRequests} />}
            {isHROrAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EvolutionChartWidget data={evolutionData} />
                <DepartmentChartWidget data={departmentData} />
                <LeavesChartWidget data={leavesData} />
                {!isSubsidiaryView && <OKRStatsWidget stats={okrStats} criticalOKRs={criticalOKRs} />}
              </div>
            )}
            {employeeId && !isSubsidiaryView && <MyLeaveBalanceWidget balances={leaveBalances} />}
            {employeeId && !isSubsidiaryView && <MyLearningWidget assignments={myAssignments} />}
            {isHROrAdmin && !isSubsidiaryView && <PendingRequestsWidget requests={allPendingRequests} />}
          </div>

          <div className="space-y-6">
            {!isSubsidiaryView && <QuickActions role={role} isManager={isManager} />}
            {isHROrAdmin && hrStats && <AlertsWidget pendingCount={hrStats.pending_requests} onLeaveCount={hrStats.on_leave_today} />}
            {employeeId && !isSubsidiaryView && <MyPerformanceWidget stats={myPerformance} />}
            {!isSubsidiaryView && recentFeedbacks.length > 0 && <RecentFeedbacksWidget feedbacks={recentFeedbacks} />}
            {employeeId && !isSubsidiaryView && <MyObjectivesProgressWidget objectives={myObjectives} />}
            {!isSubsidiaryView && <TasksWidget stats={taskStats} />}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
