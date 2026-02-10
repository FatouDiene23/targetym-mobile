'use client';

import Header from '@/components/Header';
import { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, Award, Clock, Users, CheckCircle, Plus, Search,
  TrendingUp, Target, ChevronRight, AlertTriangle,
  GraduationCap, BarChart3, X, User, ArrowRight, Upload, ExternalLink,
  Check, XCircle, RefreshCw, Eye, Edit, MessageSquarePlus, Send,
  Archive, Ban, Play, FileCheck, Link
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

// Types
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
  course_id: number;
  course_title: string;
  course_image: string;
  course_duration: number;
  course_external_url?: string;
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
  pending_requests?: number;
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

// Helper pour vérifier les permissions
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
    'request_course': ['manager', 'employee'],  // MODIFIÉ: RH n'a pas besoin de demander
  };
  
  const allowedRoles = permissions[action] || [];
  return allowedRoles.includes(userRole.toLowerCase());
};

export default function LearningPage() {
  // États
  const [activeTab, setActiveTab] = useState<'catalog' | 'my-learning' | 'paths' | 'certifications' | 'development' | 'requests' | 'analytics'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // User & Role
  const [userRole, setUserRole] = useState<string>('employee');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  
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
  const [certHolders, setCertHolders] = useState<CertificationHolder[]>([]);
  const [showCreatePath, setShowCreatePath] = useState(false);
  const [showRequestCourse, setShowRequestCourse] = useState(false);
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [showCancelPlan, setShowCancelPlan] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [planToCancel, setPlanToCancel] = useState<DevelopmentPlan | null>(null);
  
  // NOUVEAU: Modal pour actions employé sur ses formations
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [assignmentToComplete, setAssignmentToComplete] = useState<Assignment | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [newCourse, setNewCourse] = useState({
    title: '', description: '', category: 'Technique', provider: '',
    external_url: '', duration_hours: '', level: 'beginner', image_emoji: '📚', is_mandatory: false
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

  // Auth headers
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, []);

  // Fetch functions
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
      console.error('Error fetching assignments:', error);
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

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchCourses(), fetchLearningPaths(), fetchPendingValidations(), fetchMyAssignments(),
        fetchCertifications(), fetchSkills(), fetchDevelopmentPlans(), fetchCourseRequests(),
        fetchStats(), fetchEmployees()
      ]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchCourses, fetchLearningPaths, fetchPendingValidations, fetchMyAssignments, fetchCertifications, fetchSkills, fetchDevelopmentPlans, fetchCourseRequests, fetchStats, fetchEmployees]);

  useEffect(() => {
    if (!isLoading) fetchCourses();
  }, [selectedCategory, searchQuery, fetchCourses, isLoading]);

  // ============================================
  // ACTIONS EMPLOYÉ SUR SES FORMATIONS
  // ============================================

  // Commencer une formation
  const startAssignment = async (assignmentId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/${assignmentId}/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        fetchMyAssignments();
      } else {
        const error = await response.json();
        alert('Erreur: ' + (error.detail || 'Impossible de commencer'));
      }
    } catch (error) {
      console.error('Error starting assignment:', error);
    }
  };

  // Marquer comme terminée
  const completeAssignment = async () => {
    if (!assignmentToComplete) return;
    
    setIsSubmitting(true);
    try {
      // 1. Upload du certificat si fourni
      if (completionFile) {
        const formData = new FormData();
        formData.append('file', completionFile);
        
        await fetch(`${API_URL}/api/learning/assignments/${assignmentToComplete.id}/upload-certificate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
          body: formData
        });
      }
      
      // 2. Marquer comme terminée
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

  // ============================================
  // AUTRES ACTIONS
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
        setNewCourse({ title: '', description: '', category: 'Technique', provider: '', external_url: '', duration_hours: '', level: 'beginner', image_emoji: '📚', is_mandatory: false });
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
      }
    } catch (error) {
      console.error('Error creating plan:', error);
    }
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

  // Helper functions
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
    if (status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'in-progress' || status === 'in_progress') return 'bg-blue-100 text-blue-700';
    if (status === 'pending_validation' || status === 'pending') return 'bg-orange-100 text-orange-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'cancelled') return 'bg-red-100 text-red-700';
    if (status === 'archived') return 'bg-gray-100 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'assigned': 'Assigné', 'in_progress': 'En cours', 'pending_validation': 'En attente',
      'pending': 'En attente', 'completed': 'Terminé', 'rejected': 'Rejeté',
      'approved': 'Approuvé', 'active': 'Actif', 'cancelled': 'Annulé', 'archived': 'Archivé'
    };
    return labels[status] || status;
  };

  const getCertStatusColor = (status: string) => {
    if (status === 'valid') return 'text-green-600';
    if (status === 'expiring') return 'text-orange-600';
    return 'text-red-600';
  };

  const getPlanStatusColor = (status: string) => {
    if (status === 'active') return 'bg-green-100 text-green-700';
    if (status === 'completed') return 'bg-blue-100 text-blue-700';
    if (status === 'cancelled') return 'bg-red-100 text-red-700';
    if (status === 'archived') return 'bg-gray-100 text-gray-600';
    return 'bg-gray-100 text-gray-700';
  };

  const getVisiblePlans = () => {
    if (hasPermission(userRole, 'view_all_plans')) {
      return developmentPlans;
    }
    const teamEmployeeIds = employees.map(e => e.id);
    return developmentPlans.filter(p => 
      p.employee_id === currentUserId || teamEmployeeIds.includes(p.employee_id)
    );
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

  // Trouver l'URL externe d'un cours
  const getCourseExternalUrl = (courseId: number): string | null => {
    const course = courses.find(c => c.id === courseId);
    return course?.external_url || null;
  };

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

  return (
    <>
      <Header title="Formation & Développement" subtitle="Catalogue, parcours, certifications et plans de développement" />
      
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats */}
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

        {/* Tabs */}
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
              onClick={() => {
                setSelectedAssignment(pendingValidations[0]);
                setShowValidationModal(true);
              }}
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
              {/* MODIFIÉ: Bouton Demander visible seulement pour employee/manager */}
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

        {/* TAB: Mes Formations - AMÉLIORÉ avec actions */}
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
                              <p className="font-medium text-gray-900">{assignment.course_title}</p>
                              <p className="text-sm text-gray-500">{assignment.course_duration}h • Deadline: {assignment.deadline || 'Non définie'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Lien vers formation externe */}
                            {assignment.course_external_url && (
                              <a
                                href={assignment.course_external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-white text-primary-600 rounded-lg hover:bg-primary-50 border border-primary-200"
                                title="Accéder à la formation"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            {/* Bouton Commencer */}
                            <button
                              onClick={() => startAssignment(assignment.id)}
                              className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 flex items-center gap-2"
                            >
                              <Play className="w-4 h-4" />
                              Commencer
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
                              <p className="font-medium text-gray-900">{assignment.course_title}</p>
                              <p className="text-sm text-gray-500">{assignment.course_duration}h • Deadline: {assignment.deadline || 'Non définie'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Lien vers formation externe */}
                            {assignment.course_external_url && (
                              <a
                                href={assignment.course_external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 bg-white text-primary-600 rounded-lg hover:bg-primary-50 border border-primary-200"
                                title="Continuer la formation"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            {/* Bouton Marquer terminée */}
                            <button
                              onClick={() => {
                                setAssignmentToComplete(assignment);
                                setCompletionNote('');
                                setCompletionFile(null);
                                setShowCompleteModal(true);
                              }}
                              className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 flex items-center gap-2"
                            >
                              <FileCheck className="w-4 h-4" />
                              Terminer
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
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            En attente
                          </span>
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
                            <button
                              onClick={() => {
                                setAssignmentToComplete(assignment);
                                setCompletionNote('');
                                setCompletionFile(null);
                                setShowCompleteModal(true);
                              }}
                              className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
                            >
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
                            <CheckCircle className="w-4 h-4" />
                            Validé
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
                      <button className="text-primary-600 hover:text-primary-700">
                        <ChevronRight className="w-5 h-5" />
                      </button>
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
                                {course.status === 'completed' ? 'Terminé' : course.status === 'in-progress' ? 'En cours' : 'Planifié'}
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

        {/* ========================================
            MODALS
        ======================================== */}

        {/* Modal: Marquer formation terminée - NOUVEAU */}
        {showCompleteModal && assignmentToComplete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Terminer la formation</h2>
                  <button onClick={() => { setShowCompleteModal(false); setAssignmentToComplete(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
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
                  <textarea
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                    placeholder="Commentaires sur la formation, difficultés rencontrées..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certificat/Justificatif (optionnel)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      id="certificate-upload"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setCompletionFile(e.target.files?.[0] || null)}
                    />
                    {completionFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileCheck className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-700">{completionFile.name}</span>
                        <button onClick={() => setCompletionFile(null)} className="text-red-500 hover:text-red-700">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="certificate-upload" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Cliquez pour uploader</p>
                        <p className="text-xs text-gray-400">PDF, PNG, JPG (max 5MB)</p>
                      </label>
                    )}
                  </div>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Votre manager/RH devra valider la complétion de cette formation.
                  </p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => { setShowCompleteModal(false); setAssignmentToComplete(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
                <button
                  onClick={completeAssignment}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Soumettre
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Course Detail Modal */}
        {selectedCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="relative h-48 bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <span className="text-7xl">{selectedCourse.image_emoji || '📚'}</span>
                <button onClick={() => setSelectedCourse(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                  <X className="w-5 h-5 text-white" />
                </button>
                {selectedCourse.is_mandatory && <span className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-lg">Obligatoire</span>}
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
                <div className="flex gap-3">
                  {hasPermission(userRole, 'assign_course') && (
                    <button onClick={() => { setAssignData({ ...assignData, course_id: selectedCourse.id.toString() }); setSelectedCourse(null); setShowAssignModal(true); }} className="flex-1 flex items-center justify-center px-4 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600">
                      <User className="w-5 h-5 mr-2" />Assigner à un employé
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Course Modal */}
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
                    <input type="number" value={newCourse.duration_hours} onChange={(e) => setNewCourse({ ...newCourse, duration_hours: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: 8" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
                    <input type="text" value={newCourse.image_emoji} onChange={(e) => setNewCourse({ ...newCourse, image_emoji: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="📚" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur (ex: Coursera, Udemy)</label>
                  <input type="text" value={newCourse.provider} onChange={(e) => setNewCourse({ ...newCourse, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL externe (lien vers la formation)</label>
                  <input type="url" value={newCourse.external_url} onChange={(e) => setNewCourse({ ...newCourse, external_url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://..." />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="mandatory" checked={newCourse.is_mandatory} onChange={(e) => setNewCourse({ ...newCourse, is_mandatory: e.target.checked })} className="rounded" />
                  <label htmlFor="mandatory" className="text-sm text-gray-700">Formation obligatoire</label>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreateCourse(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createCourse} disabled={!newCourse.title} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

        {/* Create Path Modal */}
        {showCreatePath && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Nouveau Parcours</h2>
                  <button onClick={() => setShowCreatePath(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                  <input type="text" value={newPath.title} onChange={(e) => setNewPath({ ...newPath, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: Onboarding Développeur" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={newPath.description} onChange={(e) => setNewPath({ ...newPath, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                  <select value={newPath.category} onChange={(e) => setNewPath({ ...newPath, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="Technique">Technique</option>
                    <option value="Management">Management</option>
                    <option value="Onboarding">Onboarding</option>
                    <option value="Commercial">Commercial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formations du parcours</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {courses.map((course) => (
                      <label key={course.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                        <input type="checkbox" checked={newPath.course_ids.includes(course.id)} onChange={(e) => { if (e.target.checked) { setNewPath({ ...newPath, course_ids: [...newPath.course_ids, course.id] }); } else { setNewPath({ ...newPath, course_ids: newPath.course_ids.filter(id => id !== course.id) }); } }} className="rounded" />
                        <span className="text-sm text-gray-700">{course.image_emoji} {course.title}</span>
                        <span className="text-xs text-gray-400 ml-auto">{course.duration_hours}h</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{newPath.course_ids.length} formation(s) sélectionnée(s)</p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreatePath(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createPath} disabled={!newPath.title} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Modal */}
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

        {/* Validation Modal */}
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
                    <textarea value={validationData.rejection_reason} onChange={(e) => setValidationData({ ...validationData, rejection_reason: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Expliquez pourquoi..." />
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

        {/* Create Certification Modal */}
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input type="text" value={newCertification.name} onChange={(e) => setNewCertification({ ...newCertification, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: AWS Solutions Architect" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                  <input type="text" value={newCertification.provider} onChange={(e) => setNewCertification({ ...newCertification, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: Amazon" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={newCertification.description} onChange={(e) => setNewCertification({ ...newCertification, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validité (mois)</label>
                  <input type="number" value={newCertification.validity_months} onChange={(e) => setNewCertification({ ...newCertification, validity_months: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Laisser vide si permanent" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreateCertification(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createCertificationType} disabled={!newCertification.name} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

        {/* Cert Holders Modal */}
        {showCertHolders && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{showCertHolders.name}</h2>
                    <p className="text-sm text-gray-500">{showCertHolders.provider}</p>
                  </div>
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
                          <div>
                            <p className="font-medium text-gray-900">{holder.employee_name}</p>
                            <p className="text-xs text-gray-500">Obtenue le {holder.obtained_date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${getCertStatusColor(holder.status)}`}>
                            {holder.status === 'expiring' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                            {holder.expiry_date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Plan Modal */}
        {showCreatePlan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Nouveau Plan de Développement</h2>
                  <button onClick={() => setShowCreatePlan(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label>
                  <select value={newPlan.employee_id} onChange={(e) => setNewPlan({ ...newPlan, employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Sélectionner...</option>
                    {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Poste actuel</label>
                    <input type="text" value={newPlan.current_role} onChange={(e) => setNewPlan({ ...newPlan, current_role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Poste cible</label>
                    <input type="text" value={newPlan.target_role} onChange={(e) => setNewPlan({ ...newPlan, target_role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date cible</label>
                  <input type="date" value={newPlan.target_date} onChange={(e) => setNewPlan({ ...newPlan, target_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Compétences à développer</label>
                    <button onClick={() => setShowCreateSkill(true)} className="text-xs text-primary-600 hover:text-primary-700 flex items-center"><Plus className="w-3 h-3 mr-1" />Ajouter</button>
                  </div>
                  {skills.length === 0 ? (
                    <div className="text-center py-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-2">Aucune compétence</p>
                      <button onClick={() => setShowCreateSkill(true)} className="text-sm text-primary-600 hover:underline">Créer</button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {skills.map((skill) => (
                        <label key={skill.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                          <input type="checkbox" checked={newPlan.skill_ids.includes(skill.id)} onChange={(e) => { if (e.target.checked) { setNewPlan({ ...newPlan, skill_ids: [...newPlan.skill_ids, skill.id] }); } else { setNewPlan({ ...newPlan, skill_ids: newPlan.skill_ids.filter(id => id !== skill.id) }); } }} className="rounded" />
                          <span className="text-sm text-gray-700">{skill.name}</span>
                          <span className="text-xs text-gray-400">({skill.category})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formations à assigner</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {courses.map((course) => (
                      <label key={course.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                        <input type="checkbox" checked={newPlan.course_ids.includes(course.id)} onChange={(e) => { if (e.target.checked) { setNewPlan({ ...newPlan, course_ids: [...newPlan.course_ids, course.id] }); } else { setNewPlan({ ...newPlan, course_ids: newPlan.course_ids.filter(id => id !== course.id) }); } }} className="rounded" />
                        <span className="text-sm text-gray-700">{course.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreatePlan(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createDevelopmentPlan} disabled={!newPlan.employee_id} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Plan Modal */}
        {showEditPlan && selectedPlan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Modifier le Plan</h2>
                  <button onClick={() => { setShowEditPlan(false); setSelectedPlan(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">{selectedPlan.initials}</div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedPlan.employee}</p>
                    <p className="text-sm text-gray-500">{selectedPlan.role}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Poste cible</label>
                  <input type="text" value={editPlanData.target_role} onChange={(e) => setEditPlanData({ ...editPlanData, target_role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date cible</label>
                  <input type="date" value={editPlanData.target_date} onChange={(e) => setEditPlanData({ ...editPlanData, target_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Compétences à développer</label>
                    <span className="text-xs text-gray-500">{editPlanData.skill_ids.length} sélectionnée(s)</span>
                  </div>
                  {skills.length === 0 ? (
                    <div className="text-center py-4 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">Aucune compétence</p></div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {skills.map((skill) => (
                        <label key={skill.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" checked={editPlanData.skill_ids.includes(skill.id)} onChange={(e) => { if (e.target.checked) { setEditPlanData({ ...editPlanData, skill_ids: [...editPlanData.skill_ids, skill.id] }); } else { setEditPlanData({ ...editPlanData, skill_ids: editPlanData.skill_ids.filter(id => id !== skill.id) }); } }} className="rounded text-primary-600" />
                          <span className="text-sm text-gray-700">{skill.name}</span>
                          <span className="text-xs text-gray-400 ml-auto">({skill.category})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Formations à assigner</label>
                    <span className="text-xs text-gray-500">{editPlanData.course_ids.length} sélectionnée(s)</span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {courses.map((course) => (
                      <label key={course.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={editPlanData.course_ids.includes(course.id)} onChange={(e) => { if (e.target.checked) { setEditPlanData({ ...editPlanData, course_ids: [...editPlanData.course_ids, course.id] }); } else { setEditPlanData({ ...editPlanData, course_ids: editPlanData.course_ids.filter(id => id !== course.id) }); } }} className="rounded text-primary-600" />
                        <span className="text-2xl">{course.image_emoji || '📚'}</span>
                        <span className="text-sm text-gray-700 flex-1">{course.title}</span>
                        <span className="text-xs text-gray-400">{course.duration_hours}h</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => { setShowEditPlan(false); setSelectedPlan(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={updateDevelopmentPlan} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">Enregistrer</button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Plan Modal */}
        {showCancelPlan && planToCancel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Annuler le Plan</h2>
                  <button onClick={() => { setShowCancelPlan(false); setPlanToCancel(null); setCancelReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-700 font-bold">{planToCancel.initials}</div>
                  <div>
                    <p className="font-medium text-gray-900">{planToCancel.employee}</p>
                    <p className="text-sm text-gray-500">{planToCancel.role} → {planToCancel.targetRole}</p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Attention</p>
                      <p className="text-xs text-amber-700">Cette action est irréversible.</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motif d&apos;annulation *</label>
                  <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} placeholder="Ex: Départ de l'employé, réorientation..." />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => { setShowCancelPlan(false); setPlanToCancel(null); setCancelReason(''); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Retour</button>
                <button onClick={cancelDevelopmentPlan} disabled={!cancelReason.trim()} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Ban className="w-4 h-4" />Annuler le plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Request Course Modal */}
        {showRequestCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Demander une Formation</h2>
                  <button onClick={() => setShowRequestCourse(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la formation *</label>
                  <input type="text" value={newRequest.title} onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: Formation React Avancé" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={newRequest.description} onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="De quoi parle cette formation ?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pourquoi cette formation ? *</label>
                  <textarea value={newRequest.reason} onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} placeholder="Expliquez en quoi elle serait utile..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lien (si connu)</label>
                  <input type="url" value={newRequest.external_url} onChange={(e) => setNewRequest({ ...newRequest, external_url: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur suggéré</label>
                  <input type="text" value={newRequest.provider} onChange={(e) => setNewRequest({ ...newRequest, provider: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: Coursera, LinkedIn Learning..." />
                </div>
                {hasPermission(userRole, 'assign_course') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pour qui ? (optionnel)</label>
                    <select value={newRequest.for_employee_id} onChange={(e) => setNewRequest({ ...newRequest, for_employee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="">Pour moi-même</option>
                      {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>))}
                    </select>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowRequestCourse(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={submitCourseRequest} disabled={!newRequest.title || !newRequest.reason} className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center">
                  <Send className="w-4 h-4 mr-2" />Envoyer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Skill Modal */}
        {showCreateSkill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Nouvelle Compétence</h2>
                  <button onClick={() => setShowCreateSkill(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input type="text" value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: Leadership, Python..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                  <select value={newSkill.category} onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    {skillCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowCreateSkill(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={createSkill} disabled={!newSkill.name} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">Créer</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}