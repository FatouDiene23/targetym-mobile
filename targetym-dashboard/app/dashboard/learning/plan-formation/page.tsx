'use client';

// ============================================
// PLAN DE FORMATION — Page principale
// File: app/dashboard/learning/plan-formation/page.tsx
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Eye, Edit, Copy, X, ChevronLeft, Trash2,
  Calendar, Target, Users, DollarSign, FileText,
  BarChart3, Clock, CheckCircle, AlertTriangle, RefreshCw, MapPin,
  Crosshair, Building2, Link,
} from 'lucide-react';
import { useLearning } from '../LearningContext';
import { API_URL, getAuthHeaders, hasPermission } from '../shared';
import toast from 'react-hot-toast';

// ============================================
// TYPES
// ============================================

interface TrainingPlan {
  id: number;
  tenant_id: number;
  parent_plan_id: number | null;
  title: string;
  description: string | null;
  year: number;
  start_date: string | null;
  end_date: string | null;
  plan_level: string;
  status: string;
  budget_ceiling: number | null;
  currency: string;
  created_by_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  actions_count?: number;
  needs_count?: number;
  schedules_count?: number;
  objectives_count?: number;
  targets_count?: number;
}

interface PlanAction {
  id: number;
  plan_id: number;
  course_id: number | null;
  title: string | null;
  target_type: string;
  target_id: number | null;
  is_mandatory: boolean;
  modality: string;
  provider_id: number | null;
  unit_cost: number | null;
  billing_mode: string | null;
  max_participants: number | null;
  objective_id: number | null;
  course_title: string | null;
  provider_name: string | null;
  created_at: string | null;
}

interface PlanSchedule {
  id: number;
  plan_id: number;
  action_id: number;
  start_date: string | null;
  end_date: string | null;
  quarter: string | null;
  status: string;
  location: string | null;
  trainer_id: number | null;
  external_trainer: string | null;
  max_participants: number | null;
  action_title: string | null;
  trainer_name: string | null;
  enrolled_count: number;
  created_at: string | null;
}

interface PlanNeed {
  id: number;
  plan_id: number;
  employee_id: number;
  employee_name: string | null;
  source: string[] | null;
  skill_target: string | null;
  priority: string;
  year: number | null;
  status: string;
  created_at: string | null;
}

interface BudgetLine {
  action_id: number;
  action_title: string | null;
  course_title: string | null;
  modality: string | null;
  unit_cost: number | null;
  billing_mode: string | null;
  scheduled_sessions: number;
  total_participants: number;
  estimated_cost: number;
}

interface BudgetSummary {
  plan_id: number;
  budget_ceiling: number | null;
  currency: string;
  total_estimated: number;
  budget_remaining: number | null;
  budget_usage_percent: number | null;
  actions_count: number;
  lines: BudgetLine[];
}

interface PlanObjective {
  id: number;
  plan_id: number;
  okr_id: number | null;
  title: string;
  objective_type: string;
  description: string | null;
  progress_pct: number;
  created_by_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  okr_title: string | null;
}

interface PlanTarget {
  id: number;
  plan_id: number;
  target_type: string;
  target_id: number | null;
  target_label: string;
  created_at: string | null;
}

// ============================================
// HELPERS
// ============================================

const PLAN_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Brouillon', bg: 'bg-gray-100',   text: 'text-gray-700' },
  submitted: { label: 'Soumis',    bg: 'bg-amber-100',  text: 'text-amber-700' },
  approved:  { label: 'Approuvé',  bg: 'bg-blue-100',   text: 'text-blue-700' },
  active:    { label: 'Actif',     bg: 'bg-green-100',  text: 'text-green-700' },
  closed:    { label: 'Clôturé',   bg: 'bg-gray-100',   text: 'text-gray-600' },
  cancelled: { label: 'Annulé',    bg: 'bg-red-100',    text: 'text-red-700' },
};

const LEVEL_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  group:      { label: 'Groupe',   bg: 'bg-purple-100', text: 'text-purple-700' },
  subsidiary: { label: 'Filiale',  bg: 'bg-indigo-100', text: 'text-indigo-700' },
  local:      { label: 'Local',    bg: 'bg-teal-100',   text: 'text-teal-700' },
};

const MODALITY_LABELS: Record<string, string> = {
  presentiel: 'Présentiel',
  distanciel: 'Distanciel',
  blended:    'Blended',
  elearning:  'E-learning',
};

const QUARTER_LABELS = ['T1', 'T2', 'T3', 'T4'];

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  high:   { label: 'Haute',   bg: 'bg-red-100',    text: 'text-red-700' },
  medium: { label: 'Moyenne', bg: 'bg-amber-100',  text: 'text-amber-700' },
  low:    { label: 'Basse',   bg: 'bg-green-100',  text: 'text-green-700' },
};

const SCHEDULE_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  planned:     { label: 'Planifié',  bg: 'bg-gray-100',  text: 'text-gray-700' },
  in_progress: { label: 'En cours',  bg: 'bg-blue-100',  text: 'text-blue-700' },
  completed:   { label: 'Terminé',   bg: 'bg-green-100', text: 'text-green-700' },
  cancelled:   { label: 'Annulé',    bg: 'bg-red-100',   text: 'text-red-700' },
};

const OBJECTIVE_TYPE_LABELS: Record<string, string> = {
  okr: 'OKR',
  excellence_operationnelle: 'Excellence opérationnelle',
  developpement_competences: 'Développement compétences',
  conformite_reglementaire: 'Conformité réglementaire',
  managerial: 'Managérial',
  autre: 'Autre',
};

const NEED_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  identified: { label: 'Identifié', bg: 'bg-gray-100',  text: 'text-gray-700' },
  planned:    { label: 'Planifié',  bg: 'bg-blue-100',  text: 'text-blue-700' },
  completed:  { label: 'Terminé',   bg: 'bg-green-100', text: 'text-green-700' },
  cancelled:  { label: 'Annulé',    bg: 'bg-red-100',   text: 'text-red-700' },
};

