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
  },
  {
    id: 'track-progress',
    title: 'Suivez la progression',
    description: 'Mettez régulièrement à jour le pourcentage de complétion de vos objectifs pour visualiser votre avancement.',
  },
  {
    id: 'team-alignment',
    title: 'Alignez votre équipe',
    description: 'Invitez les membres de votre équipe à créer leurs propres OKR alignés avec les objectifs de l\'organisation.',
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
  },
  {
    id: 'manage-candidates',
    title: 'Gérer les candidatures',
    description: 'Suivez le parcours de chaque candidat à travers les différentes étapes : présélection, entretiens, décision finale.',
  },
  {
    id: 'pipeline',
    title: 'Visualisez votre pipeline',
    description: 'Utilisez la vue en pipeline pour avoir une vision globale de tous vos recrutements en cours.',
  },
];

/**
 * Suggestions pour la page Performance
 */
export const performanceTips: PageTip[] = [
  {
    id: 'create-campaign',
    title: 'Lancer une campagne d\'évaluation',
    description: 'Créez une campagne pour évaluer les performances de votre équipe sur une période définie.',
  },
  {
    id: 'continuous-feedback',
    title: 'Donnez du feedback continu',
    description: 'Ne attendez pas l\'évaluation annuelle ! Donnez du feedback régulièrement pour accompagner vos collaborateurs.',
  },
  {
    id: '360-feedback',
    title: 'Feedback 360°',
    description: 'Utilisez l\'évaluation 360° pour avoir une vision complète : managers, pairs et auto-évaluation.',
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
  };

  return tipsMap[pageId] || [];
}
