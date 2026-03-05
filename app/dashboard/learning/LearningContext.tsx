'use client';

// ============================================
// LEARNING MODULE - CONTEXT PROVIDER
// File: app/dashboard/learning/LearningContext.tsx
// ============================================

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  API_URL, getAuthHeaders, hasPermission,
  Course, LearningPath, Assignment, Certification, CertificationHolder, Skill,
  DevelopmentPlan, CourseRequest, Stats, MonthlyStats, CategoryStats, TopLearner,
  Employee, PostTrainingEval, CriteriaScore, EpfStats, EpfSettings, EmployeeEvalHistory
} from './shared';

// ============================================
// CONTEXT TYPE
// ============================================

interface LearningContextType {
  // User
  userRole: string;
  currentUserId: number | null;
  isLoading: boolean;

  // Data
  courses: Course[];
  learningPaths: LearningPath[];
  certifications: Certification[];
  skills: Skill[];
  developmentPlans: DevelopmentPlan[];
  courseRequests: CourseRequest[];
  stats: Stats | null;
  monthlyStats: MonthlyStats[];
  categoryStats: CategoryStats[];
  topLearners: TopLearner[];
  employees: Employee[];
  pendingValidations: Assignment[];
  myAssignments: Assignment[];
  teamAssignments: Assignment[];
  certHolders: CertificationHolder[];

  // EPF data
  epfPending: PostTrainingEval[];
  epfAll: PostTrainingEval[];
  epfStats: EpfStats | null;
  epfSettings: EpfSettings | null;
  setEpfSettings: (s: EpfSettings | null) => void;

  // Catalog filters
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Modal states
  selectedCourse: Course | null;
  setSelectedCourse: (c: Course | null) => void;
  showCreateCourse: boolean;
  setShowCreateCourse: (v: boolean) => void;
  showAssignModal: boolean;
  setShowAssignModal: (v: boolean) => void;
  showValidationModal: boolean;
  setShowValidationModal: (v: boolean) => void;
  selectedAssignment: Assignment | null;
  setSelectedAssignment: (a: Assignment | null) => void;
  showCreateCertification: boolean;
  setShowCreateCertification: (v: boolean) => void;
  showCreatePlan: boolean;
  setShowCreatePlan: (v: boolean) => void;
  showEditPlan: boolean;
  setShowEditPlan: (v: boolean) => void;
  selectedPlan: DevelopmentPlan | null;
  setSelectedPlan: (p: DevelopmentPlan | null) => void;
  showCertHolders: Certification | null;
  setShowCertHolders: (c: Certification | null) => void;
  showCreatePath: boolean;
  setShowCreatePath: (v: boolean) => void;
  showRequestCourse: boolean;
  setShowRequestCourse: (v: boolean) => void;
  showCreateSkill: boolean;
  setShowCreateSkill: (v: boolean) => void;
  showCancelPlan: boolean;
  setShowCancelPlan: (v: boolean) => void;
  cancelReason: string;
  setCancelReason: (r: string) => void;
  planToCancel: DevelopmentPlan | null;
  setPlanToCancel: (p: DevelopmentPlan | null) => void;
  showCompleteModal: boolean;
  setShowCompleteModal: (v: boolean) => void;
  assignmentToComplete: Assignment | null;
  setAssignmentToComplete: (a: Assignment | null) => void;
  completionNote: string;
  setCompletionNote: (n: string) => void;
  completionFile: File | null;
  setCompletionFile: (f: File | null) => void;
  isSubmitting: boolean;

  // EPF modal states
  showEvalModal: boolean;
  setShowEvalModal: (v: boolean) => void;
  selectedEpf: PostTrainingEval | null;
  setSelectedEpf: (e: PostTrainingEval | null) => void;
  evalCriteria: CriteriaScore[];
  setEvalCriteria: (c: CriteriaScore[]) => void;
  evalComments: string;
  setEvalComments: (c: string) => void;
  evalStrengths: string;
  setEvalStrengths: (s: string) => void;
  evalImprovements: string;
  setEvalImprovements: (i: string) => void;
  showEpfDetail: PostTrainingEval | null;
  setShowEpfDetail: (e: PostTrainingEval | null) => void;
  showEpfHistory: EmployeeEvalHistory | null;
  setShowEpfHistory: (h: EmployeeEvalHistory | null) => void;
  showEpfSettings: boolean;
  setShowEpfSettings: (v: boolean) => void;
  showAssignEvaluator: PostTrainingEval | null;
  setShowAssignEvaluator: (e: PostTrainingEval | null) => void;
  selectedEvaluatorId: string;
  setSelectedEvaluatorId: (id: string) => void;
  epfSubTab: 'pending' | 'all' | 'history';
  setEpfSubTab: (t: 'pending' | 'all' | 'history') => void;

