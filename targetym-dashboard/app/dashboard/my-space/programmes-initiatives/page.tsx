'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Flag,
  Layers3,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Target,
  Trash2,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';

import Header from '@/components/Header';
import { API_URL, fetchWithAuth } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export type ProgramInitiativeFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface ProgramInitiativeItem {
  id: number;
  title: string;
  description: string | null;
  frequency: ProgramInitiativeFrequency;
  priority: string;
  sort_order: number;
}

export interface ProgramInitiative {
  id: number;
  code: string;
  name: string;
  description: string | null;
  objective: string | null;
  category: string | null;
  status: string;
  is_template: boolean;
  is_visible_to_managers: boolean;
  items_count: number;
  items?: ProgramInitiativeItem[];
  created_at: string | null;
  updated_at: string | null;
}

export interface HREmployeeItem {
  id: number;
  name: string;
  job_title: string | null;
  email: string;
}

export interface ProgramInitiativeAssignmentItem {
  id: number;
  source_item_id: number | null;
  title: string;
  description: string | null;
  frequency: ProgramInitiativeFrequency;
  priority: string;
  weight_pct: number | null;
  effective_weight_pct: number | null;
  objective_id: number | null;
  key_result_id: number | null;
  kr_contribution: number | null;
  tasks_count: number;
  completed_tasks_count: number;
  progress_pct: number;
  applied_kr_contribution: number;
  due_date: string | null;
  repeat_until: string | null;
  is_enabled: boolean;
  sort_order: number;
}

export interface ProgramInitiativeAssignment {
  id: number;
  program_id: number | null;
  program_code: string | null;
  program_name: string;
  name: string;
  description: string | null;
  status: string;
  employee_id: number;
  employee: HREmployeeItem | null;
  manager_id: number | null;
  manager: HREmployeeItem | null;
  objective_id: number | null;
  objective_title: string | null;
  key_result_id: number | null;
  key_result_title: string | null;
  kr_weight: number | null;
  auto_apply_to_kr: boolean;
  starts_on: string | null;
  ends_on: string | null;
  items_count: number;
  tasks_count: number;
  completed_tasks_count: number;
  progress_pct: number;
  weighted_progress_pct: number;
  estimated_kr_contribution_pct: number;
  estimated_kr_contribution_value: number;
  applied_kr_contribution: number;
  items?: ProgramInitiativeAssignmentItem[];
  created_tasks?: number;
  created_at: string | null;
  updated_at: string | null;
}

interface KeyResultForLinking {
  id: number;
  title: string;
  current: number;
  target: number;
  unit?: string;
}

interface ObjectiveForLinking {
  id: number;
  title: string;
  level: 'enterprise' | 'department' | 'team' | 'individual';
  progress: number;
  key_results: KeyResultForLinking[];
}

// ============================================
// API
// ============================================

async function parseError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) return data.detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join(', ') || fallback;
  return fallback;
}

async function getProgramInitiatives(): Promise<ProgramInitiative[]> {
  const response = await fetchWithAuth(`${API_URL}/api/program-initiatives`);
  if (!response.ok) throw new Error(await parseError(response, 'Erreur lors du chargement des programmes.'));
  return response.json();
}

async function getProgramInitiative(id: number): Promise<ProgramInitiative> {
  const response = await fetchWithAuth(`${API_URL}/api/program-initiatives/detail/${id}`);
  if (!response.ok) throw new Error(await parseError(response, 'Erreur lors du chargement du programme.'));
  return response.json();
}

async function getProgramInitiativeEmployees(): Promise<HREmployeeItem[]> {
  const response = await fetchWithAuth(`${API_URL}/api/program-initiatives/assignable/employees`);
  if (!response.ok) throw new Error(await parseError(response, 'Erreur lors du chargement des collaborateurs.'));
  return response.json();
}

