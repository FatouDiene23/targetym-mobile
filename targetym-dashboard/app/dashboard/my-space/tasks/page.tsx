'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { 
  ClipboardList, Clock, Plus, CheckCircle2, Circle, AlertTriangle,
  Play, Check, X, Send, Calendar, Flag, MoreVertical, Loader2,
  ChevronDown, ChevronUp, User, MessageSquare, Users, Filter,
  Award, Target, Lightbulb, BarChart3, History,
  ChevronLeft, ChevronRight, Mail
} from 'lucide-react';
import { 
  getMyTasksToday, getMyTaskStats, completeTask, startTask, createTask,
  getMyDailyValidationStatus, submitDailyValidation,
  getPendingValidations, validateDaily, deleteTask, getTeamMembers, getTeamTasks,
  getValidationHistory, getMyTasks, getObjectivesForLinking, getEmployee,
  type Task, type TaskStats, type TaskPriority, type PendingValidation, type TeamMember,
  type DailyValidation, type ObjectiveForLinking
} from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';
import Header from '@/components/Header';
import CustomSelect from '@/components/CustomSelect';
import { useI18n } from '@/lib/i18n/I18nContext';

// Couleurs par priorité (styling only - labels are translated in components)
const PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string }> = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600' },
  high: { bg: 'bg-orange-100', text: 'text-orange-600' },
  urgent: { bg: 'bg-red-100', text: 'text-red-600' },
};

function getPriorityLabel(priority: TaskPriority, t: ReturnType<typeof useI18n>['t']): string {
  const labels: Record<TaskPriority, string> = {
    low: t.mySpace.tasks.priorityLow,
    medium: t.mySpace.tasks.priorityMedium,
    high: t.mySpace.tasks.priorityHigh,
    urgent: t.mySpace.tasks.priorityUrgent,
  };
  return labels[priority];
}

// Composant Pagination
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }
          
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${
                currentPage === pageNum
                  ? 'bg-primary-600 text-white'
                  : 'border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// Helper pour grouper les tâches à venir par période
function groupByPeriod(tasks: Task[], t: ReturnType<typeof useI18n>['t']): { label: string; tasks: Task[]; color: string }[] {
  const groups: Record<string, { tasks: Task[]; color: string; order: number }> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  tasks.forEach(task => {
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let label: string;
    let color: string;
    let order: number;
    if (diff === 1) { label = t.mySpace.tasks.tomorrow; color = 'text-blue-600'; order = 1; }
    else if (diff <= 7) { label = t.mySpace.tasks.thisWeek; color = 'text-indigo-600'; order = 2; }
    else if (diff <= 14) { label = t.mySpace.tasks.nextWeek; color = 'text-purple-600'; order = 3; }
    else if (diff <= 30) { label = t.mySpace.tasks.thisMonth; color = 'text-gray-600'; order = 4; }
    else { label = t.mySpace.tasks.later; color = 'text-gray-400'; order = 5; }

    if (!groups[label]) groups[label] = { tasks: [], color, order };
    groups[label].tasks.push(task);
  });

  return Object.entries(groups)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([label, { tasks, color }]) => ({ label, tasks, color }));
}

