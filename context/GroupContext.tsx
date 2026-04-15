'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { getMyGroupContext, type MyGroupContext, type SubsidiaryItem } from '@/lib/api';

const STORAGE_KEY = 'group_context_tenant_id';
const GLOBAL_MODE_KEY = 'group_context_global_mode';

export interface GroupContextState {
  context: MyGroupContext | null;
  /** null = vue tenant courant, sinon l'id de la filiale sélectionnée */
  selectedTenantId: number | null;
  selectedSubsidiary: SubsidiaryItem | null;
  /** true = Dashboard global du groupe (données agrégées de toutes les filiales) */
  isGlobalDashboardMode: boolean;
  loading: boolean;
  selectTenant: (tenantId: number | null) => void;
  setGlobalDashboardMode: (enabled: boolean) => void;
  refresh: () => void;
}

const GroupContext = createContext<GroupContextState | null>(null);

export function GroupContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<MyGroupContext | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [isGlobalDashboardMode, setIsGlobalDashboardModeState] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadContext = useCallback(async () => {
    try {
      const data = await getMyGroupContext();
      // Stocker le contexte pour tous les tenants (groupe, filiale, standalone)
      // afin que les composants (ex. Sidebar) puissent lire group_type
      setContext(data);
      if (data.is_group) {
        // Restaurer le mode global si actif
        const globalMode = localStorage.getItem(GLOBAL_MODE_KEY);
        if (globalMode === '1') {
          setIsGlobalDashboardModeState(true);
          return;
        }
        // Restaurer la sélection précédente si la filiale existe encore
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const savedId = parseInt(saved, 10);
          const exists = data.subsidiaries.some(s => s.id === savedId);
          if (exists) setSelectedTenantId(savedId);
        }
      }
    } catch {
      // Erreur réseau — comportement normal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const selectTenant = useCallback((tenantId: number | null) => {
    setSelectedTenantId(tenantId);
    setIsGlobalDashboardModeState(false);
    localStorage.removeItem(GLOBAL_MODE_KEY);
    if (tenantId === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, tenantId.toString());
    }
  }, []);

  const setGlobalDashboardMode = useCallback((enabled: boolean) => {
    setIsGlobalDashboardModeState(enabled);
    if (enabled) {
      setSelectedTenantId(null);
      localStorage.setItem(GLOBAL_MODE_KEY, '1');
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.removeItem(GLOBAL_MODE_KEY);
    }
  }, []);

  const selectedSubsidiary = context?.subsidiaries.find(s => s.id === selectedTenantId) ?? null;

  const value: GroupContextState = {
    context,
    selectedTenantId,
    selectedSubsidiary,
    isGlobalDashboardMode,
    loading,
    selectTenant,
    setGlobalDashboardMode,
    refresh: loadContext,
  };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroupContext(): GroupContextState {
  const ctx = useContext(GroupContext);
  if (!ctx) {
    throw new Error('useGroupContext must be used within a GroupContextProvider');
  }
  return ctx;
}
