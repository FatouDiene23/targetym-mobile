'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [debugInfo, setDebugInfo] = useState('Initialisation...');

  useEffect(() => {
    try {
      setDebugInfo('JS chargé. Vérification token...');

      // Récupérer les tokens depuis l'URL si présents
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');
      const refreshFromUrl = urlParams.get('refresh');
      const userFromUrl = urlParams.get('user');

      let userRole = '';

      if (tokenFromUrl && userFromUrl) {
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

      const token = localStorage.getItem('access_token');
      setDebugInfo(`Token: ${token ? 'OUI' : 'NON'} | Protocol: ${window.location.protocol} | Host: ${window.location.host}`);

      // Redirection immédiate
      if (!token && !tokenFromUrl) {
        window.location.replace('/login/index.html');
      } else {
        const isPlatformAdmin = ['superadmin', 'super_admin', 'superadmintech', 'platform_admin'].includes(
          userRole.toLowerCase().replace(/[^a-z_]/g, '')
        );
        window.location.replace(isPlatformAdmin ? '/dashboard/platform-admin/index.html' : '/dashboard/index.html');
      }
    } catch (err: any) {
      setDebugInfo(`ERREUR: ${err.message}`);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Chargement...</p>
        <p className="text-xs text-gray-400 mt-4 px-4 break-all">{debugInfo}</p>
      </div>
    </div>
  );
}
