// ============================================
// app/dashboard/talents/page.tsx
// Dashboard consolidé Talents & Carrière
// ============================================

'use client';

import Header from '@/components/Header';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageTourTips from '@/components/PageTourTips';
import { usePageTour } from '@/hooks/usePageTour';
import { talentsDashboardTips } from '@/config/pageTips';
import {
  Users, Star, TrendingUp, AlertTriangle, Crown, Target,
  ArrowUpRight, Award, BarChart3, UserCheck, Briefcase
} from 'lucide-react';
import { useTalents } from './TalentsContext';
import { QUADRANT_LABELS, ELIGIBILITY_LABELS, formatDate, getInitials, getUserRole, isRH, isManager } from './shared';
import { useI18n } from '@/lib/i18n/I18nContext';

export default function TalentsDashboard() {
  const { dashboard, loadDashboard } = useTalents();
  const router = useRouter();
  const { t } = useI18n();

  const { showTips, dismissTips, resetTips } = usePageTour('talentsDashboard');

  useEffect(() => {
    const role = getUserRole();
    if (!isRH()) {
      if (isManager()) {
        router.replace('/dashboard/talents/team');
      } else {
        router.replace('/dashboard/talents/my-career');
      }
      return;
    }
    loadDashboard();
  }, []);

  const d = dashboard;

  return (
    <>
      {showTips && (
        <PageTourTips tips={talentsDashboardTips} onDismiss={dismissTips} pageTitle={t.talents.title} />
      )}
      <Header title={t.talents.title} subtitle={t.talents.subtitle} />
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6" data-tour="talent-stats">
          <StatCard icon={Users} label={t.talents.evaluated} value={d?.total_evaluated || 0} color="blue" />
          <StatCard icon={Star} label={t.talents.stars} value={d?.stars || 0} color="green" />
          <StatCard icon={TrendingUp} label={t.talents.highPotentials} value={d?.high_potentials || 0} color="emerald" />
          <StatCard icon={AlertTriangle} label={t.talents.atRisk} value={d?.at_risk || 0} color="red" />
          <StatCard icon={ArrowUpRight} label={t.talents.eligiblePromotions} value={d?.eligible_promotions || 0} color="purple" />
          <StatCard icon={Crown} label={t.talents.successionPlans} value={d?.succession_plans || 0} color="orange" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Carrière Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-primary-600" />
              <h3 className="font-semibold text-gray-900">{t.talents.careerPaths}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{t.talents.activePaths}</span>
                <span className="font-bold text-gray-900">{d?.total_paths || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{t.talents.assignedEmployees}</span>
                <span className="font-bold text-gray-900">{d?.employees_assigned || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm text-blue-700">{t.talents.pendingPromotions}</span>
                <span className="font-bold text-blue-700">{d?.pending_promotions || 0}</span>
              </div>
            </div>
          </div>

          {/* Succession Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-gray-900">{t.talents.successionTitle}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{t.talents.totalPlans}</span>
                <span className="font-bold text-gray-900">{d?.succession_plans || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="text-sm text-red-700">{t.talents.criticalPositions}</span>
                <span className="font-bold text-red-700">{d?.critical_positions || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-sm text-orange-700">{t.talents.noSuccessor}</span>
                <span className="font-bold text-orange-700">{d?.positions_without_successor || 0}</span>
              </div>
            </div>
          </div>

          {/* 9-Box Mini Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6" data-tour="ninebox-chart">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">{t.talents.nineBoxDistribution}</h3>
              {d?.ninebox_period && (
                <span className="text-xs text-gray-400 ml-auto">{d.ninebox_period}</span>
              )}
            </div>
            {d?.ninebox_distribution && Object.keys(d.ninebox_distribution).length > 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(q => {
                  const info = QUADRANT_LABELS[q];
                  const count = d.ninebox_distribution?.[q] || 0;
                  return (
                    <div key={q} className={`${info?.color || 'bg-gray-200'} rounded p-2 text-center`}>
                      <p className="text-white text-lg font-bold">{count}</p>
                      <p className="text-white text-[10px] truncate">{info?.title}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">{t.talents.noNineBoxData}</p>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Talents */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold text-gray-900">{t.talents.topTalents}</h3>
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">{d?.top_talents?.length || 0}</span>
            </div>
            <div className="space-y-3">
              {d?.top_talents && d.top_talents.length > 0 ? d.top_talents.map((t: any) => (
                <div key={t.employee_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">
                      {getInitials(t.first_name, t.last_name)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{t.first_name} {t.last_name}</p>
                      <p className="text-xs text-gray-500">{t.job_title} • {t.department}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{t.talents.perfPot}</p>
                    <p className="font-medium text-gray-900">{t.performance_score}/{t.potential_score}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-4">{t.talents.noTopTalent}</p>
              )}
            </div>
          </div>

          {/* Recent Promotions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">{t.talents.recentPromotions}</h3>
            </div>
            <div className="space-y-3">
              {d?.recent_promotions && d.recent_promotions.length > 0 ? d.recent_promotions.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-gray-500">{p.from_level} → {p.to_level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{p.path_name}</p>
                    <p className="text-xs text-gray-500">{formatDate(p.decision_date)}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-4">{t.talents.noRecentPromotion}</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// ============================================
// STAT CARD
// ============================================

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-primary-100', text: 'text-primary-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
      </div>
    </div>
  );
}
