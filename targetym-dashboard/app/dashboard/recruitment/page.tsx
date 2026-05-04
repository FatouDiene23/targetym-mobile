'use client';
import Link from 'next/link';
import { getToken } from '@/lib/api';
import { getAIScoringStatus, requestAIScoringAddon, type AIScoringStatus } from '@/lib/api';
import PageLoading from '@/components/PageLoading';

import Header from '@/components/Header';
import CustomSelect from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { useGroupContext } from '@/hooks/useGroupContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  UserPlus, Briefcase, Users, Clock, Mail, Phone, MapPin, Plus, XCircle,
  FileText, Linkedin, GraduationCap, Building2, TrendingUp, Edit,
  ArrowRight, MessageSquare, Video, Search, X, Check, Loader2, Calendar, Trash2, RefreshCw,
  Brain, Upload, Sparkles, CheckCircle2, AlertCircle, MinusCircle, ExternalLink, Download, ChevronDown, ChevronUp, Rocket, Lock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';
import { useI18n } from '@/lib/i18n/I18nContext';

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
  requirements: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  show_salary: boolean;
  visibility: string;
  status: string;
  urgency: string;
  hiring_manager_id: number | null;
  hiring_manager_name: string | null;
  posted_at: string | null;
  deadline: string | null;
  created_at: string;
  applicants_count: number;
}

interface AIScoreDetail {
  category: string;
  score: number;
}

interface TimelineEvent {
  id: number;
  event_type: string;
  event_title: string;
  event_description: string | null;
  performed_by_name: string | null;
  created_at: string;
}

interface Application {
  id: number;
  candidate_id: number;
  job_posting_id: number;
  stage: string;
  applied_at: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  candidate_location: string | null;
  candidate_skills: string[] | null;
  candidate_experience: string | null;
  candidate_education: string | null;
  candidate_ai_score: number | null;
  candidate_ai_score_details: AIScoreDetail[] | null;
  candidate_ai_analysis?: string | null;
  score_status?: string | null;
  candidate_source: string | null;
  candidate_current_company: string | null;
  candidate_expected_salary: number | null;
  salary_currency: string;
  candidate_notice_period: string | null;
  candidate_linkedin_url: string | null;
  candidate_cv_url?: string | null;
  candidate_cv_filename?: string | null;
  job_title: string | null;
  timeline: TimelineEvent[] | null;
}

interface Interview {
  id: number;
  application_id: number;
  interview_type: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_link: string | null;
  interviewer_ids: number[] | null;
  interviewer_names: string[] | null;
  candidate_name: string;
  job_title: string | null;
  feedback: string | null;
  rating: number | null;
  recommendation: string | null;
}

interface RecruitmentStats {
  open_positions: number;
  total_candidates: number;
  in_interview: number;
  avg_time_to_hire: number;
  hires_this_month: number;
}

interface PipelineStats { stage: string; stage_label: string; count: number; color: string; }
interface SourceStats { source: string; count: number; percentage: number; color: string; }
interface HiringTrend { month: string; applications: number; hires: number; }
interface DepartmentStats { department: string; count: number; }
interface TopCandidate { id: number; name: string; position: string; ai_score: number; stage: string; }

interface Analytics {
  stats: RecruitmentStats;
  pipeline: PipelineStats[];
  sources: SourceStats[];
  hiring_trend: HiringTrend[];
  by_department: DepartmentStats[];
  top_candidates: TopCandidate[];
}

interface Department { id: number; name: string; }
interface Employee { id: number; first_name: string; last_name: string; department_name?: string; is_manager?: boolean; }

// ============================================
// API CONFIG
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
    const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
}

// ============================================
// API FUNCTIONS
// ============================================

