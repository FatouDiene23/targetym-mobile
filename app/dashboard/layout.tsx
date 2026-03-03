'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AppTour from '@/components/AppTour';
import AIChatBox from '@/components/AIChatBox';
import HelpMenu from '@/components/HelpMenu';
import { getTourStepsByRole } from '@/components/AppTourSteps';
import { useAppTour } from '@/hooks/useAppTour';
import { HelpMenuProvider, useHelpMenu } from '@/hooks/useHelpMenu';

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Hook pour gérer le tour applicatif
  const {
    showTour,
    tourCompleted,
    userRole,
    isLoading: tourLoading,
    handleCompleteTour,
    handleSkipTour,
    handleRestartTour,
  } = useAppTour();

  // Obtenir les étapes du tour selon le rôle
  const tourSteps = getTourStepsByRole(userRole);

  useEffect(() => {
    // Utiliser window.location.search directement (plus fiable)
    const urlParams = new URLSearchParams(window.location.search);
    
    const tokenFromUrl = urlParams.get('token');
    const refreshFromUrl = urlParams.get('refresh');
    const userFromUrl = urlParams.get('user');

    console.log('Layout: Token from URL:', tokenFromUrl ? 'EXISTS' : 'NULL');

    if (tokenFromUrl && userFromUrl) {
      // Stocker les tokens
      localStorage.setItem('access_token', tokenFromUrl);
      if (refreshFromUrl) {
        localStorage.setItem('refresh_token', refreshFromUrl);
      }
      try {
        const decodedUser = decodeURIComponent(userFromUrl);
        localStorage.setItem('user', decodedUser);
        console.log('Layout: Tokens stored successfully');
      } catch (e) {
        console.error('Layout: Error decoding user:', e);
      }
      
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
      
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // Vérifier localStorage
    const token = localStorage.getItem('access_token');
    console.log('Layout: Token from localStorage:', token ? 'EXISTS' : 'NULL');
    
    if (!token) {
      console.log('Layout: No token, redirecting to login...');
      window.location.href = 'https://targetym-website.vercel.app/login';
      return;
    }

    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <HelpMenuProvider>
      <DashboardContent
        children={children}
        tourSteps={tourSteps}
        showTour={showTour}
        tourCompleted={tourCompleted}
        handleCompleteTour={handleCompleteTour}
        handleSkipTour={handleSkipTour}
        handleRestartTour={handleRestartTour}
      />
    </HelpMenuProvider>
  );
}

function DashboardContent({
  children,
  tourSteps,
  showTour,
  tourCompleted,
  handleCompleteTour,
  handleSkipTour,
  handleRestartTour,
}: {
  children: React.ReactNode;
  tourSteps: any[];
  showTour: boolean;
  tourCompleted: boolean;
  handleCompleteTour: () => void;
  handleSkipTour: () => void;
  handleRestartTour: () => void;
}) {
  const { setTourHandler } = useHelpMenu();

  // Enregistrer le handler du tour dans le contexte global
  useEffect(() => {
    if (tourCompleted && !showTour) {
      setTourHandler(handleRestartTour);
    } else {
      setTourHandler(() => {});
    }
  }, [tourCompleted, showTour, handleRestartTour, setTourHandler]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Tour Applicatif */}
      <AppTour
        steps={tourSteps}
        isOpen={showTour}
        onComplete={handleCompleteTour}
        onSkip={handleSkipTour}
      />

      {/* Menu d'aide unifié */}
      <HelpMenu />

      {/* Chatbot AI */}
      <AIChatBox />
    </div>
  );
}