'use client';

import { useLearning } from '../LearningContext';
import { useI18n } from '@/lib/i18n/I18nContext';
import { TrendingUp, Clock, CheckCircle, BookOpen, Target, Users, Wallet, AlertCircle } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders, API_URL } from '../shared';

// ---- Types pour le suivi du plan ----
interface PlanKPIs {
  plans_count: number;
  actions_total: number;
  sessions_total: number;
  sessions_planned: number;
  sessions_in_progress: number;
  sessions_completed: number;
  sessions_cancelled: number;
  implementation_rate: number;
  employees_trained: number;
  total_budget_ceiling: number;
  total_estimated_cost: number;
  budget_consumption_percent: number;
}
interface QuarterStat { quarter: string; planned: number; completed: number; rate: number; }
interface ModalityStat { modality: string; count: number; }
interface PlanTracking {
  id: number;
  title: string;
  status: string;
  plan_level: string;
  budget_ceiling: number | null;
  currency: string;
  actions_count: number;
  needs_count: number;
  sessions_total: number;
  sessions_completed: number;
  sessions_cancelled: number;
  implementation_rate: number;
}
interface PlanAnalyticsData {
  year: number;
  kpis: PlanKPIs;
  quarterly: QuarterStat[];
  modality_breakdown: ModalityStat[];
  plans_tracking: PlanTracking[];
}

const MODALITY_COLORS: Record<string, string> = {
  presentiel: '#8B5CF6', distanciel: '#066C6C', blended: '#0AAE8E',
  elearning: '#F59E0B', non_défini: '#9CA3AF',
};
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-purple-100 text-purple-700', active: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-600',
};

