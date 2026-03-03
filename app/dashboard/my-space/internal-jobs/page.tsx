'use client';

import Header from '@/components/Header';
import { useState, useEffect, useCallback } from 'react';
import PageTourTips, { RestartPageTipsButton } from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { internalJobsTips } from '@/config/pageTips';
import { 
  Briefcase, MapPin, Clock, Building2, Users, Search,
  ChevronRight, Check, Send, FileText, Calendar, DollarSign,
  ExternalLink, X, Loader2, CheckCircle,
  AlertCircle, Eye, TrendingUp
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface Job {
  id: number;
  title: string;
  department_id: number | null;
  department_name: string | null;
  location: string;
  remote_policy: string;
  contract_type: string;
  description: string | null;
  responsibilities: string[] | null;
  requirements: string[] | null;
  nice_to_have: string[] | null;
  benefits: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  show_salary: boolean;
  urgency: string;
  posted_at: string | null;
  deadline: string | null;
  applicants_count: number;
}

interface MyApplication {
  id: number;
  job_posting_id: number;
  job_title: string;
  department_name: string | null;
  stage: string;
  applied_at: string;
  updated_at: string;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department_name: string | null;
  position: string | null;
}

// ============================================
// API CONFIG
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-06c3.up.railway.app';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchOpenJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/jobs?status=active&page_size=100`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

async function fetchMyApplications(): Promise<MyApplication[]> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/my-applications`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function fetchCurrentEmployee(): Promise<Employee | null> {
  try {
    const res = await fetch(`${API_URL}/api/employees/me`, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function applyToJob(jobId: number, coverLetter?: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cover_letter: coverLetter })
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.detail || 'Erreur lors de la candidature' };
    return { success: true, message: 'Candidature envoyée avec succès !' };
  } catch { return { success: false, message: 'Erreur de connexion' }; }
}

// ============================================
// HELPERS
// ============================================

const stageLabels: Record<string, string> = {
  new: 'Candidature reçue',
  screening: 'En cours d\'examen',
  phone_screen: 'Entretien téléphonique',
  hr_interview: 'Entretien RH',
  technical: 'Entretien technique',
  final: 'Entretien final',
  offer: 'Offre en cours',
  hired: 'Embauché',
  rejected: 'Non retenu',
  withdrawn: 'Candidature retirée'
};

const stageColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  screening: 'bg-purple-100 text-purple-700',
  phone_screen: 'bg-indigo-100 text-indigo-700',
  hr_interview: 'bg-violet-100 text-violet-700',
  technical: 'bg-orange-100 text-orange-700',
  final: 'bg-yellow-100 text-yellow-700',
  offer: 'bg-green-100 text-green-700',
  hired: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-700'
};

const remotePolicyLabels: Record<string, string> = {
  onsite: 'Sur site',
  hybrid: 'Hybride',
  remote: 'Full Remote'
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function CareersPage() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'applications'>('jobs');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [contractFilter, setContractFilter] = useState<string>('');
  const [remoteFilter, setRemoteFilter] = useState<string>('');
  
  // Modal states
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string } | null>(null);

  // Tour tips
  const { showTips, dismissTips, resetTips } = usePageTour('internalJobs');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [jobsData, applicationsData, employeeData] = await Promise.all([
      fetchOpenJobs(),
      fetchMyApplications(),
      fetchCurrentEmployee()
    ]);
    setJobs(jobsData);
    setMyApplications(applicationsData);
    setCurrentEmployee(employeeData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Get unique departments for filter
  const departments = Array.from(new Set(jobs.map(j => j.department_name).filter(Boolean))) as string[];
  const contractTypes = Array.from(new Set(jobs.map(j => j.contract_type).filter(Boolean)));

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!job.title.toLowerCase().includes(q) && 
          !(job.department_name || '').toLowerCase().includes(q) &&
          !job.location.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (departmentFilter && job.department_name !== departmentFilter) return false;
    if (contractFilter && job.contract_type !== contractFilter) return false;
    if (remoteFilter && job.remote_policy !== remoteFilter) return false;
    return true;
  });

  // Check if user already applied to a job
  const hasApplied = (jobId: number) => myApplications.some(a => a.job_posting_id === jobId);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatSalary = (min: number | null, max: number | null, currency: string) => {
    if (!min && !max) return null;
    const fmt = (n: number) => `${(n / 1000000).toFixed(1)}M`;
    if (min && max) return `${fmt(min)} - ${fmt(max)} ${currency}`;
    if (min) return `À partir de ${fmt(min)} ${currency}`;
    return `Jusqu'à ${fmt(max!)} ${currency}`;
  };

  const getDaysAgo = (dateStr: string | null) => {
    if (!dateStr) return null;
    const days = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    return `Il y a ${days} jours`;
  };

  const handleApply = async () => {
    if (!applyingJob) return;
    setApplying(true);
    const result = await applyToJob(applyingJob.id, coverLetter || undefined);
    setApplyResult(result);
    setApplying(false);
    if (result.success) {
      setTimeout(() => {
        setShowApplyModal(false);
        setApplyingJob(null);
        setCoverLetter('');
        setApplyResult(null);
        loadData();
      }, 2000);
    }
  };

  const openApplyModal = (job: Job) => {
    setApplyingJob(job);
    setCoverLetter('');
    setApplyResult(null);
    setShowApplyModal(true);
  };

  if (loading) {
    return (
      <>
        <Header title="Offres Internes" subtitle="Postulez aux opportunités et suivez vos candidatures" />
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" />
            <p className="text-gray-500">Chargement des offres...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips
          tips={internalJobsTips}
          onTipDismiss={dismissTips}
        />
      )}
      <RestartPageTipsButton onRestart={resetTips} />
      
      <Header title="Offres Internes" subtitle="Postulez aux opportunités et suivez vos candidatures" />
      
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Postes Ouverts</p>
                <p className="text-2xl font-bold text-gray-900">{jobs.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Mes Candidatures</p>
                <p className="text-2xl font-bold text-purple-600">{myApplications.length}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">En Cours</p>
                <p className="text-2xl font-bold text-orange-600">
                  {myApplications.filter(a => !['hired', 'rejected', 'withdrawn'].includes(a.stage)).length}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Départements</p>
                <p className="text-2xl font-bold text-green-600">{departments.length}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            <button 
              onClick={() => setActiveTab('jobs')} 
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'jobs' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Briefcase className="w-4 h-4 inline mr-2" />
              Offres d&apos;Emploi ({jobs.length})
            </button>
            <button 
              onClick={() => setActiveTab('applications')} 
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'applications' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Mes Candidatures ({myApplications.length})
            </button>
          </div>
        </div>

        {/* TAB: Jobs */}
        {activeTab === 'jobs' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher par titre, département, localisation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Tous les départements</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select
                    value={contractFilter}
                    onChange={(e) => setContractFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Tous les contrats</option>
                    {contractTypes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={remoteFilter}
                    onChange={(e) => setRemoteFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Tous les modes</option>
                    <option value="onsite">Sur site</option>
                    <option value="hybrid">Hybride</option>
                    <option value="remote">Full Remote</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Jobs List */}
            {filteredJobs.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">Aucune offre trouvée</p>
                <p className="text-sm text-gray-400">Modifiez vos filtres ou revenez plus tard</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredJobs.map((job) => {
                  const applied = hasApplied(job.id);
                  return (
                    <div 
                      key={job.id} 
                      className={`bg-white rounded-xl p-5 shadow-sm border transition-all hover:shadow-md ${applied ? 'border-green-200 bg-green-50/30' : 'border-gray-100'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{job.title}</h3>
                            {applied && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                <Check className="w-3 h-3 mr-1" />
                                Candidature envoyée
                              </span>
                            )}
                            {job.urgency === 'high' && !applied && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                                Urgent
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                            {job.department_name && (
                              <span className="flex items-center">
                                <Building2 className="w-3.5 h-3.5 mr-1" />
                                {job.department_name}
                              </span>
                            )}
                            <span className="flex items-center">
                              <MapPin className="w-3.5 h-3.5 mr-1" />
                              {job.location}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {remotePolicyLabels[job.remote_policy] || job.remote_policy}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                          {job.contract_type}
                        </span>
                        {job.show_salary && formatSalary(job.salary_min, job.salary_max, job.salary_currency) && (
                          <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-full flex items-center">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
                          </span>
                        )}
                      </div>

                      {job.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {job.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center">
                            <Calendar className="w-3.5 h-3.5 mr-1" />
                            {getDaysAgo(job.posted_at)}
                          </span>
                          <span className="flex items-center">
                            <Users className="w-3.5 h-3.5 mr-1" />
                            {job.applicants_count} candidat{job.applicants_count > 1 ? 's' : ''}
                          </span>
                          {job.deadline && (
                            <span className="flex items-center text-orange-500">
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              Deadline: {formatDate(job.deadline)}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setSelectedJob(job); setShowJobModal(true); }}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4 inline mr-1" />
                            Détails
                          </button>
                          {!applied ? (
                            <button
                              onClick={() => openApplyModal(job)}
                              className="px-4 py-1.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors flex items-center"
                            >
                              <Send className="w-4 h-4 mr-1" />
                              Postuler
                            </button>
                          ) : (
                            <span className="px-4 py-1.5 bg-gray-100 text-gray-500 text-sm rounded-lg flex items-center">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Déjà postulé
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* TAB: My Applications */}
        {activeTab === 'applications' && (
          <>
            {myApplications.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">Vous n&apos;avez pas encore postulé</p>
                <p className="text-sm text-gray-400 mb-4">Consultez les offres disponibles et postulez !</p>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600"
                >
                  Voir les offres
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myApplications.map((app) => {
                  const job = jobs.find(j => j.id === app.job_posting_id);
                  return (
                    <div key={app.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                            <Briefcase className="w-6 h-6 text-primary-600" />
                          </div>
                          <div className="ml-4 flex-1">
                            <h4 className="font-semibold text-gray-900">{app.job_title}</h4>
                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                              {app.department_name && (
                                <span className="flex items-center">
                                  <Building2 className="w-3.5 h-3.5 mr-1" />
                                  {app.department_name}
                                </span>
                              )}
                              <span className="flex items-center">
                                <Calendar className="w-3.5 h-3.5 mr-1" />
                                Postulé le {formatDate(app.applied_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${stageColors[app.stage] || 'bg-gray-100 text-gray-700'}`}>
                              {stageLabels[app.stage] || app.stage}
                            </span>
                            <p className="text-xs text-gray-400 mt-1">
                              Mis à jour: {formatDate(app.updated_at)}
                            </p>
                          </div>
                          {job && (
                            <button
                              onClick={() => { setSelectedJob(job); setShowJobModal(true); }}
                              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="Voir l'offre"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                          <span>Progression</span>
                          <span>{getProgressPercentage(app.stage)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${app.stage === 'rejected' || app.stage === 'withdrawn' ? 'bg-red-400' : app.stage === 'hired' ? 'bg-green-500' : 'bg-primary-500'}`}
                            style={{ width: `${getProgressPercentage(app.stage)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-gray-400">
                          <span>Candidature</span>
                          <span>Entretiens</span>
                          <span>Décision</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Job Detail Modal */}
        {showJobModal && selectedJob && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-start justify-between sticky top-0 bg-white">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedJob.title}</h2>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    {selectedJob.department_name && (
                      <span className="flex items-center">
                        <Building2 className="w-4 h-4 mr-1" />
                        {selectedJob.department_name}
                      </span>
                    )}
                    <span className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {selectedJob.location}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowJobModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Quick Info */}
                <div className="flex flex-wrap gap-3">
                  <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-full">
                    {selectedJob.contract_type}
                  </span>
                  <span className="px-3 py-1.5 bg-purple-100 text-purple-700 text-sm rounded-full">
                    {remotePolicyLabels[selectedJob.remote_policy]}
                  </span>
                  {selectedJob.show_salary && formatSalary(selectedJob.salary_min, selectedJob.salary_max, selectedJob.salary_currency) && (
                    <span className="px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-full">
                      {formatSalary(selectedJob.salary_min, selectedJob.salary_max, selectedJob.salary_currency)}
                    </span>
                  )}
                  {selectedJob.deadline && (
                    <span className="px-3 py-1.5 bg-orange-100 text-orange-700 text-sm rounded-full">
                      Deadline: {formatDate(selectedJob.deadline)}
                    </span>
                  )}
                </div>

                {/* Description */}
                {selectedJob.description && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Description du poste</h3>
                    <p className="text-gray-600 whitespace-pre-line">{selectedJob.description}</p>
                  </div>
                )}

                {/* Responsibilities */}
                {selectedJob.responsibilities && selectedJob.responsibilities.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Responsabilités</h3>
                    <ul className="space-y-2">
                      {selectedJob.responsibilities.map((r, i) => (
                        <li key={i} className="flex items-start text-gray-600">
                          <ChevronRight className="w-4 h-4 mr-2 mt-0.5 text-primary-500 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Requirements */}
                {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Prérequis</h3>
                    <ul className="space-y-2">
                      {selectedJob.requirements.map((r, i) => (
                        <li key={i} className="flex items-start text-gray-600">
                          <Check className="w-4 h-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Nice to have */}
                {selectedJob.nice_to_have && selectedJob.nice_to_have.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Atouts appréciés</h3>
                    <ul className="space-y-2">
                      {selectedJob.nice_to_have.map((r, i) => (
                        <li key={i} className="flex items-start text-gray-600">
                          <TrendingUp className="w-4 h-4 mr-2 mt-0.5 text-blue-500 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Benefits */}
                {selectedJob.benefits && selectedJob.benefits.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Avantages</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedJob.benefits.map((b, i) => (
                        <span key={i} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm rounded-full">
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-between items-center sticky bottom-0 bg-white">
                <div className="text-sm text-gray-500">
                  <Users className="w-4 h-4 inline mr-1" />
                  {selectedJob.applicants_count} candidat{selectedJob.applicants_count > 1 ? 's' : ''}
                  {selectedJob.posted_at && <span className="ml-3">• Publié {getDaysAgo(selectedJob.posted_at)}</span>}
                </div>
                {hasApplied(selectedJob.id) ? (
                  <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Candidature envoyée
                  </span>
                ) : (
                  <button
                    onClick={() => { setShowJobModal(false); openApplyModal(selectedJob); }}
                    className="px-6 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 flex items-center"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Postuler maintenant
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Apply Modal */}
        {showApplyModal && applyingJob && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Postuler à cette offre</h2>
                <p className="text-gray-500 mt-1">{applyingJob.title}</p>
              </div>
              
              {applyResult ? (
                <div className="p-8 text-center">
                  {applyResult.success ? (
                    <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Candidature envoyée !</h3>
                      <p className="text-gray-500">{applyResult.message}</p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur</h3>
                      <p className="text-gray-500">{applyResult.message}</p>
                      <button
                        onClick={() => setApplyResult(null)}
                        className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Réessayer
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="p-6">
                    {currentEmployee && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-sm text-gray-500 mb-1">Vous postulez en tant que :</p>
                        <p className="font-medium text-gray-900">
                          {currentEmployee.first_name} {currentEmployee.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{currentEmployee.email}</p>
                        {currentEmployee.position && (
                          <p className="text-sm text-gray-500 mt-1">
                            Poste actuel : {currentEmployee.position}
                            {currentEmployee.department_name && ` • ${currentEmployee.department_name}`}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lettre de motivation (optionnel)
                      </label>
                      <textarea
                        rows={6}
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                        placeholder="Expliquez pourquoi vous êtes intéressé par ce poste et ce que vous pouvez apporter..."
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Une lettre de motivation peut augmenter vos chances d&apos;être retenu
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button
                      onClick={() => { setShowApplyModal(false); setApplyingJob(null); }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={applying}
                      className="px-6 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center"
                    >
                      {applying ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Envoyer ma candidature
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

// Helper function for progress percentage
function getProgressPercentage(stage: string): number {
  const stages: Record<string, number> = {
    new: 10,
    screening: 25,
    phone_screen: 40,
    hr_interview: 50,
    technical: 65,
    final: 80,
    offer: 90,
    hired: 100,
    rejected: 100,
    withdrawn: 100
  };
  return stages[stage] || 10;
}