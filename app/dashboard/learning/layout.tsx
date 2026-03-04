'use client';

// ============================================
// LEARNING MODULE - LAYOUT
// File: app/dashboard/learning/layout.tsx
// ============================================

import { LearningProvider, useLearning } from './LearningContext';
import { LearningModals } from './LearningModals';
import Header from '@/components/Header';
import { RefreshCw } from 'lucide-react';

function LearningContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useLearning();

  if (isLoading) {
    return (
      <>
        <Header title="" />
        <main className="flex-1 p-6 flex items-center justify-center bg-gray-50">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="" />
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
