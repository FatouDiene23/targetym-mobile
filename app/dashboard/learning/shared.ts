// ============================================
// LEARNING MODULE - SHARED TYPES & HELPERS
// File: app/dashboard/learning/shared.ts
// ============================================

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

// ============================================
// TYPES
// ============================================

export interface Course {
  id: number;
  title: string;
  description: string;
  category: string;
  provider: string;
  external_url: string;
  duration_hours: number;
  level: string;
  image_emoji: string;
  is_mandatory: boolean;
  is_active: boolean;
  requires_certificate: boolean;
  enrolled: number;
  completed: number;
  completion_rate: number;
  skills: { id: number; name: string; category: string }[];
}

export interface LearningPath {
  id: number;
  title: string;
  description: string;
  category: string;
  courses_count: number;
  duration_hours: number;
  assigned_count: number;
  progress: number;
  is_active: boolean;
}

export interface Assignment {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_initials: string;
  employee_job_title?: string;
  course_id: number;
  course_title: string;
  course_image: string;
  course_duration: number;
  course_external_url?: string;
  requires_certificate: boolean;
  status: string;
  deadline: string;
  assigned_at: string;
  completed_at: string;
  completion_note: string;
  certificate_file: string;
  certificate_filename: string;
  rejection_reason: string;
}

export interface Certification {
  id: number;
  name: string;
  provider: string;
  description: string;
  validity_months: number;
  total_holders: number;
  expiring_soon: number;
}

export interface CertificationHolder {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_initials: string;
  obtained_date: string;
  expiry_date: string;
  status: string;
  credential_id: string;
}

export interface Skill {
  id: number;
  name: string;
  category: string;
  description: string;
}

export interface DevelopmentPlan {
  id: number;
  employee: string;
  employee_id: number;
  initials: string;
  role: string;
  targetRole: string;
  progress: number;
  status: string;
  cancellation_reason?: string;
  skills: { id?: number; name: string; current: number; target: number }[];
  courses: { id?: number; title: string; status: string }[];
  target_date: string;
}

export interface CourseRequest {
  id: number;
  title: string;
  description: string;
  reason: string;
  external_url: string;
  provider: string;
  status: string;
  requested_by_name: string;
  requested_by_initials: string;
  for_employee_name: string;
  requested_at: string;
  review_comment: string;
}

export interface Stats {
  total_courses: number;
  completed_this_month: number;
  hours_this_month: number;
  total_certifications: number;
  completion_rate: number;
  pending_validation: number;
  expiring_certifications: number;
}

export interface MonthlyStats {
  month: string;
  completions: number;
  hours: number;
}

export interface CategoryStats {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

export interface TopLearner {
  name: string;
  hours: number;
  courses: number;
}

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  job_title: string;
}

export interface PostTrainingEval {
  id: number;
  tenant_id: number;
  assignment_id: number;
  course_id: number;
  employee_id: number;
  employee_name: string;
  employee_initials: string;
  employee_job_title: string;
  course_title: string;
  course_category: string;
  course_emoji: string;
  evaluator_id: number | null;
  evaluator_name: string | null;
  evaluator_initials: string | null;
  evaluator_type: string;
  scheduled_date: string | null;
  due_date: string | null;
  status: string;
  score: number | null;
  criteria_scores: CriteriaScore[] | null;
  comments: string | null;
  strengths: string | null;
  improvements: string | null;
  competency_validated: boolean;
  recommendation: string;
  recommendation_details: string | null;
  retrain_course_id: number | null;
  retrain_course_title: string | null;
  retrain_assignment_id: number | null;
  career_synced: boolean;
  career_synced_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  passing_threshold?: number;
  default_criteria?: CriteriaScore[];
}

export interface CriteriaScore {
  code: string;
  label: string;
  score: number;
  weight: number;
}

export interface EpfStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  avg_score: number;
  validation_rate: number;
  retrain_count: number;
  passing_threshold: number;
}

export interface EpfSettings {
  trigger_delay_days: number;
  default_evaluator_type: string;
  passing_threshold: number;
  auto_retrain: boolean;
  default_criteria: CriteriaScore[];
}

export interface EmployeeEvalHistory {
  employee_id: number;
  employee_name: string;
  summary: {
    total_evaluations: number;
    avg_score: number;
    min_score: number;
    max_score: number;
    validated_count: number;
    retrain_count: number;
    validation_rate: number;
    trend: string;
  };
  evaluations: PostTrainingEval[];
}

// ============================================
// PERMISSIONS HELPER
// ============================================

