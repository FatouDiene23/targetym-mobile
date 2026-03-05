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
 * Suggestions pour la page Analytics
 */
export const analyticsTips: PageTip[] = [
  {
    id: 'overview-kpis',
    title: 'Indicateurs clés RH en un coup d\'œil',
    description: 'Consultez vos KPIs essentiels : effectifs, turnover, rétention, absentéisme. Identifiez rapidement les tendances et points d\'attention.',
    action: {
      label: 'Voir les indicateurs',
      element: '[data-tour="analytics-kpis"]',
    },
  },
  {
    id: 'charts-visualization',
    title: 'Visualisez vos données',
    description: 'Explorez les graphiques interactifs pour analyser la performance, les talents, et la diversité de vos équipes.',
    action: {
      label: 'Voir les graphiques',
      element: '[data-tour="analytics-charts"]',
    },
  },
  {
    id: 'export-reports',
    title: 'Exportez vos rapports',
    description: 'Téléchargez vos données en Excel ou PDF pour des présentations ou analyses approfondies.',
    action: {
      label: 'Voir le bouton Export',
      element: '[data-tour="analytics-export"]',
    },
  },
];

/**
 * Suggestions pour la page Certificates
 */
export const certificatesTips: PageTip[] = [
  {
    id: 'generate-doc',
    title: 'Générez des documents officiels',
    description: 'Créez des certificats de travail ou attestations en quelques clics. Les documents sont automatiquement conformes et signés.',
    action: {
      label: 'Voir la liste',
      element: '[data-tour="employees-list"]',
    },
  },
  {
    id: 'search-employee',
    title: 'Recherchez l\'employé',
    description: 'Utilisez la recherche pour trouver rapidement le collaborateur concerné. Filtrez par statut (actif/inactif).',
    action: {
      label: 'Voir la recherche',
      element: '[data-tour="certificates-search"]',
    },
  },
  {
    id: 'view-history',
    title: 'Historique des générations',
    description: 'Consultez tous les certificats générés avec leur référence unique et la date de création.',
    action: {
      label: 'Voir l\'historique',
      element: '[data-tour="certificates-history"]',
    },
  },
];

/**
 * Suggestions pour la page Missions
 */
export const missionsTips: PageTip[] = [
  {
    id: 'create-mission',
    title: 'Créez une mission',
    description: 'Planifiez les déplacements professionnels : destination, dates, transport, hébergement et budget.',
    action: {
      label: 'Voir le bouton Nouvelle Mission',
      element: '[data-tour="create-mission"]',
    },
  },
  {
    id: 'track-status',
    title: 'Suivez les validations',
    description: 'Les missions passent par plusieurs étapes : validation manager, validation RH, exécution, et clôture avec rapport.',
    action: {
      label: 'Voir les statistiques',
      element: '[data-tour="missions-stats"]',
    },
  },
  {
    id: 'manage-expenses',
    title: 'Gérez les frais',
    description: 'Ajoutez les dépenses avec justificatifs, suivez les remboursements et exportez les rapports de frais.',
    action: {
      label: 'Voir les filtres',
      element: '[data-tour="missions-filters"]',
    },
  },
];

/**
 * Suggestions pour la page My-space
 */
export const mySpaceTips: PageTip[] = [
  {
    id: 'edit-profile',
    title: 'Gérez votre profil',
    description: 'Consultez et mettez à jour vos informations personnelles : coordonnées, poste, département.',
    action: {
      label: 'Voir le profil',
      element: '[data-tour="profile-section"]',
    },
  },
  {
    id: 'add-signature',
    title: 'Ajoutez votre signature',
    description: 'Créez votre signature électronique pour valider les documents et missions en toute sécurité.',
    action: {
      label: 'Voir la signature',
      element: '[data-tour="signature-section"]',
    },
  },
  {
    id: 'view-org-chart',
    title: 'Organigramme personnel',
    description: 'Visualisez votre position dans l\'organisation et votre chaîne hiérarchique.',
    action: {
      label: 'Voir l\'organigramme',
      element: '[data-tour="org-chart"]',
    },
  },
];

