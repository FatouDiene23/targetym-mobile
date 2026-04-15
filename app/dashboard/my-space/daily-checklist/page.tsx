'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare, Square, Plus, Trash2, Edit2, Loader2,
  Target, ChevronDown, ChevronUp, X, Check, Users, ListChecks,
  AlertCircle, Calendar, TrendingUp
} from 'lucide-react';
import {
  getTodayChecklist, getTeamChecklistMembers, getEmployeeChecklist,
  createChecklistItem, updateChecklistItem, deleteChecklistItem,
  getObjectivesForLinking, completeTask, startTask,
  type DailyChecklistToday, type ChecklistTodayItem, type ChecklistItem,
  type ChecklistTeamMember, type ChecklistItemCreate, type TaskPriority,
  type DayOfWeek, type ObjectiveForLinking,
} from '@/lib/api';
import Header from '@/components/Header';
import { useI18n } from '@/lib/i18n/I18nContext';

// ============================================
// CONSTANTS
// ============================================

const PRIORITY_COLORS_CL: Record<TaskPriority, { bg: string; text: string }> = {
  low:    { bg: 'bg-gray-100',   text: 'text-gray-600' },
  medium: { bg: 'bg-blue-100',   text: 'text-blue-600' },
  high:   { bg: 'bg-orange-100', text: 'text-orange-600' },
  urgent: { bg: 'bg-red-100',    text: 'text-red-600' },
};

function getPriorityStylesCL(t: ReturnType<typeof useI18n>['t']): Record<TaskPriority, { bg: string; text: string; label: string }> {
  return {
    low:    { ...PRIORITY_COLORS_CL.low, label: t.mySpace.dailyChecklist.priorityLow },
    medium: { ...PRIORITY_COLORS_CL.medium, label: t.mySpace.dailyChecklist.priorityMedium },
    high:   { ...PRIORITY_COLORS_CL.high, label: t.mySpace.dailyChecklist.priorityHigh },
    urgent: { ...PRIORITY_COLORS_CL.urgent, label: t.mySpace.dailyChecklist.priorityUrgent },
  };
}

function getDayLabels(t: ReturnType<typeof useI18n>['t']): Record<DayOfWeek, string> {
  return {
    monday: t.mySpace.dailyChecklist.mondayShort,
    tuesday: t.mySpace.dailyChecklist.tuesdayShort,
    wednesday: t.mySpace.dailyChecklist.wednesdayShort,
    thursday: t.mySpace.dailyChecklist.thursdayShort,
    friday: t.mySpace.dailyChecklist.fridayShort,
    saturday: t.mySpace.dailyChecklist.saturdayShort,
    sunday: t.mySpace.dailyChecklist.sundayShort,
  };
}

const ALL_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ============================================
// HELPERS
// ============================================

