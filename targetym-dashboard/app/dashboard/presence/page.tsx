'use client';
import { resolveApiUrl } from '@/lib/apiUrl';
import { getToken } from '@/lib/api';

import { useState, useEffect, useCallback } from 'react';

import toast from 'react-hot-toast';
import Header from '@/components/Header';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PlanGate } from '@/components/PlanGate';
import { usePlan, FEATURE_PRESENCE } from '@/hooks/usePlan';
import {
  ScanLine, LogIn, LogOut, Coffee, Clock, Users,
  BarChart3, Settings, Calendar, CheckCircle, XCircle, AlertCircle,
  MapPin, RefreshCw, ChevronLeft, ChevronRight, Loader2,
  TrendingUp, Timer, UserCheck, ClipboardCheck, Edit, Search,
  X, Save, Building2, Trash2, Plus, Download, AlertTriangle, CheckCheck, Filter,
  Archive,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nContext';
import CustomDatePicker from '@/components/CustomDatePicker';
import CustomSelect from '@/components/CustomSelect';

// ─────────────────────────────────────────────
// Const
// ─────────────────────────────────────────────
const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);

function getUserFromStorage(): { role: string; employeeId: number | null } {
  if (typeof window === 'undefined') return { role: 'employee', employeeId: null };
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return { role: (u.role || 'employee').toLowerCase(), employeeId: u.employee_id || null };
  } catch { return { role: 'employee', employeeId: null }; }
}

function canManage(role: string) { return ['rh', 'admin', 'dg', 'superadmin'].includes(role); }
function canViewDay(role: string) { return canManage(role) || role === 'manager'; }

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
  site_id?: number;
  site_name?: string;
}

interface DailySummaryRow {
  id: number;
  first_name: string;
  last_name: string;
  department_id?: number;
  job_title?: string;
  site_id?: number;
  site_name?: string;
  status?: string;
  absence_label?: string;
  check_in?: string;
  check_out?: string;
  hours_worked?: number;
  break_start?: string;
  break_end?: string;
  break_minutes?: number | null;
  break_exceeded?: boolean;
}

interface HistoryRecord {
  id: number;
  date: string;
  status: string;
  check_in?: string;
  check_out?: string;
  break_start?: string;
  break_end?: string;
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
  created_at?: string;
  assigned_employees?: number;
  used_today?: number;
  used_last_30_days?: number;
}

interface DepartmentOption {
  id: number;
  name: string;
}

interface AttendanceSettings {
  work_start_time: string;
  work_end_time: string;
  break_mode: string;
  break_duration_minutes: number;
  overtime_threshold_day: number;
  overtime_threshold_week?: number;
  late_tolerance_minutes: number;
  absence_after_minutes?: number;
  overtime_rate: number;
  break_window_start?: string | null;
  break_window_end?: string | null;
}

