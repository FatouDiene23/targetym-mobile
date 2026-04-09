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
  '/dashboard/learning':              { title: 'Catalogue de Formations',          subtitle: 'Toutes les formations disponibles' },
  '/dashboard/learning/my-learning':  { title: 'Mon Apprentissage',               subtitle: 'Mes formations assignées et leur avancement' },
  '/dashboard/learning/team':         { title: 'Mon Équipe',                       subtitle: 'Formations de votre équipe' },
  '/dashboard/learning/paths':        { title: 'Parcours de Formation',            subtitle: 'Curriculums collectifs — regroupent des cours assignables à des groupes d\'employés' },
  '/dashboard/learning/certifications': { title: 'Certifications',                 subtitle: 'Certifications et habilitations de l\'équipe' },
  '/dashboard/learning/development':  { title: 'Plans Individuels de Développement', subtitle: 'Feuilles de route personnalisées — poste actuel → poste cible, compétences et cours par employé' },
  '/dashboard/learning/requests':     { title: 'Demandes de Formation',            subtitle: 'Demandes soumises par les collaborateurs' },
  '/dashboard/learning/post-eval':    { title: 'Éval. Post-Formation',             subtitle: 'Suivi de l\'efficacité des formations' },
  '/dashboard/learning/analytics':    { title: 'Analytics Formation',              subtitle: 'Suivi des formations et performances' },
  '/dashboard/learning/providers':    { title: 'Fournisseurs de Formation',        subtitle: 'Organismes et prestataires de formation' },
  '/dashboard/learning/referentiel':   { title: 'Référentiel Compétences',         subtitle: 'Compétences par niveau hiérarchique, département et type' },
  '/dashboard/learning/plan-formation': { title: 'Plan de Formation',              subtitle: 'Plans annuels de formation — budget, actions, calendrier' },
};

function LearningContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useLearning();
  const rawPathname = usePathname();
  const pathname = rawPathname?.replace(/\/$/, '') || rawPathname;

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