/**
 * Suggestions pour la page Notifications
 */
export const notificationsTips: PageTip[] = [
  {
    id: 'view-notifications',
    title: 'Toutes vos notifications',
    description: 'Recevez les alertes importantes : validations, tâches, rappels, onboarding, congés et missions.',
    action: {
      label: 'Voir les notifications',
      element: '[data-tour="notifications-list"]',
    },
  },
  {
    id: 'filter-type',
    title: 'Filtrez par type',
    description: 'Affichez uniquement les notifications qui vous intéressent : non lues, urgentes, ou par catégorie.',
    action: {
      label: 'Voir les filtres',
      element: '[data-tour="notifications-filters"]',
    },
  },
  {
    id: 'mark-as-read',
    title: 'Marquez comme lues',
    description: 'Gardez votre centre de notifications organisé en marquant les messages traités comme lus.',
    action: {
      label: 'Voir les actions',
      element: '[data-tour="notifications-actions"]',
    },
  },
];

/**
 * Suggestions pour la page Onboarding
 */
export const onboardingTips: PageTip[] = [
  {
    id: 'create-program',
    title: 'Créez un programme d\'onboarding',
    description: 'Définissez un parcours d\'intégration personnalisé avec des tâches, formations et rencontres planifiées.',
    action: {
      label: 'Voir les programmes',
      element: '[data-tour="onboarding-programs"]',
    },
  },
  {
    id: 'track-progress',
    title: 'Suivez la progression',
    description: 'Visualisez l\'avancement de chaque nouvel arrivant : tâches complétées, rencontres effectuées, délais.',
    action: {
      label: 'Voir les statistiques',
      element: '[data-tour="onboarding-stats"]',
    },
  },
  {
    id: 'get-to-know',
    title: 'Planifiez les rencontres',
    description: 'Organisez des "Get to Know" pour faciliter l\'intégration et créer des liens entre collaborateurs.',
    action: {
      label: 'Voir les rencontres',
      element: '[data-tour="onboarding-meetings"]',
    },
  },
];

/**
 * Suggestions pour la page Settings
 */
export const settingsTips: PageTip[] = [
  {
    id: 'company-info',
    title: 'Informations de l\'entreprise',
    description: 'Configurez les données de votre organisation : nom, adresse, contact, logo.',
    action: {
      label: 'Voir les paramètres',
      element: '[data-tour="settings-tabs"]',
    },
  },
  {
    id: 'certificate-config',
    title: 'Personnalisez vos documents',
    description: 'Ajoutez votre logo, signature et cachet pour les certificats et attestations officiels.',
    action: {
      label: 'Voir la configuration',
      element: '[data-tour="certificate-config"]',
    },
  },
  {
    id: 'integrations',
    title: 'Connectez vos outils',
    description: 'Intégrez Slack, Teams, Asana et autres applications pour synchroniser vos données RH.',
    action: {
      label: 'Voir les intégrations',
      element: '[data-tour="integrations"]',
    },
  },
];

/**
 * Suggestions pour My-space > Offres internes
 */
export const internalJobsTips: PageTip[] = [
  {
    id: 'browse-jobs',
    title: 'Explorez les opportunités internes',
    description: 'Consultez les postes ouverts dans votre organisation et postulez directement depuis cette page.',
    action: {
      label: 'Voir les offres',
      element: '[data-tour="jobs-list"]',
    },
  },
  {
    id: 'my-applications',
    title: 'Suivez vos candidatures',
    description: 'Retrouvez l\'état de toutes vos candidatures : en cours, acceptées ou refusées.',
    action: {
      label: 'Voir mes candidatures',
      element: '[data-tour="applications-tab"]',
    },
  },
  {
    id: 'apply-job',
    title: 'Postulez en un clic',
    description: 'Ajoutez une lettre de motivation personnalisée et postulez directement en ligne.',
  },
];

