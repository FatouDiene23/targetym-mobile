'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Adaptation mobile de @/context/AuthContext du dashboard web.
//
// Le web garde l'access_token en mémoire dans un AuthProvider adossé à un cookie
// httpOnly. La WebView Capacitor n'a pas ce cookie : le mobile conserve token et
// `user` dans localStorage (voir app/dashboard/layout.tsx et lib/api.ts).
//
// Ce module expose donc le même `useAuth()` — même forme d'objet, mêmes champs —
// mais adossé au localStorage, sans provider à monter. Cela permet aux pages
// portées depuis le web d'être reprises sans modification.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { getStoredUser, type StoredUser } from '@/lib/managerAccess';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  tenant_id?: number;
  employee_id?: number;
  is_manager?: boolean;
  has_manager_access?: boolean;
  managed_employee_count?: number;
}

function toAuthUser(stored: StoredUser | null): AuthUser | null {
  if (!stored || stored.id === undefined || !stored.email) return null;
  return {
    id: stored.id,
    email: stored.email,
    role: stored.role || 'employee',
    first_name: stored.first_name,
    last_name: stored.last_name,
    employee_id: stored.employee_id,
    is_manager: stored.is_manager,
    has_manager_access: stored.has_manager_access,
    managed_employee_count: stored.managed_employee_count,
  };
}

export function useAuth(): { user: AuthUser | null; clearAuth: () => void } {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(toAuthUser(getStoredUser()));
    sync();
    // Émis par patchStoredUser() / syncManagerAccess() au démarrage du layout
    window.addEventListener('user:updated', sync);
    const onStorage = (e: StorageEvent) => { if (e.key === 'user') sync(); };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('user:updated', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const clearAuth = () => {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    } catch { /* stockage indisponible */ }
    setUser(null);
  };

  return { user, clearAuth };
}
