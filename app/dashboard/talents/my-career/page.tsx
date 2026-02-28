// ============================================
// app/dashboard/talents/my-career/page.tsx
// Vue employé — Mon Parcours de Carrière
// ============================================

'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import {
  CheckCircle2, Circle, BookOpen, TrendingUp, Heart,
  ArrowUpRight, Trophy, AlertCircle, Clock
} from 'lucide-react';
import { apiFetch, formatDate, ELIGIBILITY_LABELS } from '../shared';

export default function MyCareerPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch('/api/careers/employees/my-career');
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRequestPromotion = async (ecId: number) => {
    if (!confirm('Envoyer une demande de promotion ?')) return;
    setRequesting(true);
    try {
      await apiFetch('/api/careers/promotions/request', {
        method: 'POST',
        body: JSON.stringify({ employee_career_id: ecId }),
      });
      setRequestSuccess(true);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Mon Parcours" subtitle="Chargement..." />
        <main className="flex-1 p-6 bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Mon Parcours" subtitle="Erreur" />
        <main className="flex-1 p-6 bg-gray-50">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        </main>
      </>
    );
  }

  if (!data?.careers?.length) {
    return (
      <>
        <Header title="Mon Parcours" subtitle="Votre progression de carrière" />
        <main className="flex-1 p-6 bg-gray-50 flex items-center justify-center">
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm px-12">
            <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Aucun parcours assigné</p>
            <p className="text-sm text-gray-400 mt-1">Contactez votre responsable RH pour être assigné à un parcours de carrière.</p>
          </div>
        </main>
      </>
    );
  }

  const career = data.careers[0];
  const elig = ELIGIBILITY_LABELS[career.eligibility_status] || ELIGIBILITY_LABELS.not_eligible;
  const validatedCount = career.competency_progress?.filter((c: any) => c.effective_status === 'validated').length || 0;
  const totalCount = career.competency_progress?.length || 0;

  return (
    <>
      <Header title="Mon Parcours" subtitle={career.path_name} />
      <main className="flex-1 p-6 overflow-auto bg-gray-50 space-y-6">

        {requestSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-700 text-sm">Demande de promotion envoyée avec succès !</p>
          </div>
        )}

        {/* Timeline des niveaux */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-6">Votre progression</h3>
          <div className="flex items-start">
            {career.all_levels?.map((level: any, i: number) => {
              const isCurrent = level.id === career.current_level_id;
              const isPast = level.level_order < career.current_level_order;
              const isNext = level.id === career.next_level_id;
              return (
                <div key={level.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                      ${isCurrent ? 'bg-primary-500 text-white ring-4 ring-primary-100 scale-110' :
                        isPast ? 'bg-green-500 text-white' :
                        isNext ? 'bg-blue-50 text-blue-500 border-2 border-blue-300' :
                        'bg-gray-100 text-gray-400'}`}>
                      {isPast ? '✓' : level.level_order}
                    </div>
                    <p className={`text-xs mt-1.5 text-center max-w-[72px] leading-tight
                      ${isCurrent ? 'text-primary-600 font-semibold' :
                        isPast ? 'text-green-600' : 'text-gray-400'}`}>
                      {level.title}
                    </p>
                    {isCurrent && (
                      <span className="mt-1 text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full font-medium">Actuel</span>
                    )}
                    {isNext && (
                      <span className="mt-1 text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">Suivant</span>
                    )}
                  </div>
                  {i < career.all_levels.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mt-[-18px] ${isPast ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Statut + Prochaine étape */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Statut éligibilité */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Statut</h3>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${elig.color}`}>
              {elig.label}
            </span>

            <div className="mt-5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Compétences validées</span>
                <span className="font-semibold text-gray-900">{validatedCount} / {totalCount}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-primary-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${career.overall_progress || 0}%` }}
                />
              </div>
              <p className="text-right text-xs text-gray-400 mt-1">{career.overall_progress || 0}%</p>
            </div>

            {career.level_start_date && (
              <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                Sur ce niveau depuis {formatDate(career.level_start_date)}
              </div>
            )}
          </div>

          {/* Prochaine étape + demande promotion */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Prochaine étape</h3>
                {career.next_level_title ? (
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-medium text-gray-700">{career.current_level_title}</span>
                    {' → '}
                    <span className="font-medium text-primary-600">{career.next_level_title}</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">Vous avez atteint le niveau maximum 🎉</p>
                )}
              </div>
              {career.eligibility_status === 'eligible' && career.next_level_id && (
                <button
                  onClick={() => handleRequestPromotion(career.id)}
                  disabled={requesting}
                  className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  {requesting ? 'Envoi...' : 'Demander ma promotion'}
                </button>
              )}
            </div>

            {/* Historique promotions */}
            {career.promotion_history?.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Historique</p>
                <div className="space-y-2">
                  {career.promotion_history.map((pr: any) => (
                    <div key={pr.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{pr.from_level_title} → {pr.to_level_title}</span>
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
        </div>

        {/* Compétences à valider */}
        {totalCount > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Compétences requises pour "{career.next_level_title || career.current_level_title}"
            </h3>
            <div className="space-y-3">
              {career.competency_progress.map((comp: any) => {
                const perfOk = comp.performance_score != null && comp.performance_score >= comp.performance_threshold;
                const attOk = comp.attitude_score != null && comp.attitude_score >= comp.attitude_threshold;
                return (
                  <div key={comp.id} className={`border rounded-xl p-4 transition-all
                    ${comp.effective_status === 'validated' ? 'border-green-200 bg-green-50/30' : 'border-gray-100'}`}>
                    {/* Header compétence */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {comp.effective_status === 'validated'
                          ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                          : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />}
                        <div>
                          <p className="font-medium text-gray-900">{comp.competency_name}</p>
                          {comp.is_mandatory && (
                            <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">Obligatoire</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium
                        ${comp.effective_status === 'validated' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {comp.effective_status === 'validated' ? 'Validée' : 'En cours'}
                      </span>
                    </div>

                    {/* 3 critères */}
                    <div className="grid grid-cols-3 gap-3">
                      {/* Formation */}
                      <div className={`p-3 rounded-lg border ${comp.theoretical_status === 'validated' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <BookOpen className={`w-3.5 h-3.5 ${comp.theoretical_status === 'validated' ? 'text-green-500' : 'text-gray-400'}`} />
                          <p className="text-xs font-medium text-gray-600">Formation</p>
                        </div>
                        <p className={`text-xs ${comp.theoretical_status === 'validated' ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                          {comp.theoretical_status === 'validated' ? 'Complétée ✓' : 'En attente'}
                        </p>
                        {comp.post_training_score != null && (
                          <p className="text-xs text-gray-400 mt-0.5">Score : {comp.post_training_score.toFixed(0)}%</p>
                        )}
                      </div>

                      {/* Performance */}
                      <div className={`p-3 rounded-lg border ${perfOk ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className={`w-3.5 h-3.5 ${perfOk ? 'text-green-500' : 'text-gray-400'}`} />
                          <p className="text-xs font-medium text-gray-600">Performance</p>
                        </div>
                        <p className={`text-xs ${perfOk ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                          {comp.performance_score != null ? `${comp.performance_score.toFixed(0)}%` : 'N/A'}
                          <span className="text-gray-400"> / {comp.performance_threshold}%</span>
                        </p>
                      </div>

                      {/* Attitude */}
                      <div className={`p-3 rounded-lg border ${attOk ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Heart className={`w-3.5 h-3.5 ${attOk ? 'text-green-500' : 'text-gray-400'}`} />
                          <p className="text-xs font-medium text-gray-600">Attitudes</p>
                        </div>
                        <p className={`text-xs ${attOk ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                          {comp.attitude_score != null ? `${comp.attitude_score.toFixed(0)}%` : 'N/A'}
                          <span className="text-gray-400"> / {comp.attitude_threshold}%</span>
                        </p>
                      </div>
                    </div>

                    {/* Formations requises */}
                    {comp.required_trainings?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400 mb-1.5">Formations requises :</p>
                        <div className="flex flex-wrap gap-1.5">
                          {comp.required_trainings.map((t: any) => (
                            <span key={t.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              {t.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Facteurs de promotion */}
        {career.promotion_factors?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Critères de promotion additionnels</h3>
            <div className="space-y-2">
              {career.promotion_factors.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {f.is_blocking && (
                      <span className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0" title="Critère bloquant" />
                    )}
                    <p className="text-sm text-gray-700">{f.factor_name}</p>
                    {f.threshold_value && (
                      <span className="text-xs text-gray-400">— {f.threshold_value}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                    {f.factor_type === 'auto' ? 'Automatique' : f.factor_type === 'committee' ? 'Comité' : 'N+1'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </>
  );
}
