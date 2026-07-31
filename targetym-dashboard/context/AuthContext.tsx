'use client';

/**
 * AuthContext — gestion sécurisée des tokens (Option C hybride)
 *
 * - access_token  → state React en mémoire uniquement (jamais dans localStorage)
 * - refresh_token → cookie httpOnly posé par le backend (invisible pour JS)
 * - user          → localStorage (pas sensible, juste des infos d'affichage)
 *
 * XSS ne peut pas voler le refresh_token (httpOnly).
 * Même si l'access_token est lu depuis la mémoire, sa durée de vie est 30 min.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

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

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
}

interface AuthContextValue extends AuthState {
  /** Définit l'access_token en mémoire + persiste le user dans localStorage */
  setAuth: (accessToken: string, user: AuthUser) => void;
  /** Met à jour uniquement l'access_token en mémoire (sans toucher au user) — utilisé par le refresh silencieux */
  setAccessToken: (accessToken: string) => void;
  /** Met à jour uniquement le user (sans changer le token) — utilisé pour synchroniser avec l'API */
  updateUser: (user: AuthUser) => void;
  /** Efface la session en mémoire + localStorage (le cookie httpOnly est effacé côté serveur) */
  clearAuth: () => void;
  /** Lit l'access_token courant (pour les headers Authorization) */
  getAccessToken: () => string | null;
  /** Vrai si une session est présente */
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Recharge le user depuis localStorage au montage (survivance au reload) */
function loadUserFromStorage(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/** Ré-hydrate le token d'impersonation (le cookie de refresh reste super-admin :
 * sans ça, un reload repartirait sur la session super-admin / back-office). */
function loadImpersonationToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    if (localStorage.getItem('is_impersonating') === 'true') {
      return sessionStorage.getItem('impersonation_token');
    }
  } catch { /* ignore */ }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    // En impersonation, on repart du token stocké dès le 1er rendu synchrone → le
    // layout voit un token et n'effectue pas le refresh cookie (qui est super-admin).
    accessToken: loadImpersonationToken(),
    // user rechargé depuis localStorage (infos d'affichage non sensibles)
    user: loadUserFromStorage(),
  }));

  // Ref pour accès synchrone dans fetchWithAuth sans dépendance de closure
  const tokenRef = useRef<string | null>(state.accessToken);

  const setAuth = useCallback((accessToken: string, user: AuthUser) => {
    tokenRef.current = accessToken;
    setState({ accessToken, user });
    // Supprime un éventuel JWT laissé par une version antérieure.
    try { sessionStorage.removeItem('access_token'); } catch { /* ignore */ }
    // Persiste les infos d'affichage (non sensibles)
    localStorage.setItem('user', JSON.stringify(user));
    // Nettoie les anciens tokens en clair
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }, []);

  const setAccessToken = useCallback((accessToken: string) => {
    tokenRef.current = accessToken;
    setState(prev => ({ ...prev, accessToken }));
    try { sessionStorage.removeItem('access_token'); } catch { /* ignore */ }
  }, []);

  const updateUser = useCallback((user: AuthUser) => {
    setState(prev => ({ ...prev, user }));
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new Event('user:updated'));
  }, []);

  const clearAuth = useCallback(() => {
    tokenRef.current = null;
    setState({ accessToken: null, user: null });
    try { sessionStorage.removeItem('access_token'); } catch { /* ignore */ }
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('is_impersonating');
  }, []);

  const getAccessToken = useCallback((): string | null => {
    return tokenRef.current;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        setAuth,
        setAccessToken,
        updateUser,
        clearAuth,
        getAccessToken,
        isAuthenticated: state.accessToken !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
