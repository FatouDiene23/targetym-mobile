'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, Loader2, RefreshCw, X, Calendar,
  CheckCircle, Clock, AlertCircle, XCircle, PlayCircle,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================
// TYPES
// ============================================

interface Assignment {
  id: number;
  employee_id: number;
  employee_name?: string;
  employee_initials?: string;
  course_id: number;
  course_title?: string;
  course_image?: string;
  course_duration?: number;
  status: string;
  deadline?: string;
  assigned_at?: string;
  completed_at?: string;
  certificate_file?: string;
}

interface Course {
  id: number;
  title: string;
  duration_hours?: number;
  category?: string;
}

interface Employee {
  id: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

// ============================================
// CONFIG
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  assigned:           { label: 'Assignée',              color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: BookOpen },
  in_progress:        { label: 'En cours',              color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: PlayCircle },
  pending_validation: { label: 'En attente validation', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertCircle },
  completed:          { label: 'Terminée',              color: 'bg-green-100 text-green-700 border-green-200',   icon: CheckCircle },
  rejected:           { label: 'Rejetée',               color: 'bg-red-100 text-red-700 border-red-200',        icon: XCircle },
};

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function empName(e: Employee) {
  return e.full_name || `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() || `#${e.id}`;
}

// ============================================
// ASSIGN MODAL
// ============================================

interface AssignModalProps {
  employees: Employee[];
  courses: Course[];
  onSave: (employeeId: number, courseId: number, deadline: string) => Promise<void>;
  onClose: () => void;
}

function AssignModal({ employees, courses, onSave, onClose }: AssignModalProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  const filteredEmps = employees.filter(e =>
    empSearch === '' || empName(e).toLowerCase().includes(empSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !courseId) { toast.error('Sélectionnez un collaborateur et une formation'); return; }
    setSaving(true);
    try {
      await onSave(Number(employeeId), Number(courseId), deadline);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Assigner une formation</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Employee search + select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Collaborateur <span className="text-red-500">*</span></label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un collaborateur..."
                value={empSearch}
                onChange={e => {
                  const val = e.target.value;
                  setEmpSearch(val);
                  // Si l'employé sélectionné disparaît des résultats filtrés, on réinitialise
                  if (employeeId) {
                    const selected = employees.find(emp => String(emp.id) === employeeId);
                    if (selected && !empName(selected).toLowerCase().includes(val.toLowerCase())) {
                      setEmployeeId('');
                    }
                  }
                }}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              size={5}
            >
              <option value="">— Sélectionner —</option>
              {filteredEmps.map(e => (
                <option key={e.id} value={e.id}>{empName(e)}</option>
              ))}
            </select>
          </div>

          {/* Course select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Formation <span className="text-red-500">*</span></label>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">— Sélectionner une formation —</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title}{c.duration_hours ? ` (${c.duration_hours}h)` : ''}{c.category ? ` — ${c.category}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date limite <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Assigner
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// STATUS BADGE
// ============================================

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface FormationsTabProps {
  employeesList?: Employee[];
}

export default function FormationsTab({ employeesList = [] }: FormationsTabProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(employeesList);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // ── Fetch data ──────────────────────────────────────

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/learning/assignments/?page_size=500');
      setAssignments(data.items ?? data ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast.error(`Impossible de charger les formations : ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCourses = useCallback(async () => {
    try {
      const data = await apiFetch('/api/learning/courses/?page_size=500');
      setCourses(data.items ?? data ?? []);
    } catch {
      // Non-blocking
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    if (employeesList.length > 0) { setEmployees(employeesList); return; }
    try {
      const data = await apiFetch('/api/employees/?page_size=500');
      setEmployees(data.items ?? data ?? []);
    } catch {
      // Non-blocking
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // tableau vide : on ne re-fetch pas à chaque changement de prop

  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => { loadCourses(); }, [loadCourses]);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  // Sync prop → state si les employés sont chargés après le montage
  useEffect(() => {
    if (employeesList.length > 0) setEmployees(employeesList);
  }, [employeesList]);

  // ── Assign ──────────────────────────────────────────

  const handleAssign = async (employeeId: number, courseId: number, deadline: string) => {
    const body: Record<string, unknown> = { employee_id: employeeId, course_id: courseId };
    if (deadline) body.deadline = deadline;
    await apiFetch('/api/learning/assignments/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    toast.success('Formation assignée avec succès');
    await loadAssignments();
  };

  // ── Filtered rows ────────────────────────────────────

  const filtered = assignments.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (a.employee_name ?? '').toLowerCase();
      const title = (a.course_title ?? '').toLowerCase();
      if (!name.includes(q) && !title.includes(q)) return false;
    }
    return true;
  });

  // ── Stats ────────────────────────────────────────────

  const stats = {
    total:    assignments.length,
    assigned: assignments.filter(a => a.status === 'assigned').length,
    progress: assignments.filter(a => a.status === 'in_progress').length,
    done:     assignments.filter(a => a.status === 'completed').length,
  };

  // ── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',        value: stats.total,    color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200' },
          { label: 'À faire',      value: stats.assigned, color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
          { label: 'En cours',     value: stats.progress, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
          { label: 'Terminées',    value: stats.done,     color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-1 gap-3 flex-col sm:flex-row w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher collaborateur ou formation..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={loadAssignments}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              Assigner une formation
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mr-3" />
            <span className="text-gray-500">Chargement...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Aucune formation trouvée</p>
            <p className="text-sm text-gray-400 mt-1">
              {search || filterStatus ? 'Modifiez vos filtres' : 'Cliquez sur « Assigner une formation » pour commencer'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Collaborateur</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Formation</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date limite</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Assignée le</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Terminée le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">
                          {a.employee_initials ?? (a.employee_name ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{a.employee_name ?? `#${a.employee_id}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{a.course_title ?? `Formation #${a.course_id}`}</div>
                      {a.course_duration != null && (
                        <div className="text-xs text-gray-400">{a.course_duration}h</div>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(a.deadline)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(a.assigned_at)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(a.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
                {filtered.length} formation{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
                {assignments.length !== filtered.length && ` sur ${assignments.length}`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign modal */}
      {showModal && (
        <AssignModal
          employees={employees}
          courses={courses}
          onSave={handleAssign}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
