'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Chargement...</p>
      </div>
    </div>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    const refreshFromUrl = searchParams.get('refresh');
    const userFromUrl = searchParams.get('user');

    if (tokenFromUrl && refreshFromUrl && userFromUrl) {
      localStorage.setItem('access_token', tokenFromUrl);
      localStorage.setItem('refresh_token', refreshFromUrl);
      localStorage.setItem('user', decodeURIComponent(userFromUrl));
      window.history.replaceState({}, '', '/dashboard');
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    const token = localStorage.getItem('access_token');
    
    if (!token) {
      window.location.href = 'https://targetym-website.vercel.app/login';
      return;
    }

    setIsAuthenticated(true);
    setIsLoading(false);
  }, [searchParams]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}