/**
 * Suggestions pour My-space > Mes objectifs
 */
export const objectivesTips: PageTip[] = [
  {
    id: 'view-objectives',
    title: 'Visualisez vos objectifs',
    description: 'Consultez vos objectifs personnels et ceux de votre département pour l\'année en cours.',
    action: {
      label: 'Voir mes objectifs',
      element: '[data-tour="objectives-list"]',
    },
  },
  {
    id: 'update-progress',
    title: 'Mettez à jour votre progression',
    description: 'Suivez vos key results et actualisez régulièrement vos indicateurs pour mesurer votre avancement.',
    action: {
      label: 'Voir les indicateurs',
      element: '[data-tour="key-results"]',
    },
  },
  {
    id: 'align-team',
    title: 'Alignez-vous avec votre équipe',
    description: 'Vos objectifs individuels sont alignés avec ceux de votre département et de l\'entreprise.',
  },
];

/**
 * Suggestions pour My-space > Ma carrière
 */
export const careerTips: PageTip[] = [
  {
    id: 'career-path',
    title: 'Découvrez votre parcours de carrière',
    description: 'Consultez les étapes de progression définies pour votre poste et les compétences à développer.',
    action: {
      label: 'Voir mon parcours',
      element: '[data-tour="career-path"]',
    },
  },
  {
    id: 'skills-gap',
    title: 'Identifiez vos axes de développement',
    description: 'Comparez vos compétences actuelles avec celles requises pour évoluer vers le niveau supérieur.',
    action: {
      label: 'Voir l\'analyse',
      element: '[data-tour="skills-analysis"]',
    },
  },
  {
    id: 'next-steps',
    title: 'Planifiez votre évolution',
    description: 'Travaillez avec votre manager pour définir un plan d\'action concret vers votre prochaine promotion.',
  },
];

/**
 * Suggestions pour My-space > Mon équipe
 */
export const teamTips: PageTip[] = [
  {
    id: 'team-overview',
    title: 'Vue d\'ensemble de votre équipe',
    description: 'Consultez les informations de vos collaborateurs directs : contacts, performances et objectifs.',
    action: {
      label: 'Voir l\'équipe',
      element: '[data-tour="team-list"]',
    },
  },
  {
    id: 'team-performance',
    title: 'Suivez les performances',
    description: 'Accédez aux indicateurs clés de votre équipe : objectifs, évaluations et formations en cours.',
    action: {
      label: 'Voir les indicateurs',
      element: '[data-tour="team-stats"]',
    },
  },
  {
    id: 'team-actions',
    title: 'Actions rapides',
    description: 'Validez les congés, assignez des tâches ou planifiez des entretiens individuels depuis cette page.',
  },
];

/**
 * Suggestions pour My-space > Mon calendrier
 */
export const calendarTips: PageTip[] = [
  {
    id: 'view-calendar',
    title: 'Votre agenda centralisé',
    description: 'Retrouvez tous vos événements : congés, formations, entretiens et réunions importantes.',
    action: {
      label: 'Voir le calendrier',
      element: '[data-tour="calendar-view"]',
    },
  },
  {
    id: 'add-event',
    title: 'Ajoutez des événements',
    description: 'Planifiez vos entretiens individuels, vos formations ou bloquez du temps pour des projets spécifiques.',
    action: {
      label: 'Voir le bouton',
      element: '[data-tour="add-event"]',
    },
  },
  {
    id: 'sync-calendar',
    title: 'Synchronisez vos outils',
    description: 'Exportez votre calendrier vers Outlook, Google Calendar ou d\'autres applications.',
  },
];

/**
 * Suggestions pour My-space > Mes congés
 */
