'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Clock, CheckCircle, XCircle, Plus, Loader2,
  RefreshCw, ChevronDown, ChevronUp, Calendar, User,
  ClipboardList, TrendingUp, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================
// TYPES
// ============================================

interface AbsenceReport {
  id: number;
  employee_id: number;
  employee_name?: string;
  type: string;
  status: string;
  absence_date: string;
  expected_start_time?: string;
  actual_start_time?: string;
  duration_minutes?: number;
  reason?: string;
  notes?: string;
  document?: string;
  notification_sent: boolean;
  reported_by_id: number;
  reporter_name?: string;
  created_at: string;
}

interface AbsenceStats {
  total: number;
  pending: number;
  justified: number;
  unjustified: number;
  last_7_days: number;
  last_30_days: number;
  by_type: { type: string; label: string; count: number }[];
  top_employees: { employee_id: number; name: string; count: number }[];
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
  const res = await fetch(`${API_URL}${url}`, { ...options, headers: { ...getAuthHeaders(), ...(options?.headers || {}) } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const TYPE_LABELS: Record<string, string> = {
  absence: 'Absence',
  tardiness: 'Retard',
  early_departure: 'Départ anticipé',
  unauthorized_absence: 'Absence non autorisée',
  sick_leave: 'Arrêt maladie',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:     { label: 'En attente',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',  icon: Clock },
  justified:   { label: 'Justifié',      color: 'bg-green-100 text-green-700 border-green-200',     icon: CheckCircle },
  unjustified: { label: 'Injustifié',    color: 'bg-red-100 text-red-700 border-red-200',           icon: XCircle },
  notified:    { label: 'Notifié',       color: 'bg-blue-100 text-blue-700 border-blue-200',        icon: AlertTriangle },
};

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============================================
// FORMULAIRE CONSTAT
// ============================================

function AbsenceForm({
  employees,
  onSaved,
  onCancel,
}: {
  employees: Employee[];
  onSaved: (r: AbsenceReport) => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    type: 'absence',
    absence_date: new Date().toISOString().split('T')[0],
    expected_start_time: '',
    actual_start_time: '',
    actual_departure_time: '',
    duration_minutes: '',
    reason: '',
    notes: '',
    notify_employee: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id) { toast.error('Sélectionner un employé'); return; }
    setSaving(true);
    try {
      const payload = {
        employee_id: parseInt(form.employee_id),
        type: form.type,
        absence_date: form.absence_date,
        expected_start_time: form.expected_start_time || null,
        actual_start_time: form.actual_start_time || null,
        actual_departure_time: form.actual_departure_time || null,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        reason: form.reason || null,
        notes: form.notes || null,
        notify_employee: form.notify_employee,
      };
      const data = await apiFetch('/api/absences', { method: 'POST', body: JSON.stringify(payload) });
      toast.success('Constat enregistré');
      onSaved(data);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const isTardiness = form.type === 'tardiness';
  const isEarlyDeparture = form.type === 'early_departure';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-orange-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-orange-500" />
          Nouveau constat
        </h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-sm">Annuler</button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Employé *</label>
          <select required value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400">
            <option value="">Sélectionner…</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || `Employé #${e.id}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
          <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400">
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date du constat *</label>
          <input required type="date" value={form.absence_date}
            onChange={e => setForm(f => ({ ...f, absence_date: e.target.value }))}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400" />
        </div>
        {isTardiness && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heure prévue d'arrivée</label>
              <input type="time" value={form.expected_start_time}
                onChange={e => setForm(f => ({ ...f, expected_start_time: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heure d'arrivée réelle</label>
              <input type="time" value={form.actual_start_time}
                onChange={e => setForm(f => ({ ...f, actual_start_time: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Durée du retard (min)</label>
              <input type="number" min="1" value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
          </>
        )}
        {isEarlyDeparture && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Heure de départ</label>
            <input type="time" value={form.actual_departure_time}
              onChange={e => setForm(f => ({ ...f, actual_departure_time: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
        )}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Raison fournie par l'employé</label>
          <input type="text" value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="Optionnel…"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Observations du manager</label>
          <textarea value={form.notes} rows={2}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Optionnel…"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="notif-emp" checked={form.notify_employee}
          onChange={e => setForm(f => ({ ...f, notify_employee: e.target.checked }))}
          className="rounded border-gray-300 text-orange-500" />
        <label htmlFor="notif-emp" className="text-sm text-gray-600">Notifier l'employé</label>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          Annuler
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Enregistrer le constat
        </button>
      </div>
    </form>
  );
}

// ============================================
// LIGNE CONSTAT (avec expand)
// ============================================

function AbsenceRow({
  report,
  onStatusUpdate,
}: {
  report: AbsenceReport;
  onStatusUpdate: (updated: AbsenceReport) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const st = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
  const StIcon = st.icon;

  async function updateStatus(status: string) {
    setUpdatingStatus(true);
    try {
      const data = await apiFetch(`/api/absences/${report.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      onStatusUpdate(data);
      toast.success('Statut mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}>
        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {report.employee_name || `Employé #${report.employee_id}`}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              {TYPE_LABELS[report.type] || report.type}
            </span>
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${st.color}`}>
              <StIcon className="w-3 h-3" />
              {st.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />{fmtDate(report.absence_date)}
            </span>
            {report.duration_minutes && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />{report.duration_minutes} min
              </span>
            )}
            {report.reporter_name && (
              <span className="text-xs text-gray-400">par {report.reporter_name}</span>
            )}
          </div>
        </div>
        {/* Status quick actions */}
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {report.status === 'pending' && (
            <>
              <button onClick={() => updateStatus('justified')} disabled={updatingStatus}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 disabled:opacity-50">
                Justifié
              </button>
              <button onClick={() => updateStatus('unjustified')} disabled={updatingStatus}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 disabled:opacity-50">
                Injustifié
              </button>
            </>
          )}
          {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </div>

      {expanded && (
        <div className="px-5 pb-4 bg-orange-50/40 border-t border-orange-100 grid grid-cols-2 gap-4 text-sm">
          {report.expected_start_time && (
            <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Heure prévue</p><p className="text-gray-700">{report.expected_start_time}</p></div>
          )}
          {report.actual_start_time && (
            <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">{report.type === 'early_departure' ? 'Heure de départ' : 'Heure réelle'}</p><p className="text-gray-700">{report.actual_start_time}</p></div>
          )}
          {report.reason && (
            <div className="col-span-2"><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Raison</p><p className="text-gray-700">{report.reason}</p></div>
          )}
          {report.notes && (
            <div className="col-span-2"><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Observations</p><p className="text-gray-700">{report.notes}</p></div>
          )}
          <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Enregistré le</p><p className="text-gray-700">{fmtDateTime(report.created_at)}</p></div>
          <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notification envoyée</p><p className="text-gray-700">{report.notification_sent ? '✅ Oui' : '❌ Non'}</p></div>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

interface AbsencesTabProps {
  employeesList?: Employee[];
}

export default function AbsencesTab({ employeesList = [] }: AbsencesTabProps) {
  const [reports, setReports] = useState<AbsenceReport[]>([]);
  const [stats, setStats] = useState<AbsenceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterType) params.append('type', filterType);

      const [listData, statsData] = await Promise.all([
        apiFetch(`/api/absences?${params}`),
        apiFetch('/api/absences/stats').catch(() => null),
      ]);
      setReports(listData.items || []);
      setTotal(listData.total || 0);
      if (statsData) setStats(statsData);
    } catch {
      toast.error('Impossible de charger les constats');
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleSaved(r: AbsenceReport) {
    setReports(prev => [r, ...prev]);
    setTotal(t => t + 1);
    setShowForm(false);
    if (stats) setStats(s => s ? { ...s, total: s.total + 1, pending: s.pending + 1 } : s);
  }

  function handleStatusUpdate(updated: AbsenceReport) {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
  }

  return (
    <div className="space-y-6">
      {/* STATS CARDS */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />En attente</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><XCircle className="w-3 h-3" />Injustifiés</p>
            <p className="text-2xl font-bold text-red-600">{stats.unjustified}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />7 derniers jours</p>
            <p className="text-2xl font-bold text-orange-600">{stats.last_7_days}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><ClipboardList className="w-3 h-3" />Total</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
        </div>
      )}

      {/* FORMULAIRE / BOUTON CRÉER */}
      {showForm ? (
        <AbsenceForm employees={employeesList} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Nouveau constat d'absence / retard
        </button>
      )}

      {/* LISTE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-400">
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span className="ml-auto text-sm text-gray-500">{total} constat{total !== 1 ? 's' : ''}</span>
          <button onClick={fetchData} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <ClipboardList className="w-12 h-12 mb-3 text-gray-200" />
            <p className="font-medium">Aucun constat enregistré</p>
            <p className="text-sm mt-1">Créez le premier constat d'absence ou de retard.</p>
          </div>
        ) : (
          <div>
            {reports.map(r => (
              <AbsenceRow key={r.id} report={r} onStatusUpdate={handleStatusUpdate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
