'use client';

import { X, Lightbulb, ArrowRight } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useI18n } from '@/lib/i18n/I18nContext';
import { getPageTips } from '@/config/pageTips';
export type { PageTip } from '@/config/pageTips';

interface PageTourTipsProps {
  pageId: string;
  onDismiss: () => void;
  pageTitle: string;
}

export default function PageTourTips({ pageId, onDismiss, pageTitle }: Readonly<PageTourTipsProps>) {
  const { locale, t } = useI18n();
  const tips = useMemo(() => getPageTips(pageId, locale), [pageId, locale]);
  const [currentTip, setCurrentTip] = useState(0);
  const highlightedElementRef = useRef<HTMLElement | null>(null);

  // Mettre en évidence l'élément quand on change d'étape
  useEffect(() => {
    const tip = tips[currentTip];
    
    // Retirer le highlight précédent
    if (highlightedElementRef.current) {
      highlightedElementRef.current.classList.remove('page-tip-highlight');
      highlightedElementRef.current = null;
    }

    // Ajouter le nouveau highlight
    if (tip?.action?.element) {
      const timer = setTimeout(() => {
        const element = document.querySelector(tip.action!.element) as HTMLElement;
        if (element) {
          element.classList.add('page-tip-highlight');
          element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          highlightedElementRef.current = element;
        }
      }, 100);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [currentTip, tips]);

  const handleNext = () => {
    if (currentTip < tips.length - 1) {
      setCurrentTip(currentTip + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentTip > 0) {
      setCurrentTip(currentTip - 1);
    }
  };

  const handleHighlightClick = () => {
    const tip = tips[currentTip];
    if (tip.action?.element) {
      const element = document.querySelector(tip.action.element) as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        element.classList.remove('page-tip-highlight');
        setTimeout(() => {
          element.classList.add('page-tip-highlight');
        }, 100);
      }
    }
  };

  const handleComplete = () => {
    if (highlightedElementRef.current) {
      highlightedElementRef.current.classList.remove('page-tip-highlight');
      highlightedElementRef.current = null;
    }
    onDismiss();
  };

  const tip = tips[currentTip];
  const isLastTip = currentTip === tips.length - 1;

  if (!tip) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] max-w-lg w-full mx-4 animate-slideInRight">
      <div className="bg-gradient-to-br from-primary-50 to-indigo-50 border-2 border-primary-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-indigo-600 px-5 py-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lightbulb className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">{t.tourUI.newOn} {pageTitle} ?</h3>
              <p className="text-primary-100 text-xs mt-0.5">
                {t.tourUI.tipWord} {currentTip + 1} {t.tourUI.of} {tips.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleComplete}
            className="ml-2 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title={t.common.close}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          <h4 className="font-semibold text-gray-900 text-base mb-2">{tip.title}</h4>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">{tip.description}</p>

          {tip.action && (
            <button
              onClick={handleHighlightClick}
              className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium group"
            >
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              {tip.action.label}
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="w-full bg-primary-200 rounded-full h-1.5">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((currentTip + 1) / tips.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex items-center justify-between gap-3">
          <button
            onClick={handleComplete}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            {t.tourUI.hideForever}
          </button>
          <div className="flex items-center gap-2">
            {currentTip > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white/50 rounded-lg transition-colors"
              >
                {t.common.previous}
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isLastTip ? (
                t.tourUI.finish
              ) : (
                <>
                  {t.common.next}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bouton pour relancer les tips de la page
interface RestartPageTipsButtonProps {
  onClick: () => void;
}

export function RestartPageTipsButton({ onClick }: Readonly<RestartPageTipsButtonProps>) {
  const { t } = useI18n();
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 left-72 bg-amber-600 text-white p-3 rounded-full shadow-lg hover:bg-amber-700 transition-all hover:scale-110 z-50 group"
      title={t.tourUI.reviewSuggestions}
    >
      <Lightbulb className="w-4 h-4" />
      <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {t.tourUI.reviewSuggestions}
      </span>
    </button>
  );
}