async function getMyProgramInitiativeAssignments(): Promise<ProgramInitiativeAssignment[]> {
  const response = await fetchWithAuth(`${API_URL}/api/program-initiatives/assignments/my`);
  if (!response.ok) throw new Error(await parseError(response, 'Erreur lors du chargement de vos programmes.'));
  return response.json();
}

async function getManagedProgramInitiativeAssignments(): Promise<ProgramInitiativeAssignment[]> {
  const response = await fetchWithAuth(`${API_URL}/api/program-initiatives/assignments/managed`);
  if (!response.ok) throw new Error(await parseError(response, 'Erreur lors du chargement des programmes gérés.'));
  return response.json();
}

async function getObjectivesForLinking(employeeId?: number): Promise<ObjectiveForLinking[]> {
  const url = employeeId
    ? `${API_URL}/api/tasks/objectives-for-linking?employee_id=${employeeId}`
    : `${API_URL}/api/tasks/objectives-for-linking`;
  const response = await fetchWithAuth(url);
  if (!response.ok) return [];
  return response.json();
}

async function assignProgramInitiative(
  id: number,
  data: {
    employee_id: number;
    name?: string | null;
    description?: string | null;
    selected_item_ids?: number[];
    frequency?: ProgramInitiativeFrequency;
    objective_id?: number | null;
    key_result_id?: number | null;
    kr_weight?: number | null;
    auto_apply_to_kr?: boolean;
    starts_on?: string | null;
    ends_on?: string | null;
    item_links?: Array<{
      item_id: number;
      title?: string | null;
      description?: string | null;
      frequency?: ProgramInitiativeFrequency;
      priority?: string;
      objective_id?: number | null;
      key_result_id?: number | null;
      weight_pct?: number | null;
      due_date?: string | null;
      repeat_until?: string | null;
    }>;
    custom_items?: Array<{
      title: string;
      description?: string | null;
      frequency?: ProgramInitiativeFrequency;
      priority?: string;
      objective_id?: number | null;
      key_result_id?: number | null;
      weight_pct?: number | null;
      due_date?: string | null;
      repeat_until?: string | null;
    }>;
  }
): Promise<ProgramInitiativeAssignment> {
  const response = await fetchWithAuth(`${API_URL}/api/program-initiatives/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseError(response, "Erreur lors de l'activation du programme."));
  return response.json();
}

async function updateProgramInitiativeAssignment(
  id: number,
  data: {
    name?: string | null;
    description?: string | null;
    objective_id?: number | null;
    key_result_id?: number | null;
    kr_weight?: number | null;
    auto_apply_to_kr?: boolean | null;
    starts_on?: string | null;
    ends_on?: string | null;
    items: Array<{
      id?: number | null;
      title: string;
      description?: string | null;
      frequency?: ProgramInitiativeFrequency;
      priority?: string;
      objective_id?: number | null;
      key_result_id?: number | null;
      weight_pct?: number | null;
      due_date?: string | null;
      repeat_until?: string | null;
      is_enabled?: boolean;
    }>;
  }
): Promise<ProgramInitiativeAssignment> {
  const response = await fetchWithAuth(`${API_URL}/api/program-initiatives/assignments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseError(response, 'Erreur lors de la mise à jour du programme.'));
  return response.json();
}

// ============================================
// HELPERS
// ============================================

const FREQUENCY_LABELS: Record<ProgramInitiativeFrequency, string> = {
  once: 'Ponctuel',
  daily: 'Journalier',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
};

const FREQUENCY_STYLE: Record<ProgramInitiativeFrequency, string> = {
  once: 'bg-gray-100 text-gray-700 border-gray-200',
  daily: 'bg-amber-50 text-amber-700 border-amber-100',
  weekly: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  monthly: 'bg-sky-50 text-sky-700 border-sky-100',
  quarterly: 'bg-violet-50 text-violet-700 border-violet-100',
};

