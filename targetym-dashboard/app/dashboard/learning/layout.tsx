'use client';

// ============================================
// LEARNING MODULE - LAYOUT
// File: app/dashboard/learning/layout.tsx
// ============================================

import { usePathname } from 'next/navigation';
import { LearningProvider, useLearning } from './LearningContext';
import { LearningModals } from './LearningModals';
import Header from '@/components/Header';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nContext';

function LearningContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useLearning();
  const rawPathname = usePathname();
  const pathname = (rawPathname?.replace(/\/$/, '') || rawPathname || '');
  const { t } = useI18n();

  const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
    '/dashboard/learning':              { title: t.training.catalogTitle,          subtitle: t.training.allAvailableTrainings },
    '/dashboard/learning/my-learning':  { title: t.training.myLearning,           subtitle: t.training.myLearningSubtitle },
    '/dashboard/learning/team':         { title: t.training.myTeam,               subtitle: t.training.myTeamSubtitle },
    '/dashboard/learning/paths':        { title: t.training.learningPathsLabel,    subtitle: t.training.learningPathsSubtitle },
    '/dashboard/learning/certifications': { title: t.training.certifications,     subtitle: t.training.certificationsSubtitle },
    '/dashboard/learning/development':  { title: t.training.developmentPlans,     subtitle: t.training.developmentPlansSubtitle },
    '/dashboard/learning/requests':     { title: t.training.trainingRequests,     subtitle: t.training.trainingRequestsSubtitle },
    '/dashboard/learning/post-eval':    { title: t.training.postEval,             subtitle: t.training.postEvalSubtitle },
    '/dashboard/learning/analytics':    { title: t.training.analyticsTitle,       subtitle: t.training.analyticsSubtitle },
    '/dashboard/learning/providers':    { title: t.training.providersTitle,       subtitle: t.training.providersSubtitle },
    '/dashboard/learning/referentiel':   { title: t.training.referentialTitle,    subtitle: t.training.referentialSubtitle },
    '/dashboard/learning/plan-formation': { title: t.training.trainingPlanTitle,  subtitle: t.training.trainingPlanSubtitle },
  };

  const page = PAGE_TITLES[pathname] ?? { title: t.training.title, subtitle: '' };

  if (isLoading) {
    return (
      <>
        <Header title={page.title} subtitle={page.subtitle} />
        <main className="flex-1 p-6 flex items-center justify-center bg-gray-50">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={page.title} subtitle={page.subtitle} />
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6">
          {children}
        </div>
      </div>
      <LearningModals />
    </>
  );
}

export default function LearningLayout({ children }: { children: React.ReactNode }) {
  return (
    <LearningProvider>
      <LearningContent>{children}</LearningContent>
    </LearningProvider>
  );
}
