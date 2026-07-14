'use client';
import { getToken } from '@/lib/api';

import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import {
  Target, ChevronDown, ChevronRight, Edit2, Check, X,
  TrendingUp, AlertCircle, Clock, CheckCircle, Loader2,
  Building2, Users, User, FileText, BarChart3, Search, CalendarDays,
  ClipboardList, Download, PenLine
} from 'lucide-react';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';
import { generateObjectiveContractPDF } from '@/lib/generateObjectiveContractPDF';

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

interface Objective {
  id: number;
  title: string;
  description?: string;
  level: 'enterprise' | 'department' | 'individual';
  owner_id?: number;
  owner_name?: string;
  department_name?: string;
  period: string;
  progress: number;
  status: string;
  key_results: KeyResult[];
  parent_id?: number;
}

interface ObjectiveContractItem {
  id: number;
  objective_id?: number;
  title: string;
  description?: string;
  action_variables?: string;
  key_results?: KeyResult[];
  weight: number;
  due_date?: string;
  minimum_target?: string;
  standard_target?: string;
  excellence_target?: string;
  score?: number | null;
}

interface ObjectiveContractAttitude {
  attitude_id: number;
  name_snapshot?: string;
  description_snapshot?: string;
  expected_behavior?: string;
  evaluation_mode?: string;
  weight: number;
  threshold?: number;
  score?: number | null;
}

interface ObjectiveContract {
  id: number;
  employee_name?: string;
  employee_matricule?: string;
  employee_job_title?: string;
  manager_name?: string;
  department_name?: string;
  period: string;
  status: string;
  objectives_weight: number;
  attitudes_weight: number;
  final_score?: number | null;
  total_items_weight?: number;
  employee_signed_at?: string | null;
  manager_validated_at?: string | null;
  submitted_at?: string | null;
  closed_at?: string | null;
  employee_signature_url?: string | null;
  manager_signature_url?: string | null;
  rh_signature_url?: string | null;
  rh_signer_name?: string | null;
  items?: ObjectiveContractItem[];
  attitudes?: ObjectiveContractAttitude[];
}

interface ObjectiveContractRow {
  employee_id: number;
  employee_name: string;
  employee_matricule?: string;
  employee_job_title?: string;
  department_name?: string;
  manager_id?: number | null;
  manager_name?: string;
  existing_objectives_count: number;
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
  created_at?: string;
}

type ObjectiveTab = 'objectives' | 'contract' | 'jobDescription' | 'teamContracts' | 'dashboard';

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

