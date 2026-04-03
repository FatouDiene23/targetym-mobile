// ============================================
// app/dashboard/talents/layout.tsx
// Layout with TalentsProvider + Header + loading
// ============================================

'use client';

import { TalentsProvider, useTalents } from './TalentsContext';
import Header from '@/components/Header';

function TalentsContent({ children }: { children: React.ReactNode }) {
  const { loading } = useTalents();

  if (loading) {
    return (
      <>
        <Header title="Talents & Carrière" subtitle="Chargement..." />
        <main className="flex-1 p-6 overflow-auto bg-gray-50">
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="text-sm text-gray-500">Chargement du module Talents & Carrière...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return <>{children}</>;
}

export default function TalentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TalentsProvider>
      <TalentsContent>{children}</TalentsContent>
    </TalentsProvider>
  );
}