export const myLeavesTips: PageTip[] = [
  {
    id: 'request-leave',
    title: 'Demandez vos congés',
    description: 'Créez une nouvelle demande de congé en quelques clics et suivez son statut en temps réel.',
    action: {
      label: 'Nouvelle demande',
      element: '[data-tour="request-leave"]',
    },
  },
  {
    id: 'leave-balance',
    title: 'Consultez vos soldes',
    description: 'Visualisez vos jours de congés disponibles par type : payés, maladie, RTT, etc.',
    action: {
      label: 'Voir les soldes',
      element: '[data-tour="leave-balance"]',
    },
  },
  {
    id: 'leave-history',
    title: 'Historique de vos absences',
    description: 'Retrouvez toutes vos demandes passées et planifiées pour mieux organiser votre année.',
  },
];

/**
 * Suggestions pour My-space > Mes documents
 */
export const documentsTips: PageTip[] = [
  {
    id: 'access-documents',
    title: 'Accédez à vos documents RH',
    description: 'Consultez vos fiches de paie, certificats de travail et autres documents administratifs.',
    action: {
      label: 'Voir les documents',
      element: '[data-tour="documents-list"]',
    },
  },
  {
    id: 'request-certificate',
    title: 'Demandez un certificat',
    description: 'Générez instantanément un certificat de travail ou une attestation d\'emploi.',
    action: {
      label: 'Demander',
      element: '[data-tour="request-certificate"]',
    },
  },
  {
    id: 'upload-docs',
    title: 'Téléversez vos documents',
    description: 'Ajoutez vos diplômes, certifications ou autres pièces justificatives à votre dossier.',
  },
];

/**
 * Suggestions pour My-space > Mes tâches
 */
export const tasksTips: PageTip[] = [
  {
    id: 'view-tasks',
    title: 'Gérez vos tâches',
    description: 'Visualisez toutes vos tâches assignées : objectifs, formations, onboarding et projets.',
    action: {
      label: 'Voir les tâches',
      element: '[data-tour="tasks-list"]',
    },
  },
  {
    id: 'task-priority',
    title: 'Priorisez votre travail',
    description: 'Filtrez par priorité ou deadline pour vous concentrer sur ce qui est urgent.',
    action: {
      label: 'Voir les filtres',
      element: '[data-tour="task-filters"]',
    },
  },
  {
    id: 'complete-tasks',
    title: 'Marquez comme complété',
    description: 'Cochez vos tâches terminées pour suivre votre progression et informer votre équipe.',
  },
];

/**
 * Suggestions pour Talents > Dashboard (RH)
 */
export const talentsDashboardTips: PageTip[] = [
  {
    id: 'talent-overview',
    title: 'Vue d\'ensemble des talents',
    description: 'Consultez les KPIs de votre vivier de talents : évaluations 9-Box, hauts potentiels et plans de succession.',
    action: {
      label: 'Voir les indicateurs',
      element: '[data-tour="talent-stats"]',
    },
  },
  {
    id: 'ninebox-distribution',
    title: 'Distribution 9-Box',
    description: 'Analysez la répartition de vos talents selon leur performance et leur potentiel.',
    action: {
      label: 'Voir la matrice',
      element: '[data-tour="ninebox-chart"]',
    },
  },
  {
    id: 'succession-planning',
    title: 'Planification de la succession',
    description: 'Identifiez les postes critiques et préparez vos successeurs pour assurer la continuité.',
  },
];

/**
 * Suggestions pour Talents > Promotions
 */
export const promotionsTips: PageTip[] = [
  {
    id: 'manage-promotions',
    title: 'Gérez les promotions',
    description: 'Validez ou créez des promotions pour récompenser les performances exceptionnelles.',
    action: {
      label: 'Voir les promotions',
      element: '[data-tour="promotions-list"]',
    },
  },
  {
    id: 'eligibility-criteria',
    title: 'Critères d\'éligibilité',
    description: 'Consultez les employés éligibles selon l\'ancienneté, la performance et les compétences.',
    action: {
      label: 'Voir les critères',
      element: '[data-tour="eligibility-filters"]',
    },
  },
  {
    id: 'promotion-impact',
    title: 'Analysez l\'impact',
    description: 'Visualisez l\'impact budgétaire et organisationnel des promotions planifiées.',
  },
];

