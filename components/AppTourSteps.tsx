'use client';

import { TourStep } from './AppTour';

// ============================================
// TOURS PAR RÔLE
// ============================================

/**
 * Tour pour les employés (Employee)
 * Présente les fonctionnalités de base accessibles à tous les collaborateurs
 */
export const employeeTourSteps: TourStep[] = [
  {
    target: '[data-tour="welcome"]',
    title: 'Bienvenue sur Targetym AI! 👋',
    content: 'Nous allons vous faire découvrir les principales fonctionnalités de la plateforme pour vous aider à démarrer.',
    position: 'bottom',
  },
  {
    target: '[data-tour="sidebar-dashboard"]',
    title: 'Votre tableau de bord',
    content: 'Accédez à votre tableau de bord personnel avec vos statistiques, tâches et informations importantes.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-tasks"]',
    title: 'Gestion des tâches',
    content: 'Gérez vos tâches quotidiennes, suivez votre progression et validez vos activités.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-my-leaves"]',
    title: 'Demandes de congés',
    content: 'Consultez vos soldes de congés et soumettez vos demandes de congés rapidement.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-my-objectives"]',
    title: 'Vos objectifs (OKR)',
    content: 'Définissez et suivez vos objectifs personnels et professionnels (OKR - Objectives and Key Results).',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-performance"]',
    title: 'Évaluations de performance',
    content: 'Consultez vos évaluations, recevez des feedbacks et suivez votre évolution professionnelle.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-learning"]',
    title: 'Formations',
    content: 'Accédez à votre catalogue de formations, suivez vos cours assignés et obtenez des certificats.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-career"]',
    title: 'Évolution de carrière',
    content: 'Explorez vos opportunités de carrière, les compétences requises et les formations recommandées.',
    position: 'right',
  },
  {
    target: '[data-tour="quick-actions"]',
    title: 'Actions rapides',
    content: 'Accédez rapidement aux actions fréquentes comme demander un congé ou consulter vos objectifs.',
    position: 'left',
  },
  {
    target: '[data-tour="notifications"]',
    title: 'Notifications',
    content: 'Restez informé des événements importants : validations, nouvelles tâches, messages, etc.',
    position: 'bottom',
  },
  {
    target: '[data-tour="user-menu"]',
    title: 'Menu utilisateur',
    content: 'Accédez à votre profil et déconnectez-vous ici. Le tour est terminé ! 🎉',
    position: 'top',
  },
];

/**
 * Tour pour les managers
 * Ajoute les fonctionnalités de gestion d'équipe
 */
export const managerTourSteps: TourStep[] = [
  {
    target: '[data-tour="welcome"]',
    title: 'Bienvenue Manager! 🎯',
    content: 'En tant que manager, vous avez accès à des fonctionnalités supplémentaires pour gérer votre équipe efficacement.',
    position: 'bottom',
  },
  {
    target: '[data-tour="sidebar-dashboard"]',
    title: 'Tableau de bord manager',
    content: 'Visualisez les indicateurs de votre équipe : tâches, congés, performances et objectifs.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-team"]',
    title: 'Gestion de l\'équipe',
    content: 'Consultez la liste de vos collaborateurs directs et accédez à leurs profils détaillés.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-tasks"]',
    title: 'Tâches de l\'équipe',
    content: 'Assignez des tâches, suivez l\'avancement et validez les tâches de votre équipe.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-my-leaves"]',
    title: 'Validation des congés',
    content: 'Approuvez ou refusez les demandes de congés de vos collaborateurs.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-okr"]',
    title: 'OKR d\'équipe',
    content: 'Définissez les objectifs de votre équipe et suivez leur progression collective.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-performance"]',
    title: 'Évaluations d\'équipe',
    content: 'Réalisez les évaluations de performance de vos collaborateurs et donnez du feedback.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-learning"]',
    title: 'Formation de l\'équipe',
    content: 'Assignez des formations à vos collaborateurs et suivez leur progression.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-analytics"]',
    title: 'Analytiques d\'équipe',
    content: 'Analysez les performances et tendances de votre équipe.',
    position: 'right',
  },
  {
    target: '[data-tour="quick-actions"]',
    title: 'Actions rapides',
    content: 'Accédez rapidement aux actions fréquentes : nouvelle tâche, validation, feedback, etc.',
    position: 'left',
  },
  {
    target: '[data-tour="notifications"]',
    title: 'Notifications',
    content: 'Restez informé des demandes de votre équipe et actions à valider.',
    position: 'bottom',
  },
  {
    target: '[data-tour="user-menu"]',
    title: 'Votre profil',
    content: 'Accédez à votre espace personnel. Le tour est terminé ! 🎉',
    position: 'top',
  },
];

/**
 * Tour pour les RH
 * Fonctionnalités complètes de gestion RH
 */