  // Form states
  newCourse: any;
  setNewCourse: (c: any) => void;
  assignData: any;
  setAssignData: (d: any) => void;
  validationData: any;
  setValidationData: (d: any) => void;
  newCertification: any;
  setNewCertification: (c: any) => void;
  newPath: any;
  setNewPath: (p: any) => void;
  newPlan: any;
  setNewPlan: (p: any) => void;
  editPlanData: any;
  setEditPlanData: (d: any) => void;
  newRequest: any;
  setNewRequest: (r: any) => void;
  newSkill: any;
  setNewSkill: (s: any) => void;

  // Actions
  startAssignment: (id: number) => Promise<void>;
  openCompleteModal: (a: Assignment) => void;
  completeAssignment: () => Promise<void>;
  createCourse: () => Promise<void>;
  createPath: () => Promise<void>;
  assignCourse: () => Promise<void>;
  validateAssignment: () => Promise<void>;
  createCertificationType: () => Promise<void>;
  createSkill: () => Promise<void>;
  createDevelopmentPlan: () => Promise<void>;
  openEditPlanModal: (plan: DevelopmentPlan) => void;
  updateDevelopmentPlan: () => Promise<void>;
  cancelDevelopmentPlan: () => Promise<void>;
  archiveDevelopmentPlan: (id: number) => Promise<void>;
  submitCourseRequest: () => Promise<void>;
  reviewCourseRequest: (id: number, approved: boolean, comment: string) => Promise<void>;
  fetchCertificationHolders: (certId: number) => Promise<void>;
  getVisiblePlans: () => DevelopmentPlan[];

  // Path actions
  refreshPaths: () => Promise<void>;

  // EPF actions
  openEvalModal: (epf: PostTrainingEval) => void;
  computeWeightedScore: (criteria: CriteriaScore[]) => number;
  submitEvaluation: () => Promise<void>;
  assignEvaluator: () => Promise<void>;
  syncCareer: (evalId: number) => Promise<void>;
  fetchEmployeeHistory: (employeeId: number) => Promise<void>;
  fetchEpfSettings: () => Promise<void>;
  fetchEpfStats: () => Promise<void>;
}

const LearningContext = createContext<LearningContextType | null>(null);

export function useLearning() {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning must be used within LearningProvider');
  return ctx;
}

// ============================================
// PROVIDER
// ============================================