/**
 * Suggestions pour Talents > Employés
 */
export const talentsEmployeesTips: PageTip[] = [
  {
    id: 'talent-profiles',
    title: 'Fiches talents',
    description: 'Accédez aux profils détaillés : évaluations, compétences, formations et parcours de carrière.',
    action: {
      label: 'Voir les profils',
      element: '[data-tour="talent-list"]',
    },
  },
  {
    id: 'talent-filters',
    title: 'Filtrez par critères',
    description: 'Recherchez des talents selon la performance, le potentiel, les compétences ou le département.',
    action: {
      label: 'Voir les filtres',
      element: '[data-tour="talent-filters"]',
    },
  },
  {
    id: 'talent-actions',
    title: 'Actions RH',
    description: 'Assignez des formations, planifiez des promotions ou créez des plans de développement.',
  },
];

/**
 * Suggestions pour Talents > Mon équipe (Manager)
 */
export const talentsTeamTips: PageTip[] = [
  {
    id: 'team-talents',
    title: 'Talents de votre équipe',
    description: 'Évaluez et développez les talents de vos collaborateurs directs.',
    action: {
      label: 'Voir l\'équipe',
      element: '[data-tour="team-talents"]',
    },
  },
  {
    id: 'performance-matrix',
    title: 'Matrice de performance',
    description: 'Positionnez vos collaborateurs dans la 9-Box pour identifier les hauts potentiels.',
    action: {
      label: 'Voir la matrice',
      element: '[data-tour="performance-matrix"]',
    },
  },
  {
    id: 'development-plans',
    title: 'Plans de développement',
    description: 'Créez des plans personnalisés pour faire évoluer chaque membre de votre équipe.',
  },
];

/**
 * Suggestions pour Talents > Parcours
 */
export const pathsTips: PageTip[] = [
  {
    id: 'career-paths',
    title: 'Parcours de carrière',
    description: 'Définissez les parcours d\'évolution pour chaque famille de métiers de votre organisation.',
    action: {
      label: 'Voir les parcours',
      element: '[data-tour="paths-list"]',
    },
  },
  {
    id: 'create-path',
    title: 'Créez un nouveau parcours',
    description: 'Structurez les étapes de progression avec les compétences et formations requises.',
    action: {
      label: 'Créer un parcours',
      element: '[data-tour="create-path"]',
    },
  },
  {
    id: 'assign-employees',
    title: 'Assignez des collaborateurs',
    description: 'Associez vos employés aux parcours correspondant à leur poste et ambitions.',
  },
];

/**
 * Suggestions pour Talents > Ma carrière (Employé)
 */
export const myCareerTips: PageTip[] = [
  {
    id: 'my-position',
    title: 'Ma position actuelle',
    description: 'Consultez votre évaluation 9-Box et vos performances récentes.',
    action: {
      label: 'Voir mon évaluation',
      element: '[data-tour="my-evaluation"]',
    },
  },
  {
    id: 'development-plan',
    title: 'Mon plan de développement',
    description: 'Découvrez les compétences à acquérir et les formations recommandées pour progresser.',
    action: {
      label: 'Voir le plan',
      element: '[data-tour="development-plan"]',
    },
  },
  {
    id: 'next-level',
    title: 'Prochaine étape',
    description: 'Visualisez les opportunités d\'évolution et les prérequis pour accéder au niveau suivant.',
  },
];

/**
 * Suggestions pour Talents > Mes promotions (Employé)
 */
