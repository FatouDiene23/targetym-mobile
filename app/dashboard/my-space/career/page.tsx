'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { careerTips } from '@/config/pageTips';
import {
  Briefcase, TrendingUp, GraduationCap, Award, MapPin, Calendar,
  AlertCircle, ChevronDown, ChevronUp, DollarSign, Star, Users,
  Clock, ArrowUpRight, Plane, Target, Building2, UserCheck,
  RefreshCw, ExternalLink, BadgeCheck, Heart
} from 'lucide-react';
import Link from 'next/link';

// ============================================
// TYPES
// ============================================

interface UserProfile {
  id: number;
  email: string;
  employee_id?: number;
  role?: string;
  is_manager?: boolean;
}

interface EmployeeDetail {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  department_id?: number;
  department_name?: string;
  hire_date?: string;
  date_of_birth?: string;
  status?: string;
  contract_type?: string;
  salary?: number;
  currency?: string;
  manager_name?: string;
  phone?: string;
  location?: string;
}

interface CareerEvent {
  id: string;
  date: string;
  type: 'hire' | 'promotion' | 'department_change' | 'salary_change' | 'training' | 'certification' | 'evaluation' | 'mission' | 'milestone';
  title: string;
  subtitle?: string;
  description?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  metadata?: Record<string, string | number>;
}

interface Assignment {
  id: number;
  course_title: string;
  course_image: string;
  course_duration: number;
  status: string;
  completed_at?: string;
  assigned_at?: string;
}

interface Mission {
  id: number;
  destination: string;
  start_date: string;
  end_date: string;
  status: string;
  objective?: string;
}

interface Evaluation {
  id: number;
  campaign_name?: string;
  period?: string;
  overall_score?: number;
  status: string;
  completed_at?: string;
  evaluator_name?: string;
}

interface SalaryHistory {
  id: number;
  effective_date: string;
  amount: number;
  currency: string;
  reason?: string;
  change_percentage?: number;
}

// ============================================
// API
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

function safeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.results)) return obj.results;
  }
  return [];
}

async function getCurrentUser(): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Erreur');
  return res.json();
}

async function getEmployeeDetail(employeeId: number): Promise<EmployeeDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/employees/${employeeId}`, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function getMyAssignments(): Promise<Assignment[]> {
  try {
    const res = await fetch(`${API_URL}/api/learning/assignments/?my_assignments=true`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return safeArray<Assignment>(data);
  } catch { return []; }
}

async function getMyMissions(employeeId: number): Promise<Mission[]> {
  try {
    const res = await fetch(`${API_URL}/api/missions/?employee_id=${employeeId}&page_size=100`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return safeArray<Mission>(data);
  } catch { return []; }
}

async function getMyEvaluations(employeeId: number): Promise<Evaluation[]> {
  try {
    const res = await fetch(`${API_URL}/api/performance/evaluations/?employee_id=${employeeId}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return safeArray<Evaluation>(data);
  } catch { return []; }
}

