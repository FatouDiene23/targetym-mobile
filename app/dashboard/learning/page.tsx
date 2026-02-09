'use client';

import Header from '@/components/Header';
import { useState, useEffect } from 'react';
import { 
  BookOpen, Award, Clock, Users, CheckCircle, Plus, Search,
  TrendingUp, Target, ChevronRight, AlertTriangle,
  GraduationCap, BarChart3, X, User, ArrowRight, Upload, ExternalLink,
  Check, XCircle, RefreshCw, Eye
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const API_URL = 'https://web-production-06c3.up.railway.app';

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
  initials: string;
  role: string;
  targetRole: string;
  progress: number;
  status: string;
  skills: { name: string; current: number; target: number }[];
  courses: { title: string; status: string }[];
  target_date: string;
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

export default function LearningPage() {
  // États
  const [activeTab, setActiveTab] = useState<'catalog' | 'paths' | 'certifications' | 'development' | 'analytics'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data states
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [developmentPlans, setDevelopmentPlans] = useState<DevelopmentPlan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [topLearners, setTopLearners] = useState<TopLearner[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pendingValidations, setPendingValidations] = useState<Assignment[]>([]);
  
  // Modal states
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showCreateCertification, setShowCreateCertification] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCertHolders, setShowCertHolders] = useState<Certification | null>(null);
  const [certHolders, setCertHolders] = useState<CertificationHolder[]>([]);

  // Form states
  const [newCourse, setNewCourse] = useState({
    title: '', description: '', category: 'Technique', provider: '',
    external_url: '', duration_hours: '', level: 'beginner', image_emoji: '📚', is_mandatory: false
  });
  const [assignData, setAssignData] = useState({ employee_id: '', course_id: '', deadline: '' });
  const [validationData, setValidationData] = useState({ approved: true, rejection_reason: '' });
  const [newCertification, setNewCertification] = useState({ name: '', provider: '', description: '', validity_months: '' });
  const [newPlan, setNewPlan] = useState({
    employee_id: '', current_role: '', target_role: '', target_date: '',
    skill_ids: [] as number[], course_ids: [] as number[]
  });

  const categories = ['Tous', 'Soft Skills', 'Technique', 'Management', 'Commercial', 'Innovation', 'Juridique'];

  // Fetch functions
  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchCourses = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'Tous') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`${API_URL}/api/learning/courses/?${params}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setCourses(data.items || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchLearningPaths = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/paths/`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setLearningPaths(data || []);
    } catch (error) {
      console.error('Error fetching paths:', error);
    }
  };

  const fetchPendingValidations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/assignments/?pending_validation=true`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setPendingValidations(data.items || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchCertifications = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/certifications/`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setCertifications(data || []);
    } catch (error) {
      console.error('Error fetching certifications:', error);
    }
  };

  const fetchCertificationHolders = async (certId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/learning/certifications/${certId}/holders`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setCertHolders(data || []);
    } catch (error) {
      console.error('Error fetching holders:', error);
    }
  };

  const fetchSkills = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/skills/`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setSkills(data || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
    }
  };

  const fetchDevelopmentPlans = async () => {
    try {
      const response = await fetch(`${API_URL}/api/learning/development-plans/`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setDevelopmentPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchStats = async () => {
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
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees/?page_size=500`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setEmployees(data.items || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchCourses(),
        fetchLearningPaths(),
        fetchPendingValidations(),
        fetchCertifications(),
        fetchSkills(),
        fetchDevelopmentPlans(),
        fetchStats(),
        fetchEmployees()
      ]);
      setIsLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload courses when filters change
  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchQuery]);

  // Action functions
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
    if (status === 'pending_validation') return 'bg-orange-100 text-orange-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getCertStatusColor = (status: string) => {
    if (status === 'valid') return 'text-green-600';
    if (status === 'expiring') return 'text-orange-600';
    return 'text-red-600';
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

  return (
    <>
      <Header title="Formation & Développement" subtitle="Catalogue, parcours, certifications et plans de développement" />
      
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Formations</p><p className="text-2xl font-bold text-gray-900">{stats?.total_courses || 0}</p></div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Complétées (Mois)</p><p className="text-2xl font-bold text-green-600">{stats?.completed_this_month || 0}</p></div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Heures (Mois)</p><p className="text-2xl font-bold text-purple-600">{stats?.hours_this_month || 0}h</p></div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-purple-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Certifications</p><p className="text-2xl font-bold text-orange-600">{stats?.total_certifications || 0}</p></div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><Award className="w-5 h-5 text-orange-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Taux Complétion</p><p className="text-2xl font-bold text-teal-600">{stats?.completion_rate || 0}%</p></div>
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-teal-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">À Valider</p><p className="text-2xl font-bold text-amber-600">{stats?.pending_validation || 0}</p></div>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Cert. Expirent</p><p className="text-2xl font-bold text-red-600">{stats?.expiring_certifications || 0}</p></div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            <button onClick={() => setActiveTab('catalog')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'catalog' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <BookOpen className="w-4 h-4 inline mr-2" />Catalogue
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
            <button onClick={() => setActiveTab('analytics')} className={`flex-shrink-0 px-6 py-4 text-sm font-medium ${activeTab === 'analytics' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <BarChart3 className="w-4 h-4 inline mr-2" />Analytics
            </button>
          </div>
        </div>

        {/* Pending Validations Alert */}
        {pendingValidations.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">{pendingValidations.length} formation(s) en attente de validation</p>
              <p className="text-xs text-amber-600">Des employés ont terminé leurs formations et attendent votre validation</p>
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
            {/* Search & Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Rechercher une formation..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" 
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)} 
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${selectedCategory === cat ? 'bg-primary-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowCreateCourse(true)}
                className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
              >
                <Plus className="w-4 h-4 mr-2" />Ajouter
              </button>
              <button 
                onClick={() => setShowAssignModal(true)}
                className="flex items-center px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600"
              >
                <User className="w-4 h-4 mr-2" />Assigner
              </button>
            </div>

            {/* Course Grid */}
            {courses.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune formation trouvée</p>
                <button 
                  onClick={() => setShowCreateCourse(true)}
                  className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  Créer une formation
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {courses.map((course) => (
                  <div 
                    key={course.id} 
                    onClick={() => setSelectedCourse(course)} 
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                  >
                    <div className="h-32 bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-5xl relative">
                      {course.image_emoji || '📚'}
                      {course.is_mandatory && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded">
                          Obligatoire
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Eye className="w-12 h-12 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(course.level)}`}>
                          {getLevelLabel(course.level)}
                        </span>
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
                            <div 
                              className="h-full bg-green-500 rounded-full" 
                              style={{ width: `${course.completion_rate}%` }} 
                            />
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

        {/* TAB: Parcours */}
        {activeTab === 'paths' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Parcours de Formation</h3>
              <button className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600">
                <Plus className="w-4 h-4 mr-2" />Créer un Parcours
              </button>
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
                          <div 
                            className={`h-full rounded-full ${path.progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`} 
                            style={{ width: `${path.progress}%` }} 
                          />
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
              <button 
                onClick={() => setShowCreateCertification(true)}
                className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
              >
                <Plus className="w-4 h-4 mr-2" />Ajouter Certification
              </button>
            </div>

            {stats?.expiring_certifications && stats.expiring_certifications > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800">{stats.expiring_certifications} certifications expirent dans les 3 prochains mois</p>
                  <p className="text-xs text-orange-600">Planifiez les renouvellements pour maintenir la conformité</p>
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
                  <div 
                    key={cert.id} 
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md"
                    onClick={() => {
                      setShowCertHolders(cert);
                      fetchCertificationHolders(cert.id);
                    }}
                  >
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
                        <span className="text-sm text-gray-600">
                          Validité: {cert.validity_months ? `${cert.validity_months} mois` : 'Permanent'}
                        </span>
                        {cert.expiring_soon > 0 && (
                          <span className="text-xs text-orange-600 flex items-center">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {cert.expiring_soon} expiration(s) proche(s)
                          </span>
                        )}
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
              <button 
                onClick={() => setShowCreatePlan(true)}
                className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
              >
                <Plus className="w-4 h-4 mr-2" />Créer un Plan
              </button>
            </div>
            
            {developmentPlans.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucun plan de développement</p>
              </div>
            ) : (
              developmentPlans.map((plan) => (
                <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg">
                          {plan.initials}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{plan.employee}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{plan.role}</span>
                            <ArrowRight className="w-4 h-4" />
                            <span className="text-primary-600 font-medium">{plan.targetRole}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-primary-600">{plan.progress}%</p>
                        <p className="text-xs text-gray-500">progression</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 grid md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-3">Compétences à développer</h5>
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
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-3">Formations assignées</h5>
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
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Analytics */}
        {activeTab === 'analytics' && (
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
                    <Pie 
                      data={categoryStats} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={100} 
                      dataKey="value" 
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {categoryStats.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
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
                        <span className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center text-xs font-bold text-yellow-700">
                          {i + 1}
                        </span>
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

        {/* MODALS */}

        {/* Course Detail Modal */}
        {selectedCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="relative h-48 bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <span className="text-7xl">{selectedCourse.image_emoji || '📚'}</span>
                <button onClick={() => setSelectedCourse(null)} className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                  <X className="w-5 h-5 text-white" />
                </button>
                {selectedCourse.is_mandatory && (
                  <span className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-lg">
                    Obligatoire
                  </span>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(selectedCourse.level)}`}>
                    {getLevelLabel(selectedCourse.level)}
                  </span>
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
                  <a 
                    href={selectedCourse.external_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-6"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Accéder à la formation externe
                  </a>
                )}
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setAssignData({ ...assignData, course_id: selectedCourse.id.toString() });
                      setSelectedCourse(null);
                      setShowAssignModal(true);
                    }}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600"
                  >
                    <User className="w-5 h-5 mr-2" />Assigner à un employé
                  </button>
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
                  <button onClick={() => setShowCreateCourse(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                  <input 
                    type="text" 
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Ex: Leadership & Management"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    value={newCourse.description}
                    onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select 
                      value={newCourse.category}
                      onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
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
                    <select 
                      value={newCourse.level}
                      onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="beginner">Débutant</option>
                      <option value="intermediate">Intermédiaire</option>
                      <option value="advanced">Avancé</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durée (heures)</label>
                    <input 
                      type="number" 
                      value={newCourse.duration_hours}
                      onChange={(e) => setNewCourse({ ...newCourse, duration_hours: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Ex: 8"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
                    <input 
                      type="text" 
                      value={newCourse.image_emoji}
                      onChange={(e) => setNewCourse({ ...newCourse, image_emoji: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="📚"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur (ex: Coursera)</label>
                  <input 
                    type="text" 
                    value={newCourse.provider}
                    onChange={(e) => setNewCourse({ ...newCourse, provider: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL externe</label>
                  <input 
                    type="url" 
                    value={newCourse.external_url}
                    onChange={(e) => setNewCourse({ ...newCourse, external_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="mandatory"
                    checked={newCourse.is_mandatory}
                    onChange={(e) => setNewCourse({ ...newCourse, is_mandatory: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="mandatory" className="text-sm text-gray-700">Formation obligatoire</label>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button 
                  onClick={() => setShowCreateCourse(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button 
                  onClick={createCourse}
                  disabled={!newCourse.title}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  Créer
                </button>
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
                  <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label>
                  <select 
                    value={assignData.employee_id}
                    onChange={(e) => setAssignData({ ...assignData, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Sélectionner...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} - {emp.job_title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Formation *</label>
                  <select 
                    value={assignData.course_id}
                    onChange={(e) => setAssignData({ ...assignData, course_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Sélectionner...</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date limite (optionnel)</label>
                  <input 
                    type="date" 
                    value={assignData.deadline}
                    onChange={(e) => setAssignData({ ...assignData, deadline: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button 
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button 
                  onClick={assignCourse}
                  disabled={!assignData.employee_id || !assignData.course_id}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  Assigner
                </button>
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
                  <button onClick={() => setShowValidationModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                    {selectedAssignment.employee_initials}
                  </div>
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
                    <a 
                      href={`${API_URL}${selectedAssignment.certificate_file}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-auto text-blue-600 hover:underline text-sm"
                    >
                      Voir
                    </a>
                  </div>
                )}

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => setValidationData({ ...validationData, approved: true })}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      validationData.approved 
                        ? 'border-green-500 bg-green-50 text-green-700' 
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    <Check className="w-5 h-5" />
                    Approuver
                  </button>
                  <button
                    onClick={() => setValidationData({ ...validationData, approved: false })}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      !validationData.approved 
                        ? 'border-red-500 bg-red-50 text-red-700' 
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    <XCircle className="w-5 h-5" />
                    Rejeter
                  </button>
                </div>

                {!validationData.approved && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Raison du rejet</label>
                    <textarea 
                      value={validationData.rejection_reason}
                      onChange={(e) => setValidationData({ ...validationData, rejection_reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={2}
                      placeholder="Expliquez pourquoi..."
                    />
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button 
                  onClick={() => setShowValidationModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button 
                  onClick={validateAssignment}
                  className={`flex-1 px-4 py-2 text-white rounded-lg ${
                    validationData.approved 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
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
                  <button onClick={() => setShowCreateCertification(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input 
                    type="text" 
                    value={newCertification.name}
                    onChange={(e) => setNewCertification({ ...newCertification, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Ex: AWS Solutions Architect"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                  <input 
                    type="text" 
                    value={newCertification.provider}
                    onChange={(e) => setNewCertification({ ...newCertification, provider: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Ex: Amazon"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    value={newCertification.description}
                    onChange={(e) => setNewCertification({ ...newCertification, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validité (mois)</label>
                  <input 
                    type="number" 
                    value={newCertification.validity_months}
                    onChange={(e) => setNewCertification({ ...newCertification, validity_months: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Laisser vide si permanent"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button 
                  onClick={() => setShowCreateCertification(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button 
                  onClick={createCertificationType}
                  disabled={!newCertification.name}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  Créer
                </button>
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
                  <button onClick={() => setShowCertHolders(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Titulaires ({certHolders.length})</h3>
                {certHolders.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucun titulaire</p>
                ) : (
                  <div className="space-y-3">
                    {certHolders.map((holder) => (
                      <div key={holder.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                            {holder.employee_initials}
                          </div>
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
                  <button onClick={() => setShowCreatePlan(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label>
                  <select 
                    value={newPlan.employee_id}
                    onChange={(e) => setNewPlan({ ...newPlan, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Sélectionner...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Poste actuel</label>
                    <input 
                      type="text" 
                      value={newPlan.current_role}
                      onChange={(e) => setNewPlan({ ...newPlan, current_role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Poste cible</label>
                    <input 
                      type="text" 
                      value={newPlan.target_role}
                      onChange={(e) => setNewPlan({ ...newPlan, target_role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date cible</label>
                  <input 
                    type="date" 
                    value={newPlan.target_date}
                    onChange={(e) => setNewPlan({ ...newPlan, target_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Compétences à développer</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {skills.map((skill) => (
                      <label key={skill.id} className="flex items-center gap-2">
                        <input 
                          type="checkbox"
                          checked={newPlan.skill_ids.includes(skill.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewPlan({ ...newPlan, skill_ids: [...newPlan.skill_ids, skill.id] });
                            } else {
                              setNewPlan({ ...newPlan, skill_ids: newPlan.skill_ids.filter(id => id !== skill.id) });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{skill.name}</span>
                        <span className="text-xs text-gray-400">({skill.category})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formations à assigner</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {courses.map((course) => (
                      <label key={course.id} className="flex items-center gap-2">
                        <input 
                          type="checkbox"
                          checked={newPlan.course_ids.includes(course.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewPlan({ ...newPlan, course_ids: [...newPlan.course_ids, course.id] });
                            } else {
                              setNewPlan({ ...newPlan, course_ids: newPlan.course_ids.filter(id => id !== course.id) });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{course.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button 
                  onClick={() => setShowCreatePlan(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button 
                  onClick={createDevelopmentPlan}
                  disabled={!newPlan.employee_id}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  Créer
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}