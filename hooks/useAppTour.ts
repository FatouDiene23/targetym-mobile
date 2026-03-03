'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAppTourStatus, completeAppTour, resetAppTour } from '@/lib/api';

/**
 * Hook personnalisé pour gérer le tour applicatif
 */
export function useAppTour() {
  const router = useRouter();
  const [showTour, setShowTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(true);
  const [userRole, setUserRole] = useState<string>('employee');
  const [isLoading, setIsLoading] = useState(true);

  // Charger le statut du tour au montage
  useEffect(() => {
    loadTourStatus();
  }, []);

  const loadTourStatus = async () => {
    try {
      setIsLoading(true);
      const status = await getAppTourStatus();
      
      setTourCompleted(status.has_completed);
      setUserRole(status.user_role);
      
      // Si le tour n'est pas complété, le démarrer automatiquement après un délai
      if (!status.has_completed) {
        setTimeout(() => {
          setShowTour(true);
        }, 1000); // Délai de 1 seconde pour laisser le temps au dashboard de charger
      }
    } catch (error) {
      console.error('Erreur lors du chargement du statut du tour:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteTour = async () => {
    try {
      await completeAppTour();
      setTourCompleted(true);
      setShowTour(false);
    } catch (error) {
      console.error('Erreur lors de la complétion du tour:', error);
    }
  };

  const handleSkipTour = async () => {
    try {
      await completeAppTour();
      setTourCompleted(true);
      setShowTour(false);
    } catch (error) {
      console.error('Erreur lors du skip du tour:', error);
      // Même en cas d'erreur, on ferme le tour localement
      setShowTour(false);
    }
  };

  const handleRestartTour = async () => {
    try {
      await resetAppTour();
      setTourCompleted(false);
      
      // Rediriger vers le dashboard avant de démarrer le tour
      router.push('/dashboard');
      
      // Laisser le temps à la page de charger avant de démarrer le tour
      setTimeout(() => {
        setShowTour(true);
      }, 500);
    } catch (error) {
      console.error('Erreur lors du redémarrage du tour:', error);
    }
  };

  return {
    showTour,
    tourCompleted,
    userRole,
    isLoading,
    setShowTour,
    handleCompleteTour,
    handleSkipTour,
    handleRestartTour,
  };
}
