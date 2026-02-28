// ============================================
// app/dashboard/talents/shared.ts
// Types, helpers, constants partagés
// ============================================

// ============================================
// TYPES
// ============================================

export interface CareerPath {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  level_count?: number;
  employee_count?: number;
}

export interface CareerLevel {
  id: number;
  career_path_id: number;
  level_order: number;
  title: string;
  description: string | null;
  min_tenure_months: number;
  is_entry_level: boolean;
  competency_count?: number;
  factor_count?: number;
  employee_count?: number;
  competencies?: LevelCompetency[];
  required_attitudes?: RequiredAttitude[];
  promotion_factors?: PromotionFactor[];
}

export interface LevelCompetency {
  id: number;
  career_level_id: number;
  competency_name: string;
  description: string | null;
  performance_threshold: number;
  attitude_threshold: number;
  is_mandatory: boolean;
  trainings?: { id: number; title: string; emoji?: string }[];
}

export interface RequiredAttitude {
  id: number;
  career_level_id: number;
  attitude_id: number;
  threshold: number;
  attitude_name: string;
  attitude_code: string;
  attitude_icon?: string;
}

export interface PromotionFactor {
  id: number;
  career_level_id: number;
  factor_name: string;
  factor_type: 'auto' | 'committee' | 'n_plus_1';
  threshold_value: string | null;
  is_blocking: boolean;
}

export interface EmployeeCareer {
  id: number;
  employee_id: number;
  career_path_id: number;
  current_level_id: number;
  next_level_id: number | null;
  level_start_date: string;
  eligibility_status: 'not_eligible' | 'in_progress' | 'eligible' | 'promoted';
  estimated_promotion_date: string | null;
  path_name: string;
  current_level_title: string;
  current_level_order?: number;
  next_level_title?: string;
  first_name: string;
  last_name: string;
  job_title: string;
  photo_url?: string;
  validated_count?: number;
  total_count?: number;
  overall_progress?: number;
  all_levels?: { id: number; level_order: number; title: string; is_entry_level: boolean }[];
  competency_progress?: CompetencyProgress[];
  promotion_factors?: PromotionFactor[];
  promotion_history?: PromotionRequest[];
}

export interface CompetencyProgress {
  id: number;
  employee_career_id: number;
  level_competency_id: number;
  training_completed: boolean;
  post_training_score: number | null;
  theoretical_status: 'pending' | 'validated';
  performance_score: number | null;
  attitude_score: number | null;
  effective_status: 'pending' | 'validated';
  competency_name: string;
  performance_threshold: number;
  attitude_threshold: number;
  is_mandatory: boolean;
  required_trainings?: { id: number; title: string }[];
}

export interface PromotionRequest {
  id: number;
  employee_career_id: number;
  from_level_id: number;
  to_level_id: number;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: number | null;
  approved_by: number | null;
  committee_decision: string | null;
  decision_date: string | null;
  comments: string | null;
  created_at: string;
  // Joined
  first_name?: string;
  last_name?: string;
  job_title?: string;
  photo_url?: string;
  from_level?: string;
  to_level?: string;
  path_name?: string;
  requested_by_email?: string;
}

export interface NineBoxPlacement {
  id: number;
  employee_id: number;
  period: string;
  performance_score: number;
  potential_score: number;
  quadrant: number;
  notes: string | null;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  photo_url?: string;
  department_name?: string;
}

export interface NineBoxData {
  period: string | null;
  available_periods: string[];
  available_departments: string[];
  total: number;
  stats: { stars: number; high_potentials: number; at_risk: number };
  summary: Record<number, { count: number; employees: NineBoxEmployee[] }>;
  placements: NineBoxPlacement[];
}

export interface NineBoxEmployee {
  id: number;
  name: string;
  job_title: string;
  photo_url?: string;
  performance: number;
  potential: number;
}

export interface SuccessionPlan {
  id: number;
  position_title: string;
  department: string | null;
  current_holder_id: number | null;
  criticality: 'critical' | 'high' | 'medium';
  vacancy_risk: 'low' | 'medium' | 'high';
  notes: string | null;
  current_holder_name?: string;
  current_holder_title?: string;
  current_holder_photo?: string;
  candidate_count?: number;
  candidates?: SuccessionCandidate[];
}