function getUser(): { role: string; employee_id?: number } | null {
  try {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function isManagerRole(role: string): boolean {
  return ['admin', 'rh', 'manager', 'dg', 'dga', 'drh'].includes(role.toLowerCase());
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ProgressBar({ value, total }: { value: number; total: number }) {
  const { t } = useI18n();
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const color = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{value}/{total} {t.mySpace.dailyChecklist.tasksCompleted}</span>
        <span className="font-semibold text-gray-800">{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DayBadge({ day, active, onClick }: { day: DayOfWeek; active: boolean; onClick?: () => void }) {
  const { t } = useI18n();
  const DAY_LABELS = getDayLabels(t);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-primary-500 text-white'
          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {DAY_LABELS[day]}
    </button>
  );
}

// ============================================
// ITEM FORM MODAL
// ============================================

interface ItemFormProps {
  employeeId: number;
  item?: ChecklistItem;
  objectives: ObjectiveForLinking[];
  onSave: () => void;
  onClose: () => void;
}

function ItemFormModal({ employeeId, item, objectives, onSave, onClose }: ItemFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(item?.priority ?? 'medium');
  const [days, setDays] = useState<DayOfWeek[]>(
    item?.days_of_week ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  );
  const [objectiveId, setObjectiveId] = useState<number | ''>(item?.objective_id ?? '');
  const [keyResultId, setKeyResultId] = useState<number | ''>(item?.key_result_id ?? '');
  const [krContribution, setKrContribution] = useState<string>(
    item?.kr_contribution?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedObjective = objectives.find(o => o.id === objectiveId);

  function toggleDay(d: DayOfWeek) {
    setDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError(t.mySpace.dailyChecklist.titleIsRequired); return; }
    if (days.length === 0) { setError(t.mySpace.dailyChecklist.selectAtLeastOneDay); return; }

    const payload: ChecklistItemCreate & { is_active?: boolean } = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      days_of_week: days,
      objective_id: objectiveId || undefined,
      key_result_id: keyResultId || undefined,
      kr_contribution: krContribution ? parseFloat(krContribution) : undefined,
      order: item?.order ?? 0,
    };

    setSaving(true);
    setError('');
    try {
      if (item) {
        await updateChecklistItem(item.id, payload);
      } else {
        await createChecklistItem(employeeId, payload);
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {item ? t.mySpace.dailyChecklist.editItem : t.mySpace.dailyChecklist.newItem}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.dailyChecklist.titleRequired}</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t.mySpace.dailyChecklist.titlePlaceholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.dailyChecklist.description}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder={t.mySpace.dailyChecklist.descriptionPlaceholder}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.dailyChecklist.priorityLabel}</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="low">{t.mySpace.dailyChecklist.priorityLow}</option>
                <option value="medium">{t.mySpace.dailyChecklist.priorityMedium}</option>
                <option value="high">{t.mySpace.dailyChecklist.priorityHigh}</option>
                <option value="urgent">{t.mySpace.dailyChecklist.priorityUrgent}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.mySpace.dailyChecklist.activeDays}</label>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map(d => (
                <DayBadge key={d} day={d} active={days.includes(d)} onClick={() => toggleDay(d)} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.dailyChecklist.linkedObjective}</label>
            <select
              value={objectiveId}
              onChange={e => { setObjectiveId(e.target.value ? Number(e.target.value) : ''); setKeyResultId(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t.mySpace.dailyChecklist.none}</option>
              {objectives.map(o => (
                <option key={o.id} value={o.id}>{o.title}</option>
              ))}
            </select>
          </div>

          {selectedObjective && selectedObjective.key_results.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.dailyChecklist.keyResult}</label>
                <select
                  value={keyResultId}
                  onChange={e => setKeyResultId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t.mySpace.dailyChecklist.none}</option>
                  {selectedObjective.key_results.map(kr => (
                    <option key={kr.id} value={kr.id}>{kr.title}</option>
                  ))}
                </select>
              </div>
              {keyResultId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.dailyChecklist.contribution}</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={krContribution}
                    onChange={e => setKrContribution(e.target.value)}
                    placeholder={t.mySpace.dailyChecklist.contributionPlaceholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t.mySpace.dailyChecklist.contributionHelp}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {item ? t.mySpace.dailyChecklist.save : t.mySpace.dailyChecklist.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// EMPLOYEE VIEW — Checklist du jour
// ============================================

function EmployeeChecklistView() {
  const { t } = useI18n();
  const PRIORITY_STYLES = getPriorityStylesCL(t);
  const [data, setData] = useState<DailyChecklistToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getTodayChecklist());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(item: ChecklistTodayItem) {
    if (!item.task_id || completing) return;
    if (item.status === 'completed') return;

    setCompleting(item.task_id);
    try {
      if (item.status === 'pending') {
        await startTask(item.task_id);
      }
      await completeTask(item.task_id);
      await load();
    } catch {
      // silencieux
    } finally {
      setCompleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (!data || data.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ListChecks className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">{t.mySpace.dailyChecklist.noChecklistToday}</p>
        <p className="text-gray-400 text-sm mt-1">{t.mySpace.dailyChecklist.noChecklistConfigured}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date + Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          <p className="text-sm text-gray-500 capitalize">{dateStr}</p>
        </div>
        <ProgressBar value={data.completed} total={data.total} />
        {data.completion_rate === 100 && (
          <div className="mt-3 flex items-center gap-2 text-green-600 text-sm font-medium">
            <Check className="w-4 h-4" />
            {t.mySpace.dailyChecklist.checklistCompleted}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
        {data.items.map(item => {
          const isDone = item.status === 'completed';
          const isLoading = completing === item.task_id;
          const pStyle = PRIORITY_STYLES[item.priority];

          return (
            <div
              key={item.item_id}
              className={`flex items-start gap-3 p-4 transition-colors ${isDone ? 'opacity-60' : 'hover:bg-gray-50/50'}`}
            >
              <button
                onClick={() => handleToggle(item)}
                disabled={isDone || isLoading || !item.task_id}
                className="mt-0.5 flex-shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                ) : isDone ? (
                  <CheckSquare className="w-5 h-5 text-green-500" />
                ) : (
                  <Square className="w-5 h-5 text-gray-300 hover:text-primary-500 transition-colors" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pStyle.bg} ${pStyle.text}`}>
                    {pStyle.label}
                  </span>
                  {item.key_result_id && (
                    <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      <Target className="w-3 h-3" />
                      {t.mySpace.dailyChecklist.krLinked} {item.kr_contribution ? `(+${item.kr_contribution})` : ''}
                    </span>
                  )}
                  {!item.task_id && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      {t.mySpace.dailyChecklist.notInjected}
                    </span>
                  )}
                </div>
              </div>

              {isDone && item.completed_at && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(item.completed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// MANAGER VIEW — Gestion des templates
// ============================================

function ManagerTemplateView() {
  const { t } = useI18n();
  const PRIORITY_STYLES = getPriorityStylesCL(t);
  const [members, setMembers] = useState<ChecklistTeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<ChecklistTeamMember | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveForLinking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | undefined>();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [m, obj] = await Promise.all([
          getTeamChecklistMembers(),
          getObjectivesForLinking(),
        ]);
        setMembers(m);
        setObjectives(obj);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function selectMember(member: ChecklistTeamMember) {
    setSelectedMember(member);
    setLoadingItems(true);
    try {
      const [memberItems, memberObjectives] = await Promise.all([
        getEmployeeChecklist(member.id),
        getObjectivesForLinking(member.id),
      ]);
      setItems(memberItems);
      setObjectives(memberObjectives.length > 0 ? memberObjectives : objectives);
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleSaved() {
    setShowForm(false);
    setEditingItem(undefined);
    if (selectedMember) {
      const updated = await getEmployeeChecklist(selectedMember.id);
      setItems(updated);
      setMembers(prev => prev.map(m =>
        m.id === selectedMember.id
          ? { ...m, checklist_items_count: updated.filter(i => i.is_active).length }
          : m
      ));
    }
  }

  async function handleDelete(itemId: number) {
    setDeletingId(itemId);
    try {
      await deleteChecklistItem(itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      setMembers(prev => prev.map(m =>
        m.id === selectedMember?.id
          ? { ...m, checklist_items_count: Math.max(0, m.checklist_items_count - 1) }
          : m
      ));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Liste des membres */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{t.mySpace.dailyChecklist.myTeam}</span>
        </div>
        <div className="divide-y divide-gray-50">
          {members.length === 0 && (
            <p className="p-4 text-sm text-gray-400 text-center">{t.mySpace.dailyChecklist.noMember}</p>
          )}
          {members.map(m => (
            <button
              key={m.id}
              onClick={() => selectMember(m)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                selectedMember?.id === m.id ? 'bg-primary-50 border-l-2 border-primary-500' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary-600">
                  {m.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                <p className="text-xs text-gray-400 truncate">{m.job_title || '—'}</p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                m.checklist_items_count > 0
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {m.checklist_items_count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Template de l'employé sélectionné */}
      <div className="col-span-2 bg-white rounded-xl border border-gray-200">
        {!selectedMember ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-400">{t.mySpace.dailyChecklist.selectMemberToManage}</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{selectedMember.name}</p>
                <p className="text-xs text-gray-400">{selectedMember.job_title}</p>
              </div>
              <button
                onClick={() => { setEditingItem(undefined); setShowForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600"
              >
                <Plus className="w-4 h-4" />
                {t.mySpace.dailyChecklist.add}
              </button>
            </div>

            <div className="p-4">
              {loadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <ListChecks className="w-10 h-10 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-400">{t.mySpace.dailyChecklist.noItemInTemplate}</p>
                  <p className="text-xs text-gray-300 mt-1">{t.mySpace.dailyChecklist.clickAddToStart}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map(item => {
                    const pStyle = PRIORITY_STYLES[item.priority];
                    const isDeleting = deletingId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                          item.is_active ? 'border-gray-100 hover:border-gray-200' : 'border-gray-100 opacity-50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                            {!item.is_active && (
                              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.mySpace.dailyChecklist.inactive}</span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pStyle.bg} ${pStyle.text}`}>
                              {pStyle.label}
                            </span>
                            <div className="flex gap-1">
                              {item.days_of_week.map(d => (
                                <DayBadge key={d} day={d} active />
                              ))}
                            </div>
                            {item.key_result_title && (
                              <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                <Target className="w-3 h-3" />
                                {item.key_result_title}
                                {item.kr_contribution && ` (+${item.kr_contribution})`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => { setEditingItem(item); setShowForm(true); }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={isDeleting}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            {isDeleting
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showForm && selectedMember && (
        <ItemFormModal
          employeeId={selectedMember.id}
          item={editingItem}
          objectives={objectives}
          onSave={handleSaved}
          onClose={() => { setShowForm(false); setEditingItem(undefined); }}
        />
      )}
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function DailyChecklistPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'my-checklist' | 'manage'>('my-checklist');
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (user?.role) setIsManager(isManagerRole(user.role));
  }, []);

  return (
    <>
    <Header title={t.mySpace.dailyChecklist.title} subtitle={t.mySpace.dailyChecklist.subtitle} />
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
          <TrendingUp className="w-4 h-4" />
          {t.mySpace.dailyChecklist.krAutoUpdate}
        </div>
      </div>

      {/* Tabs (manager uniquement) */}
      {isManager && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setTab('my-checklist')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'my-checklist'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              {t.mySpace.dailyChecklist.myChecklist}
            </span>
          </button>
          <button
            onClick={() => setTab('manage')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'manage'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t.mySpace.dailyChecklist.manageTemplates}
            </span>
          </button>
        </div>
      )}

      {/* Content */}
      {tab === 'my-checklist' && <EmployeeChecklistView />}
      {tab === 'manage' && isManager && <ManagerTemplateView />}
    </div>
    </>
  );
}