interface MonthlyRow {
  id: number;
  employee_id: number;
  first_name: string;
  last_name: string;
  job_title?: string;
  department_id?: number;
  department_name?: string;
  site_id?: number;
  site_name?: string;
  working_days?: number;
  missing_days?: number;
  total_days_worked: number;
  total_hours_worked: number;
  total_overtime_hours: number;
  total_late_days: number;
  total_absent_days: number;
  status: string;
  validated_by?: number;
  validated_by_name?: string;
  validated_by_email?: string;
  validated_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface StatsData {
  total_records: number;
  total_late: number;
  total_absent: number;
  total_present: number;
  total_on_mission: number;
  total_remote?: number;
  total_employees?: number;
  present_employees?: number;
  avg_hours_worked: number;
  total_hours_worked?: number;
  total_overtime: number;
  presence_rate?: number;
  punctuality_rate?: number;
  absenteeism_rate?: number;
}

// ─────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────
function normalizeDate(dt: string): string {
  // Ajouter 'Z' si pas de timezone — Python datetime sans tzinfo sérialisé sans Z
  if (!dt.endsWith('Z') && !dt.includes('+') && !dt.includes('-', 10)) return dt + 'Z';
  return dt;
}
function localDateISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function firstLocalDayOfMonthISO(d = new Date()): string {
  return localDateISO(new Date(d.getFullYear(), d.getMonth(), 1));
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
  const dateOnly = dt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
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
function fmtDateTime(dt?: string) {
  if (!dt) return '—';
  const d = new Date(normalizeDate(dt));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return null;
  const s = new Date(normalizeDate(start));
  const e = new Date(normalizeDate(end));
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
}
function pauseLabel(record: Pick<HistoryRecord, 'break_start' | 'break_end'>) {
  if (!record.break_start && !record.break_end) return '—';
  const duration = minutesBetween(record.break_start, record.break_end);
  const suffix = duration == null ? '' : ` (${Math.floor(duration / 60)}h${String(duration % 60).padStart(2, '0')})`;
  return `${fmt(record.break_start)} - ${fmt(record.break_end)}${suffix}`;
}
function toDateTimeLocalValue(dt?: string) {
  if (!dt) return '';
  const d = new Date(normalizeDate(dt));
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    present: { label: 'Présent', cls: 'bg-green-50 text-green-700 border-green-200' },
    late: { label: 'En retard', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    absent: { label: 'Absent', cls: 'bg-red-50 text-red-700 border-red-200' },
    on_leave: { label: 'En congé', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    sick_leave: { label: 'Maladie', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    on_mission: { label: 'Mission', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    remote: { label: 'Télétravail', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
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
  const hasDayView = canViewDay(role);

  const tabs: { id: Tab; label: string; icon: any; rhOnly?: boolean; dayView?: boolean }[] = [
    { id: 'pointage', label: 'Mon pointage', icon: ScanLine },
    { id: 'journee', label: 'Vue journée', icon: Users, dayView: true },
    { id: 'historique', label: 'Mon historique', icon: Calendar },
    { id: 'mensuel', label: 'Clôture mensuelle', icon: ClipboardCheck, rhOnly: true },
    { id: 'stats', label: 'Statistiques', icon: BarChart3, rhOnly: true },
    { id: 'sites', label: 'Sites', icon: MapPin, dayView: true },
    { id: 'parametres', label: 'Paramètres', icon: Settings, rhOnly: true },
  ];

  const visibleTabs = tabs.filter(t => (!t.rhOnly || isRH) && (!t.dayView || hasDayView));

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
        {tab === 'pointage' && <TabPointage onViewHistory={() => setTab('historique')} />}
        {tab === 'journee' && hasDayView && <TabJournee />}
        {tab === 'historique' && <TabHistorique />}
        {tab === 'mensuel' && isRH && <TabMensuel />}
        {tab === 'stats' && isRH && <TabStats />}
        {tab === 'sites' && hasDayView && <TabSites />}
        {tab === 'parametres' && isRH && <TabParametres />}

      </main>
    </div>
    </PlanGate>
  );
}

// ─────────────────────────────────────────────
// TAB : Mon Pointage
// ─────────────────────────────────────────────
function TabPointage({ onViewHistory }: { onViewHistory: () => void }) {
  const [record, setRecord] = useState<TodayRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [sites, setSites] = useState<AttendanceSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [r, s, h, siteList] = await Promise.all([
        apiFetch('/api/attendance/today'),
        apiFetch('/api/attendance/settings').catch(() => null),
        apiFetch(`/api/attendance/my-history?start_date=${firstLocalDayOfMonthISO()}&end_date=${localDateISO()}`).catch(() => []),
        apiFetch('/api/attendance/sites').catch((e: any) => { if (!silent) toast.error(`Sites : ${e.message}`); return []; }),
      ]);
      const activeSites = (Array.isArray(siteList) ? siteList : []).filter((site: AttendanceSite) => site.is_active !== false);
      // Ne remplacer le record que si la réponse contient bien des données
      if (r && (r.id || r.check_in)) setRecord(r);
      else if (!silent) setRecord(r); // page init : accepter {} aussi
      setSettings(s);
      setHistory(Array.isArray(h) ? h : []);
      setSites(activeSites);
      setSelectedSiteId(current => {
        if (r?.site_id) return String(r.site_id);
        if (current && activeSites.some((site: AttendanceSite) => String(site.id) === current)) return current;
        return activeSites.length === 1 ? String(activeSites[0].id) : '';
      });
    } catch (e: any) {
      if (!silent) toast.error(e.message);
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getPosition = (): Promise<{ lat: number; lng: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("La géolocalisation n'est pas disponible sur ce navigateur."));
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => reject(new Error('Activez la géolocalisation pour pointer sur ce site.')),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
    if (actionLoading) return; // anti double-clic : une soumission déjà en cours
    if (!selectedSiteId) return toast.error('Choisissez votre site de pointage.');
    setActionLoading(true); // verrouille le bouton dès le clic, avant l'acquisition GPS
    try {
      const pos = await getPosition();
      await doAction('/api/attendance/check-in', { site_id: Number(selectedSiteId), latitude: pos.lat, longitude: pos.lng, source: 'web' });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (actionLoading) return; // anti double-clic : une soumission déjà en cours
    const siteId = record?.site_id || (selectedSiteId ? Number(selectedSiteId) : undefined);
    if (!siteId) return toast.error('Site de pointage introuvable pour cette journée.');
    setActionLoading(true); // verrouille le bouton dès le clic, avant l'acquisition GPS
    try {
      const pos = await getPosition();
      await doAction('/api/attendance/check-out', { site_id: siteId, latitude: pos.lat, longitude: pos.lng });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
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
  const statusTone = record?.status === 'late'
    ? { label: 'En retard', cls: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' }
    : record?.check_in
      ? { label: checkedOut ? 'Journée terminée' : 'En cours', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
      : { label: 'Pas encore pointé', cls: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' };
  const presentDays = history.filter(r => r.status === 'present' || r.status === 'on_mission').length;
  const lateDays = history.filter(r => r.status === 'late').length;
  const absentDays = history.filter(r => r.status === 'absent').length;
  const overtimeThreshold = Number(settings?.overtime_threshold_day ?? 8);
  const todayOvertime = (record?.hours_worked || 0) > overtimeThreshold ? (record?.overtime_hours || 0) : 0;
  const overtimeTotal = history.reduce((sum, r) => {
    return sum + ((r.hours_worked || 0) > overtimeThreshold ? (r.overtime_hours || 0) : 0);
  }, 0);
  const recentHistory = history.slice(0, 5);
  const selectedSite = sites.find(site => String(site.id) === selectedSiteId);
  const attendanceSiteName = record?.site_name || selectedSite?.name || 'Aucun site sélectionné';

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl px-5 py-5 sm:px-6">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-5xl sm:text-6xl font-bold text-gray-950 tabular-nums tracking-normal">
              {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-sm font-medium text-gray-500 mt-1">
              {record?.check_in && !record?.check_out ? 'En cours de journée' : now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:self-start">
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${statusTone.cls}`}>
              <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
              {statusTone.label}
            </span>
            {record?.is_mission_day && (
              <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">Mission active</span>
            )}
            {record?.is_auto_closed && (
              <span className="text-xs font-medium px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full">Fermé auto.</span>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 right-0 hidden h-24 w-96 overflow-hidden lg:block">
          <div className="absolute bottom-0 right-0 h-16 w-96 rounded-tl-full bg-teal-100" />
          <div className="absolute bottom-0 right-20 h-12 w-72 rounded-tl-full bg-cyan-100" />
          <div className="absolute right-20 top-3 h-12 w-12 rounded-full bg-amber-100" />
          <div className="absolute bottom-6 right-56 h-8 w-1.5 rounded-full bg-teal-500" />
          <div className="absolute bottom-3 right-52 h-12 w-2 rounded-full bg-teal-600" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 min-h-28">
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium">Arrivée</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-gray-950 tabular-nums">{fmt(record?.check_in)}</p>
          <p className="mt-1 text-xs text-gray-500">{record?.check_in ? 'Pointée' : 'Non pointée'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 min-h-28">
          <div className="flex items-center gap-2 text-gray-600">
            <LogOut className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Départ</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-gray-950 tabular-nums">{fmt(record?.check_out)}</p>
          <p className="mt-1 text-xs text-gray-500">{record?.check_out ? 'Pointé' : 'Non pointé'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 min-h-28">
          <div className="flex items-center gap-2 text-gray-600">
            <Timer className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium">Heures travaillées</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-gray-950 tabular-nums">{fmtH(record?.hours_worked || 0)}</p>
          <p className="mt-1 text-xs text-gray-500">Aujourd'hui</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 min-h-28">
          <div className="flex items-center gap-2 text-gray-600">
            <Coffee className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium">Pause</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-gray-950 tabular-nums">{record?.break_start ? fmt(record.break_start) : '00h00'}</p>
          <p className="mt-1 text-xs text-gray-500">{settings?.break_duration_minutes ? `Sur ${settings.break_duration_minutes} min` : 'Non démarrée'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 min-h-28">
          <div className="flex items-center gap-2 text-gray-600">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-medium">Heures sup.</span>
          </div>
          <p className="mt-4 text-2xl font-bold text-gray-950 tabular-nums">{fmtH(todayOvertime)}</p>
          <p className="mt-1 text-xs text-gray-500">Aujourd'hui</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 min-h-28">
          <div className="flex items-center gap-2 text-gray-600">
            <CheckCircle className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium">Statut</span>
          </div>
          <div className="mt-4"><StatusBadge status={record?.status || (record?.check_in ? 'present' : undefined)} /></div>
          <p className="mt-2 text-xs text-gray-500">{checkedOut ? 'Journée terminée' : 'Bonne journée !'}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Actions de pointage</h2>
            <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Site de pointage</span>
                <CustomSelect
                  value={selectedSiteId}
                  onChange={setSelectedSiteId}
                  disabled={(!!record?.check_in && !!record?.site_id) || actionLoading}
                  options={[
                    { value: '', label: sites.length === 0 ? 'Aucun site disponible' : 'Choisir un site' },
                    ...sites.map(site => ({
                      value: String(site.id),
                      label: `${site.name} · rayon ${site.radius_meters} m`,
                    })),
                  ]}
                  className="w-full"
                />
                {!loading && sites.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">Aucun site de pointage configuré. Contactez votre responsable RH pour en créer un.</p>
                )}
              </label>
              <div className="flex h-11 items-center gap-2 rounded-lg border border-teal-100 bg-teal-50 px-3 text-sm font-semibold text-teal-800">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{attendanceSiteName}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <button onClick={handleCheckIn} disabled={actionLoading || !notCheckedIn || !selectedSiteId}
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Pointer l'arrivée
              </button>
              <button onClick={handleCheckOut} disabled={actionLoading || !checkedIn}
                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Pointer le départ
              </button>
              <button
                onClick={breakActive ? handleBreakEnd : handleBreakStart}
                disabled={actionLoading || !checkedIn || !isDetailedBreak || breakDone}
                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-orange-200 bg-white px-4 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-45">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coffee className="w-4 h-4" />}
                {breakActive ? 'Terminer la pause' : 'Démarrer la pause'}
              </button>
            </div>
          </div>
          <div className="flex items-start gap-3 border-t border-gray-100 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50">
              <AlertCircle className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Pensez à pointer vos entrées et sorties</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">Vos pointages aident à suivre votre temps et à établir des relevés fiables.</p>
            </div>
          </div>
        </div>
      </div>

      {settings && (
        <div className="grid gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 sm:grid-cols-3">
          <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Horaires : {String(settings.work_start_time).slice(0, 5)} - {String(settings.work_end_time).slice(0, 5)}</span>
          <span className="flex items-center gap-2"><Timer className="w-4 h-4 text-gray-400" /> Tolérance retard : {settings.late_tolerance_minutes} min</span>
          <span className="flex items-center gap-2"><Coffee className="w-4 h-4 text-gray-400" /> Pause : {settings.break_mode === 'detailed' ? (settings.break_window_start && settings.break_window_end ? `détaillée (${String(settings.break_window_start).slice(0, 5)}–${String(settings.break_window_end).slice(0, 5)})` : 'détaillée') : `${settings.break_duration_minutes} min`}</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_360px]">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900">Aujourd'hui</h3>
          <div className="mt-6 grid grid-cols-2 items-start gap-2 text-center sm:grid-cols-4">
            {[
              { label: 'Arrivée', value: fmt(record?.check_in), icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Pause', value: record?.break_start ? fmt(record.break_start) : '--:--', icon: Coffee, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Reprise', value: record?.break_end ? fmt(record.break_end) : '--:--', icon: Timer, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Départ', value: fmt(record?.check_out), icon: LogOut, color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map((step, index) => (
              <div key={step.label} className="relative">
                {index < 3 && <div className="absolute left-1/2 right-[-50%] top-5 hidden border-t border-dashed border-blue-300 sm:block" />}
                <div className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-full ${step.bg}`}>
                  <step.icon className={`h-5 w-5 ${step.color}`} />
                </div>
                <p className="mt-3 text-sm font-medium text-gray-700">{step.label}</p>
                <p className="mt-1 text-sm text-gray-500 tabular-nums">{step.value}</p>
              </div>
            ))}
          </div>
          {!record?.check_in && (
            <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Vous n'avez pas encore pointé votre arrivée. Cliquez sur <strong>Pointer l'arrivée</strong> pour commencer votre journée.
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Historique récent</h3>
            <button type="button" onClick={onViewHistory} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              Voir tout
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
                  <th className="py-2">Date</th>
                  <th className="py-2">Arrivée</th>
                  <th className="py-2">Départ</th>
                  <th className="py-2">Heures</th>
                  <th className="py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentHistory.map(r => (
                  <tr key={r.id}>
                    <td className="py-2 text-gray-700">{fmtDate(r.date)}</td>
                    <td className="py-2 text-gray-600">{fmt(r.check_in)}</td>
                    <td className="py-2 text-gray-600">{fmt(r.check_out)}</td>
                    <td className="py-2 text-gray-600">{fmtH(r.hours_worked)}</td>
                    <td className="py-2"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
                {recentHistory.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">Aucun historique récent</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900">Ce mois-ci</h3>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-200 p-4">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
              <p className="mt-3 text-xs font-medium text-gray-500">Présences</p>
              <p className="text-2xl font-bold text-emerald-700">{presentDays}<span className="ml-1 text-sm font-medium text-gray-500">jours</span></p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <AlertCircle className="h-6 w-6 text-orange-600" />
              <p className="mt-3 text-xs font-medium text-gray-500">Retards</p>
              <p className="text-2xl font-bold text-orange-700">{lateDays}<span className="ml-1 text-sm font-medium text-gray-500">jours</span></p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <XCircle className="h-6 w-6 text-red-600" />
              <p className="mt-3 text-xs font-medium text-gray-500">Absences</p>
              <p className="text-2xl font-bold text-red-700">{absentDays}<span className="ml-1 text-sm font-medium text-gray-500">jours</span></p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <TrendingUp className="h-6 w-6 text-violet-600" />
              <p className="mt-3 text-xs font-medium text-gray-500">Heures sup.</p>
              <p className="text-2xl font-bold text-violet-700">{fmtH(overtimeTotal)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB : Vue Journée (RH)
// ─────────────────────────────────────────────
function TabJournee() {
  const { role } = getUserFromStorage();
  const canCorrect = canManage(role);
  const isManagerScope = role === 'manager';
  const [rows, setRows] = useState<DailySummaryRow[]>([]);
  const [sites, setSites] = useState<AttendanceSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(() => localDateISO());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [correcting, setCorrecting] = useState<DailySummaryRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (day <= localDateISO()) {
        await apiFetch(`/api/attendance/sync-absences?day=${day}`, { method: 'POST' }).catch(() => null);
      }
      const [d, s] = await Promise.all([
        apiFetch(`/api/attendance/daily-summary?day=${day}`),
        apiFetch('/api/attendance/sites').catch(() => []),
      ]);
      setRows(d);
      setSites(Array.isArray(s) ? s : []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [day]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [day, search, statusFilter, siteFilter, pageSize]);

  const getRowStatus = (row: DailySummaryRow) => row.status || 'absent';
  const filtered = rows.filter(r => {
    const matchesSearch = `${r.first_name} ${r.last_name}`.toLowerCase().includes(search.toLowerCase());
    const status = getRowStatus(r);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesSite = siteFilter === 'all' || String(r.site_id || '') === siteFilter;
    return matchesSearch && matchesStatus && matchesSite;
  });

  const present = rows.filter(r => r.status === 'present').length;
  const absent = rows.filter(r => !r.status || r.status === 'absent').length;
  const late = rows.filter(r => r.status === 'late').length;
  const mission = rows.filter(r => r.status === 'on_mission').length;
  const remote = rows.filter(r => r.status === 'remote').length;
  const onLeave = rows.filter(r => r.status === 'on_leave').length;
  const sick = rows.filter(r => r.status === 'sick_leave').length;
  const total = rows.length || 1;
  const checkedRows = rows.filter(r => r.check_in);
  const firstCheckIn = checkedRows
    .map(r => r.check_in)
    .filter(Boolean)
    .sort((a, b) => new Date(normalizeDate(a!)).getTime() - new Date(normalizeDate(b!)).getTime())[0];
  const lastCheckIn = checkedRows
    .map(r => r.check_in)
    .filter(Boolean)
    .sort((a, b) => new Date(normalizeDate(b!)).getTime() - new Date(normalizeDate(a!)).getTime())[0];
  const averageArrival = checkedRows.length
    ? new Date(checkedRows.reduce((sum, r) => sum + new Date(normalizeDate(r.check_in!)).getTime(), 0) / checkedRows.length)
    : null;
  const punctualityRate = rows.length ? Math.round((present / rows.length) * 100) : 0;
  const statusTabs = [
    { id: 'all', label: 'Tous', count: rows.length },
    { id: 'present', label: 'Présents', count: present },
    { id: 'late', label: 'En retard', count: late },
    { id: 'absent', label: 'Absents', count: absent },
    { id: 'on_leave', label: 'En congé', count: onLeave },
    { id: 'sick_leave', label: 'Maladie', count: sick },
    { id: 'on_mission', label: 'En mission', count: mission },
    { id: 'remote', label: 'Télétravail', count: remote },
  ];
  const statusBreakdown = [
    { label: 'Présents', count: present, color: '#10b981' },
    { label: 'En retard', count: late, color: '#f59e0b' },
    { label: 'Absents', count: absent, color: '#ef4444' },
    { label: 'En congé', count: onLeave, color: '#06b6d4' },
    { label: 'Maladie', count: sick, color: '#e11d48' },
    { label: 'En mission', count: mission, color: '#2563eb' },
    { label: 'Télétravail', count: remote, color: '#8b5cf6' },
  ];
  const donutStops = statusBreakdown.reduce((acc, item) => {
    const start = acc.offset;
    const end = start + (rows.length ? (item.count / rows.length) * 100 : 0);
    acc.parts.push(`${item.color} ${start}% ${end}%`);
    acc.offset = end;
    return acc;
  }, { offset: 0, parts: [] as string[] }).parts.join(', ');
  const locationStats: Array<{ label: string; count: number; color: string; siteId?: string }> = [
    ...sites.map(site => ({
      label: site.name,
      count: rows.filter(row => row.site_id === site.id).length,
      color: 'bg-emerald-500',
      siteId: String(site.id),
    })),
    { label: 'En mission', count: mission, color: 'bg-blue-500' },
    { label: 'Télétravail', count: remote, color: 'bg-violet-500' },
  ];
  const dayLabel = fmtDate(day);
  const lastUpdated = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(safePage * pageSize, filtered.length);
  const paginatedRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const exportRows = () => {
    const headers = ['Employé', 'Poste', 'Statut', 'Arrivée', 'Départ', 'Heures travaillées', 'Site', 'Mode'];
    const csvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map(row => {
      const status = getRowStatus(row);
      const mode = status === 'on_mission' ? 'Mission' : status === 'remote' ? 'Télétravail' : status === 'on_leave' ? 'Congé' : status === 'sick_leave' ? 'Maladie' : status === 'absent' ? '-' : 'Sur site';
      return [
        `${row.first_name} ${row.last_name}`,
        row.job_title || 'Collaborateur',
        status,
        fmt(row.check_in),
        fmt(row.check_out),
        fmtH(row.hours_worked),
        row.site_name || 'Non renseigné',
        mode,
      ].map(csvValue).join(';');
    });
    const blob = new Blob([`\uFEFF${headers.map(csvValue).join(';')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presence_journee_${day}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-950">Vue journée</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isManagerScope
              ? `Aperçu de la présence de vos collaborateurs pour la journée du ${dayLabel}.`
              : `Aperçu de la présence des collaborateurs pour la journée du ${dayLabel}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomDatePicker value={day} onChange={setDay} className="w-full min-[420px]:w-44" />
          <button onClick={load} className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          <button onClick={exportRows} disabled={filtered.length === 0}
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="w-4 h-4" /> Exporter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-7">
        {[
          { label: 'Présents', count: present, pct: Math.round((present / total) * 100), icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-700', ring: 'bg-emerald-100' },
          { label: 'En retard', count: late, pct: Math.round((late / total) * 100), icon: Clock, bg: 'bg-orange-50', color: 'text-orange-700', ring: 'bg-orange-100' },
          { label: 'Absents', count: absent, pct: Math.round((absent / total) * 100), icon: XCircle, bg: 'bg-red-50', color: 'text-red-700', ring: 'bg-red-100' },
          { label: 'En congé', count: onLeave, pct: Math.round((onLeave / total) * 100), icon: Calendar, bg: 'bg-cyan-50', color: 'text-cyan-700', ring: 'bg-cyan-100' },
          { label: 'Maladie', count: sick, pct: Math.round((sick / total) * 100), icon: AlertTriangle, bg: 'bg-rose-50', color: 'text-rose-700', ring: 'bg-rose-100' },
          { label: 'En mission', count: mission, pct: Math.round((mission / total) * 100), icon: Building2, bg: 'bg-blue-50', color: 'text-blue-700', ring: 'bg-blue-100' },
          { label: 'Télétravail', count: remote, pct: Math.round((remote / total) * 100), icon: MapPin, bg: 'bg-violet-50', color: 'text-violet-700', ring: 'bg-violet-100' },
        ].map(card => (
          <button key={card.label} onClick={() => setStatusFilter(card.label === 'Présents' ? 'present' : card.label === 'En retard' ? 'late' : card.label === 'Absents' ? 'absent' : card.label === 'En congé' ? 'on_leave' : card.label === 'Maladie' ? 'sick_leave' : card.label === 'En mission' ? 'on_mission' : 'remote')}
            className={`flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-primary-200 hover:shadow-md ${card.bg}`}>
            <span className={`flex h-12 w-12 items-center justify-center rounded-full ${card.ring}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </span>
            <span>
              <span className={`block text-sm font-semibold ${card.color}`}>{card.label}</span>
              <span className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-950">{card.count}</span>
                <span className="text-sm text-gray-500">{card.pct}%</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {statusTabs.map(tab => (
                <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                    statusFilter === tab.id
                      ? 'border-teal-700 bg-teal-700 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}>
                  {tab.label}
                  <span className={`rounded-md px-1.5 py-0.5 text-xs ${statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <CustomSelect value={siteFilter} onChange={setSiteFilter}
                options={[
                  { value: 'all', label: 'Tous les sites' },
                  ...sites.map(site => ({ value: String(site.id), label: site.name })),
                ]}
                className="w-full sm:w-48" />
              <div className="relative min-w-64 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un employé..."
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
                <Users className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4 text-left">Employé</th>
                    <th className="px-5 py-4 text-left">Statut</th>
                    <th className="px-5 py-4 text-left">Arrivée</th>
                    <th className="px-5 py-4 text-left">Départ</th>
                    <th className="px-5 py-4 text-left">Heures travaillées</th>
                    <th className="px-5 py-4 text-left">Retard</th>
                    <th className="px-5 py-4 text-left">Site / Localisation</th>
                    <th className="px-5 py-4 text-left">Mode</th>
                    {canCorrect && <th className="px-5 py-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRows.map(row => {
                    const status = getRowStatus(row);
                    const name = `${row.first_name} ${row.last_name}`;
                    const initials = `${row.first_name?.[0] || ''}${row.last_name?.[0] || ''}`.toUpperCase();
                    const mode = status === 'on_mission' ? 'Mission' : status === 'remote' ? 'Télétravail' : status === 'on_leave' ? 'Congé' : status === 'sick_leave' ? 'Maladie' : status === 'absent' ? '-' : 'Sur site';
                    const delay = status === 'late' && row.check_in ? '+ retard' : '-';
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-teal-600 text-xs font-bold text-white">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{name}</p>
                              <p className="text-xs text-gray-500">{row.job_title || 'Collaborateur'}</p>
                              {row.break_exceeded && (
                                <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-red-600" title="La pause dépasse la durée maximale autorisée">
                                  <AlertCircle className="h-3 w-3" /> Pause dépassée{row.break_minutes ? ` (${row.break_minutes} min)` : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={status} /></td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900 tabular-nums">{fmt(row.check_in)}</p>
                          {status === 'late' && <p className="text-xs font-medium text-red-500">En retard</p>}
                          {status === 'present' && <p className="text-xs font-medium text-emerald-600">À l'heure</p>}
                        </td>
                        <td className="px-5 py-4 text-gray-600 tabular-nums">{fmt(row.check_out)}</td>
                        <td className="px-5 py-4 text-gray-600 tabular-nums">{fmtH(row.hours_worked)}</td>
                        <td className={`px-5 py-4 text-sm font-medium ${status === 'late' ? 'text-red-500' : 'text-gray-400'}`}>{delay}</td>
                        <td className="px-5 py-4 text-gray-600">
                          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gray-400" /> {row.site_name || 'Non renseigné'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            mode === 'Mission' ? 'bg-blue-50 text-blue-700' :
                            mode === 'Télétravail' ? 'bg-violet-50 text-violet-700' :
                            mode === 'Congé' ? 'bg-cyan-50 text-cyan-700' :
                            mode === 'Maladie' ? 'bg-rose-50 text-rose-700' :
                            mode === '-' ? 'bg-gray-100 text-gray-500' :
                            'bg-emerald-50 text-emerald-700'
                          }`}>{mode}</span>
                        </td>
                        {canCorrect && (
                          <td className="px-5 py-4 text-right">
                            <button onClick={() => setCorrecting(row)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600">
                              <Edit className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={canCorrect ? 9 : 8} className="py-12 text-center text-gray-400">Aucun enregistrement</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 text-sm text-gray-500 lg:flex-row lg:items-center lg:justify-between">
            <span>Affichage de {pageStart} à {pageEnd} sur {filtered.length} employé{filtered.length > 1 ? 's' : ''}</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs">Dernière mise à jour : {lastUpdated}</span>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="h-9 rounded-lg border border-gray-200 px-3 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }).slice(0, 5).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <button key={pageNumber} onClick={() => setPage(pageNumber)}
                    className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-semibold ${
                      safePage === pageNumber ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {pageNumber}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="px-1">...</span>}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="h-9 rounded-lg border border-gray-200 px-3 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
              <CustomSelect value={String(pageSize)} onChange={v => setPageSize(Number(v))}
                options={[
                  { value: '10', label: '10 / page' },
                  { value: '20', label: '20 / page' },
                  { value: '50', label: '50 / page' },
                ]}
                className="w-32" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Répartition par statut</h3>
            <div className="mt-5 flex items-center gap-5">
              <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(${donutStops || '#e5e7eb 0% 100%'})` }}>
                <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-2xl font-bold text-gray-900">{rows.length}</span>
                  <span className="text-xs text-gray-500">Total</span>
                </div>
              </div>
              <div className="space-y-2">
                {statusBreakdown.map(item => (
                  <div key={item.label} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.label}<br /><strong className="font-semibold text-gray-900">{item.count}</strong> ({rows.length ? Math.round((item.count / rows.length) * 100) : 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Sites / Localisations</h3>
            <div className="mt-4 space-y-4">
              {locationStats.map(item => (
                <button key={item.label} type="button" onClick={() => item.siteId && setSiteFilter(item.siteId)}
                  className={`block w-full rounded-lg px-2 py-1 text-left ${item.siteId && siteFilter === item.siteId ? 'bg-teal-50' : ''}`}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${rows.length ? Math.round((item.count / rows.length) * 100) : 0}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Pointages du jour</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Premier pointage</span><span className="font-semibold text-emerald-600">{fmt(firstCheckIn)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Dernier pointage</span><span className="font-semibold text-orange-600">{fmt(lastCheckIn)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Moy. heure d'arrivée</span><span className="font-semibold text-gray-900">{averageArrival ? averageArrival.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Taux de ponctualité</span><span className="font-semibold text-emerald-600">{punctualityRate}%</span></div>
            </div>
          </div>
        </div>
      </div>

      {canCorrect && correcting && <CorrectionModal row={correcting} onClose={() => setCorrecting(null)} onDone={load} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// Modal Correction
// ─────────────────────────────────────────────
function CorrectionModal({
  row,
  onClose,
  onDone,
  initialDate,
  startDate,
  endDate,
}: {
  row: DailySummaryRow;
  onClose: () => void;
  onDone: () => void;
  initialDate?: string;
  startDate?: string;
  endDate?: string;
}) {
  const [form, setForm] = useState({ date: initialDate || localDateISO(), status: 'present', check_in: '', check_out: '', correction_note: '' });
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    apiFetch(`/api/attendance/records?start_date=${startDate || '2020-01-01'}&end_date=${endDate || localDateISO()}&employee_id=${row.id}`)
      .then(setRecords).catch(() => {});
  }, [row.id, startDate, endDate]);

  const selectedRecord = records.find(r => r.date === form.date);

  useEffect(() => {
    if (!selectedRecord) return;
    setForm(f => ({
      ...f,
      status: selectedRecord.status || 'present',
      check_in: toDateTimeLocalValue(selectedRecord.check_in),
      check_out: toDateTimeLocalValue(selectedRecord.check_out),
    }));
  }, [selectedRecord?.id]);

  const handleSubmit = async () => {
    if (form.correction_note.length < 10) { toast.error('Le motif doit faire au moins 10 caractères'); return; }
    setLoading(true);
    try {
      await apiFetch('/api/attendance/records/correct', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: row.id,
          date: form.date,
          status: form.status,
          check_in: form.check_in || undefined,
          check_out: form.check_out || undefined,
          correction_note: form.correction_note,
        }),
      });
      toast.success('Pointage corrigé');
      onDone();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Corriger le pointage — {row.first_name} {row.last_name}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {!selectedRecord && (
            <p className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">Aucun pointage trouvé sur cette date. La correction créera une ligne manuelle.</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <CustomDatePicker value={form.date} min={startDate} max={endDate}
                onChange={v => setForm(f => ({ ...f, date: v }))} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
              <CustomSelect value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
                options={[
                  { value: 'present', label: 'Présent' },
                  { value: 'late', label: 'En retard' },
                  { value: 'absent', label: 'Absent' },
                  { value: 'on_mission', label: 'En mission' },
                  { value: 'remote', label: 'Télétravail' },
                ]}
                className="w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Arrivée (optionnel)</label>
            <input type="datetime-local" value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Départ (optionnel)</label>
            <input type="datetime-local" value={form.check_out} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motif de correction <span className="text-red-500">*</span></label>
            <textarea value={form.correction_note} onChange={e => setForm(f => ({ ...f, correction_note: e.target.value }))} rows={3}
              placeholder="Minimum 10 caractères..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" />
            <p className="text-xs text-gray-400 mt-1">{form.correction_note.length}/10 min</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || form.correction_note.length < 10}
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
  const [startDate, setStartDate] = useState(() => firstLocalDayOfMonthISO());
  const [endDate, setEndDate] = useState(() => localDateISO());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/attendance/my-history?start_date=${startDate}&end_date=${endDate}`);
      setRecords(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [startDate, endDate, statusFilter, pageSize]);

  const workedDays = records.filter(r => ['present', 'late', 'on_mission', 'remote'].includes(r.status)).length;
  const totalH = records.reduce((s, r) => s + (r.hours_worked || 0), 0);
  const totalOT = records.reduce((s, r) => s + (r.overtime_hours || 0), 0);
  const nbLate = records.filter(r => r.status === 'late').length;
  const nbAbsent = records.filter(r => r.status === 'absent').length;
  const nbMission = records.filter(r => r.status === 'on_mission').length;
  const filtered = statusFilter === 'all' ? records : records.filter(r => r.status === statusFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(safePage * pageSize, filtered.length);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const theoreticalHours = workedDays * 8;
  const balance = totalH - theoreticalHours;
  const hourDonut = totalH + totalOT > 0 ? (totalH / (totalH + totalOT)) * 100 : 0;
  const latestActivities = records.slice(0, 3);
  const exportHistory = () => {
    const headers = ['Date', 'Statut', 'Arrivée', 'Départ', 'Heures', 'Heures sup.', 'Note'];
    const csvValue = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map(r => [
      fmtDate(r.date),
      r.status,
      fmt(r.check_in),
      fmt(r.check_out),
      fmtH(r.hours_worked),
      fmtH(r.overtime_hours),
      r.correction_note || '',
    ].map(csvValue).join(';'));
    const blob = new Blob([`\uFEFF${headers.map(csvValue).join(';')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presence_historique_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-gray-600">Du
            <CustomDatePicker value={startDate} onChange={setStartDate} className="mt-1 w-full" />
          </label>
          <label className="text-xs font-medium text-gray-600">Au
            <CustomDatePicker value={endDate} onChange={setEndDate} className="mt-1 w-full" />
          </label>
          <label className="text-xs font-medium text-gray-600">Statut
            <CustomSelect value={statusFilter} onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'present', label: "À l'heure" },
                { value: 'late', label: 'En retard' },
                { value: 'absent', label: 'Absent' },
                { value: 'on_mission', label: 'Mission' },
                { value: 'remote', label: 'Télétravail' },
              ]}
              className="mt-1 w-full" />
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={exportHistory} disabled={filtered.length === 0}
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Download className="h-4 w-4" /> Exporter
          </button>
          <button onClick={load}
            className="flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Jours travaillés', value: workedDays, icon: Calendar, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Heures travaillées', value: fmtH(totalH), icon: Clock, color: 'text-orange-700', bg: 'bg-orange-50' },
          { label: 'Heures sup.', value: fmtH(totalOT), icon: TrendingUp, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Retards', value: nbLate, icon: AlertCircle, color: 'text-orange-700', bg: 'bg-orange-50' },
          { label: 'Absences', value: nbAbsent, icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Missions', value: nbMission, icon: MapPin, color: 'text-violet-700', bg: 'bg-violet-50' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-950">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">Mon historique des pointages</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary-500" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4 text-left">Date</th>
                    <th className="px-5 py-4 text-left">Statut</th>
                    <th className="px-5 py-4 text-left">Arrivée</th>
                    <th className="px-5 py-4 text-left">Départ</th>
                    <th className="px-5 py-4 text-left">Pause</th>
                    <th className="px-5 py-4 text-left">Heures</th>
                    <th className="px-5 py-4 text-left">Heures sup.</th>
                    <th className="px-5 py-4 text-left">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/80">
                      <td className="px-5 py-4 font-semibold text-gray-900">{fmtDate(r.date)}</td>
                      <td className="px-5 py-4"><StatusBadge status={r.status === 'present' ? 'present' : r.status} /></td>
                      <td className="px-5 py-4 text-gray-600 tabular-nums">{fmt(r.check_in)}</td>
                      <td className="px-5 py-4 text-gray-600 tabular-nums">{fmt(r.check_out)}{r.is_auto_closed && <span className="ml-1 text-xs text-orange-500">(auto)</span>}</td>
                      <td className="px-5 py-4 text-gray-600">{r.check_in && r.check_out ? 'Pause fixe' : '-'}</td>
                      <td className="px-5 py-4 text-gray-600 tabular-nums">{fmtH(r.hours_worked)}</td>
                      <td className={`px-5 py-4 tabular-nums ${(r.overtime_hours || 0) > 0 ? 'font-semibold text-emerald-600' : 'text-gray-500'}`}>{fmtH(r.overtime_hours || 0)}</td>
                      <td className="max-w-32 truncate px-5 py-4 text-xs text-gray-400" title={r.correction_note}>{r.correction_note || '-'}</td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr><td colSpan={8} className="py-12 text-center text-gray-400">Aucun enregistrement sur cette période</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Affichage de {pageStart} à {pageEnd} sur {filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: totalPages }).slice(0, 4).map((_, index) => {
                const pageNumber = index + 1;
                return <button key={pageNumber} onClick={() => setPage(pageNumber)}
                  className={`h-9 min-w-9 rounded-lg border px-3 font-semibold ${safePage === pageNumber ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'}`}>{pageNumber}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              <CustomSelect value={String(pageSize)} onChange={v => setPageSize(Number(v))}
                options={[
                  { value: '10', label: '10 / page' },
                  { value: '20', label: '20 / page' },
                  { value: '50', label: '50 / page' },
                ]}
                className="w-32" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Répartition des heures</h3>
            <div className="mt-5 flex items-center gap-5">
              <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(#10b981 0% ${hourDonut}%, #228be6 ${hourDonut}% 100%)` }}>
                <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-xl font-bold text-gray-900">{fmtH(totalH)}</span>
                  <span className="text-xs text-gray-500">Total</span>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Heures travaillées<br /><strong className="ml-4 text-gray-900">{fmtH(totalH)}</strong></p>
                <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" /> Heures supplémentaires<br /><strong className="ml-4 text-gray-900">{fmtH(totalOT)}</strong></p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Récapitulatif du mois</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Heures théoriques ({workedDays} jours)</span><span className="font-semibold text-gray-900">{fmtH(theoreticalHours)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Heures travaillées</span><span className="font-semibold text-gray-900">{fmtH(totalH)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Heures supplémentaires</span><span className="font-semibold text-gray-900">{fmtH(totalOT)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Retards</span><span className="font-semibold text-gray-900">{nbLate}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Absences</span><span className="font-semibold text-gray-900">{nbAbsent}</span></div>
              <div className={`flex justify-between rounded-lg px-3 py-2 font-semibold ${balance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                <span>Solde du mois</span><span>{balance >= 0 ? '+' : ''}{fmtH(balance)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Dernières activités</h3>
            <div className="mt-4 space-y-4">
              {latestActivities.map(activity => (
                <div key={activity.id} className="flex gap-3">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activity.status === 'late' ? 'bg-orange-50 text-orange-600' : activity.status === 'absent' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {activity.status === 'absent' ? <XCircle className="h-4 w-4" /> : activity.status === 'late' ? <Clock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{activity.status === 'late' ? 'Pointage en retard' : activity.status === 'absent' ? 'Absence déclarée' : 'Pointage enregistré'}</p>
                    <p className="text-xs text-gray-500">{fmtDate(activity.date)} {activity.check_in ? `à ${fmt(activity.check_in)}` : ''}</p>
                  </div>
                </div>
              ))}
              {latestActivities.length === 0 && <p className="text-sm text-gray-400">Aucune activité récente</p>}
            </div>
          </div>
        </div>
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
  const [search, setSearch] = useState('');
  const [correcting, setCorrecting] = useState<MonthlyRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [closureTab, setClosureTab] = useState<'collab' | 'service' | 'site' | 'anomalies'>('collab');
  const [spPage, setSpPage] = useState(1);
  const [siPage, setSiPage] = useState(1);
  const [anPage, setAnPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/attendance/monthly-summary?year=${year}&month=${month}`);
      setRows(d);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [year, month, search, pageSize]);

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
  const closedCount = validatedCount + sentCount;
  const totalHours = rows.reduce((sum, row) => sum + (row.total_hours_worked || 0), 0);
  const totalOvertime = rows.reduce((sum, row) => sum + (row.total_overtime_hours || 0), 0);
  const totalLate = rows.reduce((sum, row) => sum + (row.total_late_days || 0), 0);
  const totalAbsent = rows.reduce((sum, row) => sum + (row.total_absent_days || 0) + (row.missing_days || 0), 0);
  const progress = rows.length ? Math.round((closedCount / rows.length) * 100) : 0;
  const term = search.trim().toLowerCase();
  const filtered = rows.filter(row => `${row.first_name} ${row.last_name} ${row.job_title || ''} ${row.department_name || ''} ${row.site_name || ''}`.toLowerCase().includes(term));
  const anomalyRows = filtered.filter(row => (row.missing_days || 0) > 0 || (row.total_late_days || 0) > 0 || (row.total_absent_days || 0) > 0);
  const anomalyCount = rows.filter(row => (row.missing_days || 0) > 0 || (row.total_late_days || 0) > 0 || (row.total_absent_days || 0) > 0).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(safePage * pageSize, filtered.length);
  const paginatedRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const monthStartISO = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthStart = `01/${String(month).padStart(2, '0')}/${year}`;
  const monthEndDate = new Date(year, month, 0).getDate();
  const monthEndISO = `${year}-${String(month).padStart(2, '0')}-${String(monthEndDate).padStart(2, '0')}`;
  const monthEnd = `${String(monthEndDate).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  const closureStatus = sentCount > 0 ? 'Envoyé paie' : validatedCount > 0 && draftCount === 0 ? 'Validé' : 'En cours';
  const validator = rows.find(row => row.validated_by_name || row.validated_by_email || row.validated_by);
  const latestUpdated = rows
    .map(row => row.updated_at || row.validated_at || row.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(normalizeDate(String(b))).getTime() - new Date(normalizeDate(String(a))).getTime())[0];
  const latestCreated = rows
    .map(row => row.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(normalizeDate(String(a))).getTime() - new Date(normalizeDate(String(b))).getTime())[0];
  const latestValidated = rows
    .map(row => row.validated_at)
    .filter(Boolean)
    .sort((a, b) => new Date(normalizeDate(String(b))).getTime() - new Date(normalizeDate(String(a))).getTime())[0];
  const monthlyActivities = [
    anomalyCount > 0 ? { label: `${anomalyCount} collaborateur${anomalyCount > 1 ? 's' : ''} à vérifier`, date: latestUpdated, cls: 'text-orange-700' } : null,
    latestValidated ? { label: sentCount ? 'Clôture transmise à la paie' : 'Clôture validée', date: latestValidated, cls: sentCount ? 'text-blue-700' : 'text-emerald-700' } : null,
    rows.length > 0 ? { label: `${rows.length} récapitulatif${rows.length > 1 ? 's' : ''} généré${rows.length > 1 ? 's' : ''}`, date: latestCreated, cls: 'text-blue-700' } : null,
  ].filter(Boolean) as { label: string; date?: string; cls: string }[];
  const exportMonthly = async () => {
    try {
      const token = getToken();
      const url = `${API_URL}/api/attendance/export/monthly?year=${year}&month=${month}`;
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
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-950">Clôture mensuelle</h2>
          <p className="mt-1 text-sm text-gray-500">Résumé et validation des pointages pour le mois de {months[month - 1].toLowerCase()} {year}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportMonthly}
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <Download className="h-4 w-4" /> Exporter le détail
          </button>
          {draftCount > 0 && (
            <button onClick={() => setConfirmAction('validate')} disabled={actionLoading}
              className="flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Valider la clôture
            </button>
          )}
          {validatedCount > 0 && (
            <button onClick={() => setConfirmAction('payroll')} disabled={actionLoading}
              className="flex h-10 items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Envoyer en paie
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex h-10 min-w-44 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800">
            <Calendar className="h-4 w-4 text-gray-500" /> {months[month - 1]} {year}
          </div>
          <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <button onClick={load} className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: 'Collaborateurs', value: rows.length, sub: 'Total', icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Pointages valides', value: closedCount, sub: `${progress}%`, icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'À corriger', value: anomalyCount, sub: rows.length ? `${Math.round((anomalyCount / rows.length) * 100)}%` : '0%', icon: Clock, color: 'text-orange-700', bg: 'bg-orange-50' },
          { label: 'Absences non justifiées', value: totalAbsent, sub: 'Mois en cours', icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Heures travaillées', value: fmtH(totalHours), sub: 'Mois en cours', icon: Timer, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Heures supp. totales', value: fmtH(totalOvertime), sub: 'Mois en cours', icon: TrendingUp, color: 'text-violet-700', bg: 'bg-violet-50' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <p className="text-xs font-semibold text-gray-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-950">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'collab', label: 'Résumé par collaborateur', icon: Users },
                { id: 'service', label: 'Synthèse par service', icon: BarChart3 },
                { id: 'site', label: 'Synthèse par site', icon: Building2 },
                { id: 'anomalies', label: `Anomalies & corrections (${anomalyCount})`, icon: AlertTriangle },
              ].map((tabItem) => (
                <button key={tabItem.id}
                  onClick={() => setClosureTab(tabItem.id as typeof closureTab)}
                  className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${
                    closureTab === tabItem.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}>
                  <tabItem.icon className="h-4 w-4" /> {tabItem.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={closureTab === 'collab' || closureTab === 'anomalies' ? 'Rechercher un collaborateur...' : 'Rechercher...'}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary-500" /></div>
          ) : closureTab === 'collab' ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-4 text-left">Collaborateur</th>
                      <th className="px-5 py-4 text-left">Jours ouvrés</th>
                      <th className="px-5 py-4 text-left">Jours travaillés</th>
                      <th className="px-5 py-4 text-left">Absences</th>
                      <th className="px-5 py-4 text-left">Retards</th>
                      <th className="px-5 py-4 text-left">Heures travaillées</th>
                      <th className="px-5 py-4 text-left">Heures supp.</th>
                      <th className="px-5 py-4 text-left">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedRows.map(row => {
                      const initials = `${row.first_name?.[0] || ''}${row.last_name?.[0] || ''}`.toUpperCase();
                      const subtitle = row.job_title || row.department_name || row.site_name || 'Collaborateur';
                      return (
                        <tr key={row.id} className="hover:bg-gray-50/80">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-teal-600 text-xs font-bold text-white">{initials}</div>
                              <div>
                                <p className="font-semibold text-gray-900">{row.first_name} {row.last_name}</p>
                                <p className="text-xs text-gray-500">{subtitle}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-600">{row.working_days ?? '—'}</td>
                          <td className="px-5 py-4 text-gray-600">{row.total_days_worked}</td>
                          <td className="px-5 py-4 text-gray-600">{(row.total_absent_days || 0) + (row.missing_days || 0)}</td>
                          <td className="px-5 py-4 text-gray-600">{row.total_late_days}</td>
                          <td className="px-5 py-4 text-gray-600 tabular-nums">{fmtH(row.total_hours_worked)}</td>
                          <td className="px-5 py-4 text-gray-600 tabular-nums">{fmtH(row.total_overtime_hours || 0)}</td>
                          <td className="px-5 py-4">
                            {row.status === 'draft' && <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">Brouillon</span>}
                            {row.status === 'validated' && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Validé</span>}
                            {row.status === 'sent_to_payroll' && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Paie</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedRows.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-gray-400">Aucun récapitulatif pour ce mois</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 text-sm text-gray-500 lg:flex-row lg:items-center lg:justify-between">
                <span>Affichage de {pageStart} à {pageEnd} sur {filtered.length} collaborateur{filtered.length > 1 ? 's' : ''}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                    className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  {Array.from({ length: totalPages }).slice(0, 4).map((_, index) => {
                    const pageNumber = index + 1;
                    return <button key={pageNumber} onClick={() => setPage(pageNumber)}
                      className={`h-9 min-w-9 rounded-lg border px-3 font-semibold ${safePage === pageNumber ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-600'}`}>{pageNumber}</button>;
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                    className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  <CustomSelect value={String(pageSize)} onChange={v => setPageSize(Number(v))}
                    options={[
                      { value: '10', label: '10 / page' },
                      { value: '20', label: '20 / page' },
                      { value: '50', label: '50 / page' },
                    ]}
                    className="w-32" />
                </div>
              </div>
            </>
          ) : closureTab === 'service' ? (() => {
            const byDept = filtered.reduce<Record<string, typeof rows>>((acc, r) => {
              const key = r.department_name || 'Non affecté';
              if (!acc[key]) acc[key] = [];
              acc[key].push(r);
              return acc;
            }, {});
            const depts = Object.entries(byDept);
            const PAGE_SIZE_S = 8;
            const spPages = Math.max(1, Math.ceil(depts.length / PAGE_SIZE_S));
            const spSlice = depts.slice((spPage - 1) * PAGE_SIZE_S, spPage * PAGE_SIZE_S);
            if (depts.length === 0) return <div className="py-16 text-center text-gray-400">Aucune donnée de présence pour ce mois</div>;
            return (
              <>
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {spSlice.map(([dept, members]) => {
                    const n = members.length;
                    const avgDays = (members.reduce((s, r) => s + (r.total_days_worked || 0), 0) / n).toFixed(1);
                    const avgAbsent = (members.reduce((s, r) => s + (r.total_absent_days || 0) + (r.missing_days || 0), 0) / n).toFixed(1);
                    const avgLate = (members.reduce((s, r) => s + (r.total_late_days || 0), 0) / n).toFixed(1);
                    const totalH = fmtH(members.reduce((s, r) => s + (r.total_hours_worked || 0), 0));
                    const anomalies = members.filter(r => (r.missing_days || 0) > 0 || (r.total_late_days || 0) > 0 || (r.total_absent_days || 0) > 0).length;
                    return (
                      <div key={dept} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100">
                            <BarChart3 className="h-4 w-4 text-teal-600" />
                          </div>
                          {anomalies > 0 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">{anomalies} à vérifier</span>}
                        </div>
                        <p className="mb-1 text-sm font-semibold text-gray-900 truncate" title={dept}>{dept}</p>
                        <p className="mb-3 text-xs text-gray-500">{n} collaborateur{n > 1 ? 's' : ''}</p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Jours travaillés (moy.)</span><span className="font-semibold text-gray-800">{avgDays}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Absences (moy.)</span><span className={`font-semibold ${Number(avgAbsent) > 2 ? 'text-orange-600' : 'text-gray-800'}`}>{avgAbsent}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Retards (moy.)</span><span className={`font-semibold ${Number(avgLate) > 1 ? 'text-yellow-600' : 'text-gray-800'}`}>{avgLate}</span></div>
                          <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="text-gray-500">Heures totales</span><span className="font-semibold tabular-nums text-teal-700">{totalH}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {spPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-500">
                    <span>{depts.length} service{depts.length > 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSpPage(p => Math.max(1, p - 1))} disabled={spPage === 1} className="h-8 rounded-lg border border-gray-200 px-2.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="tabular-nums">{spPage} / {spPages}</span>
                      <button onClick={() => setSpPage(p => Math.min(spPages, p + 1))} disabled={spPage === spPages} className="h-8 rounded-lg border border-gray-200 px-2.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </>
            );
          })() : closureTab === 'site' ? (() => {
            const bySite = filtered.reduce<Record<string, typeof rows>>((acc, r) => {
              const key = r.site_name || 'Non défini';
              if (!acc[key]) acc[key] = [];
              acc[key].push(r);
              return acc;
            }, {});
            const sites = Object.entries(bySite);
            const PAGE_SIZE_SI = 8;
            const siPages = Math.max(1, Math.ceil(sites.length / PAGE_SIZE_SI));
            const siSlice = sites.slice((siPage - 1) * PAGE_SIZE_SI, siPage * PAGE_SIZE_SI);
            if (sites.length === 0) return <div className="py-16 text-center text-gray-400">Aucun site configuré pour ce mois</div>;
            return (
              <>
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {siSlice.map(([site, members]) => {
                    const n = members.length;
                    const avgDays = (members.reduce((s, r) => s + (r.total_days_worked || 0), 0) / n).toFixed(1);
                    const avgAbsent = (members.reduce((s, r) => s + (r.total_absent_days || 0) + (r.missing_days || 0), 0) / n).toFixed(1);
                    const totalH = fmtH(members.reduce((s, r) => s + (r.total_hours_worked || 0), 0));
                    const anomalies = members.filter(r => (r.missing_days || 0) > 0 || (r.total_late_days || 0) > 0 || (r.total_absent_days || 0) > 0).length;
                    return (
                      <div key={site} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                            <Building2 className="h-4 w-4 text-blue-600" />
                          </div>
                          {anomalies > 0 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">{anomalies} à vérifier</span>}
                        </div>
                        <p className="mb-1 text-sm font-semibold text-gray-900 truncate" title={site}>{site}</p>
                        <p className="mb-3 text-xs text-gray-500">{n} collaborateur{n > 1 ? 's' : ''}</p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Jours travaillés (moy.)</span><span className="font-semibold text-gray-800">{avgDays}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Absences (moy.)</span><span className={`font-semibold ${Number(avgAbsent) > 2 ? 'text-orange-600' : 'text-gray-800'}`}>{avgAbsent}</span></div>
                          <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="text-gray-500">Heures totales</span><span className="font-semibold tabular-nums text-blue-700">{totalH}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {siPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-500">
                    <span>{sites.length} site{sites.length > 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSiPage(p => Math.max(1, p - 1))} disabled={siPage === 1} className="h-8 rounded-lg border border-gray-200 px-2.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="tabular-nums">{siPage} / {siPages}</span>
                      <button onClick={() => setSiPage(p => Math.min(siPages, p + 1))} disabled={siPage === siPages} className="h-8 rounded-lg border border-gray-200 px-2.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </>
            );
          })() : (() => {
            const PAGE_SIZE_A = 10;
            const anTotal = anomalyRows.length;
            const anPages = Math.max(1, Math.ceil(anTotal / PAGE_SIZE_A));
            const anSlice = anomalyRows.slice((anPage - 1) * PAGE_SIZE_A, anPage * PAGE_SIZE_A);
            return (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-orange-50 text-xs font-semibold uppercase text-orange-700">
                      <tr>
                        <th className="px-5 py-3.5 text-left">Collaborateur</th>
                        <th className="px-5 py-3.5 text-left">Service / site</th>
                        <th className="px-5 py-3.5 text-left">Anomalies</th>
                        <th className="px-5 py-3.5 text-right">Heures trav.</th>
                        <th className="px-5 py-3.5 text-center">Statut</th>
                        <th className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {anSlice.map(row => {
                        const anomalies = [
                          row.missing_days ? `${row.missing_days} jour${row.missing_days > 1 ? 's' : ''} sans pointage` : null,
                          row.total_late_days ? `${row.total_late_days} retard${row.total_late_days > 1 ? 's' : ''}` : null,
                          row.total_absent_days ? `${row.total_absent_days} absence${row.total_absent_days > 1 ? 's' : ''}` : null,
                        ].filter(Boolean).join(', ');
                        return (
                          <tr key={row.id} className="hover:bg-orange-50/40 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-gray-900">{row.first_name} {row.last_name}</td>
                            <td className="px-5 py-3.5 text-gray-600">{row.department_name || 'Non renseigné'} / {row.site_name || 'Non renseigné'}</td>
                            <td className="px-5 py-3.5 text-orange-700">{anomalies || '—'}</td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-gray-600">{fmtH(row.total_hours_worked)}</td>
                            <td className="px-5 py-3.5 text-center">
                              <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                <AlertTriangle className="h-3 w-3" /> À vérifier
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button onClick={() => setCorrecting(row)}
                                className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                <Edit className="h-3.5 w-3.5" /> Corriger
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {anTotal === 0 && (
                        <tr>
                          <td colSpan={6} className="py-14 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100"><CheckCheck className="h-6 w-6 text-emerald-600" /></div>
                              <p className="font-semibold text-emerald-700">Aucune anomalie détectée</p>
                              <p className="text-xs text-gray-400">Tous les collaborateurs ont une situation complète</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {anPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-500">
                    <span>{anTotal} anomalie{anTotal > 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setAnPage(p => Math.max(1, p - 1))} disabled={anPage === 1} className="h-8 rounded-lg border border-gray-200 px-2.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                      <span className="tabular-nums">{anPage} / {anPages}</span>
                      <button onClick={() => setAnPage(p => Math.min(anPages, p + 1))} disabled={anPage === anPages} className="h-8 rounded-lg border border-gray-200 px-2.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Statut de clôture</h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{closureStatus}</span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Période</span><span className="font-semibold text-gray-900">{monthStart} → {monthEnd}</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-500">Clôture par</span><span className="text-right font-semibold text-gray-900">{validator?.validated_by_name || validator?.validated_by_email || (validator?.validated_by ? `Utilisateur #${validator.validated_by}` : '—')}</span></div>
              <div className="flex justify-between gap-3"><span className="text-gray-500">Dernière mise à jour</span><span className="text-right font-semibold text-gray-900">{fmtDateTime(latestUpdated)}</span></div>
              <div>
                <div className="mb-1 flex justify-between"><span className="text-gray-500">Progression</span><span className="font-semibold text-gray-900">{progress}%</span></div>
                <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Workflow de validation</h3>
            <div className="mt-4 space-y-4">
              {[
                { label: 'Préparation', desc: 'Collecte et vérification des pointages', state: rows.length ? 'Terminé' : 'En attente', color: 'bg-emerald-600' },
                { label: 'Vérification RH', desc: 'Contrôle des anomalies et corrections', state: anomalyCount ? 'En cours' : 'Terminé', color: anomalyCount ? 'bg-orange-500' : 'bg-emerald-600' },
                { label: 'Validation RH', desc: 'Validation finale de la clôture', state: validatedCount || sentCount ? 'Terminé' : 'En attente', color: validatedCount || sentCount ? 'bg-emerald-600' : 'bg-gray-300' },
                { label: 'Transmission à la paie', desc: 'Données prêtes pour la paie', state: sentCount ? 'Terminé' : 'En attente', color: sentCount ? 'bg-emerald-600' : 'bg-gray-300' },
              ].map((step, index) => (
                <div key={step.label} className="flex gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${step.color}`}>{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                      <span className={`text-xs font-semibold ${step.state === 'En cours' ? 'text-orange-600' : step.state === 'Terminé' ? 'text-emerald-600' : 'text-gray-500'}`}>{step.state}</span>
                    </div>
                    <p className="text-xs text-gray-500">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Dernières activités</h3>
            <div className="mt-4 space-y-4 text-sm">
              {monthlyActivities.map(activity => (
                <div key={activity.label} className="flex justify-between gap-3">
                  <span className={`font-semibold ${activity.cls}`}>{activity.label}</span>
                  <span className="text-right text-gray-500">{fmtDateTime(activity.date)}</span>
                </div>
              ))}
              {monthlyActivities.length === 0 && <p className="text-gray-400">Aucune activité pour ce mois</p>}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog isOpen={confirmAction === 'validate'} onClose={() => setConfirmAction(null)}
        onConfirm={() => doAction('validate')} title="Valider les récapitulatifs"
        message={`Valider les ${draftCount} récapitulatifs brouillons de ${months[month - 1]} ${year} ?`}
        confirmText="Valider" />
      <ConfirmDialog isOpen={confirmAction === 'payroll'} onClose={() => setConfirmAction(null)}
        onConfirm={() => doAction('payroll')} title="Envoyer en paie"
        message={`Envoyer les ${validatedCount} récapitulatifs validés de ${months[month - 1]} ${year} en paie ? Cette action est irréversible.`}
        confirmText="Envoyer en paie" danger />
      {correcting && (
        <CorrectionModal
          row={{
            id: correcting.employee_id,
            first_name: correcting.first_name,
            last_name: correcting.last_name,
            department_id: correcting.department_id,
            job_title: correcting.job_title,
            site_id: correcting.site_id,
            site_name: correcting.site_name,
          }}
          initialDate={monthStartISO}
          startDate={monthStartISO}
          endDate={monthEndISO}
          onClose={() => setCorrecting(null)}
          onDone={load}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB : Statistiques
// ─────────────────────────────────────────────
function TabStats() {
  const now = new Date();
  const firstDay = firstLocalDayOfMonthISO(now);
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(localDateISO(now));
  const [siteFilter, setSiteFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [deptStats, setDeptStats] = useState<any[]>([]);
  const [siteStats, setSiteStats] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [topLate, setTopLate] = useState<any[]>([]);
  const [sites, setSites] = useState<AttendanceSite[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const siteParam = siteFilter !== 'all' ? `&site_id=${siteFilter}` : '';
      const deptParam = departmentFilter !== 'all' ? `&department_id=${departmentFilter}` : '';
      const [s, d, bySite, daily, late, siteList, deptList] = await Promise.all([
        apiFetch(`/api/attendance/stats?start_date=${startDate}&end_date=${endDate}${siteParam}${deptParam}`),
        apiFetch(`/api/attendance/stats/by-department?start_date=${startDate}&end_date=${endDate}${siteParam}`),
        apiFetch(`/api/attendance/stats/by-site?start_date=${startDate}&end_date=${endDate}${deptParam}`),
        apiFetch(`/api/attendance/stats/daily?start_date=${startDate}&end_date=${endDate}${siteParam}${deptParam}`),
        apiFetch(`/api/attendance/stats/top-late?start_date=${startDate}&end_date=${endDate}${siteParam}${deptParam}`),
        apiFetch('/api/attendance/sites').catch(() => []),
        apiFetch('/api/departments').catch(() => []),
      ]);
      const siteArray = Array.isArray(siteList) ? siteList : (siteList.sites || siteList.items || []);
      const deptArray = Array.isArray(deptList) ? deptList : (deptList.departments || deptList.items || []);
      setStats(s);
      setDeptStats(d);
      setSiteStats(bySite);
      setDailyStats(daily);
      setTopLate(late);
      setSites(siteArray.filter((site: AttendanceSite) => site.is_active));
      setDepartments(deptArray);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate, siteFilter, departmentFilter]);

  useEffect(() => { load(); }, [load]);

  const totalEmployees = stats?.total_employees || 0;
  const presentLike = (stats?.total_present || 0) + (stats?.total_late || 0) + (stats?.total_on_mission || 0) + (stats?.total_remote || 0);
  const totalHours = stats?.total_hours_worked || 0;
  const totalOvertime = stats?.total_overtime || 0;
  const normalHours = Math.max(0, totalHours - totalOvertime);
  const statusTotal = Math.max(1, presentLike + (stats?.total_absent || 0));
  const hoursTotal = Math.max(1, totalHours);
  const presenceRate = stats?.presence_rate || 0;
  const punctualityRate = stats?.punctuality_rate || 0;
  const absenteeismRate = stats?.absenteeism_rate || 0;
  const workingDays = (() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) count += 1;
    return count;
  })();
  const cards = stats ? [
    { label: 'Effectif total', value: totalEmployees, sub: 'Collaborateurs', icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Taux de présence', value: `${presenceRate}%`, sub: `${presentLike} pointage${presentLike > 1 ? 's' : ''} actif${presentLike > 1 ? 's' : ''}`, icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Taux de ponctualité', value: `${punctualityRate}%`, sub: `${stats.total_present || 0} à l'heure`, icon: Clock, color: 'text-orange-700', bg: 'bg-orange-50' },
    { label: "Taux d'absentéisme", value: `${absenteeismRate}%`, sub: `${stats.total_absent || 0} absence${(stats.total_absent || 0) > 1 ? 's' : ''}`, icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
    { label: 'Heures travaillées', value: fmtH(totalHours), sub: 'Total période', icon: Timer, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Heures sup. totales', value: fmtH(totalOvertime), sub: 'Total période', icon: TrendingUp, color: 'text-violet-700', bg: 'bg-violet-50' },
  ] : [];
  const statusBreakdown = [
    { label: 'Présents', count: stats?.total_present || 0, color: '#10b981' },
    { label: 'En retard', count: stats?.total_late || 0, color: '#f97316' },
    { label: 'Absents', count: stats?.total_absent || 0, color: '#ef4444' },
    { label: 'En mission', count: stats?.total_on_mission || 0, color: '#2563eb' },
    { label: 'Télétravail', count: stats?.total_remote || 0, color: '#8b5cf6' },
  ];
  let cursor = 0;
  const statusDonut = statusBreakdown.map(item => {
    const start = cursor;
    const end = cursor + (item.count / statusTotal) * 100;
    cursor = end;
    return `${item.color} ${start}% ${end}%`;
  }).join(', ');
  const hoursDonut = `#10b981 0% ${(normalHours / hoursTotal) * 100}%, #2563eb ${(normalHours / hoursTotal) * 100}% 100%`;
  const maxSiteHours = Math.max(1, ...siteStats.map(s => Number(s.total_hours_worked || 0)));
  const maxAbsRate = Math.max(1, ...deptStats.map(d => {
    const total = Number(d.total_records || 0);
    return total ? Math.round((Number(d.absent || 0) / total) * 100) : 0;
  }));

  const exportReport = async () => {
    try {
      const { default: jsPDF } = await import('jspdf/dist/jspdf.es.min.js');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 18;
      const addText = (text: string, x: number, yy: number, size = 10, style: 'normal' | 'bold' = 'normal') => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.text(text, x, yy);
      };
      const addLine = (label: string, value: string | number) => {
        if (y > 276) { doc.addPage(); y = 18; }
        addText(label, margin, y, 9);
        addText(String(value), pageWidth - margin, y, 9, 'bold');
        y += 7;
      };
      const section = (title: string) => {
        if (y > 262) { doc.addPage(); y = 18; }
        y += 6;
        doc.setFillColor(240, 253, 250);
        doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F');
        addText(title, margin + 2, y, 10, 'bold');
        y += 10;
      };

      addText('Rapport statistiques de présence', margin, y, 16, 'bold');
      y += 8;
      addText(`Période : ${fmtDate(startDate)} - ${fmtDate(endDate)}`, margin, y, 10);
      y += 6;
      addText(`Périmètre : ${siteFilter === 'all' ? 'Tous les sites' : sites.find(s => String(s.id) === siteFilter)?.name || 'Site sélectionné'} / ${departmentFilter === 'all' ? 'Tous les services' : departments.find(d => String(d.id) === departmentFilter)?.name || 'Service sélectionné'}`, margin, y, 9);
      y += 8;

      section('Indicateurs clés');
      addLine('Effectif total', totalEmployees);
      addLine('Taux de présence', `${presenceRate}%`);
      addLine('Taux de ponctualité', `${punctualityRate}%`);
      addLine("Taux d'absentéisme", `${absenteeismRate}%`);
      addLine('Heures travaillées', fmtH(totalHours));
      addLine('Heures supplémentaires', fmtH(totalOvertime));

      section('Répartition par statut');
      statusBreakdown.forEach(item => addLine(item.label, item.count));

      section('Heures par site');
      (siteStats.length ? siteStats : [{ site_name: 'Aucun site', total_hours_worked: 0 }]).slice(0, 12).forEach(site => {
        addLine(site.site_name || 'Non défini', fmtH(Number(site.total_hours_worked || 0)));
      });

      section("Absentéisme par service");
      (deptStats.length ? deptStats : [{ department_name: 'Aucun service', total_records: 0, absent: 0 }]).slice(0, 12).forEach(dept => {
        const total = Number(dept.total_records || 0);
        const rate = total ? Math.round((Number(dept.absent || 0) / total) * 100) : 0;
        addLine(dept.department_name || 'Non renseigné', `${rate}%`);
      });

      section('Top retards');
      if (topLate.length === 0) addLine('Retards', 'Aucun retard sur la période');
      topLate.slice(0, 10).forEach(person => {
        addLine(`${person.first_name} ${person.last_name}`, `${person.late_count} retard${Number(person.late_count || 0) > 1 ? 's' : ''}`);
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Généré le ${new Date().toLocaleString('fr-FR')} - Page ${i}/${pageCount}`, margin, 288);
      }
      doc.save(`presence_statistiques_${startDate}_${endDate}.pdf`);
      toast.success('Rapport PDF généré');
    } catch (e: any) {
      toast.error(e.message || 'Erreur génération PDF');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-950">Statistiques</h2>
          <p className="mt-1 text-sm text-gray-500">Analyse des données de présence et de pointage sur la période sélectionnée.</p>
        </div>
        <button onClick={exportReport} disabled={!stats}
          className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <Download className="h-4 w-4" /> Exporter le rapport
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <CustomSelect value="custom" onChange={() => {}}
          options={[{ value: 'custom', label: 'Personnalisée' }]}
          className="w-full lg:w-44" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-[420px]:col-span-2 lg:flex lg:items-center">
          <CustomDatePicker value={startDate} onChange={setStartDate} className="w-full lg:w-40" />
          <CustomDatePicker value={endDate} onChange={setEndDate} className="w-full lg:w-40" />
        </div>
        <CustomSelect value={siteFilter} onChange={setSiteFilter}
          options={[
            { value: 'all', label: 'Tous les sites' },
            ...sites.map(site => ({ value: String(site.id), label: site.name })),
          ]}
          className="w-full lg:w-44" />
        <CustomSelect value={departmentFilter} onChange={setDepartmentFilter}
          options={[
            { value: 'all', label: 'Tous les services' },
            ...departments.map(dept => ({ value: String(dept.id), label: dept.name })),
          ]}
          className="w-full lg:w-44" />
        <button onClick={load} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 min-[420px]:col-span-2 lg:col-span-1">
          <Filter className="h-4 w-4 shrink-0" /> Appliquer
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary-500" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-6">
            {cards.map(c => (
              <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.bg}`}>
                    <c.icon className={`h-5 w-5 ${c.color}`} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">{c.label}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-950">{c.value}</p>
                    <p className="text-xs text-gray-500">{c.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr_1fr]">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Évolution de la présence</h3>
                <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600">Par jour</span>
              </div>
              <div className="h-56">
                {dailyStats.length > 0 ? (
                  <svg viewBox="0 0 640 220" className="h-full w-full overflow-visible">
                    {[0, 25, 50, 75, 100].map((tick) => (
                      <g key={tick}>
                        <line x1="42" x2="625" y1={190 - tick * 1.6} y2={190 - tick * 1.6} stroke="#e5e7eb" strokeWidth="1" />
                        <text x="8" y={194 - tick * 1.6} fontSize="11" fill="#64748b">{tick}%</text>
                      </g>
                    ))}
                    <polyline fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      points={dailyStats.map((d, i) => `${52 + i * (560 / Math.max(1, dailyStats.length - 1))},${190 - (d.presence_rate || 0) * 1.6}`).join(' ')} />
                    <polyline fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      points={dailyStats.map((d, i) => `${52 + i * (560 / Math.max(1, dailyStats.length - 1))},${190 - (d.punctuality_rate || 0) * 1.6}`).join(' ')} />
                    {dailyStats.map((d, i) => {
                      const x = 52 + i * (560 / Math.max(1, dailyStats.length - 1));
                      return <text key={d.date} x={x - 14} y="214" fontSize="11" fill="#64748b">{fmtDate(d.date).slice(0, 5)}</text>;
                    })}
                  </svg>
                ) : <div className="flex h-full items-center justify-center text-sm text-gray-400">Aucune donnée journalière</div>}
              </div>
              <div className="mt-2 flex gap-5 text-xs text-gray-600">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-600" /> Taux de présence</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-500" /> Taux de ponctualité</span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Répartition par statut</h3>
              <div className="mt-5 flex items-center gap-5">
                <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${statusDonut || '#e5e7eb 0% 100%'})` }}>
                  <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-2xl font-bold text-gray-950">{statusTotal === 1 && presentLike === 0 ? 0 : statusTotal}</span>
                    <span className="text-xs text-gray-500">Total</span>
                  </div>
                </div>
                <div className="space-y-2 text-xs text-gray-600">
                  {statusBreakdown.map(item => (
                    <p key={item.label}><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}<br /><strong className="ml-4 text-gray-900">{item.count}</strong></p>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Répartition des heures travaillées</h3>
              <div className="mt-5 flex items-center gap-5">
                <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${hoursDonut})` }}>
                  <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-xl font-bold text-gray-950">{fmtH(totalHours)}</span>
                    <span className="text-xs text-gray-500">Total</span>
                  </div>
                </div>
                <div className="space-y-3 text-xs text-gray-600">
                  <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />Heures normales<br /><strong className="ml-4 text-gray-900">{fmtH(normalHours)}</strong></p>
                  <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-600" />Heures supplémentaires<br /><strong className="ml-4 text-gray-900">{fmtH(totalOvertime)}</strong></p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr_1.1fr]">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Top retards</h3>
              <div className="mt-4 space-y-3">
                {topLate.map(person => {
                  const maxLate = Math.max(1, ...topLate.map(p => Number(p.late_count || 0)));
                  return (
                    <div key={person.id} className="grid grid-cols-[1fr_140px_24px] items-center gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-gray-900">{person.first_name} {person.last_name}</p>
                        <p className="text-xs text-gray-500">{person.job_title || 'Collaborateur'}</p>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-red-400" style={{ width: `${(Number(person.late_count || 0) / maxLate) * 100}%` }} /></div>
                      <span className="text-right text-xs font-semibold text-gray-700">{person.late_count}</span>
                    </div>
                  );
                })}
                {topLate.length === 0 && <p className="py-8 text-center text-sm text-gray-400">Aucun retard sur la période</p>}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Heures travaillées par site</h3>
              <div className="mt-5 flex h-56 items-end gap-5 border-b border-l border-gray-100 px-4">
                {siteStats.slice(0, 6).map(site => (
                  <div key={site.site_name} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-700">{fmtH(Number(site.total_hours_worked || 0))}</span>
                    <div className="w-full max-w-20 rounded-t-lg bg-gradient-to-t from-emerald-700 to-emerald-400" style={{ height: `${Math.max(8, (Number(site.total_hours_worked || 0) / maxSiteHours) * 170)}px` }} />
                    <span className="min-h-8 text-center text-xs text-gray-600">{site.site_name}</span>
                  </div>
                ))}
                {siteStats.length === 0 && <div className="flex h-full flex-1 items-center justify-center text-sm text-gray-400">Aucun site à afficher</div>}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900">Taux d'absentéisme par service</h3>
              <div className="mt-5 space-y-4">
                {deptStats.slice(0, 7).map(dept => {
                  const total = Number(dept.total_records || 0);
                  const rate = total ? Math.round((Number(dept.absent || 0) / total) * 100) : 0;
                  return (
                    <div key={dept.department_name} className="grid grid-cols-[130px_1fr_36px] items-center gap-3 text-xs">
                      <span className="truncate text-gray-700">{dept.department_name || 'Non renseigné'}</span>
                      <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-blue-300" style={{ width: `${(rate / maxAbsRate) * 100}%` }} /></div>
                      <span className="text-right font-semibold text-gray-700">{rate}%</span>
                    </div>
                  );
                })}
                {deptStats.length === 0 && <p className="py-8 text-center text-sm text-gray-400">Aucun service à afficher</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-semibold text-gray-900">Les données sont mises à jour à partir des pointages enregistrés.</p>
                <p className="text-xs text-gray-500">Période sélectionnée : {fmtDate(startDate)} - {fmtDate(endDate)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-xs">
              <span><strong className="block text-gray-900">{workingDays}</strong> jours ouvrés</span>
              <span><strong className="block text-gray-900">{stats?.total_records || 0}</strong> pointages</span>
              <span><strong className="block text-gray-900">{siteFilter === 'all' ? 'Tous les sites' : sites.find(s => String(s.id) === siteFilter)?.name}</strong> périmètre</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TAB : Sites
// ─────────────────────────────────────────────
function TabSites() {
  const { role: siteRole } = getUserFromStorage();
  const canEdit = canManage(siteRole);
  const [sites, setSites] = useState<AttendanceSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AttendanceSite | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AttendanceSite | null>(null);
  const [form, setForm] = useState({ name: '', latitude: '', longitude: '', radius_meters: '200', address: '' });
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/attendance/sites');
      setSites(data);
      setSelectedSiteId(current => current && data.some((site: AttendanceSite) => site.id === current) ? current : data[0]?.id || null);
    }
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

  // Normalise une coordonnée saisie : accepte la virgule décimale (fr) et
  // renvoie null si ce n'est pas un nombre valide. Sans ça, parseFloat("5,45647")
  // renvoie 5 (tronqué à la virgule) → site enregistré à ~50 km de la vraie position.
  const parseCoord = (raw: string): number | null => {
    const n = parseFloat(String(raw).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const handleSave = async () => {
    if (!form.name || !form.latitude || !form.longitude) { toast.error('Nom, latitude et longitude requis'); return; }
    const lat = parseCoord(form.latitude);
    const lng = parseCoord(form.longitude);
    if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Coordonnées invalides. Utilisez un point décimal (ex : 5.45647), latitude entre -90 et 90, longitude entre -180 et 180.');
      return;
    }
    setSaving(true);
    try {
      const body = { name: form.name, latitude: lat, longitude: lng, radius_meters: parseInt(form.radius_meters), address: form.address || undefined, is_active: true };
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

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const activeSites = sites.filter(site => site.is_active);
  const totalAssigned = sites.reduce((sum, site) => sum + (site.assigned_employees || 0), 0);
  const usedToday = sites.filter(site => (site.used_today || 0) > 0).length;
  const filteredSites = sites.filter(site => {
    const term = `${site.name} ${site.address || ''}`.toLowerCase();
    const matchesSearch = term.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? site.is_active : !site.is_active);
    return matchesSearch && matchesStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredSites.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedSites = filteredSites.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedSite = sites.find(site => site.id === selectedSiteId) || sites[0];
  const mapSrc = selectedSite
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${selectedSite.longitude - 0.01}%2C${selectedSite.latitude - 0.01}%2C${selectedSite.longitude + 0.01}%2C${selectedSite.latitude + 0.01}&layer=mapnik&marker=${selectedSite.latitude}%2C${selectedSite.longitude}`
    : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-950">Sites de pointage</h2>
          <p className="mt-1 text-sm text-gray-500">Gérez les lieux de pointage autorisés pour vos collaborateurs.</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
            <Plus className="h-4 w-4" /> Nouveau site
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary-500" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total des sites', value: sites.length, sub: `${activeSites.length} actifs`, icon: Building2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Sites actifs', value: activeSites.length, sub: sites.length ? `${Math.round((activeSites.length / sites.length) * 100)}%` : '0%', icon: MapPin, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: "Sites utilisés aujourd'hui", value: usedToday, sub: `Sur ${activeSites.length} sites`, icon: Users, color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'Collaborateurs couverts', value: totalAssigned, sub: 'Assignés aux sites', icon: UserCheck, color: 'text-violet-700', bg: 'bg-violet-50' },
            ].map(card => (
              <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${card.bg}`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold text-gray-950">{card.value}</p>
                    <p className="text-xs text-gray-500">{card.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un site..."
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
                <CustomSelect value={statusFilter} onChange={v => setStatusFilter(v as typeof statusFilter)}
                  options={[
                    { value: 'all', label: 'Statut : Tous' },
                    { value: 'active', label: 'Actifs' },
                    { value: 'inactive', label: 'Inactifs' },
                  ]}
                  className="w-full sm:w-44" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-4 text-left">Site</th>
                      <th className="px-5 py-4 text-left">Code</th>
                      <th className="px-5 py-4 text-left">Localisation</th>
                      <th className="px-5 py-4 text-left">Rayon autorisé</th>
                      <th className="px-5 py-4 text-left">Collaborateurs</th>
                      <th className="px-5 py-4 text-left">Statut</th>
                      {canEdit && <th className="px-5 py-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedSites.map(site => (
                      <tr key={site.id} onClick={() => setSelectedSiteId(site.id)}
                        className={`cursor-pointer hover:bg-gray-50 ${selectedSite?.id === site.id ? 'bg-teal-50/50' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-teal-100 text-sm font-bold text-teal-700">
                              {site.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{site.name}</p>
                              <p className="text-xs text-gray-500">{site.address || 'Adresse non renseignée'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{site.name.slice(0, 2).toUpperCase()}{String(site.id).padStart(3, '0')}</td>
                        <td className="px-5 py-4 text-gray-600"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-gray-400" /> {site.latitude != null && site.longitude != null ? `${site.latitude.toFixed(5)}, ${site.longitude.toFixed(5)}` : '—'}</span></td>
                        <td className="px-5 py-4"><span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{site.radius_meters} m</span></td>
                        <td className="px-5 py-4 text-gray-600"><span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-gray-400" /> {site.assigned_employees || 0}</span></td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${site.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                            {site.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-5 py-4 text-right">
                            <button onClick={(e) => { e.stopPropagation(); openEdit(site); }} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-teal-700"><Edit className="h-4 w-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(site); }} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {paginatedSites.length === 0 && (
                      <tr><td colSpan={7} className="py-12 text-center text-gray-400">Aucun site trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
                <span>Affichage de {filteredSites.length ? (safePage - 1) * pageSize + 1 : 0} à {Math.min(safePage * pageSize, filteredSites.length)} sur {filteredSites.length} site{filteredSites.length > 1 ? 's' : ''}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                    className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-teal-600 bg-teal-50 px-3 font-semibold text-teal-700">{safePage}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                    className="h-9 rounded-lg border border-gray-200 px-3 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">Détails du site sélectionné</h3>
              {selectedSite ? (
                <div className="mt-4 space-y-4">
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <iframe title={`Carte ${selectedSite.name}`} src={mapSrc} className="h-48 w-full border-0" loading="lazy" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-bold text-gray-950">{selectedSite.name}</h4>
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${selectedSite.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>{selectedSite.is_active ? 'Actif' : 'Inactif'}</span>
                    </div>
                    <button onClick={() => openEdit(selectedSite)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      <Edit className="h-4 w-4" /> Modifier
                    </button>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Code</span><span className="font-semibold text-gray-900">{selectedSite.name.slice(0, 2).toUpperCase()}{String(selectedSite.id).padStart(3, '0')}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Adresse</span><span className="text-right font-semibold text-gray-900">{selectedSite.address || 'Non renseignée'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Coordonnées</span><span className="font-semibold text-gray-900">{selectedSite.latitude != null && selectedSite.longitude != null ? `${selectedSite.latitude.toFixed(5)}, ${selectedSite.longitude.toFixed(5)}` : '—'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Rayon autorisé</span><span className="font-semibold text-gray-900">{selectedSite.radius_meters} mètres</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Collaborateurs assignés</span><span className="font-semibold text-gray-900">{selectedSite.assigned_employees || 0}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Utilisé aujourd'hui</span><span className="font-semibold text-gray-900">{selectedSite.used_today || 0}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Créé le</span><span className="font-semibold text-gray-900">{fmtDate(selectedSite.created_at)}</span></div>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">À propos des sites</p>
                        <p className="mt-1 text-xs text-emerald-800">Les collaborateurs doivent pointer à l'intérieur du périmètre autorisé pour que le pointage soit validé.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-8 text-center text-sm text-gray-400">Aucun site sélectionné</p>
              )}
            </div>
          </div>
        </>
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
                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                  <div>
                    <input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value.replace(',', '.') }))}
                      inputMode="decimal" placeholder="Latitude (ex : 5.45647)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                  <div>
                    <input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value.replace(',', '.') }))}
                      inputMode="decimal" placeholder="Longitude (ex : 6.5673)"
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

  const restoreDefaults = async () => {
    setSaving(true);
    try {
      const defaults = {
        work_start_time: '08:00:00',
        work_end_time: '18:00:00',
        break_mode: 'simple',
        break_duration_minutes: 60,
        overtime_threshold_day: 8,
        overtime_threshold_week: 40,
        overtime_rate: 1.25,
        late_tolerance_minutes: 10,
        absence_after_minutes: 60,
        break_window_start: '',
        break_window_end: '',
      };
      const updated = await apiFetch('/api/attendance/settings', { method: 'PUT', body: JSON.stringify(defaults) });
      setSettings(updated);
      setForm(updated);
      toast.success('Paramètres par défaut restaurés');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>;

  const timeValue = (key: keyof AttendanceSettings) => String((form as any)[key] || '').slice(0, 5);
  const numericValue = (key: keyof AttendanceSettings) => Number((form as any)[key] ?? 0);
  const numberField = (key: keyof AttendanceSettings, suffix = '') => (
    <input type="number" value={numericValue(key)} min={0}
      onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) }))}
      className="h-10 w-28 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400" />
  );
  const settingsCards = [
    { label: 'Horaires', desc: 'Horaires, tolérance et jours ouvrés.', icon: Clock, bg: 'bg-emerald-50', color: 'text-emerald-700' },
    { label: 'Pause', desc: 'Mode et durée des pauses.', icon: Coffee, bg: 'bg-violet-50', color: 'text-violet-700' },
    { label: 'Heures sup.', desc: 'Seuils et majoration.', icon: Timer, bg: 'bg-blue-50', color: 'text-blue-700' },
    { label: 'Notifications', desc: 'Rappels liés aux horaires.', icon: AlertCircle, bg: 'bg-orange-50', color: 'text-orange-700' },
    { label: 'Zone dangereuse', desc: 'Réinitialisations sensibles.', icon: AlertTriangle, bg: 'bg-red-50', color: 'text-red-700' },
    { label: 'Autres', desc: 'Options complémentaires.', icon: Settings, bg: 'bg-gray-50', color: 'text-gray-700' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-950">Paramètres</h2>
        <p className="mt-1 text-sm text-gray-500">Configurez les règles et options de présence et de pointage.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {settingsCards.map(card => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
            <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${card.bg}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <p className="font-semibold text-gray-950">{card.label}</p>
            <p className="mt-2 text-xs leading-5 text-gray-500">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50"><Clock className="h-6 w-6 text-emerald-700" /></span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-950">Horaires de travail</h3>
                <p className="text-sm text-gray-500">Définissez les horaires standards et les règles de pointage.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <label className="text-xs font-semibold text-gray-500">Heure d'arrivée
                    <input type="time" value={timeValue('work_start_time')} onChange={e => setForm(f => ({ ...f, work_start_time: e.target.value }))}
                      className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </label>
                  <label className="text-xs font-semibold text-gray-500">Heure de fin
                    <input type="time" value={timeValue('work_end_time')} onChange={e => setForm(f => ({ ...f, work_end_time: e.target.value }))}
                      className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </label>
                  <label className="text-xs font-semibold text-gray-500">Tolérance retard
                    <div className="mt-2 flex items-center gap-2">{numberField('late_tolerance_minutes')}<span className="text-sm text-gray-500">min</span></div>
                  </label>
                  <label className="text-xs font-semibold text-gray-500">Absence après
                    <div className="mt-2 flex items-center gap-2">{numberField('absence_after_minutes')}<span className="text-sm text-gray-500">min</span></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-50"><Coffee className="h-6 w-6 text-violet-700" /></span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-950">Pause</h3>
                <p className="text-sm text-gray-500">Configurez les pauses autorisées, leur durée et le mode de pointage.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold text-gray-500">Mode de pause
                    <CustomSelect value={form.break_mode || 'simple'} onChange={v => setForm(f => ({ ...f, break_mode: v }))}
                      options={[
                        { value: 'simple', label: 'Simple (durée fixe)' },
                        { value: 'detailed', label: 'Détaillé (début/fin)' },
                      ]}
                      className="mt-2 w-full" />
                  </label>
                  <label className="text-xs font-semibold text-gray-500">{form.break_mode === 'detailed' ? 'Durée maximale de pause' : 'Durée fixe'}
                    <div className="mt-2 flex items-center gap-2">{numberField('break_duration_minutes')}<span className="text-sm text-gray-500">min</span></div>
                  </label>
                </div>
                {form.break_mode === 'detailed' && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Plage de pause autorisée (optionnel)</label>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="time" value={(form.break_window_start || '').slice(0, 5)}
                          onChange={e => setForm(f => ({ ...f, break_window_start: e.target.value }))}
                          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                        <span className="text-sm text-gray-500">à</span>
                        <input type="time" value={(form.break_window_end || '').slice(0, 5)}
                          onChange={e => setForm(f => ({ ...f, break_window_end: e.target.value }))}
                          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                      </div>
                    </div>
                    <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs text-violet-700">
                      En mode détaillé, chaque collaborateur pointe sa pause en direct (bouton « Démarrer / Terminer »). Le démarrage est <strong>bloqué hors de la plage</strong>. Si la pause dépasse la <strong>durée maximale</strong>, le temps réel est décompté des heures travaillées et une <strong>alerte</strong> apparaît dans le récap RH. Laisser la plage vide = aucune contrainte horaire.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50"><Timer className="h-6 w-6 text-blue-700" /></span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-950">Heures supplémentaires</h3>
                <p className="text-sm text-gray-500">Définissez le seuil d'heures, les majorations et les règles associées.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <label className="text-xs font-semibold text-gray-500">Seuil par jour
                    <div className="mt-2 flex items-center gap-2">{numberField('overtime_threshold_day')}<span className="text-sm text-gray-500">h</span></div>
                  </label>
                  <label className="text-xs font-semibold text-gray-500">Seuil par semaine
                    <div className="mt-2 flex items-center gap-2">{numberField('overtime_threshold_week')}<span className="text-sm text-gray-500">h</span></div>
                  </label>
                  <label className="text-xs font-semibold text-gray-500">Taux HS
                    <div className="mt-2 flex items-center gap-2">{numberField('overtime_rate')}<span className="text-sm text-gray-500">x</span></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50"><MapPin className="h-6 w-6 text-teal-700" /></span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-950">Règles de pointage</h3>
                <p className="text-sm text-gray-500">Contrôles appliqués automatiquement lors des arrivées et départs.</p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {[
                    { label: 'Site obligatoire', desc: 'Le collaborateur choisit un site actif du tenant.' },
                    { label: 'Géolocalisation obligatoire', desc: 'Le navigateur doit transmettre la position actuelle.' },
                    { label: 'Rayon du site contrôlé', desc: 'Le pointage est refusé hors du périmètre autorisé.' },
                    { label: 'Arrivée & départ requis', desc: 'La journée est complète après le pointage de sortie.' },
                  ].map(rule => (
                    <div key={rule.label} className="rounded-lg border border-teal-100 bg-teal-50/60 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-teal-700" />
                        <span className="text-xs font-semibold text-teal-900">{rule.label}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-teal-800">{rule.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <button onClick={handleSave} disabled={saving}
                className="flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer les paramètres
              </button>
              <p className="mt-2 text-xs text-gray-500">Vos modifications seront appliquées immédiatement.</p>
            </div>
            <button onClick={restoreDefaults} disabled={saving}
              className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> Restaurer les paramètres par défaut
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Récapitulatif des règles</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Heure d'arrivée</span><span className="font-semibold text-gray-900">{timeValue('work_start_time') || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Heure de fin</span><span className="font-semibold text-gray-900">{timeValue('work_end_time') || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tolérance retard</span><span className="font-semibold text-gray-900">{form.late_tolerance_minutes ?? '—'} min</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Absence après</span><span className="font-semibold text-gray-900">{form.absence_after_minutes ?? '—'} min</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pause standard</span><span className="font-semibold text-gray-900">{form.break_duration_minutes ?? '—'} min</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Seuil HS jour</span><span className="font-semibold text-gray-900">{form.overtime_threshold_day ?? '—'} h</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Jours ouvrés</span><span className="font-semibold text-gray-900">Lun - Ven</span></div>
            </div>
          </div>

          <ArchivesExportCard />
          <ResetSection />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Carte Archives & Exports
// ─────────────────────────────────────────────
function ArchivesExportCard() {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
      <h3 className="text-base font-semibold text-emerald-950">Exports mensuels</h3>
      <p className="mt-2 text-xs leading-5 text-emerald-900">
        Les exports mensuels de pointage sont désormais disponibles dans Archives & Exports.
      </p>
      <button onClick={() => { window.location.href = '/dashboard/presence/archives'; }}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
        <Archive className="w-4 h-4" />
        Ouvrir Archives & Exports
      </button>
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
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-semibold text-red-700">
          <AlertTriangle className="w-4 h-4" />
          Zone dangereuse
        </h3>
        <p className="mt-2 text-xs leading-5 text-red-600">
          Supprime <strong>tous les pointages et récapitulatifs</strong> de votre entreprise. Action irréversible.
        </p>
        <button onClick={() => setShowConfirm(true)}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700">
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
