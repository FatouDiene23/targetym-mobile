'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Layers3,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';

import Header from '@/components/Header';
import { normalizeApiErrorMessage } from '@/lib/apiErrorMessages';
import {
  activateManagerialRitualTemplate,
  getObjectivesForLinking,
  getManagerialRitualAssignableEmployees,
  getManagerialRitualAssignment,
  getManagerialRitualAssignments,
  getManagerialRitualTemplate,
  getManagerialRitualTemplates,
  seedManagerialRitualTemplates,
  updateManagerialRitualAssignmentItem,
  updateManagerialRitualSectorVisibility,
  updateManagerialRitualTemplateVisibility,
  type ManagerialRitualAssignment,
  type ManagerialRitualAssignmentItem,
  type ManagerialRitualEmployee,
  type ManagerialRitualFrequency,
  type ManagerialRitualLevel,
  type ManagerialRitualTemplate,
  type ManagerialRitualTemplateDetail,
  type ManagerialRitualTemplateKind,
  type ManagerialRitualTemplateItem,
  type ObjectiveForLinking,
} from '@/lib/api';

type Tab = 'active' | 'ritual-templates' | 'checklist-templates';

function isRhAdminDgRole(role?: string) {
  return ['rh', 'admin', 'dg', 'super_admin'].includes((role || '').toLowerCase());
}

const LEVEL_LABELS: Record<ManagerialRitualLevel, string> = {
  director: 'Direction',
  department_head: 'Chef de département',
  employee: 'Collaborateur',
};

const KIND_LABELS: Record<ManagerialRitualTemplateKind, string> = {
  ritual: 'Rituel manager',
  checklist: 'Check-list collaborateur',
};

const FREQUENCY_LABELS: Record<ManagerialRitualFrequency, string> = {
  quarterly: 'Trimestriel',
  monthly: 'Mensuel',
  weekly: 'Hebdomadaire',
  daily: 'Quotidien',
};

const FREQUENCY_ORDER: ManagerialRitualFrequency[] = ['quarterly', 'monthly', 'weekly', 'daily'];

const FREQUENCY_STYLE: Record<ManagerialRitualFrequency, string> = {
  quarterly: 'bg-violet-50 text-violet-700 border-violet-100',
  monthly: 'bg-sky-50 text-sky-700 border-sky-100',
  weekly: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  daily: 'bg-amber-50 text-amber-700 border-amber-100',
};

function friendlyError(err: unknown) {
  const message = err instanceof Error ? err.message : '';
  return normalizeApiErrorMessage(message) || 'Erreur lors du chargement des rituels et check-lists.';
}

function WorkflowHelp({ tab }: { tab: Tab }) {
  const isActiveTab = tab === 'active';
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-900">
      <Layers3 className="w-5 h-5 shrink-0 mt-0.5 text-primary-600" />
      <div className="min-w-0">
        <p className="font-semibold">
          Parcours recommandé : publier le template, assigner un collaborateur, activer, puis modifier les actions.
        </p>
        <p className="mt-1 text-primary-700">
          {isActiveTab
            ? "La modification se fait uniquement depuis un rituel ou une check-list déjà activé(e). Ouvrez une activation pour ajuster les actions, dates, liens OKR/KR et notes."
            : "Un template non publié doit d'abord être rendu visible, puis activé pour un manager ou collaborateur avant de pouvoir personnaliser ses actions."}
        </p>
      </div>
    </div>
  );
}

function frequencyCount(template: ManagerialRitualTemplate, frequency: ManagerialRitualFrequency) {
  if (frequency === 'quarterly') return template.quarterly_count;
  if (frequency === 'monthly') return template.monthly_count;
  if (frequency === 'weekly') return template.weekly_count;
  return template.daily_count;
}

function defaultDueDate(frequency: ManagerialRitualFrequency) {
  const date = new Date();
  return date.toISOString().slice(0, 10);
}

