'use client';

import { useState } from 'react';
import { Building2, ChevronDown, Layers, GitBranch } from 'lucide-react';
import { useGroupContext } from '@/hooks/useGroupContext';

/**
 * Barre de contexte groupe — visible uniquement si le tenant de l'utilisateur est un groupe.
 * Se colle en haut du contenu principal et permet de basculer entre
 * "Groupe entier" (stats agrégées) et une filiale spécifique.
 */
export default function GroupContextSwitcher() {
  const { context, selectedTenantId, selectedSubsidiary, isGlobalDashboardMode, selectTenant, setGlobalDashboardMode, loading } = useGroupContext();
  const [open, setOpen] = useState(false);

  if (loading || !context?.is_group) return null;

  const currentLabel = isGlobalDashboardMode
    ? 'Dashboard global du groupe'
    : selectedSubsidiary
      ? selectedSubsidiary.name
      : context.tenant_name;

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-purple-100 px-6 py-2 flex items-center gap-3 shadow-sm">
      <span className="text-xs text-purple-600 font-medium hidden sm:inline">Contexte&nbsp;:</span>

      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-sm font-medium text-purple-800 hover:bg-purple-100 transition-colors"
        >
          {selectedSubsidiary ? (
            <GitBranch className="w-4 h-4 text-purple-500 flex-shrink-0" />
          ) : (
            <Layers className="w-4 h-4 text-purple-500 flex-shrink-0" />
          )}
          <span className="max-w-[200px] truncate">{currentLabel}</span>
          <ChevronDown
            className={`w-4 h-4 text-purple-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute top-full left-0 mt-1 min-w-[260px] bg-white rounded-xl shadow-xl border border-gray-200 z-20 overflow-hidden">
              {/* Option : Vue du tenant courant (le groupe lui-même) */}
              <button
                onClick={() => { selectTenant(null); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  !isGlobalDashboardMode && selectedTenantId === null ? 'bg-primary-50' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-primary-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="font-semibold text-gray-900">{context.tenant_name}</p>
                  <p className="text-xs text-gray-500">Vue du groupe — données du tenant courant</p>
                </div>
                {!isGlobalDashboardMode && selectedTenantId === null && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                )}
              </button>

              {/* Option : Dashboard global du groupe */}
              <button
                onClick={() => { setGlobalDashboardMode(true); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  isGlobalDashboardMode ? 'bg-purple-50' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="font-semibold text-gray-900">Dashboard global du groupe</p>
                  <p className="text-xs text-gray-500">Toutes les filiales — données agrégées</p>
                </div>
                {isGlobalDashboardMode && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                )}
              </button>

              {/* Liste des filiales */}
              <div className="max-h-60 overflow-y-auto">
                {context.subsidiaries.length === 0 ? (
                  <div className="px-4 py-5 text-center text-sm text-gray-400">
                    Aucune filiale rattachée
                  </div>
                ) : (
                  context.subsidiaries.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => { selectTenant(sub.id); setOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                        selectedTenantId === sub.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {sub.logo_url ? (
                          <img src={sub.logo_url} alt={sub.name} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-medium text-gray-900 truncate">{sub.name}</p>
                        <p className="text-xs text-gray-500">
                          {sub.employee_count} employé{sub.employee_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {selectedTenantId === sub.id && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {selectedSubsidiary && (
        <span className="text-xs text-gray-400">
          Filiale de <span className="font-medium text-gray-600">{context.tenant_name}</span>
        </span>
      )}
      {isGlobalDashboardMode && (
        <span className="text-xs text-purple-500 font-medium">Toutes filiales agrégées</span>
      )}
    </div>
  );
}
