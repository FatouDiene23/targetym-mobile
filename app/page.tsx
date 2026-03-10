'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Récupérer les tokens depuis l'URL si présents
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const refreshFromUrl = urlParams.get('refresh');
    const userFromUrl = urlParams.get('user');

    let userRole = '';

    if (tokenFromUrl && userFromUrl) {
      // Stocker les tokens
      localStorage.setItem('access_token', tokenFromUrl);
      if (refreshFromUrl) {
        localStorage.setItem('refresh_token', refreshFromUrl);
      }
      try {
        const decoded = decodeURIComponent(userFromUrl);
        localStorage.setItem('user', decoded);
        const parsed = JSON.parse(decoded);
        userRole = parsed?.role || '';
      } catch (e) {
        console.error('Error decoding user:', e);
      }
    } else {
      // Récupérer le rôle depuis le localStorage si déjà connecté
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          userRole = parsed?.role || '';
        }
      } catch (e) {
        // ignore
      }
    }

    // Rediriger vers le bon dashboard selon le rôle
    const isPlatformAdmin = ['superadmin', 'super_admin', 'superadmintech', 'platform_admin'].includes(
      userRole.toLowerCase().replace(/[^a-z_]/g, '')
    );
    router.replace(isPlatformAdmin ? '/dashboard/platform-admin' : '/dashboard');
  }, [router]);

  // Écran de chargement pendant la redirection
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Chargement...</p>
      </div>
    </div>
  );
}
