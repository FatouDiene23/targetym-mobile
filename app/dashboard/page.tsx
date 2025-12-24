'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, CheckCircle, Target, Users,
  AlertCircle, ArrowRight, UserPlus, BarChart3,
  CalendarDays, ClipboardList, Bell, ChevronRight, TrendingUp, PieChart
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';

// Import depuis lib/api.ts - les fonctions qui marchent déjà
import { 
  getEmployees, 
  getEmployeeStats,
  getDepartments,
  getLeaveRequests,
  type Employee,
  type EmployeeStats
} from '@/lib/api';

// ============================================
// TYPES
// ============================================

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg';

interface UserData {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  employee_id?: number;
}

interface LeaveBalance {
  leave_type_name: string;
  available: number;
  taken: number;
  allocated: number;
}

interface LeaveBalanceSummary {
  total_available: number;
  total_taken: number;
  balances: LeaveBalance[];
}

interface LeaveRequest {
  id: number;
  employee_name?: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: string;
}

interface HRStats {
  total_employees: number;
  active_employees: number;
  on_leave_today: number;
  pending_requests: number;
  new_hires_this_month: number;
  departments_count: number;
}

interface TeamMember {
  id: number;
  first_name: string;
  last_name: string;
  status: string;
  job_title?: string;
}

interface DepartmentData {
  name: string;
  count: number;
  [key: string]: string | number;
}

interface MonthlyData {
  month: string;
  entrees: number;
  sorties: number;
}

interface LeavesByMonth {
  month: string;
  jours: number;
}

interface OKRStats {
  total: number;
  by_level: Record<string, number>;
  by_status: Record<string, number>;
  avg_progress: number;
  completed: number;
  in_progress: number;
  not_started: number;
  overdue: number;
  by_department: Record<string, { count: number; avg_progress: number }>;
}

interface OKRObjective {
  id: number;
  title: string;
  level: string;
  progress: number;
  status: string;
  owner_name?: string;
  department_name?: string;
}

interface MyObjectiveData {
  id: number;
  title: string;
  progress: number;
  status: string;
}

// ============================================
// API - Utilise lib/api.ts + quelques fonctions locales
// ============================================

