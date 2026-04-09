// ============================================
// app/dashboard/talents/my-career/page.tsx
// Vue employé — Ma Carrière
// ============================================

'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { myCareerTips } from '@/config/pageTips';
import {
  CheckCircle2, Circle, BookOpen, TrendingUp, Heart,
  ArrowUpRight, Trophy, AlertCircle, Clock, ListChecks,
  GraduationCap, Star, ChevronRight, Timer, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch, formatDate, ELIGIBILITY_LABELS } from '../shared';

export default function MyCareerPage() {
  const [data, setData] = useState<any>(null);
  const [attitudeScores, setAttitudeScores] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { showTips, dismissTips, resetTips } = usePageTour('myCareer');

  useEffect(() => {
    Promise.all([
      apiFetch('/api/careers/employees/my-career'),
      apiFetch('/api/attitudes/scores/me').catch(() => null),
    ]).then(([career, attitudes]) => {
      setData(career);
      setAttitudeScores(attitudes);
    }).catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        {showTips && (
          <PageTourTips tips={myCareerTips} onDismiss={dismissTips} pageTitle="Ma Carrière" />
        )}
        <Header title="Ma Carrière" subtitle="Chargement..." />
        <main className="flex-1 p-6 bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Ma Carrière" subtitle="Erreur" />
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
        <Header title="Ma Carrière" subtitle="Votre progression de carrière" />
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

  // Dériver les actions à faire pour progresser
  const pendingCompetencies = (career.competency_progress || []).filter((c: any) => c.effective_status !== 'validated');
  const pendingTrainings: { compName: string; trainings: any[] }[] = [];
  const missingScores: { compName: string; type: 'performance' | 'attitude'; current: number | null; required: number }[] = [];

  pendingCompetencies.forEach((comp: any) => {
    if (comp.theoretical_status !== 'validated' && comp.required_trainings?.length > 0) {
      pendingTrainings.push({ compName: comp.competency_name, trainings: comp.required_trainings });
    }
    const perfOk = comp.performance_score != null && comp.performance_score >= comp.performance_threshold;
    const attOk = comp.attitude_score != null && comp.attitude_score >= comp.attitude_threshold;
    if (!perfOk) {
      missingScores.push({ compName: comp.competency_name, type: 'performance', current: comp.performance_score, required: comp.performance_threshold });
    }
    if (!attOk) {
      missingScores.push({ compName: comp.competency_name, type: 'attitude', current: comp.attitude_score, required: comp.attitude_threshold });
    }
  });

  const hasPendingPromotion = career.promotion_history?.some((pr: any) => pr.status === 'pending');

  // DSH-03 — Délai estimé avant promotion
  const estimatedDelay = (() => {
    if (career.eligibility_status === 'eligible') return { label: 'Vous êtes éligible maintenant !', color: 'text-green-600', urgent: true };
    if (!career.next_level_id) return null;
    if (totalCount === 0) return null;
    const remaining = totalCount - validatedCount;
    if (remaining === 0) return { label: 'En attente de validation RH', color: 'text-primary-600', urgent: false };
    if (validatedCount === 0 || !career.level_start_date) {
      // Pas assez de données : estimation forfaitaire ~2 mois / compétence
      const est = remaining * 2;
      return { label: `Environ ${est} mois (estimation)`, color: 'text-gray-500', urgent: false };
    }
    const monthsOnLevel = Math.max(
      (new Date().getTime() - new Date(career.level_start_date).getTime()) / (1000 * 60 * 60 * 24 * 30),
      0.5
    );
    const rate = validatedCount / monthsOnLevel; // compétences/mois
    const monthsLeft = Math.ceil(remaining / rate);
    if (monthsLeft <= 1) return { label: 'Moins d\'1 mois à ce rythme', color: 'text-green-600', urgent: true };
    if (monthsLeft <= 3) return { label: `Environ ${monthsLeft} mois à ce rythme`, color: 'text-primary-600', urgent: false };
    return { label: `Environ ${monthsLeft} mois à ce rythme`, color: 'text-orange-500', urgent: false };
  })();

  return (
    <>
      <Header title="Ma Carrière" subtitle={career.path_name} />
      <main className="flex-1 p-6 overflow-auto bg-gray-50 space-y-6">

        {/* ── Timeline des niveaux ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-6">Votre progression dans le parcours</h3>
          <div className="flex items-start">
            {career.all_levels?.map((level: any, i: number) => {
              const isCurrent = level.id === career.current_level_id;
              const isPast = level.level_order < career.current_level_order;
              const isNext = level.id === career.next_level_id;
              return (
                <div key={level.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                      ${isCurrent ? 'bg-primary-500 text-white ring-4 ring-primary-100 scale-110' :
                        isPast ? 'bg-green-500 text-white' :
                        isNext ? 'bg-primary-50 text-primary-500 border-2 border-primary-300' :
                        'bg-gray-100 text-gray-400'}`}>
                      {isPast ? '✓' : level.level_order}
                    </div>
                    <p className={`text-xs mt-1.5 text-center max-w-[80px] leading-tight font-medium
                      ${isCurrent ? 'text-primary-600' : isPast ? 'text-green-600' : 'text-gray-400'}`}>
                      {level.title}
                    </p>
                    {isCurrent && <span className="mt-1 text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full font-medium">Actuel</span>}
                    {isNext && <span className="mt-1 text-[10px] bg-primary-50 text-primary-500 px-1.5 py-0.5 rounded-full">Suivant</span>}
                  </div>
                  {i < career.all_levels.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mt-[-20px] ${isPast ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Statut + Prochaine étape ── */}
        <div className="grid lg:grid-cols-3 gap-3 lg:gap-6" data-tour="my-evaluation">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Mon statut</h3>
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

            {estimatedDelay && (
              <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${estimatedDelay.color}`}>
                <Timer className="w-3.5 h-3.5 flex-shrink-0" />
                {estimatedDelay.label}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Prochaine étape</h3>
                {career.next_level_title ? (
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-medium text-gray-700">{career.current_level_title}</span>
                    {' '}<ChevronRight className="w-3.5 h-3.5 inline text-gray-400" />{' '}
                    <span className="font-medium text-primary-600">{career.next_level_title}</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">Vous avez atteint le niveau maximum 🎉</p>
                )}
              </div>
              <Link
                href="/dashboard/talents/my-promotions"
                className={`px-4 py-2 text-sm rounded-lg flex items-center gap-1.5 flex-shrink-0 font-medium transition-colors
                  ${career.eligibility_status === 'eligible' && career.next_level_id && !hasPendingPromotion
                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <ArrowUpRight className="w-4 h-4" />
                {career.eligibility_status === 'eligible' && !hasPendingPromotion
                  ? 'Demander ma promotion'
                  : hasPendingPromotion ? 'Demande en cours →' : 'Mes promotions'}
              </Link>
            </div>

            {/* Critères additionnels de promotion */}
            {career.promotion_factors?.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Critères additionnels</p>
                <div className="space-y-1.5">
                  {career.promotion_factors.map((f: any) => (
                    <div key={f.id} className="flex items-center gap-2 text-sm text-gray-600">
                      {f.is_blocking
                        ? <span className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                        : <span className="w-1.5 h-1.5 bg-gray-300 rounded-full flex-shrink-0" />}
                      <span>{f.factor_name}</span>
                      {f.threshold_value && <span className="text-gray-400">— {f.threshold_value}</span>}
                      <span className="ml-auto text-xs text-gray-400">
                        {f.factor_type === 'auto' ? 'Automatique' : f.factor_type === 'committee' ? 'Comité' : 'N+1'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Ce que je dois faire pour progresser ── */}
        {career.next_level_title && pendingCompetencies.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ListChecks className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-900">Pour atteindre "{career.next_level_title}"</h3>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {pendingCompetencies.length} compétence(s) restante(s)
              </span>
            </div>

            <div className="space-y-3">
              {/* Formations à compléter */}
              {pendingTrainings.length > 0 && (
                <div className="bg-primary-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <GraduationCap className="w-4 h-4 text-primary-500" />
                    <p className="text-sm font-medium text-primary-800">Formations à compléter</p>
                  </div>
                  <div className="space-y-2">
                    {pendingTrainings.map((item, i) => (
                      <div key={i}>
                        <p className="text-xs text-primary-600 font-medium mb-1">{item.compName}</p>
                        <div className="flex flex-wrap gap-1.5 ml-2">
                          {item.trainings.map((t: any) => (
                            <a
                              key={t.id}
                              href={`/dashboard/learning?courseId=${t.id}`}
                              className="text-xs bg-white text-primary-700 border border-primary-200 px-2.5 py-1 rounded-full hover:bg-primary-50 flex items-center gap-1 transition-colors"
                            >
                              {t.title}
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scores à améliorer */}
              {missingScores.length > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-orange-500" />
                    <p className="text-sm font-medium text-orange-800">Scores à améliorer</p>
                  </div>
                  <div className="space-y-2">
                    {missingScores.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
                        <div className="flex items-center gap-2">
                          {item.type === 'performance'
                            ? <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                            : <Heart className="w-3.5 h-3.5 text-orange-400" />}
                          <span className="text-xs text-gray-700">{item.compName}</span>
                          <span className="text-xs text-gray-400">— {item.type === 'performance' ? 'Performance' : 'Attitudes'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-orange-600 font-medium">{item.current != null ? `${item.current.toFixed(0)}%` : 'N/A'}</span>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-500">requis {item.required}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Si aucune formation ni score manquant mais compétences pas validées */}
              {pendingTrainings.length === 0 && missingScores.length === 0 && (
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 text-center">
                  En attente de synchronisation — votre manager peut mettre à jour vos scores.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Scores par attitude ── */}
        {attitudeScores?.scores?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Heart className="w-5 h-5 text-pink-500" />
              <h3 className="font-semibold text-gray-900">Mes scores d'attitudes</h3>
              <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                Score global : <span className={`font-semibold ${attitudeScores.global_score >= 95 ? 'text-green-600' : attitudeScores.global_score >= 60 ? 'text-orange-500' : 'text-red-500'}`}>
                  {attitudeScores.global_score.toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {attitudeScores.scores.filter((s: any) => s.total_feedbacks > 0).map((s: any) => {
                const pct = s.score_pct;
                const ok = pct >= 95;
                const mid = pct >= 60;
                return (
                  <div key={s.attitude_id} className={`rounded-xl border p-4 ${ok ? 'bg-green-50 border-green-200' : mid ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{s.attitude_icon}</span>
                      <p className="font-medium text-gray-900 text-sm">{s.attitude_name}</p>
                      <span className={`ml-auto text-sm font-bold ${ok ? 'text-green-600' : mid ? 'text-orange-600' : 'text-red-600'}`}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-white rounded-full h-1.5 mb-2 border border-gray-200">
                      <div
                        className={`h-1.5 rounded-full transition-all ${ok ? 'bg-green-500' : mid ? 'bg-orange-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="text-green-600">+{s.recognition_count}</span>
                      <span className="text-red-500">−{s.improvement_count}</span>
                      <span className="ml-auto">{s.total_feedbacks} avis</span>
                    </div>
                  </div>
                );
              })}
              {attitudeScores.scores.filter((s: any) => s.total_feedbacks === 0).length > 0 && (
                <div className="sm:col-span-2 lg:col-span-3 text-center py-3 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  {attitudeScores.scores.filter((s: any) => s.total_feedbacks === 0).length} attitude(s) sans données de feedback pour le moment
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Détail des compétences ── */}
        {totalCount > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6" data-tour="development-plan">
            <h3 className="font-semibold text-gray-900 mb-4">
              Détail des compétences — "{career.next_level_title || career.current_level_title}"
            </h3>
            <div className="space-y-3">
              {career.competency_progress.map((comp: any) => {
                const perfOk = comp.performance_score != null && comp.performance_score >= comp.performance_threshold;
                const attOk = comp.attitude_score != null && comp.attitude_score >= comp.attitude_threshold;
                return (
                  <div key={comp.id} className={`border rounded-xl p-4
                    ${comp.effective_status === 'validated' ? 'border-green-200 bg-green-50/40' : 'border-gray-100 bg-white'}`}>
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
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                    {comp.required_trainings?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400 mb-1.5">Formations requises :</p>
                        <div className="flex flex-wrap gap-1.5">
                          {comp.required_trainings.map((t: any) => (
                            comp.theoretical_status !== 'validated' ? (
                              <a
                                key={t.id}
                                href={`/dashboard/learning?courseId=${t.id}`}
                                className="text-xs bg-primary-50 text-primary-600 border border-primary-200 px-2.5 py-1 rounded-full hover:bg-primary-100 flex items-center gap-1 font-medium transition-colors"
                              >
                                <GraduationCap className="w-3 h-3" />
                                {t.title} — S'inscrire
                              </a>
                            ) : (
                              <span key={t.id} className="text-xs bg-green-50 text-green-600 border border-green-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {t.title}
                              </span>
                            )
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

      </main>
    </>
  );
}