export default function AnalyticsPage() {
  const { stats, monthlyStats, categoryStats, topLearners } = useLearning();
  const { t } = useI18n();
  const ta = t.training.analytics;
  const [activeTab, setActiveTab] = useState<'general' | 'plan'>('general');
  const [planYear, setPlanYear] = useState<number>(new Date().getFullYear());
  const [planData, setPlanData] = useState<PlanAnalyticsData | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const MODALITY_LABELS: Record<string, string> = {
    presentiel: ta.modalityPresential, distanciel: ta.modalityRemote,
    blended: ta.modalityBlended, elearning: ta.modalityElearning, non_défini: ta.modalityUndefined,
  };
  const STATUS_LABEL: Record<string, string> = {
    draft: ta.statusDraft, submitted: ta.statusSubmitted, approved: ta.statusApproved,
    active: ta.statusActive, closed: ta.statusClosed,
  };

  const loadPlanAnalytics = useCallback(async (year: number) => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch(`${API_URL}/api/training-plans/analytics?year=${year}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(ta.errorLoading);
      const data = await res.json();
      setPlanData(data);
    } catch (e: unknown) {
      setPlanError(e instanceof Error ? e.message : ta.unknownError);
    } finally {
      setPlanLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'plan') loadPlanAnalytics(planYear);
  }, [activeTab, planYear, loadPlanAnalytics]);

  return (
    <div className="space-y-6">
      {/* ---- Onglets ---- */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {ta.generalView}
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'plan'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {ta.planTracking}
        </button>
      </div>

      {/* ========== ONGLET VUE GÉNÉRALE ========== */}
      {activeTab === 'general' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{ta.completedThisMonthLabel}</p>
              <p className="text-2xl font-bold text-primary-600">{stats?.completed_this_month ?? 0}</p>
            </div>
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{ta.hoursThisMonth}</p>
              <p className="text-2xl font-bold text-primary-600">{stats?.hours_this_month ?? 0}h</p>
            </div>
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{ta.completionRateLabel}</p>
              <p className="text-2xl font-bold text-green-600">{stats?.completion_rate ?? 0}%</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{ta.totalTrainings}</p>
              <p className="text-2xl font-bold text-indigo-600">{stats?.total_courses ?? 0}</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">{ta.completedByMonth}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyStats}><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="completions" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">{ta.categoryBreakdown}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={categoryStats} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>{categoryStats.map((entry, i) => (<Cell key={i} fill={entry.color} />))}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">{ta.hoursByMonth}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyStats}><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="hours" fill="#066C6C" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">🏆 {ta.topLearners}</h3>
              <div className="space-y-3">
                {topLearners.length === 0 ? (<p className="text-gray-500 text-center py-8">{ta.noDataAvailable}</p>) : (
                  topLearners.map((learner, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3"><span className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center text-xs font-bold text-yellow-700">{i + 1}</span><span className="font-medium text-gray-900">{learner.name}</span></div>
                      <div className="text-right"><p className="text-sm font-bold text-primary-600">{learner.hours}h</p><p className="text-xs text-gray-500">{learner.courses} {ta.courses}</p></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========== ONGLET SUIVI DU PLAN ========== */}
      {activeTab === 'plan' && (
        <div className="space-y-6">
          {/* Sélecteur d'année */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">{ta.fiscalYear} :</label>
            <CustomSelect
              value={String(planYear)}
              onChange={v => setPlanYear(Number(v))}
              options={[planYear - 1, planYear, planYear + 1].map(y => ({ value: String(y), label: String(y) }))}
              className="min-w-[100px]"
            />
          </div>

          {planLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          )}

          {planError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {planError}
            </div>
          )}

          {!planLoading && !planError && planData && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{ta.implementationRate}</p>
                      <p className="text-2xl font-bold text-green-600">{planData.kpis.implementation_rate}%</p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(planData.kpis.implementation_rate, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{ta.completedSessions}</p>
                      <p className="text-2xl font-bold text-primary-600">
                        {planData.kpis.sessions_completed}
                        <span className="text-sm font-normal text-gray-400"> / {planData.kpis.sessions_total}</span>
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-primary-600" />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{ta.trainedEmployees}</p>
                      <p className="text-2xl font-bold text-primary-600">{planData.kpis.employees_trained}</p>
                    </div>
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary-600" />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{ta.budgetConsumption}</p>
                      <p className={`text-2xl font-bold ${planData.kpis.budget_consumption_percent > 90 ? 'text-red-600' : 'text-amber-600'}`}>
                        {planData.kpis.budget_consumption_percent}%
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${planData.kpis.budget_consumption_percent > 90 ? 'bg-red-500' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(planData.kpis.budget_consumption_percent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Graphiques */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Réalisation par trimestre */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4">{ta.quarterlyCompletion}</h3>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={planData.quarterly} barGap={4}>
                        <XAxis dataKey="quarter" />
                        <YAxis allowDecimals={false} />
                        <Tooltip formatter={(val, name) => [val, name === 'planned' ? ta.planned : ta.completed]} />
                        <Legend formatter={(v) => v === 'planned' ? ta.planned : ta.completed} />
                        <Bar dataKey="planned" fill="#CBD5E1" name="planned" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="completed" fill="#10B981" name="completed" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Répartition par modalité */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-4">{ta.modalityBreakdown}</h3>
                  {planData.modality_breakdown.length === 0 ? (
                    <div className="flex items-center justify-center h-60 text-gray-400 text-sm">
                      {ta.noData}
                    </div>
                  ) : (
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={planData.modality_breakdown.map((m) => ({
                              name: MODALITY_LABELS[m.modality] ?? m.modality,
                              value: m.count,
                              color: MODALITY_COLORS[m.modality] ?? '#9CA3AF',
                            }))}
                            cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {planData.modality_breakdown.map((m, i) => (
                              <Cell key={i} fill={MODALITY_COLORS[m.modality] ?? '#9CA3AF'} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Tableau de suivi par plan */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{ta.planTrackingTable} {planYear}</h3>
                  <span className="text-xs text-gray-500">{planData.plans_tracking.length} {ta.plans}</span>
                </div>
                {planData.plans_tracking.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 text-sm">
                    {ta.noPlanForYear} {planYear}.{' '}
                    <a href="/dashboard/learning/plan-formation" className="text-primary-600 underline">
                      {ta.createPlan}
                    </a>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                        <tr>
                          <th className="px-4 py-3 text-left">{ta.plan}</th>
                          <th className="px-4 py-3 text-center">{ta.statusLabel}</th>
                          <th className="px-4 py-3 text-center">{ta.actionsCol}</th>
                          <th className="px-4 py-3 text-center">{ta.sessionsCol}</th>
                          <th className="px-4 py-3 text-center">{ta.budgetCeiling}</th>
                          <th className="px-4 py-3 text-center">{ta.implementationRateCol}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {planData.plans_tracking.map((plan) => (
                          <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <a
                                href="/dashboard/learning/plan-formation"
                                className="font-medium text-gray-900 hover:text-primary-600 transition-colors"
                              >
                                {plan.title}
                              </a>
                              <p className="text-xs text-gray-400 capitalize">{plan.plan_level}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[plan.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABEL[plan.status] ?? plan.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">{plan.actions_count}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-gray-700">{plan.sessions_completed}</span>
                              <span className="text-gray-400"> / {plan.sessions_total}</span>
                              {plan.sessions_cancelled > 0 && (
                                <span className="ml-1 text-red-400 text-xs">({plan.sessions_cancelled} {ta.cancelled})</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {plan.budget_ceiling
                                ? `${plan.budget_ceiling.toLocaleString('fr-FR')} ${plan.currency}`
                                : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <div className="w-20 bg-gray-100 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      plan.implementation_rate >= 80
                                        ? 'bg-green-500'
                                        : plan.implementation_rate >= 50
                                        ? 'bg-amber-400'
                                        : 'bg-red-400'
                                    }`}
                                    style={{ width: `${Math.min(plan.implementation_rate, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold ${
                                  plan.implementation_rate >= 80
                                    ? 'text-green-600'
                                    : plan.implementation_rate >= 50
                                    ? 'text-amber-600'
                                    : 'text-red-500'
                                }`}>
                                  {plan.implementation_rate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Résumé statuts des sessions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: ta.sessionPlanned, value: planData.kpis.sessions_planned, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: ta.sessionInProgress, value: planData.kpis.sessions_in_progress, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: ta.sessionCompleted, value: planData.kpis.sessions_completed, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: ta.sessionCancelled, value: planData.kpis.sessions_cancelled, color: 'text-red-600', bg: 'bg-red-50' },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl p-4 ${item.bg}`}>
                    <p className="text-xs text-gray-600 mb-1">{item.label}</p>
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {!planLoading && !planError && !planData && (
            <div className="py-16 text-center text-gray-400 text-sm">
              {ta.selectFiscalYear}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