const API_URL = 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function getCurrentUser(): Promise<UserData> {
  const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function getEmployeeById(id: number): Promise<Employee> {
  const response = await fetch(`${API_URL}/api/employees/${id}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur');
  return response.json();
}

async function getMyLeaveBalances(employeeId: number): Promise<LeaveBalanceSummary | null> {
  try {
    const response = await fetch(`${API_URL}/api/leaves/balances/${employeeId}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function getMyPendingRequests(employeeId: number): Promise<LeaveRequest[]> {
  try {
    const data = await getLeaveRequests({ employee_id: employeeId, status: 'pending' });
    return data.items || [];
  } catch {
    return [];
  }
}

async function getTeamMembers(managerId: number): Promise<TeamMember[]> {
  try {
    const response = await fetch(`${API_URL}/api/employees/${managerId}/direct-reports`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

async function getTeamPendingRequests(teamMembers: TeamMember[]): Promise<LeaveRequest[]> {
  const allRequests: LeaveRequest[] = [];
  for (const member of teamMembers.slice(0, 10)) {
    try {
      const data = await getLeaveRequests({ employee_id: member.id, status: 'pending' });
      const requests = (data.items || []).map((r: LeaveRequest) => ({
        ...r,
        employee_name: `${member.first_name} ${member.last_name}`
      }));
      allRequests.push(...requests);
    } catch { /* ignore */ }
  }
  return allRequests;
}

async function getAllEmployees(): Promise<Employee[]> {
  try {
    const data = await getEmployees({ page_size: 1000 });
    return data.items || [];
  } catch {
    return [];
  }
}

async function getHRStatsData(): Promise<HRStats> {
  try {
    // Utilise getEmployeeStats de lib/api.ts
    const stats: EmployeeStats = await getEmployeeStats();
    const departments = await getDepartments();
    
    // Récupérer les demandes en attente
    let pendingRequests = 0;
    try {
      const reqData = await getLeaveRequests({ status: 'pending', page_size: 100 });
      pendingRequests = (reqData.items || []).length;
    } catch {
      // ignore
    }

    return {
      total_employees: stats.total || 0,
      active_employees: stats.active || 0,
      on_leave_today: stats.on_leave || 0,
      pending_requests: pendingRequests,
      new_hires_this_month: stats.new_this_month || 0,
      departments_count: departments.length
    };
  } catch {
    return {
      total_employees: 0,
      active_employees: 0,
      on_leave_today: 0,
      pending_requests: 0,
      new_hires_this_month: 0,
      departments_count: 0
    };
  }
}

async function getAllPendingRequests(): Promise<LeaveRequest[]> {
  try {
    const data = await getLeaveRequests({ status: 'pending', page_size: 10 });
    return data.items || [];
  } catch {
    return [];
  }
}

async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  try {
    const data = await getLeaveRequests({ page_size: 500 });
    return data.items || [];
  } catch {
    return [];
  }
}

async function getOKRStats(): Promise<OKRStats> {
  try {
    const response = await fetch(`${API_URL}/api/okr/stats`, { headers: getAuthHeaders() });
    if (!response.ok) {
      return { 
        total: 0, by_level: {}, by_status: {}, avg_progress: 0, 
        completed: 0, in_progress: 0, not_started: 0, overdue: 0, by_department: {} 
      };
    }
    return response.json();
  } catch {
    return { 
      total: 0, by_level: {}, by_status: {}, avg_progress: 0, 
      completed: 0, in_progress: 0, not_started: 0, overdue: 0, by_department: {} 
    };
  }
}

async function getCriticalOKRs(): Promise<OKRObjective[]> {
  try {
    const response = await fetch(`${API_URL}/api/okr/objectives?page_size=100`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    const objectives = data.items || [];
    // Filtrer les OKRs critiques (at_risk ou behind)
    return objectives
      .filter((o: OKRObjective) => o.status === 'at_risk' || o.status === 'behind')
      .slice(0, 5);
  } catch {
    return [];
  }
}

async function getMyObjectives(employeeId: number): Promise<MyObjectiveData[]> {
  try {
    const response = await fetch(`${API_URL}/api/okr/objectives?employee_id=${employeeId}`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    const objectives = data.items || data || [];
    return Array.isArray(objectives) ? objectives : [];
  } catch {
    return [];
  }
}

// ============================================
// HELPER FUNCTIONS
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function getMonthName(monthIndex: number): string {
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return months[monthIndex];
}

function calculateDepartmentData(employees: Employee[]): DepartmentData[] {
  const deptCounts: Record<string, number> = {};
  employees.forEach(emp => {
    const dept = emp.department_name || 'Non assigné';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });
  return Object.entries(deptCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function calculateMonthlyEvolution(employees: Employee[]): MonthlyData[] {
  const now = new Date();
  const data: MonthlyData[] = [];
  
  for (let i = 11; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    
    const entrees = employees.filter(emp => {
      if (!emp.hire_date) return false;
      const hireDate = new Date(emp.hire_date);
      return hireDate >= monthStart && hireDate <= monthEnd;
    }).length;
    
    const sorties = employees.filter(emp => {
      const termDate = (emp as Employee & { termination_date?: string }).termination_date;
      if (!termDate) return false;
      const date = new Date(termDate);
      return date >= monthStart && date <= monthEnd;
    }).length;
    
    data.push({
      month: getMonthName(targetDate.getMonth()),
      entrees,
      sorties
    });
  }
  
  return data;
}

function calculateLeavesByMonth(requests: LeaveRequest[]): LeavesByMonth[] {
  const now = new Date();
  const data: LeavesByMonth[] = [];
  
  for (let i = 5; i >= 0; i--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    
    const jours = requests
      .filter(req => {
        if (req.status !== 'approved') return false;
        const startDate = new Date(req.start_date);
        return startDate >= monthStart && startDate <= monthEnd;
      })
      .reduce((acc, req) => acc + req.days_requested, 0);
    
    data.push({
      month: getMonthName(targetDate.getMonth()),
      jours
    });
  }
  
  return data;
}

// ============================================
// CHART COLORS
// ============================================

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// ============================================
// WIDGET COMPONENTS
// ============================================

// Welcome Card
function WelcomeCard({ userName, role }: { userName: string; role: UserRole }) {
  const roleLabels: Record<UserRole, string> = {
    employee: 'Employé',
    manager: 'Manager',
    rh: 'Ressources Humaines',
    admin: 'Administrateur',
    dg: 'Direction Générale'
  };

  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
      <h1 className="text-2xl font-bold mb-1">{getGreeting()}, {userName} 👋</h1>
      <p className="text-primary-100">{roleLabels[role]} • {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>
  );
}

// Quick Actions
function QuickActions({ role, isManager }: { role: UserRole; isManager: boolean }) {
  const actions = [
    { label: 'Demander un congé', href: '/dashboard/my-space/leaves', icon: Calendar, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
    { label: 'Mes objectifs', href: '/dashboard/my-space/objectives', icon: Target, roles: ['employee', 'manager', 'rh', 'admin', 'dg'] },
    { label: 'Mon équipe', href: '/dashboard/my-space/team', icon: Users, roles: ['manager'], managerOnly: true },
    { label: 'Gestion du personnel', href: '/dashboard/employees', icon: Users, roles: ['rh', 'admin', 'dg'] },
    { label: 'Gestion des congés', href: '/dashboard/leaves', icon: CalendarDays, roles: ['rh', 'admin', 'dg'] },
    { label: 'Recrutement', href: '/dashboard/recruitment', icon: UserPlus, roles: ['rh', 'admin', 'dg'] },
  ];

  const filteredActions = actions.filter(action => {
    if (action.managerOnly && isManager) return true;
    return action.roles.includes(role);
  }).slice(0, 4);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
      <div className="grid grid-cols-2 gap-3">
        {filteredActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-primary-50 hover:text-primary-700 transition-colors group"
          >
            <action.icon className="w-5 h-5 text-gray-400 group-hover:text-primary-600" />
            <span className="text-sm font-medium">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// My Leave Balance Widget (Employee)
function MyLeaveBalanceWidget({ balances }: { balances: LeaveBalanceSummary | null }) {
  if (!balances) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" />
          Mes Congés
        </h2>
        <p className="text-gray-500 text-center py-4">Soldes non initialisés</p>
        <Link href="/dashboard/my-space/leaves" className="text-primary-600 text-sm hover:underline flex items-center gap-1 justify-center">
          Voir mes congés <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" />
          Mes Congés
        </h2>
        <span className="text-2xl font-bold text-primary-600">{balances.total_available}j</span>
      </div>
      
      <div className="space-y-3 mb-4">
        {balances.balances.slice(0, 3).map((balance, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{balance.leave_type_name}</span>
            <span className="text-sm font-medium text-gray-900">{balance.available} / {balance.allocated}</span>
          </div>
        ))}
      </div>

      <Link href="/dashboard/my-space/leaves" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
        Voir tous mes congés <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// My Pending Requests Widget
function MyPendingRequestsWidget({ requests }: { requests: LeaveRequest[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-yellow-500" />
        Mes demandes en attente
      </h2>
      
      {requests.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Aucune demande en attente</p>
      ) : (
        <div className="space-y-3">
          {requests.slice(0, 3).map((request) => (
            <div key={request.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{request.leave_type_name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(request.start_date).toLocaleDateString('fr-FR')} - {request.days_requested}j
                </p>
              </div>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">En attente</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Team Overview Widget (Manager)
function TeamOverviewWidget({ teamMembers, pendingRequests }: { teamMembers: TeamMember[]; pendingRequests: LeaveRequest[] }) {
  const activeCount = teamMembers.filter(m => m.status === 'active').length;
  const onLeaveCount = teamMembers.filter(m => m.status === 'on_leave').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-600" />
          Mon Équipe
        </h2>
        <Link href="/dashboard/my-space/team" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
          Voir <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          <p className="text-xs text-gray-500">Actifs</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-600">{onLeaveCount}</p>
          <p className="text-xs text-gray-500">En congé</p>
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-3 rounded-lg">
            <Bell className="w-5 h-5" />
            <span className="text-sm font-medium">{pendingRequests.length} demande(s) à valider</span>
          </div>
        </div>
      )}
    </div>
  );
}

// HR Stats Widget
function HRStatsWidget({ stats }: { stats: HRStats }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary-600" />
        Vue d&apos;ensemble RH
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-2xl font-bold text-blue-700">{stats.total_employees}</p>
          <p className="text-xs text-blue-600">Total employés</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-2xl font-bold text-green-700">{stats.active_employees}</p>
          <p className="text-xs text-green-600">Actifs</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <p className="text-2xl font-bold text-orange-700">{stats.on_leave_today}</p>
          <p className="text-xs text-orange-600">En congé</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-2xl font-bold text-yellow-700">{stats.pending_requests}</p>
          <p className="text-xs text-yellow-600">Demandes en attente</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-2xl font-bold text-purple-700">{stats.new_hires_this_month}</p>
          <p className="text-xs text-purple-600">Nouveaux ce mois</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-4">
          <p className="text-2xl font-bold text-indigo-700">{stats.departments_count}</p>
          <p className="text-xs text-indigo-600">Départements</p>
        </div>
      </div>
    </div>
  );
}

// Evolution Chart Widget
function EvolutionChartWidget({ data }: { data: MonthlyData[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          Évolution des Effectifs
        </h2>
      </div>
      
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorEntrees" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorSorties" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '12px'
              }} 
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            <Area 
              type="monotone" 
              dataKey="entrees" 
              name="Entrées" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#colorEntrees)" 
            />
            <Area 
              type="monotone" 
              dataKey="sorties" 
              name="Sorties" 
              stroke="#ef4444" 
              strokeWidth={2}
              fill="url(#colorSorties)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Department Distribution Widget
function DepartmentChartWidget({ data }: { data: DepartmentData[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <PieChart className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Répartition par Département</h2>
        </div>
        <div className="h-56 flex items-center justify-center text-gray-500">
          <p className="text-sm">Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <PieChart className="w-4 h-4 text-blue-600" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Répartition par Département</h2>
      </div>
      
      <div className="h-56 flex items-center">
        <div className="w-1/2 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={3}
                dataKey="count"
                nameKey="name"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${value} employés`, '']}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 space-y-2">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-xs text-gray-600 truncate flex-1">{item.name}</span>
              <span className="text-xs font-semibold text-gray-900">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Leaves by Month Chart Widget
function LeavesChartWidget({ data }: { data: LeavesByMonth[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
          <CalendarDays className="w-4 h-4 text-orange-600" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Congés par Mois</h2>
      </div>
      
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorConges" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={1}/>
                <stop offset="95%" stopColor="#fb923c" stopOpacity={0.8}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '12px'
              }}
              formatter={(value: number) => [`${value} jours`, 'Congés']}
            />
            <Bar dataKey="jours" name="Jours de congés" fill="url(#colorConges)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// OKR Stats Widget - Amélioré
function OKRStatsWidget({ stats, criticalOKRs }: { stats: OKRStats; criticalOKRs: OKRObjective[] }) {
  const onTrack = stats.by_status?.['on_track'] || 0;
  const atRisk = stats.by_status?.['at_risk'] || 0;
  const behind = stats.by_status?.['behind'] || 0;
  const exceeded = stats.by_status?.['exceeded'] || 0;
  const completed = stats.by_status?.['completed'] || 0;
  const active = stats.by_status?.['active'] || 0;

  const pieData = [
    { name: 'En bonne voie', value: onTrack, color: '#10b981' },
    { name: 'À risque', value: atRisk, color: '#f59e0b' },
    { name: 'En retard', value: behind, color: '#ef4444' },
    { name: 'Dépassé', value: exceeded, color: '#6366f1' },
    { name: 'Terminé', value: completed, color: '#059669' },
    { name: 'Actif', value: active, color: '#3b82f6' },
  ].filter(d => d.value > 0);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'on_track': 'bg-green-100 text-green-700',
      'at_risk': 'bg-yellow-100 text-yellow-700',
      'behind': 'bg-red-100 text-red-700',
      'exceeded': 'bg-indigo-100 text-indigo-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (stats.total === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-purple-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Objectifs (OKR)</h2>
        </div>
        <div className="h-56 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Aucun objectif défini</p>
            <Link href="/dashboard/okr" className="mt-2 inline-block text-primary-600 text-sm hover:underline">
              Créer un OKR
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-purple-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Objectifs (OKR)</h2>
        </div>
        <Link href="/dashboard/okr" className="text-primary-600 text-xs hover:underline flex items-center gap-1">
          Voir tout <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-4">
        {/* Gauge de progression */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle cx="40" cy="40" r="32" stroke="#e5e7eb" strokeWidth="6" fill="none" />
              <circle 
                cx="40" cy="40" r="32" 
                stroke={stats.avg_progress >= 70 ? '#10b981' : stats.avg_progress >= 40 ? '#f59e0b' : '#ef4444'}
                strokeWidth="6" 
                fill="none"
                strokeDasharray={`${stats.avg_progress * 2.01} 201`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-lg font-bold text-gray-900">{Math.round(stats.avg_progress)}%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Progression</p>
        </div>

        {/* Mini Pie Chart */}
        {pieData.length > 0 && (
          <div className="h-20 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={18}
                  outerRadius={35}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    fontSize: '11px'
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stats par statut */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 bg-green-50 rounded-lg">
          <p className="text-lg font-bold text-green-600">{onTrack}</p>
          <p className="text-xs text-green-700">En voie</p>
        </div>
        <div className="text-center p-2 bg-yellow-50 rounded-lg">
          <p className="text-lg font-bold text-yellow-600">{atRisk}</p>
          <p className="text-xs text-yellow-700">À risque</p>
        </div>
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <p className="text-lg font-bold text-red-600">{behind}</p>
          <p className="text-xs text-red-700">En retard</p>
        </div>
        <div className="text-center p-2 bg-indigo-50 rounded-lg">
          <p className="text-lg font-bold text-indigo-600">{exceeded + completed}</p>
          <p className="text-xs text-indigo-700">Terminés</p>
        </div>
      </div>

      {/* OKRs Critiques */}
      {criticalOKRs.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">🚨 OKRs à surveiller</p>
          <div className="space-y-2">
            {criticalOKRs.slice(0, 3).map((okr) => (
              <div key={okr.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${okr.status === 'behind' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{okr.title}</p>
                  <p className="text-xs text-gray-500">{okr.owner_name || 'Non assigné'}</p>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(okr.status)}`}>
                  {Math.round(okr.progress)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats par niveau */}
      {stats.by_level && Object.keys(stats.by_level).length > 0 && (
        <div className="border-t pt-3 mt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Par niveau</p>
          <div className="flex gap-2">
            {stats.by_level['enterprise'] && (
              <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full">
                🏢 {stats.by_level['enterprise']} Entreprise
              </span>
            )}
            {stats.by_level['department'] && (
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                👥 {stats.by_level['department']} Dépt
              </span>
            )}
            {stats.by_level['individual'] && (
              <span className="px-2 py-1 bg-teal-50 text-teal-700 text-xs rounded-full">
                👤 {stats.by_level['individual']} Indiv
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Pending Requests Widget (RH/Admin)
function PendingRequestsWidget({ requests }: { requests: LeaveRequest[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-500" />
          Demandes à traiter ({requests.length})
        </h2>
        <Link href="/dashboard/leaves" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
          Voir tout <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-2" />
          <p className="text-gray-500">Toutes les demandes ont été traitées</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.slice(0, 5).map((request) => (
            <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{request.employee_name}</p>
                <p className="text-xs text-gray-500">
                  {request.leave_type_name} • {request.days_requested}j • {new Date(request.start_date).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <Link 
                href="/dashboard/leaves"
                className="px-3 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700"
              >
                Traiter
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Alerts Widget
function AlertsWidget({ pendingCount, onLeaveCount }: { pendingCount: number; onLeaveCount: number }) {
  const alerts = [];
  
  if (pendingCount > 0) {
    alerts.push({
      type: 'warning',
      message: `${pendingCount} demande(s) de congé en attente de validation`,
      link: '/dashboard/leaves'
    });
  }
  
  if (onLeaveCount > 0) {
    alerts.push({
      type: 'info',
      message: `${onLeaveCount} employé(s) en congé aujourd'hui`,
      link: '/dashboard/leaves'
    });
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary-600" />
        Alertes & Notifications
      </h2>

      <div className="space-y-3">
        {alerts.map((alert, i) => (
          <Link
            key={i}
            href={alert.link}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              alert.type === 'warning' ? 'bg-yellow-50 text-yellow-800' : 'bg-blue-50 text-blue-800'
            } hover:opacity-80 transition-opacity`}
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{alert.message}</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// Tasks Placeholder Widget
function TasksWidget() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary-600" />
          Mes Tâches
        </h2>
        <Link href="/dashboard/my-space/tasks" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
          Voir <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="text-center py-6 text-gray-500">
        <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">Module bientôt disponible</p>
      </div>
    </div>
  );
}

// My Objectives Progress Widget (for employees)
interface MyObjective {
  id: number;
  title: string;
  progress: number;
  status: string;
}

function MyObjectivesProgressWidget({ objectives }: { objectives: MyObjective[] }) {
  if (objectives.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-600" />
            Mes Objectifs
          </h2>
          <Link href="/dashboard/my-space/objectives" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
            Voir <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="text-center py-6 text-gray-500">
          <Target className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Aucun objectif assigné</p>
        </div>
      </div>
    );
  }

  const avgProgress = Math.round(
    objectives.reduce((acc, o) => acc + o.progress, 0) / objectives.length
  );

  const chartData = objectives.slice(0, 5).map(obj => ({
    name: obj.title.length > 20 ? obj.title.substring(0, 20) + '...' : obj.title,
    progress: obj.progress
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary-600" />
          Mes Objectifs
        </h2>
        <Link href="/dashboard/my-space/objectives" className="text-primary-600 text-sm hover:underline flex items-center gap-1">
          Voir <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Progress Gauge */}
      <div className="flex items-center gap-6 mb-4">
        <div className="relative inline-flex items-center justify-center w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle cx="40" cy="40" r="32" stroke="#e5e7eb" strokeWidth="8" fill="none" />
            <circle 
              cx="40" cy="40" r="32" 
              stroke={avgProgress >= 70 ? '#10b981' : avgProgress >= 40 ? '#f59e0b' : '#ef4444'}
              strokeWidth="8" 
              fill="none"
              strokeDasharray={`${avgProgress * 2.01} 201`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-lg font-bold text-gray-900">{avgProgress}%</span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Progression globale</p>
          <p className="text-xs text-gray-500">{objectives.length} objectif(s) assigné(s)</p>
        </div>
      </div>

      {/* Progress Bars Chart */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#9ca3af" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} stroke="#9ca3af" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value: number) => [`${value}%`, 'Progression']}
            />
            <Bar 
              dataKey="progress" 
              fill="#3b82f6" 
              radius={[0, 4, 4, 0]}
              background={{ fill: '#f3f4f6', radius: 4 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{ name: string; role: UserRole; isManager: boolean; employeeId: number | null }>({
    name: '',
    role: 'employee',
    isManager: false,
    employeeId: null
  });

  // Data states
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceSummary | null>(null);
  const [myPendingRequests, setMyPendingRequests] = useState<LeaveRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamPendingRequests, setTeamPendingRequests] = useState<LeaveRequest[]>([]);
  const [hrStats, setHRStats] = useState<HRStats | null>(null);
  const [allPendingRequests, setAllPendingRequests] = useState<LeaveRequest[]>([]);
  
  // Chart data states
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [evolutionData, setEvolutionData] = useState<MonthlyData[]>([]);
  const [leavesData, setLeavesData] = useState<LeavesByMonth[]>([]);
  const [okrStats, setOkrStats] = useState<OKRStats>({ 
    total: 0, by_level: {}, by_status: {}, avg_progress: 0, 
    completed: 0, in_progress: 0, not_started: 0, overdue: 0, by_department: {} 
  });
  const [criticalOKRs, setCriticalOKRs] = useState<OKRObjective[]>([]);
  const [myObjectives, setMyObjectives] = useState<MyObjectiveData[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get current user
      const user = await getCurrentUser();
      const role = normalizeRole(user.role);
      let isManager = role === 'manager';
      const employeeId = user.employee_id || null;

      // Check if employee is manager
      if (employeeId) {
        const employee = await getEmployeeById(employeeId);
        isManager = isManager || (employee.is_manager === true);
      }

      setUserData({
        name: user.first_name || user.email?.split('@')[0] || 'Utilisateur',
        role,
        isManager,
        employeeId
      });

      // Load data based on role
      const promises: Promise<void>[] = [];

      // Employee data (for all roles)
      if (employeeId) {
        promises.push(
          getMyLeaveBalances(employeeId).then(setLeaveBalances),
          getMyPendingRequests(employeeId).then(setMyPendingRequests),
          getMyObjectives(employeeId).then(setMyObjectives)
        );
      }

      // Manager data
      if (isManager && employeeId) {
        promises.push(
          getTeamMembers(employeeId).then(async (members) => {
            setTeamMembers(members);
            const teamRequests = await getTeamPendingRequests(members);
            setTeamPendingRequests(teamRequests);
          })
        );
      }

      // HR/Admin data - Utilise les fonctions de lib/api.ts
      if (['rh', 'admin', 'dg'].includes(role)) {
        promises.push(
          getHRStatsData().then(setHRStats),
          getAllPendingRequests().then(setAllPendingRequests),
          getAllEmployees().then(employees => {
            setDepartmentData(calculateDepartmentData(employees));
            setEvolutionData(calculateMonthlyEvolution(employees));
          }),
          getAllLeaveRequests().then(requests => {
            setLeavesData(calculateLeavesByMonth(requests));
          }),
          getOKRStats().then(setOkrStats),
          getCriticalOKRs().then(setCriticalOKRs)
        );
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  const { name, role, isManager, employeeId } = userData;
  const isHROrAdmin = ['rh', 'admin', 'dg'].includes(role);

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Welcome Card - All roles */}
        <WelcomeCard userName={name} role={role} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* HR Stats - RH/Admin/DG only - FIRST */}
            {isHROrAdmin && hrStats && (
              <HRStatsWidget stats={hrStats} />
            )}

            {/* Team Overview - Managers only */}
            {isManager && (
              <TeamOverviewWidget teamMembers={teamMembers} pendingRequests={teamPendingRequests} />
            )}

            {/* Charts Section - HR/Admin/DG only - AFTER STATS */}
            {isHROrAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EvolutionChartWidget data={evolutionData} />
                <DepartmentChartWidget data={departmentData} />
                <LeavesChartWidget data={leavesData} />
                <OKRStatsWidget stats={okrStats} criticalOKRs={criticalOKRs} />
              </div>
            )}

            {/* My Leave Balance - All roles */}
            {employeeId && (
              <MyLeaveBalanceWidget balances={leaveBalances} />
            )}

            {/* Pending Requests - RH/Admin/DG */}
            {isHROrAdmin && (
              <PendingRequestsWidget requests={allPendingRequests} />
            )}
          </div>

          {/* Right Column - 1/3 */}
          <div className="space-y-6">
            {/* Quick Actions - All roles */}
            <QuickActions role={role} isManager={isManager} />

            {/* Alerts - RH/Admin/DG */}
            {isHROrAdmin && hrStats && (
              <AlertsWidget 
                pendingCount={hrStats.pending_requests} 
                onLeaveCount={hrStats.on_leave_today} 
              />
            )}

            {/* My Pending Requests - All roles */}
            {employeeId && myPendingRequests.length > 0 && (
              <MyPendingRequestsWidget requests={myPendingRequests} />
            )}

            {/* Objectives Widget - All employees */}
            {employeeId && <MyObjectivesProgressWidget objectives={myObjectives} />}

            {/* Tasks Widget - All roles */}
            <TasksWidget />
          </div>
        </div>
      </div>
    </div>
  );
}