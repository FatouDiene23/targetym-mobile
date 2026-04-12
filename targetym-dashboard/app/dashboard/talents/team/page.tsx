// ============================================
// app/dashboard/talents/team/page.tsx
// Vue Manager — Progression carrière de l'équipe
// ============================================

'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { talentsTeamTips } from '@/config/pageTips';
import {
  Search, RefreshCw, ChevronRight, ChevronLeft, CheckCircle2, Circle,
  TrendingUp, BookOpen, Heart, ArrowUpRight, Users, AlertCircle
} from 'lucide-react';
import { useTalents } from '../TalentsContext';
import { getInitials, ELIGIBILITY_LABELS, formatDate, getUserEmployeeId } from '../shared';
import ConfirmDialog from '@/components/ConfirmDialog';
import CustomSelect from '@/components/CustomSelect';

export default function TeamCareerPage() {
  const {
    teamCareers, loadTeamCareers,
    syncProgress, loadEmployeeCareerDetail,
    requestPromotion,
  } = useTalents();

  const [search, setSearch] = useState('');
  const [eligFilter, setEligFilter] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [promoting, setPromoting] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  const { showTips, dismissTips, resetTips } = usePageTour('talentsTeam');

  useEffect(() => {
    // Always filter by N-1 (current user's direct reports)
    const empId = getUserEmployeeId();
    loadTeamCareers(empId || undefined);
  }, []);

  const filtered = teamCareers.filter(ec => {
    const matchSearch = !search || `${ec.first_name} ${ec.last_name} ${ec.path_name} ${ec.current_level_title}`
      .toLowerCase().includes(search.toLowerCase());
    const matchElig = !eligFilter || ec.eligibility_status === eligFilter;
    return matchSearch && matchElig;
  });

  const openDetail = async (ec: any) => {
    setSelected(ec);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await loadEmployeeCareerDetail(ec.employee_id);
      setDetail(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSync = async (employeeId: number) => {
    setSyncing(employeeId);
    try {
      await syncProgress(employeeId);
      await loadTeamCareers();
      if (selected?.employee_id === employeeId) {
        const res = await loadEmployeeCareerDetail(employeeId);
        setDetail(res);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(null);
    }
  };

  const handlePromotion = async (ecId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Demande de promotion',
      message: 'Envoyer une demande de promotion pour cet employé ?',
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        setPromoting(ecId);
        try {
          await requestPromotion(ecId);
          if (selected) {
            const res = await loadEmployeeCareerDetail(selected.employee_id);
            setDetail(res);
            await loadTeamCareers();
          }
          toast.success('Demande envoyée');
        } catch (e: any) {
          toast.error(e.message);
        } finally {
          setPromoting(null);
        }
      },
    });
  };

  const eligibleCount = teamCareers.filter(e => e.eligibility_status === 'eligible').length;

  return (
    <>
      {showTips && (
        <PageTourTips tips={talentsTeamTips} onDismiss={dismissTips} pageTitle="Mon Équipe" />
      )}
      <Header
        title="Mon Équipe"
        subtitle={`${teamCareers.length} collaborateur(s) · ${eligibleCount} éligible(s) à la promotion`}
      />
      <main className="flex-1 flex overflow-hidden bg-gray-50" style={{ height: 'calc(100vh - 64px)' }}>

        {/* ─── Panneau gauche : liste ─── */}
        <div className={`w-full lg:w-80 flex-shrink-0 bg-white border-r border-gray-200 flex-col ${selected ? 'hidden lg:flex' : 'flex'}`}>

          {/* Filtres */}
          <div className="p-4 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <CustomSelect
              value={eligFilter}
              onChange={setEligFilter}
              options={[
                { value: '', label: 'Tous les statuts' },
                { value: 'eligible', label: 'Éligible' },
                { value: 'in_progress', label: 'En progression' },
                { value: 'not_eligible', label: 'Non éligible' },
              ]}
            />
            <p className="text-xs text-gray-400">{filtered.length} résultat(s)</p>
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto" data-tour="team-talents">
            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucun collaborateur</p>
              </div>
            ) : filtered.map(ec => {
              const progress = ec.total_count ? Math.round(((ec.validated_count || 0) / ec.total_count) * 100) : 0;
              const elig = ELIGIBILITY_LABELS[ec.eligibility_status] || ELIGIBILITY_LABELS.not_eligible;
              const isSelected = selected?.id === ec.id;

              return (
                <button
                  key={ec.id}
                  onClick={() => openDetail(ec)}
                  className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors
                    ${isSelected ? 'bg-primary-50 border-l-2 border-l-primary-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
                      {ec.photo_url
                        ? <img src={ec.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        : getInitials(ec.first_name, ec.last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{ec.first_name} {ec.last_name}</p>
                      <p className="text-xs text-gray-500 truncate">{ec.path_name}</p>
                      <p className="text-xs text-gray-400 truncate">{ec.current_level_title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">{progress}%</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${elig.color}`}>
                        {elig.label}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Panneau droit : détail ─── */}
        <div className={`flex-1 overflow-y-auto ${!selected ? 'hidden lg:block' : ''}`}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <Users className="w-12 h-12 text-gray-200" />
              <p className="text-sm">Sélectionnez un collaborateur pour voir son détail</p>
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : !detail?.careers?.length ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <AlertCircle className="w-10 h-10 text-gray-200" />
              <p className="text-sm">Aucun détail disponible</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <button onClick={() => setSelected(null)} className="lg:hidden flex items-center gap-2 text-sm text-gray-600 mb-3"><ChevronLeft size={16} />Retour</button>
              {detail.careers.map((career: any) => {
                const validatedCount = career.competency_progress?.filter((c: any) => c.effective_status === 'validated').length || 0;
                const totalCount = career.competency_progress?.length || 0;
                const elig = ELIGIBILITY_LABELS[career.eligibility_status] || ELIGIBILITY_LABELS.not_eligible;

                return (
                  <div key={career.id}>
                    {/* En-tête employé */}
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
                          {getInitials(career.first_name, career.last_name)}
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-gray-900">{career.first_name} {career.last_name}</h2>
                          <p className="text-sm text-gray-500">{career.job_title} · {career.path_name}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleSync(selected.employee_id)}
                          disabled={syncing === selected.employee_id}
                          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncing === selected.employee_id ? 'animate-spin' : ''}`} />
                          Synchroniser
                        </button>
                        {career.eligibility_status === 'eligible' && career.next_level_id && (
                          <button
                            onClick={() => handlePromotion(career.id)}
                            disabled={promoting === career.id}
                            className="px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            {promoting === career.id ? 'Envoi...' : 'Demander promotion'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
                      <div className="flex items-start">
                        {career.all_levels?.map((level: any, i: number) => {
                          const isCurrent = level.id === career.current_level_id;
                          const isPast = level.level_order < career.current_level_order;
                          return (
                            <div key={level.id} className="flex items-center flex-1">
                              <div className="flex flex-col items-center">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                                  ${isCurrent ? 'bg-primary-500 text-white ring-4 ring-primary-100' :
                                    isPast ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                  {isPast ? '✓' : level.level_order}
                                </div>
                                <p className="text-[10px] mt-1 text-center max-w-[60px] leading-tight text-gray-500">{level.title}</p>
                                {isCurrent && <span className="mt-0.5 text-[9px] text-primary-500 font-medium">Actuel</span>}
                              </div>
                              {i < career.all_levels.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1 mt-[-14px] ${isPast ? 'bg-green-400' : 'bg-gray-200'}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4" data-tour="performance-matrix">
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Progression</p>
                        <p className="text-2xl font-bold text-primary-600">{career.overall_progress || 0}%</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                        <p className="text-xs text-gray-500 mb-1">Compétences</p>
                        <p className="text-2xl font-bold text-gray-800">
                          {validatedCount}
                          <span className="text-base text-gray-400">/{totalCount}</span>
                        </p>
                      </div>
                      <div className={`rounded-xl border shadow-sm p-4 text-center ${elig.color}`}>
                        <p className="text-xs opacity-70 mb-1">Éligibilité</p>
                        <p className="text-sm font-bold">{elig.label}</p>
                      </div>
                    </div>

                    {/* Liste compétences */}
                    {totalCount > 0 && (
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                        <h4 className="font-medium text-gray-900 mb-3">
                          Compétences — {career.next_level_title ? `"${career.next_level_title}"` : 'niveau actuel'}
                        </h4>
                        <div className="space-y-2">
                          {career.competency_progress.map((comp: any) => {
                            const perfOk = comp.performance_score != null && comp.performance_score >= comp.performance_threshold;
                            const attOk = comp.attitude_score != null && comp.attitude_score >= comp.attitude_threshold;
                            return (
                              <div key={comp.id} className={`flex items-center gap-3 p-3 rounded-lg
                                ${comp.effective_status === 'validated' ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-transparent'}`}>
                                {comp.effective_status === 'validated'
                                  ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                  : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{comp.competency_name}</p>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                      <BookOpen className="w-3 h-3" />
                                      {comp.theoretical_status === 'validated' ? '✓' : '–'}
                                    </span>
                                    <span className={`text-xs flex items-center gap-0.5 ${perfOk ? 'text-green-600' : 'text-gray-400'}`}>
                                      <TrendingUp className="w-3 h-3" />
                                      {comp.performance_score != null ? `${comp.performance_score.toFixed(0)}%` : 'N/A'}
                                    </span>
                                    <span className={`text-xs flex items-center gap-0.5 ${attOk ? 'text-green-600' : 'text-gray-400'}`}>
                                      <Heart className="w-3 h-3" />
                                      {comp.attitude_score != null ? `${comp.attitude_score.toFixed(0)}%` : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium
                                  ${comp.effective_status === 'validated' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {comp.effective_status === 'validated' ? 'Validée' : 'En cours'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Historique promotions */}
                    {career.promotion_history?.length > 0 && (
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mt-4">
                        <h4 className="font-medium text-gray-900 mb-3">Historique des promotions</h4>
                        <div className="space-y-2">
                          {career.promotion_history.map((pr: any) => (
                            <div key={pr.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                              <span className="text-sm text-gray-600">{pr.from_level_title} → {pr.to_level_title}</span>
                              <div className="flex items-center gap-2">
                                {pr.decision_date && <span className="text-xs text-gray-400">{formatDate(pr.decision_date)}</span>}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                                  ${pr.status === 'approved' ? 'bg-green-100 text-green-600' :
                                    pr.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                    'bg-yellow-100 text-yellow-600'}`}>
                                  {pr.status === 'approved' ? 'Approuvée' : pr.status === 'rejected' ? 'Refusée' : 'En attente'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
      
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(null)}
          danger={confirmDialog.danger}
        />
      )}
    </>
  );
}
