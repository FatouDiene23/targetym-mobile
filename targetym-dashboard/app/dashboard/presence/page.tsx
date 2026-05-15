'use client';
import { getToken } from '@/lib/api';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomDatePicker from '@/components/CustomDatePicker';
import CustomTimePicker from '@/components/CustomTimePicker';
import CustomSelect from '@/components/CustomSelect';
import { PlanGate } from '@/components/PlanGate';
import { usePlan, FEATURE_PRESENCE } from '@/hooks/usePlan';
import {
  ScanLine, LogIn, LogOut, Coffee, Clock, Users,
  BarChart3, Settings, Calendar, CheckCircle, XCircle, AlertCircle,
  MapPin, RefreshCw, ChevronLeft, ChevronRight, Loader2,
  TrendingUp, Timer, UserCheck, ClipboardCheck, Edit, Search,
  X, Save, Building2, Trash2, Plus, Download, AlertTriangle,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nContext';

// ─────────────────────────────────────────────
// Const
// ─────────────────────────────────────────────
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getUserFromStorage(): { role: string; employeeId: number | null } {
  if (typeof window === 'undefined') return { role: 'employee', employeeId: null };
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return { role: (u.role || 'employee').toLowerCase(), employeeId: u.employee_id || null };
  } catch { return { role: 'employee', employeeId: null }; }
}

function canManage(role: string) { return ['rh', 'admin', 'dg', 'superadmin'].includes(role); }

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TodayRecord {
  id?: number;
  status?: string;
  check_in?: string;
  check_out?: string;
  break_start?: string;
  break_end?: string;
  hours_worked?: number;
  overtime_hours?: number;
  is_mission_day?: boolean;
  is_auto_closed?: boolean;
}

interface DailySummaryRow {
  id: number;
  first_name: string;
  last_name: string;
  department_id?: number;
  status?: string;
  check_in?: string;
  check_out?: string;
  hours_worked?: number;
}

interface HistoryRecord {
  id: number;
  date: string;
  status: string;
  check_in?: string;
  check_out?: string;
  hours_worked?: number;
  overtime_hours?: number;
  is_mission_day: boolean;
  is_auto_closed: boolean;
  correction_note?: string;
}

interface AttendanceSite {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  address?: string;
  is_active: boolean;
}

interface AttendanceSettings {
  work_start_time: string;
  work_end_time: string;
  break_mode: string;
  break_duration_minutes: number;
  overtime_threshold_day: number;
  overtime_threshold_week?: number;
  late_tolerance_minutes: number;
  overtime_rate: number;
}

interface MonthlyRow {
  id: number;
  employee_id: number;
  first_name: string;
  last_name: string;
  total_days_worked: number;
  total_hours_worked: number;
  total_overtime_hours: number;
  total_late_days: number;
  total_absent_days: number;
  status: string;
}

interface StatsData {
  total_records: number;
  total_late: number;
  total_absent: number;
  total_present: number;
  total_on_mission: number;
  avg_hours_worked: number;
  total_overtime: number;
}

