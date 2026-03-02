import { PageTip } from '@/components/PageTourTips';

/**
 * Suggestions contextuelles pour la page Dashboard
 */
export const dashboardTips: PageTip[] = [
  {
    id: 'welcome-card',
    title: 'Bienvenue sur votre tableau de bord ! 🎯',
    description: 'Voici votre hub central. Vous trouverez ici un résumé de vos indicateurs clés, tâches à venir et notifications importantes.',
    action: {
      label: 'Voir la carte de bienvenue',
      element: '[data-tour="welcome"]',
    },
  },
  {
    id: 'quick-actions',
    title: 'Actions rapides à portée de main',
    description: 'Accédez rapidement aux actions les plus courantes : demander un congé, consulter vos objectifs, ou gérer votre équipe.',
    action: {
      label: 'Voir les actions rapides',
      element: '[data-tour="quick-actions"]',
    },
  },
  {
    id: 'notifications',
    title: 'Restez informé en temps réel',
    description: 'Cliquez sur l\'icône de cloche pour voir vos notifications : validations en attente, nouvelles tâches, et messages importants.',
    action: {
      label: 'Voir les notifications',
      element: '[data-tour="notifications"]',
    },
  },
];

/**
 * Suggestions pour la page Employés (RH/Admin)
 */
export const employeesTips: PageTip[] = [
  {
    id: 'add-employee',
    title: 'Ajouter votre premier employé',
    description: 'Commencez par ajouter les informations de vos collaborateurs. Vous pourrez ensuite gérer leurs congés, performances et parcours de carrière.',
  },
  {
    id: 'export-data',
    title: 'Exporter vos données',
    description: 'Besoin de partager ou analyser vos données ? Exportez la liste complète en Excel ou CSV en utilisant le bouton "Exporter" en haut de la page.',
  },
  {
    id: 'filters',
    title: 'Filtrer et rechercher',
    description: 'Utilisez les filtres pour trouver rapidement des employés par département, statut ou poste. La barre de recherche permet de chercher par nom.',
  },
];

/**
 * Suggestions pour la page OKR
 */
export const okrTips: PageTip[] = [
  {
    id: 'create-okr',
    title: 'Créez votre premier objectif',
    description: 'Les OKR (Objectives and Key Results) vous aident à définir et suivre vos objectifs stratégiques. Commencez par créer un objectif aligné avec la vision de votre organisation.',
    action: {
      label: 'Voir le bouton Nouvel OKR',
      element: '[data-tour="create-okr"]',
    },
  },
  {
    id: 'track-progress',
    title: 'Suivez la progression',
    description: 'Mettez régulièrement à jour le pourcentage de complétion de vos objectifs pour visualiser votre avancement.',
    action: {
      label: 'Voir la progression',
      element: '[data-tour="okr-progress"]',
    },
  },
  {
    id: 'team-alignment',
    title: 'Alignez votre équipe',
    description: 'Invitez les membres de votre équipe à créer leurs propres OKR alignés avec les objectifs de l\'organisation.',
    action: {
      label: 'Voir les onglets',
      element: '[data-tour="okr-tabs"]',
    },
  },
];

/**
 * Suggestions pour la page Recrutement
 */
export const recruitmentTips: PageTip[] = [
  {
    id: 'create-job',
    title: 'Publier une offre d\'emploi',
    description: 'Créez votre première offre d\'emploi en quelques clics. Définissez le poste, les compétences requises et le processus de sélection.',
    action: {
      label: 'Voir le bouton Nouvelle Offre',
      element: '[data-tour="create-job"]',
    },
  },
  {
    id: 'manage-candidates',
    title: 'Gérer les candidatures',
    description: 'Suivez le parcours de chaque candidat à travers les différentes étapes : présélection, entretiens, décision finale.',
    action: {
      label: 'Voir les statistiques',
      element: '[data-tour="recruitment-stats"]',
    },
  },
  {
    id: 'pipeline',
    title: 'Visualisez votre pipeline',
    description: 'Utilisez la vue en pipeline pour avoir une vision globale de tous vos recrutements en cours.',
    action: {
      label: 'Voir les statistiques',
      element: '[data-tour="recruitment-stats"]',
    },
  },
];

/**
 * Suggestions pour la page Performance
 */
