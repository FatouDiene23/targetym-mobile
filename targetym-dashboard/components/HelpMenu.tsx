'use client';

import { useState, useRef, useEffect } from 'react';
import { RotateCcw, Lightbulb, HelpCircle, X } from 'lucide-react';
import { useHelpMenu } from '@/hooks/useHelpMenu';

export default function HelpMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { onRestartTour, onRestartPageTips, showTourOption, showTipsOption } = useHelpMenu();

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleTourClick = () => {
    setIsOpen(false);
    onRestartTour?.();
  };

  const handleTipsClick = () => {
    setIsOpen(false);
    onRestartPageTips?.();
  };

  // Si aucune option n'est disponible, ne rien afficher
  if (!showTourOption && !showTipsOption) {
    return null;
  }

  return (
    <div ref={menuRef} className="fixed bottom-6 left-72 z-50">
      {/* Menu déroulant */}
      {isOpen && (
        <div className="absolute bottom-16 left-0 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden mb-2 min-w-[240px] animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              <span className="font-semibold">Aide & Guides</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Options */}
          <div className="p-2">
            {showTourOption && (
              <button
                onClick={handleTourClick}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary-50 transition-colors text-left group"
              >
                <div className="bg-primary-100 p-2 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <RotateCcw className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Guide de l'application</div>
                  <div className="text-xs text-gray-500">Revoir le tour complet</div>
                </div>
              </button>
            )}

            {showTipsOption && (
              <button
                onClick={handleTipsClick}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-amber-50 transition-colors text-left group"
              >
                <div className="bg-amber-100 p-2 rounded-lg group-hover:bg-amber-200 transition-colors">
                  <Lightbulb className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Astuces de la page</div>
                  <div className="text-xs text-gray-500">Conseils contextuels</div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bouton principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-full shadow-lg transition-all hover:scale-110 group ${
          isOpen 
            ? 'bg-gray-700' 
            : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
        }`}
        title="Aide & Guides"
      >
        <HelpCircle className="w-6 h-6 text-white" />
        
        {/* Tooltip - visible seulement quand le menu est fermé */}
        {!isOpen && (
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Aide & Guides
          </span>
        )}
      </button>
    </div>
  );
}