async function getSalaryHistory(employeeId: number): Promise<SalaryHistory[]> {
  try {
    const res = await fetch(`${API_URL}/api/employees/${employeeId}/salary-history`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return safeArray<SalaryHistory>(data);
  } catch { return []; }
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function calculateSeniority(hireDate: string): { years: number; months: number; label: string } {
  const hire = new Date(hireDate);
  const now = new Date();
  let years = now.getFullYear() - hire.getFullYear();
  let months = now.getMonth() - hire.getMonth();
  if (months < 0) { years--; months += 12; }
  
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} an${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mois`);
  if (parts.length === 0) parts.push('< 1 mois');
  
  return { years, months, label: parts.join(' et ') };
}

function formatSalary(amount: number, currency?: string): string {
  const curr = currency || 'XOF';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString('fr-FR')} ${curr}`;
  }
}

// ============================================
// BUILD TIMELINE
// ============================================

function buildCareerTimeline(
  employee: EmployeeDetail,
  assignments: Assignment[],
  missions: Mission[],
  evaluations: Evaluation[],
  salaryHistory: SalaryHistory[],
): CareerEvent[] {
  const events: CareerEvent[] = [];

  // --- Hire date ---
  if (employee.hire_date) {
    events.push({
      id: 'hire',
      date: employee.hire_date,
      type: 'hire',
      title: 'Début chez l\'entreprise',
      subtitle: employee.job_title || 'Poste initial',
      description: `${employee.department_name ? `Département: ${employee.department_name}` : ''}${employee.contract_type ? ` • ${employee.contract_type}` : ''}`,
      icon: <BadgeCheck className="w-5 h-5" />,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-100',
    });
  }

  // --- Salary history ---
  salaryHistory.forEach((sh, i) => {
    events.push({
      id: `salary-${sh.id || i}`,
      date: sh.effective_date,
      type: 'salary_change',
      title: sh.reason || (i === 0 ? 'Salaire initial' : 'Révision salariale'),
      subtitle: formatSalary(sh.amount, sh.currency),
      description: sh.change_percentage ? `${sh.change_percentage > 0 ? '+' : ''}${sh.change_percentage}%` : undefined,
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      metadata: { amount: sh.amount },
    });
  });

  // --- Completed trainings (summary only) ---
  const completedTrainings = assignments.filter(a => a.status === 'completed');
  completedTrainings.forEach((a) => {
    if (a.completed_at) {
      events.push({
        id: `training-${a.id}`,
        date: a.completed_at.substring(0, 10),
        type: 'training',
        title: `Formation complétée`,
        subtitle: a.course_title,
        description: `${a.course_duration}h`,
        icon: <GraduationCap className="w-5 h-5" />,
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-100',
      });
    }
  });

  // --- Missions ---
  const completedMissions = missions.filter(m => m.status === 'completed' || m.status === 'validated');
  completedMissions.forEach((m) => {
    events.push({
      id: `mission-${m.id}`,
      date: m.start_date,
      type: 'mission',
      title: `Mission — ${m.destination}`,
      subtitle: m.objective || undefined,
      description: `${formatDateShort(m.start_date)} → ${formatDateShort(m.end_date)}`,
      icon: <Plane className="w-5 h-5" />,
      color: 'text-sky-700',
      bgColor: 'bg-sky-100',
    });
  });

  // --- Evaluations ---
  evaluations.filter(e => e.status === 'completed').forEach((ev) => {
    events.push({
      id: `eval-${ev.id}`,
      date: ev.completed_at || '',
      type: 'evaluation',
      title: ev.campaign_name || 'Évaluation de performance',
      subtitle: ev.overall_score ? `Note: ${ev.overall_score}/5` : undefined,
      description: ev.evaluator_name ? `Par ${ev.evaluator_name}` : undefined,
      icon: <Star className="w-5 h-5" />,
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
      metadata: ev.overall_score ? { score: ev.overall_score } : undefined,
    });
  });

  // --- Milestones (anniversaries) ---
  if (employee.hire_date) {
    const hireYear = new Date(employee.hire_date).getFullYear();
    const currentYear = new Date().getFullYear();
    const hireMMDD = employee.hire_date.substring(5);
    
    for (let y = hireYear + 1; y <= currentYear; y++) {
      const yearsOfService = y - hireYear;
      if ([1, 2, 3, 5, 10, 15, 20, 25].includes(yearsOfService)) {
        const milestoneDate = `${y}-${hireMMDD}`;
        if (milestoneDate <= new Date().toISOString().substring(0, 10)) {
          events.push({
            id: `milestone-${y}`,
            date: milestoneDate,
            type: 'milestone',
            title: `🎉 ${yearsOfService} an${yearsOfService > 1 ? 's' : ''} d'ancienneté`,
            icon: <Heart className="w-5 h-5" />,
            color: 'text-pink-700',
            bgColor: 'bg-pink-100',
          });
        }
      }
    }
  }

  // Sort by date descending (most recent first)
  events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return events;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatCard({ icon, label, value, sublabel, color, href }: {
  icon: React.ReactNode; label: string; value: string | number; sublabel?: string; color: string; href?: string;
}) {
  const content = (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {href && <ArrowUpRight className="w-4 h-4 text-gray-400" />}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function TimelineItem({ event, isLast }: { event: CareerEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-4">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${event.bgColor} ${event.color}`}>
          {event.icon}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-8 ${isLast ? '' : ''}`}>
        <div 
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                {formatDate(event.date)}
              </p>
              <h4 className="font-semibold text-gray-900">{event.title}</h4>
              {event.subtitle && (
                <p className={`text-sm font-medium mt-0.5 ${event.color}`}>{event.subtitle}</p>
              )}
            </div>
            {(event.description || (event.metadata && Object.keys(event.metadata).length > 0)) && (
              <button className="text-gray-400 hover:text-gray-600 ml-2 mt-1">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
          
          {expanded && event.description && (
            <p className="text-sm text-gray-500 mt-2 pt-2 border-t border-gray-100">
              {event.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SalaryChart({ history, currentSalary, currency }: { 
  history: SalaryHistory[]; currentSalary?: number; currency?: string;
}) {
  const data = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.effective_date.localeCompare(b.effective_date));
    
    // If no history but we have current salary, show just that
    if (sorted.length === 0 && currentSalary) {
      return [{ date: 'Actuel', amount: currentSalary }];
    }
    
    return sorted.map(s => ({
      date: formatDateShort(s.effective_date),
      amount: s.amount,
    }));
  }, [history, currentSalary]);

  if (data.length === 0) return null;

  const maxAmount = Math.max(...data.map(d => d.amount));
  const minAmount = Math.min(...data.map(d => d.amount));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-green-600" />
        Évolution Salariale
      </h3>
      
      {data.length === 1 ? (
        <div className="text-center py-4">
          <p className="text-3xl font-bold text-green-600">{formatSalary(data[0].amount, currency)}</p>
          <p className="text-sm text-gray-500 mt-1">Salaire actuel</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((d, i) => {
            const prevAmount = i > 0 ? data[i - 1].amount : d.amount;
            const change = i > 0 ? ((d.amount - prevAmount) / prevAmount * 100) : 0;
            const barWidth = maxAmount > 0 ? (d.amount / maxAmount * 100) : 0;
            
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 shrink-0 text-right">{d.date}</span>
                <div className="flex-1 relative">
                  <div className="h-7 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(barWidth, 20)}%` }}
                    >
                      <span className="text-xs font-semibold text-white whitespace-nowrap">
                        {formatSalary(d.amount, currency)}
                      </span>
                    </div>
                  </div>
                </div>
                {i > 0 && change !== 0 && (
                  <span className={`text-xs font-medium shrink-0 ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// FILTER TABS
// ============================================

type FilterType = 'all' | 'career' | 'training' | 'evaluation' | 'mission' | 'salary';

const FILTER_OPTIONS: { key: FilterType; label: string; types: CareerEvent['type'][] }[] = [
  { key: 'all', label: 'Tout', types: [] },
  { key: 'career', label: 'Carrière', types: ['hire', 'promotion', 'department_change', 'milestone'] },
  { key: 'salary', label: 'Salaire', types: ['salary_change'] },
  { key: 'training', label: 'Formations', types: ['training', 'certification'] },
  { key: 'evaluation', label: 'Évaluations', types: ['evaluation'] },
  { key: 'mission', label: 'Missions', types: ['mission'] },
];

// ============================================
// MAIN PAGE
// ============================================

export default function MyCareerPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<CareerEvent[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // Counters
  const [completedTrainings, setCompletedTrainings] = useState(0);
  const [totalTrainingHours, setTotalTrainingHours] = useState(0);
  const [completedMissions, setCompletedMissions] = useState(0);
  const [evaluationCount, setEvaluationCount] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);

  const { showTips, dismissTips, resetTips } = usePageTour('career');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const user = await getCurrentUser();
      if (!user.employee_id) {
        setError('Compte non lié à un profil employé');
        return;
      }

      const [emp, assignments, missions, evaluations, salHistory] = await Promise.all([
        getEmployeeDetail(user.employee_id),
        getMyAssignments(),
        getMyMissions(user.employee_id),
        getMyEvaluations(user.employee_id),
        getSalaryHistory(user.employee_id),
      ]);

      if (!emp) {
        setError('Profil employé introuvable');
        return;
      }

      setEmployee(emp);

      const safeAssignments = Array.isArray(assignments) ? assignments : [];
      const safeMissions = Array.isArray(missions) ? missions : [];
      const safeEvaluations = Array.isArray(evaluations) ? evaluations : [];
      const safeSalHistory = Array.isArray(salHistory) ? salHistory : [];

      setSalaryHistory(safeSalHistory);

      // Build timeline
      const events = buildCareerTimeline(emp, safeAssignments, safeMissions, safeEvaluations, safeSalHistory);
      setTimelineEvents(events);

      // Counters
      const completed = safeAssignments.filter(a => a.status === 'completed');
      setCompletedTrainings(completed.length);
      setTotalTrainingHours(completed.reduce((sum, a) => sum + (a.course_duration || 0), 0));
      
      setCompletedMissions(safeMissions.filter(m => m.status === 'completed' || m.status === 'validated').length);
      
      const completedEvals = safeEvaluations.filter(e => e.status === 'completed');
      setEvaluationCount(completedEvals.length);
      
      const scores = completedEvals.filter(e => e.overall_score).map(e => e.overall_score!);
      setAvgScore(scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null);
    } catch (err) {
      console.error(err);
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return timelineEvents;
    const filterConfig = FILTER_OPTIONS.find(f => f.key === activeFilter);
    if (!filterConfig) return timelineEvents;
    return timelineEvents.filter(e => filterConfig.types.includes(e.type));
  }, [timelineEvents, activeFilter]);

  // Seniority
  const seniority = useMemo(() => {
    if (!employee?.hire_date) return null;
    return calculateSeniority(employee.hire_date);
  }, [employee]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement de votre parcours...</p>
        </div>
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

  if (!employee) return null;

  return (
    <>
      {showTips && (
        <PageTourTips tips={careerTips} onDismiss={dismissTips} pageTitle="Ma Carrière" />
      )}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Header - Profile Summary */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-8">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white text-2xl font-bold border-2 border-white/30">
                {employee.first_name?.[0]}{employee.last_name?.[0]}
              </div>
              <div className="text-white">
                <h1 className="text-2xl font-bold">{employee.first_name} {employee.last_name}</h1>
                <p className="text-primary-100 text-lg">{employee.job_title || '—'}</p>
                <div className="flex items-center gap-4 mt-2 text-primary-200 text-sm">
                  {employee.department_name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />{employee.department_name}
                    </span>
                  )}
                  {employee.manager_name && (
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-4 h-4" />N+1: {employee.manager_name}
                    </span>
                  )}
                  {employee.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />{employee.location}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Seniority bar */}
          {seniority && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary-500" />
                <div>
                  <span className="text-sm font-medium text-gray-900">Ancienneté: </span>
                  <span className="text-sm text-primary-600 font-semibold">{seniority.label}</span>
                </div>
              </div>
              {employee.hire_date && (
                <span className="text-sm text-gray-500">
                  Depuis le {formatDate(employee.hire_date)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6" data-tour="skills-analysis">
          <StatCard
            icon={<Clock className="w-5 h-5 text-primary-600" />}
            label="Ancienneté"
            value={seniority ? `${seniority.years > 0 ? `${seniority.years}a` : ''}${seniority.months > 0 ? ` ${seniority.months}m` : ''}`.trim() || '< 1m' : '—'}
            color="bg-primary-50"
          />
          <StatCard
            icon={<GraduationCap className="w-5 h-5 text-indigo-600" />}
            label="Formations"
            value={completedTrainings}
            sublabel={`${totalTrainingHours}h cumulées`}
            color="bg-indigo-50"
            href="/dashboard/learning"
          />
          <StatCard
            icon={<Plane className="w-5 h-5 text-sky-600" />}
            label="Missions"
            value={completedMissions}
            color="bg-sky-50"
            href="/dashboard/missions"
          />
          <StatCard
            icon={<Star className="w-5 h-5 text-amber-600" />}
            label="Évaluations"
            value={evaluationCount}
            sublabel={avgScore ? `Moyenne: ${avgScore.toFixed(1)}/5` : undefined}
            color="bg-amber-50"
            href="/dashboard/performance/evaluations"
          />
          {employee.salary && (
            <StatCard
              icon={<DollarSign className="w-5 h-5 text-green-600" />}
              label="Salaire actuel"
              value={formatSalary(employee.salary, employee.currency)}
              color="bg-green-50"
            />
          )}
        </div>

        {/* Salary Chart + Current Position side by side */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Current Position */}
          <div className="bg-white rounded-xl border border-gray-200 p-5" data-tour="career-path">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary-600" />
              Poste Actuel
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Titre</span>
                <span className="text-sm font-medium text-gray-900">{employee.job_title || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Département</span>
                <span className="text-sm font-medium text-gray-900">{employee.department_name || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Type de contrat</span>
                <span className="text-sm font-medium text-gray-900">{employee.contract_type || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Manager</span>
                <span className="text-sm font-medium text-gray-900">{employee.manager_name || '—'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">Statut</span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  employee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {employee.status === 'active' ? 'Actif' : employee.status || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Salary chart */}
          {(salaryHistory.length > 0 || employee.salary) && (
            <SalaryChart 
              history={salaryHistory} 
              currentSalary={employee.salary} 
              currency={employee.currency} 
            />
          )}

          {/* If no salary data, show a quick-links card instead */}
          {salaryHistory.length === 0 && !employee.salary && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary-600" />
                Accès Rapides
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Mes Formations', href: '/dashboard/learning', icon: <GraduationCap className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
                  { label: 'Mes Missions', href: '/dashboard/missions', icon: <Plane className="w-4 h-4" />, color: 'text-sky-600 bg-sky-50' },
                  { label: 'Mes Évaluations', href: '/dashboard/performance/evaluations', icon: <Star className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50' },
                  { label: 'Mes Objectifs', href: '/dashboard/my-space/objectives', icon: <Target className="w-4 h-4" />, color: 'text-primary-600 bg-primary-50' },
                ].map(link => (
                  <Link 
                    key={link.href} 
                    href={link.href}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${link.color}`}>
                      {link.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{link.label}</span>
                    <ArrowUpRight className="w-4 h-4 text-gray-400 ml-auto" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeline Section */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              Mon Parcours
            </h2>
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {FILTER_OPTIONS.map(filter => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeFilter === filter.key 
                    ? 'bg-primary-500 text-white' 
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {filter.label}
                {filter.key !== 'all' && (
                  <span className="ml-1 text-xs opacity-80">
                    ({timelineEvents.filter(e => filter.types.includes(e.type)).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Timeline */}
          {filteredEvents.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucun événement dans cette catégorie</p>
            </div>
          ) : (
            <div className="relative">
              {filteredEvents.map((event, idx) => (
                <TimelineItem 
                  key={event.id} 
                  event={event} 
                  isLast={idx === filteredEvents.length - 1} 
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
    </>
  );
}