export interface SuccessionCandidate {
  id: number;
  succession_plan_id: number;
  employee_id: number;
  readiness: 'ready' | '1-2 years' | '3+ years';
  preparation_score: number;
  rank_order: number;
  development_notes: string | null;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  photo_url?: string;
  department_name?: string;
  latest_perf?: number;
  latest_pot?: number;
  quadrant?: number;
}

export interface Attitude {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_active: boolean;
}

export interface DashboardData {
  ninebox_period: string | null;
  total_evaluated: number;
  stars: number;
  high_potentials: number;
  at_risk: number;
  ninebox_distribution: Record<number, number>;
  total_paths: number;
  employees_assigned: number;
  eligible_promotions: number;
  pending_promotions: number;
  succession_plans: number;
  critical_positions: number;
  positions_without_successor: number;
  top_talents: any[];
  recent_promotions: any[];
}

// ============================================
// CONSTANTS
// ============================================

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

export const QUADRANT_LABELS: Record<number, { title: string; action: string; color: string }> = {
  9: { title: 'Stars', action: 'Promouvoir / Responsabiliser', color: 'bg-green-500' },
  8: { title: 'Hauts Potentiels', action: 'Développer rapidement', color: 'bg-green-400' },
  7: { title: 'Diamants Bruts', action: 'Coaching intensif', color: 'bg-blue-400' },
  6: { title: 'Experts Fiables', action: 'Valoriser expertise', color: 'bg-blue-500' },
  5: { title: 'Performants Clés', action: 'Fidéliser / Développer', color: 'bg-yellow-500' },
  4: { title: 'Potentiel Émergent', action: 'Plan de développement', color: 'bg-yellow-400' },
  3: { title: 'Contributeurs Solides', action: 'Maintenir motivation', color: 'bg-orange-400' },
  2: { title: 'Sous-performants', action: 'Plan amélioration', color: 'bg-orange-500' },
  1: { title: 'En difficulté', action: 'Action urgente', color: 'bg-red-500' },
};

export const PERFORMANCE_LABELS = ['', 'Insuffisant', 'À développer', 'Conforme', 'Supérieur', 'Exceptionnel'];
export const POTENTIAL_LABELS = ['', 'Limité', 'Stable', 'Prometteur', 'Élevé', 'Star'];

export const ELIGIBILITY_LABELS: Record<string, { label: string; color: string }> = {
  'not_eligible': { label: 'Non éligible', color: 'text-gray-600 bg-gray-100' },
  'in_progress': { label: 'En progression', color: 'text-blue-600 bg-blue-100' },
  'eligible': { label: 'Éligible', color: 'text-green-600 bg-green-100' },
  'promoted': { label: 'Promu', color: 'text-purple-600 bg-purple-100' },
};

export const CRITICALITY_LABELS: Record<string, { label: string; color: string }> = {
  'critical': { label: 'Critique', color: 'text-red-600 bg-red-100' },
  'high': { label: 'Élevé', color: 'text-orange-600 bg-orange-100' },
  'medium': { label: 'Moyen', color: 'text-yellow-600 bg-yellow-100' },
};

export const RISK_LABELS: Record<string, { label: string; color: string }> = {
  'high': { label: 'Élevé', color: 'text-red-600 bg-red-100' },
  'medium': { label: 'Moyen', color: 'text-yellow-600 bg-yellow-100' },
  'low': { label: 'Faible', color: 'text-green-600 bg-green-100' },
};

export const READINESS_LABELS: Record<string, { label: string; color: string }> = {
  'ready': { label: 'Prêt maintenant', color: 'text-green-600 bg-green-100' },
  '1-2 years': { label: 'Dans 1-2 ans', color: 'text-blue-600 bg-blue-100' },
  '3+ years': { label: 'Dans 3+ ans', color: 'text-gray-600 bg-gray-100' },
};

// ============================================
// HELPERS
// ============================================

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
  return res.json();
}

export function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
}

export function getUserRole(): string {
  if (typeof window === 'undefined') return 'employee';
  try {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    if (!token) return 'employee';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.role || 'employee').toLowerCase();
  } catch {
    return 'employee';
  }
}

export function isRH(): boolean {
  const role = getUserRole();
  return ['rh', 'admin', 'directeur'].includes(role);
}

export function isManager(): boolean {
  const role = getUserRole();
  return ['rh', 'admin', 'directeur', 'manager'].includes(role);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
