'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '@/lib/api';
import Header from '@/components/Header';
import toast from 'react-hot-toast';
import {
  AlertTriangle, Archive, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Database, Download, FileSpreadsheet, Filter, History, ListChecks,
  Loader2, Mail, MoreHorizontal, Search, Send, ShieldCheck,
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

type Period = {
  year: number;
  month: number;
  period_start: string;
  period_end: string;
  closure_status: string;
  record_count: number;
  collaborator_count: number;
  last_export_at?: string;
  last_sent_at?: string;
  last_sent_email?: string;
  last_modified_at?: string;
  exported_by_name?: string;
  exported_by_email?: string;
};

type Summary = {
  periods_available: number;
  exports_this_month: number;
  hr_email?: string;
  hr_send_enabled: boolean;
  last_export?: { created_at: string; action: string; year: number; month: number; actor?: string };
};

type LogItem = {
  id: number;
  year: number;
  month: number;
  action: string;
  status: string;
  recipient_email?: string;
  file_name?: string;
  record_count: number;
  collaborator_count: number;
  created_at: string;
  actor?: string;
  error_message?: string;
};

function roleAllowed() {
  if (typeof window === 'undefined') return false;
  try {
    const role = String(JSON.parse(localStorage.getItem('user') || '{}').role || '').toLowerCase();
    return ['dg', 'rh', 'admin', 'super_admin'].includes(role);
  } catch {
    return false;
  }
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(err.detail || `Erreur ${res.status}`);
  }
  return res.json();
}

function fmtDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function periodLabel(year: number, month: number) {
  return `${months[month - 1]} ${year}`;
}

function statusLabel(status?: string) {
  return status === 'validated' ? 'Clôturée' : status === 'sent_to_payroll' ? 'Transmise paie' : status === 'draft' ? 'Non clôturée' : status || '—';
}

function statusClasses(status?: string) {
  if (status === 'validated' || status === 'sent_to_payroll') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'draft') return 'bg-orange-50 text-orange-700 ring-orange-100';
  return 'bg-slate-50 text-slate-600 ring-slate-100';
}

function actionLabel(action: string) {
  if (action === 'send_rh') return 'Envoi RH';
  if (action === 'view_history') return 'Consultation historique';
  if (action === 'view_logs') return 'Consultation logs';
  return 'Téléchargement';
}