function formatDate(value?: string | null) {
  if (!value) return 'Non défini';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function defaultDate(offsetMonths = 0) {
  const d = new Date();
  if (offsetMonths) d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}

type EditableProgramItem = {
  localId: string;
  id?: number;
  sourceItemId?: number | null;
  title: string;
  description: string;
  frequency: ProgramInitiativeFrequency;
  priority: string;
  weightPct: number;
  dueDate: string;
  repeatUntil: string;
  isEnabled: boolean;
};

function newEditableItem(startsOn = defaultDate(), endsOn = defaultDate(3)): EditableProgramItem {
  return {
    localId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: 'Nouvelle action',
    description: '',
    frequency: 'weekly',
    priority: 'medium',
    weightPct: 0,
    dueDate: startsOn,
    repeatUntil: endsOn,
    isEnabled: true,
  };
}

function programItemsToEditable(items: ProgramInitiativeItem[], startsOn: string, endsOn: string): EditableProgramItem[] {
  return items.map(item => ({
    localId: `source-${item.id}`,
    sourceItemId: item.id,
    title: item.title,
    description: item.description || '',
    frequency: item.frequency,
    priority: item.priority || 'medium',
    weightPct: 0,
    dueDate: startsOn,
    repeatUntil: endsOn,
    isEnabled: true,
  }));
}

function assignmentItemsToEditable(items: ProgramInitiativeAssignmentItem[]): EditableProgramItem[] {
  return items.map(item => ({
    localId: `assigned-${item.id}`,
    id: item.id,
    sourceItemId: item.source_item_id,
    title: item.title,
    description: item.description || '',
    frequency: item.frequency,
    priority: item.priority || 'medium',
    weightPct: item.weight_pct ?? item.effective_weight_pct ?? 0,
    dueDate: item.due_date || defaultDate(),
    repeatUntil: item.repeat_until || defaultDate(3),
    isEnabled: item.is_enabled,
  }));
}

// ============================================
// COMPONENTS
// ============================================

function AssignmentCard({ assignment, onOpen }: { assignment: ProgramInitiativeAssignment; onOpen?: (assignment: ProgramInitiativeAssignment) => void }) {
  const items = assignment.items || [];
  const frequencies = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.frequency] = (acc[item.frequency] || 0) + 1;
      return acc;
    }, {});
  }, [items]);

  return (
    <article
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(assignment)}
      onKeyDown={(event) => {
        if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen(assignment);
        }
      }}
      className={`bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-primary-200 hover:shadow-md transition-all flex flex-col min-w-0 ${onOpen ? 'cursor-pointer' : ''}`}
    >
      <div className="relative h-2 bg-primary-500" />
      <div className="p-4 flex flex-col gap-4 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-mono text-gray-400 leading-none">{assignment.program_code || 'PROGRAMME'}</span>
            <h2 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 mt-1">{assignment.name}</h2>
            {assignment.description && <p className="mt-2 text-xs text-gray-500 line-clamp-2">{assignment.description}</p>}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Actif
          </span>
        </div>

        {(assignment.objective_title || assignment.key_result_title) && (
          <div className="border border-primary-100 bg-primary-50 rounded-lg p-3">
            <div className="flex items-start gap-2 text-xs">
              <Target className="w-3.5 h-3.5 text-primary-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                {assignment.objective_title && <p className="font-medium text-primary-900 truncate">{assignment.objective_title}</p>}
                {assignment.key_result_title && <p className="text-primary-700 mt-0.5 truncate">KR: {assignment.key_result_title}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Progression pondérée</span>
            <span className="font-semibold text-gray-900">{assignment.weighted_progress_pct ?? assignment.progress_pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-primary-500" style={{ width: `${assignment.weighted_progress_pct ?? assignment.progress_pct}%` }} />
          </div>
          <p className="text-xs text-gray-400">
            {assignment.completed_tasks_count}/{assignment.tasks_count} tâches terminées
          </p>
        </div>

        {assignment.key_result_id && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-gray-400">Poids KR</p>
              <p className="font-semibold text-gray-900">{assignment.kr_weight ?? 0}%</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-gray-400">Contribution</p>
              <p className="font-semibold text-gray-900">{assignment.estimated_kr_contribution_pct ?? 0}%</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <ClipboardList className="w-3.5 h-3.5" />
            {assignment.items_count} action{assignment.items_count > 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {formatDate(assignment.starts_on)}
          </span>
          {assignment.employee && (
            <span className="flex items-center gap-1 min-w-0">
              <UserCheck className="w-3.5 h-3.5" />
              <span className="truncate">{assignment.employee.name}</span>
            </span>
          )}
        </div>

        {Object.keys(frequencies).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(frequencies) as Array<[ProgramInitiativeFrequency, number]>).map(([frequency, count]) => (
              <span key={frequency} className={`inline-flex border rounded-full px-2 py-0.5 text-[11px] font-medium ${FREQUENCY_STYLE[frequency] || FREQUENCY_STYLE.weekly}`}>
                {count} {FREQUENCY_LABELS[frequency] || frequency}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

const TEMPLATE_GRADIENTS = [
  'from-primary-500 to-primary-700',
  'from-emerald-500 to-teal-700',
  'from-sky-500 to-blue-700',
  'from-amber-500 to-orange-700',
];

function ProgramTemplateCard({
  program,
  index,
  onActivate,
  activating,
}: {
  program: ProgramInitiative;
  index: number;
  onActivate: (program: ProgramInitiative) => void;
  activating: boolean;
}) {
  const gradient = TEMPLATE_GRADIENTS[index % TEMPLATE_GRADIENTS.length];

  return (
    <article className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-primary-200 hover:shadow-md transition-all flex flex-col min-w-0">
      <div className={`relative h-24 sm:h-28 overflow-hidden bg-gradient-to-br ${gradient}`}>
        <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 text-primary-700">
          Template
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white">
            <Flag className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 shrink-0">
            <Layers3 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono text-gray-400 leading-none">{program.code}</span>
            <h3 className="text-sm font-semibold text-gray-900 leading-tight truncate">{program.name}</h3>
          </div>
        </div>
        {program.objective && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{program.objective}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap min-w-0">
          <span className="flex items-center gap-1">
            <ClipboardList className="w-3.5 h-3.5" />
            {program.items_count} action{program.items_count > 1 ? 's' : ''}
          </span>
          {program.category && (
            <span className="flex items-center gap-1 min-w-0">
              <Target className="w-3.5 h-3.5" />
              <span className="truncate">{program.category}</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onActivate(program)}
          disabled={activating}
          className="mt-auto flex items-center justify-center gap-2 w-full min-h-10 px-3 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Ouvrir / assigner
        </button>
      </div>
    </article>
  );
}

function EditableItemsList({
  items,
  onChange,
  startsOn,
  endsOn,
}: {
  items: EditableProgramItem[];
  onChange: (items: EditableProgramItem[]) => void;
  startsOn: string;
  endsOn: string;
}) {
  const updateItem = (localId: string, patch: Partial<EditableProgramItem>) => {
    onChange(items.map(item => item.localId === localId ? { ...item, ...patch } : item));
  };
  const removeItem = (localId: string) => onChange(items.filter(item => item.localId !== localId));
  const enabledItems = items.filter(item => item.isEnabled);
  const totalWeight = enabledItems.reduce((total, item) => total + Number(item.weightPct || 0), 0);
  const distributeWeights = () => {
    if (enabledItems.length === 0) return;
    const base = Math.floor((100 / enabledItems.length) * 100) / 100;
    const enabledIds = new Set(enabledItems.map(item => item.localId));
    let distributedCount = 0;
    const distributed = items.map((item) => {
      if (!enabledIds.has(item.localId)) return { ...item, weightPct: 0 };
      distributedCount += 1;
      const weight = distributedCount === enabledItems.length
        ? Math.round((100 - base * (enabledItems.length - 1)) * 100) / 100
        : base;
      return { ...item, weightPct: weight };
    });
    onChange(distributed);
  };

  return (
    <div>
      <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between mb-2">
        <div className="min-w-0">
          <span className="text-xs font-medium text-gray-600">Actions et tâches du programme</span>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Poids total saisi : {Math.round(totalWeight * 100) / 100}%
          </p>
        </div>
        <button
          type="button"
          onClick={distributeWeights}
          disabled={enabledItems.length === 0}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-primary-200 bg-white text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
        >
          <Wand2 className="w-3.5 h-3.5" />
          Répartir équitablement
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.localId} className="bg-white rounded-lg border border-primary-100 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-gray-500">Action {index + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(item.localId)}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Titre de l'action</span>
                <input
                  value={item.title}
                  onChange={e => updateItem(item.localId, { title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Description</span>
                <textarea
                  value={item.description}
                  onChange={e => updateItem(item.localId, { description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm resize-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Fréquence</span>
                <select
                  value={item.frequency}
                  onChange={e => updateItem(item.localId, { frequency: e.target.value as ProgramInitiativeFrequency })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                >
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Priorité</span>
                <select
                  value={item.priority}
                  onChange={e => updateItem(item.localId, { priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Poids action (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={item.weightPct}
                  onChange={e => updateItem(item.localId, { weightPct: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Début tâche</span>
                <input
                  type="date"
                  value={item.dueDate}
                  onChange={e => updateItem(item.localId, { dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Répéter jusqu'au</span>
                <input
                  type="date"
                  value={item.repeatUntil}
                  onChange={e => updateItem(item.localId, { repeatUntil: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                />
              </label>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 bg-white rounded-lg border border-dashed border-gray-200 text-sm text-gray-500">
            Aucune action. Ajoutez au moins une action pour générer des tâches.
          </div>
        )}
        <button
          type="button"
          onClick={() => onChange([...items, newEditableItem(startsOn, endsOn)])}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg border border-dashed border-primary-200 bg-primary-50 text-sm font-medium text-primary-700 hover:bg-primary-100"
        >
          <Plus className="w-4 h-4" />
          Ajouter une action
        </button>
      </div>
    </div>
  );
}

function ActivateModal({
  program,
  employees,
  onClose,
  onDone,
}: {
  program: ProgramInitiative & { items?: ProgramInitiativeItem[] };
  employees: HREmployeeItem[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [frequency, setFrequency] = useState<ProgramInitiativeFrequency>('weekly');
  const [startsOn, setStartsOn] = useState(defaultDate());
  const [endsOn, setEndsOn] = useState(defaultDate(3));
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description || program.objective || '');
  const [objectives, setObjectives] = useState<ObjectiveForLinking[]>([]);
  const [objectiveId, setObjectiveId] = useState<number | ''>('');
  const [keyResultId, setKeyResultId] = useState<number | ''>('');
  const [krWeight, setKrWeight] = useState(0);
  const [autoApplyToKr, setAutoApplyToKr] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableProgramItem[]>(() => programItemsToEditable(program.items || [], defaultDate(), defaultDate(3)));
  const [saving, setSaving] = useState(false);
  const selectedObjective = objectives.find(objective => objective.id === objectiveId);

  useEffect(() => {
    if (!employeeId) {
      setObjectives([]);
      setObjectiveId('');
      setKeyResultId('');
      setKrWeight(0);
      setAutoApplyToKr(false);
      return;
    }
    getObjectivesForLinking(Number(employeeId)).then(setObjectives).catch(() => setObjectives([]));
  }, [employeeId]);

  const submit = async () => {
    const enabledItems = editableItems.filter(item => item.isEnabled && item.title.trim());
    if (!employeeId || enabledItems.length === 0) return;
    setSaving(true);
    try {
      const sourceItems = enabledItems.filter(item => item.sourceItemId);
      const customItems = enabledItems.filter(item => !item.sourceItemId);
      const result = await assignProgramInitiative(program.id, {
        employee_id: Number(employeeId),
        name,
        description,
        selected_item_ids: sourceItems.map(item => Number(item.sourceItemId)),
        frequency,
        objective_id: objectiveId || null,
        key_result_id: keyResultId || null,
        kr_weight: keyResultId ? krWeight : null,
        auto_apply_to_kr: Boolean(keyResultId && autoApplyToKr),
        starts_on: startsOn,
        ends_on: endsOn,
        item_links: sourceItems.map(item => ({
          item_id: Number(item.sourceItemId),
          title: item.title,
          description: item.description,
          frequency: item.frequency,
          priority: item.priority,
          due_date: item.dueDate || startsOn,
          repeat_until: item.repeatUntil || endsOn,
          objective_id: objectiveId || null,
          key_result_id: keyResultId || null,
          weight_pct: item.weightPct || null,
        })),
        custom_items: customItems.map(item => ({
          title: item.title,
          description: item.description,
          frequency: item.frequency,
          priority: item.priority,
          due_date: item.dueDate || startsOn,
          repeat_until: item.repeatUntil || endsOn,
          objective_id: objectiveId || null,
          key_result_id: keyResultId || null,
          weight_pct: item.weightPct || null,
        })),
      });
      onDone(`Programme activé · ${result.created_tasks || 0} tâche(s) générée(s).`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-primary-600 font-medium">Activer</p>
            <h2 className="font-bold text-gray-900">Préparer le programme</h2>
            <p className="text-sm text-gray-500 mt-1">Modifiez le contenu avant de l'assigner au collaborateur.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 sm:p-5 space-y-5">
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 sm:p-4">
            <p className="font-semibold text-sm flex items-center gap-2 text-primary-800 mb-3">
              <Play className="w-4 h-4 text-primary-600" />
              Paramètres d'activation
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Titre du programme</span>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Description du programme</span>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm resize-none" />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Collaborateur N-1</span>
                <select value={employeeId} onChange={e => setEmployeeId(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none">
                  <option value="">Sélectionner</option>
                  {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}{employee.job_title ? ` · ${employee.job_title}` : ''}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Fréquence</span>
                <select value={frequency} onChange={e => setFrequency(e.target.value as ProgramInitiativeFrequency)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm">
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Objectif OKR</span>
                <select
                  value={objectiveId}
                  onChange={e => {
                    setObjectiveId(e.target.value ? Number(e.target.value) : '');
                    setKeyResultId('');
                    setKrWeight(0);
                    setAutoApplyToKr(false);
                  }}
                  disabled={!employeeId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm disabled:bg-gray-100"
                >
                  <option value="">Aucun</option>
                  {objectives.map(objective => <option key={objective.id} value={objective.id}>{objective.title}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Début</span>
                <input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Jusqu'au</span>
                <input type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Key Result</span>
                <select
                  value={keyResultId}
                  onChange={e => {
                    const value = e.target.value ? Number(e.target.value) : '';
                    setKeyResultId(value);
                    if (!value) {
                      setKrWeight(0);
                      setAutoApplyToKr(false);
                    }
                  }}
                  disabled={!selectedObjective?.key_results.length}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm disabled:bg-gray-100"
                >
                  <option value="">Aucun</option>
                  {selectedObjective?.key_results.map(kr => <option key={kr.id} value={kr.id}>{kr.title}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Poids du programme dans le KR (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={krWeight}
                  onChange={e => setKrWeight(Number(e.target.value))}
                  disabled={!keyResultId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm disabled:bg-gray-100"
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <input
                  type="checkbox"
                  checked={autoApplyToKr}
                  onChange={e => setAutoApplyToKr(e.target.checked)}
                  disabled={!keyResultId}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                />
                <span className="text-xs font-medium text-gray-600">Appliquer automatiquement au KR via les tâches</span>
              </label>
            </div>
          </div>

          <EditableItemsList items={editableItems} onChange={setEditableItems} startsOn={startsOn} endsOn={endsOn} />
        </div>
        <div className="p-4 sm:p-5 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annuler</button>
          <button type="button" onClick={submit} disabled={!employeeId || editableItems.filter(item => item.title.trim()).length === 0 || saving} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Assigner
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignmentEditModal({
  assignment,
  onClose,
  onDone,
}: {
  assignment: ProgramInitiativeAssignment;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState(assignment.name);
  const [description, setDescription] = useState(assignment.description || '');
  const [startsOn, setStartsOn] = useState(assignment.starts_on || defaultDate());
  const [endsOn, setEndsOn] = useState(assignment.ends_on || defaultDate(3));
  const [krWeight, setKrWeight] = useState(assignment.kr_weight || 0);
  const [autoApplyToKr, setAutoApplyToKr] = useState(Boolean(assignment.auto_apply_to_kr));
  const [items, setItems] = useState<EditableProgramItem[]>(() => assignmentItemsToEditable(assignment.items || []));
  const [saving, setSaving] = useState(false);
  const hasKr = Boolean(assignment.key_result_id);

  const submit = async () => {
    const enabledItems = items.filter(item => item.title.trim());
    if (enabledItems.length === 0) return;
    setSaving(true);
    try {
      const result = await updateProgramInitiativeAssignment(assignment.id, {
        name,
        description,
        starts_on: startsOn,
        ends_on: endsOn,
        objective_id: assignment.objective_id,
        key_result_id: assignment.key_result_id,
        kr_weight: hasKr ? krWeight : null,
        auto_apply_to_kr: Boolean(hasKr && autoApplyToKr),
        items: enabledItems.map(item => ({
          id: item.id || null,
          title: item.title,
          description: item.description,
          frequency: item.frequency,
          priority: item.priority,
          due_date: item.dueDate || startsOn,
          repeat_until: item.repeatUntil || endsOn,
          is_enabled: item.isEnabled,
          objective_id: assignment.objective_id,
          key_result_id: assignment.key_result_id,
          weight_pct: item.weightPct || null,
        })),
      });
      onDone(`Programme mis à jour · ${result.created_tasks || 0} nouvelle(s) tâche(s) générée(s).`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-primary-600 font-medium">Programme actif</p>
            <h2 className="font-bold text-gray-900">Modifier le programme</h2>
            {assignment.employee && <p className="text-sm text-gray-500 mt-1">Assigné à {assignment.employee.name}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 sm:p-5 space-y-5">
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 sm:p-4">
            <p className="font-semibold text-sm flex items-center gap-2 text-primary-800 mb-3">
              <Pencil className="w-4 h-4 text-primary-600" />
              Informations du programme
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Titre du programme</span>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Description du programme</span>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm resize-none" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Début</span>
                <input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Jusqu'au</span>
                <input type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" />
              </label>
              {hasKr && (
                <>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-gray-600">Poids du programme dans le KR (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={krWeight}
                      onChange={e => setKrWeight(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={autoApplyToKr}
                      onChange={e => setAutoApplyToKr(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-xs font-medium text-gray-600">Appliquer automatiquement au KR via les tâches</span>
                  </label>
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="rounded-lg border border-primary-100 bg-white px-3 py-2">
                      <p className="text-[11px] text-gray-400">Progression pondérée</p>
                      <p className="text-sm font-semibold text-gray-900">{assignment.weighted_progress_pct ?? assignment.progress_pct}%</p>
                    </div>
                    <div className="rounded-lg border border-primary-100 bg-white px-3 py-2">
                      <p className="text-[11px] text-gray-400">Contribution estimée</p>
                      <p className="text-sm font-semibold text-gray-900">{assignment.estimated_kr_contribution_pct ?? 0}%</p>
                    </div>
                    <div className="rounded-lg border border-primary-100 bg-white px-3 py-2">
                      <p className="text-[11px] text-gray-400">Déjà appliqué</p>
                      <p className="text-sm font-semibold text-gray-900">{assignment.applied_kr_contribution ?? 0}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <EditableItemsList items={items} onChange={setItems} startsOn={startsOn} endsOn={endsOn} />
        </div>
        <div className="p-4 sm:p-5 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annuler</button>
          <button type="button" onClick={submit} disabled={items.filter(item => item.title.trim()).length === 0 || saving} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function MyProgrammesInitiativesPage() {
  const [assignments, setAssignments] = useState<ProgramInitiativeAssignment[]>([]);
  const [managedAssignments, setManagedAssignments] = useState<ProgramInitiativeAssignment[]>([]);
  const [programs, setPrograms] = useState<ProgramInitiative[]>([]);
  const [employees, setEmployees] = useState<HREmployeeItem[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<(ProgramInitiative & { items?: ProgramInitiativeItem[] }) | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<ProgramInitiativeAssignment | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'templates'>('active');
  const [canActivate, setCanActivate] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignmentData, managedData, employeeData, programData] = await Promise.all([
        getMyProgramInitiativeAssignments(),
        getManagedProgramInitiativeAssignments().catch(() => []),
        getProgramInitiativeEmployees().catch(() => []),
        getProgramInitiatives().catch(() => []),
      ]);
      setAssignments(assignmentData);
      setManagedAssignments(managedData);
      setEmployees(employeeData);
      setPrograms(programData);
      setCanActivate(employeeData.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des programmes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openActivate = async (program: ProgramInitiative) => {
    setActivatingId(program.id);
    try {
      setSelectedProgram(await getProgramInitiative(program.id));
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Programmes & Initiatives" subtitle="Suivez vos programmes actifs et activez des initiatives pour votre équipe." />

      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

        {message && <div className="mb-4 text-sm bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg px-4 py-2">{message}</div>}

        {canActivate && (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                    activeTab === 'active' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  Programmes actifs
                  {managedAssignments.length > 0 && (
                    <span className="ml-1 text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">{managedAssignments.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('templates')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
                    activeTab === 'templates' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Templates
                  {programs.length > 0 && (
                    <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{programs.length}</span>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="flex items-center justify-center w-9 h-9 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors disabled:opacity-60"
                title="Actualiser"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {activeTab === 'templates' ? (
              programs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                  <Sparkles className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="font-semibold text-gray-500">Aucun template disponible</p>
                  <p className="text-sm text-gray-400 mt-1">Les templates configurés apparaîtront ici.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {programs.map((program, index) => (
                    <ProgramTemplateCard
                      key={program.id}
                      program={program}
                      index={index}
                      onActivate={openActivate}
                      activating={activatingId === program.id}
                    />
                  ))}
                </div>
              )
            ) : (
              <div>
                {loading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                  </div>
                ) : managedAssignments.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <Flag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="font-semibold text-gray-500">Aucun programme actif</p>
                    <p className="text-sm text-gray-400 mt-1">Activez un template pour un collaborateur.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {managedAssignments.map((assignment) => (
                      <AssignmentCard key={assignment.id} assignment={assignment} onOpen={setSelectedAssignment} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!canActivate && loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : !canActivate && error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
        ) : !canActivate && assignments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
            <Flag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-500">Aucun programme actif</p>
            <p className="text-sm text-gray-400 mt-1">Les programmes activés par votre manager apparaîtront ici.</p>
          </div>
        ) : !canActivate ? (
          <div className="space-y-5">
            {assignments.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} />)}
          </div>
        ) : null}
      </div>
      {selectedProgram && (
        <ActivateModal
          program={selectedProgram}
          employees={employees}
          onClose={() => setSelectedProgram(null)}
          onDone={(msg) => { setSelectedProgram(null); setMessage(msg); setActiveTab('active'); load(); }}
        />
      )}
      {selectedAssignment && (
        <AssignmentEditModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          onDone={(msg) => { setSelectedAssignment(null); setMessage(msg); load(); }}
        />
      )}
    </div>
  );
}