// Composant carte de tâche
function TaskCard({ 
  task, 
  onComplete, 
  onStart,
  onDelete,
  isLoading,
  showAssignee = false
}: { 
  task: Task; 
  onComplete?: (id: number) => void;
  onStart?: (id: number) => void;
  onDelete?: (id: number) => void;
  isLoading: boolean;
  showAssignee?: boolean;
}) {
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const priority = PRIORITY_COLORS[task.priority];
  const isOverdue = task.is_overdue;
  const isCompleted = task.status === 'completed';
  const isInProgress = task.status === 'in_progress';
  const canInteract = onComplete && onStart && onDelete;

  return (
    <div className={`bg-white rounded-lg border p-4 transition-all ${
      isCompleted ? 'border-green-200 bg-green-50/30' : 
      isOverdue ? 'border-red-200 bg-red-50/30' : 
      'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {canInteract ? (
          <button
            onClick={() => !isCompleted && onComplete(task.id)}
            disabled={isLoading || isCompleted}
            className={`mt-0.5 flex-shrink-0 ${isCompleted ? 'text-green-500' : 'text-gray-300 hover:text-green-500'}`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>
        ) : (
          <div className={`mt-0.5 flex-shrink-0 ${isCompleted ? 'text-green-500' : 'text-gray-300'}`}>
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </div>
        )}

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {task.title}
            </h3>
            
            {/* Menu */}
            {canInteract && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      {!isCompleted && task.status === 'pending' && (
                        <button
                          onClick={() => { onStart(task.id); setShowMenu(false); }}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          {t.mySpace.tasks.start}
                        </button>
                      )}
                      <button
                        onClick={() => { onDelete(task.id); setShowMenu(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        {t.mySpace.tasks.cancelTask}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {task.description && (
            <p className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-gray-500'}`}>
              {task.description}
            </p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {showAssignee && task.assigned_to_name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                <User className="w-3 h-3" />
                {task.assigned_to_name}
              </span>
            )}

            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${priority.bg} ${priority.text}`}>
              <Flag className="w-3 h-3" />
              {getPriorityLabel(task.priority, t)}
            </span>

            {isInProgress && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600">
                <Play className="w-3 h-3" />
                {t.mySpace.tasks.inProgress}
              </span>
            )}

            {isOverdue && !isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
                <AlertTriangle className="w-3 h-3" />
                {t.mySpace.tasks.overdue}
              </span>
            )}

            {task.objective_title && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                <Target className="w-3 h-3" />
                {task.objective_title}
              </span>
            )}

            <span className={`inline-flex items-center gap-1 text-xs ${isOverdue && !isCompleted ? 'text-red-500' : 'text-gray-400'}`}>
              <Calendar className="w-3 h-3" />
              {new Date(task.due_date).toLocaleDateString('fr-FR')}
            </span>

            {!showAssignee && task.created_by_id !== task.assigned_to_id && task.created_by_name && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <User className="w-3 h-3" />
                {t.mySpace.tasks.byCreator} {task.created_by_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant groupe repliable pour tâches à venir
function CollapsibleGroup({
  label,
  color,
  tasks,
  defaultOpen = false,
  renderTask,
}: {
  label: string;
  color: string;
  tasks: Task[];
  defaultOpen?: boolean;
  renderTask: (task: Task) => React.ReactNode;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 10;
  const hasMore = tasks.length > INITIAL_SHOW;
  const visibleTasks = showAll ? tasks : tasks.slice(0, INITIAL_SHOW);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${color}`}>
          <Calendar className="w-4 h-4" />
          {label} ({tasks.length})
        </h3>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {visibleTasks.map((task) => renderTask(task))}
          
          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 font-medium bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            >
              {t.mySpace.tasks.seeMoreTasks} ({tasks.length - INITIAL_SHOW})
            </button>
          )}
          
          {hasMore && showAll && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              {t.mySpace.tasks.collapse}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Labels pour les niveaux OKR
function getOkrLevelLabels(t: ReturnType<typeof useI18n>['t']): Record<string, string> {
  return {
    enterprise: `🏢 ${t.mySpace.tasks.okrEnterprise}`,
    department: `🏛️ ${t.mySpace.tasks.okrDepartment}`,
    team: `👥 ${t.mySpace.tasks.okrTeam}`,
    individual: `👤 ${t.mySpace.tasks.okrIndividual}`,
  };
}

// Modal de création de tâche
function CreateTaskModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  currentEmployeeId,
  teamMembers = []
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: () => void;
  currentEmployeeId: number;
  teamMembers?: TeamMember[];
}) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [objectives, setObjectives] = useState<ObjectiveForLinking[]>([]);
  const [loadingObjectives, setLoadingObjectives] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to_id: currentEmployeeId.toString(),
    due_date: new Date().toISOString().split('T')[0],
    priority: 'medium' as TaskPriority,
    objective_id: '',
    key_result_id: '',
    is_administrative: false,
  });

  useEffect(() => {
    if (isOpen) {
      loadObjectivesForEmployee(parseInt(formData.assigned_to_id));
    }
  }, [isOpen, formData.assigned_to_id]);

  const loadObjectivesForEmployee = async (employeeId: number) => {
    setLoadingObjectives(true);
    setObjectives([]);
    setFormData(prev => ({ ...prev, objective_id: '', key_result_id: '' }));
    
    try {
      const data = await getObjectivesForLinking(employeeId);
      setObjectives(data);
    } catch (err) {
      console.error('Error loading objectives:', err);
    } finally {
      setLoadingObjectives(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentEmployeeId) {
      setFormData(prev => ({ 
        ...prev, 
        assigned_to_id: currentEmployeeId.toString(),
        title: '',
        description: '',
        due_date: new Date().toISOString().split('T')[0],
        priority: 'medium',
        objective_id: '',
        key_result_id: '',
        is_administrative: false,
      }));
      setError('');
    }
  }, [isOpen, currentEmployeeId]);

  const selectedObjective = objectives.find(o => o.id.toString() === formData.objective_id);
  const availableKeyResults = selectedObjective?.key_results || [];

  useEffect(() => {
    setFormData(prev => ({ ...prev, key_result_id: '' }));
  }, [formData.objective_id]);

  const groupedObjectives = objectives.reduce((acc, obj) => {
    const level = obj.level;
    if (!acc[level]) acc[level] = [];
    acc[level].push(obj);
    return acc;
  }, {} as Record<string, ObjectiveForLinking[]>);

  const isFormValid = () => {
    if (!formData.title.trim()) return false;
    if (!formData.due_date) return false;
    if (!formData.is_administrative && !formData.objective_id) return false;
    return true;
  };

  const getObjectiveError = () => {
    if (formData.is_administrative) return null;
    if (loadingObjectives) return null;
    if (objectives.length === 0) {
      return t.mySpace.tasks.noObjectivesError;
    }
    if (!formData.objective_id) {
      return t.mySpace.tasks.selectObjectiveOrAdmin;
    }
    return null;
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.is_administrative && !formData.objective_id) {
      setError(t.mySpace.tasks.selectObjectiveError);
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      await createTask({
        title: formData.title,
        description: formData.description || undefined,
        assigned_to_id: parseInt(formData.assigned_to_id),
        due_date: formData.due_date,
        priority: formData.priority,
        objective_id: formData.is_administrative ? undefined : (formData.objective_id ? parseInt(formData.objective_id) : undefined),
        key_result_id: formData.is_administrative ? undefined : (formData.key_result_id ? parseInt(formData.key_result_id) : undefined),
        is_administrative: formData.is_administrative,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.mySpace.tasks.createError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-2rem)]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.mySpace.tasks.newTaskTitle}</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.tasks.titleLabel}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t.mySpace.tasks.titlePlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.tasks.descriptionLabel}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.mySpace.tasks.descriptionPlaceholder}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.tasks.assignTo}</label>
                <CustomSelect
                  value={String(formData.assigned_to_id || '')}
                  onChange={(v) => setFormData({ ...formData, assigned_to_id: v })}
                  options={[
                    { value: String(currentEmployeeId || ''), label: t.mySpace.tasks.myself },
                    ...teamMembers.map((member) => ({
                      value: String(member.id),
                      label: `${member.name}${member.job_title ? ` (${member.job_title})` : ''}`,
                    })),
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.tasks.dueDate}</label>
                  <CustomDatePicker
                    value={formData.due_date}
                    onChange={(v) => setFormData({ ...formData, due_date: v })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.tasks.priority}</label>
                  <CustomSelect
                    value={formData.priority}
                    onChange={(v) => setFormData({ ...formData, priority: v as TaskPriority })}
                    options={[
                      { value: 'low', label: t.mySpace.tasks.priorityLow },
                      { value: 'medium', label: t.mySpace.tasks.priorityMedium },
                      { value: 'high', label: t.mySpace.tasks.priorityHigh },
                      { value: 'urgent', label: t.mySpace.tasks.priorityUrgent },
                    ]}
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  {t.mySpace.tasks.objectiveLink}
                </h3>

                <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors mb-3">
                  <input
                    type="checkbox"
                    checked={formData.is_administrative}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      is_administrative: e.target.checked,
                      objective_id: e.target.checked ? '' : formData.objective_id,
                      key_result_id: e.target.checked ? '' : formData.key_result_id,
                    })}
                    className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      {t.mySpace.tasks.administrativeTask}
                    </span>
                    <span className="text-xs text-gray-500 block mt-0.5">
                      {t.mySpace.tasks.administrativeTaskDesc}
                    </span>
                  </div>
                </label>

                {!formData.is_administrative && (
                  <div className="space-y-3">
                    {loadingObjectives ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                        <span className="ml-2 text-sm text-indigo-600">{t.mySpace.tasks.loadingObjectives}</span>
                      </div>
                    ) : objectives.length === 0 ? (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          {t.mySpace.tasks.noObjectivesAvailable}
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          {t.mySpace.tasks.createObjectiveFirst}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.tasks.objectiveRequired}</label>
                          <CustomSelect
                            value={String(formData.objective_id || '')}
                            onChange={(v) => setFormData({ ...formData, objective_id: v })}
                            placeholder={t.mySpace.tasks.selectObjectivePlaceholder}
                            options={[
                              { value: '', label: t.mySpace.tasks.selectObjectivePlaceholder },
                              ...Object.entries(groupedObjectives).flatMap(([level, objs]) =>
                                objs.map((obj) => ({
                                  value: String(obj.id),
                                  label: `[${getOkrLevelLabels(t)[level] || level}] ${obj.title} (${obj.progress.toFixed(0)}%)`,
                                }))
                              ),
                            ]}
                          />
                        </div>

                        {formData.objective_id && availableKeyResults.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.mySpace.tasks.keyResultOptional}</label>
                            <CustomSelect
                              value={String(formData.key_result_id || '')}
                              onChange={(v) => setFormData({ ...formData, key_result_id: v })}
                              placeholder={t.mySpace.tasks.allKRs}
                              options={[
                                { value: '', label: t.mySpace.tasks.allKRs },
                                ...availableKeyResults.map((kr) => ({
                                  value: String(kr.id),
                                  label: `${kr.title} (${kr.current}/${kr.target} ${kr.unit || ''})`,
                                })),
                              ]}
                            />
                          </div>
                        )}

                        {formData.objective_id && (
                          <p className="text-xs text-indigo-600 flex items-center gap-1 bg-indigo-50 p-2 rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            {t.mySpace.tasks.taskContributesToObjective}
                          </p>
                        )}

                        {getObjectiveError() && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {getObjectiveError()}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {formData.is_administrative && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 bg-gray-100 p-2 rounded">
                    <Mail className="w-3 h-3" />
                    {t.mySpace.tasks.notCountedInOKR}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !isFormValid()}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {t.common.create}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal de soumission journalière
function SubmitDayModal({
  isOpen,
  onClose,
  onSuccess,
  incompleteTasks,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  incompleteTasks: Task[];
}) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [reasons, setReasons] = useState<Record<number, string>>({});

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const missingReasons = incompleteTasks.filter(t => !reasons[t.id]?.trim());
    if (missingReasons.length > 0) {
      setError(t.mySpace.tasks.justifyAllIncomplete);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await submitDailyValidation({
        submission_note: note || undefined,
        incomplete_tasks: incompleteTasks.map(t => ({
          task_id: t.id,
          reason: reasons[t.id],
        })),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.mySpace.tasks.submitError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-2rem)]">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t.mySpace.tasks.submitMyDay}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {t.mySpace.tasks.submitMyDayDesc}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {incompleteTasks.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-medium text-orange-800 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t.mySpace.tasks.incompleteTasks} ({incompleteTasks.length})
                  </h3>
                  <p className="text-sm text-orange-700 mb-3">
                    {t.mySpace.tasks.justifyIncompleteDesc}
                  </p>
                  <div className="space-y-3">
                    {incompleteTasks.map((task) => (
                      <div key={task.id} className="bg-white rounded-lg p-3 border border-orange-100">
                        <p className="font-medium text-gray-900 text-sm mb-2">{task.title}</p>
                        <textarea
                          value={reasons[task.id] || ''}
                          onChange={(e) => setReasons({ ...reasons, [task.id]: e.target.value })}
                          placeholder={t.mySpace.tasks.reason}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.mySpace.tasks.noteForManager}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.mySpace.tasks.commentPlaceholder}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t.mySpace.tasks.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Section validations en attente (Manager)
function PendingValidationsSection({
  validations,
  onValidate,
  isLoading,
}: {
  validations: PendingValidation[];
  onValidate: (id: number, approved: boolean, comment?: string) => void;
  isLoading: boolean;
}) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  if (validations.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
      <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        {t.mySpace.tasks.daysToValidate} ({validations.length})
      </h3>

      <div className="space-y-3">
        {validations.map(({ validation, tasks }) => (
          <div key={validation.id} className="bg-white rounded-lg border border-yellow-100 overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === validation.id ? null : validation.id)}
              className="w-full p-3 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{validation.employee_name}</p>
                  <p className="text-sm text-gray-500">
                    {validation.completed_tasks}/{validation.total_tasks} {t.mySpace.tasks.tasksLabel} • {validation.completion_rate.toFixed(0)}%
                  </p>
                </div>
              </div>
              {expandedId === validation.id ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {expandedId === validation.id && (
              <div className="px-3 pb-3 border-t border-gray-100">
                <div className="mt-3 space-y-2">
                  {tasks.map((task) => (
                    <div key={task.id} className={`flex items-center gap-2 text-sm p-2 rounded ${
                      task.status === 'completed' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <X className="w-4 h-4 text-red-500" />
                      )}
                      <span className={task.status === 'completed' ? 'text-green-700' : 'text-red-700'}>
                        {task.title}
                      </span>
                      {task.incomplete_reason && (
                        <span className="text-red-600 text-xs ml-auto">
                          ({task.incomplete_reason})
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {validation.submission_note && (
                  <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
                    <p className="text-gray-500 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {t.mySpace.tasks.noteLabel}
                    </p>
                    <p className="text-gray-700">{validation.submission_note}</p>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t.mySpace.tasks.commentOptional}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onValidate(validation.id, false, comment);
                        setComment('');
                      }}
                      disabled={isLoading}
                      className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      {t.mySpace.tasks.reject}
                    </button>
                    <button
                      onClick={() => {
                        onValidate(validation.id, true, comment);
                        setComment('');
                      }}
                      disabled={isLoading}
                      className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      {t.mySpace.tasks.validate}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// ONGLET 1: MES TÂCHES (avec sous-onglets Du jour / À venir)
// ============================================
function MyTasksTab({
  onRefresh,
  hasManager,
}: {
  onRefresh: () => void;
  hasManager: boolean;
}) {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);
  const [validationStatus, setValidationStatus] = useState<{
    validation: { status: string; validation_comment?: string } | null;
    can_submit: boolean;
    can_submit_time?: boolean;
    min_submit_time?: string;
    tasks_total: number;
    tasks_completed: number;
    all_completed: boolean;
  } | null>(null);
  const [pendingValidations, setPendingValidations] = useState<PendingValidation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subTab, setSubTab] = useState<'today' | 'upcoming'>('today');
  const [currentPage, setCurrentPage] = useState(1);
  const [isManager, setIsManager] = useState(false);
  const pageSize = 10;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksData, statsData, validationData] = await Promise.all([
        getMyTasksToday(),
        getMyTaskStats(),
        getMyDailyValidationStatus(),
      ]);
      
      setTasks(tasksData);
      setStats(statsData);
      setValidationStatus(validationData);

      // Charger les tâches à venir séparément (ne bloque pas les stats)
      try {
        const allTasksData = await getMyTasks({ page_size: 100 });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const allTasks = allTasksData.items || allTasksData || [];
        const upcoming = (Array.isArray(allTasks) ? allTasks : []).filter((t: Task) => {
          const due = new Date(t.due_date);
          due.setHours(0, 0, 0, 0);
          return due > today && t.status !== 'completed' && t.status !== 'cancelled';
        });
        upcoming.sort((a: Task, b: Task) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        setUpcomingTasks(upcoming);
      } catch (err) {
        console.error('Error loading upcoming tasks:', err);
      }

      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const userIsManager = ['ADMIN', 'MANAGER', 'RH', 'DG'].includes(user.role?.toUpperCase());
        setIsManager(userIsManager);
        
        if (userIsManager) {
          try {
            const pending = await getPendingValidations();
            setPendingValidations(pending);
          } catch (err) {
            console.error('Error loading pending validations:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCompleteTask(taskId: number) {
    setActionLoading(true);
    try {
      await completeTask(taskId);
      await loadData();
      onRefresh();
    } catch (err) {
      console.error('Error completing task:', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartTask(taskId: number) {
    setActionLoading(true);
    try {
      await startTask(taskId);
      await loadData();
    } catch (err) {
      console.error('Error starting task:', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteTask(taskId: number) {
    setConfirmDialog({
      isOpen: true,
      title: t.mySpace.tasks.cancelTaskTitle,
      message: t.mySpace.tasks.cancelTaskMessage,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(true);
        try {
          await deleteTask(taskId);
          await loadData();
          onRefresh();
          toast.success(t.mySpace.tasks.taskCancelled);
        } catch (err) {
          console.error('Error deleting task:', err);
          toast.error(t.mySpace.tasks.cancelError);
        } finally {
          setActionLoading(false);
        }
      },
    });
  }

  async function handleValidateDay(validationId: number, approved: boolean, comment?: string) {
    setActionLoading(true);
    try {
      await validateDaily(validationId, approved, comment);
      await loadData();
      onRefresh();
    } catch (err) {
      console.error('Error validating day:', err);
    } finally {
      setActionLoading(false);
    }
  }

  // Filtrer les tâches du jour
  const filteredTasks = tasks.filter(task => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'todo') return task.status === 'pending' || task.status === 'in_progress';
    return task.status === statusFilter;
  });

  // Pagination tâches du jour
  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const incompleteTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  // Grouper toutes les tâches à venir par période
  const upcomingGroups = groupByPeriod(upcomingTasks, t);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-tour="tasks-list">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t.mySpace.tasks.toDo}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.pending + stats.in_progress}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t.mySpace.tasks.completed}</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t.mySpace.tasks.overdue}</p>
            <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t.mySpace.tasks.todayLabel}</p>
            <p className="text-2xl font-bold text-blue-600">{stats.due_today}</p>
          </div>
        </div>
      )}

      {/* Validations en attente (Manager) */}
      {isManager && (
        <PendingValidationsSection
          validations={pendingValidations}
          onValidate={handleValidateDay}
          isLoading={actionLoading}
        />
      )}

      {/* Statut de validation */}
      {hasManager && validationStatus?.validation && (
        <div className={`rounded-xl p-4 ${
          validationStatus.validation.status === 'approved' 
            ? 'bg-green-50 border border-green-200' 
            : validationStatus.validation.status === 'rejected'
            ? 'bg-red-50 border border-red-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center gap-3">
            {validationStatus.validation.status === 'approved' ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : validationStatus.validation.status === 'rejected' ? (
              <X className="w-6 h-6 text-red-600" />
            ) : (
              <Clock className="w-6 h-6 text-yellow-600" />
            )}
            <div>
              <p className={`font-medium ${
                validationStatus.validation.status === 'approved' 
                  ? 'text-green-800' 
                  : validationStatus.validation.status === 'rejected'
                  ? 'text-red-800'
                  : 'text-yellow-800'
              }`}>
                {validationStatus.validation.status === 'approved'
                  ? `${t.mySpace.tasks.dayValidated} ✓`
                  : validationStatus.validation.status === 'rejected'
                  ? t.mySpace.tasks.dayRejected
                  : t.mySpace.tasks.pendingValidation}
              </p>
              {validationStatus.validation.validation_comment && (
                <p className="text-sm opacity-75">
                  {t.mySpace.tasks.commentLabel} {validationStatus.validation.validation_comment}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liste des tâches avec sous-onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Sous-onglets Du jour / À venir */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => { setSubTab('today'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  subTab === 'today'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                {t.mySpace.tasks.today} ({filteredTasks.length})
              </button>
              <button
                onClick={() => { setSubTab('upcoming'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  subTab === 'upcoming'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {t.mySpace.tasks.upcoming} ({upcomingTasks.length})
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              {subTab === 'today' && (
                <CustomSelect
                  value={statusFilter}
                  onChange={v => { setStatusFilter(v); setCurrentPage(1); }}
                  options={[
                    { value: 'all', label: t.mySpace.tasks.allStatuses },
                    { value: 'todo', label: t.mySpace.tasks.toDo },
                    { value: 'in_progress', label: t.mySpace.tasks.inProgress },
                    { value: 'completed', label: t.mySpace.tasks.completed },
                  ]}
                  className="min-w-[130px]"
                />
              )}

              {/* Bouton soumettre */}
              {hasManager && subTab === 'today' && tasks.length > 0 && !validationStatus?.validation && (
                validationStatus?.can_submit ? (
                  <button
                    onClick={() => setShowSubmitModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    {t.mySpace.tasks.submitMyDay}
                  </button>
                ) : !validationStatus?.can_submit_time ? (
                  <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t.mySpace.tasks.submissionFrom}
                  </span>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* Contenu: Tâches du jour */}
        {subTab === 'today' && (
          <>
            {paginatedTasks.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500">{t.mySpace.tasks.noTasksToday}</p>
                {upcomingTasks.length > 0 && (
                  <button
                    onClick={() => { setSubTab('upcoming'); setCurrentPage(1); }}
                    className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {t.mySpace.tasks.viewUpcomingTasks} ({upcomingTasks.length}) →
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {paginatedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleCompleteTask}
                    onStart={handleStartTask}
                    onDelete={handleDeleteTask}
                    isLoading={actionLoading}
                  />
                ))}
                
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}

        {/* Contenu: Tâches à venir */}
        {subTab === 'upcoming' && (
          <>
            {upcomingTasks.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500">{t.mySpace.tasks.noUpcomingTasks}</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {upcomingGroups.map((group, index) => (
                  <CollapsibleGroup
                    key={group.label}
                    label={group.label}
                    color={group.color}
                    tasks={group.tasks}
                    defaultOpen={index === 0}
                    renderTask={(task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={handleCompleteTask}
                        onStart={handleStartTask}
                        onDelete={handleDeleteTask}
                        isLoading={actionLoading}
                      />
                    )}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de soumission */}
      <SubmitDayModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onSuccess={() => { loadData(); onRefresh(); }}
        incompleteTasks={incompleteTasks}
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
    </div>
  );
}

// ============================================
// ONGLET 2: TÂCHES ÉQUIPE (avec sous-onglets Du jour / À venir)
// ============================================
function TeamTasksTab({
  teamMembers,
}: {
  teamMembers: TeamMember[];
}) {
  const { t } = useI18n();
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [subTab, setSubTab] = useState<'today' | 'upcoming'>('today');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadTeamTasks();
  }, []);

  async function loadTeamTasks() {
    setIsLoading(true);
    try {
      const data = await getTeamTasks({ page_size: 100 });
      setTeamTasks(data.items || []);
    } catch (err) {
      console.error('Error loading team tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Séparer tâches du jour vs à venir
  const todayTasks = teamTasks.filter(task => {
    const dueStr = new Date(task.due_date).toISOString().split('T')[0];
    return dueStr <= todayStr && task.status !== 'completed' && task.status !== 'cancelled';
  });

  const upcomingTeamTasks = teamTasks.filter(task => {
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    return due > today && task.status !== 'completed' && task.status !== 'cancelled';
  }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const currentTasks = subTab === 'today' ? todayTasks : upcomingTeamTasks;

  // Filtrer
  const filteredTasks = currentTasks.filter(task => {
    const matchEmployee = selectedEmployee === 'all' || task.assigned_to_id.toString() === selectedEmployee;
    const matchStatus = selectedStatus === 'all' || task.status === selectedStatus;
    return matchEmployee && matchStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTasks.length / pageSize);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Grouper à venir par période (sans pagination, groupes repliables)
  const upcomingGroups = subTab === 'upcoming' ? groupByPeriod(filteredTasks, t) : [];

  // Stats
  const tasksByStatus = {
    pending: filteredTasks.filter(t => t.status === 'pending').length,
    in_progress: filteredTasks.filter(t => t.status === 'in_progress').length,
    completed: filteredTasks.filter(t => t.status === 'completed').length,
    overdue: filteredTasks.filter(t => t.is_overdue && t.status !== 'completed').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">{t.mySpace.tasks.toDo}</p>
          <p className="text-2xl font-bold text-gray-900">{tasksByStatus.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">{t.mySpace.tasks.inProgress}</p>
          <p className="text-2xl font-bold text-blue-600">{tasksByStatus.in_progress}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">{t.mySpace.tasks.completed}</p>
          <p className="text-2xl font-bold text-green-600">{tasksByStatus.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">{t.mySpace.tasks.overdue}</p>
          <p className="text-2xl font-bold text-red-600">{tasksByStatus.overdue}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{t.mySpace.tasks.filters}</span>
          </div>

          <CustomSelect
            value={selectedEmployee}
            onChange={(v) => { setSelectedEmployee(v); setCurrentPage(1); }}
            className="min-w-[180px]"
            options={[
              { value: 'all', label: `${t.mySpace.tasks.allEmployees} (${teamMembers.length})` },
              ...teamMembers.map(m => ({ value: String(m.id), label: m.name })),
            ]}
          />

          <CustomSelect
            value={selectedStatus}
            onChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}
            className="min-w-[150px]"
            options={[
              { value: 'all', label: t.mySpace.tasks.allStatuses },
              { value: 'pending', label: t.mySpace.tasks.toDo },
              { value: 'in_progress', label: t.mySpace.tasks.inProgress },
              { value: 'completed', label: t.mySpace.tasks.completed },
            ]}
          />

          <button
            onClick={loadTeamTasks}
            className="ml-auto px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {t.mySpace.tasks.refresh}
          </button>
        </div>
      </div>

      {/* Liste avec sous-onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => { setSubTab('today'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  subTab === 'today'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                {t.mySpace.tasks.today} ({todayTasks.length})
              </button>
              <button
                onClick={() => { setSubTab('upcoming'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  subTab === 'upcoming'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {t.mySpace.tasks.upcoming} ({upcomingTeamTasks.length})
              </button>
            </div>
          </div>
        </div>

        {(subTab === 'today' ? paginatedTasks.length === 0 : filteredTasks.length === 0) ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {subTab === 'today' ? (
                <Users className="w-8 h-8 text-gray-400" />
              ) : (
                <Calendar className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <p className="text-gray-500">
              {subTab === 'today' ? t.mySpace.tasks.noTasksFound : t.mySpace.tasks.noUpcomingTasks}
            </p>
          </div>
        ) : subTab === 'upcoming' ? (
          <div className="p-4 space-y-3">
            {upcomingGroups.map((group, index) => (
              <CollapsibleGroup
                key={group.label}
                label={group.label}
                color={group.color}
                tasks={group.tasks}
                defaultOpen={index === 0}
                renderTask={(task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isLoading={false}
                    showAssignee={true}
                  />
                )}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {paginatedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isLoading={false}
                showAssignee={true}
              />
            ))}
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// ONGLET 3: HISTORIQUE
// ============================================
function HistoryTab() {
  const { t } = useI18n();
  const [subTab, setSubTab] = useState<'tasks' | 'validations'>('tasks');
  const [taskHistory, setTaskHistory] = useState<Task[]>([]);
  const [validationHistory, setValidationHistory] = useState<DailyValidation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>('0');
  const [validationStatusFilter, setValidationStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (periodFilter === '0') {
        startDate = now.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (periodFilter === '1') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = yesterday.toISOString().split('T')[0];
      } else if (periodFilter !== 'all') {
        const daysAgo = new Date(now);
        daysAgo.setDate(daysAgo.getDate() - parseInt(periodFilter));
        startDate = daysAgo.toISOString().split('T')[0];
      }

      const [tasks, validations] = await Promise.all([
        getMyTasks({ page_size: 100, status: 'completed' }),
        getValidationHistory({ page_size: 100 }),
      ]);

      let filteredTasks = tasks.items || [];
      let filteredValidations = validations.items || [];

      if (startDate) {
        filteredTasks = filteredTasks.filter((t: Task) => {
          if (!t.completed_at) return false;
          const taskDate = new Date(t.completed_at).toISOString().split('T')[0];
          if (endDate) {
            return taskDate >= startDate && taskDate <= endDate;
          }
          return taskDate >= startDate;
        });
        filteredValidations = filteredValidations.filter((v: DailyValidation) => {
          const valDate = new Date(v.validation_date).toISOString().split('T')[0];
          if (endDate) {
            return valDate >= startDate && valDate <= endDate;
          }
          return valDate >= startDate;
        });
      }

      setTaskHistory(filteredTasks);
      setValidationHistory(filteredValidations);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredValidations = validationHistory.filter(v => {
    if (validationStatusFilter === 'all') return true;
    return v.status === validationStatusFilter;
  });

  const currentData = subTab === 'tasks' ? taskHistory : filteredValidations;
  const totalPages = Math.ceil(currentData.length / pageSize);
  const paginatedData = currentData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [subTab, periodFilter, validationStatusFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-1 flex overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setSubTab('tasks')}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'tasks'
              ? 'bg-primary-500 text-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 inline mr-1 sm:mr-2" />
          {t.mySpace.tasks.completedTasks} ({taskHistory.length})
        </button>
        <button
          onClick={() => setSubTab('validations')}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'validations'
              ? 'bg-primary-500 text-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-1 sm:mr-2" />
          {t.mySpace.tasks.submittedDays} ({validationHistory.length})
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{t.mySpace.tasks.period}</span>
          </div>

          <CustomSelect
            value={periodFilter}
            onChange={setPeriodFilter}
            className="min-w-[160px]"
            options={[
              { value: '0', label: t.mySpace.tasks.todayLabel },
              { value: '1', label: t.mySpace.tasks.yesterday },
              { value: '7', label: t.mySpace.tasks.last7Days },
              { value: '30', label: t.mySpace.tasks.last30Days },
              { value: '90', label: t.mySpace.tasks.last3Months },
              { value: 'all', label: t.mySpace.tasks.allTime },
            ]}
          />

          {subTab === 'validations' && (
            <>
              <span className="text-sm font-medium text-gray-700">{t.mySpace.tasks.statusLabel}</span>
              <CustomSelect
                value={validationStatusFilter}
                onChange={setValidationStatusFilter}
                className="min-w-[140px]"
                options={[
                  { value: 'all', label: t.common.all },
                  { value: 'approved', label: t.mySpace.tasks.validated },
                  { value: 'rejected', label: t.mySpace.tasks.rejected },
                  { value: 'pending', label: t.mySpace.tasks.pending },
                ]}
              />
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-gray-400" />
            {subTab === 'tasks' ? t.mySpace.tasks.completedTasks : t.mySpace.tasks.submittedDays} ({currentData.length})
          </h2>
        </div>

        {paginatedData.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {subTab === 'tasks' ? (
                <CheckCircle2 className="w-8 h-8 text-gray-400" />
              ) : (
                <Calendar className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <p className="text-gray-500">{t.mySpace.tasks.noItemFound}</p>
          </div>
        ) : subTab === 'tasks' ? (
          <div className="p-4 space-y-3">
            {(paginatedData as Task[]).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isLoading={false}
              />
            ))}
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {(paginatedData as DailyValidation[]).map((validation) => (
              <div key={validation.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    validation.status === 'approved' ? 'bg-green-100' :
                    validation.status === 'rejected' ? 'bg-red-100' :
                    'bg-yellow-100'
                  }`}>
                    {validation.status === 'approved' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : validation.status === 'rejected' ? (
                      <X className="w-5 h-5 text-red-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(validation.validation_date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {validation.completed_tasks}/{validation.total_tasks} {t.mySpace.tasks.tasksLabel} • {validation.completion_rate.toFixed(0)}%
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    validation.status === 'approved' ? 'bg-green-100 text-green-800' :
                    validation.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {validation.status === 'approved' ? t.mySpace.tasks.validated :
                     validation.status === 'rejected' ? t.mySpace.tasks.rejected : t.mySpace.tasks.pending}
                  </span>
                  {validation.validation_comment && (
                    <p className="text-xs text-gray-500 mt-1 max-w-[200px] truncate">
                      {validation.validation_comment}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            <div className="p-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// ONGLET 4: STATS
// ============================================
function StatsTab({
  isManager,
  teamMembers,
}: {
  isManager: boolean;
  teamMembers: TeamMember[];
}) {
  const { t } = useI18n();
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [validationHistory, setValidationHistory] = useState<DailyValidation[]>([]);
  const [taskHistory, setTaskHistory] = useState<Task[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>('30');

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsData, validations, tasks] = await Promise.all([
        getMyTaskStats(),
        getValidationHistory({ page_size: 50 }),
        getMyTasks({ page_size: 100 }),
      ]);

      setStats(statsData);
      setValidationHistory(validations.items || []);
      setTaskHistory(tasks.items || []);

      if (isManager) {
        const team = await getTeamTasks({ page_size: 100 });
        setTeamTasks(team.items || []);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [periodFilter, isManager]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const totalTasks = taskHistory.length;
  const completedTasks = taskHistory.filter(t => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const validatedDays = validationHistory.filter(v => v.status === 'approved').length;
  const rejectedDays = validationHistory.filter(v => v.status === 'rejected').length;
  const pendingDays = validationHistory.filter(v => v.status === 'pending').length;

  const suggestions: { type: 'success' | 'warning' | 'info' | 'error'; icon: React.ReactNode; message: string }[] = [];

  if (stats) {
    const totalActive = stats.pending + stats.in_progress + stats.completed;
    const currentRate = totalActive > 0 ? (stats.completed / totalActive) * 100 : 0;

    if (currentRate < 50 && totalActive > 0) {
      suggestions.push({
        type: 'warning',
        icon: <AlertTriangle className="w-5 h-5" />,
        message: t.mySpace.tasks.lowCompletionRate,
      });
    } else if (currentRate >= 80 && totalActive > 0) {
      suggestions.push({
        type: 'success',
        icon: <Award className="w-5 h-5" />,
        message: t.mySpace.tasks.excellentWork,
      });
    } else if (currentRate >= 50 && currentRate < 80 && totalActive > 0) {
      suggestions.push({
        type: 'info',
        icon: <Target className="w-5 h-5" />,
        message: t.mySpace.tasks.goodWorkRemaining.replace('{count}', String(Math.ceil((0.8 * totalActive) - stats.completed))),
      });
    }

    if (stats.overdue > 0) {
      suggestions.push({
        type: 'error',
        icon: <Clock className="w-5 h-5" />,
        message: t.mySpace.tasks.overdueToHandle.replace('{count}', String(stats.overdue)),
      });
    }

    if (stats.due_today > 3) {
      suggestions.push({
        type: 'info',
        icon: <Target className="w-5 h-5" />,
        message: t.mySpace.tasks.manyTasksToday.replace('{count}', String(stats.due_today)),
      });
    } else if (stats.due_today > 0 && stats.due_today <= 3) {
      suggestions.push({
        type: 'success',
        icon: <CheckCircle2 className="w-5 h-5" />,
        message: t.mySpace.tasks.fewTasksToday.replace('{count}', String(stats.due_today)),
      });
    }

    if (stats.pending === 0 && stats.in_progress === 0 && totalActive > 0) {
      suggestions.push({
        type: 'success',
        icon: <Award className="w-5 h-5" />,
        message: t.mySpace.tasks.allTasksDone,
      });
    }
  }

  if (validatedDays > 0 && rejectedDays === 0) {
    suggestions.push({
      type: 'success',
      icon: <CheckCircle2 className="w-5 h-5" />,
      message: t.mySpace.tasks.daysValidatedNoReject.replace('{count}', String(validatedDays)),
    });
  }

  if (rejectedDays >= 2) {
    suggestions.push({
      type: 'warning',
      icon: <MessageSquare className="w-5 h-5" />,
      message: t.mySpace.tasks.multipleDaysRejected,
    });
  } else if (rejectedDays === 1) {
    suggestions.push({
      type: 'info',
      icon: <MessageSquare className="w-5 h-5" />,
      message: t.mySpace.tasks.oneDayRejected,
    });
  }

  if (pendingDays > 0) {
    suggestions.push({
      type: 'info',
      icon: <Clock className="w-5 h-5" />,
      message: t.mySpace.tasks.daysPendingValidation.replace('{count}', String(pendingDays)),
    });
  }

  if (isManager && teamTasks.length > 0) {
    teamMembers.forEach(member => {
      const memberTasks = teamTasks.filter(mt => mt.assigned_to_id === member.id);
      const memberOverdue = memberTasks.filter(mt => mt.is_overdue && mt.status !== 'completed').length;

      if (memberOverdue >= 3) {
        suggestions.push({
          type: 'warning',
          icon: <User className="w-5 h-5" />,
          message: t.mySpace.tasks.memberOverdueTasks.replace('{name}', member.name).replace('{count}', String(memberOverdue)),
        });
      }
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{t.mySpace.tasks.period}</span>
          <CustomSelect
            value={periodFilter}
            onChange={setPeriodFilter}
            className="min-w-[160px]"
            options={[
              { value: '7', label: t.mySpace.tasks.periodThisWeek },
              { value: '30', label: t.mySpace.tasks.periodThisMonth },
              { value: '90', label: t.mySpace.tasks.periodThisQuarter },
            ]}
          />
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            {t.mySpace.tasks.personalizedSuggestions}
          </h3>
          <div className="grid gap-3">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  suggestion.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                  suggestion.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                  suggestion.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                  'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                <div className={`flex-shrink-0 ${
                  suggestion.type === 'success' ? 'text-green-600' :
                  suggestion.type === 'warning' ? 'text-yellow-600' :
                  suggestion.type === 'error' ? 'text-red-600' :
                  'text-blue-600'
                }`}>
                  {suggestion.icon}
                </div>
                <p className="text-sm">{suggestion.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-gray-400" />
          {t.mySpace.tasks.myStats}
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-3xl font-bold text-primary-600">{completionRate.toFixed(0)}%</p>
            <p className="text-sm text-gray-500 mt-1">{t.mySpace.tasks.completionRate}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-3xl font-bold text-green-600">{validatedDays}</p>
            <p className="text-sm text-gray-500 mt-1">{t.mySpace.tasks.validatedDays}</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <p className="text-3xl font-bold text-red-600">{rejectedDays}</p>
            <p className="text-sm text-gray-500 mt-1">{t.mySpace.tasks.rejectedDays}</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-xl">
            <p className="text-3xl font-bold text-yellow-600">{pendingDays}</p>
            <p className="text-sm text-gray-500 mt-1">{t.mySpace.tasks.pending}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{t.mySpace.tasks.globalPerformance}</span>
            <span>{completedTasks}/{totalTasks} {t.mySpace.tasks.tasksLabel}</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                completionRate >= 80 ? 'bg-green-500' :
                completionRate >= 50 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {isManager && teamMembers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            {t.mySpace.tasks.teamPerformance}
          </h3>
          
          <div className="space-y-4">
            {teamMembers.map((member) => {
              const memberTasks = teamTasks.filter(t => t.assigned_to_id === member.id);
              const memberCompleted = memberTasks.filter(t => t.status === 'completed').length;
              const memberRate = memberTasks.length > 0 ? (memberCompleted / memberTasks.length) * 100 : 0;
              const memberOverdue = memberTasks.filter(t => t.is_overdue && t.status !== 'completed').length;

              return (
                <div key={member.id} className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <div className="flex items-center gap-2">
                        {memberOverdue > 0 && (
                          <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                            {memberOverdue} {t.mySpace.tasks.overdueBadge}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          {memberCompleted}/{memberTasks.length}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          memberRate >= 80 ? 'bg-green-500' :
                          memberRate >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${memberRate}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-sm font-medium w-12 text-right ${
                    memberRate >= 80 ? 'text-green-600' :
                    memberRate >= 50 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {memberRate.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================
export default function MyTasksPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'my-tasks' | 'team-tasks' | 'history' | 'stats'>('my-tasks');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number>(0);
  const [isManager, setIsManager] = useState(false);
  const [hasManager, setHasManager] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { showTips, dismissTips, resetTips } = usePageTour('tasks');

  useEffect(() => {
    async function loadInitialData() {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          const employeeId = user.employee_id || 0;
          setCurrentEmployeeId(employeeId);
          const userIsManager = ['ADMIN', 'MANAGER', 'RH', 'DG'].includes(user.role?.toUpperCase());
          setIsManager(userIsManager);

          if (employeeId) {
            try {
              const employeeData = await getEmployee(employeeId);
              setHasManager(!!employeeData?.manager_id);
            } catch (err) {
              console.error('Error fetching employee:', err);
              setHasManager(false);
            }
          }

          if (userIsManager) {
            getTeamMembers().then(setTeamMembers).catch(console.error);
          }
        } catch {
          console.error('Error parsing user');
        }
      }
      setIsLoading(false);
    }

    loadInitialData();
  }, []);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <>
      {showTips && (
        <PageTourTips pageId="tasks" onDismiss={dismissTips} pageTitle={t.mySpace.tasks.title} />
      )}
      <Header title={t.mySpace.tasks.title} subtitle={t.mySpace.tasks.subtitle} />
      <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-end mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.mySpace.tasks.newTask}
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('my-tasks')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'my-tasks'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            {t.mySpace.tasks.myTasks}
          </button>

          {isManager && (
            <button
              onClick={() => setActiveTab('team-tasks')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'team-tasks'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              {t.mySpace.tasks.teamTasks}
              {teamMembers.length > 0 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {teamMembers.length}
                </span>
              )}
            </button>
          )}
          
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-4 h-4" />
            {t.mySpace.tasks.history}
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'stats'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {t.mySpace.tasks.stats}
          </button>
        </div>

        {/* Contenu des onglets */}
        {activeTab === 'my-tasks' && (
          <MyTasksTab key={refreshKey} onRefresh={handleRefresh} hasManager={hasManager} />
        )}
        
        {activeTab === 'team-tasks' && isManager && (
          <TeamTasksTab teamMembers={teamMembers} />
        )}
        
        {activeTab === 'history' && (
          <HistoryTab />
        )}
        
        {activeTab === 'stats' && (
          <StatsTab isManager={isManager} teamMembers={teamMembers} />
        )}

        {/* Modal création */}
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleRefresh}
          currentEmployeeId={currentEmployeeId}
          teamMembers={teamMembers}
        />
      </div>
    </div>
    </>
  );
}