export default function PresenceArchivesPage() {
  const allowed = roleAllowed();
  const now = new Date();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [history, setHistory] = useState<LogItem[]>([]);
  const [selected, setSelected] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [includeBreaks, setIncludeBreaks] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeSites, setIncludeSites] = useState(true);
  const [closureFilter, setClosureFilter] = useState('all');
  const [exportFilter, setExportFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const optionsQuery = useMemo(() => (
    `include_breaks=${includeBreaks}&include_notes=${includeNotes}&include_sites=${includeSites}`
  ), [includeBreaks, includeNotes, includeSites]);

  const filteredPeriods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periods.filter(p => {
      const isClosed = p.closure_status === 'validated' || p.closure_status === 'sent_to_payroll';
      const exported = Boolean(p.last_export_at);
      const matchesSearch = !q || periodLabel(p.year, p.month).toLowerCase().includes(q) || String(p.year).includes(q);
      const matchesClosure = closureFilter === 'all' || (closureFilter === 'closed' ? isClosed : !isClosed);
      const matchesExport = exportFilter === 'all' || (exportFilter === 'exported' ? exported : !exported);
      return matchesSearch && matchesClosure && matchesExport;
    });
  }, [closureFilter, exportFilter, periods, search]);

  const pageCount = Math.max(1, Math.ceil(filteredPeriods.length / pageSize));
  const paginatedPeriods = filteredPeriods.slice((page - 1) * pageSize, page * pageSize);

  const selectedChangedAfterExport = Boolean(
    selected?.last_export_at && selected?.last_modified_at && new Date(selected.last_modified_at) > new Date(selected.last_export_at)
  );

  const loadHistory = useCallback(async (p?: Period | null, traceAction?: 'view_history' | 'view_logs') => {
    const target = p || null;
    const qs = target ? `?year=${target.year}&month=${target.month}${traceAction ? `&trace_action=${traceAction}` : ''}` : '';
    const data = await apiFetch(`/api/attendance/archives/history${qs}`);
    setHistory(data);
  }, []);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        apiFetch('/api/attendance/archives/summary'),
        apiFetch('/api/attendance/archives/periods'),
      ]);
      setSummary(s);
      setPeriods(p);
      const first = p[0] || null;
      setSelected(current => current || first);
      if (first) await loadHistory(first);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [allowed, loadHistory]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [closureFilter, exportFilter, search]);

  const choosePeriod = async (p: Period) => {
    setSelected(p);
    setMonth(p.month);
    setYear(p.year);
    try { await loadHistory(p); } catch (e: any) { toast.error(e.message); }
  };

  const downloadCsv = async (y = year, m = month) => {
    setBusy(`download-${y}-${m}`);
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/attendance/archives/export?year=${y}&month=${m}&${optionsQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Erreur export' }));
        throw new Error(err.detail || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `presence_${y}_${String(m).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV téléchargé');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const sendToRh = async (y = year, m = month) => {
    setBusy(`send-${y}-${m}`);
    try {
      await apiFetch('/api/attendance/archives/send', {
        method: 'POST',
        body: JSON.stringify({ year: y, month: m, include_breaks: includeBreaks, include_notes: includeNotes, include_sites: includeSites }),
      });
      toast.success('Récapitulatif envoyé au RH');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Archives" />
        <main className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
            Accès réservé aux rôles DG, RH et Admin.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Archives & Exports des pointages" />
      <main className="mx-auto max-w-[1540px] space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Archives & Exports des pointages</h1>
            <p className="mt-2 text-sm text-slate-500">Consultez, téléchargez et envoyez les récapitulatifs mensuels de présence.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => selected && sendToRh(selected.year, selected.month)}
              disabled={!selected || !!busy || !summary?.hr_send_enabled}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:opacity-50"
            >
              {busy?.startsWith('send') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer au RH
            </button>
            <button
              onClick={() => selected ? downloadCsv(selected.year, selected.month) : downloadCsv()}
              disabled={!!busy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy?.startsWith('download') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Télécharger un récapitulatif
            </button>
          </div>
        </div>

        <div className="grid overflow-hidden rounded-lg border border-blue-100 bg-blue-50 text-sm text-blue-950 shadow-sm lg:grid-cols-[1fr_auto]">
          <div className="flex gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-600">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Les pointages sont conservés en base de données.</p>
              <p className="mt-1 text-blue-800">Les exports CSV sont générés à la demande depuis les données de présence enregistrées.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-blue-100 px-4 py-3 lg:border-l lg:border-t-0">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            <p className="max-w-md font-medium">Le fichier envoyé au RH doit être conservé dans un espace sécurisé de l’entreprise.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-emerald-700" /></div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={CalendarDays} tone="emerald" label="Périodes disponibles" value={`${summary?.periods_available ?? 0} mois`} sub="Mois avec des données de pointage" />
              <MetricCard
                icon={Download}
                tone="blue"
                label="Dernier export"
                value={summary?.last_export ? periodLabel(summary.last_export.year, summary.last_export.month) : '—'}
                sub={summary?.last_export ? `Exporté le ${fmtDate(summary.last_export.created_at)}${summary.last_export.actor ? ` par ${summary.last_export.actor}` : ''}` : 'Aucun export tracé'}
              />
              <MetricCard icon={FileSpreadsheet} tone="violet" label="Exports ce mois" value={String(summary?.exports_this_month ?? 0)} sub="Téléchargements & envois" />
              <MetricCard icon={Mail} tone="orange" label="Envoi RH" value={summary?.hr_send_enabled ? 'Activé' : 'Désactivé'} sub={summary?.hr_email || 'Email RH absent'} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
              <section className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-950">Exporter un récapitulatif</h2>
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 lg:grid-cols-[180px_160px_140px_1fr_220px] lg:items-end">
                      <label className="text-xs font-semibold text-slate-500">Mois
                        <CustomSelect value={String(month)} onChange={v => setMonth(Number(v))}
                          options={months.map((m, i) => ({ value: String(i + 1), label: m }))}
                          className="mt-1 w-full" />
                      </label>
                      <label className="text-xs font-semibold text-slate-500">Année
                        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800" />
                      </label>
                      <div>
                        <span className="block text-xs font-semibold text-slate-500">Format</span>
                        <span className="mt-1 inline-flex h-10 w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">CSV</span>
                      </div>
                      <div className="hidden lg:block" aria-hidden="true" />
                      <div className="grid gap-2">
                        <button onClick={() => sendToRh()} disabled={!!busy || !summary?.hr_send_enabled} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          <Send className="h-4 w-4" /> Envoyer au RH
                        </button>
                        <button onClick={() => downloadCsv()} disabled={!!busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                          <Download className="h-4 w-4" /> Télécharger CSV
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <CheckOption checked={includeBreaks} onChange={setIncludeBreaks} label="Inclure les détails des pauses" />
                      <CheckOption checked={includeNotes} onChange={setIncludeNotes} label="Inclure les notes/corrections RH" />
                      <CheckOption checked={includeSites} onChange={setIncludeSites} label="Inclure les données de site/localisation" />
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <h2 className="text-base font-semibold text-slate-950">Périodes mensuelles disponibles</h2>
                      <div className="flex flex-wrap gap-2">
                        <CustomSelect value={closureFilter} onChange={setClosureFilter}
                          options={[
                            { value: 'all', label: 'Statut clôture : Tous' },
                            { value: 'closed', label: 'Clôturée' },
                            { value: 'open', label: 'Non clôturée' },
                          ]}
                          className="w-full sm:w-52" />
                        <CustomSelect value={exportFilter} onChange={setExportFilter}
                          options={[
                            { value: 'all', label: 'Statut export : Tous' },
                            { value: 'exported', label: 'Exporté' },
                            { value: 'not_exported', label: 'Non exporté' },
                          ]}
                          className="w-full sm:w-52" />
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un mois..." className="h-9 w-64 rounded-lg border border-slate-300 pl-9 pr-3 text-sm text-slate-700" />
                        </div>
                        <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
                          <Filter className="h-4 w-4" /> Filtres
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1060px] text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Mois</th>
                          <th className="px-4 py-3 text-left">Période</th>
                          <th className="px-4 py-3 text-left">Statut clôture</th>
                          <th className="px-4 py-3 text-left">Pointages</th>
                          <th className="px-4 py-3 text-left">Collaborateurs</th>
                          <th className="px-4 py-3 text-left">Dernier export</th>
                          <th className="px-4 py-3 text-left">Dernier envoi RH</th>
                          <th className="px-4 py-3 text-left">Dernière modif.</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedPeriods.map(p => {
                          const changedAfterExport = p.last_export_at && p.last_modified_at && new Date(p.last_modified_at) > new Date(p.last_export_at);
                          return (
                            <tr key={`${p.year}-${p.month}`} onClick={() => choosePeriod(p)} className={`cursor-pointer hover:bg-slate-50 ${selected?.year === p.year && selected?.month === p.month ? 'bg-emerald-50/60' : ''}`}>
                              <td className="px-4 py-3 font-semibold text-slate-950">{periodLabel(p.year, p.month)}</td>
                              <td className="px-4 py-3 text-slate-600">{fmtDate(p.period_start)} - {fmtDate(p.period_end)}</td>
                              <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClasses(p.closure_status)}`}>{statusLabel(p.closure_status)}</span></td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{p.record_count}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{p.collaborator_count}</td>
                              <td className="px-4 py-3 text-slate-600">{p.last_export_at ? <>{fmtDate(p.last_export_at)}<br /><span className="text-xs text-slate-500">{p.exported_by_name || p.exported_by_email || '—'}</span></> : 'Jamais'}</td>
                              <td className="px-4 py-3 text-slate-600">{p.last_sent_at ? <>{fmtDate(p.last_sent_at)}<br /><span className="text-xs text-slate-500">{p.last_sent_email || summary?.hr_email || '—'}</span></> : <span className="text-orange-600">Non envoyé</span>}</td>
                              <td className="px-4 py-3 text-slate-600">{fmtDateTime(p.last_modified_at)}{changedAfterExport && <AlertTriangle className="ml-2 inline h-4 w-4 text-orange-500" />}</td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-1">
                                  <IconButton label="Télécharger" onClick={(e) => { e.stopPropagation(); downloadCsv(p.year, p.month); }}><Download className="h-4 w-4" /></IconButton>
                                  <IconButton label="Envoyer au RH" onClick={(e) => { e.stopPropagation(); sendToRh(p.year, p.month); }}><Send className="h-4 w-4" /></IconButton>
                                  <IconButton label="Détails" onClick={(e) => { e.stopPropagation(); choosePeriod(p); }}><MoreHorizontal className="h-4 w-4" /></IconButton>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredPeriods.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-slate-400">Aucune période disponible</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
                    <span>Affichage de {filteredPeriods.length ? (page - 1) * pageSize + 1 : 0} à {Math.min(page * pageSize, filteredPeriods.length)} sur {filteredPeriods.length} périodes</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                      {Array.from({ length: pageCount }).slice(0, 5).map((_, i) => (
                        <button key={i + 1} onClick={() => setPage(i + 1)} className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-semibold ${page === i + 1 ? 'border-emerald-600 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>{i + 1}</button>
                      ))}
                      <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-950">Détails de la période</h3>
                    {selected && <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClasses(selected.closure_status)}`}>{statusLabel(selected.closure_status)}</span>}
                  </div>
                  {selected ? (
                    <div className="mt-4 space-y-3 text-sm">
                      <Detail icon={CalendarDays} label="Mois" value={periodLabel(selected.year, selected.month)} />
                      <Detail icon={Clock} label="Période" value={`${fmtDate(selected.period_start)} - ${fmtDate(selected.period_end)}`} />
                      <Detail icon={FileSpreadsheet} label="Nombre de pointages" value={String(selected.record_count)} />
                      <Detail icon={Archive} label="Nombre de collaborateurs" value={String(selected.collaborator_count)} />
                      <Detail icon={Download} label="Dernier export" value={fmtDateTime(selected.last_export_at)} />
                      <Detail icon={CheckCircle2} label="Exporté par" value={selected.exported_by_name || selected.exported_by_email || '—'} />
                      <Detail icon={Send} label="Dernier envoi RH" value={fmtDateTime(selected.last_sent_at)} />
                      <Detail icon={Mail} label="Email destinataire" value={selected.last_sent_email || summary?.hr_email || '—'} />
                      <Detail icon={History} label="Dernière modification" value={fmtDateTime(selected.last_modified_at)} />
                      <Detail icon={Database} label="Source" value="Base de données Targetym AI" />
                      {selectedChangedAfterExport && (
                        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-800">
                          <AlertTriangle className="mr-2 inline h-4 w-4" />
                          Les pointages ont été modifiés après le dernier export. Il est recommandé de générer une version mise à jour.
                        </div>
                      )}
                      <div className="grid gap-2 pt-2">
                        <button onClick={() => downloadCsv(selected.year, selected.month)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"><Download className="h-4 w-4" /> Télécharger le CSV</button>
                        <button onClick={() => sendToRh(selected.year, selected.month)} disabled={!summary?.hr_send_enabled} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><Send className="h-4 w-4" /> Envoyer au RH</button>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <button onClick={() => loadHistory(selected, 'view_history')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><History className="h-4 w-4" /> Historique</button>
                          <button onClick={() => loadHistory(selected, 'view_logs')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ListChecks className="h-4 w-4" /> Logs</button>
                        </div>
                      </div>
                    </div>
                  ) : <p className="mt-4 text-sm text-slate-500">Sélectionnez une période.</p>}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-slate-950">Configuration de l’envoi mensuel au RH</h3>
                    <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold ${summary?.hr_send_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {summary?.hr_send_enabled ? 'Activé' : 'Désactivé'}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <InfoLine label="Email RH" value={summary?.hr_email || 'Non configuré'} />
                    <InfoLine label="Fréquence" value="À la demande" />
                    <InfoLine label="Après clôture mensuelle" value="Disponible" />
                    <InfoLine label="Format" value="CSV" />
                    <InfoLine label="Mode d’envoi" value="Pièce jointe (CSV)" />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950"><ShieldCheck className="h-4 w-4 text-emerald-700" /> Historique récent</h3>
                  <div className="mt-4 space-y-3">
                    {history.slice(0, 5).map(log => (
                      <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{actionLabel(log.action)}</span>
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${log.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{log.status}</span>
                        </div>
                        <p className="mt-1 text-slate-500">{fmtDateTime(log.created_at)} par {log.actor || '—'}</p>
                        {log.recipient_email && <p className="mt-1 text-slate-500">Destinataire : {log.recipient_email}</p>}
                        {log.error_message && <p className="mt-1 text-red-600">{log.error_message}</p>}
                      </div>
                    ))}
                    {history.length === 0 && <p className="text-sm text-slate-400">Aucune action tracée pour cette période.</p>}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ icon: Icon, tone, label, value, sub }: { icon: any; tone: 'emerald' | 'blue' | 'violet' | 'orange'; label: string; value: string; sub: string }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    orange: 'bg-orange-50 text-orange-700',
  };
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold text-slate-950">{value}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function CheckOption({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-600">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-700" />
      <span>{label}</span>
    </label>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
      {children}
    </button>
  );
}

function Detail({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="flex items-center gap-2 text-slate-500"><Icon className="h-4 w-4" /> {label}</span>
      <span className="max-w-[190px] text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}