export const hasPermission = (userRole: string, action: string): boolean => {
  const permissions: Record<string, string[]> = {
    'create_skill': ['admin', 'dg', 'dga', 'rh'],
    'create_course': ['admin', 'dg', 'dga', 'rh'],
    'assign_course': ['admin', 'dg', 'dga', 'rh', 'manager'],
    'validate_completion': ['admin', 'dg', 'dga', 'rh', 'manager'],
    'create_path': ['admin', 'dg', 'dga', 'rh'],
    'create_certification': ['admin', 'dg', 'dga', 'rh'],
    'create_plan': ['admin', 'dg', 'dga', 'rh', 'manager'],
    'view_all_plans': ['admin', 'dg', 'dga', 'rh'],
    'view_analytics': ['admin', 'dg', 'dga', 'rh'],
    'view_requests': ['admin', 'dg', 'dga', 'rh'],
    'request_course': ['manager', 'employee'],
    'view_team': ['manager'],
  };
  const allowedRoles = permissions[action] || [];
  return allowedRoles.includes(userRole.toLowerCase());
};

// ============================================
// STATUS HELPERS
// ============================================

export const getLevelColor = (level: string) => {
  if (level === 'beginner') return 'bg-green-100 text-green-700';
  if (level === 'intermediate') return 'bg-blue-100 text-blue-700';
  return 'bg-purple-100 text-purple-700';
};

export const getLevelLabel = (level: string) => {
  if (level === 'beginner') return 'Débutant';
  if (level === 'intermediate') return 'Intermédiaire';
  return 'Avancé';
};

export const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'completed': 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    'in_progress': 'bg-blue-100 text-blue-700',
    'pending_validation': 'bg-orange-100 text-orange-700',
    'pending': 'bg-orange-100 text-orange-700',
    'rejected': 'bg-red-100 text-red-700',
    'approved': 'bg-green-100 text-green-700',
    'cancelled': 'bg-red-100 text-red-700',
    'archived': 'bg-gray-100 text-gray-700',
    'assigned': 'bg-orange-100 text-orange-700',
    'active': 'bg-green-100 text-green-700',
    'planned': 'bg-gray-100 text-gray-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};

export const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'assigned': 'À commencer',
    'in_progress': 'En cours',
    'in-progress': 'En cours',
    'pending_validation': 'En attente',
    'pending': 'En attente',
    'completed': 'Terminé',
    'rejected': 'Rejeté',
    'approved': 'Approuvé',
    'active': 'Actif',
    'cancelled': 'Annulé',
    'archived': 'Archivé',
    'planned': 'Planifié',
  };
  return labels[status] || status;
};

export const getPlanStatusColor = (status: string) => {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'completed') return 'bg-blue-100 text-blue-700';
  if (status === 'cancelled') return 'bg-red-100 text-red-700';
  if (status === 'archived') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-100 text-gray-700';
};

export const getCertStatusColor = (status: string) => {
  if (status === 'valid') return 'text-green-600';
  if (status === 'expiring') return 'text-orange-600';
  return 'text-red-600';
};

export const getEpfStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'pending': 'bg-amber-100 text-amber-700',
    'in_progress': 'bg-blue-100 text-blue-700',
    'completed': 'bg-green-100 text-green-700',
    'cancelled': 'bg-red-100 text-red-700',
    'expired': 'bg-gray-100 text-gray-700'
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};

export const getEpfStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'pending': 'En attente',
    'in_progress': 'En cours',
    'completed': 'Complétée',
    'cancelled': 'Annulée',
    'expired': 'Expirée'
  };
  return labels[status] || status;
};

export const getRecommendationColor = (rec: string) => {
  const colors: Record<string, string> = {
    'validated': 'bg-green-100 text-green-700',
    'retrain': 'bg-red-100 text-red-700',
    'complement': 'bg-orange-100 text-orange-700',
    'pending': 'bg-gray-100 text-gray-500'
  };
  return colors[rec] || 'bg-gray-100 text-gray-700';
};

export const getRecommendationLabel = (rec: string) => {
  const labels: Record<string, string> = {
    'validated': '✅ Validée',
    'retrain': '🔄 Re-formation',
    'complement': '📚 Complément',
    'pending': '⏳ En attente'
  };
  return labels[rec] || rec;
};

export const getScoreColor = (score: number, threshold: number) => {
  if (score >= threshold) return 'text-green-600';
  if (score >= threshold * 0.7) return 'text-orange-600';
  return 'text-red-600';
};

export const getTrendIcon = (trend: string) => {
  if (trend === 'up') return '📈';
  if (trend === 'down') return '📉';
  return '➡️';
};

export const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const categories = ['Tous', 'Soft Skills', 'Technique', 'Management', 'Commercial', 'Innovation', 'Juridique'];
export const skillCategories = ['Technique', 'Soft Skills', 'Management', 'Métier'];