export const hrTourSteps: TourStep[] = [
  {
    target: '[data-tour="welcome"]',
    title: 'Bienvenue dans l\'espace RH! 💼',
    content: 'Vous avez accès à toutes les fonctionnalités RH pour gérer efficacement vos collaborateurs.',
    position: 'bottom',
  },
  {
    target: '[data-tour="sidebar-employees"]',
    title: 'Gestion des employés',
    content: 'Accédez à la base de données complète des employés : ajout, modification, exports, etc.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-recruitment"]',
    title: 'Recrutement',
    content: 'Gérez vos processus de recrutement : candidats, entretiens et embauches.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-onboarding"]',
    title: 'Onboarding RH',
    content: 'Créez des programmes d\'intégration pour les nouveaux collaborateurs avec tâches et documents.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-leaves"]',
    title: 'Gestion des congés',
    content: 'Configurez les types de congés, gérez les soldes et supervisez toutes les demandes.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-okr"]',
    title: 'OKR & Objectifs',
    content: 'Suivez les objectifs stratégiques et opérationnels de l\'organisation.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-performance"]',
    title: 'Évaluations globales',
    content: 'Supervisez toutes les évaluations de performance de l\'entreprise et analysez les tendances.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-learning"]',
    title: 'Gestion de la formation',
    content: 'Créez des catalogues de formation, assignez des cours et suivez la progression.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-career"]',
    title: 'Gestion de carrière',
    content: 'Définissez les parcours de carrière, compétences requises et gérez les promotions.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-analytics"]',
    title: 'Analytiques RH',
    content: 'Analysez les données RH : turnover, absentéisme, performances, et plus encore.',
    position: 'right',
  },
  {
    target: '[data-tour="quick-actions"]',
    title: 'Actions rapides',
    content: 'Accédez rapidement aux tâches RH quotidiennes.',
    position: 'left',
  },
  {
    target: '[data-tour="notifications"]',
    title: 'Notifications',
    content: 'Restez informé des demandes de congés, évaluations et alertes RH.',
    position: 'bottom',
  },
  {
    target: '[data-tour="user-menu"]',
    title: 'Votre profil',
    content: 'Accédez à votre espace personnel. Le tour est terminé ! 🎉',
    position: 'top',
  },
];

/**
 * Tour pour les admins/DG
 * Toutes les fonctionnalités + administration système
 */
export const adminTourSteps: TourStep[] = [
  {
    target: '[data-tour="welcome"]',
    title: 'Bienvenue Administrateur! 🔐',
    content: 'En tant qu\'administrateur, vous avez un contrôle total sur la plateforme et ses configurations.',
    position: 'bottom',
  },
  {
    target: '[data-tour="sidebar-dashboard"]',
    title: 'Tableau de bord exécutif',
    content: 'Vue d\'ensemble de toute l\'organisation avec KPIs stratégiques et indicateurs clés.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-employees"]',
    title: 'Gestion complète des employés',
    content: 'Contrôle total sur tous les employés de l\'organisation avec droits d\'administration.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-recruitment"]',
    title: 'Recrutement',
    content: 'Gérez les offres d\'emploi, candidatures et processus de recrutement.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-onboarding"]',
    title: 'Onboarding',
    content: 'Créez des parcours d\'intégration pour accueillir vos nouveaux collaborateurs.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-leaves"]',
    title: 'Gestion des congés',
    content: 'Approuvez les demandes de congés et gérez les soldes de congés de vos équipes.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-okr"]',
    title: 'OKR & Objectifs',
    content: 'Suivez et pilotez les objectifs stratégiques de toute l\'organisation.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-performance"]',
    title: 'Performance & Feedback',
    content: 'Gérez les évaluations de performance et le feedback continu.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-learning"]',
    title: 'Formation & Développement',
    content: 'Créez des parcours de formation et gérez le développement des compétences.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-career"]',
    title: 'Talents & Carrière',
    content: 'Gérez les plans de succession, nine-box et parcours de carrière.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-analytics"]',
    title: 'People Analytics',
    content: 'Accédez aux rapports détaillés, prévisions et analyses stratégiques RH.',
    position: 'right',
  },
  {
    target: '[data-tour="sidebar-settings"]',
    title: 'Paramètres système',
    content: 'Configurez les paramètres globaux : types de congés, rôles, permissions, intégrations.',
    position: 'right',
  },
  {
    target: '[data-tour="quick-actions"]',
    title: 'Actions rapides',
    content: 'Accédez rapidement aux fonctionnalités les plus utilisées.',
    position: 'left',
  },
  {
    target: '[data-tour="notifications"]',
    title: 'Notifications',
    content: 'Restez informé des événements importants et des actions requises.',
    position: 'bottom',
  },
  {
    target: '[data-tour="user-menu"]',
    title: 'Votre profil',
    content: 'Accédez à votre profil personnel et paramètres utilisateur. Le tour est terminé ! 🎉',
    position: 'top',
  },
];

/**
 * Fonction pour obtenir le tour approprié selon le rôle
 */
export function getTourStepsByRole(role: string): TourStep[] {
  const normalizedRole = role?.toLowerCase() || 'employee';

  switch (normalizedRole) {
    case 'admin':
    case 'dg':
    case 'super_admin':
      return adminTourSteps;
    
    case 'rh':
    case 'hr':
      return hrTourSteps;
    
    case 'manager':
      return managerTourSteps;
    
    case 'employee':
    default:
      return employeeTourSteps;
  }
}

/**
 * Message de bienvenue personnalisé selon le rôle
 */
export function getWelcomeMessage(role: string): string {
  const normalizedRole = role?.toLowerCase() || 'employee';

  const messages: Record<string, string> = {
    admin: 'Bienvenue dans votre espace administrateur ! Vous avez le contrôle total de la plateforme.',
    dg: 'Bienvenue DG ! Pilotez votre organisation avec des outils de gestion avancés.',
    rh: 'Bienvenue dans votre espace RH ! Gérez vos collaborateurs efficacement.',
    manager: 'Bienvenue Manager ! Accompagnez votre équipe vers la réussite.',
    employee: 'Bienvenue sur Targetym AI ! Votre espace personnel pour gérer votre carrière.',
  };

  return messages[normalizedRole] || messages.employee;
}
