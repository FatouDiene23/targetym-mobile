'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Flag,
  Layers3,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Target,
  Trash2,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';

import Header from '@/components/Header';
import {
  assignProgramInitiative,
  getObjectivesForLinking,
  getProgramInitiative,
  getProgramInitiativeEmployees,
  getProgramInitiatives,
  getManagedProgramInitiativeAssignments,
  getMyProgramInitiativeAssignments,
  updateProgramInitiativeAssignment,
  type HREmployeeItem,
  type ObjectiveForLinking,
  type ProgramInitiative,
  type ProgramInitiativeItem,
  type ProgramInitiativeAssignment,
  type ProgramInitiativeAssignmentItem,
  type ProgramInitiativeFrequency,
} from '@/lib/api';
import CustomDatePicker from '@/components/CustomDatePicker';
import CustomSelect from '@/components/CustomSelect';

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

function AssignmentItemRow({ item }: { item: ProgramInitiativeAssignmentItem }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-snug">{item.title}</p>
          {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-line">{item.description}</p>}
        </div>
        <span className={`shrink-0 inline-flex border rounded-full px-2.5 py-1 text-xs font-medium ${FREQUENCY_STYLE[item.frequency] || FREQUENCY_STYLE.weekly}`}>
          {FREQUENCY_LABELS[item.frequency] || item.frequency}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          Début: {formatDate(item.due_date)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="w-3.5 h-3.5" />
          Jusqu'au: {formatDate(item.repeat_until)}
        </span>
        {item.kr_contribution != null && (
          <span className="inline-flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            Contribution KR: {item.kr_contribution}
          </span>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({
  assignment,
  onEdit,
}: {
  assignment: ProgramInitiativeAssignment;
  /** Fourni uniquement pour les programmes que l'utilisateur pilote en tant que manager. */
  onEdit?: (assignment: ProgramInitiativeAssignment) => void;
}) {
  const items = assignment.items || [];
  const frequencies = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.frequency] = (acc[item.frequency] || 0) + 1;
      return acc;
    }, {});
  }, [items]);

  return (
    <article className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="h-1.5 bg-primary-500" />
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                <Layers3 className="w-3.5 h-3.5" />
                {assignment.program_code || 'Programme'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {assignment.status === 'active' ? 'Actif' : assignment.status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{assignment.name}</h2>
            {assignment.manager && (
              <p className="mt-1 text-sm text-gray-500 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-primary-500" />
                Activé par {assignment.manager.name}
              </p>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(assignment)}
                className="mt-3 w-full min-[420px]:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-primary-200 bg-white text-xs font-medium text-primary-700 hover:bg-primary-50"
              >
                <Pencil className="w-3.5 h-3.5" />
                Modifier le programme
              </button>
            )}
          </div>
          <div className="w-full lg:w-56 shrink-0">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500">Progression tâches</span>
              <span className="font-semibold text-gray-900">{assignment.progress_pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${assignment.progress_pct}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {assignment.completed_tasks_count}/{assignment.tasks_count} tâches terminées
            </p>
          </div>
        </div>

        {(assignment.objective_title || assignment.key_result_title) && (
          <div className="mt-4 border border-primary-100 bg-primary-50 rounded-lg p-3">
            <div className="flex items-start gap-2 text-sm">
              <Target className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                {assignment.objective_title && <p className="font-medium text-primary-900 truncate">{assignment.objective_title}</p>}
                {assignment.key_result_title && <p className="text-primary-700 text-xs mt-0.5 truncate">KR: {assignment.key_result_title}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {(Object.entries(frequencies) as Array<[ProgramInitiativeFrequency, number]>).map(([frequency, count]) => (
            <div key={frequency} className={`border rounded-lg px-3 py-2 ${FREQUENCY_STYLE[frequency] || FREQUENCY_STYLE.weekly}`}>
              <p className="font-bold">{count}</p>
              <p className="text-xs">{FREQUENCY_LABELS[frequency] || frequency}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-sm text-gray-900">Actions planifiées</h3>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune action rattachée à ce programme.</p>
          ) : (
            items.map((item) => <AssignmentItemRow key={item.id} item={item} />)
          )}
        </div>
      </div>
    </article>
  );
}

function defaultDate(offsetMonths = 0) {
  const d = new Date();
  if (offsetMonths) d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
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
          Activer ce programme
        </button>
      </div>
    </article>
  );
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
                <span className="text-xs font-medium text-gray-600">Titre de l&apos;action</span>
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
                <CustomSelect
                  value={item.frequency}
                  onChange={v => updateItem(item.localId, { frequency: v as ProgramInitiativeFrequency })}
                  options={[
                    ...Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value: String(value), label: label })),
                  ]}
                  className="w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Priorité</span>
                <CustomSelect
                  value={item.priority}
                  onChange={v => updateItem(item.localId, { priority: v })}
                  options={[
                    { value: 'low', label: 'Basse' },
                    { value: 'medium', label: 'Moyenne' },
                    { value: 'high', label: 'Haute' },
                    { value: 'urgent', label: 'Urgente' },
                  ]}
                  className="w-full"
                />
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
                <CustomDatePicker value={item.dueDate} onChange={(v) => updateItem(item.localId, { dueDate: v })} className="w-full" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Répéter jusqu&apos;au</span>
                <CustomDatePicker value={item.repeatUntil} onChange={(v) => updateItem(item.localId, { repeatUntil: v })} className="w-full" />
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
  const [error, setError] = useState<string | null>(null);
  const hasKr = Boolean(assignment.key_result_id);

  const submit = async () => {
    const enabledItems = items.filter(item => item.title.trim());
    if (enabledItems.length === 0) return;
    setSaving(true);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour du programme.');
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
          {error && <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2">{error}</div>}
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
                <CustomDatePicker value={startsOn} onChange={(v) => setStartsOn(v)} className="w-full" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Jusqu&apos;au</span>
                <CustomDatePicker value={endsOn} onChange={(v) => setEndsOn(v)} className="w-full" />
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
  const [objectives, setObjectives] = useState<ObjectiveForLinking[]>([]);
  const [objectiveId, setObjectiveId] = useState<number | ''>('');
  const [keyResultId, setKeyResultId] = useState<number | ''>('');
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>((program.items || []).map(item => item.id));
  const [saving, setSaving] = useState(false);
  const selectedObjective = objectives.find(objective => objective.id === objectiveId);
  const items = program.items || [];

  useEffect(() => {
    if (!employeeId) {
      setObjectives([]);
      setObjectiveId('');
      setKeyResultId('');
      return;
    }
    getObjectivesForLinking(Number(employeeId)).then(setObjectives).catch(() => setObjectives([]));
  }, [employeeId]);

  const submit = async () => {
    if (!employeeId || selectedItemIds.length === 0) return;
    setSaving(true);
    try {
      const result = await assignProgramInitiative(program.id, {
        employee_id: Number(employeeId),
        selected_item_ids: selectedItemIds,
        frequency,
        objective_id: objectiveId || null,
        key_result_id: keyResultId || null,
        starts_on: startsOn,
        ends_on: endsOn,
      });
      onDone(`Programme activé · ${result.created_tasks || 0} tâche(s) générée(s).`);
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (itemId: number) => {
    setSelectedItemIds(current => current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-primary-600 font-medium">Activer</p>
            <h2 className="font-bold text-gray-900">{program.name}</h2>
            {program.objective && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{program.objective}</p>}
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
                <span className="text-xs font-medium text-gray-600">Collaborateur N-1</span>
                <CustomSelect
                  value={String(employeeId)}
                  onChange={v => setEmployeeId(v ? Number(v) : '')}
                  options={[
                    { value: '', label: 'Sélectionner' },
                    ...employees.map(employee => ({ value: String(employee.id), label: `${employee.name}${employee.job_title ? ` · ${employee.job_title}` : ''}` })),
                  ]}
                  className="w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Fréquence</span>
                <CustomSelect
                  value={frequency}
                  onChange={v => setFrequency(v as ProgramInitiativeFrequency)}
                  options={[
                    ...Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value: String(value), label: label })),
                  ]}
                  className="w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Objectif OKR</span>
                <CustomSelect
                  value={String(objectiveId)}
                  onChange={v => { setObjectiveId(v ? Number(v) : ''); setKeyResultId(''); }}
                  disabled={!employeeId}
                  options={[
                    { value: '', label: 'Aucun' },
                    ...objectives.map(objective => ({ value: String(objective.id), label: objective.title })),
                  ]}
                  className="w-full"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Début</span>
                <CustomDatePicker value={startsOn} onChange={(v) => setStartsOn(v)} className="w-full" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-gray-600">Jusqu'au</span>
                <CustomDatePicker value={endsOn} onChange={(v) => setEndsOn(v)} className="w-full" />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Key Result</span>
                <CustomSelect
                  value={String(keyResultId)}
                  onChange={v => setKeyResultId(v ? Number(v) : '')}
                  disabled={!selectedObjective?.key_results.length}
                  options={[
                    { value: '', label: 'Aucun' },
                    ...(selectedObjective?.key_results ?? []).map(kr => ({ value: String(kr.id), label: kr.title })),
                  ]}
                  className="w-full"
                />
              </label>
            </div>
          </div>

          <div>
            <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Actions à déverser en tâches</span>
              <button type="button" onClick={() => setSelectedItemIds(items.map(item => item.id))} className="text-xs text-primary-700 hover:text-primary-900 w-fit">
                Tout sélectionner
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {items.map(item => (
                <label key={item.id} className="flex items-start gap-2 bg-white rounded-lg border border-primary-100 px-3 py-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="mt-1 rounded border-gray-300 text-primary-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-gray-800 break-words">{item.title}</span>
                    <span className="ml-0 min-[420px]:ml-2 block min-[420px]:inline text-xs text-gray-400">{FREQUENCY_LABELS[item.frequency]}</span>
                    {item.description && <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-5 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 text-gray-600">Annuler</button>
          <button type="button" onClick={submit} disabled={!employeeId || selectedItemIds.length === 0 || saving} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white font-medium disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Activer
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <div>
      <Header title="Programmes & Initiatives" subtitle="Suivez vos programmes actifs et activez des initiatives pour votre équipe." />

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-5 flex justify-start sm:justify-end">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Actualiser
          </button>
        </div>

        {message && <div className="mb-4 text-sm bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg px-4 py-2">{message}</div>}

        {canActivate && (
          <div className="mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-white p-1 w-full sm:inline-flex sm:w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className={`px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-normal sm:whitespace-nowrap ${activeTab === 'active' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Programmes actifs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('templates')}
                  className={`px-2 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-normal sm:whitespace-nowrap ${activeTab === 'templates' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Templates
                </button>
              </div>
              <p className="text-sm text-gray-500 sm:text-right">
                {activeTab === 'active'
                  ? 'Les programmes que vous avez activés pour vos collaborateurs.'
                  : 'Choisissez un template et activez-le pour un N-1.'}
              </p>
            </div>

            {activeTab === 'templates' ? (
              programs.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg py-12 text-center">
                  <Layers3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold text-gray-900">Aucun template disponible</p>
                  <p className="text-sm text-gray-500 mt-1">Les templates configurés apparaîtront ici.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
                  <div className="bg-white border border-gray-200 rounded-lg py-16 text-center">
                    <Layers3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-semibold text-gray-900">Aucun programme actif</p>
                    <p className="text-sm text-gray-500 mt-1">Les templates que vous activerez pour vos collaborateurs apparaîtront ici.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {managedAssignments.map((assignment) => (
                      <AssignmentCard key={assignment.id} assignment={assignment} onEdit={setSelectedAssignment} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!canActivate && loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : !canActivate && error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
        ) : !canActivate && assignments.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-16 text-center">
            <Layers3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-900">Aucun programme actif</p>
            <p className="text-sm text-gray-500 mt-1">Les programmes activés par votre manager apparaîtront ici.</p>
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
