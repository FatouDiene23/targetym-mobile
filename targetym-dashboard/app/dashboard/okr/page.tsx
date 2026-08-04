'use client';
import { getToken } from '@/lib/api';
import { getProgramsByObjective, HRProgram } from '@/lib/api';
import { generateObjectiveContractPDF } from '@/lib/generateObjectiveContractPDF';
import PageLoading from '@/components/PageLoading';
import Pagination from '@/components/Pagination';
import SearchableSelect from '@/components/SearchableSelect';
import CustomSelect from '@/components/CustomSelect';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, ChevronDown, ChevronRight, Trash2, Edit, X,
  Building2, Users, User, Download, Link2, BarChart3, GitBranch, Layers, Loader2, UserRoundCog, AlertTriangle, FileSignature, RefreshCcw,
  BriefcaseBusiness, ClipboardList, Target, Save, Search, FileText, Upload
} from 'lucide-react';
import Header from '@/components/Header';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useI18n } from '@/lib/i18n/I18nContext';
import { useSearchParams } from 'next/navigation';

// ============================================
// TYPES
// ============================================

interface KeyResult {
  id: number;
  objective_id: number;
  title: string;
  description?: string;
  kpi_name?: string;
  baseline?: number;
  measurement_direction?: 'increase' | 'decrease' | 'maintain';
  target: number;
  minimum_target?: string;
  standard_target?: string;
  excellence_target?: string;
  current: number;
  unit: string;
  weight: number;
  progress: number;
}

interface Initiative {
  id: number;
  objective_id: number;
  title: string;
  description?: string;
  source: string;
  external_id?: string;
  external_url?: string;
  progress: number;
  status: string;
  due_date?: string;
}

type ObjectiveLevel = 'enterprise' | 'department' | 'team' | 'individual';
type ObjectiveContractStatus = 'draft' | 'ready_to_sign' | 'signed' | 'in_progress' | 'closed' | 'cancelled';

interface Objective {
  id: number;
  tenant_id: number;
  title: string;
  description?: string;
  level: ObjectiveLevel;
  weight?: number;
  owner_id?: number;
  owner_name?: string;
  owner_initials?: string;
  department_id?: number;
  department_name?: string;
  parent_id?: number;
  parent_key_result_id?: number;
  parent_key_result_title?: string;
  period: string;
  start_date?: string;
  end_date?: string;
  progress: number;
  status: string;
  is_active: boolean;
  key_results: KeyResult[];
  initiatives: Initiative[];
  // UI state
  expanded?: boolean;
}

interface OKRStats {
  total: number;
  by_level: Record<string, number>;
  by_status: Record<string, number>;
  avg_progress: number;
  completed: number;
  in_progress: number;
  not_started: number;
  overdue: number;
  by_department: Record<string, { count: number; avg_progress: number }>;
  cascade: {
    cascade_rate: number;
    alignment_rate: number;
    parent_objectives: number;
    parents_with_children: number;
    aligned_objectives: number;
    orphan_objectives: number;
    orphan_by_level: Record<string, number>;
  };
}

interface Department {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  job_title?: string;
  department_id?: number;
  manager_id?: number;
}

interface AvailableAttitude {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  display_order: number;
}

interface ObjectiveContractAttitude {
  id?: number;
  contract_id?: number;
  attitude_id: number;
  name_snapshot?: string;
  description_snapshot?: string;
  expected_behavior?: string;
  evaluation_mode?: string;
  weight: number;
  threshold?: number;
  score?: number;
  weighted_score?: number;
  sort_order: number;
}

interface ObjectiveContract {
  id: number;
  employee_id: number;
  employee_name?: string;
  employee_matricule?: string;
  employee_job_title?: string;
  manager_id?: number;
  manager_name?: string;
  department_name?: string;
  period: string;
  status: ObjectiveContractStatus;
  objectives_weight: number;
  attitudes_weight: number;
  items_count: number;
  total_items_weight: number;
  final_score?: number;
  employee_signed_at?: string;
  manager_validated_at?: string;
  employee_signature_url?: string | null;
  manager_signature_url?: string | null;
  rh_signature_url?: string | null;
  rh_signer_name?: string | null;
  start_date?: string;
  end_date?: string;
  mid_review_date?: string;
  notes?: string;
  items?: ObjectiveContractItem[];
  attitudes?: ObjectiveContractAttitude[];
}

interface ObjectiveContractItem {
  id: number;
  contract_id: number;
  objective_id?: number;
  parent_id?: number;
  objective_level?: Extract<ObjectiveLevel, 'department' | 'team' | 'individual'>;
  parent_key_result_id?: number;
  parent_key_result_title?: string;
  title: string;
  description?: string;
  action_variables?: string;
  key_results?: KeyResult[];
  weight: number;
  due_date?: string;
  minimum_target?: string;
  standard_target?: string;
  excellence_target?: string;
  score?: number;
  weighted_score?: number;
  sort_order: number;
}

interface ContractKeyResultDraft {
  id?: number;
  title: string;
  kpi_name: string;
  baseline?: number;
  measurement_direction: 'increase' | 'decrease' | 'maintain';
  target: number;
  minimum_target: string;
  standard_target: string;
  excellence_target: string;
  current: number;
  unit: string;
  weight: number;
  is_custom_unit: boolean;
}

interface ContractObjectiveDraft {
  title: string;
  description: string;
  objective_level: Extract<ObjectiveLevel, 'department' | 'team' | 'individual'>;
  action_variables: string;
  weight: number;
  due_date: string;
  minimum_target: string;
  standard_target: string;
  excellence_target: string;
  parent_id?: number;
  parent_key_result_id?: number;
  key_results: ContractKeyResultDraft[];
}

interface ObjectiveContractRow {
  employee_id: number;
  employee_name: string;
  employee_matricule?: string;
  employee_job_title?: string;
  department_name?: string;
  manager_name?: string;
  existing_objectives_count?: number;
  contract?: ObjectiveContract | null;
}

interface EmployeeDocument {
  id: number;
  document_type: string;
  title: string;
  description?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  employee_id?: number;
  employee_name?: string;
  employee_job_title?: string;
  created_at?: string;
}

// ============================================
// API
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');
const JOB_DESCRIPTION_DOCUMENT_TYPE = 'autre';
const JOB_DESCRIPTION_TITLE_PREFIX = 'Job description';

function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function fetchObjectives(params?: { level?: string; status?: string; period?: string }): Promise<{ items: Objective[]; total: number }> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('page_size', '100');
    if (params?.level && params.level !== 'all') queryParams.set('level', params.level);
    if (params?.status && params.status !== 'all') queryParams.set('status', params.status);
    if (params?.period && params.period !== 'all') queryParams.set('period', params.period);

    const response = await fetch(`${API_URL}/api/okr/objectives?${queryParams}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Erreur lors du chargement des objectifs');
    return response.json();
  } catch (e) {
    console.error('fetchObjectives error:', e);
    return { items: [], total: 0 };
  }
}

async function fetchObjectiveContracts(period: string): Promise<{ items: ObjectiveContractRow[]; total: number; period: string }> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('period', period);
    const response = await fetch(`${API_URL}/api/okr/contracts?${queryParams}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Erreur lors du chargement des contrats');
    return response.json();
  } catch (e) {
    console.error('fetchObjectiveContracts error:', e);
    return { items: [], total: 0, period };
  }
}

async function fetchJobDescriptionDocuments(): Promise<EmployeeDocument[]> {
  try {
    const queryParams = new URLSearchParams({
      document_type: JOB_DESCRIPTION_DOCUMENT_TYPE,
      page_size: '500',
    });
    const response = await fetch(`${API_URL}/api/documents/all?${queryParams}`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.items || []).filter((doc: EmployeeDocument) =>
      doc.title?.toLowerCase().startsWith(JOB_DESCRIPTION_TITLE_PREFIX.toLowerCase())
    );
  } catch (e) {
    console.error('fetchJobDescriptionDocuments error:', e);
    return [];
  }
}

async function uploadJobDescription(employee: Employee, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('employee_id', String(employee.id));
  formData.append('document_type', JOB_DESCRIPTION_DOCUMENT_TYPE);
  formData.append('title', `Job description - ${employee.first_name} ${employee.last_name}`);
  formData.append('visible_to_employee', 'true');
  formData.append('is_confidential', 'false');
  formData.append('file', file);

  const token = getToken();
  const response = await fetch(`${API_URL}/api/documents/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Erreur lors de l'upload de la job description");
  }
}

async function deleteEmployeeDocument(documentId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/documents/${documentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Erreur lors de la suppression du document');
  }
}

async function downloadEmployeeDocument(documentId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/documents/download/${documentId}`, { headers: getAuthHeaders() });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Erreur lors du téléchargement');
  }
  const data = await response.json();
  const byteCharacters = atob(data.file_data || '');
  const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0));
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.mime_type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = data.file_name || 'job_description';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function createObjectiveContract(employeeId: number, period: string): Promise<ObjectiveContract> {
  const response = await fetch(`${API_URL}/api/okr/contracts`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ employee_id: employeeId, period }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la création du contrat');
  }
  return response.json();
}

async function resetObjectiveContract(employeeId: number, period: string): Promise<ObjectiveContract> {
  const response = await fetch(`${API_URL}/api/okr/contracts/reset`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ employee_id: employeeId, period }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la réinitialisation du contrat');
  }
  return response.json();
}

