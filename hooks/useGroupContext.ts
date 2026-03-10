'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMyGroupContext, type MyGroupContext, type SubsidiaryItem } from '@/lib/api';

const STORAGE_KEY = 'group_context_tenant_id';

export interface GroupContextState {
  context: MyGroupContext | null;
  /** null = vue groupe entier, sinon l'id de la filiale sélectionnée */
  selectedTenantId: number | null;
  selectedSubsidiary: SubsidiaryItem | null;
  loading: boolean;
  selectTenant: (tenantId: number | null) => void;
  refresh: () => void;
}

export function useGroupContext(): GroupContextState {
  const [context, setContext] = useState<MyGroupContext | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadContext = useCallback(async () => {
    try {
      const data = await getMyGroupContext();
      if (data.is_group) {
        setContext(data);
        // Restaurer la sélection précédente si la filiale existe encore
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const savedId = parseInt(saved, 10);
          const exists = data.subsidiaries.some(s => s.id === savedId);
          if (exists) setSelectedTenantId(savedId);
        }
      }
    } catch {
      // Pas un groupe ou erreur réseau — comportement normal pour les non-groupes
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const selectTenant = useCallback((tenantId: number | null) => {
    setSelectedTenantId(tenantId);
    if (tenantId === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, tenantId.toString());
    }
  }, []);

  const selectedSubsidiary = context?.subsidiaries.find(s => s.id === selectedTenantId) ?? null;

  return {
    context,
    selectedTenantId,
    selectedSubsidiary,
    loading,
    selectTenant,
    refresh: loadContext,
  };
}