export function LearningProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState('employee');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Data
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

  // EPF
  const [epfPending, setEpfPending] = useState<PostTrainingEval[]>([]);
  const [epfAll, setEpfAll] = useState<PostTrainingEval[]>([]);
  const [epfStats, setEpfStats] = useState<EpfStats | null>(null);
  const [epfSettings, setEpfSettingsState] = useState<EpfSettings | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
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

  // EPF modals
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

  // Forms
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

  // ============================================
  // INIT USER
  // ============================================
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserRole(user.role?.toLowerCase() || 'employee');
        setCurrentUserId(user.employee_id || null);
      } catch (e) { console.error('Error parsing user:', e); }
    }
  }, []);

  // ============================================
  // FETCH FUNCTIONS
  // ============================================

  const fetchCourses = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'Tous') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      const response = await fetch(`${API_URL}/api/learning/courses/?${params}`, { headers: getAuthHeaders() });
      const data = await response.json();
      setCourses(data.items || []);
    } catch (error) { console.error('Error fetching courses:', error); }
  }, [selectedCategory, searchQuery]);

  const fetchLearningPaths = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/paths/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setLearningPaths(data || []);
    } catch (error) { console.error('Error fetching paths:', error); }
  }, []);

  const fetchPendingValidations = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/?pending_validation=true`, { headers: getAuthHeaders() });
      const data = await response.json();
      setPendingValidations(data.items || []);
    } catch (error) { console.error('Error fetching pending validations:', error); }
  }, []);

  const fetchCertifications = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/certifications/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setCertifications(data || []);
    } catch (error) { console.error('Error fetching certifications:', error); }
  }, []);

  const fetchCertificationHolders = async (certId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/certifications/${certId}/holders`, { headers: getAuthHeaders() });
      const data = await response.json();
      setCertHolders(data || []);
    } catch (error) { console.error('Error fetching holders:', error); }
  };

  const fetchSkills = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/skills/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setSkills(data || []);
    } catch (error) { console.error('Error fetching skills:', error); }
  }, []);

  const fetchDevelopmentPlans = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setDevelopmentPlans(data || []);
    } catch (error) { console.error('Error fetching plans:', error); }
  }, []);

  const fetchCourseRequests = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/requests/`, { headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setCourseRequests(data || []); }
    } catch (error) { console.error('Error fetching requests:', error); }
  }, []);

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
    } catch (error) { console.error('Error fetching stats:', error); }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees/my-team/`, { headers: getAuthHeaders() });
      const data = await response.json();
      setEmployees(data.items || []);
    } catch (error) { console.error('Error fetching employees:', error); }
  }, []);

  const fetchMyAssignments = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/?my_assignments=true`, { headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setMyAssignments(data.items || []); }
    } catch (error) { console.error('Error fetching my assignments:', error); }
  }, []);

  const fetchTeamAssignments = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/?team_assignments=true`, { headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setTeamAssignments(data.items || []); }
    } catch (error) { console.error('Error fetching team assignments:', error); }
  }, []);

  const fetchEpfPending = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/pending`, { headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setEpfPending(data.items || []); }
    } catch (error) { console.error('Error fetching EPF pending:', error); }
  }, []);

  const fetchEpfAll = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/?page_size=50`, { headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setEpfAll(data.items || []); }
    } catch (error) { console.error('Error fetching EPF all:', error); }
  }, []);

  const fetchEpfStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/stats/overview`, { headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setEpfStats(data); }
    } catch (error) { console.error('Error fetching EPF stats:', error); }
  }, []);

  const fetchEpfSettingsFn = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/settings/config`, { headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setEpfSettingsState(data); }
    } catch (error) { console.error('Error fetching EPF settings:', error); }
  }, []);

  const fetchEmployeeHistory = async (employeeId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/history/${employeeId}`, { headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setShowEpfHistory(data); }
    } catch (error) { console.error('Error fetching EPF history:', error); }
  };

  // ============================================
  // LOAD ALL DATA
  // ============================================

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchCourses(), fetchLearningPaths(), fetchPendingValidations(), fetchMyAssignments(),
        fetchCertifications(), fetchSkills(), fetchDevelopmentPlans(), fetchCourseRequests(),
        fetchStats(), fetchEmployees(), fetchTeamAssignments(),
        fetchEpfPending(), fetchEpfAll(), fetchEpfStats(), fetchEpfSettingsFn()
      ]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchCourses, fetchLearningPaths, fetchPendingValidations, fetchMyAssignments, fetchCertifications, fetchSkills, fetchDevelopmentPlans, fetchCourseRequests, fetchStats, fetchEmployees, fetchTeamAssignments, fetchEpfPending, fetchEpfAll, fetchEpfStats, fetchEpfSettingsFn]);

  useEffect(() => {
    if (!isLoading) fetchCourses();
  }, [selectedCategory, searchQuery, fetchCourses, isLoading]);

  // ============================================
  // HELPERS
  // ============================================

  const getVisiblePlans = useCallback(() => {
    if (hasPermission(userRole, 'view_all_plans')) return developmentPlans;
    const teamEmployeeIds = employees.map(e => e.id);
    return developmentPlans.filter(p => p.employee_id === currentUserId || teamEmployeeIds.includes(p.employee_id));
  }, [userRole, developmentPlans, employees, currentUserId]);

  // ============================================
  // ACTIONS
  // ============================================

  const startAssignment = async (assignmentId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/${assignmentId}/start`, { method: 'POST', headers: getAuthHeaders() });
      if (response.ok) { fetchMyAssignments(); fetchTeamAssignments(); }
      else { const error = await response.json(); toast.error('Erreur: ' + (error.detail || 'Impossible de commencer')); }
    } catch (error) { console.error('Error starting assignment:', error); }
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
    } catch (error) { console.error('Error uploading certificate:', error); return false; }
  };

  const completeAssignment = async () => {
    if (!assignmentToComplete) return;
    setIsSubmitting(true);
    try {
      if (completionFile) {
        const uploaded = await uploadCertificateFile(assignmentToComplete.id, completionFile);
        if (!uploaded) { toast.error('Erreur lors de l\'upload du certificat'); setIsSubmitting(false); return; }
      }
      if (assignmentToComplete.requires_certificate && !completionFile && !assignmentToComplete.certificate_file) {
        toast.error('Un certificat est requis pour cette formation'); setIsSubmitting(false); return;
      }
      const response = await fetch(`${API_URL}/api/learning/assignments/${assignmentToComplete.id}/complete`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ completion_note: completionNote })
      });
      if (response.ok) {
        setShowCompleteModal(false); setAssignmentToComplete(null); setCompletionNote(''); setCompletionFile(null);
        fetchMyAssignments(); fetchTeamAssignments(); fetchPendingValidations();
      } else { const error = await response.json(); toast.error('Erreur: ' + (error.detail || 'Impossible de soumettre')); }
    } catch (error) { console.error('Error completing assignment:', error); toast.error('Erreur de connexion'); }
    finally { setIsSubmitting(false); }
  };

  const openCompleteModal = (assignment: Assignment) => {
    setAssignmentToComplete(assignment); setCompletionNote(assignment.completion_note || ''); setCompletionFile(null); setShowCompleteModal(true);
  };

  const createCourse = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/courses/`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ ...newCourse, duration_hours: newCourse.duration_hours ? parseFloat(newCourse.duration_hours) : null })
      });
      if (response.ok) {
        setShowCreateCourse(false);
        setNewCourse({ title: '', description: '', category: 'Technique', provider: '', external_url: '', duration_hours: '', level: 'beginner', image_emoji: '📚', is_mandatory: false, requires_certificate: false });
        fetchCourses();
      }
    } catch (error) { console.error('Error creating course:', error); }
  };

  const createPath = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/paths/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newPath) });
      if (response.ok) { setShowCreatePath(false); setNewPath({ title: '', description: '', category: 'Technique', course_ids: [] }); fetchLearningPaths(); }
    } catch (error) { console.error('Error creating path:', error); }
  };

  const assignCourse = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ employee_id: parseInt(assignData.employee_id), course_id: parseInt(assignData.course_id), deadline: assignData.deadline || null })
      });
      if (response.ok) { setShowAssignModal(false); setAssignData({ employee_id: '', course_id: '', deadline: '' }); fetchPendingValidations(); fetchCourses(); fetchTeamAssignments(); }
      else { const error = await response.json(); toast.error('Erreur: ' + (error.detail || 'Erreur')); }
    } catch (error) { console.error('Error assigning course:', error); }
  };

  const validateAssignment = async () => {
    if (!selectedAssignment) return;
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/${selectedAssignment.id}/validate`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(validationData)
      });
      if (response.ok) { setShowValidationModal(false); setSelectedAssignment(null); setValidationData({ approved: true, rejection_reason: '' }); fetchPendingValidations(); fetchStats(); fetchTeamAssignments(); fetchMyAssignments(); fetchEpfPending(); fetchEpfAll(); fetchEpfStats(); }
    } catch (error) { console.error('Error validating:', error); }
  };

  const createCertificationType = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/certifications/`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ ...newCertification, validity_months: newCertification.validity_months ? parseInt(newCertification.validity_months) : null })
      });
      if (response.ok) { setShowCreateCertification(false); setNewCertification({ name: '', provider: '', description: '', validity_months: '' }); fetchCertifications(); }
    } catch (error) { console.error('Error creating certification:', error); }
  };

  const createSkill = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/skills/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newSkill) });
      if (response.ok) { setShowCreateSkill(false); setNewSkill({ name: '', category: 'Technique', description: '' }); fetchSkills(); }
    } catch (error) { console.error('Error creating skill:', error); }
  };

  const createDevelopmentPlan = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ ...newPlan, employee_id: parseInt(newPlan.employee_id) })
      });
      if (response.ok) { setShowCreatePlan(false); setNewPlan({ employee_id: '', current_role: '', target_role: '', target_date: '', skill_ids: [], course_ids: [] }); fetchDevelopmentPlans(); fetchTeamAssignments(); fetchCourses(); }
      else { const error = await response.json(); toast.error('Erreur: ' + (error.detail || 'Erreur')); }
    } catch (error) { console.error('Error creating plan:', error); }
  };

  const openEditPlanModal = (plan: DevelopmentPlan) => {
    setSelectedPlan(plan);
    const currentSkillIds = plan.skills.map(s => s.id).filter(Boolean) as number[];
    const currentCourseIds = plan.courses.map(c => c.id).filter(Boolean) as number[];
    setEditPlanData({ target_role: plan.targetRole || '', target_date: plan.target_date || '', skill_ids: currentSkillIds, course_ids: currentCourseIds });
    setShowEditPlan(true);
  };

  const updateDevelopmentPlan = async () => {
    if (!selectedPlan) return;
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/${selectedPlan.id}`, {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({ target_role: editPlanData.target_role, target_date: editPlanData.target_date || null, skill_ids: editPlanData.skill_ids, course_ids: editPlanData.course_ids })
      });
      if (response.ok) { setShowEditPlan(false); setSelectedPlan(null); setEditPlanData({ target_role: '', target_date: '', skill_ids: [], course_ids: [] }); fetchDevelopmentPlans(); fetchTeamAssignments(); fetchCourses(); }
      else { const errorData = await response.json(); toast.error('Erreur: ' + (errorData.detail || 'Erreur inconnue')); }
    } catch (error) { console.error('Error updating plan:', error); }
  };

  const cancelDevelopmentPlan = async () => {
    if (!planToCancel || !cancelReason.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/${planToCancel.id}/cancel`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ reason: cancelReason })
      });
      if (response.ok) { setShowCancelPlan(false); setPlanToCancel(null); setCancelReason(''); fetchDevelopmentPlans(); }
      else { const errorData = await response.json(); toast.error('Erreur: ' + (errorData.detail || 'Impossible d\'annuler')); }
    } catch (error) { console.error('Error cancelling plan:', error); }
  };

  const archiveDevelopmentPlan = async (planId: number) => {
    if (!confirm('Voulez-vous archiver ce plan ?')) return;
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/${planId}/archive`, { method: 'POST', headers: getAuthHeaders() });
      if (response.ok) { fetchDevelopmentPlans(); }
      else { const errorData = await response.json(); toast.error('Erreur: ' + (errorData.detail || 'Impossible d\'archiver')); }
    } catch (error) { console.error('Error archiving plan:', error); }
  };

  const submitCourseRequest = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/requests/`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ ...newRequest, for_employee_id: newRequest.for_employee_id ? parseInt(newRequest.for_employee_id) : null })
      });
      if (response.ok) { setShowRequestCourse(false); setNewRequest({ title: '', description: '', reason: '', external_url: '', provider: '', for_employee_id: '' }); fetchCourseRequests(); }
    } catch (error) { console.error('Error submitting request:', error); }
  };

  const reviewCourseRequest = async (requestId: number, approved: boolean, comment: string) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/requests/${requestId}/review`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ approved, comment })
      });
      if (response.ok) { fetchCourseRequests(); }
    } catch (error) { console.error('Error reviewing request:', error); }
  };

  // EPF actions
  const openEvalModal = (epf: PostTrainingEval) => {
    setSelectedEpf(epf);
    const criteria = epf.criteria_scores || epfSettings?.default_criteria || [
      { code: 'maitrise_theorique', label: 'Maîtrise théorique', score: 0, weight: 25 },
      { code: 'application_pratique', label: 'Application pratique', score: 0, weight: 25 },
      { code: 'participation', label: 'Participation & engagement', score: 0, weight: 25 },
      { code: 'comprehension_globale', label: 'Compréhension globale', score: 0, weight: 25 }
    ];
    setEvalCriteria(criteria.map(c => ({ ...c, score: c.score || 0 })));
    setEvalComments(''); setEvalStrengths(''); setEvalImprovements(''); setShowEvalModal(true);
  };

  const computeWeightedScore = (criteria: CriteriaScore[]): number => {
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;
    return Math.round(criteria.reduce((sum, c) => sum + (c.score * c.weight / totalWeight), 0) * 10) / 10;
  };

  const submitEvaluation = async () => {
    if (!selectedEpf) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/${selectedEpf.id}/evaluate`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ criteria_scores: evalCriteria, comments: evalComments || null, strengths: evalStrengths || null, improvements: evalImprovements || null })
      });
      if (response.ok) { setShowEvalModal(false); setSelectedEpf(null); fetchEpfPending(); fetchEpfAll(); fetchEpfStats(); }
      else { const error = await response.json(); toast.error('Erreur: ' + (error.detail || 'Impossible de soumettre')); }
    } catch (error) { console.error('Error submitting evaluation:', error); toast.error('Erreur de connexion'); }
    finally { setIsSubmitting(false); }
  };

  const assignEvaluator = async () => {
    if (!showAssignEvaluator || !selectedEvaluatorId) return;
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/${showAssignEvaluator.id}/assign-evaluator`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ evaluator_id: parseInt(selectedEvaluatorId), evaluator_type: 'internal' })
      });
      if (response.ok) { setShowAssignEvaluator(null); setSelectedEvaluatorId(''); fetchEpfPending(); fetchEpfAll(); }
      else { const error = await response.json(); toast.error('Erreur: ' + (error.detail || 'Erreur')); }
    } catch (error) { console.error('Error assigning evaluator:', error); }
  };

  const syncCareer = async (evalId: number) => {
    if (!confirm('Synchroniser ce score avec le module Carrière ?')) return;
    try {
      const response = await fetch(`${API_URL}/api/learning/post-eval/${evalId}/sync-career`, { method: 'POST', headers: getAuthHeaders() });
      if (response.ok) { fetchEpfAll(); toast.success('Score synchronisé avec le module Carrière'); }
      else { const error = await response.json(); toast.error('Erreur: ' + (error.detail || 'Erreur')); }
    } catch (error) { console.error('Error syncing career:', error); }
  };

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: LearningContextType = {
    userRole, currentUserId, isLoading,
    courses, learningPaths, certifications, skills, developmentPlans, courseRequests,
    stats, monthlyStats, categoryStats, topLearners, employees, pendingValidations,
    myAssignments, teamAssignments, certHolders,
    epfPending, epfAll, epfStats, epfSettings: epfSettings, setEpfSettings: setEpfSettingsState,
    selectedCategory, setSelectedCategory, searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse, showCreateCourse, setShowCreateCourse,
    showAssignModal, setShowAssignModal, showValidationModal, setShowValidationModal,
    selectedAssignment, setSelectedAssignment,
    showCreateCertification, setShowCreateCertification,
    showCreatePlan, setShowCreatePlan, showEditPlan, setShowEditPlan,
    selectedPlan, setSelectedPlan, showCertHolders, setShowCertHolders,
    showCreatePath, setShowCreatePath, showRequestCourse, setShowRequestCourse,
    showCreateSkill, setShowCreateSkill, showCancelPlan, setShowCancelPlan,
    cancelReason, setCancelReason, planToCancel, setPlanToCancel,
    showCompleteModal, setShowCompleteModal, assignmentToComplete, setAssignmentToComplete,
    completionNote, setCompletionNote, completionFile, setCompletionFile, isSubmitting,
    showEvalModal, setShowEvalModal, selectedEpf, setSelectedEpf,
    evalCriteria, setEvalCriteria, evalComments, setEvalComments,
    evalStrengths, setEvalStrengths, evalImprovements, setEvalImprovements,
    showEpfDetail, setShowEpfDetail, showEpfHistory, setShowEpfHistory,
    showEpfSettings, setShowEpfSettings, showAssignEvaluator, setShowAssignEvaluator,
    selectedEvaluatorId, setSelectedEvaluatorId, epfSubTab, setEpfSubTab,
    newCourse, setNewCourse, assignData, setAssignData,
    validationData, setValidationData, newCertification, setNewCertification,
    newPath, setNewPath, newPlan, setNewPlan, editPlanData, setEditPlanData,
    newRequest, setNewRequest, newSkill, setNewSkill,
    startAssignment, openCompleteModal, completeAssignment,
    createCourse, createPath, assignCourse, validateAssignment,
    createCertificationType, createSkill, createDevelopmentPlan,
    openEditPlanModal, updateDevelopmentPlan, cancelDevelopmentPlan, archiveDevelopmentPlan,
    submitCourseRequest, reviewCourseRequest, fetchCertificationHolders, getVisiblePlans,
    refreshPaths: fetchLearningPaths,
    openEvalModal, computeWeightedScore, submitEvaluation, assignEvaluator,
    syncCareer, fetchEmployeeHistory, fetchEpfSettings: fetchEpfSettingsFn, fetchEpfStats,
  };

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}