// ─────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────
function normalizeDate(dt: string): string {
  // Ajouter 'Z' si pas de timezone — Python datetime sans tzinfo sérialisé sans Z
  if (!dt.endsWith('Z') && !dt.includes('+') && !dt.includes('-', 10)) return dt + 'Z';
  return dt;
}
function fmt(dt?: string) {
  if (!dt) return '—';
  const d = new Date(normalizeDate(dt));
  if (isNaN(d.getTime())) {
    // Fallback : chaîne heure seule "HH:MM:SS[Z]" renvoyée par l'ancien schéma TIME
    const m = dt.replace('Z', '').match(/^(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : '—';
  }
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(dt?: string) {
  if (!dt) return '—';
  const d = new Date(normalizeDate(dt));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR');
}
function fmtH(h?: number) {
  if (h == null) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${mm.toString().padStart(2, '0')}`;
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    present: { label: 'Présent', cls: 'bg-green-50 text-green-700 border-green-200' },
    late: { label: 'En retard', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    absent: { label: 'Absent', cls: 'bg-red-50 text-red-700 border-red-200' },
    on_mission: { label: 'Mission', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  };
  const s = map[status || ''] || { label: status || '—', cls: 'bg-gray-50 text-gray-500 border-gray-200' };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>;
}

// ─────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────
type Tab = 'pointage' | 'journee' | 'historique' | 'mensuel' | 'stats' | 'sites' | 'parametres';

export default function PresencePage() {
  const { t } = useI18n();
  const [role, setRole] = useState('employee');
  const [tab, setTab] = useState<Tab>('pointage');
  const [loading, setLoading] = useState(false);
  const { plan, loading: planLoading } = usePlan();

  useEffect(() => {
    const { role: r } = getUserFromStorage();
    setRole(r);
  }, []);

  const isRH = canManage(role);

  const tabs: { id: Tab; label: string; icon: any; rhOnly?: boolean }[] = [
    { id: 'pointage', label: 'Mon pointage', icon: ScanLine },
    { id: 'journee', label: 'Vue journée', icon: Users, rhOnly: true },
    { id: 'historique', label: 'Mon historique', icon: Calendar },
    { id: 'mensuel', label: 'Clôture mensuelle', icon: ClipboardCheck, rhOnly: true },
    { id: 'stats', label: 'Statistiques', icon: BarChart3, rhOnly: true },
    { id: 'sites', label: 'Sites', icon: MapPin, rhOnly: true },
    { id: 'parametres', label: 'Paramètres', icon: Settings, rhOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.rhOnly || isRH);

  return (
    <PlanGate feature={FEATURE_PRESENCE} plan={plan} mode="block">
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Présence & Pointage</h1>
              <p className="text-sm text-gray-500">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
          {visibleTabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === tb.id ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <tb.icon className="w-4 h-4" />
              {tb.label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        {tab === 'pointage' && <TabPointage />}
        {tab === 'journee' && isRH && <TabJournee />}
        {tab === 'historique' && <TabHistorique />}
        {tab === 'mensuel' && isRH && <TabMensuel />}
        {tab === 'stats' && isRH && <TabStats />}
        {tab === 'sites' && isRH && <TabSites />}
        {tab === 'parametres' && isRH && <TabParametres />}

      </main>
    </div>
    </PlanGate>
  );
}

// ─────────────────────────────────────────────
// TAB : Mon Pointage
// ─────────────────────────────────────────────
function TabPointage() {
  const [record, setRecord] = useState<TodayRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [r, s] = await Promise.all([
        apiFetch('/api/attendance/today'),
        apiFetch('/api/attendance/settings').catch(() => null),
      ]);
      // Ne remplacer le record que si la réponse contient bien des données
      if (r && (r.id || r.check_in)) setRecord(r);
      else if (!silent) setRecord(r); // page init : accepter {} aussi
      setSettings(s);
    } catch (e: any) {
      if (!silent) toast.error(e.message);
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getPosition = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { timeout: 8000 }
      );
    });

  const doAction = async (endpoint: string, body: object = {}) => {
    setActionLoading(true);
    try {
      const resp = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
      toast.success('Pointage enregistré');
      // Appliquer directement la réponse complète du POST (source de vérité)
      if (resp && Object.keys(resp).length > 0) {
        setRecord(resp as TodayRecord);
      }
      // Rafraîchir silencieusement en arrière-plan (sans spinner)
      load(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setActionLoading(false); }
  };

  const handleCheckIn = async () => {
    const pos = await getPosition();
    await doAction('/api/attendance/check-in', { latitude: pos?.lat, longitude: pos?.lng, source: 'web' });
  };

  const handleCheckOut = async () => {
    const pos = await getPosition();
    await doAction('/api/attendance/check-out', { latitude: pos?.lat, longitude: pos?.lng });
  };

  const handleBreakStart = () => doAction('/api/attendance/break-start');
  const handleBreakEnd = () => doAction('/api/attendance/break-end');

  const now = new Date();
  const notCheckedIn = !record || !record.check_in;
  const checkedIn = record?.check_in && !record?.check_out;
  const checkedOut = !!record?.check_out;
  const breakActive = checkedIn && record?.break_start && !record?.break_end;
  const breakDone = !!record?.break_end;
  const isDetailedBreak = settings?.break_mode === 'detailed';

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">

      {/* Heure courante */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold text-gray-900 tabular-nums">
              {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-sm text-gray-500 mt-1">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="flex items-center gap-2">
            {record?.is_mission_day && (
              <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">Mission active</span>
            )}
            {record?.is_auto_closed && (
              <span className="text-xs font-medium px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full">Fermé auto.</span>
            )}
            <StatusBadge status={record?.status} />
          </div>
        </div>
      </div>

      {/* Infos du jour */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <LogIn className="w-4 h-4" />
            <span className="text-xs">Arrivée</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{fmt(record?.check_in)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <LogOut className="w-4 h-4" />
            <span className="text-xs">Départ</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{fmt(record?.check_out)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <Timer className="w-4 h-4" />
            <span className="text-xs">Heures</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{fmtH(record?.hours_worked)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-gray-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">Heures sup.</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{fmtH(record?.overtime_hours)}</p>
        </div>
      </div>

      {/* Boutons pointage */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">

          {/* Check-in */}
          {notCheckedIn && (
            <button onClick={handleCheckIn} disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Pointer l'arrivée
            </button>
          )}

          {/* Break */}
          {checkedIn && isDetailedBreak && !breakActive && !breakDone && (
            <button onClick={handleBreakStart} disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4" />}
              Début de pause
            </button>
          )}
          {breakActive && (
            <button onClick={handleBreakEnd} disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4" />}
              Fin de pause
            </button>
          )}

          {/* Check-out */}
          {checkedIn && (
            <button onClick={handleCheckOut} disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Pointer le départ
            </button>
          )}

          {checkedOut && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Journée terminée
            </div>
          )}

        </div>

        {/* Horaires du tenant */}
        {settings && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Horaires : {String(settings.work_start_time).slice(0, 5)} – {String(settings.work_end_time).slice(0, 5)}</span>
            <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> Tolérance retard : {settings.late_tolerance_minutes} min</span>
            <span className="flex items-center gap-1"><Coffee className="w-3.5 h-3.5" /> Pause : {settings.break_mode === 'detailed' ? 'détaillée' : `${settings.break_duration_minutes} min fixe`}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB : Vue Journée (RH)
// ─────────────────────────────────────────────
function TabJournee() {
  const [rows, setRows] = useState<DailySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [correcting, setCorrecting] = useState<DailySummaryRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/attendance/daily-summary?day=${day}`);
      setRows(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [day]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r =>
    `${r.first_name} ${r.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const present = rows.filter(r => r.status && r.status !== 'absent').length;
  const absent = rows.filter(r => !r.status || r.status === 'absent').length;
  const late = rows.filter(r => r.status === 'late').length;

  return (
    <div className="space-y-6">
      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-green-700">{present}</p>
          <p className="text-xs text-gray-500 mt-1">Présents</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-orange-600 mb-2" />
          <p className="text-2xl font-bold text-orange-700">{late}</p>
          <p className="text-xs text-gray-500 mt-1">En retard</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold text-red-700">{absent}</p>
          <p className="text-xs text-gray-500 mt-1">Absents</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <CustomDatePicker value={day} onChange={v => setDay(v)} className="w-full sm:w-44" />
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un employé..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Employé</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Arrivée</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Départ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Heures</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.first_name} {row.last_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status || 'absent'} /></td>
                  <td className="px-4 py-3 text-gray-600">{fmt(row.check_in)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(row.check_out)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtH(row.hours_worked)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setCorrecting(row)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-600">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Aucun enregistrement</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {correcting && <CorrectionModal row={correcting} onClose={() => setCorrecting(null)} onDone={load} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal Correction
// ─────────────────────────────────────────────
function CorrectionModal({ row, onClose, onDone }: { row: DailySummaryRow; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ check_in: '', check_out: '', correction_note: '' });
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    apiFetch(`/api/attendance/records?start_date=2020-01-01&end_date=${new Date().toISOString().slice(0,10)}&employee_id=${row.id}`)
      .then(setRecords).catch(() => {});
  }, [row.id]);

  const handleSubmit = async (recordId: number) => {
    if (form.correction_note.length < 10) { toast.error('Le motif doit faire au moins 10 caractères'); return; }
    setLoading(true);
    try {
      await apiFetch(`/api/attendance/records/${recordId}/correct`, {
        method: 'PUT',
        body: JSON.stringify({
          check_in: form.check_in ? new Date(form.check_in).toISOString() : undefined,
          check_out: form.check_out ? new Date(form.check_out).toISOString() : undefined,
          correction_note: form.correction_note,
        }),
      });
      toast.success('Pointage corrigé');
      onDone();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayRecord = records.find(r => r.date === today);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Corriger le pointage — {row.first_name} {row.last_name}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {!todayRecord && (
            <p className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">Aucun pointage aujourd'hui pour cet employé.</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Arrivée (optionnel)</label>
            <div className="flex gap-2">
              <CustomDatePicker
                value={form.check_in ? form.check_in.split('T')[0] : ''}
                onChange={v => setForm(f => ({ ...f, check_in: v ? `${v}T${(f.check_in?.split('T')[1] || '09:00')}` : '' }))}
                className="flex-1"
              />
              <CustomTimePicker
                value={form.check_in ? (form.check_in.split('T')[1] || '') : ''}
                onChange={v => setForm(f => ({ ...f, check_in: f.check_in ? `${f.check_in.split('T')[0]}T${v}` : `${new Date().toISOString().slice(0,10)}T${v}` }))}
                className="w-28"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Départ (optionnel)</label>
            <div className="flex gap-2">
              <CustomDatePicker
                value={form.check_out ? form.check_out.split('T')[0] : ''}
                onChange={v => setForm(f => ({ ...f, check_out: v ? `${v}T${(f.check_out?.split('T')[1] || '18:00')}` : '' }))}
                className="flex-1"
              />
              <CustomTimePicker
                value={form.check_out ? (form.check_out.split('T')[1] || '') : ''}
                onChange={v => setForm(f => ({ ...f, check_out: f.check_out ? `${f.check_out.split('T')[0]}T${v}` : `${new Date().toISOString().slice(0,10)}T${v}` }))}
                className="w-28"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motif de correction <span className="text-red-500">*</span></label>
            <textarea value={form.correction_note} onChange={e => setForm(f => ({ ...f, correction_note: e.target.value }))} rows={3}
              placeholder="Minimum 10 caractères..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" />
            <p className="text-xs text-gray-400 mt-1">{form.correction_note.length}/10 min</p>
          </div>
          <button
            onClick={() => todayRecord && handleSubmit(todayRecord.id)}
            disabled={loading || !todayRecord || form.correction_note.length < 10}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer la correction
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB : Mon Historique
// ─────────────────────────────────────────────
function TabHistorique() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/attendance/my-history?start_date=${startDate}&end_date=${endDate}`);
      setRecords(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  // Stats calculées depuis les records chargés
  const nbPresent   = records.filter(r => r.status === 'present').length;
  const nbLate      = records.filter(r => r.status === 'late').length;
  const nbAbsent    = records.filter(r => r.status === 'absent').length;
  const nbMission   = records.filter(r => r.status === 'on_mission').length;
  const totalH      = records.reduce((s, r) => s + (r.hours_worked || 0), 0);
  const totalOT     = records.reduce((s, r) => s + (r.overtime_hours || 0), 0);

  const filtered = statusFilter === 'all' ? records : records.filter(r => r.status === statusFilter);

  return (
    <div className="space-y-6">

      {/* Filtres date + statut */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
          <CustomDatePicker value={startDate} onChange={v => setStartDate(v)} className="w-full sm:w-44" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
          <CustomDatePicker value={endDate} onChange={v => setEndDate(v)} className="w-full sm:w-44" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
          <CustomSelect
            value={statusFilter}
            onChange={v => setStatusFilter(v)}
            className="w-full sm:w-44"
            options={[
              { value: 'all', label: `Tous (${records.length})` },
              { value: 'present', label: `Présent (${nbPresent})` },
              { value: 'late', label: `En retard (${nbLate})` },
              { value: 'absent', label: `Absent (${nbAbsent})` },
              { value: 'on_mission', label: `Mission (${nbMission})` },
            ]}
          />
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 self-end">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Cartes stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => setStatusFilter(statusFilter === 'present' ? 'all' : 'present')}
          className={`rounded-xl p-4 border text-left transition-all ${statusFilter === 'present' ? 'ring-2 ring-green-400' : ''} bg-green-50 border-green-200`}>
          <p className="text-2xl font-bold text-green-700">{nbPresent}</p>
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Présents</p>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'late' ? 'all' : 'late')}
          className={`rounded-xl p-4 border text-left transition-all ${statusFilter === 'late' ? 'ring-2 ring-orange-400' : ''} bg-orange-50 border-orange-200`}>
          <p className="text-2xl font-bold text-orange-700">{nbLate}</p>
          <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Retards</p>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent')}
          className={`rounded-xl p-4 border text-left transition-all ${statusFilter === 'absent' ? 'ring-2 ring-red-400' : ''} bg-red-50 border-red-200`}>
          <p className="text-2xl font-bold text-red-700">{nbAbsent}</p>
          <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Absences</p>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'on_mission' ? 'all' : 'on_mission')}
          className={`rounded-xl p-4 border text-left transition-all ${statusFilter === 'on_mission' ? 'ring-2 ring-blue-400' : ''} bg-blue-50 border-blue-200`}>
          <p className="text-2xl font-bold text-blue-700">{nbMission}</p>
          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Missions</p>
        </button>
      </div>

      {/* Totaux heures */}
      <div className="flex gap-6 text-sm text-gray-500 px-1">
        <span className="flex items-center gap-1.5"><Timer className="w-4 h-4 text-gray-400" /> Heures travaillées : <strong className="text-gray-800">{fmtH(totalH)}</strong></span>
        <span className="flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-gray-400" /> Heures sup. : <strong className="text-gray-800">{fmtH(totalOT)}</strong></span>
      </div>

      {/* Tableau */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Arrivée</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Départ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Heures</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Supp.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{fmt(r.check_in)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {fmt(r.check_out)}
                    {r.is_auto_closed && <span className="ml-1 text-xs text-orange-500">(auto)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fmtH(r.hours_worked)}</td>
                  <td className="px-4 py-3 text-gray-600">{r.overtime_hours ? fmtH(r.overtime_hours) : '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-32 truncate" title={r.correction_note}>{r.correction_note || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">
                  {statusFilter !== 'all' ? 'Aucun enregistrement avec ce statut' : 'Aucun enregistrement sur cette période'}
                </td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-xs text-gray-500">{filtered.length} enregistrement{filtered.length > 1 ? 's' : ''}</td>
                  <td className="px-4 py-2 text-xs font-semibold text-gray-700">{fmtH(filtered.reduce((s,r) => s+(r.hours_worked||0),0))}</td>
                  <td className="px-4 py-2 text-xs font-semibold text-gray-700">{fmtH(filtered.reduce((s,r) => s+(r.overtime_hours||0),0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB : Clôture mensuelle
// ─────────────────────────────────────────────
function TabMensuel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'validate' | 'payroll'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/attendance/monthly-summary?year=${year}&month=${month}`);
      setRows(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: 'validate' | 'payroll') => {
    setActionLoading(true);
    try {
      const endpoint = action === 'validate'
        ? `/api/attendance/monthly-summary/validate?year=${year}&month=${month}`
        : `/api/attendance/monthly-summary/send-to-payroll?year=${year}&month=${month}`;
      const res = await apiFetch(endpoint, { method: 'POST' });
      toast.success(action === 'validate' ? `${res.updated} récapitulatif(s) validé(s)` : `${res.sent} récapitulatif(s) envoyé(s) en paie`);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(false); setConfirmAction(null); }
  };

  const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const draftCount = rows.filter(r => r.status === 'draft').length;
  const validatedCount = rows.filter(r => r.status === 'validated').length;
  const sentCount = rows.filter(r => r.status === 'sent_to_payroll').length;

  return (
    <div className="space-y-6">
      {/* Sélecteur mois */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-gray-800 min-w-32 text-center">{months[month - 1]} {year}</span>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
        <div className="ml-auto flex gap-3">
          {draftCount > 0 && (
            <button onClick={() => setConfirmAction('validate')} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Valider ({draftCount})
            </button>
          )}
          {validatedCount > 0 && (
            <button onClick={() => setConfirmAction('payroll')} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Envoyer en paie ({validatedCount})
            </button>
          )}
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-700">{draftCount}</p>
          <p className="text-xs text-gray-500 mt-1">Brouillons</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">{validatedCount}</p>
          <p className="text-xs text-gray-500 mt-1">Validés</p>
        </div>
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-primary-700">{sentCount}</p>
          <p className="text-xs text-gray-500 mt-1">Envoyés en paie</p>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Employé</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Jours travaillés</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Heures</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Heures sup.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Retards</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Absences</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.first_name} {r.last_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.total_days_worked}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtH(r.total_hours_worked)}</td>
                  <td className="px-4 py-3 text-gray-600">{r.total_overtime_hours > 0 ? fmtH(r.total_overtime_hours) : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.total_late_days}</td>
                  <td className="px-4 py-3 text-gray-600">{r.total_absent_days}</td>
                  <td className="px-4 py-3">
                    {r.status === 'draft' && <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200">Brouillon</span>}
                    {r.status === 'validated' && <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">Validé</span>}
                    {r.status === 'sent_to_payroll' && <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-primary-50 text-primary-700 border-primary-200">Paie</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Aucun récapitulatif pour ce mois</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog isOpen={confirmAction === 'validate'} onClose={() => setConfirmAction(null)}
        onConfirm={() => doAction('validate')} title="Valider les récapitulatifs"
        message={`Valider les ${draftCount} récapitulatifs brouillons de ${months[month - 1]} ${year} ?`}
        confirmText="Valider" />
      <ConfirmDialog isOpen={confirmAction === 'payroll'} onClose={() => setConfirmAction(null)}
        onConfirm={() => doAction('payroll')} title="Envoyer en paie"
        message={`Envoyer les ${validatedCount} récapitulatifs validés de ${months[month - 1]} ${year} en paie ? Cette action est irréversible.`}
        confirmText="Envoyer en paie" danger />
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB : Statistiques
// ─────────────────────────────────────────────
function TabStats() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [stats, setStats] = useState<StatsData | null>(null);
  const [deptStats, setDeptStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        apiFetch(`/api/attendance/stats?start_date=${startDate}&end_date=${endDate}`),
        apiFetch(`/api/attendance/stats/by-department?start_date=${startDate}&end_date=${endDate}`),
      ]);
      setStats(s); setDeptStats(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const cards = stats ? [
    { label: 'Total pointages', value: stats.total_records, icon: ScanLine, color: 'text-gray-700', bg: 'bg-gray-50' },
    { label: 'Présents', value: stats.total_present, icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-50' },
    { label: 'En retard', value: stats.total_late, icon: AlertCircle, color: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'Absents', value: stats.total_absent, icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
    { label: 'En mission', value: stats.total_on_mission, icon: MapPin, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Moy. heures/jour', value: fmtH(stats.avg_hours_worked), icon: Clock, color: 'text-gray-700', bg: 'bg-gray-50' },
    { label: 'Total heures sup.', value: fmtH(stats.total_overtime), icon: TrendingUp, color: 'text-primary-700', bg: 'bg-primary-50' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
          <CustomDatePicker value={startDate} onChange={v => setStartDate(v)} className="w-full sm:w-44" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
          <CustomDatePicker value={endDate} onChange={v => setEndDate(v)} className="w-full sm:w-44" />
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map(c => (
              <div key={c.label} className={`${c.bg} border rounded-xl p-4`}>
                <c.icon className={`w-5 h-5 ${c.color} mb-2`} />
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {deptStats.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Par département</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Département</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Pointages</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Retards</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Absences</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Moy. heures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deptStats.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.department || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-600">{d.total_records}</td>
                      <td className="px-4 py-3 text-gray-600">{d.total_late}</td>
                      <td className="px-4 py-3 text-gray-600">{d.total_absent}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtH(d.avg_hours_worked)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB : Sites
// ─────────────────────────────────────────────
function TabSites() {
  const [sites, setSites] = useState<AttendanceSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AttendanceSite | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AttendanceSite | null>(null);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius_meters: '200', address: '' });
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setSites(await apiFetch('/api/attendance/sites')); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', latitude: '', longitude: '', radius_meters: '200', address: '' }); setShowForm(true); };
  const openEdit = (s: AttendanceSite) => {
    setEditing(s);
    setForm({ name: s.name, latitude: String(s.latitude), longitude: String(s.longitude), radius_meters: String(s.radius_meters), address: s.address || '' });
    setShowForm(true);
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) { toast.error('Géolocalisation non disponible'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        toast.success('Position récupérée');
        setGpsLoading(false);
      },
      () => { toast.error('Impossible de récupérer la position'); setGpsLoading(false); },
      { timeout: 8000 }
    );
  };

  const handleSave = async () => {
    if (!form.name || !form.latitude || !form.longitude) { toast.error('Nom, latitude et longitude requis'); return; }
    setSaving(true);
    try {
      const body = { name: form.name, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude), radius_meters: parseInt(form.radius_meters), address: form.address || undefined };
      if (editing) await apiFetch(`/api/attendance/sites/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiFetch('/api/attendance/sites', { method: 'POST', body: JSON.stringify(body) });
      toast.success(editing ? 'Site modifié' : 'Site créé');
      setShowForm(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (site: AttendanceSite) => {
    try {
      await apiFetch(`/api/attendance/sites/${site.id}`, { method: 'DELETE' });
      toast.success('Site désactivé');
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setConfirmDelete(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{sites.length} site(s) de pointage</p>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouveau site
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {sites.map(s => (
            <div key={s.id} className={`bg-white border rounded-xl p-4 ${!s.is_active ? 'opacity-50' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-900">{s.name}</span>
                  {!s.is_active && <span className="text-xs text-gray-400">(inactif)</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-600"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setConfirmDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}</div>
                <div>Rayon : {s.radius_meters} m</div>
                {s.address && <div>{s.address}</div>}
              </div>
            </div>
          ))}
          {sites.length === 0 && (
            <div className="col-span-2 text-center py-8 text-gray-400">Aucun site configuré</div>
          )}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-gray-900">{editing ? 'Modifier le site' : 'Nouveau site'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">

              {/* Nom */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom du site</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Siège social"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>

              {/* Position GPS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">Position GPS</label>
                  <button onClick={useMyPosition} disabled={gpsLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1 border border-primary-300 text-primary-600 hover:bg-primary-50 rounded-lg text-xs font-medium disabled:opacity-50">
                    {gpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                    Utiliser ma position
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                      placeholder="Latitude"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                  <div>
                    <input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                      placeholder="Longitude"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                </div>
                {form.latitude && form.longitude && (
                  <p className="text-xs text-gray-400 mt-1">{form.latitude}, {form.longitude}</p>
                )}
              </div>

              {/* Rayon avec slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">Rayon de la zone</label>
                  <span className="text-xs font-bold text-primary-600">{form.radius_meters} m</span>
                </div>
                <input type="range" min="50" max="2000" step="50"
                  value={form.radius_meters}
                  onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))}
                  className="w-full accent-primary-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>50 m</span>
                  <span>500 m</span>
                  <span>1 km</span>
                  <span>2 km</span>
                </div>
              </div>

              {/* Adresse */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Adresse (optionnel)</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Ex: Avenue de la Mer, Libreville"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editing ? 'Enregistrer' : 'Créer le site'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Désactiver le site" message={`Désactiver le site "${confirmDelete?.name}" ?`}
        confirmText="Désactiver" danger />
    </div>
  );
}


// ─────────────────────────────────────────────
// TAB : Paramètres
// ─────────────────────────────────────────────
function TabParametres() {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<AttendanceSettings>>({});

  useEffect(() => {
    apiFetch('/api/attendance/settings')
      .then(s => { setSettings(s); setForm(s); })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiFetch('/api/attendance/settings', { method: 'PUT', body: JSON.stringify(form) });
      setSettings(updated); setForm(updated);
      toast.success('Paramètres enregistrés');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>;

  const field = (label: string, key: keyof AttendanceSettings, type: string = 'text', hint?: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {type === 'time' ? (
        <CustomTimePicker
          value={String((form as any)[key] ?? '')}
          onChange={v => setForm(f => ({ ...f, [key]: v }))}
          className="w-full"
        />
      ) : (
        <input type={type} value={String((form as any)[key] ?? '')}
          onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) : e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
      )}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b pb-3">Horaires</h3>
        {field('Heure d\'arrivée', 'work_start_time', 'time')}
        {field('Heure de fin', 'work_end_time', 'time')}
        {field('Tolérance retard (minutes)', 'late_tolerance_minutes', 'number')}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b pb-3">Pause</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mode de pause</label>
          <CustomSelect
            value={form.break_mode || 'simple'}
            onChange={v => setForm(f => ({ ...f, break_mode: v }))}
            className="w-full"
            options={[
              { value: 'simple', label: 'Simple (durée fixe déduite)' },
              { value: 'detailed', label: 'Détaillé (pointage pause début/fin)' },
            ]}
          />
        </div>
        {field('Durée de pause fixe (minutes)', 'break_duration_minutes', 'number', 'Utilisé uniquement en mode simple')}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b pb-3">Heures supplémentaires</h3>
        {field('Seuil jour (heures)', 'overtime_threshold_day', 'number', 'Ex: 8 pour déclencher les HS après 8h travaillées')}
        {field('Seuil semaine (heures)', 'overtime_threshold_week', 'number')}
        {field('Taux HS (multiplicateur)', 'overtime_rate', 'number', 'Ex: 1.5 pour 150% du taux horaire')}
      </div>
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Enregistrer les paramètres
      </button>

      {/* ── Export CSV mensuel ────────────────────────── */}
      <ExportSection />

      {/* ── Zone dangereuse (admin/superadmin) ────────── */}
      <ResetSection />
    </div>
  );
}

// ─────────────────────────────────────────────
// Section Export CSV mensuel
// ─────────────────────────────────────────────
function ExportSection() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [exporting, setExporting] = useState(false);

  const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = getToken();
      const url = `${(process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://')}/api/attendance/export/monthly?year=${year}&month=${month}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Erreur export' }));
        throw new Error(err.detail || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `presence_${year}_${String(month).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Export téléchargé');
    } catch (e: any) { toast.error(e.message); }
    finally { setExporting(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 border-b pb-3 flex items-center gap-2">
        <Download className="w-4 h-4 text-primary-500" />
        Export récapitulatif mensuel
      </h3>
      <p className="text-xs text-gray-500">Téléchargez le résumé des heures travaillées par employé pour un mois donné (CSV).</p>
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mois</label>
          <CustomSelect
            value={String(month)}
            onChange={v => setMonth(Number(v))}
            className="w-full sm:w-40"
            options={months.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Année</label>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2099}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Télécharger
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Zone dangereuse — Réinitialisation (admin)
// ─────────────────────────────────────────────
function ResetSection() {
  const { role } = getUserFromStorage();
  const canReset = ['admin', 'superadmin', 'rh'].includes(role);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting,  setResetting]   = useState(false);

  if (!canReset) return null;

  const handleReset = async () => {
    setResetting(true);
    try {
      const result = await apiFetch('/api/attendance/reset', {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      toast.success(`Réinitialisé — ${result.deleted_records} pointages supprimés`);
      setShowConfirm(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setResetting(false); }
  };

  return (
    <>
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Zone dangereuse
        </h3>
        <p className="text-xs text-red-600">
          Supprime <strong>tous les pointages et récapitulatifs</strong> de votre entreprise. Action irréversible.
        </p>
        <button onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">
          <Trash2 className="w-4 h-4" />
          Réinitialiser tous les pointages
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleReset}
        title="Réinitialiser tous les pointages"
        message="Cette action supprimera TOUS les pointages et récapitulatifs mensuels de votre entreprise. Elle est irréversible. Voulez-vous continuer ?"
        confirmText={resetting ? 'Suppression...' : 'Oui, tout supprimer'}
        danger
      />
    </>
  );
}
