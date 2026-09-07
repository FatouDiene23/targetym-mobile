'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useCopilot } from '@/hooks/useCopilot';

type CopilotContextValue = ReturnType<typeof useCopilot>;

const CopilotContext = createContext<CopilotContextValue | null>(null);

/**
 * Fournit une instance UNIQUE de useCopilot partagée par le tiroir flottant
 * et l'onglet plein écran, afin que sessions, messages et brouillon soient communs.
 */
export function CopilotProvider({ children }: { children: ReactNode }) {
  const copilot = useCopilot();
  return <CopilotContext.Provider value={copilot}>{children}</CopilotContext.Provider>;
}

export function useCopilotContext(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) {
    throw new Error('useCopilotContext must be used within a CopilotProvider');
  }
  return ctx;
}
