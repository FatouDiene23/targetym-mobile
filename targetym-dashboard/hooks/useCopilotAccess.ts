'use client';

import { useEffect, useState } from 'react';
import { getChatbotStatus } from '@/lib/api';

/** Same opt-in policy as the web Copilot. Employees and platform admins are excluded. */
const MANAGEMENT_ROLES = ['rh', 'admin', 'dg', 'manager'];

export function useCopilotAccess() {
  const [role, setRole] = useState('employee');
  const [tenantEnabled, setTenantEnabled] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setRole(user.role || 'employee');
    } catch {}

    let cancelled = false;
    getChatbotStatus()
      .then((status) => { if (!cancelled) setTenantEnabled(Boolean(status.enabled)); })
      .catch(() => { /* fail closed: do not expose the Copilot on an unknown tenant */ })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, []);

  return {
    role,
    checked,
    // La navigation web affiche le Copilote même lorsqu'il n'est pas encore
    // activé pour le profil. L'écran explique alors le blocage sans exposer
    // les actions du chat. Seul le back-office plateforme reste exclu.
    canSeeCopilot: role !== 'super_admin' && role !== 'superadmin',
    canUseCopilot: MANAGEMENT_ROLES.includes(role) && tenantEnabled,
  };
}
