'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, CheckCircle, Target, Users,
  AlertCircle, ArrowRight, UserPlus, BarChart3,
  CalendarDays, ClipboardList, Bell, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

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

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  is_manager?: boolean;
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

// ============================================
// API
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

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

async function getEmployee(id: number): Promise<Employee> {
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
    const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${employeeId}&status=pending`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
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
      const response = await fetch(`${API_URL}/api/leaves/requests?employee_id=${member.id}&status=pending`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        const requests = (data.items || []).map((r: LeaveRequest) => ({
          ...r,
          employee_name: `${member.first_name} ${member.last_name}`
        }));
        allRequests.push(...requests);
      }
    } catch { /* ignore */ }
  }
  return allRequests;
}

async function getHRStats(): Promise<HRStats> {
  try {
    // Récupérer les employés
    const empResponse = await fetch(`${API_URL}/api/employees?page_size=1000`, { headers: getAuthHeaders() });
    const empData = empResponse.ok ? await empResponse.json() : { items: [], total: 0 };
    const employees = empData.items || [];
    
    // Récupérer les demandes en attente
    const reqResponse = await fetch(`${API_URL}/api/leaves/requests?status=pending&page_size=100`, { headers: getAuthHeaders() });
    const reqData = reqResponse.ok ? await reqResponse.json() : { items: [] };
    
    // Récupérer les départements
    const deptResponse = await fetch(`${API_URL}/api/departments`, { headers: getAuthHeaders() });
    const deptData = deptResponse.ok ? await deptResponse.json() : [];
    const departments = Array.isArray(deptData) ? deptData : (deptData.items || []);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      total_employees: empData.total || employees.length,
      active_employees: employees.filter((e: { status: string }) => e.status === 'active').length,
      on_leave_today: employees.filter((e: { status: string }) => e.status === 'on_leave').length,
      pending_requests: (reqData.items || []).length,
      new_hires_this_month: employees.filter((e: { hire_date: string }) => 
        e.hire_date && new Date(e.hire_date) >= startOfMonth
      ).length,
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
    const response = await fetch(`${API_URL}/api/leaves/requests?status=pending&page_size=10`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
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

// Objectives Widget
function ObjectivesWidget() {
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
        <p className="text-sm">Consultez vos objectifs assignés</p>
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
        const employee = await getEmployee(employeeId);
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
          getMyPendingRequests(employeeId).then(setMyPendingRequests)
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

      // HR/Admin data
      if (['rh', 'admin', 'dg'].includes(role)) {
        promises.push(
          getHRStats().then(setHRStats),
          getAllPendingRequests().then(setAllPendingRequests)
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

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Welcome Card - All roles */}
        <WelcomeCard userName={name} role={role} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* HR Stats - RH/Admin/DG only */}
            {['rh', 'admin', 'dg'].includes(role) && hrStats && (
              <HRStatsWidget stats={hrStats} />
            )}

            {/* Team Overview - Managers only */}
            {isManager && (
              <TeamOverviewWidget teamMembers={teamMembers} pendingRequests={teamPendingRequests} />
            )}

            {/* My Leave Balance - All roles */}
            {employeeId && (
              <MyLeaveBalanceWidget balances={leaveBalances} />
            )}

            {/* Pending Requests - RH/Admin/DG */}
            {['rh', 'admin', 'dg'].includes(role) && (
              <PendingRequestsWidget requests={allPendingRequests} />
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions - All roles */}
            <QuickActions role={role} isManager={isManager} />

            {/* My Pending Requests - All roles */}
            {employeeId && myPendingRequests.length > 0 && (
              <MyPendingRequestsWidget requests={myPendingRequests} />
            )}

            {/* Alerts - RH/Admin/DG */}
            {['rh', 'admin', 'dg'].includes(role) && hrStats && (
              <AlertsWidget 
                pendingCount={hrStats.pending_requests} 
                onLeaveCount={hrStats.on_leave_today} 
              />
            )}

            {/* Objectives Widget - All roles */}
            <ObjectivesWidget />

            {/* Tasks Widget - All roles */}
            <TasksWidget />
          </div>
        </div>
      </div>
    </div>
  );
}