async function fetchObjectiveContract(contractId: number): Promise<ObjectiveContract> {
  const response = await fetch(`${API_URL}/api/okr/contracts/${contractId}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur lors du chargement du contrat');
  return response.json();
}

async function updateObjectiveContract(contractId: number, data: Partial<ObjectiveContract>): Promise<ObjectiveContract> {
  const response = await fetch(`${API_URL}/api/okr/contracts/${contractId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la mise à jour du contrat');
  }
  return response.json();
}

async function createContractObjective(contractId: number, data: ContractObjectiveDraft): Promise<ObjectiveContract> {
  const keyResults = buildContractKeyResultsPayload(data);
  const response = await fetch(`${API_URL}/api/okr/contracts/${contractId}/items`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      title: data.title,
      description: data.description || undefined,
      objective_level: data.objective_level,
      action_variables: data.action_variables || undefined,
      weight: data.weight,
      due_date: data.due_date || undefined,
      minimum_target: data.minimum_target || undefined,
      standard_target: data.standard_target || undefined,
      excellence_target: data.excellence_target || undefined,
      parent_id: data.parent_id,
      parent_key_result_id: data.parent_key_result_id,
      key_results: keyResults,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la création de l’objectif contractuel');
  }
  return response.json();
}

function buildContractKeyResultsPayload(data: ContractObjectiveDraft) {
  return data.key_results
    .filter((kr) => kr.title.trim())
    .map((kr) => ({
        id: kr.id,
        title: kr.title,
        kpi_name: kr.kpi_name || undefined,
        baseline: kr.baseline,
        measurement_direction: kr.measurement_direction,
        target: kr.target ?? 0,
        minimum_target: kr.minimum_target || undefined,
        standard_target: kr.standard_target || undefined,
        excellence_target: kr.excellence_target || undefined,
        current: kr.current ?? 0,
        unit: kr.unit || '',
        weight: kr.weight ?? 100,
      }));
}

async function updateContractObjectiveItem(
  contractId: number,
  itemId: number,
  data: ContractObjectiveDraft
): Promise<ObjectiveContract> {
  const keyResults = buildContractKeyResultsPayload(data);
  const response = await fetch(`${API_URL}/api/okr/contracts/${contractId}/items/${itemId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      title: data.title,
      description: data.description || undefined,
      action_variables: data.action_variables || undefined,
      weight: data.weight,
      due_date: data.due_date || undefined,
      minimum_target: data.minimum_target || undefined,
      standard_target: data.standard_target || undefined,
      excellence_target: data.excellence_target || undefined,
      parent_key_result_id: data.parent_key_result_id,
      key_results: keyResults,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Erreur lors de la modification de l'objectif contractuel");
  }
  return response.json();
}

function buildStatsFromObjectives(objectives: Objective[]): OKRStats {
  const byLevel: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const departmentBuckets: Record<string, { totalProgress: number; count: number }> = {};
  const parentLevels = new Set<ObjectiveLevel>(['enterprise', 'department', 'team']);
  const childLevels = new Set<ObjectiveLevel>(['department', 'team', 'individual']);
  const objectiveIds = new Set(objectives.map((objective) => objective.id));
  const parentObjectiveIds = new Set(
    objectives
      .filter((objective) => parentLevels.has(objective.level))
      .map((objective) => objective.id)
  );
  const parentsWithChildren = new Set<number>();
  const orphanByLevel: Record<string, number> = {};
  let alignedObjectives = 0;
  let orphanObjectives = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  objectives.forEach((objective) => {
    byLevel[objective.level] = (byLevel[objective.level] || 0) + 1;
    byStatus[objective.status] = (byStatus[objective.status] || 0) + 1;

    if (objective.department_name) {
      if (!departmentBuckets[objective.department_name]) {
        departmentBuckets[objective.department_name] = { totalProgress: 0, count: 0 };
      }
      departmentBuckets[objective.department_name].totalProgress += objective.progress;
      departmentBuckets[objective.department_name].count += 1;
    }

    if (objective.parent_id && objectiveIds.has(objective.parent_id)) {
      parentsWithChildren.add(objective.parent_id);
    }

    if (childLevels.has(objective.level)) {
      if (objective.parent_id) {
        alignedObjectives += 1;
      } else {
        orphanObjectives += 1;
        orphanByLevel[objective.level] = (orphanByLevel[objective.level] || 0) + 1;
      }
    }
  });

  const byDepartment = Object.fromEntries(
    Object.entries(departmentBuckets).map(([name, data]) => [
      name,
      {
        count: data.count,
        avg_progress: data.count > 0 ? Math.round(data.totalProgress / data.count) : 0,
      },
    ])
  );
  const parentObjectives = parentObjectiveIds.size;
  const childObjectives = objectives.filter((objective) => childLevels.has(objective.level)).length;
  const overdue = objectives.filter((objective) => {
    if (!objective.end_date || objective.status === 'on_track' || objective.status === 'exceeded') return false;
    const endDate = new Date(objective.end_date);
    endDate.setHours(0, 0, 0, 0);
    return endDate < today;
  }).length;

  return {
    total: objectives.length,
    by_level: byLevel,
    by_status: byStatus,
    avg_progress: objectives.length > 0
      ? Math.round(objectives.reduce((sum, objective) => sum + objective.progress, 0) / objectives.length)
      : 0,
    completed: byStatus.exceeded || 0,
    in_progress: byStatus.on_track || 0,
    not_started: objectives.filter((objective) => objective.progress === 0).length,
    overdue,
    by_department: byDepartment,
    cascade: {
      cascade_rate: parentObjectives > 0 ? Math.round((parentsWithChildren.size / parentObjectives) * 100) : 0,
      alignment_rate: childObjectives > 0 ? Math.round((alignedObjectives / childObjectives) * 100) : 0,
      parent_objectives: parentObjectives,
      parents_with_children: parentsWithChildren.size,
      aligned_objectives: alignedObjectives,
      orphan_objectives: orphanObjectives,
      orphan_by_level: orphanByLevel,
    },
  };
}

async function fetchDepartments(): Promise<Department[]> {
  try {
    const response = await fetch(`${API_URL}/api/departments/`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : data.items || [];
  } catch (e) {
    console.error('fetchDepartments error:', e);
    return [];
  }
}

async function fetchEmployees(): Promise<Employee[]> {
  try {
    // Récupérer toutes les pages pour ne manquer aucun employé (page_size=200 par page)
    let all: Employee[] = [];
    let page = 1;
    const pageSize = 200;
    while (true) {
      const response = await fetch(
        `${API_URL}/api/employees/?page_size=${pageSize}&page=${page}&status=active`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) break;
      const data = await response.json();
      const items: Employee[] = data.items || [];
      all = all.concat(items);
      if (items.length < pageSize) break; // dernière page
      page++;
    }
    return all;
  } catch (e) {
    console.error('fetchEmployees error:', e);
    return [];
  }
}

async function fetchAttitudes(): Promise<AvailableAttitude[]> {
  try {
    const response = await fetch(`${API_URL}/api/attitudes?active_only=true`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('fetchAttitudes error:', e);
    return [];
  }
}

async function updateContractAttitudes(contractId: number, attitudes: ObjectiveContractAttitude[]): Promise<ObjectiveContract> {
  const response = await fetch(`${API_URL}/api/okr/contracts/${contractId}/attitudes`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      attitudes: attitudes.map((attitude, index) => ({
        attitude_id: attitude.attitude_id,
        expected_behavior: attitude.expected_behavior || undefined,
        evaluation_mode: attitude.evaluation_mode || undefined,
        weight: attitude.weight || 0,
        threshold: attitude.threshold,
        score: attitude.score,
        sort_order: attitude.sort_order || index + 1,
      })),
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la configuration des attitudes');
  }
  return response.json();
}

async function createObjective(data: Partial<Objective>): Promise<Objective> {
  const response = await fetch(`${API_URL}/api/okr/objectives`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la création');
  }
  return response.json();
}

async function updateObjective(id: number, data: Partial<Objective>): Promise<Objective> {
  const response = await fetch(`${API_URL}/api/okr/objectives/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Erreur lors de la modification');
  }
  return response.json();
}

async function deleteObjective(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/okr/objectives/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur lors de la suppression');
}

async function createKeyResult(objectiveId: number, data: Partial<KeyResult>): Promise<KeyResult> {
  const response = await fetch(`${API_URL}/api/okr/objectives/${objectiveId}/key-results`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Erreur lors de la création du KR');
  }
  return response.json();
}

async function updateKeyResult(krId: number, data: Partial<KeyResult>): Promise<KeyResult> {
  const response = await fetch(`${API_URL}/api/okr/key-results/${krId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Erreur lors de la modification du KR');
  }
  return response.json();
}

async function deleteKeyResult(krId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/okr/key-results/${krId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur lors de la suppression du KR');
}

// ============================================
// HELPERS
// ============================================

const getStatusColor = (s: string) => {
  const m: Record<string, string> = {
    'on_track': 'bg-green-100 text-green-700',
    'at_risk': 'bg-yellow-100 text-yellow-700',
    'behind': 'bg-red-100 text-red-700',
    'exceeded': 'bg-indigo-100 text-indigo-700',
    'completed': 'bg-green-100 text-green-700',
    'draft': 'bg-gray-100 text-gray-700',
    'active': 'bg-blue-100 text-blue-700',
    'cancelled': 'bg-gray-100 text-gray-500',
  };
  return m[s] || 'bg-gray-100 text-gray-700';
};

const getAllowedParentLevels = (level: ObjectiveLevel): ObjectiveLevel[] => {
  if (level === 'department') return ['enterprise'];
  if (level === 'team') return ['department'];
  if (level === 'individual') return ['individual', 'team', 'department'];
  return [];
};

const isValidParentForLevel = (level: ObjectiveLevel, parent?: Objective): boolean => {
  if (!parent) return level === 'enterprise';
  return getAllowedParentLevels(level).includes(parent.level);
};

const getStatusLabel = (s: string, t?: any) => {
  if (t) {
    const m: Record<string, string> = {
      'on_track': t.okr.onTrack,
      'at_risk': t.okr.atRisk,
      'behind': t.okr.behind,
      'exceeded': t.okr.exceeded,
      'completed': t.okr.completed,
      'draft': t.okr.draft,
      'active': t.okr.active,
      'cancelled': t.okr.cancelled,
    };
    return m[s] || s;
  }
  const m: Record<string, string> = {
    'on_track': 'En bonne voie',
    'at_risk': 'À risque',
    'behind': 'En retard',
    'exceeded': 'Dépassé',
    'completed': 'Terminé',
    'draft': 'Brouillon',
    'active': 'Actif',
    'cancelled': 'Annulé',
  };
  return m[s] || s;
};

const getObjectiveDisplayTitle = (objective: Pick<Objective, 'title' | 'description'>) => (
  `${objective.title}${objective.description ? ` : ${objective.description}` : ''}`
);

const getProgressColor = (p: number) => {
  if (p >= 100) return 'bg-indigo-500';
  if (p >= 70) return 'bg-green-500';
  if (p >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getLevelIcon = (l: string) => {
  if (l === 'enterprise') return <Building2 className="w-4 h-4" />;
  if (l === 'department') return <Users className="w-4 h-4" />;
  if (l === 'team') return <UserRoundCog className="w-4 h-4" />;
  return <User className="w-4 h-4" />;
};

const getLevelLabel = (l: string, t?: any) => {
  if (t) {
    const m: Record<string, string> = {
      enterprise: t.okr.enterprise,
      department: t.okr.department,
      team: t.okr.team,
      individual: t.okr.individual,
    };
    return m[l] || l;
  }
  const m: Record<string, string> = {
    enterprise: 'Entreprise',
    department: 'Département',
    team: 'Équipe',
    individual: 'Individuel',
  };
  return m[l] || l;
};

const getLevelColor = (l: string) => {
  const m: Record<string, string> = {
    enterprise: 'bg-purple-100 text-purple-700',
    department: 'bg-blue-100 text-blue-700',
    team: 'bg-amber-100 text-amber-700',
    individual: 'bg-teal-100 text-teal-700',
  };
  return m[l] || 'bg-gray-100';
};

// ─── Lien inverse : Programmes RH liés à un objectif ────────────────────────

function LinkedHRPrograms({ objectiveId }: { objectiveId: number }) {
  const [programs, setPrograms] = useState<HRProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProgramsByObjective(objectiveId)
      .then(setPrograms)
      .catch(() => setPrograms([]))
      .finally(() => setLoading(false));
  }, [objectiveId]);

  if (loading) return null;
  if (!programs.length) return null;

  const ICONS: Record<string, string> = {
    'PRG-01': '🤝', 'PRG-02': '👥', 'PRG-03': '📣',
    'PRG-04': '🌱', 'PRG-05': '💬', 'PRG-06': '🏆',
    'PRG-07': '📈', 'PRG-08': '🏛️',
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Link2 className="w-4 h-4 text-primary-600" />
        Programmes RH contribuant à cet objectif ({programs.length})
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {programs.map(p => (
          <a key={p.id} href="/dashboard/programmes"
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-primary-300 hover:bg-primary-50 transition-colors group">
            <span className="text-lg">{ICONS[p.program_code] ?? '📋'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${p.progress_pct}%` }} />
                </div>
                <span className="text-xs text-gray-500 shrink-0">{p.progress_pct}%</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// Export OKRs to CSV
function exportOKRsToCSV(objectives: Objective[]): void {
  const headers = [
    'Niveau', 'Titre', 'Département', 'Propriétaire', 'Période', 
    'Progression', 'Statut', 'Key Results'
  ];

  const rows = objectives.map(obj => [
    getLevelLabel(obj.level),
    obj.title,
    obj.department_name || '',
    obj.owner_name || '',
    obj.period,
    `${Math.round(obj.progress)}%`,
    getStatusLabel(obj.status),
    obj.key_results.map(kr => `${kr.title}: ${kr.current}/${kr.target} ${kr.unit || ''}`).join(' | ')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `okr_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================
// COMPONENTS
// ============================================

// Modal pour créer/éditer un objectif
function ObjectiveModal({
  isOpen,
  onClose,
  onSave,
  objective,
  initialData,
  departments,
  employees,
  parentObjectives,
  canCreateEnterprise = true,
  userDepartmentId,
  canSeeAll,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Objective>) => Promise<void>;
  objective?: Objective | null;
  initialData?: Partial<Objective> | null;
  departments: Department[];
  employees: Employee[];
  parentObjectives: Objective[];
  canCreateEnterprise?: boolean;
  userDepartmentId?: number | null;
  canSeeAll?: boolean;
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: 'individual' as ObjectiveLevel,
    weight: 0,
    owner_id: undefined as number | undefined,
    department_id: undefined as number | undefined,
    parent_id: undefined as number | undefined,
    parent_key_result_id: undefined as number | undefined,
    period: '2026',
    status: 'draft',
  });
  const [saving, setSaving] = useState(false);
  const selectedOwner = employees.find((employee) => employee.id === formData.owner_id);
  const availableParentObjectives = parentObjectives.filter((parent) => {
    if (parent.id === objective?.id || !getAllowedParentLevels(formData.level).includes(parent.level)) return false;
    if (formData.level === 'individual' && selectedOwner?.manager_id) {
      return parent.owner_id === selectedOwner.manager_id;
    }
    return true;
  });
  const parentObjective = parentObjectives.find((parent) => parent.id === formData.parent_id);
  const requiresParent = formData.level !== 'enterprise' && (
    formData.level !== 'individual' || Boolean(selectedOwner?.manager_id)
  );

  useEffect(() => {
    if (objective) {
      setFormData({
        title: objective.title,
        description: objective.description || '',
        level: objective.level,
        weight: objective.weight || 0,
        owner_id: objective.owner_id,
        department_id: objective.department_id,
        parent_id: objective.parent_id,
        parent_key_result_id: objective.parent_key_result_id,
        period: objective.period,
        status: objective.status,
      });
    } else {
      setFormData({
        title: initialData?.title || '',
        description: initialData?.description || '',
        level: initialData?.level || (canCreateEnterprise ? 'individual' : 'team'),
        weight: initialData?.weight || 0,
        owner_id: initialData?.owner_id,
        department_id: initialData?.department_id || userDepartmentId || undefined,
        parent_id: initialData?.parent_id,
        parent_key_result_id: initialData?.parent_key_result_id,
        period: initialData?.period || '2026',
        status: initialData?.status || 'draft',
      });
    }
  }, [objective, initialData, isOpen, canCreateEnterprise, userDepartmentId]);

  useEffect(() => {
    if (formData.parent_id && !isValidParentForLevel(formData.level, parentObjective)) {
      setFormData((current) => ({ ...current, parent_id: undefined, parent_key_result_id: undefined }));
    }
  }, [formData.level, formData.parent_id, parentObjective]);

  useEffect(() => {
    if (
      formData.level === 'individual' &&
      formData.parent_id &&
      selectedOwner?.manager_id &&
      parentObjective?.owner_id !== selectedOwner.manager_id
    ) {
      setFormData((current) => ({ ...current, parent_id: undefined, parent_key_result_id: undefined }));
    }
  }, [formData.level, formData.parent_id, parentObjective, selectedOwner?.manager_id]);

  useEffect(() => {
    if (
      formData.parent_key_result_id &&
      !parentObjective?.key_results?.some((kr) => kr.id === formData.parent_key_result_id)
    ) {
      setFormData((current) => ({ ...current, parent_key_result_id: undefined }));
    }
  }, [formData.parent_key_result_id, parentObjective]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidParentForLevel(formData.level, parentObjective)) {
      toast.error(t.okr.invalidParentForLevel);
      return;
    }
    if (requiresParent && !formData.parent_id) {
      toast.error(t.okr.parentRequiredForLevel);
      return;
    }
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error(error instanceof Error ? error.message : t.okr.errorSaving);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {objective ? t.okr.editObjective : t.okr.newObjective}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.titleLabel} *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.description}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.level} *</label>
              <CustomSelect
                value={formData.level}
                onChange={(val) => setFormData({ ...formData, level: val as ObjectiveLevel, parent_id: undefined, parent_key_result_id: undefined })}
                options={[
                  ...(canCreateEnterprise ? [{ value: 'enterprise', label: t.okr.enterprise }] : []),
                  { value: 'department', label: t.okr.department },
                  { value: 'team', label: t.okr.team },
                  { value: 'individual', label: t.okr.individual },
                ]}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.objectiveWeight}</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t.okr.objectiveWeightHelp}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.period} *</label>
              <CustomSelect
                value={formData.period}
                onChange={(val) => setFormData({ ...formData, period: val })}
                options={[
                  { value: '2026', label: '2026' },
                  { value: 'Q1 2026', label: 'Q1 2026' },
                  { value: 'Q2 2026', label: 'Q2 2026' },
                  { value: 'Q3 2026', label: 'Q3 2026' },
                  { value: 'Q4 2026', label: 'Q4 2026' },
                  { value: '2025', label: '2025' },
                  { value: 'Q1 2025', label: 'Q1 2025' },
                  { value: 'Q2 2025', label: 'Q2 2025' },
                  { value: 'Q3 2025', label: 'Q3 2025' },
                  { value: 'Q4 2025', label: 'Q4 2025' },
                ]}
                className="w-full"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.departmentLabel}</label>
              <CustomSelect
                value={String(formData.department_id || '')}
                onChange={(val) => setFormData({ ...formData, department_id: val ? parseInt(val) : undefined })}
                options={[
                  { value: '', label: t.okr.none },
                  ...departments.map((d) => ({ value: String(d.id), label: d.name })),
                ]}
                className="w-full"
              />
              {!canSeeAll && departments.length === 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  {t.okr.departmentPreselected}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.owner}</label>
              <SearchableSelect
                value={formData.owner_id ? String(formData.owner_id) : ''}
                onChange={(val) => setFormData({ ...formData, owner_id: val ? parseInt(val) : undefined, parent_id: formData.level === 'individual' ? undefined : formData.parent_id, parent_key_result_id: formData.level === 'individual' ? undefined : formData.parent_key_result_id })}
                placeholder={t.okr.none}
                options={employees.map((emp) => ({ value: String(emp.id), label: `${emp.first_name} ${emp.last_name}` }))}
              />
              {!canSeeAll && employees.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {t.okr.directReportsHint}
                </p>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.parentObjective}</label>
            <CustomSelect
              value={String(formData.parent_id || '')}
              onChange={(val) => setFormData({ ...formData, parent_id: val ? parseInt(val) : undefined, parent_key_result_id: undefined })}
              options={[
                { value: '', label: t.okr.none },
                ...availableParentObjectives.map((o) => ({ value: String(o.id), label: `[${getLevelLabel(o.level, t)}] ${o.title}` })),
              ]}
              className="w-full"
            />
            {requiresParent && (
              <p className="text-xs text-gray-500 mt-1">
                {formData.level === 'individual' && selectedOwner?.manager_id
                  ? t.okr.parentFilteredByManager
                  : availableParentObjectives.length > 0 ? t.okr.parentFilteredByLevel : t.okr.noCompatibleParent}
              </p>
            )}
          </div>

          {parentObjective && parentObjective.key_results?.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.parentKeyResult}</label>
              <CustomSelect
                value={String(formData.parent_key_result_id || '')}
                onChange={(val) => setFormData({ ...formData, parent_key_result_id: val ? parseInt(val) : undefined })}
                options={[
                  { value: '', label: t.okr.noSpecificParentKr },
                  ...parentObjective.key_results.map((kr) => ({ value: String(kr.id), label: kr.title })),
                ]}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">{t.okr.parentKeyResultHelp}</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.statusLabel}</label>
            <CustomSelect
              value={formData.status}
              onChange={(val) => setFormData({ ...formData, status: val })}
              options={[
                { value: 'draft', label: t.okr.draft },
                { value: 'active', label: t.okr.active },
                { value: 'on_track', label: t.okr.onTrack },
                { value: 'at_risk', label: t.okr.atRisk },
                { value: 'behind', label: t.okr.behind },
                { value: 'completed', label: t.okr.completed },
                { value: 'exceeded', label: t.okr.exceeded },
              ]}
              className="w-full"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              {t.okr.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {objective ? t.okr.edit : t.okr.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const UNIT_OPTIONS = [
  { value: '%',      label: '% — Pourcentage' },
  { value: 'nombre', label: 'Nombre (sans unité)' },
  { value: 'XOF',   label: 'XOF — Franc CFA (UEMOA)' },
  { value: 'k XOF', label: 'k XOF — Milliers CFA' },
  { value: 'M XOF', label: 'M XOF — Millions CFA' },
  { value: 'FCFA',  label: 'FCFA' },
  { value: 'GNF',   label: 'GNF — Franc guinéen' },
  { value: 'GHS',   label: 'GHS — Cedi ghanéen' },
  { value: 'NGN',   label: 'NGN — Naira nigérian' },
  { value: 'USD',   label: 'USD — Dollar américain' },
  { value: 'EUR',   label: 'EUR — Euro' },
  { value: 'clients', label: 'Clients' },
  { value: 'leads',   label: 'Leads' },
  { value: 'points',  label: 'Points' },
  { value: 'heures',  label: 'Heures' },
  { value: 'jours',   label: 'Jours' },
  { value: '__autre__', label: 'Autre…' },
];
const STANDARD_UNIT_VALUES = UNIT_OPTIONS.filter((o) => o.value !== '__autre__').map((o) => o.value);

const createEmptyContractKeyResult = (): ContractKeyResultDraft => ({
  title: '',
  kpi_name: '',
  baseline: undefined,
  measurement_direction: 'increase',
  target: 100,
  minimum_target: '',
  standard_target: '',
  excellence_target: '',
  current: 0,
  unit: '',
  weight: 100,
  is_custom_unit: false,
});

// Modal pour ajouter un Key Result
function KeyResultModal({
  isOpen,
  onClose,
  onSave,
  objectiveId,
  keyResult,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (objectiveId: number, data: Partial<KeyResult>) => Promise<void>;
  objectiveId: number;
  keyResult?: KeyResult | null;
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    title: '',
    kpi_name: '',
    baseline: undefined as number | undefined,
    measurement_direction: 'increase' as 'increase' | 'decrease' | 'maintain',
    target: 100,
    current: 0,
    unit: '',
    weight: 100,
  });
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (keyResult) {
      const unit = keyResult.unit || '';
      const isCustom = unit !== '' && !STANDARD_UNIT_VALUES.includes(unit);
      setIsCustomUnit(isCustom);
      setFormData({
        title: keyResult.title,
        kpi_name: keyResult.kpi_name || '',
        baseline: keyResult.baseline,
        measurement_direction: keyResult.measurement_direction || 'increase',
        target: keyResult.target,
        current: keyResult.current,
        unit,
        weight: keyResult.weight,
      });
    } else {
      setIsCustomUnit(false);
      setFormData({
        title: '',
        kpi_name: '',
        baseline: undefined,
        measurement_direction: 'increase',
        target: 100,
        current: 0,
        unit: '',
        weight: 100,
      });
    }
  }, [keyResult, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(objectiveId, formData);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {keyResult ? t.okr.editKeyResult : t.okr.newKeyResult}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.titleLabel} *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.kpiName}</label>
              <input
                type="text"
                value={formData.kpi_name}
                onChange={(e) => setFormData({ ...formData, kpi_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder={t.okr.kpiNamePlaceholder}
              />
              <p className="text-xs text-gray-500 mt-1">{t.okr.kpiNameHelp}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.measurementDirection}</label>
              <CustomSelect
                value={formData.measurement_direction}
                onChange={(val) => setFormData({ ...formData, measurement_direction: val as 'increase' | 'decrease' | 'maintain' })}
                options={[
                  { value: 'increase', label: t.okr.directionIncrease },
                  { value: 'decrease', label: t.okr.directionDecrease },
                  { value: 'maintain', label: t.okr.directionMaintain },
                ]}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.baseline}</label>
              <input
                type="number"
                value={formData.baseline ?? ''}
                onChange={(e) => setFormData({ ...formData, baseline: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">{t.okr.baselineHelp}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.target} *</label>
              <input
                type="number"
                value={formData.target}
                onChange={(e) => setFormData({ ...formData, target: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.current}</label>
              <input
                type="number"
                value={formData.current}
                onChange={(e) => setFormData({ ...formData, current: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.unit}</label>
              <CustomSelect
                value={isCustomUnit ? '__autre__' : (formData.unit || '')}
                onChange={(val) => {
                  if (val === '__autre__') {
                    setIsCustomUnit(true);
                    setFormData({ ...formData, unit: '' });
                  } else {
                    setIsCustomUnit(false);
                    setFormData({ ...formData, unit: val });
                  }
                }}
                options={[
                  { value: '', label: t.okr.chooseUnit },
                  ...UNIT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                ]}
                className="w-full"
              />
              {isCustomUnit && (
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full mt-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder={t.okr.customUnitPlaceholder}
                  autoFocus
                />
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.weightPercent}</label>
            <input
              type="number"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              min="0"
              max="100"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
              {t.okr.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {keyResult ? t.okr.edit : t.okr.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

type UserRole = 'employee' | 'manager' | 'rh' | 'admin' | 'dg';

interface UserData {
  employee_id?: number;
  department_id?: number;
  role?: string;
  is_manager?: boolean;
}

type DrilldownType =
  | 'total'
  | 'on_track'
  | 'at_risk'
  | 'behind'
  | 'exceeded'
  | 'cascade_gap'
  | 'alignment'
  | 'orphans'
  | 'overdue'
  | 'departments_without_objective'
  | 'people_without_objective';

function normalizeRole(role: string | undefined): UserRole {
  if (!role) return 'employee';
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'dg' || r === 'director') return 'dg';
  if (r === 'rh' || r === 'hr') return 'rh';
  if (r === 'manager') return 'manager';
  return 'employee';
}

function OKRContent() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [coverageObjectives, setCoverageObjectives] = useState<Objective[]>([]);
  const [contractRows, setContractRows] = useState<ObjectiveContractRow[]>([]);
  const [jobDescriptionDocs, setJobDescriptionDocs] = useState<EmployeeDocument[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableAttitudes, setAvailableAttitudes] = useState<AvailableAttitude[]>([]);
  
  // User context for role-based filtering
  const [userRole, setUserRole] = useState<UserRole>('employee');
  const [userDepartmentId, setUserDepartmentId] = useState<number | null>(null);
  const [userEmployeeId, setUserEmployeeId] = useState<number | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'list' | 'cascade' | 'dashboard' | 'contracts' | 'jobDescription'>('list');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [contractSearch, setContractSearch] = useState('');
  const [jobDescriptionSearch, setJobDescriptionSearch] = useState('');
  const [jobDescriptionUploadingId, setJobDescriptionUploadingId] = useState<number | null>(null);
  const [contractPage, setContractPage] = useState(1);
  const [jobDescriptionPage, setJobDescriptionPage] = useState(1);
  const [expandedObjectiveId, setExpandedObjectiveId] = useState<number | null>(null);
  const [cascadePage, setCascadePage] = useState(1);
  const [collapsedCascadeBranches, setCollapsedCascadeBranches] = useState<Record<string, boolean>>({});
  const contractPageSize = 10;
  const jobDescriptionPageSize = 10;
  const CASCADE_PAGE_SIZE = 10;
  
  // Section collapse state (pour replier par niveau)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    enterprise: false,
    department: false,
    team: false,
    individual: false,
  });
  const [okrPages, setOkrPages] = useState<Record<string, number>>({
    enterprise: 1,
    department: 1,
    team: 1,
    individual: 1,
  });
  const OKR_PAGE_SIZE = 10;

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'list' || tab === 'cascade' || tab === 'dashboard' || tab === 'contracts' || tab === 'jobDescription') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    setCascadePage(1);
  }, [filterPeriod, filterLevel]);
  
  // Modals
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [showKRModal, setShowKRModal] = useState(false);
  const [krObjectiveId, setKrObjectiveId] = useState<number>(0);
  const [editingKR, setEditingKR] = useState<KeyResult | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownType | null>(null);
  const [initialObjectiveData, setInitialObjectiveData] = useState<Partial<Objective> | null>(null);
  const [selectedContract, setSelectedContract] = useState<ObjectiveContract | null>(null);
  const [contractDrawerOpen, setContractDrawerOpen] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractUpdating, setContractUpdating] = useState(false);
  const [showContractObjectiveModal, setShowContractObjectiveModal] = useState(false);
  const [contractObjectiveSaving, setContractObjectiveSaving] = useState(false);
  const [editingContractItem, setEditingContractItem] = useState<ObjectiveContractItem | null>(null);
  const [showContractAttitudesModal, setShowContractAttitudesModal] = useState(false);
  const [contractAttitudesSaving, setContractAttitudesSaving] = useState(false);
  const [contractAttitudeDrafts, setContractAttitudeDrafts] = useState<ObjectiveContractAttitude[]>([]);
  const [contractObjectiveDraft, setContractObjectiveDraft] = useState<ContractObjectiveDraft>({
    title: '',
    description: '',
    objective_level: 'individual',
    action_variables: '',
    weight: 0,
    due_date: '',
    minimum_target: '',
    standard_target: '',
    excellence_target: '',
    parent_id: undefined,
    parent_key_result_id: undefined,
    key_results: [createEmptyContractKeyResult()],
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  // Écouter le bouton "+ Ajouter" du Header
  useEffect(() => {
    const handleHeaderAdd = () => { setEditingObjective(null); setInitialObjectiveData(null); setShowObjectiveModal(true); };
    window.addEventListener('okr-add', handleHeaderAdd);
    return () => window.removeEventListener('okr-add', handleHeaderAdd);
  }, []);

  // Toggle section collapse
  const toggleSection = (level: string) => {
    setCollapsedSections(prev => ({ ...prev, [level]: !prev[level] }));
  };

  // Employees for assignment (filtered based on role)
  const [assignableEmployees, setAssignableEmployees] = useState<Employee[]>([]);
  // All higher-level objectives for parent alignment dropdown
  const [parentCandidates, setParentCandidates] = useState<Objective[]>([]);

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userData: UserData = JSON.parse(userStr);
          console.log('User data from localStorage:', userData);
          const role = normalizeRole(userData.role);
          setUserRole(role);
          setUserEmployeeId(userData.employee_id || null);
          setIsManager(userData.is_manager || userData.role?.toLowerCase() === 'manager');
          
          // Pour RH/Admin/DG, pas besoin de department_id
          if (['rh', 'admin', 'dg'].includes(role)) {
            setUserLoaded(true);
            return;
          }
          
          // Si department_id est disponible directement
          if (userData.department_id) {
            setUserDepartmentId(userData.department_id);
            setUserLoaded(true);
          } 
          // Sinon, récupérer depuis l'API employee
          else if (userData.employee_id) {
            try {
              const response = await fetch(`${API_URL}/api/employees/${userData.employee_id}`, {
                headers: getAuthHeaders(),
              });
              if (response.ok) {
                const empData = await response.json();
                console.log('Employee data from API:', empData);
                setUserDepartmentId(empData.department_id || null);
              }
            } catch (e) {
              console.error('Error fetching employee:', e);
            }
            setUserLoaded(true);
          } else {
            setUserLoaded(true);
          }
        } catch (e) {
          console.error('Error parsing user:', e);
          setUserLoaded(true);
        }
      } else {
        setUserLoaded(true);
      }
    };
    
    loadUserData();
  }, []);

  // Check if user can see all OKRs (RH, Admin, DG)
  const canSeeAll = ['rh', 'admin', 'dg'].includes(userRole);
  
  // Check if user can create/edit OKRs (general permission)
  const canEdit = ['manager', 'rh', 'admin', 'dg'].includes(userRole) || isManager;

  const headerByTab = {
    list: {
      title: t.okr.listTab,
      subtitle: canSeeAll ? t.okr.listSubtitle : t.okr.subtitleRestricted,
    },
    cascade: {
      title: t.okr.cascadeTab,
      subtitle: canSeeAll ? t.okr.cascadeSubtitle : t.okr.subtitleRestricted,
    },
    dashboard: {
      title: t.okr.dashboardTab,
      subtitle: canSeeAll ? t.okr.dashboardSubtitle : t.okr.subtitleRestricted,
    },
    contracts: {
      title: t.okr.contractsTab,
      subtitle: t.okr.objectiveContractsSubtitle,
    },
    jobDescription: {
      title: t.okr.jobDescriptionTab,
      subtitle: t.okr.jobDescriptionSubtitle,
    },
  }[activeTab];
  
  // Check if user can edit a specific OKR
  const canEditObjective = (obj: Objective): boolean => {
    // RH, Admin, DG can edit everything
    if (['rh', 'admin', 'dg'].includes(userRole)) return true;
    
    // Managers cannot edit Enterprise-level OKRs
    if (obj.level === 'enterprise') return false;
    
    // Managers can edit Department/Team OKRs of their department
    if (obj.level === 'department' || obj.level === 'team') {
      return userDepartmentId !== null && obj.department_id === userDepartmentId;
    }
    
    // Managers can edit Individual OKRs of their department or their own
    if (obj.level === 'individual') {
      if (userDepartmentId !== null && obj.department_id === userDepartmentId) return true;
      if (userEmployeeId !== null && obj.owner_id === userEmployeeId) return true;
    }
    
    return false;
  };

  const loadData = useCallback(async () => {
    // Attendre que les données utilisateur soient chargées
    if (!userLoaded) {
      return;
    }
    
    setLoading(true);
    try {
      const contractPeriod = filterPeriod !== 'all' ? filterPeriod : '2026';
      const [objData, coverageObjData, contractsData, deptData, empData, attitudesData, jobDescriptionData] = await Promise.all([
        fetchObjectives({ level: filterLevel !== 'all' ? filterLevel : undefined, period: filterPeriod !== 'all' ? filterPeriod : undefined }),
        fetchObjectives({ period: filterPeriod !== 'all' ? filterPeriod : undefined }),
        fetchObjectiveContracts(contractPeriod),
        fetchDepartments(),
        fetchEmployees(),
        fetchAttitudes(),
        canSeeAll ? fetchJobDescriptionDocuments() : Promise.resolve([]),
      ]);
      
      const filterObjectivesByRole = (items: Objective[]) => {
        if (canSeeAll) return items;

        return items.filter(obj => {
          // Always show enterprise-level OKRs (for context)
          if (obj.level === 'enterprise') return true;
          
          // Show department/team OKRs for user's department only
          if (obj.level === 'department' || obj.level === 'team') {
            if (userDepartmentId && obj.department_id === userDepartmentId) return true;
            return false;
          }
          
          // Show individual OKRs for user's department or owned by user
          if (obj.level === 'individual') {
            if (userDepartmentId && obj.department_id === userDepartmentId) return true;
            if (userEmployeeId && obj.owner_id === userEmployeeId) return true;
            return false;
          }
          
          return false;
        });
      };

      const filteredObjectives = filterObjectivesByRole(objData.items);
      const filteredCoverageObjectives = filterObjectivesByRole(coverageObjData.items);
      
      console.log('Filtering OKRs - canSeeAll:', canSeeAll, 'userDepartmentId:', userDepartmentId, 'userEmployeeId:', userEmployeeId);
      console.log('Filtered from', objData.items.length, 'to', filteredObjectives.length, 'OKRs');
      
      setObjectives(filteredObjectives);
      setExpandedObjectiveId(null);
      setCoverageObjectives(filteredCoverageObjectives);
      setContractRows(contractsData.items);
      setJobDescriptionDocs(jobDescriptionData);
      setDepartments(deptData);
      setAvailableAttitudes(attitudesData);

      // Stocker les objectifs candidats parent (incluant les objectifs individuels du N+1)
      setParentCandidates(filteredCoverageObjectives.filter(o => ['enterprise', 'department', 'team', 'individual'].includes(o.level)));

      // Charger les employés assignables selon le rôle
      if (canSeeAll) {
        // RH/Admin/DG voient tous les employés
        setAssignableEmployees(empData);
      } else if (userEmployeeId) {
        // Manager: charger lui-même + ses direct-reports
        try {
          // Trouver le manager dans empData, sinon le fetch directement
          let currentEmployee = empData.find((e: Employee) => e.id === userEmployeeId);
          if (!currentEmployee) {
            try {
              const meRes = await fetch(`${API_URL}/api/employees/${userEmployeeId}`, { headers: getAuthHeaders() });
              if (meRes.ok) {
                const meData = await meRes.json();
                currentEmployee = { id: meData.id, first_name: meData.first_name, last_name: meData.last_name, department_id: meData.department_id, manager_id: meData.manager_id };
              }
            } catch { /* ignore */ }
          }

          const allAssignable: Employee[] = [];
          if (currentEmployee) {
            allAssignable.push(currentEmployee);
          }

          // Charger les direct-reports
          const directReportsRes = await fetch(`${API_URL}/api/employees/${userEmployeeId}/direct-reports`, {
            headers: getAuthHeaders(),
          });
          if (directReportsRes.ok) {
            const directReports = await directReportsRes.json();
            const drArray = Array.isArray(directReports) ? directReports : [];
            for (const dr of drArray) {
              allAssignable.push({
                id: dr.id,
                first_name: dr.first_name,
                last_name: dr.last_name,
                department_id: dr.department_id,
                manager_id: dr.manager_id,
              });
            }
            console.log('Direct reports loaded:', drArray.length);
          }

          setAssignableEmployees(allAssignable);
        } catch (e) {
          console.error('Error fetching assignable employees:', e);
        }
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }, [filterLevel, filterPeriod, canSeeAll, userDepartmentId, userEmployeeId, userLoaded]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (id: number) => {
    setExpandedObjectiveId((currentId) => (currentId === id ? null : id));
  };

  const handleSaveObjective = async (data: Partial<Objective>) => {
    if (editingObjective) {
      await updateObjective(editingObjective.id, data);
    } else {
      await createObjective(data);
    }
    await loadData();
  };

  const handleCreateContract = async (employeeId: number) => {
    try {
      const contract = await createObjectiveContract(employeeId, filterPeriod !== 'all' ? filterPeriod : '2026');
      setSelectedContract(contract);
      setContractDrawerOpen(true);
      toast.success(t.okr.contractCreated);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.okr.errorSaving);
    }
  };

  const canResetContract = (contract?: ObjectiveContract | null) => {
    return !!contract && !['signed', 'in_progress', 'closed'].includes(contract.status);
  };

  const handleResetContract = (row: ObjectiveContractRow) => {
    const period = filterPeriod !== 'all' ? filterPeriod : '2026';
    setConfirmDialog({
      isOpen: true,
      title: t.okr.resetContractTitle,
      message: t.okr.resetContractMessage,
      danger: true,
      onConfirm: async () => {
        try {
          const contract = await resetObjectiveContract(row.employee_id, period);
          setSelectedContract(contract);
          setContractDrawerOpen(true);
          toast.success(t.okr.contractReset);
          await loadData();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t.okr.errorSaving);
        }
      },
    });
  };

  const handleOpenContract = async (contractId: number) => {
    setContractDrawerOpen(true);
    setContractLoading(true);
    try {
      const contract = await fetchObjectiveContract(contractId);
      setSelectedContract(contract);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.okr.errorSaving);
      setContractDrawerOpen(false);
    } finally {
      setContractLoading(false);
    }
  };

  const openContractObjectiveModal = () => {
    setEditingContractItem(null);
    setContractObjectiveDraft({
      title: '',
      description: '',
      objective_level: 'individual',
      action_variables: '',
      weight: 0,
      due_date: '',
      minimum_target: '',
      standard_target: '',
      excellence_target: '',
      parent_id: undefined,
      parent_key_result_id: undefined,
      key_results: [createEmptyContractKeyResult()],
    });
    setShowContractObjectiveModal(true);
  };

  const openEditContractObjectiveModal = (item: ObjectiveContractItem) => {
    const itemKeyResults = item.key_results?.length
      ? item.key_results.map((kr) => ({
          id: kr.id,
          title: kr.title || '',
          kpi_name: kr.kpi_name || '',
          baseline: kr.baseline,
          measurement_direction: kr.measurement_direction || 'increase',
          target: kr.target || 100,
          minimum_target: kr.minimum_target || '',
          standard_target: kr.standard_target || '',
          excellence_target: kr.excellence_target || '',
          current: kr.current ?? 0,
          unit: kr.unit || '',
          weight: kr.weight || 100,
          is_custom_unit: !!kr.unit && !STANDARD_UNIT_VALUES.includes(kr.unit),
        }))
      : [createEmptyContractKeyResult()];
    setEditingContractItem(item);
    setContractObjectiveDraft({
      title: item.title || '',
      description: item.description || '',
      objective_level: item.objective_level || 'individual',
      action_variables: item.action_variables || '',
      weight: item.weight || 0,
      due_date: item.due_date ? item.due_date.slice(0, 10) : '',
      minimum_target: item.minimum_target || '',
      standard_target: item.standard_target || '',
      excellence_target: item.excellence_target || '',
      parent_id: item.parent_id,
      parent_key_result_id: item.parent_key_result_id,
      key_results: itemKeyResults,
    });
    setShowContractObjectiveModal(true);
  };

  const handleSaveContractObjective = async () => {
    if (!selectedContract) return;
    if (!contractObjectiveDraft.title.trim()) {
      toast.error(t.okr.titleRequired);
      return;
    }
    if (contractObjectiveDraft.weight <= 0) {
      toast.error(t.okr.weightRequired);
      return;
    }
    if (!contractObjectiveDraft.key_results.some((kr) => kr.title.trim())) {
      toast.error(t.okr.keyResultRequired);
      return;
    }
    const contractObjectiveRequiresParent =
      contractObjectiveDraft.objective_level === 'department' ||
      contractObjectiveDraft.objective_level === 'team' ||
      (contractObjectiveDraft.objective_level === 'individual' && Boolean(selectedContract.manager_id));
    if (!editingContractItem && contractObjectiveRequiresParent && !contractObjectiveDraft.parent_id) {
      toast.error(t.okr.managerParentRequired);
      return;
    }

    setContractObjectiveSaving(true);
    try {
      const updatedContract = editingContractItem
        ? await updateContractObjectiveItem(selectedContract.id, editingContractItem.id, contractObjectiveDraft)
        : await createContractObjective(selectedContract.id, contractObjectiveDraft);
      setSelectedContract(updatedContract);
      setShowContractObjectiveModal(false);
      setEditingContractItem(null);
      toast.success(editingContractItem ? 'Objectif contractuel modifié' : t.okr.contractObjectiveCreated);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.okr.errorSaving);
    } finally {
      setContractObjectiveSaving(false);
    }
  };

  const updateContractKeyResultDraft = (index: number, patch: Partial<ContractKeyResultDraft>) => {
    setContractObjectiveDraft((current) => ({
      ...current,
      key_results: current.key_results.map((kr, krIndex) => (
        krIndex === index ? { ...kr, ...patch } : kr
      )),
    }));
  };

  const addContractKeyResultDraft = () => {
    setContractObjectiveDraft((current) => ({
      ...current,
      key_results: [...current.key_results, createEmptyContractKeyResult()],
    }));
  };

  const removeContractKeyResultDraft = (index: number) => {
    setContractObjectiveDraft((current) => ({
      ...current,
      key_results: current.key_results.length > 1
        ? current.key_results.filter((_, krIndex) => krIndex !== index)
        : current.key_results,
    }));
  };

  const contractParentCandidates = parentCandidates.filter((objective) => {
    if (contractObjectiveDraft.objective_level === 'department') {
      return objective.level === 'enterprise';
    }
    if (contractObjectiveDraft.objective_level === 'team') {
      return objective.level === 'department';
    }
    if (selectedContract?.manager_id) {
      return objective.owner_id === selectedContract.manager_id;
    }
    return ['team', 'department'].includes(objective.level);
  });
  const contractParentObjective = parentCandidates.find((objective) => objective.id === contractObjectiveDraft.parent_id);

  useEffect(() => {
    if (
      contractObjectiveDraft.parent_key_result_id &&
      !contractParentObjective?.key_results?.some((kr) => kr.id === contractObjectiveDraft.parent_key_result_id)
    ) {
      setContractObjectiveDraft((current) => ({ ...current, parent_key_result_id: undefined }));
    }
  }, [contractObjectiveDraft.parent_key_result_id, contractParentObjective]);

  const handleDownloadContractPdf = async () => {
    if (!selectedContract) return;
    try {
      await generateObjectiveContractPDF(selectedContract, 'TARGETYM AI', t.okr, locale);
    } catch (error) {
      console.error('Erreur génération contrat PDF:', error);
      toast.error(t.okr.errorSaving);
    }
  };

  const getNextContractStatus = (status: ObjectiveContractStatus): ObjectiveContractStatus | null => {
    if (status === 'draft') return 'ready_to_sign';
    if (status === 'ready_to_sign') return 'signed';
    if (status === 'signed') return 'in_progress';
    if (status === 'in_progress') return 'closed';
    return null;
  };

  const getNextContractActionLabel = (status: ObjectiveContractStatus) => {
    if (status === 'draft') return t.okr.prepareForSignature;
    if (status === 'ready_to_sign') return t.okr.markAsSigned;
    if (status === 'signed') return t.okr.startTracking;
    if (status === 'in_progress') return t.okr.closeContract;
    return '';
  };

  const handleUpdateContract = async (data: Partial<ObjectiveContract>, successMessage: string) => {
    if (!selectedContract) return;
    setContractUpdating(true);
    try {
      const updatedContract = await updateObjectiveContract(selectedContract.id, data);
      setSelectedContract(updatedContract);
      toast.success(successMessage);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.okr.errorSaving);
    } finally {
      setContractUpdating(false);
    }
  };

  const handleSaveContractWeights = async () => {
    if (!selectedContract) return;
    const objectivesWeight = Number(selectedContract.objectives_weight || 0);
    const attitudesWeight = Number(selectedContract.attitudes_weight || 0);
    if (Math.round((objectivesWeight + attitudesWeight) * 100) / 100 !== 100) {
      toast.error(t.okr.weightsMustEqual100);
      return;
    }
    await handleUpdateContract(
      { objectives_weight: objectivesWeight, attitudes_weight: attitudesWeight },
      t.okr.contractWeightsUpdated
    );
  };

  const openContractAttitudesModal = () => {
    if (!selectedContract) return;
    const existing = selectedContract.attitudes || [];
    setContractAttitudeDrafts(existing.map((attitude, index) => ({
      attitude_id: attitude.attitude_id,
      expected_behavior: attitude.expected_behavior || '',
      evaluation_mode: attitude.evaluation_mode || t.okr.attitudeEvaluationContinuous,
      weight: attitude.weight || 0,
      threshold: attitude.threshold ?? 80,
      sort_order: attitude.sort_order || index + 1,
    })));
    setShowContractAttitudesModal(true);
  };

  const toggleContractAttitude = (attitude: AvailableAttitude) => {
    setContractAttitudeDrafts((prev) => {
      if (prev.some((item) => item.attitude_id === attitude.id)) {
        return prev.filter((item) => item.attitude_id !== attitude.id);
      }
      const nextCount = prev.length + 1;
      const defaultWeight = nextCount > 0 ? Math.round((100 / nextCount) * 100) / 100 : 0;
      return [
        ...prev.map((item) => ({ ...item, weight: item.weight || defaultWeight })),
        {
          attitude_id: attitude.id,
          expected_behavior: attitude.description || '',
          evaluation_mode: t.okr.attitudeEvaluationContinuous,
          weight: defaultWeight,
          threshold: 80,
          sort_order: nextCount,
        },
      ];
    });
  };

  const updateContractAttitudeDraft = (attitudeId: number, patch: Partial<ObjectiveContractAttitude>) => {
    setContractAttitudeDrafts((prev) => prev.map((item) => (
      item.attitude_id === attitudeId ? { ...item, ...patch } : item
    )));
  };

  const removeContractAttitudeDraft = (attitudeId: number) => {
    setContractAttitudeDrafts((prev) => prev.filter((item) => item.attitude_id !== attitudeId));
  };

  const handleSaveContractAttitudes = async () => {
    if (!selectedContract) return;
    const totalWeight = contractAttitudeDrafts.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    if (contractAttitudeDrafts.length > 0 && Math.round(totalWeight * 100) / 100 !== 100) {
      toast.error(t.okr.attitudesWeightMustEqual100);
      return;
    }

    setContractAttitudesSaving(true);
    try {
      const updatedContract = await updateContractAttitudes(selectedContract.id, contractAttitudeDrafts);
      setSelectedContract(updatedContract);
      setShowContractAttitudesModal(false);
      toast.success(t.okr.contractAttitudesUpdated);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.okr.errorSaving);
    } finally {
      setContractAttitudesSaving(false);
    }
  };

  const handleMoveContractNextStep = async () => {
    if (!selectedContract) return;
    const nextStatus = getNextContractStatus(selectedContract.status);
    if (!nextStatus) return;
    await handleUpdateContract({ status: nextStatus }, t.okr.contractStatusUpdated);
  };

  const getCurrentPeriod = () => filterPeriod !== 'all' ? filterPeriod : '2026';
  const filteredContractRows = useMemo(() => {
    const normalized = contractSearch.trim().toLowerCase();
    if (!normalized) return contractRows;
    return contractRows.filter((row) => [
      row.employee_name,
      row.employee_matricule,
      row.employee_job_title,
      row.department_name,
      row.manager_name,
    ].some((value) => value?.toLowerCase().includes(normalized)));
  }, [contractRows, contractSearch]);
  const contractStats = useMemo(() => {
    const created = contractRows.filter((row) => !!row.contract);
    const signed = created.filter((row) => row.contract?.status === 'signed' || !!row.contract?.employee_signed_at);
    return {
      totalEmployees: contractRows.length,
      created: created.length,
      missing: contractRows.length - created.length,
      signed: signed.length,
      notSigned: created.length - signed.length,
      readyToSign: created.filter((row) => row.contract?.status === 'ready_to_sign').length,
      draft: created.filter((row) => row.contract?.status === 'draft').length,
    };
  }, [contractRows]);
  const departmentNameById = useMemo(
    () => new Map(departments.map((department) => [department.id, department.name])),
    [departments]
  );
  const latestJobDescriptionByEmployeeId = useMemo(() => {
    const map = new Map<number, EmployeeDocument>();
    jobDescriptionDocs.forEach((doc) => {
      if (!doc.employee_id) return;
      const current = map.get(doc.employee_id);
      if (!current || new Date(doc.created_at || 0).getTime() > new Date(current.created_at || 0).getTime()) {
        map.set(doc.employee_id, doc);
      }
    });
    return map;
  }, [jobDescriptionDocs]);
  const filteredJobDescriptionEmployees = useMemo(() => {
    const normalized = jobDescriptionSearch.trim().toLowerCase();
    if (!normalized) return assignableEmployees;
    return assignableEmployees.filter((employee) => {
      const doc = latestJobDescriptionByEmployeeId.get(employee.id);
      return [
        `${employee.first_name} ${employee.last_name}`,
        employee.job_title,
        departmentNameById.get(employee.department_id || 0),
        doc?.file_name,
      ].some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [assignableEmployees, departmentNameById, jobDescriptionSearch, latestJobDescriptionByEmployeeId]);
  const paginatedJobDescriptionEmployees = useMemo(() => {
    const start = (jobDescriptionPage - 1) * jobDescriptionPageSize;
    return filteredJobDescriptionEmployees.slice(start, start + jobDescriptionPageSize);
  }, [filteredJobDescriptionEmployees, jobDescriptionPage]);
  const paginatedContractRows = useMemo(() => {
    const start = (contractPage - 1) * contractPageSize;
    return filteredContractRows.slice(start, start + contractPageSize);
  }, [contractPage, filteredContractRows]);

  useEffect(() => {
    setContractPage(1);
  }, [contractSearch, filterPeriod]);

  useEffect(() => {
    setJobDescriptionPage(1);
  }, [jobDescriptionSearch]);

  const handleJobDescriptionUpload = async (employee: Employee, file?: File | null) => {
    if (!file) return;
    const currentDoc = latestJobDescriptionByEmployeeId.get(employee.id);
    setJobDescriptionUploadingId(employee.id);
    try {
      await uploadJobDescription(employee, file);
      if (currentDoc) {
        await deleteEmployeeDocument(currentDoc.id);
      }
      setJobDescriptionDocs(await fetchJobDescriptionDocuments());
      toast.success(currentDoc ? t.okr.jobDescriptionReplaced : t.okr.jobDescriptionUploaded);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.okr.jobDescriptionUploadError);
    } finally {
      setJobDescriptionUploadingId(null);
    }
  };

  const handleJobDescriptionDelete = async (doc: EmployeeDocument) => {
    setConfirmDialog({
      isOpen: true,
      title: t.okr.deleteJobDescriptionTitle,
      message: t.okr.deleteJobDescriptionMessage,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteEmployeeDocument(doc.id);
          setJobDescriptionDocs(await fetchJobDescriptionDocuments());
          toast.success(t.okr.jobDescriptionDeleted);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t.okr.jobDescriptionDeleteError);
        }
      },
    });
  };

  const handleJobDescriptionDownload = async (doc: EmployeeDocument) => {
    try {
      await downloadEmployeeDocument(doc.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.okr.jobDescriptionDownloadError);
    }
  };

  const openObjectiveDraft = (data: Partial<Objective>) => {
    setEditingObjective(null);
    setInitialObjectiveData(data);
    setDrilldown(null);
    setShowObjectiveModal(true);
  };

  const openObjectiveEdit = (objective: Objective) => {
    setInitialObjectiveData(null);
    setEditingObjective(objective);
    setDrilldown(null);
    setShowObjectiveModal(true);
  };

  const getChildLevel = (level: ObjectiveLevel): ObjectiveLevel | null => {
    if (level === 'enterprise') return 'department';
    if (level === 'department') return 'team';
    if (level === 'team') return 'individual';
    return null;
  };

  const openChildObjectiveDraft = (parent: Objective) => {
    const childLevel = getChildLevel(parent.level);
    if (!childLevel) return;

    openObjectiveDraft({
      title: `${t.okr.childObjectivePrefix} ${parent.title}`,
      level: childLevel,
      parent_id: parent.id,
      department_id: parent.department_id || userDepartmentId || undefined,
      period: parent.period || getCurrentPeriod(),
      status: 'draft',
    });
  };

  const handleDeleteObjective = async (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: t.okr.deleteObjectiveTitle,
      message: t.okr.deleteObjectiveMessage,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteObjective(id);
        await loadData();
      },
    });
  };

  const handleSaveKR = async (objectiveId: number, data: Partial<KeyResult>) => {
    if (editingKR) {
      await updateKeyResult(editingKR.id, data);
    } else {
      await createKeyResult(objectiveId, data);
    }
    await loadData();
  };

  const handleDeleteKR = async (krId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: t.okr.deleteKrTitle,
      message: t.okr.deleteKrMessage,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteKeyResult(krId);
        await loadData();
      },
    });
  };

  const enterpriseOKRs = objectives.filter(o => o.level === 'enterprise');
  const departmentOKRs = objectives.filter(o => o.level === 'department');
  const teamOKRs = objectives.filter(o => o.level === 'team');
  const individualOKRs = objectives.filter(o => o.level === 'individual');
  const paginatedEnterpriseOKRs = enterpriseOKRs.slice((cascadePage - 1) * CASCADE_PAGE_SIZE, cascadePage * CASCADE_PAGE_SIZE);
  const cascadeChildrenByParent = useMemo(() => {
    const children = new Map<number, Objective[]>();
    objectives.forEach((objective) => {
      if (!objective.parent_id) return;
      const current = children.get(objective.parent_id) || [];
      current.push(objective);
      children.set(objective.parent_id, current);
    });
    return children;
  }, [objectives]);
  const getCascadeChildren = (parentId: number, level?: ObjectiveLevel) => {
    const children = cascadeChildrenByParent.get(parentId) || [];
    return level ? children.filter((objective) => objective.level === level) : children;
  };
  const isCascadeBranchCollapsed = (key: string) => collapsedCascadeBranches[key] ?? true;
  const toggleCascadeBranch = (key: string) => {
    setCollapsedCascadeBranches((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };
  const getCascadeDescendantCount = (objective: Objective): number => {
    const children = getCascadeChildren(objective.id);
    return children.reduce((count, child) => count + 1 + getCascadeDescendantCount(child), 0);
  };
  const coverageDepartmentOKRs = coverageObjectives.filter(o => o.level === 'department');
  const coverageIndividualOKRs = coverageObjectives.filter(o => o.level === 'individual');
  const scopedDepartments = canSeeAll ? departments : departments.filter(d => d.id === userDepartmentId);
  const scopedEmployees = assignableEmployees;
  const departmentsWithoutObjectiveList = scopedDepartments.filter((dept) =>
    !coverageDepartmentOKRs.some((okr) => okr.department_id === dept.id)
  );
  const peopleWithoutObjectiveList = scopedEmployees.filter((employee) =>
    !coverageIndividualOKRs.some((okr) => okr.owner_id === employee.id)
  );
  const departmentsWithoutObjective = departmentsWithoutObjectiveList.length;
  const peopleWithoutObjective = peopleWithoutObjectiveList.length;
  const departmentCoverageRate = scopedDepartments.length > 0
    ? Math.round(((scopedDepartments.length - departmentsWithoutObjective) / scopedDepartments.length) * 100)
    : 0;
  const peopleCoverageRate = scopedEmployees.length > 0
    ? Math.round(((scopedEmployees.length - peopleWithoutObjective) / scopedEmployees.length) * 100)
    : 0;
  const dashboardStats = useMemo(() => buildStatsFromObjectives(objectives), [objectives]);
  const objectiveIds = useMemo(() => new Set(objectives.map((objective) => objective.id)), [objectives]);
  const objectivesWithChildren = useMemo(() => {
    const ids = new Set<number>();
    objectives.forEach((objective) => {
      if (objective.parent_id && objectiveIds.has(objective.parent_id)) {
        ids.add(objective.parent_id);
      }
    });
    return ids;
  }, [objectives, objectiveIds]);
  const parentObjectiveGaps = objectives.filter(
    (objective) => ['enterprise', 'department', 'team'].includes(objective.level) && !objectivesWithChildren.has(objective.id)
  );
  const alignedObjectives = objectives.filter(
    (objective) => ['department', 'team', 'individual'].includes(objective.level) && objective.parent_id && objectiveIds.has(objective.parent_id)
  );
  const orphanObjectives = objectives.filter(
    (objective) => ['department', 'team', 'individual'].includes(objective.level) && (!objective.parent_id || !objectiveIds.has(objective.parent_id))
  );
  const overdueObjectives = objectives.filter((objective) => {
    if (!objective.end_date || objective.status === 'on_track' || objective.status === 'exceeded') return false;
    const endDate = new Date(objective.end_date);
    endDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate < today;
  });
  const criticalObjectives = objectives.filter(o => o.status === 'at_risk' || o.status === 'behind');
  const objectivesWithoutKeyResults = objectives.filter((objective) => !objective.key_results || objective.key_results.length === 0);

  const getObjectiveDrilldownItems = (type: DrilldownType): Objective[] => {
    const statusTypes = new Set<DrilldownType>(['on_track', 'at_risk', 'behind', 'exceeded']);
    if (type === 'total') return objectives;
    if (statusTypes.has(type)) return objectives.filter((objective) => objective.status === type);
    if (type === 'cascade_gap') return parentObjectiveGaps;
    if (type === 'alignment') return alignedObjectives;
    if (type === 'orphans') return orphanObjectives;
    if (type === 'overdue') return overdueObjectives;
    return [];
  };

  const getDrilldownTitle = (type: DrilldownType): string => {
    const titles: Record<DrilldownType, string> = {
      total: t.okr.totalOkrs,
      on_track: t.okr.onTrack,
      at_risk: t.okr.atRisk,
      behind: t.okr.behind,
      exceeded: t.okr.exceededPlural,
      cascade_gap: t.okr.parentsWithoutChildren,
      alignment: t.okr.alignedOkrs,
      orphans: t.okr.orphanOkrs,
      overdue: t.okr.overdue,
      departments_without_objective: t.okr.departmentsWithoutObjective,
      people_without_objective: t.okr.peopleWithoutObjective,
    };
    return titles[type];
  };

  const formatDate = (value?: string) => {
    if (!value) return null;
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  const getOverdueDays = (value?: string) => {
    if (!value) return 0;
    const endDate = new Date(value);
    endDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - endDate.getTime()) / 86400000));
  };

  // Stats pour le dashboard
  const statusDistribution = [
    { name: t.okr.onTrack, value: dashboardStats.by_status['on_track'] || 0, color: '#10B981' },
    { name: t.okr.atRisk, value: dashboardStats.by_status['at_risk'] || 0, color: '#F59E0B' },
    { name: t.okr.behind, value: dashboardStats.by_status['behind'] || 0, color: '#EF4444' },
    { name: t.okr.exceeded, value: dashboardStats.by_status['exceeded'] || 0, color: '#6366F1' },
  ].filter(d => d.value > 0);

  const departmentProgress = Object.entries(dashboardStats.by_department).map(([name, data]) => ({
    name: name.length > 10 ? name.substring(0, 10) + '...' : name,
    progress: data.avg_progress,
  }));

  const renderCascadeObjective = (objective: Objective, depth = 0) => {
    const children = getCascadeChildren(objective.id);
    const branchKey = `cascade-${objective.id}`;
    const collapsed = isCascadeBranchCollapsed(branchKey);
    const hasChildren = children.length > 0;
    const descendantCount = getCascadeDescendantCount(objective);
    const config = {
      enterprise: { icon: Building2, bg: 'bg-purple-600', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', line: 'border-purple-300' },
      department: { icon: Users, bg: 'bg-primary-600', light: 'bg-primary-50', border: 'border-primary-200', text: 'text-primary-700', line: 'border-primary-300' },
      team: { icon: UserRoundCog, bg: 'bg-amber-600', light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', line: 'border-amber-300' },
      individual: { icon: User, bg: 'bg-teal-600', light: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', line: 'border-teal-300' },
    }[objective.level];
    const Icon = config.icon;

    return (
      <div key={objective.id} className={depth === 0 ? 'border border-gray-200 rounded-xl overflow-hidden' : ''}>
        <div className={`${config.light} ${depth === 0 ? 'p-4 border-b border-gray-100' : `rounded-lg p-3 border ${config.border}`}`}>
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCascadeBranch(branchKey)}
                className={`w-8 h-8 ${config.bg} rounded-lg flex flex-shrink-0 items-center justify-center hover:opacity-90`}
                aria-label={collapsed ? t.okr.expandBranch : t.okr.collapseBranch}
              >
                {collapsed ? <ChevronRight className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
              </button>
            ) : (
              <div className={`w-8 h-8 ${config.bg} rounded-lg flex flex-shrink-0 items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-medium uppercase ${config.text}`}>{getLevelLabel(objective.level, t)}</span>
                {objective.department_name && <span className="text-xs text-gray-500">• {objective.department_name}</span>}
                <span className="px-2 py-0.5 rounded-full bg-white/80 text-xs font-medium text-gray-600">
                  {t.okr.weight}: {objective.weight || 0}%
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(objective.status)}`}>
                  {getStatusLabel(objective.status, t)}
                </span>
                {hasChildren && (
                  <span className="px-2 py-0.5 rounded-full bg-white/80 text-xs font-medium text-gray-600">
                    {descendantCount} {t.okr.linkedObjectivesShort}
                  </span>
                )}
              </div>
              <h3 className={`${depth === 0 ? 'font-semibold' : 'text-sm font-medium'} text-gray-900 truncate`}>{getObjectiveDisplayTitle(objective)}</h3>
              {objective.owner_name && <p className="text-xs text-gray-500 mt-1">{t.okr.responsible}: {objective.owner_name}</p>}
            </div>
            <div className="flex-shrink-0 text-right">
              <span className={`${depth === 0 ? 'text-2xl' : 'text-lg'} font-bold ${config.text}`}>{Math.round(objective.progress)}%</span>
              <div className={`${depth === 0 ? 'w-28' : 'w-20'} h-1.5 bg-white/80 rounded-full mt-1`}>
                <div className={`h-full ${config.bg} rounded-full`} style={{ width: `${Math.min(objective.progress, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {hasChildren && !collapsed && (
          <div className={`${depth === 0 ? 'bg-white p-4' : 'mt-3'} pl-6 border-l-2 ${config.line} ml-4 space-y-3`}>
            {children.map((child) => renderCascadeObjective(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Page Tour Hook
  const { showTips, dismissTips, resetTips } = usePageTour('okr');

  if (loading) return <PageLoading />;

  return (
    <>
      {showTips && (
        <PageTourTips
          pageId="okr"
          onDismiss={dismissTips}
          pageTitle={headerByTab.title}
        />
      )}
      <Header
        title={headerByTab.title}
        subtitle={headerByTab.subtitle}
      />

      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {activeTab === 'contracts' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">{t.okr.contractEmployees}</p>
              <p className="text-2xl font-bold">{contractStats.totalEmployees}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">{t.okr.contractsCreated}</p>
              <p className="text-2xl font-bold text-primary-700">{contractStats.created}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">{t.okr.contractsSigned}</p>
              <p className="text-2xl font-bold text-green-600">{contractStats.signed}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">{t.okr.contractsNotSigned}</p>
              <p className="text-2xl font-bold text-amber-600">{contractStats.notSigned}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">{t.okr.contractsReadyToSign}</p>
              <p className="text-2xl font-bold text-blue-700">{contractStats.readyToSign}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">{t.okr.contractsMissing}</p>
              <p className="text-2xl font-bold text-red-600">{contractStats.missing}</p>
            </div>
          </div>
        ) : (activeTab === 'list' || activeTab === 'cascade') ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            <button onClick={() => setDrilldown('total')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.totalOkrs}</p>
              <p className="text-2xl font-bold">{dashboardStats.total}</p>
            </button>
            <div data-tour="okr-progress" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500">{t.okr.avgProgress}</p>
              <p className="text-2xl font-bold">{dashboardStats.avg_progress}%</p>
            </div>
            <button onClick={() => setDrilldown('on_track')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.onTrack}</p>
              <p className="text-2xl font-bold text-green-600">{dashboardStats.by_status['on_track'] || 0}</p>
            </button>
            <button onClick={() => setDrilldown('at_risk')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.atRisk}</p>
              <p className="text-2xl font-bold text-yellow-600">{dashboardStats.by_status['at_risk'] || 0}</p>
            </button>
            <button onClick={() => setDrilldown('behind')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.behind}</p>
              <p className="text-2xl font-bold text-red-600">{dashboardStats.by_status['behind'] || 0}</p>
            </button>
            <button onClick={() => setDrilldown('exceeded')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.exceededPlural}</p>
              <p className="text-2xl font-bold text-indigo-600">{dashboardStats.by_status['exceeded'] || 0}</p>
            </button>
            <button onClick={() => setDrilldown('cascade_gap')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.cascadeRate}</p>
              <p className="text-2xl font-bold text-primary-700">{dashboardStats.cascade.cascade_rate}%</p>
              <p className="text-[11px] text-gray-400">{dashboardStats.cascade.parents_with_children}/{dashboardStats.cascade.parent_objectives}</p>
            </button>
            <button onClick={() => setDrilldown('alignment')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.alignmentRate}</p>
              <p className="text-2xl font-bold text-blue-700">{dashboardStats.cascade.alignment_rate}%</p>
              <p className="text-[11px] text-gray-400">{dashboardStats.cascade.aligned_objectives} {t.okr.alignedShort}</p>
            </button>
            <button onClick={() => setDrilldown('orphans')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.orphanOkrs}</p>
              <p className={`text-2xl font-bold ${dashboardStats.cascade.orphan_objectives > 0 ? 'text-amber-600' : 'text-green-600'}`}>{dashboardStats.cascade.orphan_objectives}</p>
            </button>
            <button onClick={() => setDrilldown('overdue')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.overdue}</p>
              <p className={`text-2xl font-bold ${dashboardStats.overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>{dashboardStats.overdue}</p>
            </button>
            <button onClick={() => setDrilldown('departments_without_objective')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.departmentsWithoutObjective}</p>
              <p className={`text-2xl font-bold ${departmentsWithoutObjective > 0 ? 'text-amber-600' : 'text-green-600'}`}>{departmentsWithoutObjective}</p>
              <p className="text-[11px] text-gray-400">{scopedDepartments.length} {t.okr.departmentsShort}</p>
            </button>
            <button onClick={() => setDrilldown('people_without_objective')} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary-200 hover:shadow-md transition">
              <p className="text-xs text-gray-500">{t.okr.peopleWithoutObjective}</p>
              <p className={`text-2xl font-bold ${peopleWithoutObjective > 0 ? 'text-amber-600' : 'text-green-600'}`}>{peopleWithoutObjective}</p>
              <p className="text-[11px] text-gray-400">{scopedEmployees.length} {t.okr.peopleShort}</p>
            </button>
          </div>
        ) : null}

        {(activeTab === 'list' || activeTab === 'cascade') && (
          <div className="flex justify-between items-center gap-4 mb-6">
            <div className="flex gap-3">
              <CustomSelect value={filterPeriod} onChange={setFilterPeriod}
                options={[
                  { value: 'all', label: t.okr.allPeriods },
                  { value: '2026', label: '2026' }, { value: 'Q1 2026', label: 'Q1 2026' },
                  { value: 'Q2 2026', label: 'Q2 2026' }, { value: 'Q3 2026', label: 'Q3 2026' },
                  { value: 'Q4 2026', label: 'Q4 2026' }, { value: '2025', label: '2025' },
                  { value: 'Q1 2025', label: 'Q1 2025' }, { value: 'Q2 2025', label: 'Q2 2025' },
                  { value: 'Q3 2025', label: 'Q3 2025' }, { value: 'Q4 2025', label: 'Q4 2025' },
                ]} className="w-36" />
              <CustomSelect value={filterLevel} onChange={setFilterLevel}
                options={[
                  { value: 'all', label: t.okr.allLevels },
                  { value: 'enterprise', label: t.okr.enterprise },
                  { value: 'department', label: t.okr.department },
                  { value: 'team', label: t.okr.team },
                  { value: 'individual', label: t.okr.individual },
                ]} className="w-36" />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => exportOKRsToCSV(objectives)}
                className="flex items-center px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4 mr-2" />{t.okr.export}
              </button>
              {canEdit && (
                <button 
                  data-tour="create-okr"
                  onClick={() => { setEditingObjective(null); setInitialObjectiveData(null); setShowObjectiveModal(true); }}
                  className="flex items-center px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
                >
                  <Plus className="w-4 h-4 mr-2" />{t.okr.newOkr}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: List */}
        {activeTab === 'list' && (
          <div className="space-y-6">
            {[
              { level: 'enterprise', title: t.okr.enterpriseOkrs, data: enterpriseOKRs, icon: Building2, color: 'purple', bgColor: 'bg-purple-600', bgLight: 'bg-purple-100', textColor: 'text-purple-700' },
              { level: 'department', title: t.okr.departmentOkrs, data: departmentOKRs, icon: Users, color: 'primary', bgColor: 'bg-primary-600', bgLight: 'bg-primary-100', textColor: 'text-primary-700' },
              { level: 'team', title: t.okr.teamOkrs, data: teamOKRs, icon: UserRoundCog, color: 'amber', bgColor: 'bg-amber-600', bgLight: 'bg-amber-100', textColor: 'text-amber-700' },
              { level: 'individual', title: t.okr.individualOkrs, data: individualOKRs, icon: User, color: 'teal', bgColor: 'bg-teal-600', bgLight: 'bg-teal-100', textColor: 'text-teal-700' },
            ].map(section => section.data.length > 0 && (
              <div key={section.title}>
                {/* Section Header avec flèche de repli */}
                <button 
                  onClick={() => toggleSection(section.level)}
                  className="w-full flex items-center gap-3 mb-4 group"
                >
                  <div className={`w-8 h-8 ${section.bgColor} rounded-lg flex items-center justify-center transition-transform ${collapsedSections[section.level] ? '' : ''}`}>
                    {collapsedSections[section.level] 
                      ? <ChevronRight className="w-5 h-5 text-white" />
                      : <ChevronDown className="w-5 h-5 text-white" />
                    }
                  </div>
                  <section.icon className={`w-5 h-5 ${section.textColor}`} />
                  <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                  <span className={`px-2.5 py-1 ${section.bgLight} ${section.textColor} text-xs font-medium rounded-full`}>
                    {section.data.length}
                  </span>
                  <span className="text-xs text-gray-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {collapsedSections[section.level] ? t.okr.clickToExpand : t.okr.clickToCollapse}
                  </span>
                </button>
                
                {/* Section Content */}
                {!collapsedSections[section.level] && (
                  <>
                  <div className="space-y-3">
                    {section.data.slice((okrPages[section.level] - 1) * OKR_PAGE_SIZE, okrPages[section.level] * OKR_PAGE_SIZE).map((obj) => (
                      <div key={obj.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(obj.id)}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start flex-1">
                              {/* Flèche de repli OKR individuel - PLUS VISIBLE */}
                              <button className={`mt-0.5 mr-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${expandedObjectiveId === obj.id ? `${section.bgLight} ${section.textColor}` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                {expandedObjectiveId === obj.id 
                                  ? <ChevronDown className="w-5 h-5" /> 
                                  : <ChevronRight className="w-5 h-5" />
                                }
                              </button>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(obj.level)}`}>
                                    {getLevelIcon(obj.level)}{getLevelLabel(obj.level, t)}
                                  </span>
                                  <span className="text-xs text-gray-500">{t.okr.weight}: {obj.weight || 0}%</span>
                                  {obj.department_name && <span className="text-xs text-gray-500">• {obj.department_name}</span>}
                                </div>
                                <h3 className="text-base font-semibold text-gray-900">{getObjectiveDisplayTitle(obj)}</h3>
                                {obj.parent_key_result_title && (
                                  <p className="mt-1 text-xs text-primary-700 bg-primary-50 inline-flex px-2 py-0.5 rounded-full">
                                    {t.okr.parentKeyResultShort}: {obj.parent_key_result_title}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2">
                                  {obj.owner_name && (
                                    <div className="flex items-center">
                                      <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-xs font-medium text-primary-700">
                                        {obj.owner_initials}
                                      </div>
                                      <span className="ml-2 text-sm text-gray-600">{obj.owner_name}</span>
                                    </div>
                                  )}
                                  <span className="text-sm text-gray-500">{obj.period}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(obj.status)}`}>
                                    {getStatusLabel(obj.status, t)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right">
                                <span className="text-base font-bold text-gray-900">{Math.round(obj.progress)}%</span>
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1">
                                  <div className={`h-full rounded-full ${getProgressColor(obj.progress)}`} style={{ width: `${Math.min(obj.progress, 100)}%` }} />
                                </div>
                              </div>
                              {canEditObjective(obj) && (
                                <div className="flex flex-col">
                                  <button
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingObjective(obj);
                                      setShowObjectiveModal(true);
                                    }}
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteObjective(obj.id);
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {expandedObjectiveId === obj.id && (
                          <div className="border-t border-gray-100 bg-gray-50 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-gray-700">{t.okr.keyResultsCount} ({obj.key_results.length})</h4>
                              {canEditObjective(obj) && (
                                <button 
                                  onClick={() => { setKrObjectiveId(obj.id); setEditingKR(null); setShowKRModal(true); }}
                                  className="flex items-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                                >
                                  <Plus className="w-4 h-4 mr-1" />{t.okr.addKr}
                                </button>
                              )}
                            </div>
                            
                            {obj.key_results.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-4">{t.okr.noKeyResult}</p>
                            ) : (
                              <div className="space-y-3">
                                {obj.key_results.map((kr) => (
                                  <div key={kr.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <div>
                                        <span className="text-sm font-medium text-gray-900">{kr.title}</span>
                                        {kr.kpi_name && (
                                          <p className="text-xs text-gray-500 mt-0.5">{t.okr.kpiName}: {kr.kpi_name}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">{t.okr.weight}: {kr.weight}%</span>
                                        <span className="text-sm font-medium text-gray-700">{kr.current} / {kr.target} {kr.unit}</span>
                                        {canEditObjective(obj) && (
                                          <>
                                            <button 
                                              onClick={() => { setKrObjectiveId(obj.id); setEditingKR(kr); setShowKRModal(true); }}
                                              className="p-1 text-gray-400 hover:text-gray-600"
                                            >
                                              <Edit className="w-3 h-3" />
                                            </button>
                                            <button 
                                              onClick={() => handleDeleteKR(kr.id)}
                                              className="p-1 text-gray-400 hover:text-red-600"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full">
                                      <div className={`h-full rounded-full ${getProgressColor(kr.progress)}`} style={{ width: `${Math.min(kr.progress, 100)}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {obj.initiatives && obj.initiatives.length > 0 && (
                              <>
                                <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-3">{t.okr.initiativesTitle}</h4>
                                <div className="space-y-2">
                                  {obj.initiatives.map((init) => (
                                    <div key={init.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                      <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center">
                                        <Link2 className="w-4 h-4 text-indigo-600" />
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{init.title}</p>
                                        <p className="text-xs text-gray-500">{init.source} • {init.due_date}</p>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(init.status)}`}>
                                        {init.progress}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}

                            <LinkedHRPrograms objectiveId={obj.id} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Pagination
                    page={okrPages[section.level]}
                    total={section.data.length}
                    pageSize={OKR_PAGE_SIZE}
                    onPageChange={(p) => setOkrPages(prev => ({ ...prev, [section.level]: p }))}
                  />
                  </>
                )}
              </div>
            ))}

            {objectives.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t.okr.noObjectiveFound}</p>
                <button 
                  onClick={() => { setEditingObjective(null); setShowObjectiveModal(true); }}
                  className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  {t.okr.createObjective}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Cascade */}
        {activeTab === 'cascade' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t.okr.cascadeView}</h2>
                <p className="text-sm text-gray-500">
                  {enterpriseOKRs.length} {t.okr.enterpriseOkrs.toLowerCase()} · {objectives.length} {t.okr.objectiveCount}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const expanded: Record<string, boolean> = {};
                    objectives.forEach((objective) => { expanded[`cascade-${objective.id}`] = false; });
                    setCollapsedCascadeBranches(expanded);
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t.okr.expandAll}
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsedCascadeBranches({})}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t.okr.collapseAll}
                </button>
              </div>
            </div>
            
            {enterpriseOKRs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t.okr.noEnterpriseOkr}</p>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedEnterpriseOKRs.map((entOKR) => renderCascadeObjective(entOKR))}
                </div>
                <Pagination
                  page={cascadePage}
                  total={enterpriseOKRs.length}
                  pageSize={CASCADE_PAGE_SIZE}
                  onPageChange={setCascadePage}
                />
              </>
            )}
          </div>
        )}

        {/* Tab Content: Objective Contracts */}
        {activeTab === 'contracts' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t.okr.objectiveContracts}</h2>
                <p className="text-sm text-gray-500">{t.okr.objectiveContractsSubtitle}</p>
              </div>
              <span className="text-sm text-gray-500">
                {filteredContractRows.length} / {contractRows.length} {t.okr.employeeFiles}
              </span>
            </div>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={contractSearch}
                  onChange={(e) => setContractSearch(e.target.value)}
                  placeholder="Rechercher un employé, matricule, poste, unité ou manager"
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
                />
              </div>
            </div>

            {filteredContractRows.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">{t.okr.employee}</th>
                      <th className="px-4 py-3 text-left font-medium">{t.okr.departmentLabel}</th>
                      <th className="px-4 py-3 text-left font-medium">{t.okr.responsible}</th>
                      <th className="px-4 py-3 text-left font-medium">{t.okr.statusLabel}</th>
                      <th className="px-4 py-3 text-left font-medium">{t.okr.objectives}</th>
                      <th className="px-4 py-3 text-left font-medium">{t.okr.weight}</th>
                      <th className="px-4 py-3 text-left font-medium">{t.okr.signature}</th>
                      <th className="px-4 py-3 text-right font-medium">{t.okr.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedContractRows.map((row) => (
                      <tr key={row.employee_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{row.employee_name}</div>
                          <div className="text-xs text-gray-500">
                            {row.employee_matricule || t.okr.noMatricule}
                            {row.employee_job_title ? ` · ${row.employee_job_title}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{row.department_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{row.manager_name || '-'}</td>
                        <td className="px-4 py-3">
                          {row.contract ? (
                            <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                              {t.okr.contractStatuses[row.contract.status] || row.contract.status}
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                              {t.okr.noContract}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{Math.max(row.contract?.items_count || 0, row.existing_objectives_count || 0)}</td>
                        <td className="px-4 py-3 text-gray-600">{row.contract?.total_items_weight || 0}%</td>
                        <td className="px-4 py-3">
                          {row.contract?.employee_signed_at ? (
                            <span className="text-green-700 text-xs font-medium">{t.okr.signed}</span>
                          ) : (
                            <span className="text-gray-500 text-xs">{t.okr.notSigned}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {row.contract ? (
                              <button
                                onClick={() => handleOpenContract(row.contract!.id)}
                                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-50"
                              >
                                {t.okr.openFile}
                              </button>
                            ) : canEdit ? (
                              <button
                                onClick={() => handleCreateContract(row.employee_id)}
                                className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs hover:bg-primary-600"
                              >
                                {t.okr.createContract}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                            {canEdit && canResetContract(row.contract) && (
                              <button
                                onClick={() => handleResetContract(row)}
                                className="p-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                                title={t.okr.resetContract}
                                aria-label={t.okr.resetContract}
                              >
                                <RefreshCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
                <Pagination
                  page={contractPage}
                  total={filteredContractRows.length}
                  pageSize={contractPageSize}
                  onPageChange={setContractPage}
                />
              </>
            ) : (
              <p className="text-center text-gray-500 py-8">{t.okr.noData}</p>
            )}
          </div>
        )}

        {/* Tab Content: Job Description */}
        {activeTab === 'jobDescription' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t.okr.jobDescriptionTab}</h2>
                <p className="text-sm text-gray-500">{t.okr.jobDescriptionSubtitle}</p>
              </div>
              <span className="text-sm text-gray-500">
                {jobDescriptionDocs.length} / {assignableEmployees.length} {t.okr.jobDescriptionFiles}
              </span>
            </div>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={jobDescriptionSearch}
                  onChange={(e) => setJobDescriptionSearch(e.target.value)}
                  placeholder={t.okr.searchEmployeeJobDescription}
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">{t.okr.employee}</th>
                    <th className="px-4 py-3 text-left font-medium">{t.okr.departmentLabel}</th>
                    <th className="px-4 py-3 text-left font-medium">{t.okr.statusLabel}</th>
                    <th className="px-4 py-3 text-left font-medium">{t.okr.file}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.okr.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedJobDescriptionEmployees.map((employee) => {
                    const doc = latestJobDescriptionByEmployeeId.get(employee.id);
                    const employeeName = `${employee.first_name} ${employee.last_name}`.trim();
                    const isUploading = jobDescriptionUploadingId === employee.id;
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{employeeName}</div>
                          <div className="text-xs text-gray-500">{employee.job_title || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{departmentNameById.get(employee.department_id || 0) || '-'}</td>
                        <td className="px-4 py-3">
                          {doc ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              {t.okr.jobDescriptionAvailable}
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                              {t.okr.jobDescriptionMissing}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {doc ? (
                            <span className="inline-flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-gray-400" />
                              {doc.file_name || t.okr.jobDescriptionTab}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {doc && (
                              <>
                                <button
                                  onClick={() => handleJobDescriptionDownload(doc)}
                                  className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-50 inline-flex items-center gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  {t.okr.download}
                                </button>
                                <button
                                  onClick={() => handleJobDescriptionDelete(doc)}
                                  className="p-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                                  title={t.okr.delete}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <label className={`px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs hover:bg-primary-600 inline-flex items-center gap-1.5 cursor-pointer ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                              {doc ? t.okr.reupload : t.okr.upload}
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  event.currentTarget.value = '';
                                  handleJobDescriptionUpload(employee, file);
                                }}
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredJobDescriptionEmployees.length === 0 && (
              <p className="text-center text-gray-500 py-8">{t.okr.noData}</p>
            )}
            {filteredJobDescriptionEmployees.length > 0 && (
              <Pagination
                page={jobDescriptionPage}
                total={filteredJobDescriptionEmployees.length}
                pageSize={jobDescriptionPageSize}
                onPageChange={setJobDescriptionPage}
              />
            )}
          </div>
        )}

        {/* Tab Content: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" />
                {t.okr.okrCoverage}
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">{t.okr.unitsCoverage}</span>
                    <span className="font-semibold text-gray-900">{departmentCoverageRate}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${departmentCoverageRate}%` }} />
                  </div>
                  <button
                    onClick={() => setDrilldown('departments_without_objective')}
                    className="mt-2 text-xs text-amber-700 hover:text-amber-800"
                  >
                    {departmentsWithoutObjective} {t.okr.departmentsWithoutObjective.toLowerCase()}
                  </button>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">{t.okr.employeesCoverage}</span>
                    <span className="font-semibold text-gray-900">{peopleCoverageRate}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${peopleCoverageRate}%` }} />
                  </div>
                  <button
                    onClick={() => setDrilldown('people_without_objective')}
                    className="mt-2 text-xs text-amber-700 hover:text-amber-800"
                  >
                    {peopleWithoutObjective} {t.okr.peopleWithoutObjective.toLowerCase()}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                {t.okr.actionAlerts}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDrilldown('behind')} className="rounded-lg bg-red-50 border border-red-100 p-4 text-left hover:border-red-200">
                  <p className="text-xs text-red-700">{t.okr.behind}</p>
                  <p className="text-3xl font-bold text-red-700 mt-1">{dashboardStats.by_status['behind'] || 0}</p>
                </button>
                <button onClick={() => setDrilldown('at_risk')} className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-left hover:border-amber-200">
                  <p className="text-xs text-amber-700">{t.okr.atRisk}</p>
                  <p className="text-3xl font-bold text-amber-700 mt-1">{dashboardStats.by_status['at_risk'] || 0}</p>
                </button>
                <button onClick={() => setDrilldown('overdue')} className="rounded-lg bg-rose-50 border border-rose-100 p-4 text-left hover:border-rose-200">
                  <p className="text-xs text-rose-700">{t.okr.overdue}</p>
                  <p className="text-3xl font-bold text-rose-700 mt-1">{dashboardStats.overdue}</p>
                </button>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs text-gray-600">{t.okr.objectivesWithoutKr}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{objectivesWithoutKeyResults.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary-600" />
                {t.okr.cascadeHealth}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-primary-50 border border-primary-100 p-4">
                  <p className="text-xs text-primary-700">{t.okr.cascadeRate}</p>
                  <p className="text-3xl font-bold text-primary-800 mt-1">{dashboardStats.cascade.cascade_rate}%</p>
                  <p className="text-xs text-primary-600 mt-1">{dashboardStats.cascade.parents_with_children}/{dashboardStats.cascade.parent_objectives}</p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
                  <p className="text-xs text-blue-700">{t.okr.alignmentRate}</p>
                  <p className="text-3xl font-bold text-blue-800 mt-1">{dashboardStats.cascade.alignment_rate}%</p>
                  <p className="text-xs text-blue-600 mt-1">{dashboardStats.cascade.aligned_objectives} {t.okr.alignedShort}</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t.okr.orphanOkrs}
                  </p>
                  <p className="text-3xl font-bold text-amber-700 mt-1">{dashboardStats.cascade.orphan_objectives}</p>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-100 p-4">
                  <p className="text-xs text-red-700">{t.okr.overdue}</p>
                  <p className="text-3xl font-bold text-red-700 mt-1">{dashboardStats.overdue}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.okr.statusDistribution}</h3>
              {statusDistribution.length > 0 ? (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {statusDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-gray-600">{item.name} ({item.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-500 py-8">{t.okr.noData}</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.okr.progressByDepartment}</h3>
              {departmentProgress.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentProgress} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" width={80} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="progress" fill="#6366F1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">{t.okr.noData}</p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.okr.criticalOkrs}</h3>
              {criticalObjectives.length > 0 ? (
                <div className="space-y-3">
                  {criticalObjectives.slice(0, 5).map((okr) => (
                    <div key={okr.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${okr.status === 'behind' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{getObjectiveDisplayTitle(okr)}</p>
                        <p className="text-xs text-gray-500">{okr.owner_name || t.okr.notAssigned} • {okr.department_name || t.okr.enterprise}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(okr.status)}`}>
                        {Math.round(okr.progress)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">{t.okr.noCriticalOkr}</p>
              )}
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">{t.okr.summaryByLevel}</h3>
              <div className="space-y-4">
                {[
                  { level: 'enterprise', label: t.okr.enterprise, icon: Building2, iconBg: 'bg-purple-100', iconText: 'text-purple-600', bar: 'bg-purple-500' },
                  { level: 'department', label: t.okr.department, icon: Users, iconBg: 'bg-blue-100', iconText: 'text-blue-600', bar: 'bg-blue-500' },
                  { level: 'team', label: t.okr.team, icon: UserRoundCog, iconBg: 'bg-amber-100', iconText: 'text-amber-600', bar: 'bg-amber-500' },
                  { level: 'individual', label: t.okr.individual, icon: User, iconBg: 'bg-teal-100', iconText: 'text-teal-600', bar: 'bg-teal-500' },
                ].map(({ level, label, icon: Icon, iconBg, iconText, bar }) => {
                  const count = dashboardStats.by_level[level] || 0;
                  const levelObjs = objectives.filter(o => o.level === level);
                  const avgProg = levelObjs.length > 0 ? Math.round(levelObjs.reduce((sum, o) => sum + o.progress, 0) / levelObjs.length) : 0;
                  return (
                    <div key={level} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${iconText}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{count} {t.okr.objectiveCount}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-900">{avgProg}%</span>
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                          <div className={`h-full ${bar} rounded-full`} style={{ width: `${avgProg}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {contractDrawerOpen && (
        <div className="fixed inset-0 bg-gray-950/45 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-gray-50 w-full max-w-6xl h-full shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-gray-950">{t.okr.contractFile}</h2>
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  {selectedContract?.employee_name || t.okr.loading}
                  {selectedContract?.period ? ` · ${selectedContract.period}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedContract && canEdit && getNextContractStatus(selectedContract.status) && (
                  <button
                    onClick={handleMoveContractNextStep}
                    disabled={contractUpdating}
                    className="flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 shadow-sm"
                  >
                    {contractUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {getNextContractActionLabel(selectedContract.status)}
                  </button>
                )}
                <button
                  onClick={() => { setContractDrawerOpen(false); setSelectedContract(null); }}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {contractLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {t.okr.loading}
              </div>
            ) : selectedContract ? (
              <div className="p-5 sm:p-6 lg:p-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="w-14 h-14 bg-primary-50 border border-primary-100 rounded-2xl flex items-center justify-center shrink-0">
                        <FileSignature className="w-7 h-7 text-primary-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold text-gray-950">{selectedContract.employee_name}</h3>
                          <span className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                            {t.okr.contractStatuses[selectedContract.status]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          {selectedContract.employee_matricule || t.okr.noMatricule}
                          {selectedContract.employee_job_title ? ` · ${selectedContract.employee_job_title}` : ''}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full">
                            <BriefcaseBusiness className="w-3.5 h-3.5" />
                            {selectedContract.department_name || '-'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full">
                            <UserRoundCog className="w-3.5 h-3.5" />
                            {selectedContract.manager_name || t.okr.notAssigned}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] uppercase text-gray-400 font-medium">{t.okr.period}</p>
                        <p className="text-sm font-semibold text-gray-950 mt-1">{selectedContract.period}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] uppercase text-gray-400 font-medium">{t.okr.statusLabel}</p>
                        <p className="text-sm font-semibold text-gray-950 mt-1">{t.okr.contractStatuses[selectedContract.status]}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] uppercase text-gray-400 font-medium">{t.okr.midReviewDate}</p>
                        <p className="text-sm font-semibold text-gray-950 mt-1">{formatDate(selectedContract.mid_review_date) || '-'}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] uppercase text-gray-400 font-medium">{t.okr.signature}</p>
                        <p className="text-sm font-semibold text-gray-950 mt-1">{selectedContract.employee_signed_at ? t.okr.signed : t.okr.notSigned}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-950">{t.okr.contractScore}</h3>
                      <Target className="w-5 h-5 text-primary-600" />
                    </div>
                    <p className="text-xs leading-5 text-gray-500 mb-4">{t.okr.contractScoreHelp}</p>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{t.okr.objectives}</span>
                          {canEdit ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={selectedContract.objectives_weight}
                              onChange={(e) => {
                                const value = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                setSelectedContract({
                                  ...selectedContract,
                                  objectives_weight: value,
                                  attitudes_weight: Math.round((100 - value) * 100) / 100,
                                });
                              }}
                              className="w-20 px-2 py-1 border rounded-lg text-sm font-medium text-right"
                            />
                          ) : (
                            <span className="font-medium">{selectedContract.objectives_weight}%</span>
                          )}
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(selectedContract.objectives_weight, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{t.okr.attitudes}</span>
                          {canEdit ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={selectedContract.attitudes_weight}
                              onChange={(e) => {
                                const value = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                setSelectedContract({
                                  ...selectedContract,
                                  attitudes_weight: value,
                                  objectives_weight: Math.round((100 - value) * 100) / 100,
                                });
                              }}
                              className="w-20 px-2 py-1 border rounded-lg text-sm font-medium text-right"
                            />
                          ) : (
                            <span className="font-medium">{selectedContract.attitudes_weight}%</span>
                          )}
                        </div>
                        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(selectedContract.attitudes_weight, 100)}%` }} />
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          onClick={handleSaveContractWeights}
                          disabled={contractUpdating}
                          className="w-full px-3 py-2 border border-primary-200 text-primary-700 text-sm font-medium rounded-lg hover:bg-primary-50 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {contractUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {t.okr.saveWeighting}
                        </button>
                      )}
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">{t.okr.finalScore}</p>
                        <p className="text-2xl font-bold text-gray-900">{selectedContract.final_score ?? '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-950">{t.okr.contractObjectives}</h3>
                      <p className="text-sm text-gray-500">{t.okr.contractObjectivesSubtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${(selectedContract.total_items_weight || 0) === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {selectedContract.total_items_weight || 0}%
                      </span>
                      {canEdit && (
                        <button
                          onClick={openContractObjectiveModal}
                          className="flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-sm"
                        >
                          <Plus className="w-4 h-4 mr-1" />{t.okr.addContractObjective}
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedContract.items && selectedContract.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
                          <tr>
                            <th className="px-5 py-3 text-left font-medium">{t.okr.objectives}</th>
                            <th className="px-4 py-3 text-left font-medium">{t.okr.weight}</th>
                            <th className="px-4 py-3 text-left font-medium">{t.okr.endDate}</th>
                            <th className="px-4 py-3 text-left font-medium">{t.okr.keyResults}</th>
                            <th className="px-4 py-3 text-left font-medium">{t.okr.score}</th>
                            {canEdit && <th className="px-4 py-3 text-right font-medium">{t.okr.actions}</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedContract.items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50/70">
                              <td className="px-5 py-4">
                                <div className="font-semibold text-gray-950">
                                  {item.title}{item.description ? ` : ${item.description}` : ''}
                                </div>
                                {item.parent_key_result_title && (
                                  <p className="mt-1 text-xs text-primary-700">
                                    {t.okr.parentKeyResultShort}: {item.parent_key_result_title}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-4 text-gray-700 font-medium">{item.weight}%</td>
                              <td className="px-4 py-3 text-gray-600">{formatDate(item.due_date) || '-'}</td>
                              <td className="px-4 py-3 text-gray-600 min-w-[320px]">
                                {item.key_results?.length ? (
                                  <div className="space-y-2">
                                    {item.key_results.map((kr) => (
                                      <div key={kr.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                                        <p className="font-medium text-gray-900">{kr.title}</p>
                                        <p className="text-xs text-gray-500">
                                          Min. {kr.minimum_target || item.minimum_target || '-'} · Std. {kr.standard_target || item.standard_target || `${kr.target}${kr.unit ? ` ${kr.unit}` : ''}`} · Exc. {kr.excellence_target || item.excellence_target || '-'}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{item.score ?? '-'}</td>
                              {canEdit && (
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => openEditContractObjectiveModal(item)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                                  >
                                    <Edit className="w-4 h-4" />
                                    {t.okr.edit}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-14 px-6">
                      <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                        <ClipboardList className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="font-medium text-gray-700">{t.okr.noContractObjective}</p>
                      <p className="text-sm text-gray-400 mt-1">{t.okr.noContractObjectiveHint}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-950">{t.okr.attitudes}</h3>
                        <p className="text-sm text-gray-500">{t.okr.contractAttitudesSubtitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">{selectedContract.attitudes_weight}%</span>
                        {canEdit && (
                          <button
                            onClick={openContractAttitudesModal}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-amber-200 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50"
                          >
                            <Edit className="w-4 h-4" />
                            {t.okr.configureAttitudes}
                          </button>
                        )}
                      </div>
                    </div>
                    {selectedContract.attitudes && selectedContract.attitudes.length > 0 ? (
                      <div className="space-y-2">
                        {selectedContract.attitudes.map((attitude) => (
                          <div key={attitude.attitude_id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{attitude.name_snapshot}</p>
                                {attitude.expected_behavior && (
                                  <p className="text-xs leading-5 text-gray-500 mt-1">{attitude.expected_behavior}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-semibold text-amber-700">{attitude.weight}%</p>
                                {attitude.threshold !== undefined && attitude.threshold !== null && (
                                  <p className="text-[11px] text-gray-400">{t.okr.threshold} {attitude.threshold}%</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                        <p className="text-sm font-medium text-gray-700">{t.okr.noContractAttitude}</p>
                        <p className="text-xs text-gray-400 mt-1">{t.okr.noContractAttitudeHint}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <h3 className="font-semibold text-gray-950">{t.okr.contractDocuments}</h3>
                      <button
                        onClick={handleDownloadContractPdf}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        {t.okr.downloadContractPdf}
                      </button>
                    </div>
                    <p className="text-sm leading-6 text-gray-500">{t.okr.contractDocumentsHint}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-20">{t.okr.noData}</p>
            )}
          </div>
        </div>
      )}

      {showContractAttitudesModal && selectedContract && (
        <div className="fixed inset-0 bg-gray-950/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="text-xl font-semibold text-gray-950">{t.okr.configureAttitudes}</h2>
                <p className="text-sm text-gray-500">{selectedContract.employee_name} · {selectedContract.period}</p>
              </div>
              <button onClick={() => setShowContractAttitudesModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-950">{t.okr.contractAttitudesSubtitle}</p>
                    <p className="text-sm text-gray-500 mt-1">{t.okr.contractAttitudesHelp}</p>
                  </div>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    Math.round(contractAttitudeDrafts.reduce((sum, item) => sum + Number(item.weight || 0), 0) * 100) / 100 === 100
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {Math.round(contractAttitudeDrafts.reduce((sum, item) => sum + Number(item.weight || 0), 0) * 100) / 100}%
                  </span>
                </div>
              </div>

              {availableAttitudes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                  <p className="text-sm font-medium text-gray-700">{t.okr.noAvailableAttitude}</p>
                  <p className="text-xs text-gray-400 mt-1">{t.okr.noAvailableAttitudeHint}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-gray-950 mb-3">{t.okr.availableAttitudes}</h3>
                    <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                      {availableAttitudes.map((attitude) => {
                        const selected = contractAttitudeDrafts.some((item) => item.attitude_id === attitude.id);
                        return (
                          <button
                            key={attitude.id}
                            type="button"
                            onClick={() => toggleContractAttitude(attitude)}
                            className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                              selected ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{attitude.name}</p>
                                <p className="text-xs text-gray-400 truncate">{attitude.category}</p>
                              </div>
                              <span className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold ${
                                selected ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300 text-transparent'
                              }`}>
                                ✓
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-950">{t.okr.selectedAttitudes}</h3>
                      <span className="text-xs text-gray-400">{contractAttitudeDrafts.length} {t.okr.attitudesSelectedShort}</span>
                    </div>
                    {contractAttitudeDrafts.length > 0 ? (
                      <div className="divide-y divide-gray-100 max-h-[52vh] overflow-y-auto">
                        {contractAttitudeDrafts.map((draft, index) => {
                          const attitude = availableAttitudes.find((item) => item.id === draft.attitude_id);
                          return (
                            <div key={draft.attitude_id} className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-gray-950">{attitude?.name || t.okr.attitudes}</p>
                                  <p className="text-xs text-gray-400">{attitude?.category || '-'}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeContractAttitudeDraft(draft.attitude_id)}
                                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{t.okr.expectedBehavior}</label>
                                <textarea
                                  rows={2}
                                  value={draft.expected_behavior || ''}
                                  onChange={(e) => updateContractAttitudeDraft(draft.attitude_id, { expected_behavior: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.okr.weight}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={draft.weight}
                                    onChange={(e) => updateContractAttitudeDraft(draft.attitude_id, { weight: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.okr.threshold}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={draft.threshold ?? ''}
                                    onChange={(e) => updateContractAttitudeDraft(draft.attitude_id, { threshold: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">{t.okr.evaluationMode}</label>
                                  <input
                                    value={draft.evaluation_mode || ''}
                                    onChange={(e) => updateContractAttitudeDraft(draft.attitude_id, { evaluation_mode: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-4 py-12 text-center">
                        <p className="text-sm font-medium text-gray-700">{t.okr.noContractAttitude}</p>
                        <p className="text-xs text-gray-400 mt-1">{t.okr.selectAttitudesToStart}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowContractAttitudesModal(false)} className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
                {t.okr.cancel}
              </button>
              <button
                onClick={handleSaveContractAttitudes}
                disabled={contractAttitudesSaving}
                className="px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2 font-medium shadow-sm"
              >
                {contractAttitudesSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t.okr.saveAttitudes}
              </button>
            </div>
          </div>
        </div>
      )}

      {showContractObjectiveModal && selectedContract && (
        <div className="fixed inset-0 bg-gray-950/55 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-gray-950">
                    {editingContractItem ? t.okr.editObjective : t.okr.addContractObjective}
                  </h2>
                  <p className="text-sm text-gray-500 truncate">{selectedContract.employee_name} · {selectedContract.period}</p>
                </div>
              </div>
              <button onClick={() => { setShowContractObjectiveModal(false); setEditingContractItem(null); }} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center">
                    <FileSignature className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-gray-950">{t.okr.contractObjectives}</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.titleLabel} *</label>
                  <input
                    value={contractObjectiveDraft.title}
                    onChange={(e) => setContractObjectiveDraft({ ...contractObjectiveDraft, title: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.description}</label>
                  <textarea
                    value={contractObjectiveDraft.description}
                    onChange={(e) => setContractObjectiveDraft({ ...contractObjectiveDraft, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {!editingContractItem && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.level} *</label>
                    <CustomSelect
                      value={contractObjectiveDraft.objective_level}
                      onChange={(val) => setContractObjectiveDraft({ ...contractObjectiveDraft, objective_level: val as Extract<ObjectiveLevel, 'department' | 'team' | 'individual'>, parent_id: undefined, parent_key_result_id: undefined })}
                      options={[
                        { value: 'department', label: t.okr.department },
                        { value: 'team', label: t.okr.team },
                        { value: 'individual', label: t.okr.individual },
                      ]}
                      className="w-full"
                    />
                  </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.weight} *</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={contractObjectiveDraft.weight}
                      onChange={(e) => setContractObjectiveDraft({ ...contractObjectiveDraft, weight: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t.okr.weightHelp}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.endDate}</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={contractObjectiveDraft.due_date}
                        onChange={(e) => setContractObjectiveDraft({ ...contractObjectiveDraft, due_date: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                  {!editingContractItem && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.parentObjective}</label>
                    <CustomSelect
                      value={String(contractObjectiveDraft.parent_id || '')}
                      onChange={(val) => setContractObjectiveDraft({ ...contractObjectiveDraft, parent_id: val ? parseInt(val) : undefined, parent_key_result_id: undefined })}
                      options={[
                        { value: '', label: t.okr.none },
                        ...contractParentCandidates.map((o) => ({ value: String(o.id), label: `[${getLevelLabel(o.level, t)}] ${o.title}` })),
                      ]}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {contractObjectiveDraft.objective_level === 'department'
                        ? 'Sélectionnez l’objectif entreprise parent.'
                        : contractObjectiveDraft.objective_level === 'team'
                          ? 'Sélectionnez l’objectif département parent.'
                          : selectedContract.manager_id ? t.okr.parentFilteredByManager : t.okr.parentFilteredByLevel}
                    </p>
                  </div>
                  )}
                  {contractParentObjective && contractParentObjective.key_results?.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.parentKeyResult}</label>
                    <CustomSelect
                      value={String(contractObjectiveDraft.parent_key_result_id || '')}
                      onChange={(val) => setContractObjectiveDraft({ ...contractObjectiveDraft, parent_key_result_id: val ? parseInt(val) : undefined })}
                      options={[
                        { value: '', label: t.okr.noSpecificParentKr },
                        ...contractParentObjective.key_results.map((kr) => ({ value: String(kr.id), label: kr.title })),
                      ]}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">{t.okr.parentKeyResultHelp}</p>
                  </div>
                  )}
                </div>
              </div>

              <div className="border border-primary-100 rounded-2xl p-5 bg-primary-50/40">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-gray-950">{t.okr.keyResults}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={addContractKeyResultDraft}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-200 text-primary-700 bg-white hover:bg-primary-50 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un KR
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-4">{t.okr.keyResultHelp}</p>
                <div className="space-y-4">
                  {contractObjectiveDraft.key_results.map((kr, index) => (
                    <div key={index} className="rounded-xl border border-primary-100 bg-white p-4">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <p className="text-sm font-semibold text-gray-900">KR #{index + 1}</p>
                        {contractObjectiveDraft.key_results.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeContractKeyResultDraft(index)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 text-xs font-medium"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Supprimer
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.keyResultRequiredLabel}</label>
                          <input
                            value={kr.title}
                            onChange={(e) => updateContractKeyResultDraft(index, { title: e.target.value })}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.kpiName}</label>
                          <input
                            value={kr.kpi_name}
                            onChange={(e) => updateContractKeyResultDraft(index, { kpi_name: e.target.value })}
                            placeholder={t.okr.kpiNamePlaceholder}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                          />
                          <p className="text-xs text-gray-500 mt-1">{t.okr.kpiNameHelp}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.baseline}</label>
                          <input
                            type="number"
                            value={kr.baseline ?? ''}
                            onChange={(e) => updateContractKeyResultDraft(index, { baseline: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                            step="0.01"
                          />
                          <p className="text-xs text-gray-500 mt-1">{t.okr.baselineHelp}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.measurementDirection}</label>
                          <CustomSelect
                            value={kr.measurement_direction}
                            onChange={(val) => updateContractKeyResultDraft(index, { measurement_direction: val as 'increase' | 'decrease' | 'maintain' })}
                            options={[
                              { value: 'increase', label: t.okr.directionIncrease },
                              { value: 'decrease', label: t.okr.directionDecrease },
                              { value: 'maintain', label: t.okr.directionMaintain },
                            ]}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.target}</label>
                          <input
                            type="number"
                            value={kr.target}
                            onChange={(e) => updateContractKeyResultDraft(index, { target: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.unit}</label>
                          <CustomSelect
                            value={kr.is_custom_unit ? '__autre__' : (kr.unit || '')}
                            onChange={(val) => {
                              if (val === '__autre__') { updateContractKeyResultDraft(index, { is_custom_unit: true, unit: '' }); }
                              else { updateContractKeyResultDraft(index, { is_custom_unit: false, unit: val }); }
                            }}
                            options={[
                              { value: '', label: t.okr.chooseUnit },
                              ...UNIT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                            ]}
                            className="w-full"
                          />
                          {kr.is_custom_unit && (
                            <input
                              type="text"
                              value={kr.unit}
                              onChange={(e) => updateContractKeyResultDraft(index, { unit: e.target.value })}
                              className="w-full mt-2 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                              placeholder={t.okr.customUnitPlaceholder}
                              autoFocus
                            />
                          )}
                        </div>
                        <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.minimumTarget}</label>
                            <textarea
                              value={kr.minimum_target}
                              onChange={(e) => updateContractKeyResultDraft(index, { minimum_target: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">{t.okr.minimumTargetHelp}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.standardTarget}</label>
                            <textarea
                              value={kr.standard_target}
                              onChange={(e) => updateContractKeyResultDraft(index, { standard_target: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">{t.okr.standardTargetHelp}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.okr.excellenceTarget}</label>
                            <textarea
                              value={kr.excellence_target}
                              onChange={(e) => updateContractKeyResultDraft(index, { excellence_target: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                            />
                            <p className="text-xs text-gray-500 mt-1">{t.okr.excellenceTargetHelp}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-white border-t border-gray-100 flex justify-end gap-3">
                <button onClick={() => { setShowContractObjectiveModal(false); setEditingContractItem(null); }} className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
                  {t.okr.cancel}
                </button>
                <button
                  onClick={handleSaveContractObjective}
                  disabled={contractObjectiveSaving}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 font-medium shadow-sm"
                >
                  {contractObjectiveSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingContractItem ? 'Enregistrer' : t.okr.create}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {drilldown && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{getDrilldownTitle(drilldown)}</h2>
                <p className="text-sm text-gray-500">
                  {filterPeriod === 'all' ? t.okr.allPeriods : filterPeriod}
                  {' · '}
                  {filterLevel === 'all' ? t.okr.allLevels : getLevelLabel(filterLevel, t)}
                </p>
              </div>
              <button onClick={() => setDrilldown(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {drilldown === 'departments_without_objective' && (
                departmentsWithoutObjectiveList.length > 0 ? (
                  <div className="space-y-3">
                    {departmentsWithoutObjectiveList.map((department) => (
                      <div key={department.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary-700" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{department.name}</p>
                            <p className="text-xs text-gray-500">{t.okr.noDepartmentObjectiveForPeriod}</p>
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => openObjectiveDraft({
                              title: `${t.okr.departmentObjectivePrefix} ${department.name}`,
                              level: 'department',
                              department_id: department.id,
                              period: getCurrentPeriod(),
                              status: 'draft',
                            })}
                            className="flex items-center px-3 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
                          >
                            <Plus className="w-4 h-4 mr-1" />{t.okr.createOkrAction}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">{t.okr.noData}</p>
                )
              )}

              {drilldown === 'people_without_objective' && (
                peopleWithoutObjectiveList.length > 0 ? (
                  <div className="space-y-3">
                    {peopleWithoutObjectiveList.map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-teal-700" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>
                            <p className="text-xs text-gray-500">
                              {employee.department_id ? departmentNameById.get(employee.department_id) || t.okr.departmentLabel : t.okr.departmentLabel}
                              {' · '}
                              {t.okr.noIndividualObjectiveForPeriod}
                            </p>
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => openObjectiveDraft({
                              title: `${t.okr.individualObjectivePrefix} ${employee.first_name} ${employee.last_name}`,
                              level: 'individual',
                              owner_id: employee.id,
                              department_id: employee.department_id || userDepartmentId || undefined,
                              period: getCurrentPeriod(),
                              status: 'draft',
                            })}
                            className="flex items-center px-3 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
                          >
                            <Plus className="w-4 h-4 mr-1" />{t.okr.createOkrAction}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">{t.okr.noData}</p>
                )
              )}

              {!['departments_without_objective', 'people_without_objective'].includes(drilldown) && (
                getObjectiveDrilldownItems(drilldown).length > 0 ? (
                  <div className="space-y-3">
                    {getObjectiveDrilldownItems(drilldown).map((objective) => (
                      <div key={objective.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(objective.level)}`}>
                                {getLevelIcon(objective.level)}{getLevelLabel(objective.level, t)}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(objective.status)}`}>
                                {getStatusLabel(objective.status, t)}
                              </span>
                              <span className="text-xs text-gray-500">{objective.period}</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{getObjectiveDisplayTitle(objective)}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {objective.owner_name || t.okr.notAssigned}
                              {' · '}
                              {objective.department_name || t.okr.enterprise}
                              {objective.end_date && (
                                <>
                                  {' · '}
                                  {t.okr.endDate}: {formatDate(objective.end_date)}
                                </>
                              )}
                            </p>
                            {drilldown === 'cascade_gap' && (
                              <p className="text-xs text-amber-700 mt-2">{t.okr.noChildObjectiveGap}</p>
                            )}
                            {drilldown === 'orphans' && (
                              <p className="text-xs text-amber-700 mt-2">{t.okr.noParentObjectiveGap}</p>
                            )}
                            {drilldown === 'overdue' && objective.end_date && (
                              <p className="text-xs text-red-700 mt-2">{getOverdueDays(objective.end_date)} {t.okr.daysLate}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-gray-900">{Math.round(objective.progress)}%</p>
                            <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1">
                              <div className={`h-full rounded-full ${getProgressColor(objective.progress)}`} style={{ width: `${Math.min(objective.progress, 100)}%` }} />
                            </div>
                            <div className="mt-3 flex flex-col gap-2">
                              {drilldown === 'cascade_gap' && canEditObjective(objective) && getChildLevel(objective.level) && (
                                <button
                                  onClick={() => openChildObjectiveDraft(objective)}
                                  className="px-3 py-1.5 bg-primary-500 text-white text-xs rounded-lg hover:bg-primary-600"
                                >
                                  {t.okr.createChildOkrAction}
                                </button>
                              )}
                              {drilldown === 'orphans' && canEditObjective(objective) && (
                                <button
                                  onClick={() => openObjectiveEdit(objective)}
                                  className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600"
                                >
                                  {t.okr.alignOkrAction}
                                </button>
                              )}
                              {drilldown !== 'cascade_gap' && drilldown !== 'orphans' && canEditObjective(objective) && (
                                <button
                                  onClick={() => openObjectiveEdit(objective)}
                                  className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-white"
                                >
                                  {t.okr.updateOkrAction}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">{t.okr.noData}</p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <ObjectiveModal
        isOpen={showObjectiveModal}
        onClose={() => { setShowObjectiveModal(false); setEditingObjective(null); setInitialObjectiveData(null); }}
        onSave={handleSaveObjective}
        objective={editingObjective}
        initialData={initialObjectiveData}
        departments={canSeeAll ? departments : departments.filter(d => d.id === userDepartmentId)}
        employees={assignableEmployees}
        parentObjectives={parentCandidates}
        canCreateEnterprise={canSeeAll}
        userDepartmentId={userDepartmentId}
        canSeeAll={canSeeAll}
      />
      
      <KeyResultModal
        isOpen={showKRModal}
        onClose={() => { setShowKRModal(false); setEditingKR(null); }}
        onSave={handleSaveKR}
        objectiveId={krObjectiveId}
        keyResult={editingKR}
      />
      
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
    </>
  );
}

export default function OKRPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /></div>}>
      <OKRContent />
    </Suspense>
  );
}
