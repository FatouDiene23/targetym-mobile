'use client';
import { useState, useEffect } from 'react';
import {
  Loader2, Search, Briefcase, MapPin, Calendar, Users, ChevronRight,
  Clock, CheckCircle2, XCircle, AlertCircle, TrendingUp,
} from 'lucide-react';
import { getCabinetMissions, type AgencyMission } from '@/lib/api';
import Header from '@/components/Header';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n/I18nContext';

type StatusConfig = {
  label: string;
  textCls: string;
  bgCls: string;
  dotCls: string;
  stripFrom: string;
  stripTo: string;
  icon: React.ReactNode;
};

export default function CabinetMissionsPage() {
  const { t } = useI18n();
  const c = t.cabinet;

  const statusConfig: Record<string, StatusConfig> = {
    pending: {
      label: c.statusPending,
      textCls: 'text-yellow-700', bgCls: 'bg-yellow-50', dotCls: 'bg-yellow-400',
      stripFrom: 'from-yellow-400', stripTo: 'to-yellow-500',
      icon: <Clock className="w-3 h-3" />,
    },
    in_progress: {
      label: c.statusInProgress,
      textCls: 'text-blue-700', bgCls: 'bg-blue-50', dotCls: 'bg-blue-500',
      stripFrom: 'from-blue-500', stripTo: 'to-primary-500',
      icon: <TrendingUp className="w-3 h-3" />,
    },
    candidates_submitted: {
      label: c.statusSubmitted,
      textCls: 'text-primary-700', bgCls: 'bg-primary-50', dotCls: 'bg-primary-500',
      stripFrom: 'from-primary-500', stripTo: 'to-primary-600',
      icon: <Users className="w-3 h-3" />,
    },
    completed: {
      label: c.statusCompleted,
      textCls: 'text-green-700', bgCls: 'bg-green-50', dotCls: 'bg-green-500',
      stripFrom: 'from-green-400', stripTo: 'to-green-600',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    cancelled: {
      label: c.statusCancelled,
      textCls: 'text-gray-500', bgCls: 'bg-gray-50', dotCls: 'bg-gray-400',
      stripFrom: 'from-gray-300', stripTo: 'to-gray-400',
      icon: <XCircle className="w-3 h-3" />,
    },
  };

  const filters = [
    { key: 'all',    label: c.filterAll },
    { key: 'active', label: c.filterActive },
    { key: 'done',   label: c.filterDone },
  ];

  const [missions, setMissions] = useState<AgencyMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getCabinetMissions()
      .then(setMissions)
      .catch((e: any) => toast.error(e.message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = missions.filter(m => {
    const isDone = ['completed', 'cancelled'].includes(m.status);
    if (filter === 'active' && isDone) return false;
    if (filter === 'done' && !isDone) return false;
    if (search) {
      const title = ((m as any).job?.title ?? '').toLowerCase();
      const loc   = ((m as any).job?.location ?? '').toLowerCase();
      const q = search.toLowerCase();
      if (!title.includes(q) && !loc.includes(q)) return false;
    }
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  const total = missions.length;
  const activeCount = missions.filter(m => !['completed', 'cancelled'].includes(m.status)).length;
  const subtitle = `${total} ${total !== 1 ? c.totalMissionsPlural : c.totalMissions} ${c.totalSuffix}`;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Header title={c.missions} subtitle={subtitle} />

      {/* KPI rapide */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: missions.length, icon: <Briefcase className="w-4 h-4" />, color: 'text-primary-600 bg-primary-50' },
          { label: 'En cours', value: activeCount, icon: <TrendingUp className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
          { label: 'Terminées', value: missions.filter(m => m.status === 'completed').length, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
          { label: 'Annulées', value: missions.filter(m => m.status === 'cancelled').length, icon: <XCircle className="w-4 h-4" />, color: 'text-gray-500 bg-gray-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 shadow-sm">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 leading-none">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f.key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={c.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-base font-medium text-gray-500">{c.noResult}</p>
          {search && <p className="text-sm mt-1">{c.noResultHint}</p>}
        </div>
      )}

      {/* Grille de cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(m => {
          const cfg = statusConfig[m.status] ?? {
            label: m.status, textCls: 'text-gray-500', bgCls: 'bg-gray-50',
            dotCls: 'bg-gray-400', stripFrom: 'from-gray-300', stripTo: 'to-gray-400',
            icon: <AlertCircle className="w-3 h-3" />,
          };
          const submitted = (m as any).nb_submitted ?? 0;
          const progress = m.nb_profiles_requested > 0
            ? Math.min(100, Math.round((submitted / m.nb_profiles_requested) * 100))
            : 0;
          const isDone = ['completed', 'cancelled'].includes(m.status);
          const title = (m as any).job?.title ?? `Mission #${m.id}`;
          const location = (m as any).job?.location;
          const contractType = (m as any).job?.contract_type;

          return (
            <a
              key={m.id}
              href={`/dashboard/cabinet/missions/${m.id}`}
              className={`group bg-white rounded-2xl border shadow-sm hover:shadow-md hover:border-primary-200 transition-all overflow-hidden block ${isDone ? 'opacity-75' : 'border-gray-100'}`}
            >
              {/* Bande colorée en haut */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.stripFrom} ${cfg.stripTo}`} />

              <div className="p-5">
                {/* Titre + statut */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4 text-primary-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{title}</h3>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bgCls} ${cfg.textCls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />
                    {cfg.label}
                  </span>
                </div>

                {/* Meta : lieu + contrat */}
                {(location || contractType) && (
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    {location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {location}
                      </span>
                    )}
                    {contractType && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {contractType}
                      </span>
                    )}
                  </div>
                )}

                {/* Barre de progression */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {c.profilesSubmitted}
                    </span>
                    <span className="font-semibold text-gray-700">{submitted} / {m.nb_profiles_requested}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`bg-gradient-to-r ${cfg.stripFrom} ${cfg.stripTo} h-1.5 rounded-full transition-all`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Footer : deadline + lien */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-50">
                  {m.deadline ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(m.deadline).toLocaleDateString('fr-FR')}
                    </span>
                  ) : <span />}
                  <span className="flex items-center gap-1 text-primary-600 font-medium group-hover:gap-1.5 transition-all">
                    {c.viewMission}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}