export const myPromotionsTips: PageTip[] = [
  {
    id: 'promotion-status',
    title: 'Statut de vos promotions',
    description: 'Suivez l\'état de vos demandes de promotion en cours et leur progression.',
    action: {
      label: 'Voir le statut',
      element: '[data-tour="promotion-status"]',
    },
  },
  {
    id: 'eligibility-check',
    title: 'Vérifiez votre éligibilité',
    description: 'Consultez les critères requis et votre niveau d\'adéquation pour une promotion.',
    action: {
      label: 'Voir les critères',
      element: '[data-tour="eligibility-criteria"]',
    },
  },
  {
    id: 'promotion-history',
    title: 'Historique de carrière',
    description: 'Retrouvez toutes vos promotions passées et les évolutions de votre poste.',
  },
];

/**
 * Suggestions pour Performance (v1)
 */
export const performance1Tips: PageTip[] = [
  {
    id: 'performance-overview',
    title: 'Tableau de bord performance',
    description: 'Suivez les évaluations de performance de votre organisation en temps réel.',
    action: {
      label: 'Voir les indicateurs',
      element: '[data-tour="performance-stats"]',
    },
  },
  {
    id: 'evaluations',
    title: 'Campagnes d\'évaluation',
    description: 'Lancez et gérez vos campagnes d\'évaluation annuelles ou trimestrielles.',
    action: {
      label: 'Voir les campagnes',
      element: '[data-tour="evaluation-campaigns"]',
    },
  },
  {
    id: 'feedback-360',
    title: 'Feedback 360°',
    description: 'Collectez des retours multi-sources pour une évaluation complète de vos collaborateurs.',
  },
];

export const platformAdminTips: PageTip[] = [
  {
    id: 'platform-overview',
    title: 'Vue d\'ensemble Plateforme',
    description: 'Ce dashboard affiche les statistiques globales de tous les tenants : nombre d\'entreprises, utilisateurs actifs et abonnements.',
  },
  {
    id: 'platform-tenants',
    title: 'Liste des Tenants',
    description: 'Chaque ligne représente une entreprise cliente. Vous pouvez voir leur plan d\'abonnement, le nombre d\'utilisateurs et leur statut.',
  },
  {
    id: 'platform-search',
    title: 'Recherche & Filtres',
    description: 'Utilisez la barre de recherche pour trouver un tenant par nom, et filtrez par plan ou statut.',
  },
];

export const platformAdminUsersTips: PageTip[] = [
  {
    id: 'users-overview',
    title: 'Gestion des Utilisateurs Plateforme',
    description: 'Cette page liste tous les utilisateurs de la plateforme, toutes entreprises confondues.',
  },
  {
    id: 'users-create',
    title: 'Créer un utilisateur',
    description: 'Cliquez sur "Nouvel Utilisateur" pour créer un compte. Vous pouvez lui assigner un rôle et un tenant (entreprise).',
  },
  {
    id: 'users-roles',
    title: 'Rôles & Permissions',
    description: 'SUPER_ADMIN a accès à tout. Les autres rôles (admin, rh, manager, employee) sont limités à leur tenant.',
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
    analytics: analyticsTips,
    certificates: certificatesTips,
    missions: missionsTips,
    mySpace: mySpaceTips,
    notifications: notificationsTips,
    onboarding: onboardingTips,
    settings: settingsTips,
    // My-space pages
    internalJobs: internalJobsTips,
    objectives: objectivesTips,
    career: careerTips,
    team: teamTips,
    calendar: calendarTips,
    myLeaves: myLeavesTips,
    documents: documentsTips,
    tasks: tasksTips,
    // Talents pages
    talentsDashboard: talentsDashboardTips,
    promotions: promotionsTips,
    talentsEmployees: talentsEmployeesTips,
    talentsTeam: talentsTeamTips,
    paths: pathsTips,
    platformAdmin: platformAdminTips,
    platformAdminUsers: platformAdminUsersTips,
    myCareer: myCareerTips,
    myPromotions: myPromotionsTips,
    // Others
    performance1: performance1Tips,
  };

  return tipsMap[pageId] || [];
}