export const performanceTips: PageTip[] = [
  {
    id: 'create-campaign',
    title: 'Lancer une campagne d\'évaluation',
    description
: 'Créez une campagne pour évaluer les performances de votre équipe sur une période définie.',
    action: {
      label: 'Voir les statistiques',
      element: '[data-tour="performance-stats"]',
    },
  },
  {
    id: 'continuous-feedback',
    title: 'Donnez du feedback continu',
    description: 'Ne attendez pas l\'évaluation annuelle ! Donnez du feedback régulièrement pour accompagner vos collaborateurs.',
    action: {
      label: 'Voir les onglets',
      element: '[data-tour="feedback-tabs"]',
    },
  },
  {
    id: '360-feedback',
    title: 'Feedback 360°',
    description: 'Utilisez l\'évaluation 360° pour avoir une vision complète : managers, pairs et auto-évaluation.',
    action: {
      label: 'Voir les onglets',
      element: '[data-tour="feedback-tabs"]',
    },
  },
];

/**
 * Suggestions pour la page Learning
 */
export const learningTips: PageTip[] = [
  {
    id: 'browse-catalog',
    title: 'Explorez le catalogue de formations',
    description: 'Découvrez toutes les formations disponibles : techniques, soft skills, certifications. Filtrez par catégorie pour trouver ce qui vous intéresse.',
    action: {
      label: 'Voir les statistiques',
      element: '[data-tour="learning-stats"]',
    },
  },
  {
    id: 'request-course',
    title: 'Demandez une formation',
    description: 'Vous avez identifié un besoin ? Demandez une nouvelle formation à votre manager ou au service RH.',
    action: {
      label: 'Voir le bouton Demander',
      element: '[data-tour="request-course"]',
    },
  },
  {
    id: 'track-progress',
    title: 'Suivez votre progression',
    description: 'Consultez vos formations en cours, complétées et les certifications obtenues dans l\'onglet "Mon Apprentissage".',
    action: {
      label: 'Voir les filtres',
      element: '[data-tour="learning-filters"]',
    },
  },
];

/**
 * Suggestions pour la page Leaves
 */
export const leavesTips: PageTip[] = [
  {
    id: 'view-stats',
    title: 'Vue d\'ensemble des congés',
    description: 'Consultez en un coup d\'œil le nombre de demandes en attente, approuvées, et les collaborateurs absents aujourd\'hui.',
    action: {
      label: 'Voir les statistiques',
      element: '[data-tour="leaves-stats"]',
    },
  },
  {
    id: 'review-requests',
    title: 'Traitez les demandes',
    description: 'Approuvez ou refusez les demandes de congés de votre équipe. Vous pouvez filtrer par statut et département.',
    action: {
      label: 'Voir les filtres',
      element: '[data-tour="leaves-filters"]',
    },
  },
  {
    id: 'calendar-view',
    title: 'Visualisez le planning',
    description: 'Utilisez le calendrier pour avoir une vue globale des absences du mois et planifier en conséquence.',
    action: {
      label: 'Voir les onglets',
      element: '[data-tour="leaves-tabs"]',
    },
  },
];

/**
 * Suggestions pour la page Talents/9-Box
 */
export const talentsTips: PageTip[] = [
  {
    id: 'ninebox-matrix',
    title: 'Matrice 9-Box : Performance × Potentiel',
    description: 'Visualisez le positionnement de vos collaborateurs selon leur performance et leur potentiel. Identifiez vos hauts potentiels et talents à développer.',
    action: {
      label: 'Voir la matrice',
      element: '[data-tour="ninebox-grid"]',
    },
  },
  {
    id: 'filter-period',
    title: 'Sélectionnez la période',
    description: 'Comparez l\'évolution des talents sur différentes périodes d\'évaluation pour suivre leur progression.',
    action: {
      label: 'Voir les filtres',
      element: '[data-tour="ninebox-filters"]',
    },
  },
  {
    id: 'talent-actions',
    title: 'Actions de développement',
    description: 'Cliquez sur un collaborateur pour voir son profil détaillé et définir des actions de développement personnalisées.',
    action: {
      label: 'Voir la légende',
      element: '[data-tour="ninebox-legend"]',
    },
  },
];

/**
 * Obtenir les tips selon l'ID de la page
 */
export function getPageTips(pageId: string): PageTip[] {
  const tipsMap: Record<string, PageTip[]> = {
    dashboard: dashboardTips,
    employees: employeesTips,
    okr: okrTips,
    recruitment: recruitmentTips,
    performance: performanceTips,
    learning: learningTips,
    leaves: leavesTips,
    talents: talentsTips,
  };

  return tipsMap[pageId] || [];
}
