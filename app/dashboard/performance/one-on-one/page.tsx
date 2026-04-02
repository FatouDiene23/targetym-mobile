'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Calendar, Clock, MapPin, X, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight, Video, ClipboardCheck, Star, Plus, Trash2, ListTodo
} from 'lucide-react';
import PerformanceStats from '../components/PerformanceStats';
import Header from '@/components/Header';

// =============================================
// TYPES
// =============================================

interface OneOnOne {
  id: number;
  employee_id: number;
  employee_name?: string;
  employee_initials?: string;
  manager_id: number;
  manager_name?: string;
  scheduled_date: string;
  duration_minutes: number;
  location?: string;
  status: string;
  notes?: string;
  action_items?: string[];
  topics?: string[];
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
}

interface CurrentUser {
  id: number;
  role: string;
  employee_id?: number;
}

// =============================================
// API
// =============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');
const ITEMS_PER_PAGE = 10;

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchOneOnOnes(): Promise<OneOnOne[]> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones?page_size=100`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function fetchEmployees(managerId?: number): Promise<Employee[]> {
  try {
    let url = `${API_URL}/api/employees/?page_size=200&status=active`;
    if (managerId) url += `&manager_id=${managerId}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

async function completeOneOnOne(id: number, data: {
  notes: string;
  evaluation_score?: number;
  evaluation_comment?: string;
  action_items?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones/${id}/complete`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la mise à jour' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion' };
  }
}

async function createTask(data: {
  title: string;
  assigned_to_id: number;
  due_date: string;
  priority: string;
  is_administrative: boolean;
  description?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.detail || 'Erreur création tâche' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur réseau' };
  }
}

async function createOneOnOne(data: {
  employee_id: number; scheduled_date: string; duration_minutes: number; location?: string; topics?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/api/performance/one-on-ones`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.detail || 'Erreur lors de la création' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erreur de connexion' };
  }
}

// =============================================
// HELPERS
// =============================================

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'scheduled': return 'bg-blue-100 text-blue-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed': return 'Terminé';
    case 'scheduled': return 'Planifié';
    case 'cancelled': return 'Annulé';
    default: return status;
  }
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string | undefined): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// =============================================
// COMPONENTS
// =============================================