async function getMyObjectives(employeeId: number): Promise<Objective[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/okr/objectives?owner_id=${employeeId}&page_size=100`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function updateKeyResult(krId: number, current: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/okr/key-results/${krId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ current }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getMyObjectiveContracts(period: string): Promise<ObjectiveContractRow[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/okr/contracts?period=${encodeURIComponent(period)}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function getObjectiveContractDetail(contractId: number): Promise<ObjectiveContract | null> {
  try {
    const response = await fetch(`${API_URL}/api/okr/contracts/${contractId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function getMyJobDescription(): Promise<EmployeeDocument | null> {
  try {
    const response = await fetch(`${API_URL}/api/documents/my-documents`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    const data = await response.json();
    const docs: EmployeeDocument[] = Array.isArray(data) ? data : (data.items || []);
    return docs
      .filter((doc) =>
        (doc.document_type === 'job_description') ||
        (doc.document_type === JOB_DESCRIPTION_DOCUMENT_TYPE && doc.title?.toLowerCase().startsWith(JOB_DESCRIPTION_TITLE_PREFIX.toLowerCase()))
      )
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
  } catch {
    return null;
  }
}

async function downloadEmployeeDocument(documentId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/documents/download/${documentId}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Erreur lors du téléchargement');
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

async function signObjectiveContract(contractId: number): Promise<ObjectiveContract | null> {
  try {
    const response = await fetch(`${API_URL}/api/okr/contracts/${contractId}/sign`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.detail || "Impossible de signer ce contrat d'objectifs.");
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Impossible de signer ce contrat d'objectifs.");
  }
}

// ============================================
// HELPERS
// ============================================

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'on_track': 'bg-green-100 text-green-700 border-green-200',
    'at_risk': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'behind': 'bg-red-100 text-red-700 border-red-200',
    'exceeded': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'completed': 'bg-green-100 text-green-700 border-green-200',
    'draft': 'bg-gray-100 text-gray-600 border-gray-200',
    'active': 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-600 border-gray-200';
};

function getStatusLabelFn(status: string, t: any) {
  const labels: Record<string, string> = {
    'on_track': t.mySpace.onTrack,
    'at_risk': t.mySpace.atRisk,
    'behind': t.mySpace.behindSchedule,
    'exceeded': t.mySpace.exceeded,
    'completed': t.mySpace.completedStatus,
    'draft': t.mySpace.draftStatus,
    'active': t.mySpace.activeObjStatus,
  };
  return labels[status] || status;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'on_track':
    case 'completed':
    case 'exceeded':
      return <CheckCircle className="w-4 h-4" />;
    case 'at_risk':
      return <AlertCircle className="w-4 h-4" />;
    case 'behind':
      return <Clock className="w-4 h-4" />;
    default:
      return <Target className="w-4 h-4" />;
  }
};

const getProgressColor = (progress: number) => {
  if (progress >= 100) return 'bg-indigo-500';
  if (progress >= 70) return 'bg-green-500';
  if (progress >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getLevelIcon = (level: string) => {
  switch (level) {
    case 'enterprise':
      return <Building2 className="w-4 h-4" />;
    case 'department':
      return <Users className="w-4 h-4" />;
    default:
      return <User className="w-4 h-4" />;
  }
};

function getLevelLabelFn(level: string, t: any) {
  const labels: Record<string, string> = {
    'enterprise': t.mySpace.enterpriseLevel,
    'department': t.mySpace.departmentLevel,
    'individual': t.mySpace.individualLevel,
  };
  return labels[level] || level;
}

const getLevelColor = (level: string) => {
  const colors: Record<string, string> = {
    'enterprise': 'bg-purple-100 text-purple-700',
    'department': 'bg-blue-100 text-blue-700',
    'individual': 'bg-teal-100 text-teal-700',
  };
  return colors[level] || 'bg-gray-100 text-gray-700';
};

const getContractStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    draft: 'Brouillon',
    ready_to_sign: 'Prêt à signer',
    signed: 'Signé',
    in_progress: 'En cours',
    closed: 'Clôturé',
  };
  return labels[status] || status;
};

const getContractStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    ready_to_sign: 'bg-blue-100 text-blue-700',
    signed: 'bg-green-100 text-green-700',
    in_progress: 'bg-teal-100 text-teal-700',
    closed: 'bg-indigo-100 text-indigo-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};

// ============================================
// COMPONENTS
// ============================================

function KeyResultEditor({
  kr,
  onSave,
  onCancel
}: {
  kr: KeyResult;
  onSave: (value: number) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(kr.current.toString());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      toast.error(t.mySpace.enterValidValue);
      return;
    }
    setSaving(true);
    await onSave(numValue);
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 px-2 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        min="0"
        step="0.01"
        autoFocus
      />
      <span className="text-sm text-gray-500">/ {kr.target} {kr.unit}</span>
      <button
        onClick={handleSave}
        disabled={saving}
        className="p-1 text-green-600 hover:bg-green-50 rounded"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
      </button>
      <button
        onClick={onCancel}
        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function KeyResultItem({
  kr,
  onUpdate
}: {
  kr: KeyResult;
  onUpdate: () => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);

  const handleSave = async (newValue: number) => {
    const success = await updateKeyResult(kr.id, newValue);
    if (success) {
      setEditing(false);
      onUpdate();
    } else {
      toast.error(t.mySpace.krUpdateError);
    }
  };

  const progress = kr.target > 0 ? Math.min((kr.current / kr.target) * 100, 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900">{kr.title}</h4>
          {kr.description && (
            <p className="text-xs text-gray-500 mt-1">{kr.description}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 ml-2">{t.mySpace.weightLabel} {kr.weight}%</span>
      </div>

      <div className="space-y-2">
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progress)}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          {editing ? (
            <KeyResultEditor
              kr={kr}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {kr.current} / {kr.target} {kr.unit}
                </span>
                <button
                  onClick={() => setEditing(true)}
                  className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                  title="Mettre à jour"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <span className={`text-sm font-bold ${
                progress >= 100 ? 'text-indigo-600' :
                progress >= 70 ? 'text-green-600' :
                progress >= 40 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {Math.round(progress)}%
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ObjectiveCard({
  objective,
  onUpdate
}: {
  objective: Objective;
  onUpdate: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div
        className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <button className="mt-1 text-gray-400">
              {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getLevelColor(objective.level)}`}>
                  {getLevelIcon(objective.level)}
                  {getLevelLabelFn(objective.level, t)}
                </span>
                {objective.department_name && (
                  <span className="text-xs text-gray-500">• {objective.department_name}</span>
                )}
                <span className="text-xs text-gray-500">• {objective.period}</span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-1">{objective.title}</h3>

              {objective.description && (
                <p className="text-sm text-gray-500">{objective.description}</p>
              )}

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(objective.status)}`}>
                  {getStatusIcon(objective.status)}
                  {getStatusLabelFn(objective.status, t)}
                </span>
                <span className="text-xs text-gray-500">
                  {objective.key_results.length} Key Result{objective.key_results.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right ml-4">
            <div className="text-3xl font-bold text-gray-900">{Math.round(objective.progress)}%</div>
            <div className="w-32 h-2 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(objective.progress)}`}
                style={{ width: `${Math.min(objective.progress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {expanded && objective.key_results.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-600" />
            {t.mySpace.keyResultsTitle}
          </h4>
          <div className="space-y-3" data-tour="key-results">
            {objective.key_results.map((kr) => (
              <KeyResultItem key={kr.id} kr={kr} onUpdate={onUpdate} />
            ))}
          </div>
        </div>
      )}

      {expanded && objective.key_results.length === 0 && (
        <div className="border-t border-gray-100 bg-gray-50 p-5 text-center">
          <p className="text-sm text-gray-500">{t.mySpace.noKeyResultDefined}</p>
        </div>
      )}
    </div>
  );
}

function ContractDetail({
  contract,
  onDownload,
  onSign,
  canSign = false,
  actionLoading = false,
}: {
  contract: ObjectiveContract;
  onDownload?: (contract: ObjectiveContract) => void;
  onSign?: (contract: ObjectiveContract) => void;
  canSign?: boolean;
  actionLoading?: boolean;
}) {
  const items = contract.items || [];
  const signatureDate = contract.employee_signed_at
    ? new Date(contract.employee_signed_at).toLocaleDateString('fr-FR')
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-gray-900">Contrat d'objectifs {contract.period}</h3>
            </div>
            <p className="text-sm text-gray-500">
              Objectifs officiels, pondérations, cibles et état de signature.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-medium ${getContractStatusColor(contract.status)}`}>
              {getContractStatusLabel(contract.status)}
            </span>
            {onDownload && (
              <button
                type="button"
                onClick={() => onDownload(contract)}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </button>
            )}
            {canSign && onSign && (
              <button
                type="button"
                onClick={() => onSign(contract)}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                Signer
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Objectifs</p>
            <p className="text-xl font-bold text-gray-900">{contract.objectives_weight || 0}%</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Attitudes</p>
            <p className="text-xl font-bold text-gray-900">{contract.attitudes_weight || 0}%</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Score final</p>
            <p className="text-xl font-bold text-gray-900">
              {contract.final_score != null ? `${Math.round(contract.final_score)}%` : '-'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Signature</p>
            <p className="text-sm font-semibold text-gray-900">
              {signatureDate ? `Signé le ${signatureDate}` : 'Non signé'}
            </p>
          </div>
        </div>

        {!canSign && contract.status === 'ready_to_sign' && !contract.employee_signed_at && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
            Ce contrat est prêt pour signature par le collaborateur concerné.
          </div>
        )}
      </div>

      <div className="p-5">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Objectifs du contrat
        </h4>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">Aucun objectif contractuel enregistré</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-3 pr-4">Objectif</th>
                  <th className="py-3 pr-4">Poids</th>
                  <th className="py-3 pr-4">Échéance</th>
                  <th className="py-3 pr-4">KR & cibles</th>
                  <th className="py-3 text-right">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="text-sm text-gray-700">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-gray-900">
                        {item.title}{item.description ? ` : ${item.description}` : ''}
                      </p>
                    </td>
                    <td className="py-3 pr-4 font-medium">{item.weight}%</td>
                    <td className="py-3 pr-4">
                      {item.due_date ? new Date(item.due_date).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="py-3 pr-4 text-xs text-gray-500">
                      {item.key_results?.length ? (
                        <div className="space-y-1.5">
                          {item.key_results.map((kr) => (
                            <div key={kr.id}>
                              <p className="font-medium text-gray-700">{kr.title}</p>
                              <p>
                                Min. {kr.minimum_target || item.minimum_target || '-'}
                                <span className="mx-1">•</span>
                                Std. {kr.standard_target || item.standard_target || `${kr.target}${kr.unit ? ` ${kr.unit}` : ''}`}
                                <span className="mx-1">•</span>
                                Exc. {kr.excellence_target || item.excellence_target || '-'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-medium">
                      {item.score != null ? item.score : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MyObjectivesPage() {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ObjectiveTab>('objectives');
  const [contractPeriod, setContractPeriod] = useState(() => String(new Date().getFullYear()));
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractRows, setContractRows] = useState<ObjectiveContractRow[]>([]);
  const [teamContractRows, setTeamContractRows] = useState<ObjectiveContractRow[]>([]);
  const [jobDescription, setJobDescription] = useState<EmployeeDocument | null>(null);
  const [selectedContract, setSelectedContract] = useState<ObjectiveContract | null>(null);
  const [selectedTeamContract, setSelectedTeamContract] = useState<ObjectiveContract | null>(null);
  const [contractSearch, setContractSearch] = useState('');
  const [teamContractSearch, setTeamContractSearch] = useState('');
  const [contractPage, setContractPage] = useState(1);
  const [teamContractPage, setTeamContractPage] = useState(1);
  const [contractActionLoading, setContractActionLoading] = useState(false);
  const [jobDescriptionDownloading, setJobDescriptionDownloading] = useState(false);
  const contractPageSize = 5;

  const { showTips, dismissTips } = usePageTour('objectives');

  const loadObjectives = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const data = await getMyObjectives(employeeId);
      setObjectives(data);
    } catch (error) {
      console.error('Error loading objectives:', error);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const loadContracts = useCallback(async () => {
    if (!employeeId) return;
    setContractsLoading(true);
    try {
      const rows = await getMyObjectiveContracts(contractPeriod);
      const myRows = rows.filter((row) => row.employee_id === employeeId);
      const teamRows = rows.filter((row) => row.manager_id === employeeId);
      setContractRows(myRows);
      setTeamContractRows(teamRows);
      const firstContract = myRows.find((row) => row.contract)?.contract;
      if (firstContract) {
        const detail = await getObjectiveContractDetail(firstContract.id);
        setSelectedContract(detail);
      } else {
        setSelectedContract(null);
      }
      setSelectedTeamContract(null);
    } catch (error) {
      console.error('Error loading objective contracts:', error);
      setSelectedContract(null);
      setSelectedTeamContract(null);
    } finally {
      setContractsLoading(false);
    }
  }, [employeeId, contractPeriod]);

  const loadJobDescription = useCallback(async () => {
    setJobDescription(await getMyJobDescription());
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setEmployeeId(userData.employee_id);
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (employeeId) {
      loadObjectives();
    }
  }, [employeeId, loadObjectives]);

  useEffect(() => {
    if (employeeId) {
      loadContracts();
      loadJobDescription();
    }
  }, [employeeId, loadContracts, loadJobDescription]);

  const handleDownloadJobDescription = async () => {
    if (!jobDescription) return;
    setJobDescriptionDownloading(true);
    try {
      await downloadEmployeeDocument(jobDescription.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors du téléchargement');
    } finally {
      setJobDescriptionDownloading(false);
    }
  };

  const totalObjectives = objectives.length;
  const avgProgress = totalObjectives > 0
    ? Math.round(objectives.reduce((acc, o) => acc + o.progress, 0) / totalObjectives)
    : 0;
  const onTrack = objectives.filter(o => o.status === 'on_track' || o.status === 'exceeded').length;
  const atRisk = objectives.filter(o => o.status === 'at_risk').length;
  const behind = objectives.filter(o => o.status === 'behind').length;
  const keyResultsCount = objectives.reduce((acc, objective) => acc + objective.key_results.length, 0);
  const completedKeyResults = objectives.reduce(
    (acc, objective) => acc + objective.key_results.filter((kr) => kr.progress >= 100).length,
    0
  );
  const contractRowsFiltered = useMemo(() => {
    const query = contractSearch.trim().toLowerCase();
    if (!query) return contractRows;
    return contractRows.filter((row) => [
      row.employee_name,
      row.employee_matricule,
      row.employee_job_title,
      row.department_name,
      row.manager_name,
      row.contract?.period,
      row.contract?.status,
    ].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [contractRows, contractSearch]);
  const totalContractPages = Math.max(1, Math.ceil(contractRowsFiltered.length / contractPageSize));
  const paginatedContractRows = useMemo(() => {
    const start = (contractPage - 1) * contractPageSize;
    return contractRowsFiltered.slice(start, start + contractPageSize);
  }, [contractRowsFiltered, contractPage]);
  const teamContractRowsFiltered = useMemo(() => {
    const query = teamContractSearch.trim().toLowerCase();
    if (!query) return teamContractRows;
    return teamContractRows.filter((row) => [
      row.employee_name,
      row.employee_matricule,
      row.employee_job_title,
      row.department_name,
      row.manager_name,
      row.contract?.period,
      row.contract?.status,
    ].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [teamContractRows, teamContractSearch]);
  const totalTeamContractPages = Math.max(1, Math.ceil(teamContractRowsFiltered.length / contractPageSize));
  const paginatedTeamContractRows = useMemo(() => {
    const start = (teamContractPage - 1) * contractPageSize;
    return teamContractRowsFiltered.slice(start, start + contractPageSize);
  }, [teamContractRowsFiltered, teamContractPage]);

  useEffect(() => {
    setContractPage(1);
  }, [contractSearch, contractPeriod]);

  useEffect(() => {
    setTeamContractPage(1);
  }, [teamContractSearch, contractPeriod]);

  const handleDownloadContractPdf = async (contract: ObjectiveContract) => {
    setContractActionLoading(true);
    try {
      await generateObjectiveContractPDF(contract as any, 'TARGETYM AI', t.okr, locale);
    } catch (error) {
      console.error('Erreur génération contrat PDF:', error);
      toast.error("Impossible de télécharger ce contrat d'objectifs.");
    } finally {
      setContractActionLoading(false);
    }
  };

  const handleSignContract = async (contract: ObjectiveContract) => {
    if (contract.status !== 'ready_to_sign') {
      toast.error("Ce contrat d'objectif n'est pas encore disponible pour signature.");
      return;
    }
    const confirmed = window.confirm("Confirmer la signature de ce contrat d'objectifs ?");
    if (!confirmed) return;

    setContractActionLoading(true);
    try {
      const signedContract = await signObjectiveContract(contract.id);
      if (!signedContract) throw new Error("Impossible de signer ce contrat d'objectifs.");
      setSelectedContract(signedContract);
      setContractRows((rows) => rows.map((row) => (
        row.contract?.id === signedContract.id
          ? { ...row, contract: { ...row.contract, ...signedContract } }
          : row
      )));
      toast.success("Contrat d'objectifs signé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de signer ce contrat d'objectifs.");
    } finally {
      setContractActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" />
          <p className="text-gray-500">{t.mySpace.loadingObjectives}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips pageId="objectives" onDismiss={dismissTips} pageTitle={t.mySpace.myObjectivesTitle} />
      )}
      <Header title={t.mySpace.myObjectivesTitle} subtitle={t.mySpace.myObjectivesSubtitle} />
      <div className="min-h-screen bg-gray-50">

      <div className="p-4 md:p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalObjectives}</p>
                <p className="text-xs text-gray-500">{t.mySpace.objectivesCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{avgProgress}%</p>
                <p className="text-xs text-gray-500">{t.mySpace.progressionLabel}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{onTrack}</p>
                <p className="text-xs text-gray-500">{t.mySpace.onTrack}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{atRisk}</p>
                <p className="text-xs text-gray-500">{t.mySpace.atRisk}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{behind}</p>
                <p className="text-xs text-gray-500">{t.mySpace.behindSchedule}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 rounded-xl bg-gray-100 p-1 overflow-x-auto">
          {[
            { id: 'objectives' as const, label: 'Mes objectifs & actions', icon: Target },
            { id: 'contract' as const, label: "Contrat d'objectifs", icon: FileText },
            { id: 'jobDescription' as const, label: 'Job description', icon: ClipboardList },
            ...(teamContractRows.length > 0
              ? [{ id: 'teamContracts' as const, label: 'Contrats de mon équipe', icon: Users }]
              : []),
            { id: 'dashboard' as const, label: 'Tableau de bord', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'objectives' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-blue-900">Comment mettre à jour vos objectifs ?</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    {t.mySpace.howToUpdateDesc}
                  </p>
                </div>
              </div>
            </div>

            {objectives.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t.mySpace.noObjectiveAssigned}</h3>
                <p className="text-gray-500">
                  {t.mySpace.noObjectiveAssignedDesc}
                </p>
              </div>
            ) : (
              <div className="space-y-4" data-tour="objectives-list">
                {objectives.map((objective) => (
                  <ObjectiveCard
                    key={objective.id}
                    objective={objective}
                    onUpdate={loadObjectives}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'contract' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Mes contrats d'objectifs</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Consultez votre contrat de la période et l'historique disponible.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={contractSearch}
                      onChange={(event) => setContractSearch(event.target.value)}
                      placeholder="Rechercher"
                      className="w-full sm:w-64 rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={contractPeriod}
                      onChange={(event) => setContractPeriod(event.target.value)}
                      className="w-full sm:w-32 rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {contractsLoading ? (
                  <div className="flex items-center justify-center py-10 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Chargement du contrat...
                  </div>
                ) : paginatedContractRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Contrat d'objectif pas encore disponible.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paginatedContractRows.map((row) => (
                      <div key={`${row.employee_id}-${row.contract?.id || 'empty'}`} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{row.employee_name}</p>
                          <p className="text-sm text-gray-500">
                            {[row.employee_matricule, row.employee_job_title, row.department_name].filter(Boolean).join(' · ') || 'Collaborateur'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {row.existing_objectives_count} objectif{row.existing_objectives_count > 1 ? 's' : ''} individuel{row.existing_objectives_count > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {row.contract ? (
                            <>
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${getContractStatusColor(row.contract.status)}`}>
                                {getContractStatusLabel(row.contract.status)}
                              </span>
                              <button
                                onClick={async () => {
                                  const detail = await getObjectiveContractDetail(row.contract!.id);
                                  if (!detail) {
                                    toast.error("Impossible d'ouvrir ce contrat d'objectifs.");
                                    return;
                                  }
                                  setSelectedContract(detail);
                                }}
                                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                              >
                                Ouvrir
                              </button>
                            </>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                              Aucun contrat
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {contractRowsFiltered.length > contractPageSize && (
                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">
                    Page {contractPage} sur {totalContractPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setContractPage((page) => Math.max(1, page - 1))}
                      disabled={contractPage === 1}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => setContractPage((page) => Math.min(totalContractPages, page + 1))}
                      disabled={contractPage === totalContractPages}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedContract && (
              <ContractDetail
                contract={selectedContract}
                onDownload={handleDownloadContractPdf}
                onSign={handleSignContract}
                canSign={selectedContract.status === 'ready_to_sign' && !selectedContract.employee_signed_at}
                actionLoading={contractActionLoading}
              />
            )}
          </div>
        )}

        {activeTab === 'jobDescription' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Ma job description</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Consultez la fiche de poste mise à disposition par les RH.
                </p>
              </div>
            </div>

            {jobDescription ? (
              <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{jobDescription.title || 'Job description'}</p>
                  <p className="text-sm text-gray-500 mt-1 truncate">{jobDescription.file_name || 'Document'}</p>
                </div>
                <button
                  onClick={handleDownloadJobDescription}
                  disabled={jobDescriptionDownloading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {jobDescriptionDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Télécharger
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-700">Job description pas encore disponible</p>
                <p className="text-sm text-gray-500 mt-1">Elle apparaîtra ici dès qu'elle sera ajoutée par les RH.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'teamContracts' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Contrats de mon équipe</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Consultation des contrats des collaborateurs directs accessibles.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={teamContractSearch}
                      onChange={(event) => setTeamContractSearch(event.target.value)}
                      placeholder="Rechercher un collaborateur"
                      className="w-full sm:w-72 rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={contractPeriod}
                      onChange={(event) => setContractPeriod(event.target.value)}
                      className="w-full sm:w-32 rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {contractsLoading ? (
                  <div className="flex items-center justify-center py-10 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Chargement des contrats...
                  </div>
                ) : paginatedTeamContractRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Aucun contrat d'équipe disponible pour cette période.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paginatedTeamContractRows.map((row) => (
                      <div key={`${row.employee_id}-${row.contract?.id || 'empty'}`} className="flex flex-col gap-3 rounded-lg border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{row.employee_name}</p>
                          <p className="text-sm text-gray-500">
                            {[row.employee_matricule, row.employee_job_title, row.department_name].filter(Boolean).join(' · ') || 'Collaborateur'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Manager : {row.manager_name || '-'} · {row.existing_objectives_count} objectif{row.existing_objectives_count > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {row.contract ? (
                            <>
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${getContractStatusColor(row.contract.status)}`}>
                                {getContractStatusLabel(row.contract.status)}
                              </span>
                              <button
                                onClick={async () => {
                                  const detail = await getObjectiveContractDetail(row.contract!.id);
                                  if (!detail) {
                                    toast.error("Impossible d'ouvrir ce contrat d'objectifs.");
                                    return;
                                  }
                                  setSelectedTeamContract(detail);
                                }}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Voir
                              </button>
                            </>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                              Pas encore disponible
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {teamContractRowsFiltered.length > contractPageSize && (
                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">
                    Page {teamContractPage} sur {totalTeamContractPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTeamContractPage((page) => Math.max(1, page - 1))}
                      disabled={teamContractPage === 1}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => setTeamContractPage((page) => Math.min(totalTeamContractPages, page + 1))}
                      disabled={teamContractPage === totalTeamContractPages}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedTeamContract && (
              <ContractDetail
                contract={selectedTeamContract}
                onDownload={handleDownloadContractPdf}
                actionLoading={contractActionLoading}
              />
            )}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm text-gray-500">Progression moyenne</p>
              <p className="mt-2 text-4xl font-bold text-gray-900">{avgProgress}%</p>
              <div className="mt-4 h-2 rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${getProgressColor(avgProgress)}`} style={{ width: `${Math.min(avgProgress, 100)}%` }} />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm text-gray-500">Résultats clés</p>
              <p className="mt-2 text-4xl font-bold text-gray-900">{completedKeyResults}/{keyResultsCount}</p>
              <p className="mt-3 text-sm text-gray-500">KR atteints ou dépassés</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm text-gray-500">Points d'attention</p>
              <p className="mt-2 text-4xl font-bold text-gray-900">{atRisk + behind}</p>
              <p className="mt-3 text-sm text-gray-500">Objectifs à risque ou en retard</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:col-span-3">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Actions liées aux objectifs</h2>
              </div>
              <p className="text-sm text-gray-500">
                Les actions issues des rituels, check-lists et tâches connectées aux KR seront consolidées ici pour suivre la contribution quotidienne aux objectifs.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
