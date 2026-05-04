'use client';
import { useState, useEffect } from 'react';
import { Loader2, ArrowRight, Briefcase, Users, Star, CheckCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getCabinetMissions, getCabinetStats, type AgencyMission } from '@/lib/api';
import Header from '@/components/Header';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/I18nContext';

const KPI_KEYS = [
  { key: 'active_missions',              icon: Briefcase,    gradient: 'from-primary-500 to-primary-700', iconBg: 'bg-primary-400/30' },
  { key: 'total_candidates_submitted',   icon: Users,        gradient: 'from-blue-500 to-blue-700',       iconBg: 'bg-blue-400/30' },
  { key: 'shortlisted',                  icon: Star,         gradient: 'from-amber-400 to-amber-600',     iconBg: 'bg-amber-300/30' },
  { key: 'accepted',                     icon: CheckCircle,  gradient: 'from-emerald-500 to-emerald-700', iconBg: 'bg-emerald-400/30' },
] as const;

export default function CabinetHomePage() {
  const { t } = useI18n();
  const c = t.cabinet;

  const statusLabels: Record<string, { label: string; cls: string }> = {
    pending:              { label: c.statusPending,    cls: 'bg-yellow-100 text-yellow-700' },
    in_progress:          { label: c.statusInProgress, cls: 'bg-blue-100 text-blue-700' },
    candidates_submitted: { label: c.statusSubmitted,  cls: 'bg-primary-100 text-primary-700' },
    completed:            { label: c.statusCompleted,  cls: 'bg-green-100 text-green-700' },
    cancelled:            { label: c.statusCancelled,  cls: 'bg-gray-100 text-gray-500' },
  };

  const kpiLabels: Record<string, string> = {
    active_missions:            c.activeMissions,
    total_candidates_submitted: c.candidatesSubmitted,
    shortlisted:                c.shortlisted,
    accepted:                   c.accepted,
  };

  const [missions, setMissions] = useState<AgencyMission[]>([]);
  const [stats, setStats] = useState<{
    total_missions: number;
    active_missions: number;
    total_candidates_submitted: number;
    shortlisted: number;
    accepted: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [m, s] = await Promise.all([getCabinetMissions(), getCabinetStats()]);
        setMissions(m);
        setStats(s);
      } catch (e: any) {
        toast.error(e.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  const activeMissions = missions
    .filter(m => !['completed', 'cancelled'].includes(m.status))
    .slice(0, 3);

  const pipelineData = [
    { etape: c.candidatesSubmitted, value: stats?.total_candidates_submitted ?? 0, fill: '#3b82f6' },
    { etape: c.shortlisted,         value: stats?.shortlisted ?? 0,                fill: '#f59e0b' },
    { etape: c.accepted,             value: stats?.accepted ?? 0,                   fill: '#10b981' },
  ];

  const statusCounts = missions.reduce<Record<string, number>>((acc, m) => {
    const label = statusLabels[m.status]?.label ?? m.status;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, count]) => ({ name, count }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <Header title={c.dashboard} subtitle={c.dashboardSubtitle} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_KEYS.map(({ key, icon: Icon, gradient, iconBg }) => (
          <div key={key} className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-md`}>
            <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-3xl font-bold mb-0.5">
              {stats?.[key as keyof typeof stats] ?? 0}
            </div>
            <div className="text-xs text-white/80">{kpiLabels[key]}</div>
          </div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Pipeline candidats */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{c.pipelineChart}</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pipelineData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="etape" tick={{ fontSize: 12 }} width={80} />
              <Tooltip formatter={(v: number) => [v, c.candidatesSubmitted]} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {pipelineData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Missions par statut */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{c.statusChart}</h2>
          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-gray-400 text-sm">
              Aucune donnée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Missions" radius={[6, 6, 0, 0]} fill="#066C6C" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Missions récentes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{c.recentMissions}</h2>
          <a href="/dashboard/cabinet/missions" className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
            {c.viewAll} <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {activeMissions.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <p>{c.noMission}</p>
            <p className="text-sm mt-1">{c.noMissionHint}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMissions.map(m => {
              const st = statusLabels[m.status] ?? { label: m.status, cls: 'bg-gray-100 text-gray-500' };
              const submitted = (m as any).nb_submitted ?? 0;
              const progress = m.nb_profiles_requested > 0
                ? Math.min(100, Math.round((submitted / m.nb_profiles_requested) * 100))
                : 0;
              return (
                <a
                  key={m.id}
                  href={`/dashboard/cabinet/missions/${m.id}`}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:border-primary-400 hover:shadow-md transition-all block"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                      {(m as any).job?.title ?? `Mission #${m.id}`}
                    </h3>
                    <span className={`ml-2 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    {(m as any).job?.location && <span>{(m as any).job.location}</span>}
                    {(m as any).job?.contract_type && <span> · {(m as any).job.contract_type}</span>}
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{c.profilesSubmitted}</span>
                      <span className="font-medium">{submitted} / {m.nb_profiles_requested}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-primary-400 to-primary-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    {m.deadline && <span>{c.deadline} : {new Date(m.deadline).toLocaleDateString('fr-FR')}</span>}
                    <span className="text-primary-600 font-medium ml-auto">{c.viewMission}</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