function Pagination({ currentPage, totalPages, onPageChange }: {
  currentPage: number; totalPages: number; onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= Math.min(5, totalPages); i++) {
      let pageNum: number;
      if (totalPages <= 5) pageNum = i;
      else if (currentPage <= 3) pageNum = i;
      else if (currentPage >= totalPages - 2) pageNum = totalPages - 5 + i;
      else pageNum = currentPage - 3 + i;
      pages.push(pageNum);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1">
        {getPageNumbers().map(pageNum => (
          <button key={pageNum} onClick={() => onPageChange(pageNum)} className={`w-8 h-8 rounded-lg text-sm font-medium ${currentPage === pageNum ? 'bg-primary-500 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
            {pageNum}
          </button>
        ))}
      </div>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50">
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-500 ml-2">Page {currentPage}/{totalPages}</span>
    </div>
  );
}

function CreateOneOnOneModal({ isOpen, onClose, employees, onSuccess }: {
  isOpen: boolean; onClose: () => void; employees: Employee[]; onSuccess: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('');
  const [topics, setTopics] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!employeeId || !scheduledDate) { setError('Veuillez sélectionner un employé et une date'); return; }
    setError(''); setSaving(true);
    const dateTime = `${scheduledDate}T${scheduledTime}:00`;
    const topicsList = topics.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    const result = await createOneOnOne({ 
      employee_id: parseInt(employeeId), 
      scheduled_date: dateTime, 
      duration_minutes: duration, 
      location: location || undefined, 
      topics: topicsList.length > 0 ? topicsList : undefined 
    });
    setSaving(false);
    if (result.success) { 
      setEmployeeId(''); setScheduledDate(''); setScheduledTime('09:00'); 
      setDuration(30); setLocation(''); setTopics(''); 
      onSuccess(); onClose(); 
    }
    else setError(result.error || 'Erreur lors de la création');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Planifier un 1-on-1</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collaborateur *</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
              <option value="">Sélectionner un collaborateur</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Heure</label>
              <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Durée</label>
              <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full px-3 py-2.5 border rounded-lg text-sm">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 heure</option>
                <option value={90}>1h30</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lieu</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bureau, Visio..." className="w-full px-3 py-2.5 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sujets à aborder</label>
            <textarea value={topics} onChange={(e) => setTopics(e.target.value)} rows={3} placeholder="Un sujet par ligne..." className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" />
          </div>
        </div>
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg flex items-center disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}Planifier
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// EVALUATE MODAL
// =============================================

interface TaskDraft {
  id: string;
  title: string;
  assigned_to_id: number;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

function EvaluateModal({ meeting, onClose, onSuccess }: {
  meeting: OneOnOne; onClose: () => void; onSuccess: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 7);
  const defaultDue = tomorrow.toISOString().split('T')[0];

  const addTask = () => {
    setTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      title: '',
      assigned_to_id: meeting.employee_id,
      due_date: defaultDue,
      priority: 'medium',
    }]);
  };

  const updateTask = (id: string, field: keyof TaskDraft, value: string | number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  const handleSubmit = async () => {
    if (notes.trim().length < 10) { toast.error('Les notes doivent contenir au moins 10 caractères'); return; }
    const invalidTask = tasks.find(t => !t.title.trim());
    if (invalidTask) { toast.error('Toutes les tâches doivent avoir un titre'); return; }

    setSaving(true);
    const toastId = toast.loading('Enregistrement en cours…');

    // 1. Complete the one-on-one
    const result = await completeOneOnOne(meeting.id, {
      notes: notes.trim(),
      evaluation_score: score > 0 ? score : undefined,
      evaluation_comment: comment.trim() || undefined,
      action_items: tasks.map(t => t.title.trim()).filter(Boolean),
    });

    if (!result.success) {
      toast.error(result.error || 'Erreur', { id: toastId });
      setSaving(false);
      return;
    }

    // 2. Create tasks
    let taskErrors = 0;
    const taskErrorMessages: string[] = [];
    for (const task of tasks) {
      const res = await createTask({
        title: task.title.trim(),
        assigned_to_id: task.assigned_to_id,
        due_date: task.due_date,
        priority: task.priority,
        is_administrative: true,
        description: `Issue du 1-on-1 avec ${task.assigned_to_id === meeting.employee_id ? meeting.manager_name : meeting.employee_name}`,
      });
      if (!res.success) {
        taskErrors++;
        if (res.error) taskErrorMessages.push(res.error);
      }
    }

    setSaving(false);
    if (taskErrors > 0) {
      const errDetail = taskErrorMessages.length > 0 ? ` (${taskErrorMessages[0]})` : '';
      toast.error(`${taskErrors} tâche(s) non créée(s)${errDetail}`, { id: toastId });
    } else if (tasks.length > 0) {
      toast.success(`Entretien évalué · ${tasks.length} tâche(s) créée(s)`, { id: toastId });
    } else {
      toast.success('Entretien évalué', { id: toastId });
    }
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Report d&apos;entretien</h2>
              <p className="text-sm text-gray-500">{meeting.employee_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Scrollable body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes de l&apos;entretien <span className="text-red-500">*</span></label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={4} placeholder="Résumé des points abordés, décisions prises… (min 10 car.)"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Qualité de l&apos;entretien</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setScore(score === n ? 0 : n)}
                  className={`p-1 transition-colors ${n <= score ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}>
                  <Star className="w-7 h-7 fill-current" />
                </button>
              ))}
              {score > 0 && <span className="ml-2 text-sm text-gray-500">{['', 'Mauvais', 'Passable', 'Bien', 'Très bien', 'Excellent'][score]}</span>}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Commentaire</label>
            <textarea
              value={comment} onChange={e => setComment(e.target.value)}
              rows={2} placeholder="Observations sur la qualité de l'entretien…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Tasks section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <ListTodo className="w-4 h-4 text-primary-500" />
                Tâches de suivi
                {tasks.length > 0 && <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full font-medium">{tasks.length}</span>}
              </label>
              <button type="button" onClick={addTask}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> Ajouter une tâche
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-400">Aucune tâche — cliquez « Ajouter » pour créer des actions de suivi visibles dans <span className="font-medium">Mes Tâches</span></p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task, i) => (
                  <div key={task.id} className="flex gap-2 items-start bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs flex items-center justify-center font-bold mt-2 shrink-0">{i + 1}</span>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text" placeholder="Titre de la tâche *"
                        value={task.title} onChange={e => updateTask(task.id, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 sm:col-span-2"
                      />
                      <select
                        value={task.assigned_to_id}
                        onChange={e => updateTask(task.id, 'assigned_to_id', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400"
                      >
                        <option value={meeting.employee_id}>→ {meeting.employee_name} (collaborateur)</option>
                        <option value={meeting.manager_id}>→ {meeting.manager_name} (moi)</option>
                      </select>
                      <div className="flex gap-2">
                        <input
                          type="date" value={task.due_date}
                          onChange={e => updateTask(task.id, 'due_date', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400"
                        />
                        <select
                          value={task.priority}
                          onChange={e => updateTask(task.id, 'priority', e.target.value)}
                          className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-400"
                        >
                          <option value="low">Faible</option>
                          <option value="medium">Moyenne</option>
                          <option value="high">Haute</option>
                          <option value="urgent">Urgente</option>
                        </select>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeTask(task.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg mt-1 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl shrink-0">
          <button onClick={onClose} className="px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-100">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            Marquer comme terminé{tasks.length > 0 ? ` · ${tasks.length} tâche(s)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MAIN PAGE
// =============================================

export default function OneOnOnePage() {
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userRole, setUserRole] = useState('employee');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [evaluating, setEvaluating] = useState<OneOnOne | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const user = await fetchCurrentUser();
    if (user) setUserRole(user.role?.toLowerCase() || 'employee');
    const role = user?.role?.toLowerCase() || 'employee';
    // Managers: ne charger que leurs N-1
    const managerId = role === 'manager' ? user?.employee_id : undefined;
    const [oneOnOnesData, employeesData] = await Promise.all([fetchOneOnOnes(), fetchEmployees(managerId)]);
    setOneOnOnes(oneOnOnesData);
    setEmployees(employeesData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener('one-on-one-add', handler);
    return () => window.removeEventListener('one-on-one-add', handler);
  }, []);

  const canScheduleOneOnOne = ['admin', 'super_admin', 'rh', 'dg', 'manager'].includes(userRole);

  const filteredOneOnOnes = oneOnOnes.filter(o => 
    o.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.manager_name?.toLowerCase().includes(search.toLowerCase())
  );
  const paginatedOneOnOnes = filteredOneOnOnes.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredOneOnOnes.length / ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header title="Entretiens 1-1" subtitle="Planifiez et gérez vos entretiens individuels" />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
      {/* Stats KPIs */}
      <PerformanceStats />

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
              placeholder="Rechercher un entretien..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
            />
          </div>
        </div>

        {/* One on Ones List */}
        <div className="space-y-3">
          {paginatedOneOnOnes.length > 0 ? paginatedOneOnOnes.map(meeting => (
            <div key={meeting.id} className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm">
                  {meeting.employee_initials || getInitials(meeting.employee_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900">{meeting.employee_name}</h3>
                  <p className="text-sm text-gray-500">avec {meeting.manager_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(meeting.scheduled_date)}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{meeting.duration_minutes} min</span>
                    {meeting.location && !meeting.location.startsWith('http') && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{meeting.location}</span>}
                  </div>
                </div>
                {meeting.location && meeting.location.startsWith('http') && meeting.status === 'scheduled' && (
                  <a
                    href={meeting.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6264A7] text-white text-xs font-medium rounded-lg hover:bg-[#525399] transition-colors shrink-0"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Rejoindre
                  </a>
                )}
                {meeting.status === 'scheduled' && new Date(meeting.scheduled_date) < new Date() && canScheduleOneOnOne && (
                  <button
                    onClick={() => setEvaluating(meeting)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors shrink-0"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    Report
                  </button>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>{getStatusLabel(meeting.status)}</span>
              </div>
              {meeting.topics && meeting.topics.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-1">Sujets:</p>
                  <div className="flex flex-wrap gap-1">
                    {meeting.topics.map((topic, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )) : (
            <p className="text-gray-500 text-center py-8">Aucun 1-on-1 trouvé</p>
          )}
        </div>

        {/* Pagination */}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Modals */}
      <CreateOneOnOneModal isOpen={showModal} onClose={() => setShowModal(false)} employees={employees} onSuccess={loadData} />
      {evaluating && <EvaluateModal meeting={evaluating} onClose={() => setEvaluating(null)} onSuccess={loadData} />}
      </main>
    </>
  );
}
