'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, LogOut, User } from 'lucide-react';

export default function ImpersonationBanner() {
  const router = useRouter();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedEmail, setImpersonatedEmail] = useState('');
  const [agentEmail, setAgentEmail] = useState('');

  useEffect(() => {
    const check = () => {
      const flag = localStorage.getItem('is_impersonating');
      if (flag === 'true') {
        setIsImpersonating(true);
        setImpersonatedEmail(localStorage.getItem('impersonated_user_email') || '');
        setAgentEmail(localStorage.getItem('impersonated_by_email') || '');
      } else {
        setIsImpersonating(false);
      }
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  const handleExit = () => {
    // Restaurer le token original
    const backupToken = localStorage.getItem('access_token_backup');
    const backupUser = localStorage.getItem('user_backup');

    if (backupToken) localStorage.setItem('access_token', backupToken);
    if (backupUser) localStorage.setItem('user', backupUser);

    // Nettoyer les données d'impersonation
    localStorage.removeItem('access_token_backup');
    localStorage.removeItem('user_backup');
    localStorage.removeItem('is_impersonating');
    localStorage.removeItem('impersonated_user_email');
    localStorage.removeItem('impersonated_by_email');
    localStorage.removeItem('impersonated_tenant_slug');

    // Rediriger vers le back-office
    window.location.href = '/dashboard/platform-admin';
  };

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>
          Mode impersonation — vous consultez le dashboard de{' '}
          <strong>{impersonatedEmail}</strong>
          {agentEmail && (
            <span className="ml-1 opacity-80">(connecté en tant que {agentEmail})</span>
          )}
        </span>
      </div>
      <button
        onClick={handleExit}
        className="flex items-center gap-1.5 bg-white text-amber-700 hover:bg-amber-50 px-3 py-1 rounded-md text-sm font-semibold transition-colors ml-4 flex-shrink-0"
      >
        <LogOut className="w-3.5 h-3.5" />
        Quitter l&apos;impersonation
      </button>
    </div>
  );
}
