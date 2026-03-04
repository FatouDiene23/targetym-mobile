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

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard/learning':              { title: 'Catalogue de Formations',    subtitle: 'Explorez les formations disponibles et suivez la progression de vos collaborateurs' },
  '/dashboard/learning/my-learning':  { title: 'Mes Formations',             subtitle: 'Vos formations assignées et votre historique de complétion' },
  '/dashboard/learning/team':         { title: 'Mon Équipe',                 subtitle: 'Suivi des formations de vos collaborateurs' },
  '/dashboard/learning/paths':        { title: 'Parcours de Formation',      subtitle: 'Curriculums collectifs — regroupez des cours et assignez-les à des groupes' },
  '/dashboard/learning/certifications': { title: 'Certifications',           subtitle: 'Gérez les certifications et suivez les dates d\'expiration' },
  '/dashboard/learning/development':  { title: 'Plans Individuels',          subtitle: 'Plans de développement personnalisés — poste actuel vers poste cible' },
  '/dashboard/learning/requests':     { title: 'Demandes de Formation',      subtitle: 'Demandes soumises par les employés et managers' },
  '/dashboard/learning/post-eval':    { title: 'Éval. Post-Formation',       subtitle: 'Évaluations de compétences après formation' },
  '/dashboard/learning/analytics':    { title: 'Analytics Formation',        subtitle: 'Statistiques et tendances de l\'activité de formation' },
};

function LearningContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useLearning();
  const pathname = usePathname();

  const page = PAGE_TITLES[pathname] ?? { title: 'Formation & Développement', subtitle: '' };

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
