'use client';

import { useState, useEffect } from 'react';
import { 
  ClipboardList, Clock, Plus, CheckCircle2, Circle, AlertTriangle,
  Play, Check, X, Send, Calendar, Flag, MoreVertical, Loader2,
  ChevronDown, ChevronUp, User, MessageSquare, Users, Filter
} from 'lucide-react';
import { 
  getMyTasksToday, getMyTaskStats, completeTask, startTask, createTask,
  getMyDailyValidationStatus, submitDailyValidation,
  getPendingValidations, validateDaily, deleteTask, getTeamMembers, getTeamTasks,
  type Task, type TaskStats, type TaskPriority, type PendingValidation, type TeamMember
} from '@/lib/api';

// Couleurs par priorité
const PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Basse' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Moyenne' },
  high: { bg: 'bg-orange-100', text: 'text-orange-600', label: 'Haute' },
  urgent: { bg: 'bg-red-100', text: 'text-red-600', label: 'Urgente' },
};

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
                          Démarrer
                        </button>
                      )}
                      <button
                        onClick={() => { onDelete(task.id); setShowMenu(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Annuler
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
            {/* Assigné à (pour vue équipe) */}
            {showAssignee && task.assigned_to_name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                <User className="w-3 h-3" />
                {task.assigned_to_name}
              </span>
            )}

            {/* Priorité */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${priority.bg} ${priority.text}`}>
              <Flag className="w-3 h-3" />
              {priority.label}
            </span>

            {/* Statut */}
            {isInProgress && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600">
                <Play className="w-3 h-3" />
                En cours
              </span>
            )}

            {/* En retard */}
            {isOverdue && !isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
                <AlertTriangle className="w-3 h-3" />
                En retard
              </span>
            )}

            {/* Date */}
            <span className={`inline-flex items-center gap-1 text-xs ${isOverdue && !isCompleted ? 'text-red-500' : 'text-gray-400'}`}>
              <Calendar className="w-3 h-3" />
              {new Date(task.due_date).toLocaleDateString('fr-FR')}
            </span>

            {/* Assigné par */}
            {!showAssignee && task.created_by_id !== task.assigned_to_id && task.created_by_name && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <User className="w-3 h-3" />
                Par {task.created_by_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to_id: currentEmployeeId.toString(),
    due_date: new Date().toISOString().split('T')[0],
    priority: 'medium' as TaskPriority,
  });

  // Reset assigned_to_id quand currentEmployeeId change
  useEffect(() => {
    if (currentEmployeeId) {
      setFormData(prev => ({ ...prev, assigned_to_id: currentEmployeeId.toString() }));
    }
  }, [currentEmployeeId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await createTask({
        title: formData.title,
        description: formData.description || undefined,
        assigned_to_id: parseInt(formData.assigned_to_id),
        due_date: formData.due_date,
        priority: formData.priority,
      });
      onSuccess();
      onClose();
      setFormData({
        title: '',
        description: '',
        assigned_to_id: currentEmployeeId.toString(),
        due_date: new Date().toISOString().split('T')[0],
        priority: 'medium',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Nouvelle tâche</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Préparer le rapport mensuel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Détails de la tâche..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Champ d'assignation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigner à
                </label>
                <select
                  value={formData.assigned_to_id}
                  onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value={currentEmployeeId}>Moi-même</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} {member.job_title ? `(${member.job_title})` : ''}
                    </option>
                  ))}
                </select>
                {teamMembers.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Vous pouvez uniquement créer des tâches pour vous-même
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date d&apos;échéance *
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priorité
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Créer
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [reasons, setReasons] = useState<Record<number, string>>({});

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const missingReasons = incompleteTasks.filter(t => !reasons[t.id]?.trim());
    if (missingReasons.length > 0) {
      setError('Veuillez justifier toutes les tâches non terminées');
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
      setError(err instanceof Error ? err.message : 'Erreur lors de la soumission');
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
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Soumettre ma journée</h2>
            <p className="text-sm text-gray-500 mb-4">
              Votre manager sera notifié et devra valider votre journée.
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
                    Tâches non terminées ({incompleteTasks.length})
                  </h3>
                  <p className="text-sm text-orange-700 mb-3">
                    Veuillez justifier pourquoi ces tâches n&apos;ont pas été terminées :
                  </p>
                  <div className="space-y-3">
                    {incompleteTasks.map((task) => (
                      <div key={task.id} className="bg-white rounded-lg p-3 border border-orange-100">
                        <p className="font-medium text-gray-900 text-sm mb-2">{task.title}</p>
                        <textarea
                          value={reasons[task.id] || ''}
                          onChange={(e) => setReasons({ ...reasons, [task.id]: e.target.value })}
                          placeholder="Raison..."
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
                  Note pour votre manager (optionnel)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Commentaire sur votre journée..."
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
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Soumettre
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  if (validations.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
      <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        Journées à valider ({validations.length})
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
                    {validation.completed_tasks}/{validation.total_tasks} tâches • {validation.completion_rate.toFixed(0)}%
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
                      Note :
                    </p>
                    <p className="text-gray-700">{validation.submission_note}</p>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Commentaire (optionnel)..."
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
                      Rejeter
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
                      Valider
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

// Section Tâches de l'équipe (Manager)
function TeamTasksSection({
  teamMembers,
  isLoading: parentLoading,
}: {
  teamMembers: TeamMember[];
  isLoading: boolean;
}) {
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    loadTeamTasks();
  }, []);

  async function loadTeamTasks() {
    setIsLoading(true);
    try {
      const data = await getTeamTasks();
      setTeamTasks(data.items || []);
    } catch (err) {
      console.error('Error loading team tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredTasks = teamTasks.filter(task => {
    const matchEmployee = selectedEmployee === 'all' || task.assigned_to_id.toString() === selectedEmployee;
    const matchStatus = selectedStatus === 'all' || task.status === selectedStatus;
    return matchEmployee && matchStatus;
  });

  const tasksByStatus = {
    pending: filteredTasks.filter(t => t.status === 'pending').length,
    in_progress: filteredTasks.filter(t => t.status === 'in_progress').length,
    completed: filteredTasks.filter(t => t.status === 'completed').length,
    overdue: filteredTasks.filter(t => t.is_overdue && t.status !== 'completed').length,
  };

  if (isLoading || parentLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats de l'équipe */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">À faire</p>
          <p className="text-2xl font-bold text-gray-900">{tasksByStatus.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">En cours</p>
          <p className="text-2xl font-bold text-blue-600">{tasksByStatus.in_progress}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Terminées</p>
          <p className="text-2xl font-bold text-green-600">{tasksByStatus.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">En retard</p>
          <p className="text-2xl font-bold text-red-600">{tasksByStatus.overdue}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filtres :</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Employé :</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Tous ({teamMembers.length})</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Statut :</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Tous</option>
              <option value="pending">À faire</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminées</option>
            </select>
          </div>

          <button
            onClick={loadTeamTasks}
            className="ml-auto px-3 py-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Actualiser
          </button>
        </div>
      </div>

      {/* Liste des tâches */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gray-400" />
            Tâches de l&apos;équipe ({filteredTasks.length})
          </h2>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">Aucune tâche trouvée</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isLoading={false}
                showAssignee={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Page principale
export default function MyTasksPage() {
  const [activeTab, setActiveTab] = useState<'my-tasks' | 'team-tasks'>('my-tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [validationStatus, setValidationStatus] = useState<{
    validation: {
      status: string;
      validation_comment?: string;
    } | null;
    can_submit: boolean;
    tasks_total: number;
    tasks_completed: number;
    all_completed: boolean;
  } | null>(null);
  const [pendingValidations, setPendingValidations] = useState<PendingValidation[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number>(0);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentEmployeeId(user.employee_id || 0);
        const userIsManager = ['ADMIN', 'MANAGER', 'RH', 'DG'].includes(user.role?.toUpperCase());
        setIsManager(userIsManager);
      } catch {
        console.error('Error parsing user');
      }
    }
    
    loadData();
  }, []);

  async function loadData() {
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

      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        
        if (['ADMIN', 'MANAGER', 'RH', 'DG'].includes(user.role?.toUpperCase())) {
          try {
            const [pending, team] = await Promise.all([
              getPendingValidations(),
              getTeamMembers()
            ]);
            setPendingValidations(pending);
            setTeamMembers(team);
          } catch (err) {
            console.error('Error loading manager data:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error loading tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCompleteTask(taskId: number) {
    setActionLoading(true);
    try {
      await completeTask(taskId);
      await loadData();
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
    if (!confirm('Annuler cette tâche ?')) return;
    setActionLoading(true);
    try {
      await deleteTask(taskId);
      await loadData();
    } catch (err) {
      console.error('Error deleting task:', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleValidateDay(validationId: number, approved: boolean, comment?: string) {
    setActionLoading(true);
    try {
      await validateDaily(validationId, approved, comment);
      await loadData();
    } catch (err) {
      console.error('Error validating day:', err);
    } finally {
      setActionLoading(false);
    }
  }

  const incompleteTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const canSubmitDay = validationStatus?.can_submit && tasks.length > 0;

  if (isLoading) {
    return (
      <div className="py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Tâches</h1>
            <p className="text-gray-500 mt-1">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouvelle tâche
          </button>
        </div>

        {/* Onglets (visible seulement pour les managers) */}
        {isManager && (
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('my-tasks')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'my-tasks'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Mes Tâches
            </button>
            <button
              onClick={() => setActiveTab('team-tasks')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'team-tasks'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              Tâches Équipe
              {teamMembers.length > 0 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {teamMembers.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Contenu selon l'onglet */}
        {activeTab === 'my-tasks' ? (
          <>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">À faire</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending + stats.in_progress}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Terminées</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">En retard</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-500">Aujourd&apos;hui</p>
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
            {validationStatus?.validation && (
              <div className={`rounded-xl p-4 mb-6 ${
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
                        ? 'Journée validée ✓' 
                        : validationStatus.validation.status === 'rejected'
                        ? 'Journée rejetée'
                        : 'En attente de validation'}
                    </p>
                    {validationStatus.validation.validation_comment && (
                      <p className="text-sm opacity-75">
                        Commentaire : {validationStatus.validation.validation_comment}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Liste des tâches */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-gray-400" />
                  Tâches du jour
                </h2>
                {canSubmitDay && (
                  <button
                    onClick={() => setShowSubmitModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    Soumettre ma journée
                  </button>
                )}
              </div>

              {tasks.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500">Aucune tâche pour aujourd&apos;hui</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
                  >
                    + Ajouter une tâche
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {incompleteTasks.length > 0 && (
                    <div className="p-4 space-y-3">
                      {incompleteTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={handleCompleteTask}
                          onStart={handleStartTask}
                          onDelete={handleDeleteTask}
                          isLoading={actionLoading}
                        />
                      ))}
                    </div>
                  )}

                  {completedTasks.length > 0 && (
                    <div className="p-4 bg-gray-50">
                      <p className="text-sm font-medium text-gray-500 mb-3">
                        Terminées ({completedTasks.length})
                      </p>
                      <div className="space-y-3">
                        {completedTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onComplete={handleCompleteTask}
                            onStart={handleStartTask}
                            onDelete={handleDeleteTask}
                            isLoading={actionLoading}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <TeamTasksSection
            teamMembers={teamMembers}
            isLoading={isLoading}
          />
        )}

        {/* Modals */}
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={loadData}
          currentEmployeeId={currentEmployeeId}
          teamMembers={teamMembers}
        />

        <SubmitDayModal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onSuccess={loadData}
          incompleteTasks={incompleteTasks}
        />
      </div>
    </div>
  );
}