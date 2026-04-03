'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import {
  AlertTriangle, CheckCircle, Clock, RefreshCw, Eye, Shield,
  Loader2, XCircle, X, BarChart2, ChevronDown, ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================
// TYPES
// ============================================

interface SOSAlert {
  id: number;
  category: string;
  message: string | null;
  is_anonymous: boolean;
  status: string;
  sender_name: string | null;
  sender_email: string | null;
  employee_id: number | null;
  handled_by: string | null;
  handled_at: string | null;
  resolution_note: string | null;
  location_hint: string | null;
  created_at: string;
}

interface SOSStats {
  total: number;
  new_alerts: number;
  in_progress: number;
  resolved: number;
  closed: number;
  last_30_days: number;
  last_7_days: number;
  by_category: { category: string; count: number; label: string }[];
  heatmap: { date: string; count: number }[];
}

// ============================================
// CONFIG
// ============================================

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${url}`, { ...options, headers: { ...getAuthHeaders(), ...(options?.headers || {}) } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new:          { label: 'Nouveau',          color: 'bg-red-100 text-red-700 border-red-200',      icon: AlertTriangle },
  acknowledged: { label: 'Pris en compte',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Eye },
  in_progress:  { label: 'En traitement',    color: 'bg-blue-100 text-blue-700 border-blue-200',   icon: Clock },
  resolved:     { label: 'Résolu',           color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  closed:       { label: 'Fermé',            color: 'bg-gray-100 text-gray-600 border-gray-200',   icon: XCircle },
};

const CATEGORY_EMOJI: Record<string, string> = {
  general: '🆘', harassment: '🚫', burnout: '😔', conflict: '⚡', security: '🛡️', health: '🏥', equipment: '💻',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

// ============================================
// HEATMAP
// ============================================

function Heatmap({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-4">Aucune donnée disponible.</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex flex-wrap gap-1">
      {data.map(d => {
        const intensity = d.count / max;
        const bg = intensity === 0 ? 'bg-gray-100'
          : intensity < 0.3 ? 'bg-red-200'
          : intensity < 0.6 ? 'bg-red-400'
          : intensity < 0.9 ? 'bg-red-600'
          : 'bg-red-800';
        return (
          <div key={d.date} title={`${formatDateShort(d.date)} : ${d.count} alerte(s)`}
            className={`w-7 h-7 rounded ${bg} cursor-default flex items-end justify-center pb-0.5`}>
            {d.count > 0 && <span className="text-[9px] text-white font-bold">{d.count}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// RÉSOLUTION DROPDOWN
// ============================================

function StatusDropdown({ alert, onUpdated }: { alert: SOSAlert; onUpdated: (updated: SOSAlert) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [nextStatus, setNextStatus] = useState('');

  async function handleUpdate(status: string) {
    setSaving(true);
    try {
      const data = await apiFetch(`/api/sos/${alert.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, resolution_note: note || null }),
      });
      onUpdated(data);
      setOpen(false);
      setNote('');
      toast.success('Statut mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  }

  const cfg = STATUS_CONFIG[alert.status] || STATUS_CONFIG.new;
  const Icon = cfg.icon;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">Changer le statut</p>
          {Object.entries(STATUS_CONFIG).filter(([k]) => k !== alert.status).map(([k, v]) => {
            const Ic = v.icon;
            return (
              <button key={k} onClick={() => { setNextStatus(k); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-gray-50 ${nextStatus === k ? 'ring-2 ring-primary-400 bg-gray-50' : ''}`}>
                <Ic className="w-4 h-4" />
                {v.label}
              </button>
            );
          })}
          {nextStatus && (
            <>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-primary-400"
                placeholder="Note de résolution (optionnel)…" />
              <div className="flex gap-2">
                <button onClick={() => { setOpen(false); setNextStatus(''); }} className="flex-1 text-xs px-3 py-1.5 bg-gray-100 rounded-lg">Annuler</button>
                <button onClick={() => handleUpdate(nextStatus)} disabled={saving}
                  className="flex-1 text-xs px-3 py-1.5 bg-primary-500 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1">
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}Confirmer
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function SOSAdminPage() {
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [stats, setStats] = useState<SOSStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterCategory) params.append('category', filterCategory);

      const [listData, statsData] = await Promise.all([
        apiFetch(`/api/sos?${params}`),
        apiFetch('/api/sos/stats'),
      ]);
      setAlerts(listData.items || []);
      setStats(statsData);
    } catch {
      toast.error('Impossible de charger les alertes SOS');
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterCategory]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleAlertUpdated(updated: SOSAlert) {
    setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
      <Header title="Alertes SOS" subtitle="Gestion des signaux de détresse des collaborateurs" />

      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">

        {/* STAT CARDS */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatCard label="Nouvelles alertes" value={stats.new_alerts} color="text-red-600" bg="bg-red-50" icon={<AlertTriangle className="w-5 h-5 text-red-500" />} />
            <StatCard label="En traitement" value={stats.in_progress} color="text-blue-600" bg="bg-blue-50" icon={<Clock className="w-5 h-5 text-blue-500" />} />
            <StatCard label="Résolues" value={stats.resolved} color="text-green-600" bg="bg-green-50" icon={<CheckCircle className="w-5 h-5 text-green-500" />} />
            <StatCard label="Fermées" value={stats.closed ?? 0} color="text-gray-600" bg="bg-gray-100" icon={<XCircle className="w-5 h-5 text-gray-500" />} />
            <StatCard label="7 derniers jours" value={stats.last_7_days} color="text-orange-600" bg="bg-orange-50" icon={<BarChart2 className="w-5 h-5 text-orange-500" />} />
          </div>
        )}

        {/* HEATMAP TOGGLE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button onClick={() => setShowHeatmap(!showHeatmap)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary-500" />
              <span className="font-semibold text-gray-800">Heatmap des 30 derniers jours</span>
            </div>
            {showHeatmap ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showHeatmap && stats && (
            <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
              <Heatmap data={stats.heatmap} />
              {stats.by_category.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Répartition par type</p>
                  <div className="flex flex-wrap gap-2">
                    {stats.by_category.map(c => (
                      <span key={c.category} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                        <span>{CATEGORY_EMOJI[c.category] || '🆘'}</span>
                        <span className="font-medium">{c.label}</span>
                        <span className="bg-gray-300 text-gray-700 px-1.5 rounded-full text-xs">{c.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FILTRES + LISTE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary-400">
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary-400">
              <option value="">Toutes catégories</option>
              {Object.entries(CATEGORY_EMOJI).map(([k, e]) => (
                <option key={k} value={k}>{e} {stats?.by_category.find(c => c.category === k)?.label || k}</option>
              ))}
            </select>
            <button onClick={fetchData} className="ml-auto p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Actualiser">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Shield className="w-12 h-12 mb-3 text-gray-200" />
              <p className="font-medium">Aucune alerte SOS</p>
              <p className="text-sm mt-1">Tout semble calme côté collaborateurs.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {alerts.map(a => {
                const expanded = expandedId === a.id;
                const st = STATUS_CONFIG[a.status] || STATUS_CONFIG.new;
                const StIcon = st.icon;
                return (
                  <div key={a.id}>
                    <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                      {/* Catégorie */}
                      <span className="text-2xl">{CATEGORY_EMOJI[a.category] || '🆘'}</span>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">
                            {a.is_anonymous ? '👤 Anonyme' : (a.sender_name || a.sender_email || 'Inconnu')}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${st.color} flex items-center gap-1`}>
                            <StIcon className="w-3 h-3" />
                            {st.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(a.created_at)}</p>
                        {a.message && !expanded && (
                          <p className="text-xs text-gray-600 mt-1 truncate max-w-xs">{a.message}</p>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <StatusDropdown alert={a} onUpdated={handleAlertUpdated} />
                        <button onClick={() => setExpandedId(expanded ? null : a.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="px-5 pb-4 bg-red-50/50 border-t border-red-100 space-y-2">
                        {a.message && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Message</p>
                            <p className="text-sm text-gray-700 mt-0.5">{a.message}</p>
                          </div>
                        )}
                        {a.location_hint && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Localisation</p>
                            <p className="text-sm text-gray-700 mt-0.5">{a.location_hint}</p>
                          </div>
                        )}
                        {a.handled_by && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Pris en charge par</p>
                            <p className="text-sm text-gray-700 mt-0.5">{a.handled_by}{a.handled_at && ` — ${formatDate(a.handled_at)}`}</p>
                          </div>
                        )}
                        {a.resolution_note && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Note de résolution</p>
                            <p className="text-sm text-gray-700 mt-0.5">{a.resolution_note}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, color, bg, icon }: { label: string; value: number; color: string; bg: string; icon: React.ReactNode }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-gray-100`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-500 font-medium">{label}</span></div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
