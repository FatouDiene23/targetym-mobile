'use client';

import { useState, useEffect, useCallback, CSSProperties, KeyboardEvent } from 'react';
import { X, ChevronRight, ChevronLeft, Check, RotateCcw } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface TourStep {
  target: string;           // Sélecteur CSS de l'élément à mettre en surbrillance
  title: string;            // Titre de l'étape
  content: string;          // Description
  position?: 'top' | 'bottom' | 'left' | 'right';  // Position du tooltip
  action?: () => void;      // Action à exécuter avant d'afficher cette étape
}

interface AppTourProps {
  steps: TourStep[];        // Étapes du tour
  isOpen: boolean;          // Tour visible ou non
  onComplete: () => void;   // Callback quand le tour est terminé
  onSkip: () => void;       // Callback quand l'utilisateur skip le tour
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function AppTour({ steps, isOpen, onComplete, onSkip }: Readonly<AppTourProps>) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipStyles, setTooltipStyles] = useState<CSSProperties>({});
  const [spotlightStyles, setSpotlightStyles] = useState<CSSProperties>({});

  // Réinitialiser le tour quand il s'ouvre
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  // Calculer la position du tooltip par rapport à l'élément cible
  const calculateTooltipPosition = useCallback((element: HTMLElement, position: string = 'bottom') => {
    const rect = element.getBoundingClientRect();

    const baseStyles: CSSProperties = {
      position: 'fixed',
    };

    switch (position) {
      case 'top':
        return {
          ...baseStyles,
          left: `${rect.left + rect.width / 2}px`,
          top: `${rect.top - 10}px`,
          transform: 'translate(-50%, -100%)',
        };
      case 'left':
        return {
          ...baseStyles,
          left: `${rect.left - 10}px`,
          top: `${rect.top + rect.height / 2}px`,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          ...baseStyles,
          left: `${rect.right + 10}px`,
          top: `${rect.top + rect.height / 2}px`,
          transform: 'translate(0, -50%)',
        };
      case 'bottom':
      default:
        return {
          ...baseStyles,
          left: `${rect.left + rect.width / 2}px`,
          top: `${rect.bottom + 10}px`,
          transform: 'translate(-50%, 0)',
        };
    }
  }, []);

  // Mettre à jour l'élément cible et le tooltip quand l'étape change
  useEffect(() => {
    if (!isOpen || !steps[currentStep]) return;

    const step = steps[currentStep];

    // Exécuter l'action de l'étape si elle existe
    if (step.action) {
      step.action();
    }

    // Attendre un peu pour que le DOM se mette à jour
    setTimeout(() => {
      const element = document.querySelector(step.target) as HTMLElement;
      
      if (element) {
        setTargetElement(element);
        
        // Scroller vers l'élément avec un délai pour stabiliser
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          
          // Recalculer après le scroll
          setTimeout(() => {
            const rect = element.getBoundingClientRect();
            
            // Position du spotlight
            setSpotlightStyles({
              position: 'fixed',
              left: `${rect.left - 8}px`,
              top: `${rect.top - 8}px`,
              width: `${rect.width + 16}px`,
              height: `${rect.height + 16}px`,
              pointerEvents: 'none',
              zIndex: 10001,
            });
            
            // Position du tooltip
            const tooltipPos = calculateTooltipPosition(element, step.position);
            setTooltipStyles(tooltipPos);
          }, 500);
        }, 100);

        // Ajouter une classe pour le highlight
        element.classList.add('app-tour-highlight');
      } else {
        console.warn(`Élément non trouvé pour le sélecteur: ${step.target}`);
      }
    }, 300);

    // Cleanup: retirer le highlight de l'élément précédent
    return () => {
      if (targetElement) {
        targetElement.classList.remove('app-tour-highlight');
      }
    };
  }, [currentStep, isOpen, steps, calculateTooltipPosition, targetElement]);

  // Recalculer la position lors du scroll ou resize
  useEffect(() => {
    if (!isOpen || !targetElement) return;

    const handleResize = () => {
      const step = steps[currentStep];
      const rect = targetElement.getBoundingClientRect();
      
      // Mettre à jour le spotlight
      setSpotlightStyles({
        position: 'fixed',
        left: `${rect.left - 8}px`,
        top: `${rect.top - 8}px`,
        width: `${rect.width + 16}px`,
        height: `${rect.height + 16}px`,
        pointerEvents: 'none',
        zIndex: 10001,
      });
      
      // Mettre à jour le tooltip
      const styles = calculateTooltipPosition(targetElement, step.position);
      setTooltipStyles(styles);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, targetElement, currentStep, steps, calculateTooltipPosition]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    if (targetElement) {
      targetElement.classList.remove('app-tour-highlight');
    }
    onComplete();
  };

  const handleSkip = () => {
    if (targetElement) {
      targetElement.classList.remove('app-tour-highlight');
    }
    onSkip();
  };

  if (!isOpen || !steps[currentStep]) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const overlayZIndex = 10000;
  const spotlightZIndex = 10001;
  const tooltipZIndex = 10002;

  return (
    <>
      {/* Overlay sombre */}
      <button 
        type="button"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity cursor-pointer border-0 p-0"
        style={{ zIndex: overlayZIndex }}
        onClick={handleSkip}
        onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
          if (e.key === 'Escape' || e.key === 'Enter') {
            handleSkip();
          }
        }}
        aria-label="Fermer le guide"
      />

      {/* Spotlight sur l'élément ciblé */}
      {targetElement && (
        <>
          {/* Fond blanc pour faire ressortir l'élément */}
          <div
            style={{
              ...spotlightStyles,
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              transition: 'all 0.4s ease',
            }}
          />
          {/* Bordure animée */}
          <div
            className="app-tour-spotlight"
            style={{
              ...spotlightStyles,
              border: '4px solid #3b82f6',
              borderRadius: '12px',
              boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.3), 0 0 30px rgba(59, 130, 246, 0.6), inset 0 0 20px rgba(59, 130, 246, 0.1)',
              transition: 'all 0.4s ease',
              animation: 'pulse-border 2s ease-in-out infinite',
            }}
          />
        </>
      )}

      {/* Tooltip avec le contenu de l'étape */}
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200"
        style={{
          ...tooltipStyles,
          maxWidth: '400px',
          minWidth: '300px',
          zIndex: tooltipZIndex,
        }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4 rounded-t-xl flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{step.title}</h3>
            <p className="text-xs text-blue-100 mt-1">
              Étape {currentStep + 1} sur {steps.length}
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="ml-3 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Fermer le guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="px-5 py-4">
          <p className="text-gray-700 text-sm leading-relaxed">{step.content}</p>
        </div>

        {/* Barre de progression */}
        <div className="px-5 pb-3">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Passer le guide
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 font-medium"
            >
              {isLastStep ? (
                <>
                  <Check className="w-4 h-4" />
                  Terminer
                </>
              ) : (
                <>
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Styles CSS inline */}
      <style>{`
        .app-tour-highlight {
          position: relative;
          z-index: 10001 !important;
        }
      `}</style>
    </>
  );
}

// ============================================
// BOUTON POUR RÉACTIVER LE TOUR
// ============================================

interface RestartTourButtonProps {
  onClick: () => void;
}

export function RestartTourButton({ onClick }: Readonly<RestartTourButtonProps>) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 z-50 group"
      title="Revoir le guide de l'application"
    >
      <RotateCcw className="w-5 h-5" />
      <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Revoir le guide
      </span>
    </button>
  );
}
