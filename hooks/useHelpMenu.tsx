'use client';

import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';

interface HelpMenuContextType {
  onRestartTour: (() => void) | null;
  onRestartPageTips: (() => void) | null;
  setTourHandler: (handler: (() => void) | null) => void;
  setPageTipsHandler: (handler: (() => void) | null) => void;
  showTourOption: boolean;
  showTipsOption: boolean;
}

const HelpMenuContext = createContext<HelpMenuContextType | undefined>(undefined);

export function HelpMenuProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [onRestartTour, setOnRestartTour] = useState<(() => void) | null>(null);
  const [onRestartPageTips, setOnRestartPageTips] = useState<(() => void) | null>(null);

  const setTourHandler = useCallback((handler: (() => void) | null) => {
    setOnRestartTour(() => handler);
  }, []);

  const setPageTipsHandler = useCallback((handler: (() => void) | null) => {
    setOnRestartPageTips(() => handler);
  }, []);

  const contextValue = useMemo(() => ({
    onRestartTour,
    onRestartPageTips,
    setTourHandler,
    setPageTipsHandler,
    showTourOption: onRestartTour !== null,
    showTipsOption: onRestartPageTips !== null,
  }), [onRestartTour, onRestartPageTips, setTourHandler, setPageTipsHandler]);

  return (
    <HelpMenuContext.Provider value={contextValue}>
      {children}
    </HelpMenuContext.Provider>
  );
}

export function useHelpMenu() {
  const context = useContext(HelpMenuContext);
  if (!context) {
    throw new Error('useHelpMenu must be used within HelpMenuProvider');
  }
  return context;
}
