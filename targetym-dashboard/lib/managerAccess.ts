// ─────────────────────────────────────────────────────────────────────────────
// Détection de l'accès manager « effectif »
//
// Un utilisateur encadre une équipe dès qu'un de ces signaux est vrai :
//   - son rôle est `manager` ;
//   - le backend expose `has_manager_access` / `managed_employee_count`
//     (renvoyés par /api/auth/me) — c'est le cas du « manager de fait », dont
//     le rôle reste `employee` mais qui a des rattachements directs ;
//   - sa fiche employé porte `is_manager`.
//
// L'union des trois est volontaire : les deux premiers alignent le mobile sur le
// dashboard web, le troisième reste un repli pour les sessions dont le `user` en
// cache date d'avant l'ajout de ces champs.
// ─────────────────────────────────────────────────────────────────────────────

import { API_URL, getToken } from '@/lib/api';

export interface ManagerAccessUser {
  role?: string | null;
  is_manager?: boolean;
  has_manager_access?: boolean;
  managed_employee_count?: number;
}

export interface StoredUser extends ManagerAccessUser {
  id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  employee_id?: number;
}

/** Vrai si l'utilisateur encadre une équipe, quel que soit le signal disponible. */
export function hasManagerSignal(user: ManagerAccessUser | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role?.toLowerCase() === 'manager' ||
    user.is_manager === true ||
    user.has_manager_access === true ||
    Number(user.managed_employee_count || 0) > 0
  );
}

/** Lit le `user` mis en cache par le login / le layout. */
export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

/** Raccourci : accès manager effectif d'après le `user` en cache. */
export function hasStoredManagerSignal(): boolean {
  return hasManagerSignal(getStoredUser());
}

/** Fusionne des champs dans le `user` en cache et notifie les composants montés. */
export function patchStoredUser(patch: Partial<StoredUser>): void {
  if (typeof window === 'undefined') return;
  const current = getStoredUser();
  if (!current) return;
  try {
    localStorage.setItem('user', JSON.stringify({ ...current, ...patch }));
    window.dispatchEvent(new Event('user:updated'));
  } catch { /* stockage indisponible — on garde la valeur en mémoire */ }
}

/**
 * Rafraîchit `has_manager_access` / `managed_employee_count` depuis /api/auth/me.
 *
 * Les sessions mobiles ouvertes avant l'ajout de ces champs gardent un `user`
 * en cache incomplet : sans cet appel, un manager de fait resterait vu comme
 * simple employé jusqu'à sa prochaine reconnexion.
 */
export async function syncManagerAccess(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) return false;
    const me = (await res.json()) as StoredUser;
    patchStoredUser({
      has_manager_access: me.has_manager_access ?? false,
      managed_employee_count: me.managed_employee_count ?? 0,
    });
    return hasManagerSignal(me);
  } catch {
    return false;
  }
}
