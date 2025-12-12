'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. Vérifier si on a des tokens dans l'URL (venant du login)
    const tokenFromUrl = searchParams.get('token');
    const refreshFromUrl = searchParams.get('refresh');
    const userFromUrl = searchParams.get('user');

    if (tokenFromUrl && refreshFromUrl && userFromUrl) {
      // Stocker les tokens dans localStorage
      localStorage.setItem('access_token', tokenFromUrl);
      localStorage.setItem('refresh_token', refreshFromUrl);
      localStorage.setItem('user', decodeURIComponent(userFromUrl));
      
      // Nettoyer l'URL (enlever les params)
      window.history.replaceState({}, '', '/dashboard');
      
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // 2. Sinon, vérifier si on a déjà un token dans localStorage
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      // Pas de token → rediriger vers login
      window.location.href = 'https://targetym-website.vercel.app/login';
      return;
    }

    // Token existe → autoriser l'accès
    setIsAuthenticated(true);
    setIsLoading(false);
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