function StatusBadge({ config, status }: { config: Record<string, { label: string; bg: string; text: string }>; status: string }) {
  const c = config[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-700' };
  return <span className={`px-2 py-0.5 text-xs font-medium rounded ${c.bg} ${c.text}`}>{c.label}</span>;
}

function formatCurrency(amount: number | null | undefined, currency = 'XOF'): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' ' + currency;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

// ============================================
// TENANT INFO TYPE
// ============================================

interface TenantSubsidiary {
  id: number;
  name: string;
}

interface TenantGroupInfo {
  is_group: boolean;
  group_type: 'standalone' | 'group' | 'subsidiary';
  parent_tenant_id: number | null;
  subsidiaries: TenantSubsidiary[];
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function PlanFormationPage() {
  const { userRole } = useLearning();
  const router = useRouter();
  const canManage = hasPermission(userRole, 'create_course'); // admin, dg, dga, rh

  // Redirect unauthorized roles
  useEffect(() => {
    if (userRole === 'employee' || userRole === 'manager') {
      router.replace('/dashboard/learning');
    }
  }, [userRole, router]);

  // ── Tenant group info ──
  const [tenantInfo, setTenantInfo] = useState<TenantGroupInfo | null>(null);
  const [excludedSubIds, setExcludedSubIds] = useState<Set<number>>(new Set());

  // ── List view state ──
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Detail view state ──
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [detailTab, setDetailTab] = useState<'actions' | 'calendar' | 'needs' | 'objectives' | 'targets' | 'budget'>('actions');
  const [actions, setActions] = useState<PlanAction[]>([]);
  const [schedules, setSchedules] = useState<PlanSchedule[]>([]);
  const [needs, setNeeds] = useState<PlanNeed[]>([]);
  const [objectives, setObjectives] = useState<PlanObjective[]>([]);
  const [targets, setTargets] = useState<PlanTarget[]>([]);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Modals ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPlan, setEditPlan] = useState<TrainingPlan | null>(null);

  // ── Add/Edit Action modal ──
  const [showAddAction, setShowAddAction] = useState(false);
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const [coursesList, setCoursesList] = useState<{ id: number; title: string }[]>([]);
  const [providersList, setProvidersList] = useState<{ id: number; name: string }[]>([]);
  const [newAction, setNewAction] = useState({
    title: '', course_id: '', modality: 'presentiel', target_type: 'individual',
    target_id: '', is_mandatory: false, provider_id: '', unit_cost: '',
    billing_mode: '', max_participants: '', objective_id: '',
  });

  // ── Add Need modal ──
  const [showAddNeed, setShowAddNeed] = useState(false);
  const [employeesList, setEmployeesList] = useState<{ id: number; name: string }[]>([]);
  const [skillsList, setSkillsList] = useState<{ id: number; name: string }[]>([]);
  const [manualSkillEntry, setManualSkillEntry] = useState(false);
  const [newNeed, setNewNeed] = useState({
    employee_id: '', skill_target: '', source: [] as string[], priority: 'medium',
  });

  // ── Add Objective modal ──
  const [showAddObjective, setShowAddObjective] = useState(false);
  const [okrList, setOkrList] = useState<{ id: number; title: string; period: string; progress: number }[]>([]);
  const [newObjective, setNewObjective] = useState({
    title: '', objective_type: 'autre', okr_id: '', description: '',
  });

  // ── Add Target modal ──
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [departmentsList, setDepartmentsList] = useState<{ id: number; name: string }[]>([]);
  const [newTarget, setNewTarget] = useState({
    target_type: 'department', target_id: '', target_label: '',
  });

  // ── Add Schedule modal ──
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [manualTrainerEntry, setManualTrainerEntry] = useState(false);
  const [scheduleForAction, setScheduleForAction] = useState<PlanAction | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    start_date: '', end_date: '', quarter: '', location: '',
    trainer_id: '', external_trainer: '', max_participants: '',
  });

  // ── Create form ──
  const [newPlan, setNewPlan] = useState({
    title: '',
    year: currentYear,
    plan_level: 'local',
    start_date: '',
    end_date: '',
    budget_ceiling: '',
    currency: 'XOF',
    description: '',
  });

  // ============================================
  // API — Fetch tenant group info
  // ============================================

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/training-plans/tenant-info`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setTenantInfo(data);
          // Si tenant simple (ni groupe ni filiale), forcer plan_level à 'local'
          if (data.group_type === 'standalone') {
            setNewPlan(p => ({ ...p, plan_level: 'local' }));
          }
          // Si filiale, masquer 'group' → default à 'local'
          if (data.parent_tenant_id != null) {
            setNewPlan(p => ({ ...p, plan_level: 'local' }));
          }
        }
      } catch { /* silently fail */ }
    })();
  }, []);

  // ============================================
  // API — Fetch plans list
  // ============================================

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterYear) params.append('year', String(filterYear));
      if (filterStatus) params.append('status', filterStatus);
      params.append('page_size', '100');

      const res = await fetch(`${API_URL}/api/training-plans/?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Erreur chargement');
      const data = await res.json();
      setPlans(data.items || []);
    } catch {
      toast.error('Erreur lors du chargement des plans');
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterStatus]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  // ============================================
  // API — Fetch plan detail (actions, schedule, needs, budget)
  // ============================================

  const fetchPlanDetail = useCallback(async (planId: number) => {
    setDetailLoading(true);
    try {
      const headers = getAuthHeaders();
      const [detailRes, actionsRes, scheduleRes, needsRes, budgetRes, objectivesRes, targetsRes] = await Promise.all([
        fetch(`${API_URL}/api/training-plans/${planId}`, { headers }),
        fetch(`${API_URL}/api/training-plans/${planId}/actions`, { headers }),
        fetch(`${API_URL}/api/training-plans/${planId}/schedule`, { headers }),
        fetch(`${API_URL}/api/training-plans/${planId}/needs`, { headers }),
        fetch(`${API_URL}/api/training-plans/${planId}/budget`, { headers }),
        fetch(`${API_URL}/api/training-plans/${planId}/objectives`, { headers }),
        fetch(`${API_URL}/api/training-plans/${planId}/targets`, { headers }),
      ]);

      if (detailRes.ok) {
        const detail = await detailRes.json();
        setSelectedPlan(detail);
      }
      if (actionsRes.ok) {
        const d = await actionsRes.json();
        setActions(d.items || []);
      }
      if (scheduleRes.ok) {
        const d = await scheduleRes.json();
        setSchedules(d.items || []);
      }
      if (needsRes.ok) {
        const d = await needsRes.json();
        setNeeds(d.items || []);
      }
      if (budgetRes.ok) {
        setBudget(await budgetRes.json());
      }
      if (objectivesRes.ok) {
        const d = await objectivesRes.json();
        setObjectives(d.items || []);
      }
      if (targetsRes.ok) {
        const d = await targetsRes.json();
        setTargets(d.items || []);
      }
    } catch {
      toast.error('Erreur lors du chargement du détail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ============================================
  // API — Create plan
  // ============================================

  const handleCreatePlan = async () => {
    if (!newPlan.title.trim() || !newPlan.year) {
      toast.error('Le titre et l\'année sont obligatoires');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        title: newPlan.title.trim(),
        year: newPlan.year,
        plan_level: newPlan.plan_level,
        currency: newPlan.currency || 'XOF',
      };
      if (newPlan.description) body.description = newPlan.description;
      if (newPlan.start_date) body.start_date = newPlan.start_date;
      if (newPlan.end_date) body.end_date = newPlan.end_date;
      if (newPlan.budget_ceiling) body.budget_ceiling = parseFloat(newPlan.budget_ceiling);
      // Envoyer les filiales exclues si plan groupe
      if (newPlan.plan_level === 'group' && excludedSubIds.size > 0) {
        body.excluded_subsidiary_ids = Array.from(excludedSubIds);
      }

      const res = await fetch(`${API_URL}/api/training-plans/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur création');
      }
      toast.success('Plan de formation créé');
      setShowCreateModal(false);
      setNewPlan({ title: '', year: currentYear, plan_level: 'local', start_date: '', end_date: '', budget_ceiling: '', currency: 'XOF', description: '' });
      setExcludedSubIds(new Set());
      fetchPlans();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la création');
    }
  };

  // ============================================
  // API — Update plan
  // ============================================

  const handleUpdatePlan = async () => {
    if (!editPlan) return;
    try {
      const body: Record<string, unknown> = {};
      if (editPlan.title) body.title = editPlan.title;
      if (editPlan.description !== undefined) body.description = editPlan.description;
      if (editPlan.year) body.year = editPlan.year;
      if (editPlan.plan_level) body.plan_level = editPlan.plan_level;
      if (editPlan.status) body.status = editPlan.status;
      if (editPlan.budget_ceiling !== null) body.budget_ceiling = editPlan.budget_ceiling;
      if (editPlan.currency) body.currency = editPlan.currency;
      if (editPlan.start_date) body.start_date = editPlan.start_date;
      if (editPlan.end_date) body.end_date = editPlan.end_date;

      const res = await fetch(`${API_URL}/api/training-plans/${editPlan.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Erreur mise à jour');
      toast.success('Plan mis à jour');
      setShowEditModal(false);
      setEditPlan(null);
      fetchPlans();
      if (selectedPlan?.id === editPlan.id) fetchPlanDetail(editPlan.id);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // ============================================
  // API — Soft delete plan
  // ============================================

  const handleDeletePlan = async (planId: number) => {
    if (!confirm('Annuler ce plan de formation ?')) return;
    try {
      const res = await fetch(`${API_URL}/api/training-plans/${planId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Erreur suppression');
      toast.success('Plan annulé');
      if (selectedPlan?.id === planId) setSelectedPlan(null);
      fetchPlans();
    } catch {
      toast.error('Erreur lors de l\'annulation');
    }
  };

  // ============================================
  // API — Duplicate plan
  // ============================================

  const handleDuplicatePlan = async (plan: TrainingPlan) => {
    try {
      const body = {
        title: `${plan.title} (copie)`,
        year: plan.year,
        plan_level: plan.plan_level,
        budget_ceiling: plan.budget_ceiling,
        currency: plan.currency,
        description: plan.description,
        start_date: plan.start_date,
        end_date: plan.end_date,
      };
      const res = await fetch(`${API_URL}/api/training-plans/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Erreur duplication');
      toast.success('Plan dupliqué');
      fetchPlans();
    } catch {
      toast.error('Erreur lors de la duplication');
    }
  };

  // ============================================
  // API — Fetch dropdown data (courses, providers, employees)
  // ============================================

  const fetchDropdownData = useCallback(async () => {
    const headers = getAuthHeaders();
    try {
      const [coursesRes, providersRes, employeesRes, skillsRes, okrRes, deptsRes] = await Promise.all([
        fetch(`${API_URL}/api/learning/courses/?page_size=500`, { headers }),
        fetch(`${API_URL}/api/training/providers`, { headers }),
        fetch(`${API_URL}/api/employees/?page_size=500`, { headers }),
        fetch(`${API_URL}/api/learning/skills/?page_size=500`, { headers }),
        fetch(`${API_URL}/api/okr/objectives?page_size=100`, { headers }),
        fetch(`${API_URL}/api/departments/`, { headers }),
      ]);
      if (coursesRes.ok) {
        const d = await coursesRes.json();
        setCoursesList((d.items || d).map((c: { id: number; title: string }) => ({ id: c.id, title: c.title })));
      }
      if (providersRes.ok) {
        const d = await providersRes.json();
        setProvidersList((d.items || d).filter((p: { is_active?: boolean }) => p.is_active !== false).map((p: { id: number; name: string }) => ({ id: p.id, name: p.name })));
      }
      if (employeesRes.ok) {
        const d = await employeesRes.json();
        setEmployeesList((d.items || d).map((e: { id: number; first_name: string; last_name: string }) => ({ id: e.id, name: `${e.first_name} ${e.last_name}` })));
      }
      if (skillsRes.ok) {
        const d = await skillsRes.json();
        setSkillsList((d.items || d).map((s: { id: number; name: string }) => ({ id: s.id, name: s.name })));
      }
      if (okrRes.ok) {
        const d = await okrRes.json();
        setOkrList((d.items || d).map((o: { id: number; title: string; period: string; progress: number }) => ({
          id: o.id, title: o.title, period: o.period || '', progress: o.progress ?? 0,
        })));
      }
      if (deptsRes.ok) {
        const d = await deptsRes.json();
        setDepartmentsList((d.items || d).map((dept: { id: number; name: string }) => ({ id: dept.id, name: dept.name })));
      }
    } catch { /* silently fail */ }
  }, []);

  // ============================================
  // API — Create action
  // ============================================

  const handleCreateAction = async () => {
    if (!selectedPlan) return;
    if (!newAction.title && !newAction.course_id) {
      toast.error('Un titre ou une formation du catalogue est requis');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        modality: newAction.modality,
        target_type: newAction.target_type,
        is_mandatory: newAction.is_mandatory,
      };
      if (newAction.title) body.title = newAction.title;
      if (newAction.course_id) body.course_id = parseInt(newAction.course_id);
      if (newAction.target_id) body.target_id = parseInt(newAction.target_id);
      if (newAction.provider_id) body.provider_id = parseInt(newAction.provider_id);
      if (newAction.unit_cost) body.unit_cost = parseFloat(newAction.unit_cost);
      if (newAction.billing_mode) body.billing_mode = newAction.billing_mode;
      if (newAction.max_participants) body.max_participants = parseInt(newAction.max_participants);
      if (newAction.objective_id) body.objective_id = parseInt(newAction.objective_id);

      const res = await fetch(`${API_URL}/api/training-plans/${selectedPlan.id}/actions`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur création action');
      }
      toast.success('Action ajoutée au plan');
      setShowAddAction(false);
      setEditingActionId(null);
      setNewAction({ title: '', course_id: '', modality: 'presentiel', target_type: 'individual', target_id: '', is_mandatory: false, provider_id: '', unit_cost: '', billing_mode: '', max_participants: '', objective_id: '' });
      fetchPlanDetail(selectedPlan.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleUpdateAction = async () => {
    if (!selectedPlan || !editingActionId) return;
    if (!newAction.title && !newAction.course_id) {
      toast.error('Un titre ou une formation du catalogue est requis');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        modality: newAction.modality,
        target_type: newAction.target_type,
        is_mandatory: newAction.is_mandatory,
      };
      if (newAction.title) body.title = newAction.title;
      if (newAction.course_id) body.course_id = parseInt(newAction.course_id);
      if (newAction.target_id) body.target_id = parseInt(newAction.target_id);
      if (newAction.provider_id) body.provider_id = parseInt(newAction.provider_id);
      if (newAction.unit_cost) body.unit_cost = parseFloat(newAction.unit_cost);
      if (newAction.billing_mode) body.billing_mode = newAction.billing_mode;
      if (newAction.max_participants) body.max_participants = parseInt(newAction.max_participants);
      if (newAction.objective_id) body.objective_id = parseInt(newAction.objective_id);

      const res = await fetch(`${API_URL}/api/training-plans/${selectedPlan.id}/actions/${editingActionId}`, {
        method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur modification action');
      }
      toast.success('Action modifiée');
      setShowAddAction(false);
      setEditingActionId(null);
      setNewAction({ title: '', course_id: '', modality: 'presentiel', target_type: 'individual', target_id: '', is_mandatory: false, provider_id: '', unit_cost: '', billing_mode: '', max_participants: '', objective_id: '' });
      fetchPlanDetail(selectedPlan.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleDeleteAction = async (actionId: number) => {
    if (!selectedPlan) return;
    if (!window.confirm('Supprimer cette action du plan ?')) return;
    try {
      const res = await fetch(`${API_URL}/api/training-plans/${selectedPlan.id}/actions/${actionId}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur suppression action');
      }
      toast.success('Action supprimée');
      fetchPlanDetail(selectedPlan.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  // ============================================
  // API — Create need
  // ============================================

  const handleCreateNeed = async () => {
    if (!selectedPlan) return;
    if (!newNeed.employee_id) {
      toast.error('L\'employé est obligatoire');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        employee_id: parseInt(newNeed.employee_id),
        priority: newNeed.priority,
        year: selectedPlan.year,
      };
      if (newNeed.skill_target) body.skill_target = newNeed.skill_target;
      if (newNeed.source.length > 0) body.source = newNeed.source;

      const res = await fetch(`${API_URL}/api/training-plans/${selectedPlan.id}/needs`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur création besoin');
      }
      toast.success('Besoin de formation ajouté');
      setShowAddNeed(false);
      setManualSkillEntry(false);
      setNewNeed({ employee_id: '', skill_target: '', source: [], priority: 'medium' });
      fetchPlanDetail(selectedPlan.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  // ============================================
  // API — Create schedule
  // ============================================

  const handleCreateSchedule = async () => {
    if (!selectedPlan || !scheduleForAction) return;
    try {
      const body: Record<string, unknown> = {
        action_id: scheduleForAction.id,
      };
      if (newSchedule.start_date) body.start_date = newSchedule.start_date;
      if (newSchedule.end_date) body.end_date = newSchedule.end_date;
      if (newSchedule.quarter) body.quarter = newSchedule.quarter;
      if (newSchedule.location) body.location = newSchedule.location;
      if (newSchedule.trainer_id) body.trainer_id = parseInt(newSchedule.trainer_id);
      if (newSchedule.external_trainer) body.external_trainer = newSchedule.external_trainer;
      if (newSchedule.max_participants) body.max_participants = parseInt(newSchedule.max_participants);

      const res = await fetch(`${API_URL}/api/training-plans/${selectedPlan.id}/schedule`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur création session');
      }
      toast.success('Session planifiée');
      setShowAddSchedule(false);
      setScheduleForAction(null);
      setManualTrainerEntry(false);
      setNewSchedule({ start_date: '', end_date: '', quarter: '', location: '', trainer_id: '', external_trainer: '', max_participants: '' });
      fetchPlanDetail(selectedPlan.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  // Auto-calculate quarter from start_date
  const autoQuarter = (dateStr: string): string => {
    if (!dateStr) return '';
    const month = new Date(dateStr).getMonth() + 1;
    if (month <= 3) return 'T1';
    if (month <= 6) return 'T2';
    if (month <= 9) return 'T3';
    return 'T4';
  };

  // ============================================
  // API — Create / Delete objective
  // ============================================

  const handleCreateObjective = async () => {
    if (!selectedPlan) return;
    if (!newObjective.title.trim()) {
      toast.error('Le titre de l\'objectif est obligatoire');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        title: newObjective.title.trim(),
        objective_type: newObjective.objective_type,
      };
      if (newObjective.okr_id) body.okr_id = parseInt(newObjective.okr_id);
      if (newObjective.description) body.description = newObjective.description;

      const res = await fetch(`${API_URL}/api/training-plans/${selectedPlan.id}/objectives`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur création objectif');
      }
      toast.success('Objectif ajouté');
      setShowAddObjective(false);
      setNewObjective({ title: '', objective_type: 'autre', okr_id: '', description: '' });
      fetchPlanDetail(selectedPlan.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleDeleteObjective = async (objectiveId: number) => {
    if (!selectedPlan) return;
    if (!window.confirm('Supprimer cet objectif ?')) return;
    try {
      const res = await fetch(`${API_URL}/api/training-plans/${selectedPlan.id}/objectives/${objectiveId}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Erreur suppression');
      toast.success('Objectif supprimé');
      fetchPlanDetail(selectedPlan.id);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  // ============================================
  // API — Create / Delete target
  // ============================================

  const handleCreateTarget = async () => {
    if (!selectedPlan) return;
    if (!newTarget.target_label.trim()) {
      toast.error('Le libellé de la cible est obligatoire');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        target_type: newTarget.target_type,
        target_label: newTarget.target_label.trim(),
      };
      if (newTarget.target_id) body.target_id = parseInt(newTarget.target_id);

      const res = await fetch(`${API_URL}/api/training-plans/${selectedPlan.id}/targets`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Erreur création cible');
      }
      toast.success('Cible ajoutée');
      setShowAddTarget(false);
      setNewTarget({ target_type: 'department', target_id: '', target_label: '' });
      fetchPlanDetail(selectedPlan.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleDeleteTarget = async (targetId: number) => {
    if (!selectedPlan) return;
    if (!window.confirm('Supprimer cette cible ?')) return;
    try {
      const res = await fetch(`${API_URL}/api/training-plans/${selectedPlan.id}/targets/${targetId}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Erreur suppression');
      toast.success('Cible supprimée');
      fetchPlanDetail(selectedPlan.id);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  // ============================================
  // Filtered plans
  // ============================================

  const filteredPlans = plans.filter(p => {
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // ============================================
  // DETAIL VIEW
  // ============================================

  return (
    <div className="space-y-6">
      {selectedPlan && (
      <div className="space-y-6">
        {/* Back button + header */}
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedPlan(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{selectedPlan.title}</h2>
              <StatusBadge config={PLAN_STATUS_CONFIG} status={selectedPlan.status} />
              <StatusBadge config={LEVEL_CONFIG} status={selectedPlan.plan_level} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {selectedPlan.year} &middot; {formatDate(selectedPlan.start_date)} — {formatDate(selectedPlan.end_date)}
              {selectedPlan.budget_ceiling && <> &middot; Plafond : {formatCurrency(selectedPlan.budget_ceiling, selectedPlan.currency)}</>}
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditPlan({ ...selectedPlan }); setShowEditModal(true); }}
                className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" /> Modifier
              </button>
            </div>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Actions</p>
            <p className="text-xl font-bold text-gray-900">{selectedPlan.actions_count ?? actions.length}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Sessions</p>
            <p className="text-xl font-bold text-gray-900">{selectedPlan.schedules_count ?? schedules.length}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Besoins</p>
            <p className="text-xl font-bold text-gray-900">{selectedPlan.needs_count ?? needs.length}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Objectifs</p>
            <p className="text-xl font-bold text-gray-900">{selectedPlan.objectives_count ?? objectives.length}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Cibles</p>
            <p className="text-xl font-bold text-gray-900">{selectedPlan.targets_count ?? targets.length}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">Budget estimé</p>
            <p className="text-xl font-bold text-gray-900">
              {budget ? formatCurrency(budget.total_estimated, budget.currency) : '—'}
            </p>
          </div>
        </div>

        {/* Detail tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex">
              {([
                { key: 'actions' as const, label: 'Actions', icon: Target, count: actions.length },
                { key: 'calendar' as const, label: 'Calendrier', icon: Calendar, count: schedules.length },
                { key: 'needs' as const, label: 'Besoins', icon: Users, count: needs.length },
                { key: 'objectives' as const, label: 'Objectifs', icon: Crosshair, count: objectives.length },
                { key: 'targets' as const, label: 'Cibles', icon: Building2, count: targets.length },
                { key: 'budget' as const, label: 'Budget', icon: DollarSign },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{tab.count}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-5">
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : (
              <>
                {detailTab === 'actions' && (
                  <ActionsTab
                    actions={actions}
                    canManage={canManage}
                    currency={selectedPlan?.currency || 'XOF'}
                    onAddAction={() => { fetchDropdownData(); setEditingActionId(null); setShowAddAction(true); }}
                    onEditAction={(action) => {
                      fetchDropdownData();
                      setEditingActionId(action.id);
                      setNewAction({
                        title: action.title || '', course_id: action.course_id ? String(action.course_id) : '',
                        modality: action.modality || 'presentiel', target_type: action.target_type || 'individual',
                        target_id: action.target_id ? String(action.target_id) : '', is_mandatory: action.is_mandatory,
                        provider_id: action.provider_id ? String(action.provider_id) : '',
                        unit_cost: action.unit_cost ? String(action.unit_cost) : '',
                        billing_mode: action.billing_mode || '', max_participants: action.max_participants ? String(action.max_participants) : '',
                        objective_id: action.objective_id ? String(action.objective_id) : '',
                      });
                      setShowAddAction(true);
                    }}
                    onDeleteAction={(actionId) => handleDeleteAction(actionId)}
                    onScheduleAction={(action) => { fetchDropdownData(); setScheduleForAction(action); setShowAddSchedule(true); }}
                  />
                )}
                {detailTab === 'calendar' && <CalendarTab schedules={schedules} />}
                {detailTab === 'needs' && (
                  <NeedsTab
                    needs={needs}
                    canManage={canManage}
                    onAddNeed={() => { fetchDropdownData(); setShowAddNeed(true); }}
                  />
                )}
                {detailTab === 'objectives' && (
                  <ObjectivesTab
                    objectives={objectives}
                    canManage={canManage}
                    onAddObjective={() => { fetchDropdownData(); setShowAddObjective(true); }}
                    onDeleteObjective={handleDeleteObjective}
                  />
                )}
                {detailTab === 'targets' && (
                  <TargetsTab
                    targets={targets}
                    canManage={canManage}
                    onAddTarget={() => { fetchDropdownData(); setShowAddTarget(true); }}
                    onDeleteTarget={handleDeleteTarget}
                  />
                )}
                {detailTab === 'budget' && <BudgetTab budget={budget} />}
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {!selectedPlan && (
      <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un plan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-56"
            />
          </div>

          {/* Year filter */}
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value ? parseInt(e.target.value) : '')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Toutes les années</option>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous statuts</option>
            {Object.entries(PLAN_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouveau Plan
          </button>
        )}
      </div>

      {/* Plans table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun plan de formation</p>
          <p className="text-sm text-gray-400 mt-1">
            {canManage ? 'Créez votre premier plan avec le bouton ci-dessus.' : 'Aucun plan disponible pour le moment.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Titre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Année</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Niveau</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Budget</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Période</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlans.map(plan => (
                  <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelectedPlan(plan); fetchPlanDetail(plan.id); setDetailTab('actions'); }}
                        className="text-left font-medium text-gray-900 hover:text-primary-600 transition-colors"
                      >
                        {plan.title}
                      </button>
                      {plan.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{plan.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{plan.year}</td>
                    <td className="px-4 py-3">
                      <StatusBadge config={LEVEL_CONFIG} status={plan.plan_level} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge config={PLAN_STATUS_CONFIG} status={plan.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {plan.budget_ceiling
                        ? formatCurrency(plan.budget_ceiling, plan.currency)
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {plan.start_date && plan.end_date
                        ? `${formatDate(plan.start_date)} — ${formatDate(plan.end_date)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setSelectedPlan(plan); fetchPlanDetail(plan.id); setDetailTab('actions'); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary-600 transition-colors"
                          title="Voir le détail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              onClick={() => { setEditPlan({ ...plan }); setShowEditModal(true); }}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary-600 transition-colors"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDuplicatePlan(plan)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors"
                              title="Dupliquer"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </>
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
      </>
      )}

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Nouveau Plan de Formation</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={newPlan.title}
                  onChange={e => setNewPlan(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Plan de formation 2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Année *</label>
                  <select
                    value={newPlan.year}
                    onChange={e => setNewPlan(p => ({ ...p, year: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {/* Niveau — adapté selon le type de tenant */}
                {tenantInfo?.group_type !== 'standalone' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
                    <select
                      value={newPlan.plan_level}
                      onChange={e => { setNewPlan(p => ({ ...p, plan_level: e.target.value })); setExcludedSubIds(new Set()); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="local">Local</option>
                      {/* Filiale : afficher local + subsidiary uniquement */}
                      {tenantInfo?.parent_tenant_id != null && (
                        <option value="subsidiary">Filiale</option>
                      )}
                      {/* Groupe : afficher les 3 niveaux */}
                      {tenantInfo?.is_group && !tenantInfo?.parent_tenant_id && (
                        <>
                          <option value="subsidiary">Filiale</option>
                          <option value="group">Groupe</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
              </div>

              {/* Section filiales — visible si groupe ET plan_level = group */}
              {tenantInfo?.is_group && newPlan.plan_level === 'group' && tenantInfo.subsidiaries.length > 0 && (
                <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-purple-800">Filiales concernées</label>
                    <span className="text-xs text-purple-600 font-medium">
                      {tenantInfo.subsidiaries.length - excludedSubIds.size} filiale{tenantInfo.subsidiaries.length - excludedSubIds.size !== 1 ? 's' : ''} sur {tenantInfo.subsidiaries.length} concernée{tenantInfo.subsidiaries.length - excludedSubIds.size !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {tenantInfo.subsidiaries.map(sub => {
                      const isIncluded = !excludedSubIds.has(sub.id);
                      return (
                        <label key={sub.id} className="flex items-center gap-2 cursor-pointer hover:bg-purple-100 rounded px-2 py-1 transition-colors">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => {
                              setExcludedSubIds(prev => {
                                const next = new Set(prev);
                                if (isIncluded) next.add(sub.id);
                                else next.delete(sub.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-800">{sub.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                  <input
                    type="date"
                    value={newPlan.start_date}
                    onChange={e => setNewPlan(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={newPlan.end_date}
                    onChange={e => setNewPlan(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plafond budgétaire</label>
                  <input
                    type="number"
                    value={newPlan.budget_ceiling}
                    onChange={e => setNewPlan(p => ({ ...p, budget_ceiling: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
                  <select
                    value={newPlan.currency}
                    onChange={e => setNewPlan(p => ({ ...p, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="XOF">XOF (FCFA)</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newPlan.description}
                  onChange={e => setNewPlan(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="Description du plan..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleCreatePlan}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium text-sm"
              >
                Créer le plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && editPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Modifier le plan</h2>
                <button onClick={() => { setShowEditModal(false); setEditPlan(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                <input
                  type="text"
                  value={editPlan.title}
                  onChange={e => setEditPlan(p => p ? { ...p, title: e.target.value } : p)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Année</label>
                  <select
                    value={editPlan.year}
                    onChange={e => setEditPlan(p => p ? { ...p, year: parseInt(e.target.value) } : p)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <select
                    value={editPlan.status}
                    onChange={e => setEditPlan(p => p ? { ...p, status: e.target.value } : p)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    {Object.entries(PLAN_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
                  <select
                    value={editPlan.plan_level}
                    onChange={e => setEditPlan(p => p ? { ...p, plan_level: e.target.value } : p)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="local">Local</option>
                    <option value="subsidiary">Filiale</option>
                    <option value="group">Groupe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plafond budgétaire</label>
                  <input
                    type="number"
                    value={editPlan.budget_ceiling ?? ''}
                    onChange={e => setEditPlan(p => p ? { ...p, budget_ceiling: e.target.value ? parseFloat(e.target.value) : null } : p)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                  <input
                    type="date"
                    value={editPlan.start_date ?? ''}
                    onChange={e => setEditPlan(p => p ? { ...p, start_date: e.target.value || null } : p)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={editPlan.end_date ?? ''}
                    onChange={e => setEditPlan(p => p ? { ...p, end_date: e.target.value || null } : p)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editPlan.description ?? ''}
                  onChange={e => setEditPlan(p => p ? { ...p, description: e.target.value } : p)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => { setShowEditModal(false); setEditPlan(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm"
              >
                Annuler
              </button>
              {canManage && editPlan.status !== 'cancelled' && (
                <button
                  onClick={() => handleDeletePlan(editPlan.id)}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium text-sm"
                >
                  Annuler le plan
                </button>
              )}
              <button
                onClick={handleUpdatePlan}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium text-sm"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Action Modal ── */}
      {showAddAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{editingActionId ? 'Modifier l\'action' : 'Ajouter une action'}</h2>
                <button onClick={() => { setShowAddAction(false); setEditingActionId(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre {!newAction.course_id && '*'}</label>
                <input
                  type="text"
                  value={newAction.title}
                  onChange={e => setNewAction(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="Titre de l'action (requis si pas de formation liée)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formation du catalogue</label>
                <select
                  value={newAction.course_id}
                  onChange={e => setNewAction(p => ({ ...p, course_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— Aucune (formation libre) —</option>
                  {coursesList.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modalité</label>
                  <select
                    value={newAction.modality}
                    onChange={e => setNewAction(p => ({ ...p, modality: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="presentiel">Présentiel</option>
                    <option value="distanciel">Distanciel</option>
                    <option value="blended">Blended</option>
                    <option value="elearning">E-learning</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de cible</label>
                  <select
                    value={newAction.target_type}
                    onChange={e => setNewAction(p => ({ ...p, target_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="individual">Individuel</option>
                    <option value="job">Poste</option>
                    <option value="department">Département</option>
                    <option value="group">Groupe</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                <select
                  value={newAction.provider_id}
                  onChange={e => setNewAction(p => ({ ...p, provider_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— Aucun —</option>
                  {providersList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coût unitaire ({selectedPlan?.currency || 'XOF'})</label>
                  <input
                    type="number"
                    value={newAction.unit_cost}
                    onChange={e => setNewAction(p => ({ ...p, unit_cost: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode de facturation</label>
                  <select
                    value={newAction.billing_mode}
                    onChange={e => setNewAction(p => ({ ...p, billing_mode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— Non défini —</option>
                    <option value="per_participant">Par participant</option>
                    <option value="per_session">Par session</option>
                    <option value="forfait">Forfait</option>
                  </select>
                </div>
              </div>
              {objectives.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Objectif lié</label>
                  <select
                    value={newAction.objective_id}
                    onChange={e => setNewAction(p => ({ ...p, objective_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— Aucun —</option>
                    {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nb participants max</label>
                  <input
                    type="number"
                    value={newAction.max_participants}
                    onChange={e => setNewAction(p => ({ ...p, max_participants: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder="—"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAction.is_mandatory}
                      onChange={e => setNewAction(p => ({ ...p, is_mandatory: e.target.checked }))}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Action obligatoire</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => { setShowAddAction(false); setEditingActionId(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm">Annuler</button>
              <button onClick={editingActionId ? handleUpdateAction : handleCreateAction} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium text-sm">{editingActionId ? 'Enregistrer' : 'Ajouter'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Need Modal ── */}
      {showAddNeed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Ajouter un besoin</h2>
                <button onClick={() => setShowAddNeed(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employé *</label>
                <select
                  value={newNeed.employee_id}
                  onChange={e => setNewNeed(p => ({ ...p, employee_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— Sélectionner —</option>
                  {employeesList.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Compétence cible</label>
                {manualSkillEntry ? (
                  <>
                    <input
                      type="text"
                      value={newNeed.skill_target}
                      onChange={e => setNewNeed(p => ({ ...p, skill_target: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="Ex: Leadership, Excel avancé..."
                    />
                    <button
                      type="button"
                      onClick={() => { setManualSkillEntry(false); setNewNeed(p => ({ ...p, skill_target: '' })); }}
                      className="mt-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Choisir depuis le référentiel
                    </button>
                  </>
                ) : (
                  <>
                    <select
                      value={newNeed.skill_target}
                      onChange={e => setNewNeed(p => ({ ...p, skill_target: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">— Sélectionner une compétence —</option>
                      {skillsList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setManualSkillEntry(true); setNewNeed(p => ({ ...p, skill_target: '' })); }}
                      className="mt-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Saisir manuellement
                    </button>
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <div className="flex flex-wrap gap-2">
                  {['OKR', 'Performance', 'Obligatoire', 'Manager', 'Employé'].map(src => {
                    const isSelected = newNeed.source.includes(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => {
                          setNewNeed(p => ({
                            ...p,
                            source: isSelected
                              ? p.source.filter(s => s !== src)
                              : [...p.source, src],
                          }));
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          isSelected
                            ? 'bg-primary-100 text-primary-700 border-primary-300'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {src}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                <select
                  value={newNeed.priority}
                  onChange={e => setNewNeed(p => ({ ...p, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Faible</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAddNeed(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm">Annuler</button>
              <button onClick={handleCreateNeed} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium text-sm">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Schedule Modal ── */}
      {showAddSchedule && scheduleForAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Planifier une session</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{scheduleForAction.title || scheduleForAction.course_title || 'Action'}</p>
                </div>
                <button onClick={() => { setShowAddSchedule(false); setScheduleForAction(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                  <input
                    type="date"
                    value={newSchedule.start_date}
                    onChange={e => {
                      const val = e.target.value;
                      setNewSchedule(p => ({ ...p, start_date: val, quarter: autoQuarter(val) }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={newSchedule.end_date}
                    onChange={e => setNewSchedule(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trimestre</label>
                  <select
                    value={newSchedule.quarter}
                    onChange={e => setNewSchedule(p => ({ ...p, quarter: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Auto-calculé</option>
                    <option value="T1">T1 (Jan-Mar)</option>
                    <option value="T2">T2 (Avr-Jun)</option>
                    <option value="T3">T3 (Jul-Sep)</option>
                    <option value="T4">T4 (Oct-Déc)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
                  <input
                    type="text"
                    value={newSchedule.location}
                    onChange={e => setNewSchedule(p => ({ ...p, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder="Salle, site..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formateur interne</label>
                <select
                  value={newSchedule.trainer_id}
                  onChange={e => setNewSchedule(p => ({ ...p, trainer_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— Aucun —</option>
                  {employeesList.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formateur externe</label>
                {manualTrainerEntry ? (
                  <>
                    <input
                      type="text"
                      value={newSchedule.external_trainer}
                      onChange={e => setNewSchedule(p => ({ ...p, external_trainer: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="Nom du formateur externe"
                    />
                    <button
                      type="button"
                      onClick={() => { setManualTrainerEntry(false); setNewSchedule(p => ({ ...p, external_trainer: '' })); }}
                      className="mt-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Choisir depuis la liste
                    </button>
                  </>
                ) : (
                  <>
                    <select
                      value={newSchedule.external_trainer}
                      onChange={e => setNewSchedule(p => ({ ...p, external_trainer: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">— Sélectionner un fournisseur —</option>
                      {providersList.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setManualTrainerEntry(true); setNewSchedule(p => ({ ...p, external_trainer: '' })); }}
                      className="mt-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Saisir manuellement
                    </button>
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nb participants max</label>
                <input
                  type="number"
                  value={newSchedule.max_participants}
                  onChange={e => setNewSchedule(p => ({ ...p, max_participants: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="—"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => { setShowAddSchedule(false); setScheduleForAction(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm">Annuler</button>
              <button onClick={handleCreateSchedule} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium text-sm">Planifier</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Objective Modal ── */}
      {showAddObjective && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Ajouter un objectif</h2>
                <button onClick={() => setShowAddObjective(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type d&apos;objectif</label>
                <select
                  value={newObjective.objective_type}
                  onChange={e => {
                    const type = e.target.value;
                    setNewObjective(p => ({
                      ...p,
                      objective_type: type,
                      okr_id: type !== 'okr' ? '' : p.okr_id,
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="okr">OKR</option>
                  <option value="excellence_operationnelle">Excellence opérationnelle</option>
                  <option value="developpement_competences">Développement compétences</option>
                  <option value="conformite_reglementaire">Conformité réglementaire</option>
                  <option value="managerial">Managérial</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  value={newObjective.title}
                  onChange={e => setNewObjective(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  placeholder="Titre de l'objectif"
                />
              </div>
              {newObjective.objective_type === 'okr' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OKR lié</label>
                  {okrList.length > 0 ? (
                    <>
                      <select
                        value={newObjective.okr_id}
                        onChange={e => {
                          const okrId = e.target.value;
                          const okr = okrList.find(o => String(o.id) === okrId);
                          setNewObjective(p => ({
                            ...p,
                            okr_id: okrId,
                            title: okr ? okr.title : p.title,
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">— Sélectionner un OKR —</option>
                        {okrList.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.title} — {o.period} ({Math.round(o.progress)}%)
                          </option>
                        ))}
                      </select>
                      {newObjective.okr_id && (() => {
                        const selected = okrList.find(o => String(o.id) === newObjective.okr_id);
                        if (!selected) return null;
                        return (
                          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                            <p className="text-sm font-medium text-indigo-900">{selected.title}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs text-indigo-600">Période : {selected.period}</span>
                              <span className="text-xs text-indigo-600">Progression : {Math.round(selected.progress)}%</span>
                            </div>
                            <div className="w-full bg-indigo-200 rounded-full h-1.5 mt-1.5">
                              <div
                                className={`h-1.5 rounded-full ${selected.progress >= 100 ? 'bg-green-500' : selected.progress >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min(selected.progress, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Aucun OKR disponible</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newObjective.description}
                  onChange={e => setNewObjective(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="Description de l'objectif..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAddObjective(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm">Annuler</button>
              <button onClick={handleCreateObjective} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium text-sm">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Target Modal ── */}
      {showAddTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Ajouter une cible</h2>
                <button onClick={() => setShowAddTarget(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de cible</label>
                <select
                  value={newTarget.target_type}
                  onChange={e => setNewTarget(p => ({ ...p, target_type: e.target.value, target_id: '', target_label: '' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="department">Département</option>
                  <option value="profile">Profil</option>
                  <option value="level">Niveau</option>
                </select>
              </div>
              {newTarget.target_type === 'department' && departmentsList.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Département *</label>
                  <select
                    value={newTarget.target_id}
                    onChange={e => {
                      const deptId = e.target.value;
                      const dept = departmentsList.find(d => String(d.id) === deptId);
                      setNewTarget(p => ({ ...p, target_id: deptId, target_label: dept?.name || '' }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— Sélectionner —</option>
                    {departmentsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {newTarget.target_type === 'profile' ? 'Profil concerné *' : 'Niveau concerné *'}
                  </label>
                  <input
                    type="text"
                    value={newTarget.target_label}
                    onChange={e => setNewTarget(p => ({ ...p, target_label: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder={newTarget.target_type === 'profile' ? 'Ex: Managers, Commerciaux' : 'Ex: Senior, Junior'}
                  />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAddTarget(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm">Annuler</button>
              <button onClick={handleCreateTarget} className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 font-medium text-sm">Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================
// SUB-COMPONENTS — Detail Tabs
// ============================================

function ActionsTab({ actions, canManage, currency, onAddAction, onEditAction, onDeleteAction, onScheduleAction }: { actions: PlanAction[]; canManage: boolean; currency: string; onAddAction: () => void; onEditAction: (action: PlanAction) => void; onDeleteAction: (actionId: number) => void; onScheduleAction: (action: PlanAction) => void }) {
  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={onAddAction}
            className="px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter une action
          </button>
        </div>
      )}

      {actions.length === 0 ? (
        <div className="text-center py-10">
          <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Aucune action dans ce plan</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Formation</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Modalité</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Cible</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Prestataire</th>
                <th className="text-right px-3 py-2 text-gray-600 font-medium">Coût unit.</th>
                <th className="text-center px-3 py-2 text-gray-600 font-medium">Oblig.</th>
                {canManage && <th className="text-center px-3 py-2 text-gray-600 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {actions.map(action => (
                <tr key={action.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-gray-900">{action.title || action.course_title || '—'}</p>
                    {action.course_title && action.title && action.course_title !== action.title && (
                      <p className="text-xs text-gray-400">{action.course_title}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {MODALITY_LABELS[action.modality] || action.modality}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                      {action.target_type === 'individual' ? 'Individuel' :
                       action.target_type === 'department' ? 'Département' :
                       action.target_type === 'job' ? 'Poste' :
                       action.target_type === 'level' ? 'Niveau' :
                       action.target_type === 'group' ? 'Groupe' : action.target_type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{action.provider_name || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">
                    {action.unit_cost ? formatCurrency(action.unit_cost, currency) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {action.is_mandatory ? (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">Oui</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEditAction(action)}
                          className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteAction(action.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onScheduleAction(action)}
                          className="p-1.5 hover:bg-primary-50 rounded-lg text-gray-400 hover:text-primary-600 transition-colors"
                          title="Planifier une session"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CalendarTab({ schedules }: { schedules: PlanSchedule[] }) {
  if (schedules.length === 0) {
    return (
      <div className="text-center py-10">
        <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">Aucune session planifiée</p>
      </div>
    );
  }

  // Group by quarter
  const byQuarter: Record<string, PlanSchedule[]> = {};
  for (const s of schedules) {
    const q = s.quarter || 'Non assigné';
    if (!byQuarter[q]) byQuarter[q] = [];
    byQuarter[q].push(s);
  }

  return (
    <div className="space-y-6">
      {/* Timeline by quarter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {QUARTER_LABELS.map(q => {
          const items = byQuarter[q] || [];
          const completed = items.filter(s => s.status === 'completed').length;
          return (
            <div key={q} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-gray-700">{q}</p>
              <p className="text-2xl font-bold text-primary-600 mt-1">{items.length}</p>
              <p className="text-xs text-gray-500">{completed}/{items.length} terminées</p>
            </div>
          );
        })}
      </div>

      {/* Sessions list */}
      <div className="space-y-3">
        {schedules.map(s => (
          <div key={s.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">{s.action_title || '—'}</p>
              <p className="text-xs text-gray-500">
                {formatDate(s.start_date)} — {formatDate(s.end_date)}
                {s.location && <> &middot; {s.location}</>}
                {s.trainer_name && <> &middot; {s.trainer_name}</>}
                {s.external_trainer && <> &middot; {s.external_trainer}</>}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-gray-500">{s.enrolled_count} inscrits</span>
              {s.quarter && (
                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">{s.quarter}</span>
              )}
              <StatusBadge config={SCHEDULE_STATUS_CONFIG} status={s.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NeedsTab({ needs, canManage, onAddNeed }: { needs: PlanNeed[]; canManage: boolean; onAddNeed: () => void }) {
  // Group by source
  const sourceCount: Record<string, number> = {};
  for (const n of needs) {
    for (const s of n.source || ['Autre']) {
      sourceCount[s] = (sourceCount[s] || 0) + 1;
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {Object.entries(sourceCount).map(([src, count]) => (
            <span key={src} className="px-3 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">
              {src} ({count})
            </span>
          ))}
        </div>
        {canManage && (
          <button
            onClick={onAddNeed}
            className="px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter un besoin
          </button>
        )}
      </div>

      {needs.length === 0 ? (
        <div className="text-center py-10">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Aucun besoin identifié</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Employé</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Compétence cible</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Source</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Priorité</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {needs.map(need => (
                <tr key={need.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{need.employee_name || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-700">{need.skill_target || '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(need.source || []).map(s => (
                        <span key={s} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge config={PRIORITY_CONFIG} status={need.priority} />
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge config={NEED_STATUS_CONFIG} status={need.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ObjectivesTab({ objectives, canManage, onAddObjective, onDeleteObjective }: { objectives: PlanObjective[]; canManage: boolean; onAddObjective: () => void; onDeleteObjective: (id: number) => void }) {
  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={onAddObjective}
            className="px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter un objectif
          </button>
        </div>
      )}

      {objectives.length === 0 ? (
        <div className="text-center py-10">
          <Crosshair className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Aucun objectif défini pour ce plan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {objectives.map(obj => (
            <div key={obj.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded font-medium">
                      {OBJECTIVE_TYPE_LABELS[obj.objective_type] || obj.objective_type}
                    </span>
                    {obj.okr_id && obj.okr_title && (
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded flex items-center gap-1">
                        <Link className="w-3 h-3" /> OKR: {obj.okr_title}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900">{obj.title}</p>
                  {obj.description && <p className="text-sm text-gray-500 mt-1">{obj.description}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Progress bar */}
                  <div className="w-24">
                    <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                      <span>{obj.progress_pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${obj.progress_pct >= 100 ? 'bg-green-500' : obj.progress_pct >= 50 ? 'bg-primary-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(obj.progress_pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => onDeleteObjective(obj.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TargetsTab({ targets, canManage, onAddTarget, onDeleteTarget }: { targets: PlanTarget[]; canManage: boolean; onAddTarget: () => void; onDeleteTarget: (id: number) => void }) {
  const TARGET_TYPE_LABELS: Record<string, string> = {
    department: 'Département',
    profile: 'Profil',
    level: 'Niveau',
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={onAddTarget}
            className="px-3 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter une cible
          </button>
        </div>
      )}

      {targets.length === 0 ? (
        <div className="text-center py-10">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">Aucune cible définie pour ce plan</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Type</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Libellé</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Date ajout</th>
                {canManage && <th className="text-center px-3 py-2 text-gray-600 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {targets.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                      {TARGET_TYPE_LABELS[t.target_type] || t.target_type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-900">{t.target_label}</td>
                  <td className="px-3 py-2.5 text-gray-500">{formatDate(t.created_at)}</td>
                  {canManage && (
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => onDeleteTarget(t.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BudgetTab({ budget }: { budget: BudgetSummary | null }) {
  if (!budget) {
    return (
      <div className="text-center py-10">
        <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">Données budgétaires indisponibles</p>
      </div>
    );
  }

  const isOverBudget = budget.budget_remaining !== null && budget.budget_remaining < 0;
  const usageColor = isOverBudget ? 'text-red-600' : (budget.budget_usage_percent && budget.budget_usage_percent > 80 ? 'text-amber-600' : 'text-green-600');

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Budget total estimé</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(budget.total_estimated, budget.currency)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Plafond budgétaire</p>
          <p className="text-lg font-bold text-gray-900">{budget.budget_ceiling ? formatCurrency(budget.budget_ceiling, budget.currency) : '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Restant</p>
          <p className={`text-lg font-bold ${budget.budget_remaining != null ? usageColor : 'text-gray-400'}`}>
            {budget.budget_remaining != null ? formatCurrency(budget.budget_remaining, budget.currency) : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500">Utilisation</p>
          <p className={`text-lg font-bold ${budget.budget_usage_percent != null ? usageColor : 'text-gray-400'}`}>
            {budget.budget_usage_percent != null ? `${budget.budget_usage_percent}%` : '—'}
          </p>
        </div>
      </div>

      {/* Budget bar */}
      {budget.budget_ceiling && budget.budget_ceiling > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>0 {budget.currency}</span>
            <span>{formatCurrency(budget.budget_ceiling, budget.currency)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${isOverBudget ? 'bg-red-500' : (budget.budget_usage_percent && budget.budget_usage_percent > 80 ? 'bg-amber-500' : 'bg-green-500')}`}
              style={{ width: `${Math.min(budget.budget_usage_percent || 0, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Over-budget alert */}
      {isOverBudget && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Dépassement budgétaire</p>
            <p className="text-xs text-red-600 mt-0.5">Le budget estimé dépasse le plafond de {formatCurrency(Math.abs(budget.budget_remaining!), budget.currency)}</p>
          </div>
        </div>
      )}

      {/* Cost lines */}
      {budget.lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Action</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Modalité</th>
                <th className="text-left px-3 py-2 text-gray-600 font-medium">Facturation</th>
                <th className="text-right px-3 py-2 text-gray-600 font-medium">Coût unit.</th>
                <th className="text-right px-3 py-2 text-gray-600 font-medium">Sessions</th>
                <th className="text-right px-3 py-2 text-gray-600 font-medium">Participants</th>
                <th className="text-right px-3 py-2 text-gray-600 font-medium">Estimé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {budget.lines.map(line => (
                <tr key={line.action_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{line.action_title || line.course_title || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600">{line.modality ? (MODALITY_LABELS[line.modality] || line.modality) : '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 text-xs">
                    {line.billing_mode === 'per_participant' ? 'Par participant' :
                     line.billing_mode === 'per_session' ? 'Par session' :
                     line.billing_mode === 'forfait' ? 'Forfait' : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{line.unit_cost ? formatCurrency(line.unit_cost, budget.currency) : '—'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{line.scheduled_sessions}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{line.total_participants}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900">{formatCurrency(line.estimated_cost, budget.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300">
                <td colSpan={6} className="px-3 py-2.5 text-right font-bold text-gray-900">Total estimé</td>
                <td className="px-3 py-2.5 text-right font-bold text-gray-900">{formatCurrency(budget.total_estimated, budget.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
