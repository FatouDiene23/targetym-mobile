'use client';

import Header from '@/components/Header';
import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Award, Clock, Users, CheckCircle, Plus, Search,
  TrendingUp, Target, ChevronRight, AlertTriangle,
  GraduationCap, BarChart3, X, User, ArrowRight, Upload, ExternalLink,
  Check, XCircle, RefreshCw, Eye, Edit, MessageSquarePlus, Send,
  Archive, Ban, Play, FileCheck, Link, UsersRound, FileWarning,
  ClipboardCheck, Zap, Settings
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

// ============================================
// TYPES
// ============================================

interface Course {
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
}

interface LearningPath {
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

interface Assignment {
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

interface Certification {
  id: number;
  name: string;
  provider: string;
  description: string;
  validity_months: number;
  total_holders: number;
  expiring_soon: number;
}

interface CertificationHolder {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_initials: string;
  obtained_date: string;
  expiry_date: string;
  status: string;
  credential_id: string;
}

interface Skill {
  id: number;
  name: string;
  category: string;
  description: string;
}

interface DevelopmentPlan {
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

interface CourseRequest {
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

interface Stats {
  total_courses: number;
  completed_this_month: number;
  hours_this_month: number;
  total_certifications: number;
  completion_rate: number;
  pending_validation: number;
  expiring_certifications: number;
}

interface MonthlyStats {
  month: string;
  completions: number;
  hours: number;
}

interface CategoryStats {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

interface TopLearner {
  name: string;
  hours: number;
  courses: number;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  job_title: string;
}

interface PostTrainingEval {
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

interface CriteriaScore {
  code: string;
  label: string;
  score: number;
  weight: number;
}

interface EpfStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  avg_score: number;
  validation_rate: number;
  retrain_count: number;
  passing_threshold: number;
}

interface EpfSettings {
  trigger_delay_days: number;
  default_evaluator_type: string;
  passing_threshold: number;
  auto_retrain: boolean;
  default_criteria: CriteriaScore[];
}

interface EmployeeEvalHistory {
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

const hasPermission = (userRole: string, action: string): boolean => {
  const permissions: Record<string, string[]> = {
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

const getLevelColor = (level: string) => {
  if (level === 'beginner') return 'bg-green-100 text-green-700';
  if (level === 'intermediate') return 'bg-blue-100 text-blue-700';
  return 'bg-purple-100 text-purple-700';
};

const getLevelLabel = (level: string) => {
  if (level === 'beginner') return 'Débutant';
  if (level === 'intermediate') return 'Intermédiaire';
  return 'Avancé';
};

const getStatusColor = (status: string) => {
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

const getStatusLabel = (status: string) => {
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

const getPlanStatusColor = (status: string) => {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'completed') return 'bg-blue-100 text-blue-700';
  if (status === 'cancelled') return 'bg-red-100 text-red-700';
  if (status === 'archived') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-100 text-gray-700';
};

const getCertStatusColor = (status: string) => {
  if (status === 'valid') return 'text-green-600';
  if (status === 'expiring') return 'text-orange-600';
  return 'text-red-600';
};

const getEpfStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'pending': 'bg-amber-100 text-amber-700',
    'in_progress': 'bg-blue-100 text-blue-700',
    'completed': 'bg-green-100 text-green-700',
    'cancelled': 'bg-red-100 text-red-700',
    'expired': 'bg-gray-100 text-gray-700'
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};

const getEpfStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    'pending': 'En attente',
    'in_progress': 'En cours',
    'completed': 'Complétée',
    'cancelled': 'Annulée',
    'expired': 'Expirée'
  };
  return labels[status] || status;
};

const getRecommendationColor = (rec: string) => {
  const colors: Record<string, string> = {
    'validated': 'bg-green-100 text-green-700',
    'retrain': 'bg-red-100 text-red-700',
    'complement': 'bg-orange-100 text-orange-700',
    'pending': 'bg-gray-100 text-gray-500'
  };
  return colors[rec] || 'bg-gray-100 text-gray-700';
};

const getRecommendationLabel = (rec: string) => {
  const labels: Record<string, string> = {
    'validated': '✅ Validée',
    'retrain': '🔄 Re-formation',
    'complement': '📚 Complément',
    'pending': '⏳ En attente'
  };
  return labels[rec] || rec;
};

const getScoreColor = (score: number, threshold: number) => {
  if (score >= threshold) return 'text-green-600';
  if (score >= threshold * 0.7) return 'text-orange-600';
  return 'text-red-600';
};

const getTrendIcon = (trend: string) => {
  if (trend === 'up') return '📈';
  if (trend === 'down') return '📉';
  return '➡️';
};

// ============================================
// MAIN COMPONENT - ÉTATS
// ============================================

export default function LearningPage() {
  // Navigation & Filters
  const [activeTab, setActiveTab] = useState<'catalog' | 'my-learning' | 'team' | 'paths' | 'certifications' | 'development' | 'requests' | 'analytics' | 'post-eval'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // User & Role
  const [userRole, setUserRole] = useState<string>('employee');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  
  // Data states
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [developmentPlans, setDevelopmentPlans] = useState<DevelopmentPlan[]>([]);
  const [courseRequests, setCourseRequests] = useState<CourseRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [topLearners, setTopLearners] = useState<TopLearner[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pendingValidations, setPendingValidations] = useState<Assignment[]>([]);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<Assignment[]>([]);
  const [certHolders, setCertHolders] = useState<CertificationHolder[]>([]);
  
  // Modal states
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showCreateCertification, setShowCreateCertification] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<DevelopmentPlan | null>(null);
  const [showCertHolders, setShowCertHolders] = useState<Certification | null>(null);
  const [showCreatePath, setShowCreatePath] = useState(false);
  const [showRequestCourse, setShowRequestCourse] = useState(false);
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [showCancelPlan, setShowCancelPlan] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [planToCancel, setPlanToCancel] = useState<DevelopmentPlan | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [assignmentToComplete, setAssignmentToComplete] = useState<Assignment | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Post-Training Eval states
  const [epfPending, setEpfPending] = useState<PostTrainingEval[]>([]);
  const [epfAll, setEpfAll] = useState<PostTrainingEval[]>([]);
  const [epfStats, setEpfStats] = useState<EpfStats | null>(null);
  const [epfSettings, setEpfSettings] = useState<EpfSettings | null>(null);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [selectedEpf, setSelectedEpf] = useState<PostTrainingEval | null>(null);
  const [evalCriteria, setEvalCriteria] = useState<CriteriaScore[]>([]);
  const [evalComments, setEvalComments] = useState('');
  const [evalStrengths, setEvalStrengths] = useState('');
  const [evalImprovements, setEvalImprovements] = useState('');
  const [showEpfDetail, setShowEpfDetail] = useState<PostTrainingEval | null>(null);
  const [showEpfHistory, setShowEpfHistory] = useState<EmployeeEvalHistory | null>(null);
  const [showEpfSettings, setShowEpfSettings] = useState(false);
  const [showAssignEvaluator, setShowAssignEvaluator] = useState<PostTrainingEval | null>(null);
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState('');
  const [epfSubTab, setEpfSubTab] = useState<'pending' | 'all' | 'history'>('pending');

  // Form states
  const [newCourse, setNewCourse] = useState({
    title: '', description: '', category: 'Technique', provider: '',
    external_url: '', duration_hours: '', level: 'beginner', image_emoji: '📚', 
    is_mandatory: false, requires_certificate: false
  });
  const [assignData, setAssignData] = useState({ employee_id: '', course_id: '', deadline: '' });
  const [validationData, setValidationData] = useState({ approved: true, rejection_reason: '' });
  const [newCertification, setNewCertification] = useState({ name: '', provider: '', description: '', validity_months: '' });
  const [newPath, setNewPath] = useState({ title: '', description: '', category: 'Technique', course_ids: [] as number[] });
  const [newPlan, setNewPlan] = useState({
    employee_id: '', current_role: '', target_role: '', target_date: '',
    skill_ids: [] as number[], course_ids: [] as number[]
  });
  const [editPlanData, setEditPlanData] = useState({
    target_role: '', target_date: '', skill_ids: [] as number[], course_ids: [] as number[]
  });
  const [newRequest, setNewRequest] = useState({
    title: '', description: '', reason: '', external_url: '', provider: '', for_employee_id: ''
  });
  const [newSkill, setNewSkill] = useState({ name: '', category: 'Technique', description: '' });

  const categories = ['Tous', 'Soft Skills', 'Technique', 'Management', 'Commercial', 'Innovation', 'Juridique'];
  const skillCategories = ['Technique', 'Soft Skills', 'Management', 'Métier'];

  // Init user
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserRole(user.role?.toLowerCase() || 'employee');
        setCurrentUserId(user.employee_id || null);
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  // Auth headers helper
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Helper pour les plans visibles selon le rôle
  const getVisiblePlans = useCallback(() => {
    if (hasPermission(userRole, 'view_all_plans')) {
      return developmentPlans;
    }
    const teamEmployeeIds = employees.map(e => e.id);
    return developmentPlans.filter(p => 
      p.employee_id === currentUserId || teamEmployeeIds.includes(p.employee_id)
    );
  }, [userRole, developmentPlans, employees, currentUserId]);


  const fetchCourses = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'Tous') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`${API_URL}/api/learning/courses/?${params}`, { headers: getAuthHeaders() });
      const data = await response.json();
      setCourses(data.items || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  }, [selectedCategory, searchQuery, getAuthHeaders]);