function defaultRepeatUntil(frequency: ManagerialRitualFrequency) {
  const date = new Date();
  if (frequency === 'daily') date.setMonth(date.getMonth() + 1);
  if (frequency === 'weekly') date.setMonth(date.getMonth() + 3);
  if (frequency === 'monthly') date.setFullYear(date.getFullYear() + 1);
  if (frequency === 'quarterly') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function TemplateCard({
  template,
  canManageVisibility,
  onPreview,
  onActivate,
  onToggleVisibility,
}: {
  template: ManagerialRitualTemplate;
  canManageVisibility: boolean;
  onPreview: (id: number) => void;
  onActivate: (template: ManagerialRitualTemplate) => void;
  onToggleVisibility: (template: ManagerialRitualTemplate) => void;
}) {
  return (
    <article className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm hover:border-primary-200 transition-all">
      <div className="h-1.5 bg-primary-500" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                <Building2 className="w-3 h-3" />
                {LEVEL_LABELS[template.level]}
              </span>
              {template.sector && <span className="truncate">{template.sector}</span>}
            </div>
            {canManageVisibility && (
              <span className={`inline-flex mt-3 px-2 py-0.5 rounded-full text-xs font-medium ${template.is_visible_to_managers ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {template.is_visible_to_managers ? 'Visible tenant' : 'Non publié'}
              </span>
            )}
            <span className="inline-flex mt-3 ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
              {KIND_LABELS[template.template_kind || 'ritual']}
            </span>
            <h3 className="mt-3 text-base font-bold text-gray-900 leading-snug line-clamp-2">{template.target_role}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <Layers3 className="w-5 h-5" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          {FREQUENCY_ORDER.map((frequency) => (
            <div key={frequency} className={`border rounded-md px-2 py-1.5 ${FREQUENCY_STYLE[frequency]}`}>
              <p className="text-sm font-bold">{frequencyCount(template, frequency)}</p>
              <p className="text-[11px] truncate">{FREQUENCY_LABELS[frequency]}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-gray-100 flex-wrap">
          <button
            type="button"
            onClick={() => onPreview(template.id)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Eye className="w-4 h-4" />
            Voir
          </button>
          {canManageVisibility && (
            <button
              type="button"
              onClick={() => onToggleVisibility(template)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {template.is_visible_to_managers ? 'Masquer' : 'Publier'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onActivate(template)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600"
          >
            <Play className="w-4 h-4" />
            Activer
          </button>
        </div>
      </div>
    </article>
  );
}

function TemplatePreview({
  detail,
  loading,
  canManageVisibility,
  onClose,
  onActivate,
  onToggleVisibility,
}: {
  detail: ManagerialRitualTemplateDetail | null;
  loading: boolean;
  canManageVisibility: boolean;
  onClose: () => void;
  onActivate: (template: ManagerialRitualTemplateDetail) => void;
  onToggleVisibility: (template: ManagerialRitualTemplateDetail) => void;
}) {
  const grouped = useMemo(() => {
    const result: Record<ManagerialRitualFrequency, ManagerialRitualTemplateItem[]> = {
      quarterly: [],
      monthly: [],
      weekly: [],
      daily: [],
    };
    detail?.items.forEach((item) => result[item.frequency].push(item));
    return result;
  }, [detail]);

  if (!detail && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <aside className="w-full max-w-3xl bg-white h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-start justify-between gap-4 z-10">
          <div>
            <p className="text-sm text-gray-500">Template</p>
            <h2 className="text-xl font-bold text-gray-900">{detail?.target_role || 'Chargement...'}</h2>
            {detail?.authority_line && <p className="text-sm text-gray-500 mt-1">{detail.authority_line}</p>}
            {detail && canManageVisibility && (
              <span className={`inline-flex mt-3 px-2 py-0.5 rounded-full text-xs font-medium ${detail.is_visible_to_managers ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {detail.is_visible_to_managers ? 'Visible tenant' : 'Non publié'}
              </span>
            )}
            {detail && (
              <span className="inline-flex mt-3 ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                {KIND_LABELS[detail.template_kind || 'ritual']}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {detail && canManageVisibility && (
              <button
                type="button"
                onClick={() => onToggleVisibility(detail)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
              >
                {detail.is_visible_to_managers ? 'Masquer' : 'Publier'}
              </button>
            )}
            {detail && (
              <button
                type="button"
                onClick={() => onActivate(detail)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600"
              >
                <Play className="w-4 h-4" />
                Activer
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {FREQUENCY_ORDER.map((frequency) => (
              grouped[frequency].length > 0 && (
                <section key={frequency} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock3 className="w-4 h-4 text-gray-400" />
                    <h3 className="font-semibold text-gray-900">{FREQUENCY_LABELS[frequency]}</h3>
                    <span className="text-xs text-gray-400">{grouped[frequency].length} actions</span>
                  </div>
                  <div className="space-y-3">
                    {grouped[frequency].map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900">{item.title}</h4>
                        {item.objective && <p className="text-sm text-gray-600 mt-1">{item.objective}</p>}
                        {item.agenda_items.length > 0 && (
                          <p className="text-sm text-gray-500 mt-3 line-clamp-2">{item.agenda_items.join(' · ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function ActivateModal({
  template,
  employees,
  loading,
  onClose,
  onActivate,
}: {
  template: ManagerialRitualTemplateDetail | null;
  employees: ManagerialRitualEmployee[];
  loading: boolean;
  onClose: () => void;
  onActivate: (payload: {
    employeeIds: number[];
    selectedIds: number[];
    itemLinks: Array<{
      template_item_id: number;
      objective_id?: number;
      key_result_id?: number;
      kr_contribution?: number;
      due_date?: string;
      repeat_until?: string;
    }>;
  }) => Promise<void>;
}) {
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveForLinking[]>([]);
  const [okrLoading, setOkrLoading] = useState(false);
  const [itemLinks, setItemLinks] = useState<Record<number, { objectiveId: string; keyResultId: string; krContribution: string; dueDate: string; repeatUntil: string }>>({});

  useEffect(() => {
    if (template) {
      setSelectedIds(template.items.map((item) => item.id));
      setSelectedEmployeeIds([]);
      setEmployeeSearch('');
      setObjectives([]);
      setItemLinks({});
    }
  }, [template]);

  useEffect(() => {
    if (selectedEmployeeIds.length !== 1) {
      setObjectives([]);
      setItemLinks({});
      return;
    }
    setOkrLoading(true);
    setItemLinks({});
    getObjectivesForLinking(selectedEmployeeIds[0])
      .then(setObjectives)
      .catch(() => setObjectives([]))
      .finally(() => setOkrLoading(false));
  }, [selectedEmployeeIds]);

  if (!template) return null;

  const selectedItems = template.items.filter((item) => selectedIds.includes(item.id));
  const selectedEmployees = employees.filter((employee) => selectedEmployeeIds.includes(employee.id));
  const filteredEmployees = employees.filter((employee) => {
    const normalized = employeeSearch.trim().toLowerCase();
    if (!normalized) return true;
    return [employee.name, employee.job_title || ''].some((value) => value.toLowerCase().includes(normalized));
  });

  const updateItemLink = (
    itemId: number,
    patch: Partial<{ objectiveId: string; keyResultId: string; krContribution: string; dueDate: string; repeatUntil: string }>
  ) => {
    setItemLinks((current) => {
      const item = template.items.find((entry) => entry.id === itemId);
      const next = {
        ...(current[itemId] || {
          objectiveId: '',
          keyResultId: '',
          krContribution: '',
          dueDate: item ? defaultDueDate(item.frequency) : '',
          repeatUntil: item ? defaultRepeatUntil(item.frequency) : '',
        }),
        ...patch,
      };
      if (patch.objectiveId !== undefined) {
        next.keyResultId = '';
        next.krContribution = '';
      }
      return { ...current, [itemId]: next };
    });
  };

  const toggleFrequency = (frequency: ManagerialRitualFrequency) => {
    const ids = template.items.filter((item) => item.frequency === frequency).map((item) => item.id);
    const allSelected = ids.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => allSelected ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids])));
  };

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployeeIds((current) => (
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    ));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-4 shrink-0">
          <div>
            <p className="text-sm text-primary-600 font-medium">Activer un modèle</p>
            <h2 className="text-xl font-bold text-gray-900">{template.target_role}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-sm font-medium text-gray-700">Collaborateurs</label>
              <span className="text-xs text-gray-500">{selectedEmployeeIds.length} sélectionné{selectedEmployeeIds.length > 1 ? 's' : ''}</span>
            </div>
            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Rechercher un collaborateur"
                  className="flex-1 outline-none text-sm"
                />
                {selectedEmployeeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployeeIds([]);
                      setEmployeeSearch('');
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Effacer
                  </button>
                )}
              </div>
              {selectedEmployees.length > 0 && (
                <div className="px-3 py-2 bg-primary-50 text-primary-700 text-sm font-medium">
                  {selectedEmployees.slice(0, 3).map((employee) => employee.name).join(', ')}
                  {selectedEmployees.length > 3 ? ` +${selectedEmployees.length - 3}` : ''}
                </div>
              )}
              <div className="max-h-56 overflow-y-auto">
                {filteredEmployees.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-500">Aucun collaborateur trouvé</p>
                ) : (
                  filteredEmployees.map((employee) => {
                    const checked = selectedEmployeeIds.includes(employee.id);
                    return (
                      <label
                        key={employee.id}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-3 cursor-pointer ${checked ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEmployee(employee.id)}
                          className="rounded border-gray-300 text-primary-600"
                        />
                        <span className="min-w-0">
                          <span className="font-medium">{employee.name}</span>
                          {employee.job_title && <span className="text-gray-500"> · {employee.job_title}</span>}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-medium text-gray-700">Actions à activer</p>
              <span className="text-sm text-gray-500">{selectedIds.length}/{template.items.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FREQUENCY_ORDER.map((frequency) => {
                const count = template.items.filter((item) => item.frequency === frequency).length;
                const active = template.items.filter((item) => item.frequency === frequency).every((item) => selectedIds.includes(item.id));
                return (
                  <button
                    key={frequency}
                    type="button"
                    onClick={() => toggleFrequency(frequency)}
                    className={`border rounded-lg px-3 py-2 text-left ${active ? FREQUENCY_STYLE[frequency] : 'bg-white text-gray-500 border-gray-200'}`}
                  >
                    <p className="text-sm font-bold">{count}</p>
                    <p className="text-xs">{FREQUENCY_LABELS[frequency]}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Planification et OKR par action</p>
                <p className="text-xs text-gray-500">Les liens OKR sont disponibles quand un seul collaborateur est sélectionné. À plusieurs, les actions seront activées sans lien OKR.</p>
              </div>
              {okrLoading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
            </div>
            {selectedEmployeeIds.length === 0 ? (
              <p className="text-sm text-gray-500">Sélectionnez un collaborateur pour charger ses OKR éligibles.</p>
            ) : selectedEmployeeIds.length > 1 ? (
              <p className="text-sm text-amber-700">Plusieurs collaborateurs sélectionnés : la planification sera appliquée à tous, sans lien OKR/KR individualisé.</p>
            ) : (
              <div className="space-y-3">
                {!okrLoading && objectives.length === 0 && (
                  <p className="text-sm text-amber-700">Aucun objectif individuel aligné au N+1 n'est disponible pour ce collaborateur. Les actions seront planifiées sans lien OKR.</p>
                )}
                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                  {selectedItems.map((item) => {
                    const link = itemLinks[item.id] || {
                      objectiveId: '',
                      keyResultId: '',
                      krContribution: '',
                      dueDate: defaultDueDate(item.frequency),
                      repeatUntil: defaultRepeatUntil(item.frequency),
                    };
                    const selectedObjective = objectives.find((objective) => String(objective.id) === link.objectiveId);
                    return (
                      <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm font-medium text-gray-900">{item.title}</p>
                          <span className="text-xs text-gray-500 shrink-0">{FREQUENCY_LABELS[item.frequency]}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                          <label className="space-y-1">
                            <span className="text-[11px] text-gray-500">Début</span>
                            <input
                              type="date"
                              value={link.dueDate}
                              onChange={(e) => updateItemLink(item.id, { dueDate: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] text-gray-500">Jusqu'au</span>
                            <input
                              type="date"
                              value={link.repeatUntil}
                              onChange={(e) => updateItemLink(item.id, { repeatUntil: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
                            />
                          </label>
                          <select
                            value={link.objectiveId}
                            onChange={(e) => updateItemLink(item.id, { objectiveId: e.target.value })}
                            disabled={objectives.length === 0}
                            className="sm:col-span-2 border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm disabled:bg-gray-100"
                          >
                            <option value="">Aucun objectif lié</option>
                            {objectives.map((objective) => (
                              <option key={objective.id} value={objective.id}>{objective.title}</option>
                            ))}
                          </select>
                          <select
                            value={link.keyResultId}
                            onChange={(e) => updateItemLink(item.id, { keyResultId: e.target.value })}
                            disabled={!link.objectiveId || !selectedObjective?.key_results.length}
                            className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm disabled:bg-gray-100"
                          >
                            <option value="">Aucun KR</option>
                            {selectedObjective?.key_results.map((kr) => (
                              <option key={kr.id} value={kr.id}>{kr.title}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={link.krContribution}
                            onChange={(e) => updateItemLink(item.id, { krContribution: e.target.value })}
                            placeholder="Contribution"
                            disabled={!link.keyResultId}
                            className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 p-5 border-t border-gray-200 flex flex-col gap-3 bg-white shrink-0 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            {selectedEmployeeIds.length} collaborateur{selectedEmployeeIds.length > 1 ? 's' : ''} · {selectedIds.length} action{selectedIds.length > 1 ? 's' : ''}
          </p>
          <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button
            type="button"
            disabled={loading || selectedEmployeeIds.length === 0 || selectedIds.length === 0}
            onClick={() => onActivate({
              employeeIds: selectedEmployeeIds,
              selectedIds,
              itemLinks: selectedEmployeeIds.length === 1 ? selectedItems
                .map((item) => ({ item, link: itemLinks[item.id] }))
                .map(({ item, link }) => ({
                  template_item_id: item.id,
                  objective_id: link?.objectiveId ? Number(link.objectiveId) : undefined,
                  key_result_id: link?.keyResultId ? Number(link.keyResultId) : undefined,
                  kr_contribution: link?.keyResultId && link?.krContribution ? Number(link.krContribution) : undefined,
                  due_date: link?.dueDate || defaultDueDate(item.frequency),
                  repeat_until: link?.repeatUntil || defaultRepeatUntil(item.frequency),
                })) : selectedItems.map((item) => ({
                  template_item_id: item.id,
                  due_date: defaultDueDate(item.frequency),
                  repeat_until: defaultRepeatUntil(item.frequency),
                })),
            })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Activer
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentEditModal({
  assignment,
  loading,
  readOnly = false,
  onClose,
  onSaveItem,
}: {
  assignment: ManagerialRitualAssignment | null;
  loading: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onSaveItem: (item: ManagerialRitualAssignmentItem, data: Partial<ManagerialRitualAssignmentItem>) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<number, Partial<ManagerialRitualAssignmentItem>>>({});
  const [objectives, setObjectives] = useState<ObjectiveForLinking[]>([]);
  const [okrLoading, setOkrLoading] = useState(false);

  useEffect(() => {
    setDrafts({});
    setObjectives([]);
    if (!assignment?.employee_id) return;
    setOkrLoading(true);
    getObjectivesForLinking(assignment.employee_id)
      .then(setObjectives)
      .catch(() => setObjectives([]))
      .finally(() => setOkrLoading(false));
  }, [assignment?.id, assignment?.employee_id]);

  if (!assignment) return null;

  const items = assignment.items || [];
  const updateDraft = (itemId: number, data: Partial<ManagerialRitualAssignmentItem>) => {
    setDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], ...data } }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <aside className="w-full max-w-4xl bg-white h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-start justify-between gap-4 z-10">
          <div>
            <p className="text-sm text-primary-600 font-medium">{readOnly ? 'Consulter les actions activées' : 'Modifier les actions activées'}</p>
            <h2 className="text-xl font-bold text-gray-900">{assignment.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{assignment.employee?.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
        ) : (
          <div className="p-5 space-y-4">
            {items.map((item) => {
              const draft = drafts[item.id] || {};
              const title = draft.title ?? item.title;
              const objective = draft.objective ?? item.objective ?? '';
              const notes = draft.notes ?? item.notes ?? '';
              const isEnabled = draft.is_enabled ?? item.is_enabled;
              const objectiveId = draft.objective_id ?? item.objective_id ?? null;
              const keyResultId = draft.key_result_id ?? item.key_result_id ?? null;
              const krContribution = draft.kr_contribution ?? item.kr_contribution ?? '';
              const selectedObjective = objectives.find((obj) => obj.id === objectiveId);
              const dirty = Object.keys(draft).length > 0;
              return (
                <div key={item.id} className={`border rounded-lg p-4 ${isEnabled ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`inline-flex border rounded-full px-2 py-0.5 text-xs font-medium ${FREQUENCY_STYLE[item.frequency]}`}>
                      {FREQUENCY_LABELS[item.frequency]}
                    </span>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={Boolean(isEnabled)}
                        onChange={(e) => updateDraft(item.id, { is_enabled: e.target.checked })}
                        disabled={readOnly}
                      />
                      Actif
                    </label>
                  </div>
                  <input
                    value={title}
                    onChange={(e) => updateDraft(item.id, { title: e.target.value })}
                    readOnly={readOnly}
                    className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 font-semibold text-gray-900"
                  />
                  <textarea
                    value={objective}
                    onChange={(e) => updateDraft(item.id, { objective: e.target.value })}
                    readOnly={readOnly}
                    className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-20"
                    placeholder="Objectif du rituel"
                  />
                  <textarea
                    value={notes}
                    onChange={(e) => updateDraft(item.id, { notes: e.target.value })}
                    readOnly={readOnly}
                    className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-16"
                    placeholder="Notes internes"
                  />
                  <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Lien OKR / KR</p>
                        <p className="text-xs text-gray-500">Seuls les objectifs individuels alignés au N+1 sont proposés.</p>
                      </div>
                      {okrLoading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
                    </div>
                    <div className="mb-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${objectiveId ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                        {objectiveId ? 'Liée OKR' : 'Sans OKR'}
                      </span>
                    </div>
                    {objectives.length === 0 && !okrLoading ? (
                      <p className="text-sm text-amber-700">Aucun objectif individuel aligné au N+1 disponible.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <select
                          value={objectiveId ?? ''}
                          onChange={(e) => updateDraft(item.id, {
                            objective_id: e.target.value ? Number(e.target.value) : null,
                            key_result_id: null,
                            kr_contribution: null,
                          })}
                          disabled={readOnly}
                          className="md:col-span-2 border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm disabled:bg-gray-100"
                        >
                          <option value="">Aucun objectif lié</option>
                          {objectives.map((obj) => (
                            <option key={obj.id} value={obj.id}>{obj.title}</option>
                          ))}
                        </select>
                        <select
                          value={keyResultId ?? ''}
                          onChange={(e) => updateDraft(item.id, {
                            key_result_id: e.target.value ? Number(e.target.value) : null,
                            kr_contribution: e.target.value ? (typeof krContribution === 'number' ? krContribution : null) : null,
                          })}
                          disabled={readOnly || !objectiveId || !selectedObjective?.key_results.length}
                          className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm disabled:bg-gray-100"
                        >
                          <option value="">Aucun KR</option>
                          {selectedObjective?.key_results.map((kr) => (
                            <option key={kr.id} value={kr.id}>{kr.title}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={krContribution ?? ''}
                          onChange={(e) => updateDraft(item.id, { kr_contribution: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="Contribution"
                          disabled={readOnly || !keyResultId}
                          className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm disabled:bg-gray-100"
                        />
                      </div>
                    )}
                  </div>
                  {!readOnly && (
                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      disabled={!dirty}
                      onClick={() => onSaveItem(item, draft)}
                      className="px-3 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}

function ActiveAssignmentCard({
  assignment,
  canEdit,
  onOpen,
}: {
  assignment: ManagerialRitualAssignment;
  canEdit: boolean;
  onOpen: (assignment: ManagerialRitualAssignment) => void;
}) {
  return (
    <article className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CheckCircle2 className="w-3 h-3" />
              Activé
            </span>
            <span>{LEVEL_LABELS[assignment.level]}</span>
          </div>
          <h3 className="font-bold text-gray-900 mt-3">{assignment.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {assignment.employee?.name || 'Collaborateur'}{assignment.employee?.job_title ? ` · ${assignment.employee.job_title}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-gray-900">{assignment.items_count}</p>
          <p className="text-xs text-gray-500">actions</p>
        </div>
      </div>
      <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end">
        <button
          type="button"
          onClick={() => onOpen(assignment)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
        >
          {canEdit ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {canEdit ? 'Modifier' : 'Voir'}
        </button>
      </div>
    </article>
  );
}

export default function ManagerialRitualsPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [templates, setTemplates] = useState<ManagerialRitualTemplate[]>([]);
  const [assignments, setAssignments] = useState<ManagerialRitualAssignment[]>([]);
  const [employees, setEmployees] = useState<ManagerialRitualEmployee[]>([]);
  const [preview, setPreview] = useState<ManagerialRitualTemplateDetail | null>(null);
  const [activateTarget, setActivateTarget] = useState<ManagerialRitualTemplateDetail | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<ManagerialRitualAssignment | null>(null);
  const [level, setLevel] = useState<ManagerialRitualLevel | 'all'>('all');
  const [sector, setSector] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPrivileged, setIsPrivileged] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number | null>(null);
  const [canActivateRituals, setCanActivateRituals] = useState(false);
  const [canActivateChecklists, setCanActivateChecklists] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateData, assignmentData, ritualAssignable, checklistAssignable] = await Promise.all([
        getManagerialRitualTemplates(),
        getManagerialRitualAssignments(),
        getManagerialRitualAssignableEmployees('ritual').catch(() => []),
        getManagerialRitualAssignableEmployees('checklist').catch(() => []),
      ]);
      setTemplates(templateData);
      setAssignments(assignmentData);
      setCanActivateRituals(ritualAssignable.length > 0);
      setCanActivateChecklists(checklistAssignable.length > 0);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setIsPrivileged(isRhAdminDgRole(user.role));
      setCurrentEmployeeId(user.employee_id || null);
    } catch {
      setIsPrivileged(false);
      setCurrentEmployeeId(null);
    }
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab === 'ritual-templates' && !canActivateRituals) setTab('active');
    if (tab === 'checklist-templates' && !canActivateChecklists) setTab('active');
  }, [canActivateChecklists, canActivateRituals, tab]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const sectors = useMemo(() => {
    return Array.from(new Set(templates.map((template) => template.sector).filter(Boolean) as string[])).sort();
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const tabKind: ManagerialRitualTemplateKind = tab === 'checklist-templates' ? 'checklist' : 'ritual';
    return templates.filter((template) => {
      if (tab !== 'ritual-templates' && tab !== 'checklist-templates') return false;
      if (level !== 'all' && template.level !== level) return false;
      if ((template.template_kind || 'ritual') !== tabKind) return false;
      if (sector !== 'all' && template.sector !== sector) return false;
      if (!normalized) return true;
      return [template.target_role, template.sector, template.template_code].some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [level, query, sector, tab, templates]);

  const stats = useMemo(() => ({
    active: assignments.length,
    collaborators: new Set(assignments.map((assignment) => assignment.employee_id)).size,
    managers: new Set(assignments.map((assignment) => assignment.manager_id).filter(Boolean)).size,
    rituals: assignments.reduce((sum, assignment) => sum + assignment.items_count, 0),
  }), [assignments]);

  const canEditAssignment = useCallback((assignment: ManagerialRitualAssignment) => (
    isPrivileged || (!!currentEmployeeId && assignment.manager_id === currentEmployeeId)
  ), [currentEmployeeId, isPrivileged]);

  const openPreview = async (id: number) => {
    setPreviewLoading(true);
    setError(null);
    try {
      setPreview(await getManagerialRitualTemplate(id));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const openActivate = async (template: ManagerialRitualTemplate) => {
    setPreviewLoading(true);
    setError(null);
    try {
      const detail = await getManagerialRitualTemplate(template.id);
      const assignableEmployees = await getManagerialRitualAssignableEmployees(detail.template_kind || 'ritual');
      setEmployees(assignableEmployees);
      setActivateTarget(detail);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const openActivateFromPreview = async (template: ManagerialRitualTemplateDetail) => {
    setPreviewLoading(true);
    setError(null);
    try {
      const assignableEmployees = await getManagerialRitualAssignableEmployees(template.template_kind || 'ritual');
      setEmployees(assignableEmployees);
      setPreview(null);
      setActivateTarget(template);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleActivate = async (payload: {
    employeeIds: number[];
    selectedIds: number[];
    itemLinks: Array<{
      template_item_id: number;
      objective_id?: number;
      key_result_id?: number;
      kr_contribution?: number;
      due_date?: string;
      repeat_until?: string;
    }>;
  }) => {
    if (!activateTarget) return;
    setActivating(true);
    setError(null);
    setMessage(null);
    try {
      await Promise.all(payload.employeeIds.map((employeeId) => (
        activateManagerialRitualTemplate(activateTarget.id, {
          employee_id: employeeId,
          selected_item_ids: payload.selectedIds,
          item_links: payload.itemLinks,
        })
      )));
      setMessage(
        payload.employeeIds.length > 1
          ? `Template activé pour ${payload.employeeIds.length} collaborateurs.`
          : 'Template activé pour le collaborateur.'
      );
      setActivateTarget(null);
      setTab('active');
      await loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setActivating(false);
    }
  };

  const handleToggleTemplateVisibility = async (template: ManagerialRitualTemplate) => {
    setError(null);
    setMessage(null);
    try {
      await updateManagerialRitualTemplateVisibility(template.id, !template.is_visible_to_managers);
      setMessage(template.is_visible_to_managers ? 'Template masqué aux managers.' : 'Template visible pour les managers.');
      await loadAll();
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const handleTogglePreviewVisibility = async (template: ManagerialRitualTemplateDetail) => {
    await handleToggleTemplateVisibility(template);
    try {
      setPreview(await getManagerialRitualTemplate(template.id));
    } catch {
      setPreview(null);
    }
  };

  const handleToggleSectorVisibility = async (visible: boolean) => {
    if (sector === 'all') return;
    setError(null);
    setMessage(null);
    try {
      const result = await updateManagerialRitualSectorVisibility(sector, visible);
      setMessage(`${result.updated} modèles du secteur ${sector} ${visible ? 'rendus visibles' : 'masqués'}.`);
      await loadAll();
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const openAssignmentEdit = async (assignment: ManagerialRitualAssignment) => {
    setAssignmentLoading(true);
    setError(null);
    try {
      setAssignmentDetail(await getManagerialRitualAssignment(assignment.id));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleSaveAssignmentItem = async (
    item: ManagerialRitualAssignmentItem,
    data: Partial<ManagerialRitualAssignmentItem>
  ) => {
    setError(null);
    try {
      await updateManagerialRitualAssignmentItem(item.id, data);
      if (assignmentDetail) {
        setAssignmentDetail(await getManagerialRitualAssignment(assignmentDetail.id));
      }
      await loadAll();
      setMessage('Rituel mis à jour.');
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    setMessage(null);
    try {
      const result = await seedManagerialRitualTemplates();
      setMessage(`${result.created} modèles chargés, ${result.skipped} déjà présents.`);
      await loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <Header title="Rituels et check-lists" subtitle="Modèles par secteur, activation par le N+1 et génération automatique des tâches" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between"><p className="text-sm text-gray-500">Activations actives</p><CheckCircle2 className="w-5 h-5 text-gray-400" /></div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.active}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between"><p className="text-sm text-gray-500">Managers / collaborateurs concernés</p><Users className="w-5 h-5 text-gray-400" /></div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.collaborators}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between"><p className="text-sm text-gray-500">N+1 pilotes</p><Building2 className="w-5 h-5 text-gray-400" /></div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.managers}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between"><p className="text-sm text-gray-500">Actions planifiées</p><CalendarDays className="w-5 h-5 text-gray-400" /></div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.rituals}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button type="button" onClick={() => setTab('active')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${tab === 'active' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <CheckCircle2 className="w-4 h-4" />
              Rituels et check-lists actifs
            </button>
            {canActivateRituals && (
            <button type="button" onClick={() => setTab('ritual-templates')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${tab === 'ritual-templates' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <Sparkles className="w-4 h-4" />
              Templates rituels
            </button>
            )}
            {canActivateChecklists && (
            <button type="button" onClick={() => setTab('checklist-templates')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${tab === 'checklist-templates' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <Sparkles className="w-4 h-4" />
              Templates check-lists
            </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={loadAll} disabled={loading} className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50" title="Actualiser">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {isPrivileged && templates.length === 0 && (
              <button type="button" onClick={handleSeed} disabled={seeding} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Charger modèles
              </button>
            )}
          </div>
        </div>

        {message && <div className="text-sm px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700">{message}</div>}
        {error && <div className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-red-50 text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

        <WorkflowHelp tab={tab} />

        {(tab === 'ritual-templates' || tab === 'checklist-templates') && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un secteur, rôle ou modèle"
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <select value={level} onChange={(e) => setLevel(e.target.value as ManagerialRitualLevel | 'all')} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="all">Tous les niveaux</option>
                <option value="director">Direction</option>
                <option value="department_head">Chef de département</option>
                <option value="employee">Collaborateur</option>
              </select>
              <select value={sector} onChange={(e) => setSector(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="all">Tous les secteurs</option>
                {sectors.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {isPrivileged && sector !== 'all' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSectorVisibility(true)}
                    className="px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 text-sm hover:bg-emerald-50"
                  >
                    Rendre visible le secteur
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSectorVisibility(false)}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
                  >
                    Masquer le secteur
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
            ) : filteredTemplates.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-lg text-center py-20">
                <Sparkles className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="font-semibold text-gray-500">
                  {tab === 'ritual-templates' ? 'Aucun template rituel disponible' : 'Aucun template check-list disponible'}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {isPrivileged ? 'Chargez un secteur de modèles puis rendez-le visible au tenant.' : 'Aucun modèle publié pour votre périmètre.'}
                </p>
                {isPrivileged && (
                  <button type="button" onClick={handleSeed} disabled={seeding} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
                    {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Charger les modèles
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    canManageVisibility={isPrivileged}
                    onPreview={openPreview}
                    onActivate={openActivate}
                    onToggleVisibility={handleToggleTemplateVisibility}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'active' && (
          loading ? (
            <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
          ) : assignments.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-lg text-center py-20">
              <Target className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="font-semibold text-gray-500">Aucun rituel ou check-list activé</p>
              <p className="text-sm text-gray-400 mt-1">
                {canActivateRituals || canActivateChecklists
                  ? 'Activez un modèle pour un manager ou un collaborateur.'
                  : "Aucun rituel ou check-list ne vous a encore été activé."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {assignments.map((assignment) => (
                <ActiveAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  canEdit={canEditAssignment(assignment)}
                  onOpen={openAssignmentEdit}
                />
              ))}
            </div>
          )
        )}
      </div>

      <TemplatePreview
        detail={preview}
        loading={previewLoading && !activateTarget}
        canManageVisibility={isPrivileged}
        onClose={() => setPreview(null)}
        onActivate={openActivateFromPreview}
        onToggleVisibility={handleTogglePreviewVisibility}
      />
      <ActivateModal
        template={activateTarget}
        employees={employees}
        loading={activating}
        onClose={() => setActivateTarget(null)}
        onActivate={handleActivate}
      />
      <AssignmentEditModal
        assignment={assignmentDetail}
        loading={assignmentLoading}
        readOnly={assignmentDetail ? !canEditAssignment(assignmentDetail) : false}
        onClose={() => setAssignmentDetail(null)}
        onSaveItem={handleSaveAssignmentItem}
      />
    </>
  );
}
