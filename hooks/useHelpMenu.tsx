'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface HelpMenuContextType {
  onRestartTour: (() => void) | null;
  onRestartPageTips: (() => void) | null;
  setTourHandler: (handler: () => void) => void;
  setPageTipsHandler: (handler: (() => void) | null) => void;
  showTourOption: boolean;
  showTipsOption: boolean;
}

const HelpMenuContext = createContext<HelpMenuContextType | undefined>(undefined);

export function HelpMenuProvider({ children }: { children: ReactNode }) {
  const [onRestartTour, setOnRestartTour] = useState<(() => void) | null>(null);
  const [onRestartPageTips, setOnRestartPageTips] = useState<(() => void) | null>(null);

  const setTourHandler = (handler: () => void) => {
    setOnRestartTour(() => handler);
  };

  const setPageTipsHandler = (handler: (() => void) | null) => {
    setOnRestartPageTips(() => handler);
  };

  return (
    <HelpMenuContext.Provider
      value={{
        onRestartTour,
        onRestartPageTips,
        setTourHandler,
        setPageTipsHandler,
        showTourOption: onRestartTour !== null,
        showTipsOption: onRestartPageTips !== null,
      }}
    >
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