  const fetchLearningPaths = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/paths/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setLearningPaths(data || []);
    } catch (error) {
      console.error('Error fetching paths:', error);
    }
  }, [getAuthHeaders]);

  const fetchPendingValidations = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/?pending_validation=true`, { headers: getAuthHeaders() });
      const data = await response.json();
      setPendingValidations(data.items || []);
    } catch (error) {
      console.error('Error fetching pending validations:', error);
    }
  }, [getAuthHeaders]);

  const fetchCertifications = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/certifications/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setCertifications(data || []);
    } catch (error) {
      console.error('Error fetching certifications:', error);
    }
  }, [getAuthHeaders]);

  const fetchCertificationHolders = async (certId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/certifications/${certId}/holders`, { headers: getAuthHeaders() });
      const data = await response.json();
      setCertHolders(data || []);
    } catch (error) {
      console.error('Error fetching holders:', error);
    }
  };

  const fetchSkills = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/skills/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setSkills(data || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
    }
  }, [getAuthHeaders]);

  const fetchDevelopmentPlans = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setDevelopmentPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  }, [getAuthHeaders]);

  const fetchCourseRequests = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/requests/`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setCourseRequests(data || []);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  }, [getAuthHeaders]);

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, monthlyRes, categoryRes, learnersRes] = await Promise.all([
        fetch(`${API_URL}/api/learning/stats/`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/learning/stats/monthly`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/learning/stats/by-category`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/learning/stats/top-learners`, { headers: getAuthHeaders() })
      ]);
      
      setStats(await statsRes.json());
      setMonthlyStats(await monthlyRes.json());
      setCategoryStats(await categoryRes.json());
      setTopLearners(await learnersRes.json());
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [getAuthHeaders]);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees/my-team/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setEmployees(data.items || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, [getAuthHeaders]);

  const fetchMyAssignments = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/?my_assignments=true`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setMyAssignments(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching my assignments:', error);
    }
  }, [getAuthHeaders]);

  const fetchTeamAssignments = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/?team_assignments=true`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setTeamAssignments(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching team assignments:', error);
    }
  }, [getAuthHeaders]);

  const fetchEpfPending = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/pending`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setEpfPending(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching EPF pending:', error);
    }
  }, [getAuthHeaders]);

  const fetchEpfAll = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/?page_size=50`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setEpfAll(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching EPF all:', error);
    }
  }, [getAuthHeaders]);

  const fetchEpfStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/stats/overview`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setEpfStats(data);
      }
    } catch (error) {
      console.error('Error fetching EPF stats:', error);
    }
  }, [getAuthHeaders]);

  const fetchEpfSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/settings/config`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setEpfSettings(data);
      }
    } catch (error) {
      console.error('Error fetching EPF settings:', error);
    }
  }, [getAuthHeaders]);

  const fetchEmployeeHistory = async (employeeId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/history/${employeeId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setShowEpfHistory(data);
      }
    } catch (error) {
      console.error('Error fetching EPF history:', error);
    }
  };

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchCourses(), fetchLearningPaths(), fetchPendingValidations(), fetchMyAssignments(),
        fetchCertifications(), fetchSkills(), fetchDevelopmentPlans(), fetchCourseRequests(),
        fetchStats(), fetchEmployees(), fetchTeamAssignments(),
        fetchEpfPending(), fetchEpfAll(), fetchEpfStats(), fetchEpfSettings()
      ]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchCourses, fetchLearningPaths, fetchPendingValidations, fetchMyAssignments, fetchCertifications, fetchSkills, fetchDevelopmentPlans, fetchCourseRequests, fetchStats, fetchEmployees, fetchTeamAssignments, fetchEpfPending, fetchEpfAll, fetchEpfStats, fetchEpfSettings]);

  // Refresh courses on filter change
  useEffect(() => {
    if (!isLoading) fetchCourses();
  }, [selectedCategory, searchQuery, fetchCourses, isLoading]);

  // ============================================
  // ACTIONS - EMPLOYÉ
  // ============================================

  const startAssignment = async (assignmentId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/${assignmentId}/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        fetchMyAssignments();
        fetchTeamAssignments();
      } else {
        const error = await response.json();
        alert('Erreur: ' + (error.detail || 'Impossible de commencer'));
      }
    } catch (error) {
      console.error('Error starting assignment:', error);
    }
  };

  const uploadCertificateFile = async (assignmentId: number, file: File): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_URL}/api/learning/assignments/${assignmentId}/upload-certificate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
        body: formData
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error uploading certificate:', error);
      return false;
    }
  };

  const completeAssignment = async () => {
    if (!assignmentToComplete) return;
    
    setIsSubmitting(true);
    try {
      if (completionFile) {
        const uploaded = await uploadCertificateFile(assignmentToComplete.id, completionFile);
        if (!uploaded) {
          alert('Erreur lors de l\'upload du certificat');
          setIsSubmitting(false);
          return;
        }
      }
      
      if (assignmentToComplete.requires_certificate && !completionFile && !assignmentToComplete.certificate_file) {
        alert('Un certificat est requis pour cette formation');
        setIsSubmitting(false);
        return;
      }
      
      const response = await fetch(`${API_URL}/api/learning/assignments/${assignmentToComplete.id}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ completion_note: completionNote })
      });
      
      if (response.ok) {
        setShowCompleteModal(false);
        setAssignmentToComplete(null);
        setCompletionNote('');
        setCompletionFile(null);
        fetchMyAssignments();
        fetchTeamAssignments();
        fetchPendingValidations();
      } else {
        const error = await response.json();
        alert('Erreur: ' + (error.detail || 'Impossible de soumettre'));
      }
    } catch (error) {
      console.error('Error completing assignment:', error);
      alert('Erreur de connexion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCompleteModal = (assignment: Assignment) => {
    setAssignmentToComplete(assignment);
    setCompletionNote(assignment.completion_note || '');
    setCompletionFile(null);
    setShowCompleteModal(true);
  };

  // ============================================
  // ACTIONS - ADMIN/RH
  // ============================================

  const createCourse = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/courses/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newCourse,
          duration_hours: newCourse.duration_hours ? parseFloat(newCourse.duration_hours) : null
        })
      });
      
      if (response.ok) {
        setShowCreateCourse(false);
        setNewCourse({ title: '', description: '', category: 'Technique', provider: '', external_url: '', duration_hours: '', level: 'beginner', image_emoji: '📚', is_mandatory: false, requires_certificate: false });
        fetchCourses();
      }
    } catch (error) {
      console.error('Error creating course:', error);
    }
  };

  const createPath = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/paths/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newPath)
      });
      
      if (response.ok) {
        setShowCreatePath(false);
        setNewPath({ title: '', description: '', category: 'Technique', course_ids: [] });
        fetchLearningPaths();
      }
    } catch (error) {
      console.error('Error creating path:', error);
    }
  };

  const assignCourse = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          employee_id: parseInt(assignData.employee_id),
          course_id: parseInt(assignData.course_id),
          deadline: assignData.deadline || null
        })
      });
      
      if (response.ok) {
        setShowAssignModal(false);
        setAssignData({ employee_id: '', course_id: '', deadline: '' });
        fetchPendingValidations();
        fetchCourses();
        fetchTeamAssignments();
      } else {
        const error = await response.json();
        alert('Erreur: ' + (error.detail || 'Erreur'));
      }
    } catch (error) {
      console.error('Error assigning course:', error);
    }
  };

  const validateAssignment = async () => {
    if (!selectedAssignment) return;
    
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/${selectedAssignment.id}/validate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(validationData)
      });
      
      if (response.ok) {
        setShowValidationModal(false);
        setSelectedAssignment(null);
        setValidationData({ approved: true, rejection_reason: '' });
        fetchPendingValidations();
        fetchStats();
        fetchTeamAssignments();
        fetchMyAssignments();
      }
    } catch (error) {
      console.error('Error validating:', error);
    }
  };

  const createCertificationType = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/certifications/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newCertification,
          validity_months: newCertification.validity_months ? parseInt(newCertification.validity_months) : null
        })
      });
      
      if (response.ok) {
        setShowCreateCertification(false);
        setNewCertification({ name: '', provider: '', description: '', validity_months: '' });
        fetchCertifications();
      }
    } catch (error) {
      console.error('Error creating certification:', error);
    }
  };

  const createSkill = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/skills/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newSkill)
      });
      
      if (response.ok) {
        setShowCreateSkill(false);
        setNewSkill({ name: '', category: 'Technique', description: '' });
        fetchSkills();
      }
    } catch (error) {
      console.error('Error creating skill:', error);
    }
  };

  const createDevelopmentPlan = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newPlan,
          employee_id: parseInt(newPlan.employee_id)
        })
      });
      
      if (response.ok) {
        setShowCreatePlan(false);
        setNewPlan({ employee_id: '', current_role: '', target_role: '', target_date: '', skill_ids: [], course_ids: [] });
        fetchDevelopmentPlans();
        fetchTeamAssignments();
        fetchCourses();
      } else {
        const error = await response.json();
        alert('Erreur: ' + (error.detail || 'Erreur'));
      }
    } catch (error) {
      console.error('Error creating plan:', error);
    }
  };

  const openEditPlanModal = (plan: DevelopmentPlan) => {
    setSelectedPlan(plan);
    const currentSkillIds = plan.skills.map(s => s.id).filter(Boolean) as number[];
    const currentCourseIds = plan.courses.map(c => c.id).filter(Boolean) as number[];
    setEditPlanData({
      target_role: plan.targetRole || '',
      target_date: plan.target_date || '',
      skill_ids: currentSkillIds,
      course_ids: currentCourseIds
    });
    setShowEditPlan(true);
  };

  const updateDevelopmentPlan = async () => {
    if (!selectedPlan) return;
    
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/${selectedPlan.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          target_role: editPlanData.target_role,
          target_date: editPlanData.target_date || null,
          skill_ids: editPlanData.skill_ids,
          course_ids: editPlanData.course_ids
        })
      });
      
      if (response.ok) {
        setShowEditPlan(false);
        setSelectedPlan(null);
        setEditPlanData({ target_role: '', target_date: '', skill_ids: [], course_ids: [] });
        fetchDevelopmentPlans();
        fetchTeamAssignments();
        fetchCourses();
      } else {
        const errorData = await response.json();
        alert('Erreur: ' + (errorData.detail || 'Erreur inconnue'));
      }
    } catch (error) {
      console.error('Error updating plan:', error);
    }
  };

  const cancelDevelopmentPlan = async () => {
    if (!planToCancel || !cancelReason.trim()) return;
    
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/${planToCancel.id}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: cancelReason })
      });
      
      if (response.ok) {
        setShowCancelPlan(false);
        setPlanToCancel(null);
        setCancelReason('');
        fetchDevelopmentPlans();
      } else {
        const errorData = await response.json();
        alert('Erreur: ' + (errorData.detail || 'Impossible d\'annuler'));
      }
    } catch (error) {
      console.error('Error cancelling plan:', error);
    }
  };

  const archiveDevelopmentPlan = async (planId: number) => {
    if (!confirm('Voulez-vous archiver ce plan ?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/${planId}/archive`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        fetchDevelopmentPlans();
      } else {
        const errorData = await response.json();
        alert('Erreur: ' + (errorData.detail || 'Impossible d\'archiver'));
      }
    } catch (error) {
      console.error('Error archiving plan:', error);
    }
  };

  const submitCourseRequest = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/requests/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...newRequest,
          for_employee_id: newRequest.for_employee_id ? parseInt(newRequest.for_employee_id) : null
        })
      });
      
      if (response.ok) {
        setShowRequestCourse(false);
        setNewRequest({ title: '', description: '', reason: '', external_url: '', provider: '', for_employee_id: '' });
        fetchCourseRequests();
      }
    } catch (error) {
      console.error('Error submitting request:', error);
    }
  };

  const reviewCourseRequest = async (requestId: number, approved: boolean, comment: string) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/requests/${requestId}/review`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ approved, comment })
      });
      
      if (response.ok) {
        fetchCourseRequests();
      }
    } catch (error) {
      console.error('Error reviewing request:', error);
    }
  };


  // ============================================
  // ACTIONS EPF
  // ============================================

  const openEvalModal = (epf: PostTrainingEval) => {
    setSelectedEpf(epf);
    const criteria = epf.criteria_scores || epfSettings?.default_criteria || [
      { code: 'maitrise_theorique', label: 'Maîtrise théorique', score: 0, weight: 25 },
      { code: 'application_pratique', label: 'Application pratique', score: 0, weight: 25 },
      { code: 'participation', label: 'Participation & engagement', score: 0, weight: 25 },
      { code: 'comprehension_globale', label: 'Compréhension globale', score: 0, weight: 25 }
    ];
    setEvalCriteria(criteria.map(c => ({ ...c, score: c.score || 0 })));
    setEvalComments('');
    setEvalStrengths('');
    setEvalImprovements('');
    setShowEvalModal(true);
  };

  const computeWeightedScore = (criteria: CriteriaScore[]): number => {
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;
    const weighted = criteria.reduce((sum, c) => sum + (c.score * c.weight / totalWeight), 0);
    return Math.round(weighted * 10) / 10;
  };

  const submitEvaluation = async () => {
    if (!selectedEpf) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/${selectedEpf.id}/evaluate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          criteria_scores: evalCriteria,
          comments: evalComments || null,
          strengths: evalStrengths || null,
          improvements: evalImprovements || null
        })
      });
      if (response.ok) {
        setShowEvalModal(false);
        setSelectedEpf(null);
        fetchEpfPending();
        fetchEpfAll();
        fetchEpfStats();
      } else {
        const error = await response.json();
        alert('Erreur: ' + (error.detail || 'Impossible de soumettre'));
      }
    } catch (error) {
      console.error('Error submitting evaluation:', error);
      alert('Erreur de connexion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignEvaluator = async () => {
    if (!showAssignEvaluator || !selectedEvaluatorId) return;
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/${showAssignEvaluator.id}/assign-evaluator`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          evaluator_id: parseInt(selectedEvaluatorId),
          evaluator_type: 'internal'
        })
      });
      if (response.ok) {
        setShowAssignEvaluator(null);
        setSelectedEvaluatorId('');
        fetchEpfPending();
        fetchEpfAll();
      } else {
        const error = await response.json();
        alert('Erreur: ' + (error.detail || 'Erreur'));
      }
    } catch (error) {
      console.error('Error assigning evaluator:', error);
    }
  };

  const syncCareer = async (evalId: number) => {
    if (!confirm('Synchroniser ce score avec le module Carrière ?')) return;
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/${evalId}/sync-career`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        fetchEpfAll();
        alert('Score synchronisé avec le module Carrière');
      } else {
        const error = await response.json();
        alert('Erreur: ' + (error.detail || 'Erreur'));
      }
    } catch (error) {
      console.error('Error syncing career:', error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <>
        <Header title="Formation & Développement" subtitle="Chargement..." />
        <main className="flex-1 p-6 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
        </main>
      </>
    );
  }

  const pendingRequestsCount = courseRequests.filter(r => r.status === 'pending').length;
  const teamInProgressCount = teamAssignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length;

  return (
    <>
      <Header title="Formation & Développement" subtitle="Catalogue, parcours, certifications et plans de développement" />
      
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Formations</p><p className="text-2xl font-bold text-gray-900">{stats?.total_courses || 0}</p></div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">{hasPermission(userRole, 'view_analytics') ? 'Complétées (Mois)' : 'Mes complétées'}</p><p className="text-2xl font-bold text-green-600">{stats?.completed_this_month || 0}</p></div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">{hasPermission(userRole, 'view_analytics') ? 'Heures (Mois)' : 'Mes heures'}</p><p className="text-2xl font-bold text-purple-600">{stats?.hours_this_month || 0}h</p></div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-purple-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Certifications</p><p className="text-2xl font-bold text-orange-600">{stats?.total_certifications || 0}</p></div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Award className="w-5 h-5 text-orange-600" /></div>
            </div>
          </div>
          {hasPermission(userRole, 'validate_completion') && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-500">À Valider</p><p className="text-2xl font-bold text-amber-600">{stats?.pending_validation || 0}</p></div>
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto overflow-y-visible pt-2">
            <button onClick={() => setActiveTab('catalog')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'catalog' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <BookOpen className="w-4 h-4 inline mr-2" />Catalogue
            </button>
            <button onClick={() => setActiveTab('my-learning')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium relative ${activeTab === 'my-learning' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <User className="w-4 h-4 inline mr-2" />Mes Formations
              {myAssignments.filter(a => a.status === 'assigned' || a.status === 'in_progress').length > 0 && (
                <span className="absolute top-2 -right-1 min-w-5 h-5 px-1 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                  {myAssignments.filter(a => a.status === 'assigned' || a.status === 'in_progress').length}
                </span>
              )}
            </button>
            {hasPermission(userRole, 'view_team') && (
              <button onClick={() => setActiveTab('team')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium relative ${activeTab === 'team' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
                <UsersRound className="w-4 h-4 inline mr-2" />Mon Équipe
                {teamInProgressCount > 0 && (
                  <span className="absolute top-2 -right-1 min-w-5 h-5 px-1 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {teamInProgressCount}
                  </span>
                )}
              </button>
            )}
            <button onClick={() => setActiveTab('paths')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'paths' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Target className="w-4 h-4 inline mr-2" />Parcours
            </button>
            <button onClick={() => setActiveTab('certifications')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'certifications' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Award className="w-4 h-4 inline mr-2" />Certifications
            </button>
            <button onClick={() => setActiveTab('development')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'development' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <GraduationCap className="w-4 h-4 inline mr-2" />Plans Développement
            </button>
            {hasPermission(userRole, 'view_requests') && (
              <button onClick={() => setActiveTab('requests')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium relative ${activeTab === 'requests' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
                <MessageSquarePlus className="w-4 h-4 inline mr-2" />Demandes
                {pendingRequestsCount > 0 && (
                  <span className="absolute -top-1 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            )}
            {hasPermission(userRole, 'view_analytics') && (
              <button onClick={() => setActiveTab('analytics')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'analytics' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
                <BarChart3 className="w-4 h-4 inline mr-2" />Analytics
              </button>
            )}
            <button onClick={() => setActiveTab('post-eval')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium relative ${activeTab === 'post-eval' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <ClipboardCheck className="w-4 h-4 inline mr-2" />Éval. Post-Formation
              {epfPending.length > 0 && (
                <span className="absolute top-2 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {epfPending.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Pending Validations Alert */}
        {pendingValidations.length > 0 && hasPermission(userRole, 'validate_completion') && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">{pendingValidations.length} formation(s) en attente de validation</p>
              <p className="text-xs text-amber-600">Des employés ont terminé leurs formations</p>
            </div>
            <button 
              onClick={() => { setSelectedAssignment(pendingValidations[0]); setShowValidationModal(true); }}
              className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
            >
              Valider
            </button>
          </div>
        )}

        {/* TAB: Catalogue */}
        {activeTab === 'catalog' && (
          <div>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Rechercher une formation..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${selectedCategory === cat ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{cat}</button>
                ))}
              </div>
              {hasPermission(userRole, 'create_course') && (
                <button onClick={() => setShowCreateCourse(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4 mr-2" />Ajouter
                </button>
              )}
              {hasPermission(userRole, 'assign_course') && (
                <button onClick={() => setShowAssignModal(true)} className="flex items-center px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600">
                  <User className="w-4 h-4 mr-2" />Assigner
                </button>
              )}
              {hasPermission(userRole, 'request_course') && (
                <button onClick={() => setShowRequestCourse(true)} className="flex items-center px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600">
                  <MessageSquarePlus className="w-4 h-4 mr-2" />Demander
                </button>
              )}
            </div>

            {courses.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune formation trouvée</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {courses.map((course) => (
                  <div key={course.id} onClick={() => setSelectedCourse(course)} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                    <div className="h-32 bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-5xl relative">
                      {course.image_emoji || '📚'}
                      {course.is_mandatory && <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded">Obligatoire</span>}
                      {course.requires_certificate && <span className="absolute top-2 left-2 px-2 py-0.5 bg-purple-500 text-white text-xs font-medium rounded flex items-center gap-1"><FileWarning className="w-3 h-3" />Certif.</span>}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Eye className="w-12 h-12 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(course.level)}`}>{getLevelLabel(course.level)}</span>
                        <span className="text-xs text-gray-500">{course.duration_hours}h</span>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2">{course.title}</h4>
                      <p className="text-xs text-gray-500 mb-3">{course.provider || 'Interne'}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm">
                          <Users className="w-4 h-4 text-gray-400 mr-1" />
                          <span className="text-gray-600">{course.enrolled}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{course.completion_rate}%</span>
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${course.completion_rate}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Mes Formations */}
        {activeTab === 'my-learning' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Mes Formations Assignées</h3>
            </div>
            
            {myAssignments.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune formation assignée</p>
                <p className="text-sm text-gray-400 mt-2">Consultez le catalogue pour découvrir les formations disponibles</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {/* À commencer */}
                {myAssignments.filter(a => a.status === 'assigned').length > 0 && (
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                      À commencer ({myAssignments.filter(a => a.status === 'assigned').length})
                    </h4>
                    <div className="space-y-3">
                      {myAssignments.filter(a => a.status === 'assigned').map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{assignment.course_image || '📚'}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{assignment.course_title}</p>
                                {assignment.requires_certificate && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded flex items-center gap-1">
                                    <FileWarning className="w-3 h-3" />Certif. requis
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{assignment.course_duration}h • Deadline: {assignment.deadline || 'Non définie'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {assignment.course_external_url && (
                              <a href={assignment.course_external_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2 bg-white text-primary-600 rounded-lg hover:bg-primary-50 border border-primary-200" title="Accéder à la formation">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <button onClick={() => startAssignment(assignment.id)} className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 flex items-center gap-2">
                              <Play className="w-4 h-4" />Commencer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* En cours */}
                {myAssignments.filter(a => a.status === 'in_progress').length > 0 && (
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      En cours ({myAssignments.filter(a => a.status === 'in_progress').length})
                    </h4>
                    <div className="space-y-3">
                      {myAssignments.filter(a => a.status === 'in_progress').map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{assignment.course_image || '📚'}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{assignment.course_title}</p>
                                {assignment.requires_certificate && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded flex items-center gap-1">
                                    <FileWarning className="w-3 h-3" />Certif. requis
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{assignment.course_duration}h • Deadline: {assignment.deadline || 'Non définie'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {assignment.course_external_url && (
                              <a href={assignment.course_external_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2 bg-white text-primary-600 rounded-lg hover:bg-primary-50 border border-primary-200" title="Continuer la formation">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <button onClick={() => openCompleteModal(assignment)} className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 flex items-center gap-2">
                              <FileCheck className="w-4 h-4" />Terminer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* En attente de validation */}
                {myAssignments.filter(a => a.status === 'pending_validation').length > 0 && (
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
                      En attente de validation ({myAssignments.filter(a => a.status === 'pending_validation').length})
                    </h4>
                    <div className="space-y-3">
                      {myAssignments.filter(a => a.status === 'pending_validation').map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{assignment.course_image || '📚'}</span>
                            <div>
                              <p className="font-medium text-gray-900">{assignment.course_title}</p>
                              <p className="text-sm text-gray-500">Soumis le {assignment.completed_at}</p>
                              {assignment.certificate_file && (
                                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                  <FileCheck className="w-3 h-3" />Certificat uploadé
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => openCompleteModal(assignment)} className="px-3 py-1.5 bg-white text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 border border-gray-300 flex items-center gap-1">
                              <Edit className="w-4 h-4" />Modifier
                            </button>
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full flex items-center gap-1">
                              <Clock className="w-4 h-4" />En attente
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejetées */}
                {myAssignments.filter(a => a.status === 'rejected').length > 0 && (
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                      Rejetées ({myAssignments.filter(a => a.status === 'rejected').length})
                    </h4>
                    <div className="space-y-3">
                      {myAssignments.filter(a => a.status === 'rejected').map((assignment) => (
                        <div key={assignment.id} className="p-4 bg-red-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{assignment.course_image || '📚'}</span>
                              <div>
                                <p className="font-medium text-gray-900">{assignment.course_title}</p>
                                {assignment.rejection_reason && (
                                  <p className="text-sm text-red-600">Raison: {assignment.rejection_reason}</p>
                                )}
                              </div>
                            </div>
                            <button onClick={() => openCompleteModal(assignment)} className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                              Resoumettre
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Complétées */}
                {myAssignments.filter(a => a.status === 'completed').length > 0 && (
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      Complétées ({myAssignments.filter(a => a.status === 'completed').length})
                    </h4>
                    <div className="space-y-3">
                      {myAssignments.filter(a => a.status === 'completed').map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{assignment.course_image || '📚'}</span>
                            <div>
                              <p className="font-medium text-gray-900">{assignment.course_title}</p>
                              <p className="text-sm text-gray-500">Validé le {assignment.completed_at}</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />Validé
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: Mon Équipe (NOUVEAU) */}
        {activeTab === 'team' && hasPermission(userRole, 'view_team') && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Formations de mon équipe</h3>
              <p className="text-sm text-gray-500">{employees.length} membre(s)</p>
            </div>
            
            {teamAssignments.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <UsersRound className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune formation assignée à votre équipe</p>
              </div>
            ) : (
              <div className="space-y-4">
                {employees.map((emp) => {
                  const empAssignments = teamAssignments.filter(a => a.employee_id === emp.id);
                  if (empAssignments.length === 0) return null;
                  
                  const inProgress = empAssignments.filter(a => a.status === 'in_progress' || a.status === 'assigned').length;
                  const pending = empAssignments.filter(a => a.status === 'pending_validation').length;
                  const completed = empAssignments.filter(a => a.status === 'completed').length;
                  
                  return (
                    <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{emp.first_name} {emp.last_name}</p>
                            <p className="text-sm text-gray-500">{emp.job_title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {inProgress > 0 && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{inProgress} en cours</span>}
                          {pending > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">{pending} à valider</span>}
                          {completed > 0 && <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">{completed} terminé(s)</span>}
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        {empAssignments.map((a) => (
                          <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg ${
                            a.status === 'pending_validation' ? 'bg-amber-50' : 
                            a.status === 'completed' ? 'bg-green-50' : 
                            a.status === 'rejected' ? 'bg-red-50' : 'bg-gray-50'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{a.course_image || '📚'}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{a.course_title}</p>
                                <p className="text-xs text-gray-500">{a.course_duration}h • Deadline: {a.deadline || 'Non définie'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(a.status)}`}>
                                {getStatusLabel(a.status)}
                              </span>
                              {a.status === 'pending_validation' && (
                                <button 
                                  onClick={() => { setSelectedAssignment(a); setShowValidationModal(true); }}
                                  className="px-3 py-1 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600"
                                >
                                  Valider
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: Parcours */}
        {activeTab === 'paths' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Parcours de Formation</h3>
              {hasPermission(userRole, 'create_path') && (
                <button onClick={() => setShowCreatePath(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4 mr-2" />Créer un Parcours
                </button>
              )}
            </div>
            
            {learningPaths.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucun parcours créé</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {learningPaths.map((path) => (
                  <div key={path.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                        <Target className="w-6 h-6 text-primary-600" />
                      </div>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">{path.category}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{path.title}</h4>
                    <p className="text-sm text-gray-500 mb-4">{path.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <span className="flex items-center"><BookOpen className="w-4 h-4 mr-1" />{path.courses_count} cours</span>
                      <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{path.duration_hours}h</span>
                      <span className="flex items-center"><Users className="w-4 h-4 mr-1" />{path.assigned_count} assignés</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Progression moyenne</span>
                          <span className="font-medium">{path.progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div className={`h-full rounded-full ${path.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${path.progress}%` }} />
                        </div>
                      </div>
                      <button className="text-primary-600 hover:text-primary-700"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Certifications */}
        {activeTab === 'certifications' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Gestion des Certifications</h3>
              {hasPermission(userRole, 'create_certification') && (
                <button onClick={() => setShowCreateCertification(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4 mr-2" />Ajouter Certification
                </button>
              )}
            </div>

            {stats?.expiring_certifications && stats.expiring_certifications > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800">{stats.expiring_certifications} certifications expirent dans les 3 prochains mois</p>
                </div>
              </div>
            )}

            {certifications.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune certification créée</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {certifications.map((cert) => (
                  <div key={cert.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md" onClick={() => { setShowCertHolders(cert); fetchCertificationHolders(cert.id); }}>
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Award className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{cert.name}</h4>
                            <p className="text-sm text-gray-500">{cert.provider}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{cert.total_holders}</p>
                          <p className="text-xs text-gray-500">titulaires</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Validité: {cert.validity_months ? `${cert.validity_months} mois` : 'Permanent'}</span>
                        {cert.expiring_soon > 0 && <span className="text-xs text-orange-600 flex items-center"><AlertTriangle className="w-3 h-3 mr-1" />{cert.expiring_soon} expiration(s)</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Plans Développement */}
        {activeTab === 'development' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Plans de Développement Individuels</h3>
              {hasPermission(userRole, 'create_plan') && (
                <button onClick={() => setShowCreatePlan(true)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                  <Plus className="w-4 h-4 mr-2" />Créer un Plan
                </button>
              )}
            </div>
            
            {getVisiblePlans().length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucun plan de développement</p>
              </div>
            ) : (
              getVisiblePlans().map((plan) => (
                <div key={plan.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${plan.status === 'cancelled' ? 'border-red-200 bg-red-50/30' : plan.status === 'archived' ? 'border-gray-200 bg-gray-50/50' : 'border-gray-100'}`}>
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${plan.status === 'cancelled' ? 'bg-red-100 text-red-700' : plan.status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-primary-100 text-primary-700'}`}>
                          {plan.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">{plan.employee}</h4>
                            {plan.status && plan.status !== 'active' && (
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPlanStatusColor(plan.status)}`}>
                                {getStatusLabel(plan.status)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{plan.role}</span>
                            <ArrowRight className="w-4 h-4" />
                            <span className="text-primary-600 font-medium">{plan.targetRole}</span>
                          </div>
                          {plan.status === 'cancelled' && plan.cancellation_reason && (
                            <p className="text-xs text-red-600 mt-1">Motif: {plan.cancellation_reason}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`text-3xl font-bold ${plan.status === 'cancelled' ? 'text-red-400' : plan.status === 'archived' ? 'text-gray-400' : 'text-primary-600'}`}>{plan.progress}%</p>
                          <p className="text-xs text-gray-500">progression</p>
                        </div>
                        {hasPermission(userRole, 'create_plan') && plan.status !== 'cancelled' && plan.status !== 'archived' && (
                          <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); openEditPlanModal(plan); }} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Modifier">
                              <Edit className="w-5 h-5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); archiveDevelopmentPlan(plan.id); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Archiver">
                              <Archive className="w-5 h-5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setPlanToCancel(plan); setCancelReason(''); setShowCancelPlan(true); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Annuler">
                              <Ban className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`p-5 grid md:grid-cols-2 gap-6 ${plan.status === 'cancelled' || plan.status === 'archived' ? 'opacity-60' : ''}`}>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-3">Compétences à développer</h5>
                      {plan.skills.length === 0 ? (
                        <p className="text-sm text-gray-400">Aucune compétence définie</p>
                      ) : (
                        <div className="space-y-3">
                          {plan.skills.map((skill, i) => (
                            <div key={i}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">{skill.name}</span>
                                <span className="font-medium">{skill.current}% → {skill.target}%</span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full relative">
                                <div className="absolute h-full bg-gray-400 rounded-full" style={{ width: `${skill.target}%` }} />
                                <div className="absolute h-full bg-primary-500 rounded-full" style={{ width: `${skill.current}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-3">Formations assignées</h5>
                      {plan.courses.length === 0 ? (
                        <p className="text-sm text-gray-400">Aucune formation assignée</p>
                      ) : (
                        <div className="space-y-2">
                          {plan.courses.map((course, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <span className="text-sm text-gray-900">{course.title}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(course.status)}`}>
                                {getStatusLabel(course.status)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Demandes */}
        {activeTab === 'requests' && hasPermission(userRole, 'view_requests') && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Demandes de Formation</h3>
            </div>
            
            {courseRequests.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <MessageSquarePlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune demande de formation</p>
              </div>
            ) : (
              <div className="space-y-4">
                {courseRequests.map((request) => (
                  <div key={request.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold">
                          {request.requested_by_initials}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{request.title}</h4>
                          <p className="text-sm text-gray-500 mb-2">
                            Demandé par {request.requested_by_name}
                            {request.for_employee_name && ` pour ${request.for_employee_name}`}
                          </p>
                          {request.description && <p className="text-sm text-gray-600 mb-2">{request.description}</p>}
                          {request.reason && <p className="text-sm text-gray-500 italic">&quot;{request.reason}&quot;</p>}
                          {request.external_url && (
                            <a href={request.external_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-2">
                              <ExternalLink className="w-3 h-3" />Lien suggéré
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
                          {getStatusLabel(request.status)}
                        </span>
                        {request.status === 'pending' && (
                          <div className="flex gap-2 ml-4">
                            <button onClick={() => reviewCourseRequest(request.id, true, '')} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Approuver">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => reviewCourseRequest(request.id, false, 'Formation non disponible')} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Rejeter">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Analytics */}
        {activeTab === 'analytics' && hasPermission(userRole, 'view_analytics') && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Formations Complétées par Mois</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyStats}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="completions" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Répartition par Catégorie</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryStats} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                      {categoryStats.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Heures de Formation par Mois</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyStats}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">🏆 Top Apprenants</h3>
              <div className="space-y-3">
                {topLearners.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune donnée disponible</p>
                ) : (
                  topLearners.map((learner, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center text-xs font-bold text-yellow-700">{i + 1}</span>
                        <span className="font-medium text-gray-900">{learner.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary-600">{learner.hours}h</p>
                        <p className="text-xs text-gray-500">{learner.courses} cours</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Évaluation Post-Formation */}
        {activeTab === 'post-eval' && (
          <div className="space-y-6">
            {/* Stats EPF */}
            {epfStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">En attente</p><p className="text-2xl font-bold text-amber-600">{epfStats.pending}</p></div>
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">Complétées</p><p className="text-2xl font-bold text-green-600">{epfStats.completed}</p></div>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">Score moyen</p><p className="text-2xl font-bold text-primary-600">{epfStats.avg_score}/100</p></div>
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-primary-600" /></div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-500">Taux validation</p><p className="text-2xl font-bold text-blue-600">{epfStats.validation_rate}%</p></div>
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Award className="w-5 h-5 text-blue-600" /></div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="flex gap-2 items-center">
              <button onClick={() => setEpfSubTab('pending')} className={`px-4 py-2 text-sm font-medium rounded-lg ${epfSubTab === 'pending' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                En attente ({epfPending.length})
              </button>
              <button onClick={() => setEpfSubTab('all')} className={`px-4 py-2 text-sm font-medium rounded-lg ${epfSubTab === 'all' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                Toutes
              </button>
              <button onClick={() => setEpfSubTab('history')} className={`px-4 py-2 text-sm font-medium rounded-lg ${epfSubTab === 'history' ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                Historique
              </button>
              {hasPermission(userRole, 'view_analytics') && (
                <button onClick={() => { fetchEpfSettings(); setShowEpfSettings(true); }} className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Paramètres EPF">
                  <Settings className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Sub-tab: En attente */}
            {epfSubTab === 'pending' && (
              <div className="space-y-4">
                {epfPending.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center">
                    <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucune évaluation en attente</p>
                    <p className="text-sm text-gray-400 mt-1">Les évaluations apparaissent ici quand une formation est validée</p>
                  </div>
                ) : (
                  epfPending.map((epf) => (
                    <div key={epf.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">{epf.course_emoji}</div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{epf.course_title}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-bold">
                                  {epf.employee_initials}
                                </div>
                                <span className="text-sm text-gray-600">{epf.employee_name}</span>
                              </div>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-sm text-gray-500">{epf.course_category}</span>
                            </div>
                            {epf.scheduled_date && (
                              <p className="text-xs text-gray-400 mt-1">Prévue: {epf.scheduled_date} • Limite: {epf.due_date}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {epf.evaluator_name ? (
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Évaluateur</p>
                              <p className="text-sm font-medium text-gray-700">{epf.evaluator_name}</p>
                            </div>
                          ) : (
                            <button onClick={() => { setShowAssignEvaluator(epf); setSelectedEvaluatorId(''); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 flex items-center gap-1">
                              <User className="w-4 h-4" />Assigner
                            </button>
                          )}
                          <button onClick={() => openEvalModal(epf)} className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 flex items-center gap-2">
                            <ClipboardCheck className="w-4 h-4" />Évaluer
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Sub-tab: Toutes les évaluations */}
            {epfSubTab === 'all' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Formation</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Collaborateur</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Évaluateur</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Score</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Statut</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Recommandation</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {epfAll.map((epf) => (
                        <tr key={epf.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{epf.course_emoji}</span>
                              <span className="text-sm font-medium text-gray-900 truncate max-w-48">{epf.course_title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-bold">{epf.employee_initials}</div>
                              <span className="text-sm text-gray-700">{epf.employee_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{epf.evaluator_name || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {epf.score !== null ? (
                              <span className={`text-sm font-bold ${getScoreColor(epf.score, epfStats?.passing_threshold || 70)}`}>
                                {epf.score}/100
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEpfStatusColor(epf.status)}`}>
                              {getEpfStatusLabel(epf.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRecommendationColor(epf.recommendation)}`}>
                              {getRecommendationLabel(epf.recommendation)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => setShowEpfDetail(epf)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded" title="Détail">
                                <Eye className="w-4 h-4" />
                              </button>
                              {epf.status === 'pending' && (
                                <button onClick={() => openEvalModal(epf)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Évaluer">
                                  <ClipboardCheck className="w-4 h-4" />
                                </button>
                              )}
                              {epf.status === 'completed' && !epf.career_synced && hasPermission(userRole, 'view_analytics') && (
                                <button onClick={() => syncCareer(epf.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Sync Carrière">
                                  <Zap className="w-4 h-4" />
                                </button>
                              )}
                              {epf.career_synced && (
                                <span className="p-1.5 text-green-500" title="Synchronisé">
                                  <Link className="w-4 h-4" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab: Historique par employé */}
            {epfSubTab === 'history' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-3">Sélectionner un collaborateur</h4>
                  <div className="flex gap-3">
                    <select
                      onChange={(e) => { if (e.target.value) fetchEmployeeHistory(parseInt(e.target.value)); }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Choisir un collaborateur...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {showEpfHistory && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">{showEpfHistory.employee_name}</h4>
                        <span className="text-2xl">{getTrendIcon(showEpfHistory.summary.trend)}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-gray-900">{showEpfHistory.summary.total_evaluations}</p>
                          <p className="text-xs text-gray-500">Évaluations</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-primary-600">{showEpfHistory.summary.avg_score}</p>
                          <p className="text-xs text-gray-500">Score moyen</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{showEpfHistory.summary.validation_rate}%</p>
                          <p className="text-xs text-gray-500">Taux validation</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">{showEpfHistory.summary.retrain_count}</p>
                          <p className="text-xs text-gray-500">Re-formations</p>
                        </div>
                      </div>
                    </div>

                    {showEpfHistory.evaluations.length > 1 && (
                      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <h4 className="font-semibold text-gray-900 mb-4">Tendance des scores</h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={showEpfHistory.evaluations.map((e) => ({
                              name: e.course_title?.substring(0, 15) + '...',
                              score: e.score,
                              seuil: epfStats?.passing_threshold || 70
                            }))}>
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                              <YAxis domain={[0, 100]} />
                              <Tooltip />
                              <Line type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2} dot={{ fill: '#6366F1', r: 4 }} />
                              <Line type="monotone" dataKey="seuil" stroke="#EF4444" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-gray-400 text-center mt-2">Ligne rouge: seuil de validation ({epfStats?.passing_threshold || 70}/100)</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {showEpfHistory.evaluations.map((epf) => (
                        <div key={epf.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{epf.course_emoji}</span>
                              <div>
                                <p className="font-medium text-gray-900">{epf.course_title}</p>
                                <p className="text-xs text-gray-500">{epf.completed_at ? new Date(epf.completed_at).toLocaleDateString('fr-FR') : ''} • Éval: {epf.evaluator_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`text-xl font-bold ${getScoreColor(epf.score || 0, epfStats?.passing_threshold || 70)}`}>{epf.score}/100</p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRecommendationColor(epf.recommendation)}`}>
                                {getRecommendationLabel(epf.recommendation)}
                              </span>
                              <button onClick={() => setShowEpfDetail(epf)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================
           MODALS
        ============================================ */}

        {/* Modal: Compléter/Resoumettre formation */}
        {showCompleteModal && assignmentToComplete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    {assignmentToComplete.status === 'pending_validation' ? 'Modifier la soumission' : 
                     assignmentToComplete.status === 'rejected' ? 'Resoumettre' : 'Terminer la formation'}
                  </h2>
                  <button onClick={() => { setShowCompleteModal(false); setAssignmentToComplete(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <span className="text-2xl">{assignmentToComplete.course_image || '📚'}</span>
                  <div>
                    <p className="font-medium text-gray-900">{assignmentToComplete.course_title}</p>
                    <p className="text-sm text-gray-500">{assignmentToComplete.course_duration}h</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note (optionnel)</label>
                  <textarea value={completionNote} onChange={(e) => setCompletionNote(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} placeholder="Commentaires sur la formation..." />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Certificat/Justificatif {assignmentToComplete.requires_certificate ? <span className="text-red-500">*</span> : '(optionnel)'}
                  </label>
                  {assignmentToComplete.certificate_file && !completionFile && (
                    <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700">Certificat déjà uploadé: {assignmentToComplete.certificate_filename}</span>
                    </div>
                  )}
                  <div className={`border-2 border-dashed rounded-lg p-4 text-center ${assignmentToComplete.requires_certificate && !assignmentToComplete.certificate_file ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}>
                    <input type="file" id="certificate-upload" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setCompletionFile(e.target.files?.[0] || null)} />
                    {completionFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileCheck className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-700">{completionFile.name}</span>
                        <button onClick={() => setCompletionFile(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <label htmlFor="certificate-upload" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Cliquez pour uploader</p>
                        <p className="text-xs text-gray-400">PDF, PNG, JPG (max 5MB)</p>
                      </label>
                    )}
                  </div>
                  {assignmentToComplete.requires_certificate && !assignmentToComplete.certificate_file && !completionFile && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Un certificat est requis</p>
                  )}
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800"><AlertTriangle className="w-4 h-4 inline mr-1" />Votre manager/RH devra valider la complétion.</p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => { setShowCompleteModal(false); setAssignmentToComplete(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={completeAssignment} disabled={isSubmitting || (assignmentToComplete.requires_certificate && !assignmentToComplete.certificate_file && !completionFile)} className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Soumettre
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Détail Course */}
        {selectedCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="relative h-48 bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <span className="text-7xl">{selectedCourse.image_emoji || '📚'}</span>
                <button onClick={() => setSelectedCourse(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg"><X className="w-5 h-5 text-white" /></button>
                {selectedCourse.is_mandatory && <span className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-lg">Obligatoire</span>}
                {selectedCourse.requires_certificate && <span className="absolute top-4 left-28 px-3 py-1 bg-purple-500 text-white text-sm font-medium rounded-lg flex items-center gap-1"><FileWarning className="w-4 h-4" />Certificat requis</span>}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(selectedCourse.level)}`}>{getLevelLabel(selectedCourse.level)}</span>
                  <span className="text-sm text-gray-500">{selectedCourse.category}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedCourse.title}</h2>
                <p className="text-gray-600 mb-4">{selectedCourse.description}</p>
                <div className="flex items-center gap-6 mb-6 text-sm text-gray-500">
                  <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{selectedCourse.duration_hours}h</span>
                  <span className="flex items-center"><User className="w-4 h-4 mr-1" />{selectedCourse.provider || 'Interne'}</span>
                  <span className="flex items-center"><Users className="w-4 h-4 mr-1" />{selectedCourse.enrolled} inscrits</span>
                </div>
                {selectedCourse.external_url && (
                  <a href={selectedCourse.external_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6">
                    <ExternalLink className="w-4 h-4" />Accéder à la formation externe
                  </a>
                )}
                {hasPermission(userRole, 'assign_course') && (
                  <button onClick={() => { setAssignData({ ...assignData, course_id: selectedCourse.id.toString() }); setSelectedCourse(null); setShowAssignModal(true); }} className="w-full flex items-center justify-center px-4 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600">
                    <User className="w-5 h-5 mr-2" />Assigner à un employé
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Créer Formation */}
        {showCreateCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Nouvelle Formation</h2>
                  <button onClick={() => setShowCreateCourse(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                  <input type="text" value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: Leadership & Management" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select value={newCourse.category} onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="Soft Skills">Soft Skills</option>
                      <option value="Technique">Technique</option>
                      <option value="Management">Management</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Innovation">Innovation</option>
                      <option value="Juridique">Juridique</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
                    <select value={newCourse.level} onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="beginner">Débutant</option>
                      <option value="intermediate">Intermédiaire</option>
                      <option value="advanced">Avancé</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durée (heures)</label>
                    <input type="number" value={newCourse.duration_hours} onChange={(e) => setNewCourse({ ...newCourse, duration_hours: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="8" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
                    <input type="text" value={newCourse.image_emoji} onChange={(e) => setNewCourse({ ...newCourse, image_emoji: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="📚" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                  <input type="text" value={newCourse.provider} onChange={(e) => setNewCourse({ ...newCourse, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Coursera, Udemy..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL externe</label>
                  <input type="url" value={newCourse.external_url} onChange={(e) => setNewCourse({ ...newCourse, external_url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="mandatory" checked={newCourse.is_mandatory} onChange={(e) => setNewCourse({ ...newCourse, is_mandatory: e.target.checked })} className="rounded" />
                    <label htmlFor="mandatory" className="text-sm text-gray-700">Formation obligatoire</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="requires_certificate" checked={newCourse.requires_certificate} onChange={(e) => setNewCourse({ ...newCourse, requires_certificate: e.target.checked })} className="rounded" />
                    <label htmlFor="requires_certificate" className="text-sm text-gray-700 flex items-center gap-1">
                      <FileWarning className="w-4 h-4 text-purple-600" />Certificat requis pour validation
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreateCourse(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createCourse} disabled={!newCourse.title} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Assigner */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Assigner une Formation</h2>
                  <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label>
                  <select value={assignData.employee_id} onChange={(e) => setAssignData({ ...assignData, employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Sélectionner...</option>
                    {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} - {emp.job_title}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Formation *</label>
                  <select value={assignData.course_id} onChange={(e) => setAssignData({ ...assignData, course_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Sélectionner...</option>
                    {courses.map((course) => (<option key={course.id} value={course.id}>{course.title}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date limite (optionnel)</label>
                  <input type="date" value={assignData.deadline} onChange={(e) => setAssignData({ ...assignData, deadline: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={assignCourse} disabled={!assignData.employee_id || !assignData.course_id} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Assigner</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Validation */}
        {showValidationModal && selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Valider la Formation</h2>
                  <button onClick={() => setShowValidationModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">{selectedAssignment.employee_initials}</div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedAssignment.employee_name}</p>
                    <p className="text-sm text-gray-500">{selectedAssignment.course_title}</p>
                  </div>
                </div>
                {selectedAssignment.completion_note && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Note de l&apos;employé:</p>
                    <p className="text-sm text-gray-700">{selectedAssignment.completion_note}</p>
                  </div>
                )}
                {selectedAssignment.certificate_file && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700">{selectedAssignment.certificate_filename}</span>
                    <a href={`${API_URL}${selectedAssignment.certificate_file}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-blue-600 hover:underline text-sm">Voir</a>
                  </div>
                )}
                {selectedAssignment.requires_certificate && !selectedAssignment.certificate_file && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">Certificat requis mais non fourni!</span>
                  </div>
                )}
                <div className="flex gap-3 mb-4">
                  <button onClick={() => setValidationData({ ...validationData, approved: true })} className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${validationData.approved ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                    <Check className="w-5 h-5" />Approuver
                  </button>
                  <button onClick={() => setValidationData({ ...validationData, approved: false })} className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${!validationData.approved ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
                    <XCircle className="w-5 h-5" />Rejeter
                  </button>
                </div>
                {!validationData.approved && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Raison du rejet</label>
                    <textarea value={validationData.rejection_reason} onChange={(e) => setValidationData({ ...validationData, rejection_reason: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Expliquez..." />
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowValidationModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={validateAssignment} className={`flex-1 px-4 py-2 text-white rounded-lg ${validationData.approved ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                  {validationData.approved ? 'Approuver' : 'Rejeter'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Créer Certification */}
        {showCreateCertification && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Nouvelle Certification</h2>
                  <button onClick={() => setShowCreateCertification(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label><input type="text" value={newCertification.name} onChange={(e) => setNewCertification({ ...newCertification, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="AWS Solutions Architect" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label><input type="text" value={newCertification.provider} onChange={(e) => setNewCertification({ ...newCertification, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Amazon" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newCertification.description} onChange={(e) => setNewCertification({ ...newCertification, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Validité (mois)</label><input type="number" value={newCertification.validity_months} onChange={(e) => setNewCertification({ ...newCertification, validity_months: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Permanent si vide" /></div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreateCertification(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createCertificationType} disabled={!newCertification.name} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Cert Holders */}
        {showCertHolders && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-center justify-between">
                  <div><h2 className="text-xl font-bold text-gray-900">{showCertHolders.name}</h2><p className="text-sm text-gray-500">{showCertHolders.provider}</p></div>
                  <button onClick={() => setShowCertHolders(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Titulaires ({certHolders.length})</h3>
                {certHolders.length === 0 ? (<p className="text-gray-500 text-center py-8">Aucun titulaire</p>) : (
                  <div className="space-y-3">
                    {certHolders.map((holder) => (
                      <div key={holder.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">{holder.employee_initials}</div>
                          <div><p className="font-medium text-gray-900">{holder.employee_name}</p><p className="text-xs text-gray-500">Obtenue le {holder.obtained_date}</p></div>
                        </div>
                        <div className="text-right"><p className={`text-sm font-medium ${getCertStatusColor(holder.status)}`}>{holder.status === 'expiring' && <AlertTriangle className="w-3 h-3 inline mr-1" />}{holder.expiry_date}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Créer Plan */}
        {showCreatePlan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Nouveau Plan de Développement</h2><button onClick={() => setShowCreatePlan(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label><select value={newPlan.employee_id} onChange={(e) => setNewPlan({ ...newPlan, employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Sélectionner...</option>{employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>))}</select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Poste actuel</label><input type="text" value={newPlan.current_role} onChange={(e) => setNewPlan({ ...newPlan, current_role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Poste cible</label><input type="text" value={newPlan.target_role} onChange={(e) => setNewPlan({ ...newPlan, target_role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date cible</label><input type="date" value={newPlan.target_date} onChange={(e) => setNewPlan({ ...newPlan, target_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                <div>
                  <div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">Compétences</label><button onClick={() => setShowCreateSkill(true)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center"><Plus className="w-3 h-3 mr-1" />Ajouter</button></div>
                  {skills.length === 0 ? (<div className="text-center py-4 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Aucune compétence</p></div>) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {skills.map((skill) => (<label key={skill.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"><input type="checkbox" checked={newPlan.skill_ids.includes(skill.id)} onChange={(e) => { if (e.target.checked) { setNewPlan({ ...newPlan, skill_ids: [...newPlan.skill_ids, skill.id] }); } else { setNewPlan({ ...newPlan, skill_ids: newPlan.skill_ids.filter(id => id !== skill.id) }); } }} className="rounded" /><span className="text-sm text-gray-700">{skill.name}</span><span className="text-xs text-gray-400">({skill.category})</span></label>))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formations à assigner</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {courses.map((course) => (<label key={course.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"><input type="checkbox" checked={newPlan.course_ids.includes(course.id)} onChange={(e) => { if (e.target.checked) { setNewPlan({ ...newPlan, course_ids: [...newPlan.course_ids, course.id] }); } else { setNewPlan({ ...newPlan, course_ids: newPlan.course_ids.filter(id => id !== course.id) }); } }} className="rounded" /><span className="text-sm text-gray-700">{course.title}</span></label>))}
                  </div>
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Les formations seront automatiquement assignées</p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreatePlan(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createDevelopmentPlan} disabled={!newPlan.employee_id} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Edit Plan */}
        {showEditPlan && selectedPlan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Modifier le Plan</h2><button onClick={() => { setShowEditPlan(false); setSelectedPlan(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"><div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">{selectedPlan.initials}</div><div><p className="font-medium text-gray-900">{selectedPlan.employee}</p><p className="text-sm text-gray-500">{selectedPlan.role}</p></div></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Poste cible</label><input type="text" value={editPlanData.target_role} onChange={(e) => setEditPlanData({ ...editPlanData, target_role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date cible</label><input type="date" value={editPlanData.target_date} onChange={(e) => setEditPlanData({ ...editPlanData, target_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                <div>
                  <div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">Compétences</label><span className="text-xs text-gray-500">{editPlanData.skill_ids.length} sélectionnée(s)</span></div>
                  {skills.length > 0 && (<div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">{skills.map((skill) => (<label key={skill.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={editPlanData.skill_ids.includes(skill.id)} onChange={(e) => { if (e.target.checked) { setEditPlanData({ ...editPlanData, skill_ids: [...editPlanData.skill_ids, skill.id] }); } else { setEditPlanData({ ...editPlanData, skill_ids: editPlanData.skill_ids.filter(id => id !== skill.id) }); } }} className="rounded text-primary-600" /><span className="text-sm text-gray-700">{skill.name}</span><span className="text-xs text-gray-400 ml-auto">({skill.category})</span></label>))}</div>)}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-gray-700">Formations</label><span className="text-xs text-gray-500">{editPlanData.course_ids.length} sélectionnée(s)</span></div>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">{courses.map((course) => (<label key={course.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={editPlanData.course_ids.includes(course.id)} onChange={(e) => { if (e.target.checked) { setEditPlanData({ ...editPlanData, course_ids: [...editPlanData.course_ids, course.id] }); } else { setEditPlanData({ ...editPlanData, course_ids: editPlanData.course_ids.filter(id => id !== course.id) }); } }} className="rounded text-primary-600" /><span className="text-2xl">{course.image_emoji || '📚'}</span><span className="text-sm text-gray-700 flex-1">{course.title}</span><span className="text-xs text-gray-400">{course.duration_hours}h</span></label>))}</div>
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Les nouvelles formations seront auto-assignées</p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => { setShowEditPlan(false); setSelectedPlan(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={updateDevelopmentPlan} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Enregistrer</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Cancel Plan */}
        {showCancelPlan && planToCancel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Annuler le Plan</h2><button onClick={() => { setShowCancelPlan(false); setPlanToCancel(null); setCancelReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200"><div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-700 font-bold">{planToCancel.initials}</div><div><p className="font-medium text-gray-900">{planToCancel.employee}</p><p className="text-sm text-gray-500">{planToCancel.role} → {planToCancel.targetRole}</p></div></div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><div className="flex items-start gap-2"><AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-amber-800">Attention</p><p className="text-xs text-amber-700">Cette action est irréversible.</p></div></div></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Motif d&apos;annulation *</label><textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} placeholder="Ex: Départ de l'employé..." /></div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => { setShowCancelPlan(false); setPlanToCancel(null); setCancelReason(''); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Retour</button>
                <button onClick={cancelDevelopmentPlan} disabled={!cancelReason.trim()} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"><Ban className="w-4 h-4" />Annuler le plan</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Créer Parcours */}
        {showCreatePath && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Nouveau Parcours</h2><button onClick={() => setShowCreatePath(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label><input type="text" value={newPath.title} onChange={(e) => setNewPath({ ...newPath, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Onboarding Développeur" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newPath.description} onChange={(e) => setNewPath({ ...newPath, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label><select value={newPath.category} onChange={(e) => setNewPath({ ...newPath, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="Technique">Technique</option><option value="Management">Management</option><option value="Onboarding">Onboarding</option><option value="Commercial">Commercial</option></select></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formations</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {courses.map((course) => (<label key={course.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"><input type="checkbox" checked={newPath.course_ids.includes(course.id)} onChange={(e) => { if (e.target.checked) { setNewPath({ ...newPath, course_ids: [...newPath.course_ids, course.id] }); } else { setNewPath({ ...newPath, course_ids: newPath.course_ids.filter(id => id !== course.id) }); } }} className="rounded" /><span className="text-sm text-gray-700">{course.image_emoji} {course.title}</span><span className="text-xs text-gray-400 ml-auto">{course.duration_hours}h</span></label>))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{newPath.course_ids.length} formation(s)</p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreatePath(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createPath} disabled={!newPath.title} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Demander Formation */}
        {showRequestCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Demander une Formation</h2><button onClick={() => setShowRequestCourse(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label><input type="text" value={newRequest.title} onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Formation React Avancé" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newRequest.description} onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Pourquoi ? *</label><textarea value={newRequest.reason} onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="En quoi serait-elle utile..." /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Lien (optionnel)</label><input type="url" value={newRequest.external_url} onChange={(e) => setNewRequest({ ...newRequest, external_url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://..." /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label><input type="text" value={newRequest.provider} onChange={(e) => setNewRequest({ ...newRequest, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Coursera, LinkedIn..." /></div>
                {hasPermission(userRole, 'assign_course') && (
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Pour qui ?</label><select value={newRequest.for_employee_id} onChange={(e) => setNewRequest({ ...newRequest, for_employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="">Moi-même</option>{employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>))}</select></div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowRequestCourse(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={submitCourseRequest} disabled={!newRequest.title || !newRequest.reason} className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center"><Send className="w-4 h-4 mr-2" />Envoyer</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Créer Compétence */}
        {showCreateSkill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-gray-900">Nouvelle Compétence</h2><button onClick={() => setShowCreateSkill(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div></div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label><input type="text" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Leadership, Python..." /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label><select value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">{skillCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreateSkill(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createSkill} disabled={!newSkill.name} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Évaluer (EPF) */}
        {showEvalModal && selectedEpf && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Évaluation Post-Formation</h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedEpf.course_title}</p>
                  </div>
                  <button onClick={() => { setShowEvalModal(false); setSelectedEpf(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                    {selectedEpf.employee_initials}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedEpf.employee_name}</p>
                    <p className="text-sm text-gray-500">{selectedEpf.employee_job_title}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Critères d&apos;évaluation</h3>
                  <div className="space-y-4">
                    {evalCriteria.map((criterion, idx) => (
                      <div key={criterion.code} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">{criterion.label}</label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Poids: {criterion.weight}%</span>
                            <span className={`text-sm font-bold ${criterion.score >= (epfStats?.passing_threshold || 70) ? 'text-green-600' : criterion.score >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
                              {criterion.score}/100
                            </span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={criterion.score}
                          onChange={(e) => {
                            const updated = [...evalCriteria];
                            updated[idx] = { ...updated[idx], score: parseInt(e.target.value) };
                            setEvalCriteria(updated);
                          }}
                          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary-500"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border border-primary-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Score final pondéré</p>
                      <p className="text-xs text-gray-500 mt-0.5">Seuil de validation: {epfStats?.passing_threshold || 70}/100</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-bold ${computeWeightedScore(evalCriteria) >= (epfStats?.passing_threshold || 70) ? 'text-green-600' : 'text-red-600'}`}>
                        {computeWeightedScore(evalCriteria)}/100
                      </p>
                      <p className={`text-xs font-medium ${computeWeightedScore(evalCriteria) >= (epfStats?.passing_threshold || 70) ? 'text-green-600' : 'text-red-600'}`}>
                        {computeWeightedScore(evalCriteria) >= (epfStats?.passing_threshold || 70) ? '✅ Compétence validée' : '⚠️ Sous le seuil'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points forts observés</label>
                  <textarea value={evalStrengths} onChange={(e) => setEvalStrengths(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Ex: Bonne compréhension des concepts..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Axes d&apos;amélioration</label>
                  <textarea value={evalImprovements} onChange={(e) => setEvalImprovements(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Ex: Manque de pratique sur..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire global</label>
                  <textarea value={evalComments} onChange={(e) => setEvalComments(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Commentaire général..." />
                </div>

                {computeWeightedScore(evalCriteria) < (epfStats?.passing_threshold || 70) && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Score insuffisant</p>
                      <p className="text-xs text-red-600">Une re-formation sera automatiquement recommandée pour ce collaborateur.</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => { setShowEvalModal(false); setSelectedEpf(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={submitEvaluation} disabled={isSubmitting} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Soumettre l&apos;évaluation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Détail évaluation EPF */}
        {showEpfDetail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Détail de l&apos;évaluation</h2>
                  <button onClick={() => setShowEpfDetail(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-3xl">{showEpfDetail.course_emoji}</span>
                  <div>
                    <p className="font-medium text-gray-900">{showEpfDetail.course_title}</p>
                    <p className="text-sm text-gray-500">{showEpfDetail.employee_name} • {showEpfDetail.course_category}</p>
                  </div>
                </div>

                {showEpfDetail.score !== null && (
                  <div className="text-center p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg">
                    <p className={`text-4xl font-bold ${getScoreColor(showEpfDetail.score, epfStats?.passing_threshold || 70)}`}>
                      {showEpfDetail.score}/100
                    </p>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getRecommendationColor(showEpfDetail.recommendation)}`}>
                      {getRecommendationLabel(showEpfDetail.recommendation)}
                    </span>
                  </div>
                )}

                {showEpfDetail.criteria_scores && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Scores par critère</h4>
                    <div className="space-y-2">
                      {showEpfDetail.criteria_scores.map((c: CriteriaScore) => (
                        <div key={c.code} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm text-gray-700">{c.label}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-200 rounded-full">
                              <div className={`h-full rounded-full ${c.score >= (epfStats?.passing_threshold || 70) ? 'bg-green-500' : c.score >= 50 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${c.score}%` }} />
                            </div>
                            <span className="text-sm font-medium text-gray-900 w-12 text-right">{c.score}/100</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showEpfDetail.strengths && (
                  <div><p className="text-xs text-gray-500 mb-1">Points forts</p><p className="text-sm text-gray-700 bg-green-50 p-2 rounded">{showEpfDetail.strengths}</p></div>
                )}
                {showEpfDetail.improvements && (
                  <div><p className="text-xs text-gray-500 mb-1">Axes d&apos;amélioration</p><p className="text-sm text-gray-700 bg-orange-50 p-2 rounded">{showEpfDetail.improvements}</p></div>
                )}
                {showEpfDetail.comments && (
                  <div><p className="text-xs text-gray-500 mb-1">Commentaire</p><p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{showEpfDetail.comments}</p></div>
                )}

                {showEpfDetail.recommendation_details && (
                  <div className={`p-3 rounded-lg border ${showEpfDetail.competency_validated ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className={`text-sm ${showEpfDetail.competency_validated ? 'text-green-700' : 'text-red-700'}`}>
                      {showEpfDetail.recommendation_details}
                    </p>
                  </div>
                )}

                {showEpfDetail.retrain_course_title && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800">🔄 Re-formation assignée</p>
                    <p className="text-xs text-amber-600 mt-1">{showEpfDetail.retrain_course_title}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 p-2 rounded"><p className="text-xs text-gray-500">Évaluateur</p><p className="font-medium">{showEpfDetail.evaluator_name || '—'}</p></div>
                  <div className="bg-gray-50 p-2 rounded"><p className="text-xs text-gray-500">Complétée le</p><p className="font-medium">{showEpfDetail.completed_at ? new Date(showEpfDetail.completed_at).toLocaleDateString('fr-FR') : '—'}</p></div>
                </div>

                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Sync module Carrière</span>
                  {showEpfDetail.career_synced ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1"><Link className="w-3 h-3" />Synchronisé</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">Non synchronisé</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Assigner Évaluateur */}
        {showAssignEvaluator && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Assigner un évaluateur</h2>
                  <button onClick={() => setShowAssignEvaluator(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <span className="text-2xl">{showAssignEvaluator.course_emoji}</span>
                  <div>
                    <p className="font-medium text-gray-900">{showAssignEvaluator.course_title}</p>
                    <p className="text-sm text-gray-500">Pour: {showAssignEvaluator.employee_name}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Évaluateur *</label>
                  <select value={selectedEvaluatorId} onChange={(e) => setSelectedEvaluatorId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Sélectionner...</option>
                    {employees.filter(e => e.id !== showAssignEvaluator.employee_id).map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} - {emp.job_title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowAssignEvaluator(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={assignEvaluator} disabled={!selectedEvaluatorId} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Assigner</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Paramètres EPF */}
        {showEpfSettings && epfSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Paramètres Éval. Post-Formation</h2>
                  <button onClick={() => setShowEpfSettings(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Délai de déclenchement</label>
                  <select value={epfSettings.trigger_delay_days} onChange={(e) => setEpfSettings({...epfSettings, trigger_delay_days: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="0">Immédiat (dès validation)</option>
                    <option value="3">J+3 (3 jours après)</option>
                    <option value="7">J+7 (7 jours après)</option>
                    <option value="14">J+14 (14 jours après)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Évaluateur par défaut</label>
                  <select value={epfSettings.default_evaluator_type} onChange={(e) => setEpfSettings({...epfSettings, default_evaluator_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="internal">Évaluateur interne (manager)</option>
                    <option value="trainer">Formateur</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seuil de validation (/100)</label>
                  <input type="number" min="0" max="100" value={epfSettings.passing_threshold} onChange={(e) => setEpfSettings({...epfSettings, passing_threshold: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  <p className="text-xs text-gray-400 mt-1">Score minimum pour valider la compétence théorique</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="auto_retrain" checked={epfSettings.auto_retrain} onChange={(e) => setEpfSettings({...epfSettings, auto_retrain: e.target.checked})} className="rounded" />
                  <label htmlFor="auto_retrain" className="text-sm text-gray-700">Re-formation automatique si score insuffisant</label>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowEpfSettings(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Fermer</button>
                <button onClick={async () => {
                  try {
                    const response = await fetch(`${API_URL}/api/learning/post-eval/settings/config`, {
                      method: 'PUT', headers: getAuthHeaders(),
                      body: JSON.stringify(epfSettings)
                    });
                    if (response.ok) { setShowEpfSettings(false); fetchEpfStats(); }
                  } catch (error) { console.error('Error saving settings:', error); }
                }} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}