async function fetchJobs(subsidiaryTenantId?: number): Promise<Job[]> {
  try {
    const params = new URLSearchParams({ page_size: '100' });
    if (subsidiaryTenantId) params.set('subsidiary_tenant_id', subsidiaryTenantId.toString());
    const res = await fetch(`${API_URL}/api/recruitment/jobs?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

async function fetchApplications(jobId?: number, subsidiaryTenantId?: number): Promise<Application[]> {
  try {
    const params = new URLSearchParams({ page_size: '100' });
    if (jobId) params.append('job_posting_id', jobId.toString());
    if (subsidiaryTenantId) params.set('subsidiary_tenant_id', subsidiaryTenantId.toString());
    const res = await fetch(`${API_URL}/api/recruitment/applications?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

async function fetchInterviews(subsidiaryTenantId?: number): Promise<Interview[]> {
  try {
    const params = new URLSearchParams({ page_size: '100' });
    if (subsidiaryTenantId) params.set('subsidiary_tenant_id', subsidiaryTenantId.toString());
    const res = await fetch(`${API_URL}/api/recruitment/interviews?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

async function fetchStats(subsidiaryTenantId?: number): Promise<RecruitmentStats | null> {
  try {
    const params = new URLSearchParams();
    if (subsidiaryTenantId) params.set('subsidiary_tenant_id', subsidiaryTenantId.toString());
    const url = `${API_URL}/api/recruitment/stats${params.toString() ? '?' + params : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function fetchTotalCandidates(subsidiaryTenantId?: number): Promise<number> {
  try {
    const params = new URLSearchParams();
    if (subsidiaryTenantId) params.set('subsidiary_tenant_id', subsidiaryTenantId.toString());
    const url = `${API_URL}/api/recruitment/stats${params.toString() ? '?' + params : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total_candidates ?? 0;
  } catch { return 0; }
}

async function fetchAnalytics(subsidiaryTenantId?: number): Promise<Analytics | null> {
  try {
    const params = new URLSearchParams();
    if (subsidiaryTenantId) params.set('subsidiary_tenant_id', subsidiaryTenantId.toString());
    const url = `${API_URL}/api/recruitment/analytics${params.toString() ? '?' + params : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function fetchDepartments(): Promise<Department[]> {
  try {
    const res = await fetch(`${API_URL}/api/departments/`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function fetchEmployees(subsidiaryTenantId?: number): Promise<Employee[]> {
  try {
    const params = new URLSearchParams({ page_size: '200', status: 'active' });
    if (subsidiaryTenantId) params.set('subsidiary_tenant_id', subsidiaryTenantId.toString());
    const res = await fetch(`${API_URL}/api/employees/?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

async function createJob(data: Partial<Job>): Promise<Job | null> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/jobs`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function updateJob(id: number, data: Partial<Job>): Promise<Job | null> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/jobs/${id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function publishJob(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/jobs/${id}/publish`, { method: 'POST', headers: getAuthHeaders() });
    return res.ok;
  } catch { return false; }
}

async function closeJob(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/jobs/${id}/close`, { method: 'POST', headers: getAuthHeaders() });
    return res.ok;
  } catch { return false; }
}

async function deleteJob(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/jobs/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    return res.ok;
  } catch { return false; }
}

async function openCvAuthenticated(candidateId: number, download = false, errorMessages?: { notAvailable: string; openError: string }): Promise<void> {
  try {
      const token = getToken();
    const url = `${API_URL}/api/recruitment/candidates/${candidateId}/cv${download ? '?download=1' : ''}`;
    const res = await fetch(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!res.ok) { toast.error(errorMessages?.notAvailable || 'CV not available'); return; }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    if (download) {
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : 'cv.pdf';
    } else {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch { toast.error(errorMessages?.openError || 'Error opening CV'); }
}

async function deleteApplication(applicationId: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/applications/${applicationId}`, { method: 'DELETE', headers: getAuthHeaders() });
    return res.ok;
  } catch { return false; }
}

async function createCandidate(data: { first_name: string; last_name: string; email: string; phone?: string; location?: string; linkedin_url?: string; current_company?: string; experience_years?: number; education?: string; skills?: string[]; expected_salary?: number; notice_period?: string; source?: string; job_posting_id?: number; }): Promise<{ id: number } | { error: string }> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/candidates`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!res.ok) {
      let detail = 'Error during creation';
      try {
        const body = await res.json();
        detail = body.detail || body.message || detail;
        if (Array.isArray(detail)) detail = detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(', ');
      } catch {}
      return { error: detail };
    }
    const created = await res.json();
    return { id: created.id };
  } catch { return { error: 'Unable to reach server' }; }
}

async function uploadCandidateCV(candidateId: number, file: File): Promise<boolean> {
  try {
      const token = getToken();
    const fd = new FormData();
    fd.append('cv', file);
    const res = await fetch(`${API_URL}/api/recruitment/candidates/${candidateId}/cv`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: fd,
    });
    return res.ok;
  } catch { return false; }
}

async function updateApplicationStage(applicationId: number, stage: string, notes?: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/applications/${applicationId}/stage`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ stage, notes }) });
    return res.ok;
  } catch { return false; }
}

async function convertToEmployee(applicationId: number): Promise<{ employee_id: number; user_id: number | null; email: string; temp_password: string | null; already_existed: boolean } | null> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/applications/${applicationId}/convert-to-employee`, { method: 'POST', headers: getAuthHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function updateCandidateAPI(candidateId: number, data: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/candidates/${candidateId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) });
    return res.ok;
  } catch { return false; }
}

async function rejectApplication(applicationId: number, reason?: string): Promise<boolean> {
  try {
    const url = reason ? `${API_URL}/api/recruitment/applications/${applicationId}/reject?reason=${encodeURIComponent(reason)}` : `${API_URL}/api/recruitment/applications/${applicationId}/reject`;
    const res = await fetch(url, { method: 'POST', headers: getAuthHeaders() });
    return res.ok;
  } catch { return false; }
}

async function sendOffer(applicationId: number, salary: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/applications/${applicationId}/offer`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ salary, currency: 'XOF' }) });
    return res.ok;
  } catch { return false; }
}

async function createInterview(data: { application_id: number; interview_type: string; scheduled_at: string; duration_minutes: number; location?: string; meeting_link?: string; interviewer_ids?: number[]; }): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/interviews`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) });
    return res.ok;
  } catch { return false; }
}

async function deleteInterview(interviewId: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/recruitment/interviews/${interviewId}`, { method: 'DELETE', headers: getAuthHeaders() });
    return res.ok;
  } catch { return false; }
}

// ============================================
// PIPELINE CONFIG
// ============================================

const pipelineStageColors: Record<string, string> = { new: 'bg-gray-500', screening: 'bg-blue-500', hr_interview: 'bg-purple-500', technical: 'bg-orange-500', final: 'bg-yellow-500', offer: 'bg-green-500', hired: 'bg-emerald-600' };
const pipelineStageIds = ['new', 'screening', 'hr_interview', 'technical', 'final', 'offer', 'hired'];

function getPipelineStages(t: ReturnType<typeof useI18n>['t']) {
  const names: Record<string, string> = { new: t.recruitment.stageNew, screening: t.recruitment.stageScreening, hr_interview: t.recruitment.stageHrInterview, technical: t.recruitment.stageTechnical, final: t.recruitment.stageFinal, offer: t.recruitment.stageOffer, hired: t.recruitment.stageHired };
  return pipelineStageIds.map(id => ({ id, name: names[id], color: pipelineStageColors[id] }));
}

function getStageLabels(t: ReturnType<typeof useI18n>['t']): Record<string, string> {
  return { new: t.recruitment.stageNew, screening: t.recruitment.stageScreening, phone_screen: t.recruitment.stagePhoneScreen, hr_interview: t.recruitment.stageHrInterview, technical: t.recruitment.stageTechnical, final: t.recruitment.stageFinal, offer: t.recruitment.stageOffer, hired: t.recruitment.stageHired, employee: t.recruitment.stageEmployee, rejected: t.recruitment.stageRejected, withdrawn: t.recruitment.stageWithdrawn };
}

function getInterviewTypeLabels(t: ReturnType<typeof useI18n>['t']): Record<string, string> {
  return { phone: t.recruitment.interviewPhone, video: t.recruitment.interviewVideo, onsite: t.recruitment.interviewOnsite };
}

function getInterviewStatusLabels(t: ReturnType<typeof useI18n>['t']): Record<string, string> {
  return { scheduled: t.recruitment.interviewScheduled, completed: t.recruitment.interviewCompleted, cancelled: t.recruitment.interviewCancelled, no_show: t.recruitment.interviewNoShow };
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function RecruitmentPage() {
  const { t, locale } = useI18n();
  const pipelineStages = getPipelineStages(t);
  const stageLabels = getStageLabels(t);
  const interviewTypeLabels = getInterviewTypeLabels(t);
  const interviewStatusLabels = getInterviewStatusLabels(t);
  const [activeTab, setActiveTab] = useState<'kanban' | 'jobs' | 'interviews' | 'analytics'>('kanban');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobFilter, setSelectedJobFilter] = useState<number | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsPage, setJobsPage] = useState(1);
  const JOBS_PAGE_SIZE = 10;
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState<RecruitmentStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showEditCandidateModal, setShowEditCandidateModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [newEmployeeInfo, setNewEmployeeInfo] = useState<{ employee_id: number; user_id: number | null; email: string; temp_password: string | null; already_existed: boolean; candidate_name: string } | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [expandedJobCandidates, setExpandedJobCandidates] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);
  const [inputDialog, setInputDialog] = useState<{
    title: string;
    placeholder: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
    required?: boolean;
  } | null>(null);
  const [inputDialogValue, setInputDialogValue] = useState('');

  // --- Batch Scoring IA ---
  const [showBatchScoringModal, setShowBatchScoringModal] = useState(false);
  const [showScoringGateModal, setShowScoringGateModal] = useState(false);
  const [aiScoringStatus, setAiScoringStatus] = useState<AIScoringStatus | null>(null);
  const [requestingAddon, setRequestingAddon] = useState(false);
  const [addonMessage, setAddonMessage] = useState('');
  const [showAddonForm, setShowAddonForm] = useState(false);
  const MAX_CVS = aiScoringStatus?.max_cvs_per_batch ?? 5;
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchCriteria, setBatchCriteria] = useState<string[]>([]);
  const [batchCriteriaInput, setBatchCriteriaInput] = useState('');
  const [batchSelectedJob, setBatchSelectedJob] = useState<number | null>(null);
  const [batchResults, setBatchResults] = useState<{filename: string; candidate_name: string; candidate_id?: number; overall_score: number; score_details: {category: string; score: number}[]; analysis: string; recommendation: string; recommendation_reason: string; conditions_to_verify: string[]}[] | null>(null);
  const [batchCvTexts, setBatchCvTexts] = useState<string[]>([]); // cv_text par index pour extraction email
  const [batchScoring, setBatchScoring] = useState(false);
  const [manualStatuses, setManualStatuses] = useState<Record<number, string>>({}); // index → overridden status
  const [selectedForScreening, setSelectedForScreening] = useState<Set<number>>(new Set());
  // Drag-and-drop Kanban
  const [draggedAppId, setDraggedAppId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  // --- Single candidate scoring ---
  const [scoringCandidateId, setScoringCandidateId] = useState<number | null>(null);

  // Group context (must be before loadData)
  const { context: groupContext, selectedTenantId, selectedSubsidiary, selectTenant } = useGroupContext();

  // Read-only when viewing a foreign subsidiary (can't create/mutate data)
  const isReadOnly = selectedTenantId !== null;

  // Charger le statut d'accès au scoring IA une seule fois
  useEffect(() => {
    getAIScoringStatus().then(setAiScoringStatus).catch(() => setAiScoringStatus(null));
  }, []);

  // Handler demande add-on scoring
  const handleRequestAddon = async () => {
    setRequestingAddon(true);
    try {
      await requestAIScoringAddon(addonMessage);
      toast.success('Demande envoyée ! Notre équipe vous contactera sous 24h.');
      setShowAddonForm(false);
      setAddonMessage('');
      const updated = await getAIScoringStatus();
      setAiScoringStatus(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la demande';
      toast.error(msg);
    } finally {
      setRequestingAddon(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const tid = selectedTenantId ?? undefined;
    const [jobsData, appsData, interviewsData, statsData, candidatesTotal, depts, emps] = await Promise.all([
      fetchJobs(tid), fetchApplications(selectedJobFilter || undefined, tid), fetchInterviews(tid), fetchStats(tid), fetchTotalCandidates(tid), fetchDepartments(), fetchEmployees(tid)
    ]);
    setJobs(jobsData); setApplications(appsData); setInterviews(interviewsData); setStats(statsData); setTotalCandidates(candidatesTotal); setDepartments(depts); setEmployees(emps);
    setLoading(false);
  }, [selectedJobFilter, selectedTenantId]);

  const loadAnalytics = useCallback(async () => { const data = await fetchAnalytics(selectedTenantId ?? undefined); setAnalytics(data); }, [selectedTenantId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (activeTab === 'analytics') loadAnalytics(); }, [activeTab, loadAnalytics]);

  // Rafraîchir quand l'agent crée un candidat ou une offre
  useEffect(() => {
    const handleAgentInsert = () => loadData();
    window.addEventListener('recruitment:data-changed', handleAgentInsert);
    return () => window.removeEventListener('recruitment:data-changed', handleAgentInsert);
  }, [loadData]);

  // Écouter l'événement du bouton "+ Ajouter" du Header
  useEffect(() => {
    const handleHeaderAdd = () => {
      if (isReadOnly) return;  // lecture seule — filiale sélectionnée
      if (activeTab === 'jobs') {
        setEditingJob(null);
        setShowJobModal(true);
      } else if (activeTab === 'interviews') {
        setShowInterviewModal(true);
      } else {
        setShowAddCandidateModal(true);
      }
    };
    window.addEventListener('recruitment-add', handleHeaderAdd);
    return () => window.removeEventListener('recruitment-add', handleHeaderAdd);
  }, [activeTab, isReadOnly]);

  const getApplicationsByStage = (stageId: string) => {
    return applications.filter(app => {
      if (app.stage !== stageId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return app.candidate_name.toLowerCase().includes(q) || app.candidate_email.toLowerCase().includes(q) || (app.candidate_skills || []).some(s => s.toLowerCase().includes(q));
      }
      return true;
    });
  };

  const getInterviewsForApplication = (applicationId: number) => interviews.filter(i => i.application_id === applicationId);

  // Métriques dérivées des données déjà chargées (toujours à jour après loadData)
  const INTERVIEW_STAGES = ['phone_screen', 'hr_interview', 'technical', 'final'];
  const openPositions = jobs.filter(j => j.status === 'active').length;
  const inInterview = applications.filter(a => INTERVIEW_STAGES.includes(a.stage)).length;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 75) return 'text-blue-600 bg-blue-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getTimelineLabel = (event: TimelineEvent): string => {
    const labels = t.recruitment.timeline as unknown as Record<string, string>;
    if (event.event_type === 'applied' && /interne/i.test(event.event_title)) {
      return labels.applied_internal ?? event.event_title;
    }
    return labels[event.event_type] ?? event.event_title;
  };

  const getUrgencyColor = (urgency: string) => {
    if (urgency === 'high') return 'bg-red-100 text-red-700';
    if (urgency === 'medium') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getInterviewStatusColor = (status: string) => {
    if (status === 'scheduled') return 'bg-blue-100 text-blue-700';
    if (status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'cancelled') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  const dateLocale = locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'fr-FR';
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatSalary = (min: number | null, max: number | null, currency: string) => {
    if (!min && !max) return null;
    const fmt = (n: number) => `${(n / 1000000).toFixed(1)}M`;
    if (min && max) return `${fmt(min)} - ${fmt(max)} ${currency}`;
    if (min) return `${t.recruitment.salaryFrom} ${fmt(min)} ${currency}`;
    return `${t.recruitment.salaryUpTo} ${fmt(max!)} ${currency}`;
  };

  // ------------------------------------------------------------------
  // SCORING FUNCTIONS
  // ------------------------------------------------------------------
  const handleBatchScore = async () => {
    if (!batchSelectedJob || batchFiles.length === 0) {
      toast.error(t.recruitment.selectJobAndCv);
      return;
    }
    setBatchScoring(true);
    setBatchResults(null);
    setBatchCvTexts([]);
    setManualStatuses({});
    setSelectedForScreening(new Set());
      const token = getToken();
    try {
      // Extraire le texte de chaque PDF via /api/ai/extract-pdf
      const candidates = await Promise.all(batchFiles.map(async (file) => {
        const fd = new FormData();
        fd.append('file', file);
        let cv_text = '';
        try {
          const r = await fetch(`${API_URL}/api/ai-chat/extract-pdf`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (r.ok) { const d = await r.json(); cv_text = d.text || ''; }
        } catch { /* silencieux */ }
        return { cv_text, filename: file.name, candidate_name: file.name.replace(/\.[^.]+$/, '') };
      }));
      // Stocker les cv_texts pour l'extraction email lors de apply-batch-results
      setBatchCvTexts(candidates.map(c => c.cv_text));
      const res = await fetch(`${API_URL}/api/ai/score-cvs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_posting_id: batchSelectedJob, candidates, criteria: batchCriteria }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBatchResults(data.results || []);
      toast.success(`${data.total_scored} ${t.recruitment.cvScored} — ${data.summary.shortlist} ${t.recruitment.shortlisted}`);
    } catch (e: unknown) {
      toast.error(`${t.recruitment.scoringError} : ${e instanceof Error ? e.message : ''}`);
    } finally {
      setBatchScoring(false);
    }
  };

  const handleScoreCandidate = async (candidateId: number) => {
    setScoringCandidateId(candidateId);
      const token = getToken();
    try {
      const res = await fetch(`${API_URL}/api/ai/score-candidate/${candidateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(`${t.recruitment.scoreCalculated} : ${data.overall_score}/100`);
      // Mettre à jour le candidat sélectionné dans la vue
      if (selectedApplication && selectedApplication.candidate_id === candidateId) {
        setSelectedApplication({
          ...selectedApplication,
          candidate_ai_score: data.overall_score,
          candidate_ai_score_details: data.score_details || [],
        });
      }
      await loadData();
    } catch (e: unknown) {
      toast.error(`${t.common.error} : ${e instanceof Error ? e.message : ''}`);
    } finally {
      setScoringCandidateId(null);
    }
  };

  const handleUpdateScoreStatus = async (applicationId: number, newStatus: string) => {
      const token = getToken();
    try {
      const res = await fetch(`${API_URL}/api/ai/score-status/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ score_status: newStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t.recruitment.scoreStatusUpdated);
      // Optimistic update for the selected application
      if (selectedApplication && selectedApplication.id === applicationId) {
        setSelectedApplication({ ...selectedApplication, score_status: newStatus });
      }
      // Update applications list locally
      setApplications(prev => prev.map(a => a.id === applicationId ? { ...a, score_status: newStatus } : a));
    } catch (e: unknown) {
      toast.error(`${t.common.error} : ${e instanceof Error ? e.message : ''}`);
    }
  };

  const handleSendEmail = (application: Application) => {
    const jobTitle = application.job_title || t.recruitment.positionDefault;
    const subject = encodeURIComponent(t.recruitment.emailSubjectTemplate.replace('{job}', jobTitle));
    const body = encodeURIComponent(t.recruitment.emailBodyTemplate.replace('{name}', application.candidate_name.split(' ')[0]).replace('{job}', jobTitle));
    window.open(`mailto:${application.candidate_email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleReject = (application: Application) => {
    setInputDialogValue('');
    setInputDialog({
      title: t.recruitment.refusalReason,
      placeholder: t.recruitment.refusalPlaceholder,
      required: false,
      onConfirm: async (reason) => {
        const success = await rejectApplication(application.id, reason || undefined);
        if (success) { setShowCandidateModal(false); loadData(); } else { toast.error(t.recruitment.refusalError); }
      },
    });
  };

  const handleSendOffer = (application: Application) => {
    setInputDialogValue(application.candidate_expected_salary?.toString() || '');
    setInputDialog({
      title: t.recruitment.proposedSalary,
      placeholder: t.recruitment.salaryExample,
      defaultValue: application.candidate_expected_salary?.toString() || '',
      required: true,
      onConfirm: async (salaryStr) => {
        const salary = parseFloat(salaryStr);
        if (isNaN(salary)) { toast.error(t.recruitment.invalidSalary); return; }
        const success = await sendOffer(application.id, salary);
        if (success) { setShowCandidateModal(false); loadData(); } else { toast.error(t.recruitment.offerError); }
      },
    });
  };

  const handleNextStage = async (application: Application) => {
    const currentIndex = pipelineStages.findIndex(s => s.id === application.stage);
    if (currentIndex < pipelineStages.length - 1) {
      const nextStage = pipelineStages[currentIndex + 1].id;
      const success = await updateApplicationStage(application.id, nextStage);
      if (success) { setShowCandidateModal(false); loadData(); } else { toast.error(t.recruitment.stageChangeError); }
    }
  };

  const handleKanbanDrop = async (targetStageId: string) => {
    if (!draggedAppId || isReadOnly) return;
    const app = applications.find(a => a.id === draggedAppId);
    if (!app || app.stage === targetStageId) { setDraggedAppId(null); setDragOverStage(null); return; }
    // Mise à jour optimiste immédiate
    setApplications(prev => prev.map(a => a.id === draggedAppId ? { ...a, stage: targetStageId } : a));
    setDraggedAppId(null);
    setDragOverStage(null);
    const success = await updateApplicationStage(draggedAppId, targetStageId);
    if (!success) {
      // Rollback si erreur
      setApplications(prev => prev.map(a => a.id === draggedAppId ? { ...a, stage: app.stage } : a));
      toast.error(t.recruitment.stageChangeError);
    } else {
      const stageName = pipelineStages.find(s => s.id === targetStageId)?.name ?? targetStageId;
      toast.success(`${app.candidate_name} → ${stageName}`);
    }
  };

  const handlePublishJob = async (jobId: number) => { const success = await publishJob(jobId); if (success) loadData(); else toast.error(t.recruitment.publishError); };
  const handleCloseJob = async (jobId: number) => { const success = await closeJob(jobId); if (success) loadData(); else toast.error(t.recruitment.closeError); };
  const handleDeleteJob = async (jobId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: t.recruitment.deleteJobTitle,
      message: t.recruitment.deleteJobMessage,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const success = await deleteJob(jobId);
        if (success) { loadData(); toast.success(t.recruitment.jobDeleted); } else toast.error(t.recruitment.deleteError);
      },
    });
  };

  const handleDeleteInterview = async (interviewId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: t.recruitment.deleteInterviewTitle,
      message: t.recruitment.deleteInterviewMessage,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const success = await deleteInterview(interviewId);
        if (success) loadData(); else toast.error(t.recruitment.deleteInterviewError);
      },
    });
  };

  // Page Tour Hook
  const { showTips, dismissTips, resetTips } = usePageTour('recruitment');

  if (loading) return <PageLoading />;

  return (
    <>
      {showTips && (
        <PageTourTips
          pageId="recruitment"
          onDismiss={dismissTips}
          pageTitle={t.recruitment.title}
        />
      )}
      <Header title={t.recruitment.title} subtitle={t.recruitment.subtitle} />

      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats */}
        <div data-tour="recruitment-stats" className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">{t.recruitment.openPositions}</p><p className="text-2xl font-bold text-gray-900">{openPositions}</p></div>
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center"><Briefcase className="w-5 h-5 text-primary-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">{t.recruitment.totalCandidates}</p><p className="text-2xl font-bold text-purple-600">{totalCandidates}</p></div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-purple-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">{t.recruitment.inInterview}</p><p className="text-2xl font-bold text-orange-600">{inInterview}</p></div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"><MessageSquare className="w-5 h-5 text-orange-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">{t.recruitment.avgDelay}</p><p className="text-2xl font-bold text-gray-900">{stats?.avg_time_to_hire ?? 0}j</p></div>
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-gray-600" /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">{t.recruitment.hiresMonth}</p><p className="text-2xl font-bold text-green-600">{stats?.hires_this_month ?? 0}</p></div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><UserPlus className="w-5 h-5 text-green-600" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('kanban')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'kanban' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Users className="w-4 h-4 inline mr-2" />{t.recruitment.pipelineCandidates}
            </button>
            <button onClick={() => setActiveTab('jobs')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'jobs' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Briefcase className="w-4 h-4 inline mr-2" />{t.recruitment.jobPostings}
            </button>
            <button onClick={() => setActiveTab('interviews')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'interviews' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <Calendar className="w-4 h-4 inline mr-2" />{t.recruitment.interviews}
            </button>
            <button onClick={() => setActiveTab('analytics')} className={`flex-1 px-6 py-4 text-sm font-medium ${activeTab === 'analytics' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}>
              <TrendingUp className="w-4 h-4 inline mr-2" />{t.recruitment.analytics}
            </button>
            <Link href="/dashboard/recruitment/cabinets" className="flex-1 px-6 py-4 text-sm font-medium text-gray-500 hover:text-primary-600 flex items-center justify-center gap-2">
              <Building2 className="w-4 h-4" />Cabinets
            </Link>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder={t.recruitment.searchCandidateSkill} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            {activeTab === 'kanban' && (
              <CustomSelect value={selectedJobFilter ? String(selectedJobFilter) : ''} onChange={(v) => setSelectedJobFilter(v ? parseInt(v) : null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: '', label: t.recruitment.allPositions }, ...jobs.map(job => ({ value: String(job.id), label: `${job.title}${job.status === 'draft' ? ` (${t.recruitment.draft})` : ''}` }))]} />
            )}
            {activeTab === 'interviews' && (
              <CustomSelect value={selectedJobFilter ? String(selectedJobFilter) : ''} onChange={(v) => setSelectedJobFilter(v ? parseInt(v) : null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: '', label: t.recruitment.allPositions }, ...jobs.map(job => ({ value: String(job.id), label: job.title }))]} />
            )}
          </div>
          <div className="flex gap-3">
            {activeTab === 'kanban' && !isReadOnly && (
              <>
                <button
                  onClick={() => {
                    if (aiScoringStatus && !aiScoringStatus.has_access) {
                      setShowScoringGateModal(true);
                    } else {
                      setShowBatchScoringModal(true); setBatchResults(null); setBatchFiles([]); setBatchCriteria([]); setBatchSelectedJob(selectedJobFilter);
                    }
                  }}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                    aiScoringStatus && !aiScoringStatus.has_access
                      ? 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {aiScoringStatus && !aiScoringStatus.has_access
                    ? <Lock className="w-4 h-4 mr-2" />
                    : <Brain className="w-4 h-4 mr-2" />}
                  {t.recruitment.aiCvScoring}
                  {aiScoringStatus && !aiScoringStatus.has_access && (
                    <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-semibold">Add-on</span>
                  )}
                </button>
                <button onClick={() => setShowAddCandidateModal(true)} className="flex items-center px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600">
                  <UserPlus className="w-4 h-4 mr-2" />{t.recruitment.addCandidate}
                </button>
              </>
            )}
            {activeTab === 'jobs' && !isReadOnly && (
              <button 
                data-tour="create-job"
                onClick={() => { setEditingJob(null); setShowJobModal(true); }} 
                className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
              >
                <Plus className="w-4 h-4 mr-2" />{t.recruitment.newJob}
              </button>
            )}
          </div>
        </div>

        {/* TAB: Kanban Pipeline */}
        {activeTab === 'kanban' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {pipelineStages.map((stage) => {
              const stageApps = getApplicationsByStage(stage.id);
              const isDropTarget = dragOverStage === stage.id;
              return (
                <div key={stage.id} className="flex-shrink-0 w-72">
                  <div className={`${stage.color} text-white px-4 py-3 rounded-t-xl flex items-center justify-between`}>
                    <span className="font-medium text-sm">{stage.name}</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{stageApps.length}</span>
                  </div>
                  <div
                    className={`rounded-b-xl p-3 min-h-96 space-y-3 transition-colors ${isDropTarget ? 'bg-primary-100 ring-2 ring-primary-400 ring-inset' : 'bg-gray-100'}`}
                    onDragOver={!isReadOnly ? (e) => { e.preventDefault(); setDragOverStage(stage.id); } : undefined}
                    onDragLeave={!isReadOnly ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); } : undefined}
                    onDrop={!isReadOnly ? (e) => { e.preventDefault(); handleKanbanDrop(stage.id); } : undefined}
                  >
                    {isDropTarget && draggedAppId && (
                      <div className="border-2 border-dashed border-primary-400 rounded-lg h-16 flex items-center justify-center text-primary-500 text-xs font-medium bg-primary-50">
                        Déposer ici → {stage.name}
                      </div>
                    )}
                    {stageApps.map((app) => (
                      <div
                        key={app.id}
                        draggable={!isReadOnly}
                        onDragStart={!isReadOnly ? (e) => { setDraggedAppId(app.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                        onDragEnd={!isReadOnly ? () => { setDraggedAppId(null); setDragOverStage(null); } : undefined}
                        onClick={() => { setSelectedApplication(app); setShowCandidateModal(true); }}
                        className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 transition-all ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${draggedAppId === app.id ? 'opacity-40 scale-95' : 'hover:shadow-md'}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">
                              {app.candidate_name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="ml-3">
                              <h4 className="font-medium text-gray-900 text-sm">{app.candidate_name}</h4>
                              <p className="text-xs text-gray-500">{app.candidate_location || t.recruitment.notSpecified}</p>
                            </div>
                          </div>
                          {app.candidate_ai_score && (<div className={`px-2 py-1 rounded text-xs font-bold ${getScoreColor(app.candidate_ai_score)}`}>{app.candidate_ai_score}</div>)}
                          {app.score_status && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${app.score_status === 'shortlist' ? 'bg-green-100 text-green-700' : app.score_status === 'to_review' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                              {app.score_status === 'shortlist' ? t.recruitment.scoreStatusShortlist : app.score_status === 'to_review' ? t.recruitment.scoreStatusToReview : t.recruitment.scoreStatusRejected}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-2 truncate">{app.job_title}</p>
                        {app.candidate_source === 'IntoWork' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium mb-2">
                            <ExternalLink className="w-3 h-3" />IntoWork
                          </span>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {(app.candidate_skills || []).slice(0, 3).map((skill) => (<span key={skill} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{skill}</span>))}
                          {(app.candidate_skills || []).length > 3 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">+{(app.candidate_skills || []).length - 3}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-400">{formatDate(app.applied_at)}</span>
                          <span className="text-xs text-gray-500">{app.candidate_source || 'Direct'}</span>
                        </div>
                      </div>
                    ))}
                    {stageApps.length === 0 && <div className="text-center text-gray-400 text-sm py-8">{t.recruitment.noCandidate}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: Jobs */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t.recruitment.noJobPosting}</p>
                {!isReadOnly && <button onClick={() => { setEditingJob(null); setShowJobModal(true); }} className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm">{t.recruitment.createAJob}</button>}
              </div>
            ) : jobs.slice((jobsPage - 1) * JOBS_PAGE_SIZE, jobsPage * JOBS_PAGE_SIZE).map((job) => (
              <div key={job.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center"><Briefcase className="w-6 h-6 text-primary-600" /></div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-gray-900">{job.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getUrgencyColor(job.urgency)}`}>{job.urgency === 'high' ? t.recruitment.urgent : job.urgency === 'medium' ? t.recruitment.moderate : t.recruitment.normal}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                        {job.department_name && <span className="flex items-center"><Building2 className="w-3.5 h-3.5 mr-1" />{job.department_name}</span>}
                        <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" />{job.location}</span>
                        <span>{job.contract_type}</span>
                        {job.show_salary && formatSalary(job.salary_min, job.salary_max, job.salary_currency) && (<span className="text-primary-600 font-medium">{formatSalary(job.salary_min, job.salary_max, job.salary_currency)}</span>)}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                        <span>{t.recruitment.published}: {job.posted_at ? formatDate(job.posted_at) : t.recruitment.notPublished}</span>
                        {job.deadline && <span>{t.recruitment.deadline}: {formatDate(job.deadline)}</span>}
                        {job.hiring_manager_name && <span>{t.common.manager}: {job.hiring_manager_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <button onClick={() => setExpandedJobCandidates(expandedJobCandidates === job.id ? null : job.id)} className="text-center hover:bg-primary-50 rounded-lg p-2 transition-colors group">
                      <p className="text-2xl font-bold text-gray-900 group-hover:text-primary-600">{job.applicants_count}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-0.5 justify-center">{t.recruitment.candidates} {expandedJobCandidates === job.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}</p>
                    </button>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${job.status === 'active' ? 'bg-green-100 text-green-700' : job.status === 'closed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{job.status === 'active' ? t.recruitment.active : job.status === 'closed' ? t.recruitment.closed : t.recruitment.draftStatus}</span>
                    <div className="flex gap-2">
                      {!isReadOnly && <button onClick={() => { setEditingJob(job); setShowJobModal(true); }} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title={t.common.edit}><Edit className="w-4 h-4" /></button>}
                      {!isReadOnly && job.status === 'draft' && (<button onClick={() => handlePublishJob(job.id)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title={t.recruitment.publish}><Check className="w-4 h-4" /></button>)}
                      {!isReadOnly && job.status === 'active' && (<button onClick={() => handleCloseJob(job.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title={t.recruitment.closeJob}><XCircle className="w-4 h-4" /></button>)}
                      {!isReadOnly && job.status === 'closed' && (<button onClick={() => handlePublishJob(job.id)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title={t.recruitment.republish}><RefreshCw className="w-4 h-4" /></button>)}
                      {!isReadOnly && (job.status === 'draft' || job.status === 'closed') && (<button onClick={() => handleDeleteJob(job.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title={t.common.delete}><Trash2 className="w-4 h-4" /></button>)}
                    </div>
                  </div>
                </div>
                {job.requirements && job.requirements.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">{job.requirements.map((req, i) => (<span key={i} className="px-3 py-1 bg-gray-50 text-gray-600 text-xs rounded-full">{req}</span>))}</div>
                  </div>
                )}
                {expandedJobCandidates === job.id && (() => {
                  const jobApps = applications.filter(a => a.job_posting_id === job.id && !['employee', 'rejected', 'withdrawn'].includes(a.stage));
                  return (
                    <div className="mt-4 pt-4 border-t border-primary-100 bg-primary-50/40 rounded-b-xl -mx-5 px-5 pb-4">
                      <h4 className="text-sm font-semibold text-primary-700 mb-3 flex items-center gap-2"><Users className="w-4 h-4" />{t.recruitment.candidatesForPosition} ({jobApps.length})</h4>
                      {jobApps.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">{t.recruitment.noCandidateYet}</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {jobApps.map(app => (
                            <button key={app.id} onClick={() => { setSelectedApplication(app); setShowCandidateModal(true); }} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-primary-200 hover:shadow-sm text-left transition-all">
                              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs flex-shrink-0">{app.candidate_name.split(' ').map(n => n[0]).join('')}</div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{app.candidate_name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs text-gray-500">{stageLabels[app.stage] || app.stage}</span>
                                  {app.candidate_cv_url && <span className="text-xs text-primary-600 flex items-center gap-0.5"><FileText className="w-3 h-3" />CV</span>}
                                  {app.candidate_ai_score && <span className={`text-xs font-bold ${getScoreColor(app.candidate_ai_score)}`}>{app.candidate_ai_score}</span>}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
            <Pagination page={jobsPage} total={jobs.length} pageSize={JOBS_PAGE_SIZE} onPageChange={setJobsPage} />
          </div>
        )}

        {/* TAB: Interviews */}
        {activeTab === 'interviews' && (
          <div className="space-y-6">
            {(() => {
              // Filtrer les entretiens par recherche et par poste
              const filteredInterviews = interviews.filter(i => {
                if (selectedJobFilter) {
                  const app = applications.find(a => a.id === i.application_id);
                  if (!app || app.job_posting_id !== selectedJobFilter) return false;
                }
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  return i.candidate_name.toLowerCase().includes(q) || (i.job_title || '').toLowerCase().includes(q);
                }
                return true;
              });
              
              const upcomingInterviews = filteredInterviews.filter(i => i.status === 'scheduled' && new Date(i.scheduled_at) >= new Date()).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
              const pastInterviews = filteredInterviews.filter(i => i.status !== 'scheduled' || new Date(i.scheduled_at) < new Date()).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()).slice(0, 10);
              
              if (interviews.length === 0) {
                return (
                  <div className="bg-white rounded-xl p-12 text-center">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">{t.recruitment.noInterviewPlanned}</p>
                  </div>
                );
              }
              
              return (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.recruitment.upcomingInterviews} ({upcomingInterviews.length})</h3>
                    <div className="space-y-3">
                      {upcomingInterviews.map(interview => (
                      <div key={interview.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-1">
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">{interview.candidate_name.split(' ').map(n => n[0]).join('')}</div>
                            <div className="ml-4"><h4 className="font-semibold text-gray-900">{interview.candidate_name}</h4><p className="text-sm text-gray-500">{interview.job_title}</p></div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right"><p className="text-sm font-medium text-gray-900">{formatDateTime(interview.scheduled_at)}</p><p className="text-xs text-gray-500">{interview.duration_minutes} min • {interviewTypeLabels[interview.interview_type] || interview.interview_type}</p></div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getInterviewStatusColor(interview.status)}`}>{interviewStatusLabels[interview.status] || interview.status}</span>
                            <button onClick={() => handleDeleteInterview(interview.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title={t.common.delete}><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        {interview.interviewer_names && interview.interviewer_names.length > 0 && (<div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-500"><span className="font-medium">{t.recruitment.interviewers}:</span> {interview.interviewer_names.join(', ')}</p></div>)}
                        {interview.meeting_link && (<div className="mt-2"><a href={interview.meeting_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline flex items-center"><Video className="w-3 h-3 mr-1" />{t.recruitment.joinMeeting}</a></div>)}
                      </div>
                    ))}
                      {upcomingInterviews.length === 0 && (<p className="text-gray-400 text-sm text-center py-8 bg-white rounded-xl">{t.recruitment.noUpcomingInterview}</p>)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.recruitment.pastInterviews} ({pastInterviews.length})</h3>
                    <div className="space-y-3">
                      {pastInterviews.map(interview => (
                      <div key={interview.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 opacity-80">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-1">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-medium text-sm">{interview.candidate_name.split(' ').map(n => n[0]).join('')}</div>
                            <div className="ml-4"><h4 className="font-medium text-gray-700">{interview.candidate_name}</h4><p className="text-sm text-gray-400">{interview.job_title}</p></div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right"><p className="text-sm text-gray-600">{formatDateTime(interview.scheduled_at)}</p><p className="text-xs text-gray-400">{interviewTypeLabels[interview.interview_type] || interview.interview_type}</p></div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getInterviewStatusColor(interview.status)}`}>{interviewStatusLabels[interview.status] || interview.status}</span>
                            <button onClick={() => handleDeleteInterview(interview.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title={t.common.delete}><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                      {pastInterviews.length === 0 && (<p className="text-gray-400 text-sm text-center py-8 bg-white rounded-xl">{t.recruitment.noPastInterview}</p>)}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* TAB: Analytics */}
        {activeTab === 'analytics' && analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.recruitment.recruitmentTrend}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.hiring_trend}><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="applications" stroke="#6366F1" strokeWidth={2} name={t.recruitment.applications} /><Line type="monotone" dataKey="hires" stroke="#10B981" strokeWidth={2} name={t.recruitment.hires} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.recruitment.applicationSources}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={analytics.sources.map(s => ({ name: s.source, value: s.count, color: s.color }))} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{analytics.sources.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.recruitment.candidatesByDepartment}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.by_department} layout="vertical"><XAxis type="number" /><YAxis type="category" dataKey="department" width={100} /><Tooltip /><Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.recruitment.topCandidatesAI}</h3>
              <div className="space-y-3">
                {analytics.top_candidates.length === 0 ? (<p className="text-gray-400 text-sm text-center py-8">{t.recruitment.noCandidateWithAIScore}</p>) : analytics.top_candidates.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <div className="flex-1"><p className="text-sm font-medium text-gray-900">{c.name}</p><p className="text-xs text-gray-500">{c.position}</p></div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(c.ai_score)}`}>{c.ai_score}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* Candidate Detail Modal */}
        {showCandidateModal && selectedApplication && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-start justify-between">
                <div className="flex items-center">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xl font-bold">{selectedApplication.candidate_name.split(' ').map(n => n[0]).join('')}</div>
                  <div className="ml-4">
                    <h2 className="text-xl font-bold text-gray-900">{selectedApplication.candidate_name}</h2>
                    <p className="text-gray-500">{selectedApplication.job_title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedApplication.candidate_ai_score
                      ? <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(selectedApplication.candidate_ai_score)}`}>{t.recruitment.aiScore} : {selectedApplication.candidate_ai_score}/100</span>
                      : !isReadOnly && <button onClick={() => handleScoreCandidate(selectedApplication.candidate_id)} disabled={scoringCandidateId === selectedApplication.candidate_id} className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-60">
                          {scoringCandidateId === selectedApplication.candidate_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                          {t.recruitment.scoreCandidate}
                        </button>
                    }
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{stageLabels[selectedApplication.stage] || selectedApplication.stage}</span>
                    </div>
                    {/* Score status selector */}
                    {!isReadOnly && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-xs text-gray-500">{t.recruitment.aiStatus} :</span>
                        {(['shortlist', 'to_review', 'rejected'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => handleUpdateScoreStatus(selectedApplication.id, st)}
                            className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${
                              selectedApplication.score_status === st
                                ? st === 'shortlist' ? 'bg-green-500 text-white'
                                  : st === 'to_review' ? 'bg-yellow-500 text-white'
                                  : 'bg-red-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {st === 'shortlist' ? `✓ ${t.recruitment.scoreStatusShortlist}` : st === 'to_review' ? `~ ${t.recruitment.scoreStatusToReview}` : `✕ ${t.recruitment.scoreStatusRejected}`}
                          </button>
                        ))}
                        {selectedApplication.score_status && (
                          <button
                            onClick={() => handleUpdateScoreStatus(selectedApplication.id, '')}
                            className="px-1 py-0.5 text-xs text-gray-400 hover:text-gray-600"
                            title={t.recruitment.clearStatus}
                          >✕</button>
                        )}
                      </div>
                    )}
                    {isReadOnly && selectedApplication.score_status && (
                      <span className={`mt-1 inline-block px-2 py-0.5 text-xs rounded-full font-medium ${selectedApplication.score_status === 'shortlist' ? 'bg-green-100 text-green-700' : selectedApplication.score_status === 'to_review' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                        {selectedApplication.score_status === 'shortlist' ? t.recruitment.scoreStatusShortlist : selectedApplication.score_status === 'to_review' ? t.recruitment.scoreStatusToReview : t.recruitment.scoreStatusRejected}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowEditCandidateModal(true)} className="p-2 hover:bg-primary-50 rounded-lg text-primary-500" title={t.common.edit}><Edit className="w-5 h-5" /></button>
                  <button onClick={() => setShowCandidateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg" title={t.common.close}><X className="w-5 h-5 text-gray-500" /></button>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">{t.recruitment.information}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm"><Mail className="w-4 h-4 mr-3 text-gray-400" />{selectedApplication.candidate_email}</div>
                    {selectedApplication.candidate_phone && <div className="flex items-center text-sm"><Phone className="w-4 h-4 mr-3 text-gray-400" />{selectedApplication.candidate_phone}</div>}
                    {selectedApplication.candidate_location && <div className="flex items-center text-sm"><MapPin className="w-4 h-4 mr-3 text-gray-400" />{selectedApplication.candidate_location}</div>}
                    {selectedApplication.candidate_linkedin_url && <div className="flex items-center text-sm"><Linkedin className="w-4 h-4 mr-3 text-gray-400" /><a href={selectedApplication.candidate_linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{t.recruitment.viewProfile}</a></div>}
                    {selectedApplication.candidate_education && <div className="flex items-center text-sm"><GraduationCap className="w-4 h-4 mr-3 text-gray-400" />{selectedApplication.candidate_education}</div>}
                    {selectedApplication.candidate_experience && <div className="flex items-center text-sm"><Briefcase className="w-4 h-4 mr-3 text-gray-400" />{selectedApplication.candidate_experience} {t.recruitment.experience}</div>}
                    {selectedApplication.candidate_current_company && <div className="flex items-center text-sm"><Building2 className="w-4 h-4 mr-3 text-gray-400" />{selectedApplication.candidate_current_company}</div>}
                    {selectedApplication.candidate_expected_salary && <div className="flex items-center text-sm"><span className="w-4 h-4 mr-3 text-gray-400">💰</span>{selectedApplication.candidate_expected_salary.toLocaleString()} {selectedApplication.salary_currency || 'XOF'}</div>}
                    {selectedApplication.candidate_notice_period && <div className="flex items-center text-sm"><Clock className="w-4 h-4 mr-3 text-gray-400" />{t.recruitment.noticePeriod}: {selectedApplication.candidate_notice_period}</div>}
                  </div>

                  {selectedApplication.candidate_cv_url && (
                    <div className="mt-4 p-3 bg-primary-50 rounded-lg border border-primary-100">
                      <p className="text-xs font-semibold text-primary-700 mb-2 flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{t.recruitment.candidateCV}{selectedApplication.candidate_cv_filename ? ` — ${selectedApplication.candidate_cv_filename}` : ''}</p>
                      <div className="flex gap-2">
                        <button onClick={() => openCvAuthenticated(selectedApplication.candidate_id, false, { notAvailable: t.recruitment.cvNotAvailable, openError: t.recruitment.cvOpenError })} className="flex items-center px-3 py-1.5 bg-white text-primary-700 text-xs font-medium rounded-lg hover:bg-primary-100 border border-primary-200"><FileText className="w-3.5 h-3.5 mr-1" />{t.recruitment.view}</button>
                        <button onClick={() => openCvAuthenticated(selectedApplication.candidate_id, true, { notAvailable: t.recruitment.cvNotAvailable, openError: t.recruitment.cvOpenError })} className="flex items-center px-3 py-1.5 bg-white text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 border border-gray-200"><Download className="w-3.5 h-3.5 mr-1" />{t.common.download}</button>
                      </div>
                    </div>
                  )}

                  {selectedApplication.candidate_skills && selectedApplication.candidate_skills.length > 0 && (
                    <><h3 className="font-semibold text-gray-900 mt-6 mb-3">{t.recruitment.skills}</h3><div className="flex flex-wrap gap-2">{selectedApplication.candidate_skills.map((skill) => (<span key={skill} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">{skill}</span>))}</div></>
                  )}

                  {(() => {
                    const appInterviews = getInterviewsForApplication(selectedApplication.id);
                    if (appInterviews.length === 0) return null;
                    return (
                      <><h3 className="font-semibold text-gray-900 mt-6 mb-3">{t.recruitment.interviews} ({appInterviews.length})</h3>
                        <div className="space-y-2">
                          {appInterviews.map(interview => (
                            <div key={interview.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{interviewTypeLabels[interview.interview_type] || interview.interview_type}</p>
                                <p className="text-xs text-gray-500">{formatDateTime(interview.scheduled_at)}</p>
                                {interview.interviewer_names && interview.interviewer_names.length > 0 && (<p className="text-xs text-gray-400 mt-1">{interview.interviewer_names.join(', ')}</p>)}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getInterviewStatusColor(interview.status)}`}>{interviewStatusLabels[interview.status] || interview.status}</span>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteInterview(interview.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title={t.common.delete}><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                <div>
                  {selectedApplication.candidate_ai_score_details && selectedApplication.candidate_ai_score_details.length > 0 && (
                    <>
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-purple-600" />{t.recruitment.detailedAIAnalysis}</h3>
                      <div className="space-y-3">
                        {selectedApplication.candidate_ai_score_details.map((detail) => (
                          <div key={detail.category}>
                            <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{detail.category}</span><span className="font-medium">{detail.score}/100</span></div>
                            <div className="h-2 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${detail.score >= 85 ? 'bg-green-500' : detail.score >= 65 ? 'bg-blue-500' : 'bg-yellow-500'}`} style={{ width: `${detail.score}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {(() => {
                    const app = selectedApplication as Application & { candidate_ai_analysis?: string };
                    return app.candidate_ai_analysis ? (
                      <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <p className="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />{t.recruitment.aiSummary}</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{app.candidate_ai_analysis}</p>
                      </div>
                    ) : null;
                  })()}
                  
                  {selectedApplication.timeline && selectedApplication.timeline.length > 0 && (
                    <><h3 className="font-semibold text-gray-900 mt-6 mb-3">{t.recruitment.timelineTitle}</h3>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {selectedApplication.timeline.map((event) => (
                          <div key={event.id} className="flex items-start">
                            <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                            <div><p className="text-sm font-medium text-gray-900">{getTimelineLabel(event)}</p>{event.event_description && <p className="text-xs text-gray-500">{event.event_description}</p>}<p className="text-xs text-gray-400">{formatDate(event.created_at)}</p></div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowInterviewModal(true)} className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><Video className="w-4 h-4 mr-2" />{t.recruitment.scheduleInterview}</button>
                  <button onClick={() => handleSendEmail(selectedApplication)} className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"><Mail className="w-4 h-4 mr-2" />{t.recruitment.sendEmail}</button>
                  <button onClick={() => setConfirmDialog({ isOpen: true, title: t.recruitment.deleteApplicationTitle, message: t.recruitment.deleteApplicationConfirm.replace('{name}', selectedApplication.candidate_name).replace('{job}', selectedApplication.job_title || ''), danger: true, onConfirm: async () => { const ok = await deleteApplication(selectedApplication.id); setConfirmDialog(null); if (ok) { setShowCandidateModal(false); loadData(); toast.success(t.recruitment.applicationDeleted); } else { toast.error(t.recruitment.deleteError); } } })} className="flex items-center px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 mr-2" />{t.recruitment.deleteApplication}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!['hired', 'rejected', 'withdrawn'].includes(selectedApplication.stage) && (
                    <button onClick={() => handleReject(selectedApplication)} className="flex items-center px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"><XCircle className="w-4 h-4 mr-2" />{t.recruitment.refuse}</button>
                  )}
                  {selectedApplication.stage === 'final' ? (
                    <button onClick={() => handleSendOffer(selectedApplication)} className="flex items-center px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"><FileText className="w-4 h-4 mr-2" />{t.recruitment.sendOffer}</button>
                  ) : selectedApplication.stage === 'offer' ? (
                    <button onClick={async () => { const ok = await updateApplicationStage(selectedApplication.id, 'hired'); if (ok) { setShowCandidateModal(false); loadData(); } else { toast.error(t.recruitment.errorGeneric); } }} className="flex items-center px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"><CheckCircle2 className="w-4 h-4 mr-2" />{t.recruitment.acceptHired}</button>
                  ) : !['hired', 'rejected', 'withdrawn', 'employee'].includes(selectedApplication.stage) && (
                    <button onClick={() => handleNextStage(selectedApplication)} className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"><ArrowRight className="w-4 h-4 mr-2" />{t.recruitment.nextStep}</button>
                  )}
                  {selectedApplication.stage === 'hired' && (
                    <button onClick={() => setConfirmDialog({ isOpen: true, title: t.recruitment.confirmHire, message: t.recruitment.confirmHireMessage.replace('{name}', selectedApplication.candidate_name), onConfirm: async () => { const result = await convertToEmployee(selectedApplication.id); setConfirmDialog(null); if (result) { setShowCandidateModal(false); loadData(); setNewEmployeeInfo({ ...result, candidate_name: selectedApplication.candidate_name }); } else { toast.error(t.recruitment.conversionError); } } })} className="flex items-center px-4 py-2 bg-emerald-700 text-white text-sm rounded-lg hover:bg-emerald-800"><CheckCircle2 className="w-4 h-4 mr-2" />{t.recruitment.isEmployee}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {showJobModal && <JobModal job={editingJob} departments={departments} employees={employees} onClose={() => setShowJobModal(false)} onSave={async (data) => { const success = editingJob ? await updateJob(editingJob.id, data) : await createJob(data); if (success) { setShowJobModal(false); loadData(); } else { toast.error(t.recruitment.saveError); } }} />}
        {showAddCandidateModal && <AddCandidateModal jobs={jobs.filter(j => j.status === 'active')} onClose={() => setShowAddCandidateModal(false)} onSave={async (data, cvFile) => { const result = await createCandidate(data); if ('error' in result) { toast.error(result.error); } else { if (cvFile) await uploadCandidateCV(result.id, cvFile); setShowAddCandidateModal(false); loadData(); } }} />}
        {showEditCandidateModal && selectedApplication && <EditCandidateModal application={selectedApplication} onClose={() => setShowEditCandidateModal(false)} onSave={async (data, cvFile) => { const ok = await updateCandidateAPI(selectedApplication.candidate_id, data); if (ok) { if (cvFile) await uploadCandidateCV(selectedApplication.candidate_id, cvFile); setShowEditCandidateModal(false); loadData(); toast.success(t.recruitment.candidateUpdated); } else { toast.error(t.recruitment.updateError); } }} />}
        {newEmployeeInfo && <NewEmployeeCredentialsModal info={newEmployeeInfo} onClose={() => setNewEmployeeInfo(null)} />}
        {showInterviewModal && selectedApplication && <InterviewModal application={selectedApplication} employees={employees} onClose={() => setShowInterviewModal(false)} onSave={async (data) => { const success = await createInterview(data); if (success) { setShowInterviewModal(false); setShowCandidateModal(false); loadData(); } else { toast.error(t.recruitment.schedulingError); } }} />}

        {/* Gate modal — Scoring IA non disponible sur ce plan */}
        {showScoringGateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
              {/* Bannière */}
              <div className="bg-indigo-600 px-6 py-8 text-white text-center">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-bold">Scoring IA des CVs</h2>
                <p className="text-indigo-100 text-sm mt-1">Analyse automatique & classement des candidats</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Statut */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                  aiScoringStatus?.module_status === 'pending'
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-orange-50 text-orange-700 border border-orange-200'
                }`}>
                  {aiScoringStatus?.module_status === 'pending'
                    ? <><Clock className="w-4 h-4" /> Demande en cours — notre équipe vous contactera sous 24h</>
                    : <><Lock className="w-4 h-4" /> Disponible en formule Entreprise ou en add-on</>}
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {[
                    'Analyse IA de jusqu\'à 5 CVs simultanément',
                    'Score global sur 100 par critères métier',
                    'Recommandation shortlist / à revoir / rejet',
                    'Ajout direct au pipeline de recrutement',
                  ].map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {aiScoringStatus?.module_status === 'not_requested' && !showAddonForm && (
                  <button
                    onClick={() => setShowAddonForm(true)}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Demander l&apos;activation
                  </button>
                )}

                {aiScoringStatus?.module_status === 'not_requested' && showAddonForm && (
                  <div className="space-y-3">
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      rows={3}
                      placeholder="Message optionnel (volume de recrutements, postes, besoins spécifiques…)"
                      value={addonMessage}
                      onChange={e => setAddonMessage(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAddonForm(false)}
                        className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleRequestAddon}
                        disabled={requestingAddon}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        {requestingAddon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Envoyer la demande
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setShowScoringGateModal(false); setShowAddonForm(false); setAddonMessage(''); }}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 text-center"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Batch Scoring IA Modal */}
        {showBatchScoringModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><Brain className="w-5 h-5 text-purple-600" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{t.recruitment.aiCvScoring}</h2>
                    <p className="text-sm text-gray-500">{t.recruitment.aiScoringSubtitle}</p>
                  </div>
                </div>
                <button onClick={() => setShowBatchScoringModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
              </div>

              <div className="p-6 space-y-6">
                {/* Offre de référence */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.referenceJob} <span className="text-red-500">*</span></label>
                  <CustomSelect value={batchSelectedJob ? String(batchSelectedJob) : ''} onChange={v => setBatchSelectedJob(v ? parseInt(v) : null)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" options={[{ value: '', label: t.recruitment.selectJob }, ...jobs.map(j => ({ value: String(j.id), label: j.title }))]} />
                </div>

                {/* Critères personnalisés */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.additionalCriteria} <span className="text-gray-400 font-normal">({t.recruitment.optional})</span></label>
                  <div className="flex gap-2">
                    <input type="text" placeholder={t.recruitment.criteriaPlaceholder} value={batchCriteriaInput} onChange={e => setBatchCriteriaInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && batchCriteriaInput.trim()) { setBatchCriteria(prev => [...prev, batchCriteriaInput.trim()]); setBatchCriteriaInput(''); }}} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                    <button onClick={() => { if (batchCriteriaInput.trim()) { setBatchCriteria(prev => [...prev, batchCriteriaInput.trim()]); setBatchCriteriaInput(''); }}} className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200">{t.recruitment.addCriteria}</button>
                  </div>
                  {batchCriteria.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {batchCriteria.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">{c}<button onClick={() => setBatchCriteria(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-purple-400 hover:text-purple-700"><X className="w-3 h-3" /></button></span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload CVs */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.recruitment.cvsToScore} <span className="text-red-500">*</span>
                    <span className="ml-2 text-xs font-normal text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      Max {MAX_CVS} CVs
                    </span>
                  </label>
                  <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${batchFiles.length > 0 ? 'border-purple-400 bg-purple-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">{t.recruitment.dropCvsHere}</span>
                    <span className="text-xs text-gray-400 mt-1">{t.recruitment.fileFormats}</span>
                    <input type="file" accept=".pdf,.doc,.docx,.txt,.text,.rtf" multiple className="hidden" onChange={e => { const newFiles = Array.from(e.target.files || []); setBatchFiles(prev => { const names = new Set(prev.map(f => f.name)); const toAdd = newFiles.filter(f => !names.has(f.name)); return [...prev, ...toAdd].slice(0, MAX_CVS); }); setBatchResults(null); e.currentTarget.value = ''; }} />
                  </label>
                  {batchFiles.length > 0 && (
                    <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                      {batchFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-700 truncate max-w-xs">{f.name}</span></div>
                          <button onClick={() => setBatchFiles(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bouton lancer */}
                {!batchResults && (
                  <button onClick={handleBatchScore} disabled={batchScoring || !batchSelectedJob || batchFiles.length === 0} className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {batchScoring ? <><Loader2 className="w-5 h-5 animate-spin" />{t.recruitment.analysisInProgress}</> : <><Brain className="w-5 h-5" />{t.recruitment.launchAIScoring} ({batchFiles.length} CV{batchFiles.length > 1 ? 's' : ''})</>}
                  </button>
                )}

                {/* Résultats */}
                {batchResults && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">{t.recruitment.results} — {batchResults.length} {t.recruitment.candidatesScored}</h3>
                      <div className="flex gap-3 text-sm">
                        <span className="text-green-600 font-medium">{batchResults.filter((r,i) => (manualStatuses[i] ?? r.recommendation) === 'shortlist').length} {t.recruitment.shortlist}</span>
                        <span className="text-yellow-600 font-medium">{batchResults.filter((r,i) => (manualStatuses[i] ?? r.recommendation) === 'to_review').length} {t.recruitment.toReview}</span>
                        <span className="text-red-500 font-medium">{batchResults.filter((r,i) => (manualStatuses[i] ?? r.recommendation) === 'reject').length} {t.recruitment.rejected}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {batchResults.map((r, i) => {
                        const effectiveStatus = manualStatuses[i] ?? r.recommendation;
                        const isSelected = selectedForScreening.has(i);
                        return (
                          <div key={i} className={`p-4 rounded-xl border-2 transition-colors ${effectiveStatus === 'shortlist' ? 'border-green-300 bg-green-50' : effectiveStatus === 'to_review' ? 'border-yellow-300 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                {effectiveStatus === 'shortlist'
                                  ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                                  : effectiveStatus === 'to_review'
                                    ? <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                                    : <MinusCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 text-sm truncate">{r.candidate_name}</p>
                                  <p className="text-xs text-gray-500 truncate">{r.filename}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-lg font-bold ${r.overall_score >= 85 ? 'text-green-600' : r.overall_score >= 65 ? 'text-yellow-600' : 'text-red-500'}`}>{r.overall_score}/100</span>
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={e => setSelectedForScreening(prev => { const next = new Set(prev); e.target.checked ? next.add(i) : next.delete(i); return next; })}
                                    className="w-4 h-4 accent-purple-600"
                                  />
                                  <span className="text-xs text-gray-600">{t.recruitment.selectLabel}</span>
                                </label>
                              </div>
                            </div>
                            {/* Status override buttons */}
                            <div className="flex items-center gap-2 mt-3">
                              <span className="text-xs text-gray-500 font-medium">{t.recruitment.changeScoreStatus} :</span>
                              <button
                                onClick={() => setManualStatuses(prev => ({ ...prev, [i]: 'shortlist' }))}
                                className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${effectiveStatus === 'shortlist' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'}`}
                              >✓ {t.recruitment.scoreStatusShortlist}</button>
                              <button
                                onClick={() => setManualStatuses(prev => ({ ...prev, [i]: 'to_review' }))}
                                className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${effectiveStatus === 'to_review' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-700'}`}
                              >~ {t.recruitment.scoreStatusToReview}</button>
                              <button
                                onClick={() => setManualStatuses(prev => ({ ...prev, [i]: 'reject' }))}
                                className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${effectiveStatus === 'reject' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700'}`}
                              >✕ {t.recruitment.scoreStatusRejected}</button>
                              {manualStatuses[i] !== undefined && (
                                <button
                                  onClick={() => setManualStatuses(prev => { const next = { ...prev }; delete next[i]; return next; })}
                                  className="px-1 py-0.5 text-xs text-gray-400 hover:text-gray-600"
                                  title={t.recruitment.reset}
                                >↺</button>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mt-2 line-clamp-2">{r.analysis}</p>
                            {r.score_details.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-2">
                                {r.score_details.map(d => (
                                  <div key={d.category} className="flex items-center gap-1">
                                    <div className="h-1.5 bg-gray-200 rounded-full flex-1"><div className={`h-full rounded-full ${d.score >= 85 ? 'bg-green-500' : d.score >= 65 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${d.score}%` }} /></div>
                                    <span className="text-xs text-gray-500 w-28 truncate">{d.category.split(' ').slice(0,2).join(' ')}</span>
                                    <span className="text-xs font-medium w-6 text-right">{d.score}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {r.conditions_to_verify.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-500 font-medium mb-1">{t.recruitment.toVerify} :</p>
                                {r.conditions_to_verify.slice(0, 2).map((c, j) => <p key={j} className="text-xs text-gray-500">• {c}</p>)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <button onClick={() => { setBatchResults(null); setBatchFiles([]); setManualStatuses({}); setSelectedForScreening(new Set()); }} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">{t.recruitment.newScoring}</button>
                      <button
                        onClick={async () => {
                          if (selectedForScreening.size === 0) { toast.error(t.recruitment.selectAtLeastOne); return; }
                          try {
                            const { applyBatchScoringResults } = await import('@/lib/api');
                            const resultsToApply = Array.from(selectedForScreening).map(idx => {
                              const r = batchResults![idx];
                              const effectiveSt = manualStatuses[idx] ?? r.recommendation;
                              const scoreStatus = (effectiveSt === 'reject' ? 'rejected' : effectiveSt) as 'shortlist' | 'to_review' | 'rejected';
                              return {
                                candidate_name: r.candidate_name || r.filename.replace(/\.[^.]+$/, ''),
                                filename: r.filename,
                                cv_text: batchCvTexts[idx] ?? '',
                                overall_score: r.overall_score,
                                score_details: (r.score_details || []) as Array<{ category: string; score: number; comment: string }>,
                                analysis: r.analysis || '',
                                score_status: scoreStatus,
                              };
                            });
                            const result = await applyBatchScoringResults(batchSelectedJob!, resultsToApply);
                            const msgs: string[] = [];
                            if (result.added > 0) msgs.push(`${result.added} ajouté(s) au pipeline`);
                            if (result.emails_sent > 0) msgs.push(`${result.emails_sent} mail(s) de refus envoyé(s)`);
                            if (result.errors.length > 0) toast.error(`${result.errors.length} erreur(s) : ${result.errors[0]}`);
                            toast.success(msgs.join(' · ') || t.recruitment.markedForScreening);
                            setShowBatchScoringModal(false);
                            setBatchResults(null);
                            setBatchFiles([]);
                            setBatchCvTexts([]);
                            setManualStatuses({});
                            setSelectedForScreening(new Set());
                            await loadData();
                          } catch (e) {
                            toast.error(`Erreur : ${e instanceof Error ? e.message : 'Erreur inconnue'}`);
                          }
                        }}
                        disabled={selectedForScreening.size === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />{t.recruitment.addToShortlist} ({selectedForScreening.size})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {inputDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">{inputDialog.title}</h2>
              <input
                type="text"
                value={inputDialogValue}
                onChange={e => setInputDialogValue(e.target.value)}
                placeholder={inputDialog.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (inputDialog.required && !inputDialogValue.trim()) { toast.error(t.recruitment.fieldRequired); return; }
                    const v = inputDialogValue;
                    setInputDialog(null);
                    inputDialog.onConfirm(v);
                  }
                  if (e.key === 'Escape') setInputDialog(null);
                }}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setInputDialog(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
                <button
                  onClick={() => {
                    if (inputDialog.required && !inputDialogValue.trim()) { toast.error(t.recruitment.fieldRequired); return; }
                    const v = inputDialogValue;
                    setInputDialog(null);
                    inputDialog.onConfirm(v);
                  }}
                  className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >{t.common.confirm}</button>
              </div>
            </div>
          </div>
        )}

        {confirmDialog && (
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onClose={() => setConfirmDialog(null)}
            danger={confirmDialog.danger}
          />
        )}
      </main>
    </>
  );
}

// ============================================
// JOB MODAL COMPONENT
// ============================================

function JobModal({ job, departments, employees, onClose, onSave }: { job: Job | null; departments: Department[]; employees: Employee[]; onClose: () => void; onSave: (data: Partial<Job>) => Promise<void>; }) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: job?.title || '', department_id: job?.department_id?.toString() || '', location: job?.location || '', remote_policy: job?.remote_policy || 'onsite', contract_type: job?.contract_type || 'CDI', description: job?.description || '', requirements: job?.requirements?.join('\n') || '', salary_min: job?.salary_min?.toString() || '', salary_max: job?.salary_max?.toString() || '', show_salary: job?.show_salary || false, visibility: job?.visibility || 'internal', urgency: job?.urgency || 'medium', hiring_manager_id: job?.hiring_manager_id?.toString() || '', deadline: job?.deadline || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await onSave({ title: formData.title, department_id: formData.department_id ? parseInt(formData.department_id) : null, location: formData.location, remote_policy: formData.remote_policy, contract_type: formData.contract_type, description: formData.description || null, requirements: formData.requirements ? formData.requirements.split('\n').filter(r => r.trim()) : null, salary_min: formData.salary_min ? parseFloat(formData.salary_min) : null, salary_max: formData.salary_max ? parseFloat(formData.salary_max) : null, show_salary: formData.show_salary, visibility: formData.visibility, urgency: formData.urgency, hiring_manager_id: formData.hiring_manager_id ? parseInt(formData.hiring_manager_id) : null, deadline: formData.deadline || null });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{job ? t.recruitment.editJob : t.recruitment.newJobPosting}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.jobTitle} *</label><input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.jobTitlePlaceholder} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.common.department}</label><CustomSelect value={formData.department_id} onChange={(v) => setFormData({...formData, department_id: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: '', label: t.recruitment.select }, ...departments.map(d => ({ value: String(d.id), label: d.name }))]} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.address} *</label><input type="text" required value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.addressPlaceholder} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.contractType}</label><CustomSelect value={formData.contract_type} onChange={(v) => setFormData({...formData, contract_type: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: 'CDI', label: 'CDI' }, { value: 'CDD', label: 'CDD' }, { value: 'Stage', label: t.recruitment.contractTypes.stage }, { value: 'Alternance', label: t.recruitment.contractTypes.alternance }, { value: 'Freelance', label: t.recruitment.contractTypes.freelance }]} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.remotePolicy}</label><CustomSelect value={formData.remote_policy} onChange={(v) => setFormData({...formData, remote_policy: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: 'onsite', label: t.recruitment.onsite }, { value: 'hybrid', label: t.recruitment.hybrid }, { value: 'remote', label: t.recruitment.fullRemote }]} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.salaryMin}</label><input type="number" value={formData.salary_min} onChange={(e) => setFormData({...formData, salary_min: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Ex: 1500000" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.salaryMax}</label><input type="number" value={formData.salary_max} onChange={(e) => setFormData({...formData, salary_max: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Ex: 2000000" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.urgency}</label><CustomSelect value={formData.urgency} onChange={(v) => setFormData({...formData, urgency: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: 'low', label: t.recruitment.normal }, { value: 'medium', label: t.recruitment.moderate }, { value: 'high', label: t.recruitment.urgent }]} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.hiringManager}</label><CustomSelect value={formData.hiring_manager_id} onChange={(v) => setFormData({...formData, hiring_manager_id: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: '', label: t.recruitment.select }, ...employees.map(emp => ({ value: String(emp.id), label: `${emp.first_name} ${emp.last_name}` }))]} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.deadlineLabel}</label><CustomDatePicker value={formData.deadline} onChange={(v) => setFormData({...formData, deadline: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div className="flex items-center"><input type="checkbox" id="show_salary" checked={formData.show_salary} onChange={(e) => setFormData({...formData, show_salary: e.target.checked})} className="mr-2" /><label htmlFor="show_salary" className="text-sm text-gray-700">{t.recruitment.showSalary}</label></div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.recruitment.broadcastType}</label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="visibility" value="internal" checked={formData.visibility === 'internal'} onChange={(e) => setFormData({...formData, visibility: e.target.value})} className="w-4 h-4 text-primary-500 focus:ring-primary-500" />
                  <span className="text-sm text-gray-700">{t.recruitment.internalOffer}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="visibility" value="internal_external" checked={formData.visibility === 'internal_external'} onChange={(e) => setFormData({...formData, visibility: e.target.value})} className="w-4 h-4 text-primary-500 focus:ring-primary-500" />
                  <span className="text-sm text-gray-700">{t.recruitment.internalExternal}</span>
                </label>
              </div>
            </div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.description}</label><textarea rows={4} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.descriptionPlaceholder} /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.requirements}</label><textarea rows={4} value={formData.requirements} onChange={(e) => setFormData({...formData, requirements: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.requirementsPlaceholder} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">{saving ? t.recruitment.saving : (job ? t.common.edit : t.common.create)}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// ADD CANDIDATE MODAL COMPONENT
// ============================================

function AddCandidateModal({ jobs, onClose, onSave }: { jobs: Job[]; onClose: () => void; onSave: (data: { first_name: string; last_name: string; email: string; phone?: string; location?: string; linkedin_url?: string; current_company?: string; experience_years?: number; education?: string; skills?: string[]; expected_salary?: number; salary_currency?: string; notice_period?: string; source?: string; job_posting_id?: number; }, cvFile?: File | null) => Promise<void>; }) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', phone: '', location: '', linkedin_url: '', current_company: '', experience_years: '', education: '', skills: '', expected_salary: '', salary_currency: 'XOF', notice_period: '', source: 'Autre', job_posting_id: '' });
  const [currencyOptions, setCurrencyOptions] = useState<{code: string; label: string}[]>([]);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/currency/supported`).then(r => r.json()).then(setCurrencyOptions).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await onSave({ first_name: formData.first_name, last_name: formData.last_name, email: formData.email, phone: formData.phone || undefined, location: formData.location || undefined, linkedin_url: formData.linkedin_url || undefined, current_company: formData.current_company || undefined, experience_years: formData.experience_years ? parseInt(formData.experience_years) : undefined, education: formData.education || undefined, skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(s => s) : undefined, expected_salary: formData.expected_salary ? parseFloat(formData.expected_salary) : undefined, salary_currency: formData.salary_currency || 'XOF', notice_period: formData.notice_period || undefined, source: formData.source, job_posting_id: formData.job_posting_id ? parseInt(formData.job_posting_id) : undefined }, cvFile);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{t.recruitment.addCandidateTitle}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex flex-col gap-4" style={{display: 'flex', flexDirection: 'column'}}>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.firstName} *</label><input type="text" required value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.lastName} *</label><input type="text" required value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.common.email} *</label><input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.phone}</label><input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="+221 77 123 45 67" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.addressLabel}</label><input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.addressPlaceholder} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.linkedinUrl}</label><input type="url" value={formData.linkedin_url} onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="https://linkedin.com/in/..." /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.currentCompany}</label><input type="text" value={formData.current_company} onChange={(e) => setFormData({...formData, current_company: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.experienceYears}</label><input type="number" min="0" value={formData.experience_years} onChange={(e) => setFormData({...formData, experience_years: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.education}</label><input type="text" value={formData.education} onChange={(e) => setFormData({...formData, education: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.educationPlaceholder} /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.skillsComma}</label><input type="text" value={formData.skills} onChange={(e) => setFormData({...formData, skills: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.skillsPlaceholder} /></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.expectedSalary}</label>
              <div className="flex gap-2">
                <input type="number" value={formData.expected_salary} onChange={(e) => setFormData({...formData, expected_salary: e.target.value})} className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="1500000" />
                <CustomSelect value={formData.salary_currency} onChange={(v) => setFormData({...formData, salary_currency: v})} className="w-28 shrink-0 px-1 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white text-sm" options={currencyOptions.length > 0 ? currencyOptions.map(c => ({ value: c.code, label: c.code })) : [{ value: 'XOF', label: 'XOF' }]} />
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.noticePeriodLabel}</label><input type="text" value={formData.notice_period} onChange={(e) => setFormData({...formData, notice_period: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="1 mois" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.source}</label><CustomSelect value={formData.source} onChange={(v) => setFormData({...formData, source: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: 'LinkedIn', label: t.recruitment.sourceLinkedIn }, { value: 'Indeed', label: t.recruitment.sourceIndeed }, { value: 'Site Carrière', label: t.recruitment.sourceCareerSite }, { value: 'Référence interne', label: t.recruitment.sourceInternalRef }, { value: 'Référence externe', label: t.recruitment.sourceExternalRef }, { value: 'Chasseur de tête', label: t.recruitment.sourceHeadhunter }, { value: 'Cabinet', label: t.recruitment.sourceCabinet }, { value: 'Autre', label: t.recruitment.sourceOther }]} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.targetPosition}</label><CustomSelect value={formData.job_posting_id} onChange={(v) => setFormData({...formData, job_posting_id: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: '', label: t.recruitment.selectPosition }, ...jobs.map(j => ({ value: String(j.id), label: j.title }))]} /></div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.cvLabel}</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-600 flex-1">
                  <Upload className="w-4 h-4 text-gray-400" />
                  {cvFile ? cvFile.name : t.recruitment.chooseFile}
                  <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setCvFile(e.target.files?.[0] || null)} />
                </label>
                {cvFile && <button type="button" onClick={() => { setCvFile(null); if (cvInputRef.current) cvInputRef.current.value = ''; }} className="p-1.5 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">{saving ? t.recruitment.creating : t.recruitment.add}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// NEW EMPLOYEE CREDENTIALS MODAL
// ============================================

function NewEmployeeCredentialsModal({ info, onClose }: {
  info: { employee_id: number; user_id: number | null; email: string; temp_password: string | null; already_existed: boolean; candidate_name: string };
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000); });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 border-b border-gray-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t.recruitment.employeeCreated}</h2>
            <p className="text-sm text-gray-500">{info.candidate_name} {t.recruitment.employeeNowVisible}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {info.already_existed ? (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 text-sm text-primary-800">
              {t.recruitment.existingEmployee}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">{t.recruitment.newEmployeeCredentials}</p>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{t.common.email}</p>
                    <p className="text-sm font-medium text-gray-900">{info.email}</p>
                  </div>
                  <button onClick={() => copy(info.email, 'email')} className="p-1.5 hover:bg-gray-200 rounded text-gray-400">
                    {copied === 'email' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Download className="w-4 h-4" />}
                  </button>
                </div>
                {info.temp_password && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-amber-600 mb-0.5">{t.recruitment.tempPassword}</p>
                      <p className="text-sm font-mono font-bold text-amber-900 tracking-wider">{info.temp_password}</p>
                    </div>
                    <button onClick={() => copy(info.temp_password!, 'pwd')} className="p-1.5 hover:bg-amber-100 rounded text-amber-400">
                      {copied === 'pwd' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Download className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
                <strong>{t.recruitment.roleAssigned} :</strong> {t.recruitment.roleEmployee}
              </div>
            </>
          )}
          <div className="flex gap-3 pt-2">
            <a href="/dashboard/employees?tab=employees" className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
              <Users className="w-4 h-4" />{t.recruitment.viewDirectory}
            </a>
            <a href={`/dashboard/onboarding?employee_id=${info.employee_id}&employee_name=${encodeURIComponent(info.candidate_name)}&assign=1`} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm">
              <Rocket className="w-4 h-4" />{t.recruitment.launchOnboarding}
            </a>
          </div>
          <button onClick={onClose} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 pt-1">{t.common.close}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EDIT CANDIDATE MODAL COMPONENT
// ============================================

function EditCandidateModal({ application, onClose, onSave }: { application: Application; onClose: () => void; onSave: (data: Record<string, unknown>, cvFile: File | null) => Promise<void>; }) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState(() => {
    const nameParts = application.candidate_name.split(' ');
    return {
    first_name: nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0],
    last_name: nameParts.length > 1 ? nameParts[nameParts.length - 1] : '',
    email: application.candidate_email || '',
    phone: application.candidate_phone || '',
    location: application.candidate_location || '',
    linkedin_url: application.candidate_linkedin_url || '',
    current_company: application.candidate_current_company || '',
    education: application.candidate_education || '',
    skills: (application.candidate_skills || []).join(', '),
    expected_salary: application.candidate_expected_salary ? String(application.candidate_expected_salary) : '',
    salary_currency: application.salary_currency || 'XOF',
    notice_period: application.candidate_notice_period || '',
  };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await onSave({
      first_name: formData.first_name, last_name: formData.last_name, email: formData.email,
      phone: formData.phone || undefined, location: formData.location || undefined,
      linkedin_url: formData.linkedin_url || undefined, current_company: formData.current_company || undefined,
      education: formData.education || undefined,
      skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(s => s) : undefined,
      expected_salary: formData.expected_salary ? parseFloat(formData.expected_salary) : undefined,
      salary_currency: formData.salary_currency || 'XOF',
      notice_period: formData.notice_period || undefined,
    }, cvFile);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{t.recruitment.editCandidate}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.firstName} *</label><input type="text" required value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.lastName} *</label><input type="text" required value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.common.email} *</label><input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.phone}</label><input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.addressLabel}</label><input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.linkedinUrl}</label><input type="url" value={formData.linkedin_url} onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="https://linkedin.com/in/..." /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.currentCompany}</label><input type="text" value={formData.current_company} onChange={(e) => setFormData({...formData, current_company: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.education}</label><input type="text" value={formData.education} onChange={(e) => setFormData({...formData, education: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.skillsComma}</label><input type="text" value={formData.skills} onChange={(e) => setFormData({...formData, skills: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.skillsPlaceholder} /></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.expectedSalary}</label>
              <div className="flex gap-2">
                <input type="number" value={formData.expected_salary} onChange={(e) => setFormData({...formData, expected_salary: e.target.value})} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="1500000" />
                <input type="text" value={formData.salary_currency} onChange={(e) => setFormData({...formData, salary_currency: e.target.value})} className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm" />
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.noticePeriodLabel}</label><input type="text" value={formData.notice_period} onChange={(e) => setFormData({...formData, notice_period: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="1 mois" /></div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{application.candidate_cv_url ? t.recruitment.replaceCV : t.recruitment.addCV}</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-600 flex-1">
                  <Upload className="w-4 h-4 text-gray-400" />
                  {cvFile ? cvFile.name : (application.candidate_cv_filename || t.recruitment.chooseFile)}
                  <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setCvFile(e.target.files?.[0] || null)} />
                </label>
                {cvFile && <button type="button" onClick={() => { setCvFile(null); if (cvInputRef.current) cvInputRef.current.value = ''; }} className="p-1.5 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">{saving ? t.recruitment.updating : t.recruitment.update}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// INTERVIEW MODAL COMPONENT
// ============================================

function InterviewModal({ application, employees, onClose, onSave }: { application: Application; employees: Employee[]; onClose: () => void; onSave: (data: { application_id: number; interview_type: string; scheduled_at: string; duration_minutes: number; location?: string; meeting_link?: string; interviewer_ids?: number[]; }) => Promise<void>; }) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const [formData, setFormData] = useState({ interview_type: 'video', date: '', time: '10:00', duration_minutes: '60', location: '', meeting_link: '', interviewer_ids: [] as number[] });

  const getGroupedEmployees = () => {
    const filtered = employees.filter(emp => {
      if (!interviewerSearch) return true;
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      const dept = (emp.department_name || '').toLowerCase();
      const search = interviewerSearch.toLowerCase();
      return fullName.includes(search) || dept.includes(search);
    });
    const grouped: Record<string, Employee[]> = {};
    const otherLabel = t.recruitment.other;
    filtered.forEach(emp => { const dept = emp.department_name || otherLabel; if (!grouped[dept]) grouped[dept] = []; grouped[dept].push(emp); });
    Object.keys(grouped).forEach(dept => { grouped[dept].sort((a, b) => { if (a.is_manager && !b.is_manager) return -1; if (!a.is_manager && b.is_manager) return 1; return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`); }); });
    const sortedDepts = Object.keys(grouped).sort((a, b) => { if (a === otherLabel) return 1; if (b === otherLabel) return -1; return a.localeCompare(b); });
    return { grouped, sortedDepts };
  };

  const { grouped, sortedDepts } = getGroupedEmployees();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.time) { toast.error(t.recruitment.selectDateAndTime); return; }
    setSaving(true);
    const scheduled_at = new Date(`${formData.date}T${formData.time}:00`).toISOString();
    await onSave({ application_id: application.id, interview_type: formData.interview_type, scheduled_at, duration_minutes: parseInt(formData.duration_minutes), location: formData.location || undefined, meeting_link: formData.meeting_link || undefined, interviewer_ids: formData.interviewer_ids.length > 0 ? formData.interviewer_ids : undefined });
    setSaving(false);
  };

  const toggleInterviewer = (id: number) => { setFormData(prev => ({ ...prev, interviewer_ids: prev.interviewer_ids.includes(id) ? prev.interviewer_ids.filter(i => i !== id) : [...prev.interviewer_ids, id] })); };
  const selectedEmployees = employees.filter(emp => formData.interviewer_ids.includes(emp.id));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div><h2 className="text-xl font-bold text-gray-900">{t.recruitment.scheduleInterviewTitle}</h2><p className="text-sm text-gray-500">{application.candidate_name} - {application.job_title}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.interviewType}</label>
            <CustomSelect value={formData.interview_type} onChange={(v) => setFormData({...formData, interview_type: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: 'phone', label: t.recruitment.phoneInterview }, { value: 'video', label: t.recruitment.videoInterview }, { value: 'onsite', label: t.recruitment.onsiteInterview }]} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.dateRequired} *</label><CustomDatePicker value={formData.date} onChange={(v) => setFormData({...formData, date: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.timeRequired} *</label><input type="time" required value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.duration}</label>
            <CustomSelect value={formData.duration_minutes} onChange={(v) => setFormData({...formData, duration_minutes: v})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" options={[{ value: '30', label: t.recruitment.minutes30 }, { value: '45', label: t.recruitment.minutes45 }, { value: '60', label: t.recruitment.hours1 }, { value: '90', label: t.recruitment.hours1h30 }, { value: '120', label: t.recruitment.hours2 }]} />
          </div>
          {formData.interview_type === 'video' && (<div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.meetingLink}</label><input type="url" value={formData.meeting_link} onChange={(e) => setFormData({...formData, meeting_link: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.meetingLinkPlaceholder} /></div>)}
          {formData.interview_type === 'onsite' && (<div><label className="block text-sm font-medium text-gray-700 mb-1">{t.recruitment.location}</label><input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder={t.recruitment.locationPlaceholder} /></div>)}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.recruitment.interviewersLabel}</label>
            {selectedEmployees.length > 0 && (<div className="flex flex-wrap gap-2 mb-3">{selectedEmployees.map(emp => (<span key={emp.id} className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-700 text-sm rounded-full">{emp.first_name} {emp.last_name}{emp.is_manager && <span className="ml-1 text-xs bg-primary-200 px-1 rounded">{t.recruitment.managerAbbr}</span>}<button type="button" onClick={() => toggleInterviewer(emp.id)} className="ml-2 text-primary-500 hover:text-primary-700"><X className="w-3 h-3" /></button></span>))}</div>)}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder={t.recruitment.searchByNameOrDept} value={interviewerSearch} onChange={(e) => setInterviewerSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm" />
              {interviewerSearch && (<button type="button" onClick={() => setInterviewerSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>)}
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              {sortedDepts.length === 0 ? (<div className="p-4 text-center text-gray-500 text-sm">{t.recruitment.noEmployeeFound}</div>) : (
                sortedDepts.map(dept => (<div key={dept}><div className="sticky top-0 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 border-b border-gray-200">{dept} ({grouped[dept].length})</div>{grouped[dept].map(emp => (<label key={emp.id} className={`flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${formData.interviewer_ids.includes(emp.id) ? 'bg-primary-50' : ''}`}><input type="checkbox" checked={formData.interviewer_ids.includes(emp.id)} onChange={() => toggleInterviewer(emp.id)} className="mr-3 rounded border-gray-300 text-primary-500 focus:ring-primary-500" /><span className="flex-1 text-sm text-gray-700">{emp.first_name} {emp.last_name}</span>{emp.is_manager && (<span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium">{t.recruitment.managerAbbr}</span>)}</label>))}</div>))
              )}
            </div>
            {formData.interviewer_ids.length > 0 && (<p className="text-xs text-gray-500 mt-2">{formData.interviewer_ids.length} {formData.interviewer_ids.length > 1 ? t.recruitment.interviewersSelected : t.recruitment.interviewerSelected}</p>)}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">{saving ? t.recruitment.scheduling : t.recruitment.schedule}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
