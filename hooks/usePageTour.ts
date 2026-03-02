'use client';

import { useState, useEffect } from 'react';

/**
 * Hook pour gérer les tours de page (première visite)
 */
export function usePageTour(pageId: string) {
  const [showTips, setShowTips] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    // Vérifier si c'est la première visite de cette page
    const visitedPages = JSON.parse(localStorage.getItem('visited_pages') || '{}');
    const hasVisited = visitedPages[pageId] === true;

    setIsFirstVisit(!hasVisited);

    if (!hasVisited) {
      // Attendre un peu avant d'afficher les tips
      const timer = setTimeout(() => {
        setShowTips(true);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [pageId]);

  const markAsVisited = () => {
    const visitedPages = JSON.parse(localStorage.getItem('visited_pages') || '{}');
    visitedPages[pageId] = true;
    localStorage.setItem('visited_pages', JSON.stringify(visitedPages));
    setShowTips(false);
  };

  const dismissTips = () => {
    markAsVisited();
  };

  const resetTips = () => {
    const visitedPages = JSON.parse(localStorage.getItem('visited_pages') || '{}');
    delete visitedPages[pageId];
    localStorage.setItem('visited_pages', JSON.stringify(visitedPages));
    setShowTips(true);
    setIsFirstVisit(true);
  };

  return {
    showTips,
    isFirstVisit,
    dismissTips,
    markAsVisited,
    resetTips,
  };
}
