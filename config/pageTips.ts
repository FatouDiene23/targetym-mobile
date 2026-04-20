// ============================================================
// PAGE TIPS — multi-locale content
// Each tip contains FR / EN / PT text. CSS selectors are locale-independent.
// ============================================================

export interface PageTip {
  id: string;
  title: string;
  description: string;
  action?: {
    label: string;
    element: string; // CSS selector
  };
}

type LocaleText = { title: string; description: string; actionLabel?: string };
type LocaleTip = { id: string; element?: string; fr: LocaleText; en: LocaleText; pt: LocaleText };
type PageTipsLocales = Record<string, LocaleTip[]>;

const pageTipsLocales: PageTipsLocales = {
  dashboard: [
    {
      id: 'welcome-card', element: '[data-tour="welcome"]',
      fr: { title: 'Bienvenue sur votre tableau de bord ! 🎯', description: 'Voici votre hub central. Vous trouverez ici un résumé de vos indicateurs clés, tâches à venir et notifications importantes.', actionLabel: 'Voir la carte de bienvenue' },
      en: { title: 'Welcome to your dashboard! 🎯', description: 'This is your central hub. Find a summary of your key metrics, upcoming tasks, and important notifications here.', actionLabel: 'View the welcome card' },
      pt: { title: 'Bem-vindo ao seu painel! 🎯', description: 'Este é o seu hub central. Encontre aqui um resumo dos seus indicadores-chave, tarefas pendentes e notificações importantes.', actionLabel: 'Ver o cartão de boas-vindas' },
    },
    {
      id: 'quick-actions', element: '[data-tour="quick-actions"]',
      fr: { title: 'Actions rapides à portée de main', description: 'Accédez rapidement aux actions les plus courantes : demander un congé, consulter vos objectifs, ou gérer votre équipe.', actionLabel: 'Voir les actions rapides' },
      en: { title: 'Quick actions at your fingertips', description: 'Quickly access the most common actions: request leave, view your objectives, or manage your team.', actionLabel: 'View quick actions' },
      pt: { title: 'Ações rápidas ao seu alcance', description: 'Acesse rapidamente as ações mais comuns: solicitar férias, consultar seus objetivos ou gerenciar sua equipe.', actionLabel: 'Ver ações rápidas' },
    },
    {
      id: 'notifications', element: '[data-tour="notifications"]',
      fr: { title: 'Restez informé en temps réel', description: "Cliquez sur l'icône de cloche pour voir vos notifications : validations en attente, nouvelles tâches, et messages importants.", actionLabel: 'Voir les notifications' },
      en: { title: 'Stay informed in real time', description: 'Click the bell icon to see your notifications: pending approvals, new tasks, and important messages.', actionLabel: 'View notifications' },
      pt: { title: 'Fique informado em tempo real', description: 'Clique no ícone de sino para ver suas notificações: aprovações pendentes, novas tarefas e mensagens importantes.', actionLabel: 'Ver notificações' },
    },
  ],
  employees: [
    {
      id: 'add-employee',
      fr: { title: 'Ajouter votre premier employé', description: "Commencez par ajouter les informations de vos collaborateurs. Vous pourrez ensuite gérer leurs congés, performances et parcours de carrière." },
      en: { title: 'Add your first employee', description: "Start by adding your team members' information. You can then manage their leave, performance, and career paths." },
      pt: { title: 'Adicionar seu primeiro funcionário', description: 'Comece adicionando as informações dos seus colaboradores. Você poderá gerenciar férias, desempenho e planos de carreira.' },
    },
    {
      id: 'export-data',
      fr: { title: 'Exporter vos données', description: 'Besoin de partager ou analyser vos données ? Exportez la liste complète en Excel ou CSV en utilisant le bouton "Exporter" en haut de la page.' },
      en: { title: 'Export your data', description: 'Need to share or analyse your data? Export the full list in Excel or CSV using the "Export" button at the top of the page.' },
      pt: { title: 'Exportar seus dados', description: 'Precisa compartilhar ou analisar seus dados? Exporte a lista completa em Excel ou CSV usando o botão "Exportar" no topo da página.' },
    },
    {
      id: 'filters',
      fr: { title: 'Filtrer et rechercher', description: 'Utilisez les filtres pour trouver rapidement des employés par département, statut ou poste. La barre de recherche permet de chercher par nom.' },
      en: { title: 'Filter and search', description: 'Use filters to quickly find employees by department, status, or position. The search bar lets you search by name.' },
      pt: { title: 'Filtrar e pesquisar', description: 'Use os filtros para encontrar rapidamente funcionários por departamento, status ou cargo. A barra de pesquisa permite buscar por nome.' },
    },
  ],
  okr: [
    {
      id: 'create-okr', element: '[data-tour="create-okr"]',
      fr: { title: 'Créez votre premier objectif', description: "Les OKR (Objectives and Key Results) vous aident à définir et suivre vos objectifs stratégiques. Commencez par créer un objectif aligné avec la vision de votre organisation.", actionLabel: 'Voir le bouton Nouvel OKR' },
      en: { title: 'Create your first objective', description: "OKRs (Objectives and Key Results) help you define and track your strategic goals. Start by creating an objective aligned with your organisation's vision.", actionLabel: 'View the New OKR button' },
      pt: { title: 'Criar seu primeiro objetivo', description: 'Os OKRs (Objectives and Key Results) ajudam a definir e acompanhar seus objetivos estratégicos. Comece criando um objetivo alinhado com a visão da sua organização.', actionLabel: 'Ver o botão Novo OKR' },
    },
    {
      id: 'track-progress', element: '[data-tour="okr-progress"]',
      fr: { title: 'Suivez la progression', description: 'Mettez régulièrement à jour le pourcentage de complétion de vos objectifs pour visualiser votre avancement.', actionLabel: 'Voir la progression' },
      en: { title: 'Track progress', description: 'Regularly update the completion percentage of your objectives to visualise your progress.', actionLabel: 'View progress' },
      pt: { title: 'Acompanhar o progresso', description: 'Atualize regularmente a porcentagem de conclusão dos seus objetivos para visualizar seu avanço.', actionLabel: 'Ver o progresso' },
    },
    {
      id: 'team-alignment', element: '[data-tour="okr-tabs"]',
      fr: { title: 'Alignez votre équipe', description: "Invitez les membres de votre équipe à créer leurs propres OKR alignés avec les objectifs de l'organisation.", actionLabel: 'Voir les onglets' },
      en: { title: 'Align your team', description: "Invite your team members to create their own OKRs aligned with the organisation's objectives.", actionLabel: 'View tabs' },
      pt: { title: 'Alinhar sua equipe', description: 'Convide os membros da sua equipe a criar seus próprios OKRs alinhados com os objetivos da organização.', actionLabel: 'Ver abas' },
    },
  ],
  recruitment: [
    {
      id: 'create-job', element: '[data-tour="create-job"]',
      fr: { title: "Publier une offre d'emploi", description: "Créez votre première offre d'emploi en quelques clics. Définissez le poste, les compétences requises et le processus de sélection.", actionLabel: 'Voir le bouton Nouvelle Offre' },
      en: { title: 'Post a job offer', description: 'Create your first job posting in a few clicks. Define the position, required skills, and selection process.', actionLabel: 'View the New Offer button' },
      pt: { title: 'Publicar uma oferta de emprego', description: 'Crie sua primeira oferta de emprego em poucos cliques. Defina o cargo, as competências necessárias e o processo de seleção.', actionLabel: 'Ver o botão Nova Oferta' },
    },
    {
      id: 'manage-candidates', element: '[data-tour="recruitment-stats"]',
      fr: { title: 'Gérer les candidatures', description: 'Suivez le parcours de chaque candidat à travers les différentes étapes : présélection, entretiens, décision finale.', actionLabel: 'Voir les statistiques' },
      en: { title: 'Manage applications', description: "Track each candidate's journey through the different stages: pre-screening, interviews, final decision.", actionLabel: 'View statistics' },
      pt: { title: 'Gerenciar candidaturas', description: 'Acompanhe o percurso de cada candidato pelas diferentes etapas: pré-seleção, entrevistas, decisão final.', actionLabel: 'Ver estatísticas' },
    },
    {
      id: 'pipeline', element: '[data-tour="recruitment-stats"]',
      fr: { title: 'Visualisez votre pipeline', description: 'Utilisez la vue en pipeline pour avoir une vision globale de tous vos recrutements en cours.', actionLabel: 'Voir les statistiques' },
      en: { title: 'Visualise your pipeline', description: 'Use the pipeline view for a global overview of all your ongoing recruitment processes.', actionLabel: 'View statistics' },
      pt: { title: 'Visualizar seu pipeline', description: 'Use a visão de pipeline para ter uma visão global de todos os seus processos de recrutamento em andamento.', actionLabel: 'Ver estatísticas' },
    },
  ],
  performance: [
    {
      id: 'create-campaign', element: '[data-tour="performance-stats"]',
      fr: { title: "Lancer une campagne d'évaluation", description: "Créez une campagne pour évaluer les performances de votre équipe sur une période définie.", actionLabel: 'Voir les statistiques' },
      en: { title: 'Launch an evaluation campaign', description: "Create a campaign to evaluate your team's performance over a defined period.", actionLabel: 'View statistics' },
      pt: { title: 'Lançar uma campanha de avaliação', description: 'Crie uma campanha para avaliar o desempenho da sua equipe em um período definido.', actionLabel: 'Ver estatísticas' },
    },
    {
      id: 'continuous-feedback', element: '[data-tour="feedback-tabs"]',
      fr: { title: 'Donnez du feedback continu', description: "Ne attendez pas l'évaluation annuelle ! Donnez du feedback régulièrement pour accompagner vos collaborateurs.", actionLabel: 'Voir les onglets' },
      en: { title: 'Give continuous feedback', description: "Don't wait for the annual review! Give feedback regularly to support your team members.", actionLabel: 'View tabs' },
      pt: { title: 'Dar feedback contínuo', description: 'Não espere a avaliação anual! Dê feedback regularmente para apoiar seus colaboradores.', actionLabel: 'Ver abas' },
    },
    {
      id: '360-feedback', element: '[data-tour="feedback-tabs"]',
      fr: { title: 'Feedback 360°', description: "Utilisez l'évaluation 360° pour avoir une vision complète : managers, pairs et auto-évaluation.", actionLabel: 'Voir les onglets' },
      en: { title: '360° Feedback', description: 'Use 360° evaluation for a complete picture: managers, peers, and self-assessment.', actionLabel: 'View tabs' },
      pt: { title: 'Feedback 360°', description: 'Use a avaliação 360° para ter uma visão completa: gestores, pares e autoavaliação.', actionLabel: 'Ver abas' },
    },
  ],
  learning: [
    {
      id: 'browse-catalog', element: '[data-tour="learning-stats"]',
      fr: { title: 'Explorez le catalogue de formations', description: 'Découvrez toutes les formations disponibles : techniques, soft skills, certifications. Filtrez par catégorie pour trouver ce qui vous intéresse.', actionLabel: 'Voir les statistiques' },
      en: { title: 'Browse the training catalogue', description: 'Discover all available training: technical skills, soft skills, certifications. Filter by category to find what interests you.', actionLabel: 'View statistics' },
      pt: { title: 'Explorar o catálogo de treinamentos', description: 'Descubra todos os treinamentos disponíveis: técnicos, soft skills, certificações. Filtre por categoria para encontrar o que lhe interessa.', actionLabel: 'Ver estatísticas' },
    },
    {
      id: 'request-course', element: '[data-tour="request-course"]',
      fr: { title: 'Demandez une formation', description: 'Vous avez identifié un besoin ? Demandez une nouvelle formation à votre manager ou au service RH.', actionLabel: 'Voir le bouton Demander' },
      en: { title: 'Request training', description: 'Identified a need? Request a new training from your manager or the HR department.', actionLabel: 'View the Request button' },
      pt: { title: 'Solicitar treinamento', description: 'Identificou uma necessidade? Solicite um novo treinamento ao seu gestor ou ao departamento de RH.', actionLabel: 'Ver o botão Solicitar' },
    },
    {
      id: 'track-progress', element: '[data-tour="learning-filters"]',
      fr: { title: 'Suivez votre progression', description: "Consultez vos formations en cours, complétées et les certifications obtenues dans l'onglet \"Mon Apprentissage\".", actionLabel: 'Voir les filtres' },
      en: { title: 'Track your progress', description: 'View your ongoing and completed courses, and obtained certifications in the "My Learning" tab.', actionLabel: 'View filters' },
      pt: { title: 'Acompanhar seu progresso', description: 'Consulte seus cursos em andamento, concluídos e as certificações obtidas na aba "Meu Aprendizado".', actionLabel: 'Ver filtros' },
    },
  ],
  leaves: [
    {
      id: 'view-stats', element: '[data-tour="leaves-stats"]',
      fr: { title: "Vue d'ensemble des congés", description: "Consultez en un coup d'œil le nombre de demandes en attente, approuvées, et les collaborateurs absents aujourd'hui.", actionLabel: 'Voir les statistiques' },
      en: { title: 'Leave overview', description: 'See at a glance the number of pending and approved requests, and employees absent today.', actionLabel: 'View statistics' },
      pt: { title: 'Visão geral das férias', description: 'Veja rapidamente o número de solicitações pendentes, aprovadas e colaboradores ausentes hoje.', actionLabel: 'Ver estatísticas' },
    },
    {
      id: 'review-requests', element: '[data-tour="leaves-filters"]',
      fr: { title: 'Traitez les demandes', description: "Approuvez ou refusez les demandes de congés de votre équipe. Vous pouvez filtrer par statut et département.", actionLabel: 'Voir les filtres' },
      en: { title: 'Process requests', description: "Approve or reject your team's leave requests. You can filter by status and department.", actionLabel: 'View filters' },
      pt: { title: 'Processar solicitações', description: 'Aprove ou rejeite as solicitações de férias da sua equipe. Você pode filtrar por status e departamento.', actionLabel: 'Ver filtros' },
    },
    {
      id: 'calendar-view', element: '[data-tour="leaves-tabs"]',
      fr: { title: 'Visualisez le planning', description: "Utilisez le calendrier pour avoir une vue globale des absences du mois et planifier en conséquence.", actionLabel: 'Voir les onglets' },
      en: { title: 'Visualise the schedule', description: 'Use the calendar for a global view of monthly absences and plan accordingly.', actionLabel: 'View tabs' },
      pt: { title: 'Visualizar o planejamento', description: 'Use o calendário para ter uma visão global das ausências do mês e planejar adequadamente.', actionLabel: 'Ver abas' },
    },
  ],
  talents: [
    {
      id: 'ninebox-matrix', element: '[data-tour="ninebox-grid"]',
      fr: { title: 'Matrice 9-Box : Performance × Potentiel', description: "Visualisez le positionnement de vos collaborateurs selon leur performance et leur potentiel. Identifiez vos hauts potentiels et talents à développer.", actionLabel: 'Voir la matrice' },
      en: { title: '9-Box Matrix: Performance × Potential', description: "Visualise your employees' positioning by performance and potential. Identify your high-potentials and talents to develop.", actionLabel: 'View the matrix' },
      pt: { title: 'Matriz 9-Box: Desempenho × Potencial', description: 'Visualize o posicionamento dos seus colaboradores por desempenho e potencial. Identifique seus altos potenciais e talentos a desenvolver.', actionLabel: 'Ver a matriz' },
    },
    {
      id: 'filter-period', element: '[data-tour="ninebox-filters"]',
      fr: { title: 'Sélectionnez la période', description: "Comparez l'évolution des talents sur différentes périodes d'évaluation pour suivre leur progression.", actionLabel: 'Voir les filtres' },
      en: { title: 'Select the period', description: 'Compare talent evolution across different evaluation periods to track their progress.', actionLabel: 'View filters' },
      pt: { title: 'Selecionar o período', description: 'Compare a evolução dos talentos em diferentes períodos de avaliação para acompanhar seu progresso.', actionLabel: 'Ver filtros' },
    },
    {
      id: 'talent-actions', element: '[data-tour="ninebox-legend"]',
      fr: { title: 'Actions de développement', description: 'Cliquez sur un collaborateur pour voir son profil détaillé et définir des actions de développement personnalisées.', actionLabel: 'Voir la légende' },
      en: { title: 'Development actions', description: 'Click on an employee to see their detailed profile and define personalised development actions.', actionLabel: 'View legend' },
      pt: { title: 'Ações de desenvolvimento', description: 'Clique num colaborador para ver o seu perfil detalhado e definir ações de desenvolvimento personalizadas.', actionLabel: 'Ver legenda' },
    },
  ],
  analytics: [
    {
      id: 'overview-kpis', element: '[data-tour="analytics-kpis"]',
      fr: { title: "Indicateurs clés RH en un coup d'œil", description: "Consultez vos KPIs essentiels : effectifs, turnover, rétention, absentéisme. Identifiez rapidement les tendances et points d'attention.", actionLabel: 'Voir les indicateurs' },
      en: { title: 'Key HR metrics at a glance', description: 'View your essential KPIs: headcount, turnover, retention, absenteeism. Quickly spot trends and areas of concern.', actionLabel: 'View indicators' },
      pt: { title: 'Indicadores-chave de RH em um relance', description: "Consulte seus KPIs essenciais: efetivo, rotatividade, retenção, absenteísmo. Identifique rapidamente tendências e pontos de atenção.", actionLabel: 'Ver indicadores' },
    },
    {
      id: 'charts-visualization', element: '[data-tour="analytics-charts"]',
      fr: { title: 'Visualisez vos données', description: 'Explorez les graphiques interactifs pour analyser la performance, les talents, et la diversité de vos équipes.', actionLabel: 'Voir les graphiques' },
      en: { title: 'Visualise your data', description: "Explore interactive charts to analyse performance, talent, and your teams' diversity.", actionLabel: 'View charts' },
      pt: { title: 'Visualizar seus dados', description: 'Explore gráficos interativos para analisar desempenho, talentos e a diversidade das suas equipes.', actionLabel: 'Ver gráficos' },
    },
    {
      id: 'export-reports', element: '[data-tour="analytics-export"]',
      fr: { title: 'Exportez vos rapports', description: 'Téléchargez vos données en Excel ou PDF pour des présentations ou analyses approfondies.', actionLabel: 'Voir le bouton Export' },
      en: { title: 'Export your reports', description: 'Download your data in Excel or PDF for presentations or in-depth analysis.', actionLabel: 'View Export button' },
      pt: { title: 'Exportar seus relatórios', description: 'Baixe seus dados em Excel ou PDF para apresentações ou análises aprofundadas.', actionLabel: 'Ver botão Exportar' },
    },
  ],
  certificates: [
    {
      id: 'generate-doc', element: '[data-tour="employees-list"]',
      fr: { title: 'Générez des documents officiels', description: 'Créez des certificats de travail ou attestations en quelques clics. Les documents sont automatiquement conformes et signés.', actionLabel: 'Voir la liste' },
      en: { title: 'Generate official documents', description: 'Create employment certificates or attestations in a few clicks. Documents are automatically compliant and signed.', actionLabel: 'View list' },
      pt: { title: 'Gerar documentos oficiais', description: 'Crie certificados de trabalho ou atestados em poucos cliques. Os documentos são automaticamente conformes e assinados.', actionLabel: 'Ver lista' },
    },
    {
      id: 'search-employee', element: '[data-tour="certificates-search"]',
      fr: { title: "Recherchez l'employé", description: "Utilisez la recherche pour trouver rapidement le collaborateur concerné. Filtrez par statut (actif/inactif).", actionLabel: 'Voir la recherche' },
      en: { title: 'Search for the employee', description: 'Use the search to quickly find the relevant employee. Filter by status (active/inactive).', actionLabel: 'View search' },
      pt: { title: 'Pesquisar o funcionário', description: 'Use a pesquisa para encontrar rapidamente o colaborador em questão. Filtre por status (ativo/inativo).', actionLabel: 'Ver pesquisa' },
    },
    {
      id: 'view-history', element: '[data-tour="certificates-history"]',
      fr: { title: 'Historique des générations', description: 'Consultez tous les certificats générés avec leur référence unique et la date de création.', actionLabel: "Voir l'historique" },
      en: { title: 'Generation history', description: 'View all generated certificates with their unique reference and creation date.', actionLabel: 'View history' },
      pt: { title: 'Histórico de geração', description: 'Consulte todos os certificados gerados com sua referência única e data de criação.', actionLabel: 'Ver histórico' },
    },
  ],
  missions: [
    {
      id: 'create-mission', element: '[data-tour="create-mission"]',
      fr: { title: 'Créez une mission', description: 'Planifiez les déplacements professionnels : destination, dates, transport, hébergement et budget.', actionLabel: 'Voir le bouton Nouvelle Mission' },
      en: { title: 'Create a mission', description: 'Plan business trips: destination, dates, transport, accommodation, and budget.', actionLabel: 'View the New Mission button' },
      pt: { title: 'Criar uma missão', description: 'Planeje viagens de negócios: destino, datas, transporte, hospedagem e orçamento.', actionLabel: 'Ver o botão Nova Missão' },
    },
    {
      id: 'track-status', element: '[data-tour="missions-stats"]',
      fr: { title: 'Suivez les validations', description: 'Les missions passent par plusieurs étapes : validation manager, validation RH, exécution, et clôture avec rapport.', actionLabel: 'Voir les statistiques' },
      en: { title: 'Track validations', description: 'Missions go through several stages: manager approval, HR approval, execution, and closure with report.', actionLabel: 'View statistics' },
      pt: { title: 'Acompanhar as validações', description: 'As missões passam por várias etapas: validação do gestor, validação de RH, execução e encerramento com relatório.', actionLabel: 'Ver estatísticas' },
    },
    {
      id: 'manage-expenses', element: '[data-tour="missions-filters"]',
      fr: { title: 'Gérez les frais', description: 'Ajoutez les dépenses avec justificatifs, suivez les remboursements et exportez les rapports de frais.', actionLabel: 'Voir les filtres' },
      en: { title: 'Manage expenses', description: 'Add expenses with receipts, track reimbursements, and export expense reports.', actionLabel: 'View filters' },
      pt: { title: 'Gerenciar despesas', description: 'Adicione despesas com comprovantes, acompanhe os reembolsos e exporte relatórios de despesas.', actionLabel: 'Ver filtros' },
    },
  ],
  mySpace: [
    {
      id: 'edit-profile', element: '[data-tour="profile-section"]',
      fr: { title: 'Gérez votre profil', description: 'Consultez et mettez à jour vos informations personnelles : coordonnées, poste, département.', actionLabel: 'Voir le profil' },
      en: { title: 'Manage your profile', description: 'View and update your personal information: contact details, position, department.', actionLabel: 'View profile' },
      pt: { title: 'Gerenciar seu perfil', description: 'Consulte e atualize suas informações pessoais: contatos, cargo, departamento.', actionLabel: 'Ver perfil' },
    },
    {
      id: 'add-signature', element: '[data-tour="signature-section"]',
      fr: { title: 'Ajoutez votre signature', description: 'Créez votre signature électronique pour valider les documents et missions en toute sécurité.', actionLabel: 'Voir la signature' },
      en: { title: 'Add your signature', description: 'Create your electronic signature to securely validate documents and missions.', actionLabel: 'View signature' },
      pt: { title: 'Adicionar sua assinatura', description: 'Crie sua assinatura eletrônica para validar documentos e missões com segurança.', actionLabel: 'Ver assinatura' },
    },
    {
      id: 'view-org-chart', element: '[data-tour="org-chart"]',
      fr: { title: 'Organigramme personnel', description: "Visualisez votre position dans l'organisation et votre chaîne hiérarchique.", actionLabel: "Voir l'organigramme" },
      en: { title: 'Personal org chart', description: 'Visualise your position in the organisation and your reporting chain.', actionLabel: 'View org chart' },
      pt: { title: 'Organograma pessoal', description: 'Visualize sua posição na organização e sua cadeia hierárquica.', actionLabel: 'Ver organograma' },
    },
  ],
  notifications: [
    {
      id: 'view-notifications', element: '[data-tour="notifications-list"]',
      fr: { title: 'Toutes vos notifications', description: 'Recevez les alertes importantes : validations, tâches, rappels, onboarding, congés et missions.', actionLabel: 'Voir les notifications' },
      en: { title: 'All your notifications', description: 'Receive important alerts: approvals, tasks, reminders, onboarding, leave, and missions.', actionLabel: 'View notifications' },
      pt: { title: 'Todas as suas notificações', description: 'Receba alertas importantes: validações, tarefas, lembretes, onboarding, férias e missões.', actionLabel: 'Ver notificações' },
    },
    {
      id: 'filter-type', element: '[data-tour="notifications-filters"]',
      fr: { title: 'Filtrez par type', description: 'Affichez uniquement les notifications qui vous intéressent : non lues, urgentes, ou par catégorie.', actionLabel: 'Voir les filtres' },
      en: { title: 'Filter by type', description: 'Show only the notifications that matter to you: unread, urgent, or by category.', actionLabel: 'View filters' },
      pt: { title: 'Filtrar por tipo', description: 'Exiba apenas as notificações que lhe interessam: não lidas, urgentes ou por categoria.', actionLabel: 'Ver filtros' },
    },
    {
      id: 'mark-as-read', element: '[data-tour="notifications-actions"]',
      fr: { title: 'Marquez comme lues', description: 'Gardez votre centre de notifications organisé en marquant les messages traités comme lus.', actionLabel: 'Voir les actions' },
      en: { title: 'Mark as read', description: 'Keep your notification centre organised by marking processed messages as read.', actionLabel: 'View actions' },
      pt: { title: 'Marcar como lida', description: 'Mantenha seu centro de notificações organizado marcando as mensagens processadas como lidas.', actionLabel: 'Ver ações' },
    },
  ],
  onboarding: [
    {
      id: 'create-program', element: '[data-tour="onboarding-programs"]',
      fr: { title: "Créez un programme d'onboarding", description: "Définissez un parcours d'intégration personnalisé avec des tâches, formations et rencontres planifiées.", actionLabel: 'Voir les programmes' },
      en: { title: 'Create an onboarding programme', description: 'Define a personalised integration journey with planned tasks, training, and meetings.', actionLabel: 'View programmes' },
      pt: { title: 'Criar um programa de onboarding', description: 'Defina um percurso de integração personalizado com tarefas, treinamentos e reuniões planejadas.', actionLabel: 'Ver programas' },
    },
    {
      id: 'track-progress', element: '[data-tour="onboarding-stats"]',
      fr: { title: 'Suivez la progression', description: "Visualisez l'avancement de chaque nouvel arrivant : tâches complétées, rencontres effectuées, délais.", actionLabel: 'Voir les statistiques' },
      en: { title: 'Track progress', description: "Visualise each new arrival's progress: completed tasks, meetings held, deadlines.", actionLabel: 'View statistics' },
      pt: { title: 'Acompanhar o progresso', description: 'Visualize o avanço de cada novo colaborador: tarefas concluídas, reuniões realizadas, prazos.', actionLabel: 'Ver estatísticas' },
    },
    {
      id: 'get-to-know', element: '[data-tour="onboarding-meetings"]',
      fr: { title: 'Planifiez les rencontres', description: "Organisez des \"Get to Know\" pour faciliter l'intégration et créer des liens entre collaborateurs.", actionLabel: 'Voir les rencontres' },
      en: { title: 'Schedule meetings', description: '"Get to Know" meetings facilitate integration and build connections among team members.', actionLabel: 'View meetings' },
      pt: { title: 'Planejar reuniões', description: 'Organize reuniões de "Get to Know" para facilitar a integração e criar laços entre colaboradores.', actionLabel: 'Ver reuniões' },
    },
  ],
  settings: [
    {
      id: 'company-info', element: '[data-tour="settings-tabs"]',
      fr: { title: "Informations de l'entreprise", description: "Configurez les données de votre organisation : nom, adresse, contact, logo.", actionLabel: 'Voir les paramètres' },
      en: { title: 'Company information', description: "Configure your organisation's data: name, address, contact, logo.", actionLabel: 'View settings' },
      pt: { title: 'Informações da empresa', description: 'Configure os dados da sua organização: nome, endereço, contato, logotipo.', actionLabel: 'Ver configurações' },
    },
    {
      id: 'certificate-config', element: '[data-tour="certificate-config"]',
      fr: { title: 'Personnalisez vos documents', description: 'Ajoutez votre logo, signature et cachet pour les certificats et attestations officiels.', actionLabel: 'Voir la configuration' },
      en: { title: 'Customise your documents', description: 'Add your logo, signature, and stamp for official certificates and attestations.', actionLabel: 'View configuration' },
      pt: { title: 'Personalizar seus documentos', description: 'Adicione seu logotipo, assinatura e carimbo para certificados e atestados oficiais.', actionLabel: 'Ver configuração' },
    },
    {
      id: 'integrations', element: '[data-tour="integrations"]',
      fr: { title: 'Connectez vos outils', description: 'Intégrez Slack, Teams, Asana et autres applications pour synchroniser vos données RH.', actionLabel: 'Voir les intégrations' },
      en: { title: 'Connect your tools', description: 'Integrate Slack, Teams, Asana, and other apps to sync your HR data.', actionLabel: 'View integrations' },
      pt: { title: 'Conectar suas ferramentas', description: 'Integre Slack, Teams, Asana e outros aplicativos para sincronizar seus dados de RH.', actionLabel: 'Ver integrações' },
    },
  ],
  internalJobs: [
    {
      id: 'browse-jobs', element: '[data-tour="jobs-list"]',
      fr: { title: 'Explorez les opportunités internes', description: 'Consultez les postes ouverts dans votre organisation et postulez directement depuis cette page.', actionLabel: 'Voir les offres' },
      en: { title: 'Explore internal opportunities', description: 'View open positions in your organisation and apply directly from this page.', actionLabel: 'View offers' },
      pt: { title: 'Explorar oportunidades internas', description: 'Consulte os cargos abertos na sua organização e candidate-se diretamente desta página.', actionLabel: 'Ver ofertas' },
    },
    {
      id: 'my-applications', element: '[data-tour="applications-tab"]',
      fr: { title: 'Suivez vos candidatures', description: "Retrouvez l'état de toutes vos candidatures : en cours, acceptées ou refusées.", actionLabel: 'Voir mes candidatures' },
      en: { title: 'Track your applications', description: 'Find the status of all your applications: in progress, accepted, or rejected.', actionLabel: 'View my applications' },
      pt: { title: 'Acompanhar suas candidaturas', description: 'Encontre o status de todas as suas candidaturas: em andamento, aceitas ou recusadas.', actionLabel: 'Ver minhas candidaturas' },
    },
    {
      id: 'apply-job',
      fr: { title: 'Postulez en un clic', description: 'Ajoutez une lettre de motivation personnalisée et postulez directement en ligne.' },
      en: { title: 'Apply with one click', description: 'Add a personalised cover letter and apply directly online.' },
      pt: { title: 'Candidatar-se em um clique', description: 'Adicione uma carta de apresentação personalizada e candidate-se diretamente online.' },
    },
  ],
  objectives: [
    {
      id: 'view-objectives', element: '[data-tour="objectives-list"]',
      fr: { title: 'Visualisez vos objectifs', description: "Consultez vos objectifs personnels et ceux de votre département pour l'année en cours.", actionLabel: 'Voir mes objectifs' },
      en: { title: 'View your objectives', description: 'View your personal objectives and those of your department for the current year.', actionLabel: 'View my objectives' },
      pt: { title: 'Visualizar seus objetivos', description: 'Consulte seus objetivos pessoais e os do seu departamento para o ano corrente.', actionLabel: 'Ver meus objetivos' },
    },
    {
      id: 'update-progress', element: '[data-tour="key-results"]',
      fr: { title: 'Mettez à jour votre progression', description: 'Suivez vos key results et actualisez régulièrement vos indicateurs pour mesurer votre avancement.', actionLabel: 'Voir les indicateurs' },
      en: { title: 'Update your progress', description: 'Track your key results and regularly update your indicators to measure your progress.', actionLabel: 'View indicators' },
      pt: { title: 'Atualizar seu progresso', description: 'Acompanhe seus resultados-chave e atualize regularmente seus indicadores para medir seu avanço.', actionLabel: 'Ver indicadores' },
    },
    {
      id: 'align-team',
      fr: { title: 'Alignez-vous avec votre équipe', description: "Vos objectifs individuels sont alignés avec ceux de votre département et de l'entreprise." },
      en: { title: 'Align with your team', description: 'Your individual objectives are aligned with those of your department and the company.' },
      pt: { title: 'Alinhar-se com sua equipe', description: 'Seus objetivos individuais estão alinhados com os do seu departamento e da empresa.' },
    },
  ],
  career: [
    {
      id: 'career-path', element: '[data-tour="career-path"]',
      fr: { title: 'Découvrez votre parcours de carrière', description: 'Consultez les étapes de progression définies pour votre poste et les compétences à développer.', actionLabel: 'Voir mon parcours' },
      en: { title: 'Discover your career path', description: 'View the progression stages defined for your position and the skills to develop.', actionLabel: 'View my path' },
      pt: { title: 'Descobrir seu caminho de carreira', description: 'Consulte as etapas de progressão definidas para o seu cargo e as competências a desenvolver.', actionLabel: 'Ver meu caminho' },
    },
    {
      id: 'skills-gap', element: '[data-tour="skills-analysis"]',
      fr: { title: 'Identifiez vos axes de développement', description: "Comparez vos compétences actuelles avec celles requises pour évoluer vers le niveau supérieur.", actionLabel: "Voir l'analyse" },
      en: { title: 'Identify your development areas', description: 'Compare your current skills with those required to move to the next level.', actionLabel: 'View analysis' },
      pt: { title: 'Identificar suas áreas de desenvolvimento', description: 'Compare suas competências atuais com as necessárias para avançar para o próximo nível.', actionLabel: 'Ver análise' },
    },
    {
      id: 'next-steps',
      fr: { title: 'Planifiez votre évolution', description: "Travaillez avec votre manager pour définir un plan d'action concret vers votre prochaine promotion." },
      en: { title: 'Plan your progression', description: 'Work with your manager to define a concrete action plan towards your next promotion.' },
      pt: { title: 'Planejar sua evolução', description: 'Trabalhe com seu gestor para definir um plano de ação concreto em direção à sua próxima promoção.' },
    },
  ],
  team: [
    {
      id: 'team-overview', element: '[data-tour="team-list"]',
      fr: { title: "Vue d'ensemble de votre équipe", description: 'Consultez les informations de vos collaborateurs directs : contacts, performances et objectifs.', actionLabel: "Voir l'équipe" },
      en: { title: 'Your team overview', description: 'View information about your direct reports: contacts, performance, and objectives.', actionLabel: 'View team' },
      pt: { title: 'Visão geral da sua equipe', description: 'Consulte informações dos seus colaboradores diretos: contatos, desempenho e objetivos.', actionLabel: 'Ver equipe' },
    },
    {
      id: 'team-performance', element: '[data-tour="team-stats"]',
      fr: { title: 'Suivez les performances', description: "Accédez aux indicateurs clés de votre équipe : objectifs, évaluations et formations en cours.", actionLabel: 'Voir les indicateurs' },
      en: { title: 'Track performance', description: "Access your team's key metrics: objectives, evaluations, and ongoing training.", actionLabel: 'View indicators' },
      pt: { title: 'Acompanhar desempenho', description: 'Acesse os indicadores-chave da sua equipe: objetivos, avaliações e treinamentos em andamento.', actionLabel: 'Ver indicadores' },
    },
    {
      id: 'team-actions',
      fr: { title: 'Actions rapides', description: 'Validez les congés, assignez des tâches ou planifiez des entretiens individuels depuis cette page.' },
      en: { title: 'Quick actions', description: 'Approve leave, assign tasks, or schedule one-on-one meetings from this page.' },
      pt: { title: 'Ações rápidas', description: 'Aprove férias, atribua tarefas ou agende reuniões individuais a partir desta página.' },
    },
  ],
  calendar: [
    {
      id: 'view-calendar', element: '[data-tour="calendar-view"]',
      fr: { title: 'Votre agenda centralisé', description: 'Retrouvez tous vos événements : congés, formations, entretiens et réunions importantes.', actionLabel: 'Voir le calendrier' },
      en: { title: 'Your centralised calendar', description: 'Find all your events: leave, training, interviews, and important meetings.', actionLabel: 'View calendar' },
      pt: { title: 'Seu calendário centralizado', description: 'Encontre todos os seus eventos: férias, treinamentos, entrevistas e reuniões importantes.', actionLabel: 'Ver calendário' },
    },
    {
      id: 'add-event', element: '[data-tour="add-event"]',
      fr: { title: 'Ajoutez des événements', description: 'Planifiez vos entretiens individuels, vos formations ou bloquez du temps pour des projets spécifiques.', actionLabel: 'Voir le bouton' },
      en: { title: 'Add events', description: 'Schedule one-on-ones, training sessions, or block time for specific projects.', actionLabel: 'View button' },
      pt: { title: 'Adicionar eventos', description: 'Agende reuniões individuais, sessões de treinamento ou bloqueie tempo para projetos específicos.', actionLabel: 'Ver botão' },
    },
    {
      id: 'sync-calendar',
      fr: { title: 'Synchronisez vos outils', description: "Exportez votre calendrier vers Outlook, Google Calendar ou d'autres applications." },
      en: { title: 'Sync your tools', description: 'Export your calendar to Outlook, Google Calendar, or other applications.' },
      pt: { title: 'Sincronizar suas ferramentas', description: 'Exporte seu calendário para o Outlook, Google Calendar ou outras aplicações.' },
    },
  ],
  myLeaves: [
    {
      id: 'request-leave', element: '[data-tour="request-leave"]',
      fr: { title: 'Demandez vos congés', description: 'Créez une nouvelle demande de congé en quelques clics et suivez son statut en temps réel.', actionLabel: 'Nouvelle demande' },
      en: { title: 'Request your leave', description: 'Create a new leave request in a few clicks and track its status in real time.', actionLabel: 'New request' },
      pt: { title: 'Solicitar suas férias', description: 'Crie uma nova solicitação de férias em poucos cliques e acompanhe o status em tempo real.', actionLabel: 'Nova solicitação' },
    },
    {
      id: 'leave-balance', element: '[data-tour="leave-balance"]',
      fr: { title: 'Consultez vos soldes', description: 'Visualisez vos jours de congés disponibles par type : payés, maladie, RTT, etc.', actionLabel: 'Voir les soldes' },
      en: { title: 'Check your balances', description: 'View your available leave days by type: paid, sick, RTT, etc.', actionLabel: 'View balances' },
      pt: { title: 'Consultar seus saldos', description: 'Visualize seus dias de férias disponíveis por tipo: remuneradas, doença, RTT, etc.', actionLabel: 'Ver saldos' },
    },
    {
      id: 'leave-history',
      fr: { title: 'Historique de vos absences', description: 'Retrouvez toutes vos demandes passées et planifiées pour mieux organiser votre année.' },
      en: { title: 'Your absence history', description: 'Find all your past and planned requests to better organise your year.' },
      pt: { title: 'Histórico de ausências', description: 'Encontre todas as suas solicitações passadas e planejadas para organizar melhor seu ano.' },
    },
  ],
  documents: [
    {
      id: 'access-documents', element: '[data-tour="documents-list"]',
      fr: { title: 'Accédez à vos documents RH', description: 'Consultez vos fiches de paie, certificats de travail et autres documents administratifs.', actionLabel: 'Voir les documents' },
      en: { title: 'Access your HR documents', description: 'View your payslips, employment certificates, and other administrative documents.', actionLabel: 'View documents' },
      pt: { title: 'Acessar seus documentos de RH', description: 'Consulte seus contracheques, certificados de trabalho e outros documentos administrativos.', actionLabel: 'Ver documentos' },
    },
    {
      id: 'request-certificate', element: '[data-tour="request-certificate"]',
      fr: { title: 'Demandez un certificat', description: "Générez instantanément un certificat de travail ou une attestation d'emploi.", actionLabel: 'Demander' },
      en: { title: 'Request a certificate', description: 'Instantly generate an employment certificate or attestation.', actionLabel: 'Request' },
      pt: { title: 'Solicitar um certificado', description: 'Gere instantaneamente um certificado de trabalho ou atestado de emprego.', actionLabel: 'Solicitar' },
    },
    {
      id: 'upload-docs',
      fr: { title: 'Téléversez vos documents', description: 'Ajoutez vos diplômes, certifications ou autres pièces justificatives à votre dossier.' },
      en: { title: 'Upload your documents', description: 'Add your diplomas, certifications, or other supporting documents to your file.' },
      pt: { title: 'Enviar seus documentos', description: 'Adicione seus diplomas, certificações ou outros documentos justificativos ao seu dossier.' },
    },
  ],
  tasks: [
    {
      id: 'view-tasks', element: '[data-tour="tasks-list"]',
      fr: { title: 'Gérez vos tâches', description: 'Visualisez toutes vos tâches assignées : objectifs, formations, onboarding et projets.', actionLabel: 'Voir les tâches' },
      en: { title: 'Manage your tasks', description: 'View all your assigned tasks: objectives, training, onboarding, and projects.', actionLabel: 'View tasks' },
      pt: { title: 'Gerenciar suas tarefas', description: 'Visualize todas as suas tarefas atribuídas: objetivos, treinamentos, onboarding e projetos.', actionLabel: 'Ver tarefas' },
    },
    {
      id: 'task-priority', element: '[data-tour="task-filters"]',
      fr: { title: 'Priorisez votre travail', description: 'Filtrez par priorité ou deadline pour vous concentrer sur ce qui est urgent.', actionLabel: 'Voir les filtres' },
      en: { title: 'Prioritise your work', description: 'Filter by priority or deadline to focus on what is urgent.', actionLabel: 'View filters' },
      pt: { title: 'Priorizar seu trabalho', description: 'Filtre por prioridade ou prazo para se concentrar no que é urgente.', actionLabel: 'Ver filtros' },
    },
    {
      id: 'complete-tasks',
      fr: { title: 'Marquez comme complété', description: 'Cochez vos tâches terminées pour suivre votre progression et informer votre équipe.' },
      en: { title: 'Mark as complete', description: 'Tick off your completed tasks to track your progress and inform your team.' },
      pt: { title: 'Marcar como concluído', description: 'Marque suas tarefas concluídas para acompanhar seu progresso e informar sua equipe.' },
    },
  ],
  talentsDashboard: [
    {
      id: 'talent-overview', element: '[data-tour="talent-stats"]',
      fr: { title: "Vue d'ensemble des talents", description: 'Consultez les KPIs de votre vivier de talents : évaluations 9-Box, hauts potentiels et plans de succession.', actionLabel: 'Voir les indicateurs' },
      en: { title: 'Talent overview', description: 'View your talent pool KPIs: 9-Box evaluations, high-potentials, and succession plans.', actionLabel: 'View indicators' },
      pt: { title: 'Visão geral dos talentos', description: 'Consulte os KPIs do seu banco de talentos: avaliações 9-Box, altos potenciais e planos de sucessão.', actionLabel: 'Ver indicadores' },
    },
    {
      id: 'ninebox-distribution', element: '[data-tour="ninebox-chart"]',
      fr: { title: 'Distribution 9-Box', description: 'Analysez la répartition de vos talents selon leur performance et leur potentiel.', actionLabel: 'Voir la matrice' },
      en: { title: '9-Box distribution', description: 'Analyse the distribution of your talents by performance and potential.', actionLabel: 'View matrix' },
      pt: { title: 'Distribuição 9-Box', description: 'Analise a distribuição dos seus talentos por desempenho e potencial.', actionLabel: 'Ver matriz' },
    },
    {
      id: 'succession-planning',
      fr: { title: 'Planification de la succession', description: 'Identifiez les postes critiques et préparez vos successeurs pour assurer la continuité.' },
      en: { title: 'Succession planning', description: 'Identify critical positions and prepare your successors to ensure continuity.' },
      pt: { title: 'Planejamento de sucessão', description: 'Identifique os cargos críticos e prepare seus sucessores para garantir a continuidade.' },
    },
  ],
  promotions: [
    {
      id: 'manage-promotions', element: '[data-tour="promotions-list"]',
      fr: { title: 'Gérez les promotions', description: 'Validez ou créez des promotions pour récompenser les performances exceptionnelles.', actionLabel: 'Voir les promotions' },
      en: { title: 'Manage promotions', description: 'Validate or create promotions to reward exceptional performance.', actionLabel: 'View promotions' },
      pt: { title: 'Gerenciar promoções', description: 'Valide ou crie promoções para recompensar desempenhos excepcionais.', actionLabel: 'Ver promoções' },
    },
    {
      id: 'eligibility-criteria', element: '[data-tour="eligibility-filters"]',
      fr: { title: "Critères d'éligibilité", description: "Consultez les employés éligibles selon l'ancienneté, la performance et les compétences.", actionLabel: 'Voir les critères' },
      en: { title: 'Eligibility criteria', description: 'View eligible employees based on seniority, performance, and skills.', actionLabel: 'View criteria' },
      pt: { title: 'Critérios de elegibilidade', description: 'Consulte os funcionários elegíveis com base em antiguidade, desempenho e competências.', actionLabel: 'Ver critérios' },
    },
    {
      id: 'promotion-impact',
      fr: { title: "Analysez l'impact", description: "Visualisez l'impact budgétaire et organisationnel des promotions planifiées." },
      en: { title: 'Analyse the impact', description: 'Visualise the budgetary and organisational impact of planned promotions.' },
      pt: { title: 'Analisar o impacto', description: 'Visualize o impacto orçamentário e organizacional das promoções planejadas.' },
    },
  ],
  talentsEmployees: [
    {
      id: 'talent-profiles', element: '[data-tour="talent-list"]',
      fr: { title: 'Fiches talents', description: 'Accédez aux profils détaillés : évaluations, compétences, formations et parcours de carrière.', actionLabel: 'Voir les profils' },
      en: { title: 'Talent profiles', description: 'Access detailed profiles: evaluations, skills, training, and career paths.', actionLabel: 'View profiles' },
      pt: { title: 'Perfis de talento', description: 'Acesse perfis detalhados: avaliações, competências, treinamentos e percursos de carreira.', actionLabel: 'Ver perfis' },
    },
    {
      id: 'talent-filters', element: '[data-tour="talent-filters"]',
      fr: { title: 'Filtrez par critères', description: 'Recherchez des talents selon la performance, le potentiel, les compétences ou le département.', actionLabel: 'Voir les filtres' },
      en: { title: 'Filter by criteria', description: 'Search for talent by performance, potential, skills, or department.', actionLabel: 'View filters' },
      pt: { title: 'Filtrar por critérios', description: 'Pesquise talentos por desempenho, potencial, competências ou departamento.', actionLabel: 'Ver filtros' },
    },
    {
      id: 'talent-actions',
      fr: { title: 'Actions RH', description: 'Assignez des formations, planifiez des promotions ou créez des plans de développement.' },
      en: { title: 'HR actions', description: 'Assign training, plan promotions, or create development plans.' },
      pt: { title: 'Ações de RH', description: 'Atribua treinamentos, planeje promoções ou crie planos de desenvolvimento.' },
    },
  ],
  talentsTeam: [
    {
      id: 'team-talents', element: '[data-tour="team-talents"]',
      fr: { title: 'Talents de votre équipe', description: 'Évaluez et développez les talents de vos collaborateurs directs.', actionLabel: "Voir l'équipe" },
      en: { title: "Your team's talents", description: 'Evaluate and develop the talents of your direct reports.', actionLabel: 'View team' },
      pt: { title: 'Talentos da sua equipe', description: 'Avalie e desenvolva os talentos dos seus colaboradores diretos.', actionLabel: 'Ver equipe' },
    },
    {
      id: 'performance-matrix', element: '[data-tour="performance-matrix"]',
      fr: { title: 'Matrice de performance', description: 'Positionnez vos collaborateurs dans la 9-Box pour identifier les hauts potentiels.', actionLabel: 'Voir la matrice' },
      en: { title: 'Performance matrix', description: 'Position your team members in the 9-Box to identify high-potentials.', actionLabel: 'View matrix' },
      pt: { title: 'Matriz de desempenho', description: 'Posicione seus colaboradores na 9-Box para identificar os altos potenciais.', actionLabel: 'Ver matriz' },
    },
    {
      id: 'development-plans',
      fr: { title: 'Plans de développement', description: 'Créez des plans personnalisés pour faire évoluer chaque membre de votre équipe.' },
      en: { title: 'Development plans', description: 'Create personalised plans to develop each member of your team.' },
      pt: { title: 'Planos de desenvolvimento', description: 'Crie planos personalizados para desenvolver cada membro da sua equipe.' },
    },
  ],
  paths: [
    {
      id: 'career-paths', element: '[data-tour="paths-list"]',
      fr: { title: 'Parcours de carrière', description: "Définissez les parcours d'évolution pour chaque famille de métiers de votre organisation.", actionLabel: 'Voir les parcours' },
      en: { title: 'Career paths', description: 'Define career progression paths for each job family in your organisation.', actionLabel: 'View paths' },
      pt: { title: 'Caminhos de carreira', description: "Defina os percursos de evolução para cada família de cargos da sua organização.", actionLabel: 'Ver caminhos' },
    },
    {
      id: 'create-path', element: '[data-tour="create-path"]',
      fr: { title: 'Créez un nouveau parcours', description: 'Structurez les étapes de progression avec les compétences et formations requises.', actionLabel: 'Créer un parcours' },
      en: { title: 'Create a new path', description: 'Structure progression stages with the required skills and training.', actionLabel: 'Create a path' },
      pt: { title: 'Criar um novo caminho', description: 'Estruture as etapas de progressão com as competências e treinamentos necessários.', actionLabel: 'Criar um caminho' },
    },
    {
      id: 'assign-employees',
      fr: { title: 'Assignez des collaborateurs', description: 'Associez vos employés aux parcours correspondant à leur poste et ambitions.' },
      en: { title: 'Assign employees', description: 'Associate your employees with the paths matching their position and ambitions.' },
      pt: { title: 'Atribuir colaboradores', description: 'Associe seus funcionários aos caminhos correspondentes ao seu cargo e ambições.' },
    },
  ],
  myCareer: [
    {
      id: 'my-position', element: '[data-tour="my-evaluation"]',
      fr: { title: 'Ma position actuelle', description: 'Consultez votre évaluation 9-Box et vos performances récentes.', actionLabel: 'Voir mon évaluation' },
      en: { title: 'My current position', description: 'View your 9-Box evaluation and recent performance.', actionLabel: 'View my evaluation' },
      pt: { title: 'Minha posição atual', description: 'Consulte sua avaliação 9-Box e desempenhos recentes.', actionLabel: 'Ver minha avaliação' },
    },
    {
      id: 'development-plan', element: '[data-tour="development-plan"]',
      fr: { title: 'Mon plan de développement', description: 'Découvrez les compétences à acquérir et les formations recommandées pour progresser.', actionLabel: 'Voir le plan' },
      en: { title: 'My development plan', description: 'Discover the skills to acquire and recommended training to progress.', actionLabel: 'View plan' },
      pt: { title: 'Meu plano de desenvolvimento', description: 'Descubra as competências a adquirir e os treinamentos recomendados para progredir.', actionLabel: 'Ver plano' },
    },
    {
      id: 'next-level',
      fr: { title: 'Prochaine étape', description: "Visualisez les opportunités d'évolution et les prérequis pour accéder au niveau suivant." },
      en: { title: 'Next step', description: 'Visualise career advancement opportunities and the prerequisites to reach the next level.' },
      pt: { title: 'Próxima etapa', description: 'Visualize as oportunidades de evolução e os pré-requisitos para aceder ao próximo nível.' },
    },
  ],
  myPromotions: [
    {
      id: 'promotion-status', element: '[data-tour="promotion-status"]',
      fr: { title: 'Statut de vos promotions', description: 'Suivez l\'état de vos demandes de promotion en cours et leur progression.', actionLabel: 'Voir le statut' },
      en: { title: 'Your promotion status', description: 'Track the status of your ongoing promotion requests and their progress.', actionLabel: 'View status' },
      pt: { title: 'Status das suas promoções', description: 'Acompanhe o estado das suas solicitações de promoção em andamento e seu progresso.', actionLabel: 'Ver status' },
    },
    {
      id: 'eligibility-check', element: '[data-tour="eligibility-criteria"]',
      fr: { title: 'Vérifiez votre éligibilité', description: "Consultez les critères requis et votre niveau d'adéquation pour une promotion.", actionLabel: 'Voir les critères' },
      en: { title: 'Check your eligibility', description: 'View the required criteria and your suitability level for a promotion.', actionLabel: 'View criteria' },
      pt: { title: 'Verificar sua elegibilidade', description: 'Consulte os critérios necessários e seu nível de adequação para uma promoção.', actionLabel: 'Ver critérios' },
    },
    {
      id: 'promotion-history',
      fr: { title: 'Historique de carrière', description: 'Retrouvez toutes vos promotions passées et les évolutions de votre poste.' },
      en: { title: 'Career history', description: 'Find all your past promotions and position changes.' },
      pt: { title: 'Histórico de carreira', description: 'Encontre todas as suas promoções passadas e evoluções do seu cargo.' },
    },
  ],
  performance1: [
    {
      id: 'performance-overview', element: '[data-tour="performance-stats"]',
      fr: { title: 'Tableau de bord performance', description: 'Suivez les évaluations de performance de votre organisation en temps réel.', actionLabel: 'Voir les indicateurs' },
      en: { title: 'Performance dashboard', description: "Track your organisation's performance evaluations in real time.", actionLabel: 'View indicators' },
      pt: { title: 'Painel de desempenho', description: "Acompanhe as avaliações de desempenho da sua organização em tempo real.", actionLabel: 'Ver indicadores' },
    },
    {
      id: 'evaluations', element: '[data-tour="evaluation-campaigns"]',
      fr: { title: "Campagnes d'évaluation", description: 'Lancez et gérez vos campagnes d\'évaluation annuelles ou trimestrielles.', actionLabel: 'Voir les campagnes' },
      en: { title: 'Evaluation campaigns', description: 'Launch and manage your annual or quarterly evaluation campaigns.', actionLabel: 'View campaigns' },
      pt: { title: 'Campanhas de avaliação', description: 'Lance e gerencie suas campanhas de avaliação anuais ou trimestrais.', actionLabel: 'Ver campanhas' },
    },
    {
      id: 'feedback-360',
      fr: { title: 'Feedback 360°', description: 'Collectez des retours multi-sources pour une évaluation complète de vos collaborateurs.' },
      en: { title: '360° Feedback', description: 'Collect multi-source feedback for a complete evaluation of your employees.' },
      pt: { title: 'Feedback 360°', description: 'Colete feedback de múltiplas fontes para uma avaliação completa dos seus colaboradores.' },
    },
  ],
  helpAdmin: [
    {
      id: 'help-admin-articles', element: '[data-tour="help-admin-new-article"]',
      fr: { title: 'Gérer les Articles', description: "Créez et publiez des articles d'aide pour guider vos utilisateurs. Un article publié est visible dans le centre d'aide public.", actionLabel: 'Voir le bouton' },
      en: { title: 'Manage Articles', description: 'Create and publish help articles to guide your users. A published article is visible in the public help centre.', actionLabel: 'View button' },
      pt: { title: 'Gerenciar Artigos', description: "Crie e publique artigos de ajuda para orientar seus utilizadores. Um artigo publicado é visível no centro de ajuda público.", actionLabel: 'Ver botão' },
    },
    {
      id: 'help-admin-tabs', element: '[data-tour="help-admin-tabs"]',
      fr: { title: 'Trois sections disponibles', description: 'Naviguez entre Articles (liste + édition), Catégories (organisation) et Statistiques (vues & feedback).', actionLabel: 'Voir les onglets' },
      en: { title: 'Three available sections', description: 'Navigate between Articles (list + editing), Categories (organisation), and Statistics (views & feedback).', actionLabel: 'View tabs' },
      pt: { title: 'Três seções disponíveis', description: 'Navegue entre Artigos (lista + edição), Categorias (organização) e Estatísticas (visualizações e feedback).', actionLabel: 'Ver abas' },
    },
    {
      id: 'help-admin-publish', element: '[data-tour="help-admin-header"]',
      fr: { title: 'Publier / Dépublier', description: "Utilisez l'icône œil sur chaque article pour le publier ou le masquer immédiatement sans le supprimer.", actionLabel: 'Voir la liste' },
      en: { title: 'Publish / Unpublish', description: 'Use the eye icon on each article to publish or hide it immediately without deleting it.', actionLabel: 'View list' },
      pt: { title: 'Publicar / Despublicar', description: "Use o ícone de olho em cada artigo para publicá-lo ou ocultá-lo imediatamente sem apagá-lo.", actionLabel: 'Ver lista' },
    },
  ],
  platformAdmin: [
    {
      id: 'platform-overview', element: '[data-tour="platform-stats"]',
      fr: { title: 'Vue d\'ensemble Plateforme', description: "Ce dashboard affiche les statistiques globales de tous les tenants : nombre d'entreprises, utilisateurs actifs et abonnements.", actionLabel: 'Voir les statistiques' },
      en: { title: 'Platform Overview', description: 'This dashboard displays global statistics for all tenants: number of companies, active users, and subscriptions.', actionLabel: 'View statistics' },
      pt: { title: 'Visão geral da Plataforma', description: 'Este painel exibe estatísticas globais de todos os tenants: número de empresas, utilizadores ativos e assinaturas.', actionLabel: 'Ver estatísticas' },
    },
    {
      id: 'platform-tenants', element: '[data-tour="platform-tenants"]',
      fr: { title: 'Liste des Tenants', description: "Chaque ligne représente une entreprise cliente. Vous pouvez voir leur plan d'abonnement, le nombre d'utilisateurs et leur statut.", actionLabel: 'Voir la liste' },
      en: { title: 'Tenant List', description: 'Each row represents a client company. You can see their subscription plan, number of users, and status.', actionLabel: 'View list' },
      pt: { title: 'Lista de Tenants', description: 'Cada linha representa uma empresa cliente. Você pode ver o plano de assinatura, o número de utilizadores e o status.', actionLabel: 'Ver lista' },
    },
    {
      id: 'platform-search', element: '[data-tour="platform-search"]',
      fr: { title: 'Recherche & Filtres', description: 'Utilisez la barre de recherche pour trouver un tenant par nom, et filtrez par plan ou statut.', actionLabel: 'Voir les filtres' },
      en: { title: 'Search & Filters', description: 'Use the search bar to find a tenant by name, and filter by plan or status.', actionLabel: 'View filters' },
      pt: { title: 'Pesquisa e Filtros', description: 'Use a barra de pesquisa para encontrar um tenant por nome e filtre por plano ou status.', actionLabel: 'Ver filtros' },
    },
  ],
  platformAdminUsers: [
    {
      id: 'users-overview', element: '[data-tour="platform-users-table"]',
      fr: { title: 'Gestion des Utilisateurs Plateforme', description: 'Cette page liste tous les utilisateurs de la plateforme, toutes entreprises confondues.', actionLabel: 'Voir la liste' },
      en: { title: 'Platform Users Management', description: 'This page lists all platform users across all companies.', actionLabel: 'View list' },
      pt: { title: 'Gestão de Utilizadores da Plataforma', description: 'Esta página lista todos os utilizadores da plataforma, de todas as empresas.', actionLabel: 'Ver lista' },
    },
    {
      id: 'users-create', element: '[data-tour="platform-users-create"]',
      fr: { title: 'Créer un utilisateur', description: 'Cliquez sur "Créer un User" pour créer un compte. Vous pouvez lui assigner un rôle et un tenant (entreprise).', actionLabel: 'Voir le bouton' },
      en: { title: 'Create a user', description: 'Click "Create User" to create an account. You can assign a role and a tenant (company).', actionLabel: 'View button' },
      pt: { title: 'Criar um utilizador', description: 'Clique em "Criar Utilizador" para criar uma conta. Pode atribuir um papel e um tenant (empresa).', actionLabel: 'Ver botão' },
    },
    {
      id: 'users-roles', element: '[data-tour="platform-users-search"]',
      fr: { title: 'Recherche & Filtres', description: 'Filtrez par rôle, tenant ou statut pour retrouver rapidement un utilisateur.', actionLabel: 'Voir les filtres' },
      en: { title: 'Search & Filters', description: 'Filter by role, tenant, or status to quickly find a user.', actionLabel: 'View filters' },
      pt: { title: 'Pesquisa e Filtros', description: 'Filtre por papel, tenant ou status para encontrar rapidamente um utilizador.', actionLabel: 'Ver filtros' },
    },
  ],
  budgetRh: [
    {
      id: 'budget-kpis',
      fr: { title: 'KPIs masse salariale', description: "Visualisez en un coup d'œil la masse salariale totale, le réalisé YTD et l'écart par rapport au budget annuel." },
      en: { title: 'Payroll KPIs', description: 'See at a glance total payroll, YTD actuals, and variance against annual budget.' },
      pt: { title: 'KPIs de folha de pagamento', description: 'Veja de relance o total da folha, realizado YTD e variação em relação ao orçamento anual.' },
    },
    {
      id: 'budget-charts',
      fr: { title: 'Graphiques Budget vs Réalisé', description: "Analysez mois par mois l'évolution du budget par rapport au réalisé. Passez entre les vues d'ensemble, par catégorie, ou en tableau détaillé." },
      en: { title: 'Budget vs Actual Charts', description: 'Analyse month-by-month budget versus actual trends. Switch between overview, category, or detailed table views.' },
      pt: { title: 'Gráficos Orçamento vs Realizado', description: 'Analise mês a mês a evolução do orçamento em relação ao realizado. Alterne entre visão geral, por categoria ou tabela detalhada.' },
    },
    {
      id: 'budget-entry',
      fr: { title: 'Saisir ou importer votre budget', description: "Cliquez sur \"Saisir le budget\" pour entrer manuellement vos montants mois par mois, ou importez directement depuis un fichier Excel via le bouton Paramètres." },
      en: { title: 'Enter or import your budget', description: 'Click "Enter budget" to manually input monthly amounts, or import directly from an Excel file via the Settings button.' },
      pt: { title: 'Inserir ou importar seu orçamento', description: 'Clique em "Inserir orçamento" para inserir manualmente os valores mensais, ou importe diretamente de um arquivo Excel via o botão Configurações.' },
    },
    {
      id: 'budget-year',
      fr: { title: 'Budget pluriannuel', description: "Changez l'année dans le sélecteur pour consulter ou saisir le budget 2026, 2027 ou les années futures. Chaque année dispose de sa propre configuration." },
      en: { title: 'Multi-year budget', description: 'Change the year in the selector to view or enter the 2026, 2027 or future year budgets. Each year has its own configuration.' },
      pt: { title: 'Orçamento plurianual', description: 'Altere o ano no seletor para consultar ou inserir o orçamento de 2026, 2027 ou anos futuros. Cada ano tem sua própria configuração.' },
    },
  ],
};

// ============================================================
// RESOLVER — returns localised PageTip[] for a given page + locale
// ============================================================

export function getPageTips(pageId: string, locale: string = 'fr'): PageTip[] {
  const data = pageTipsLocales[pageId];
  if (!data) return [];

  const lang = (['fr', 'en', 'pt'].includes(locale) ? locale : 'fr') as 'fr' | 'en' | 'pt';

  return data.map((tip) => {
    const text = tip[lang];
    return {
      id: tip.id,
      title: text.title,
      description: text.description,
      ...(tip.element && text.actionLabel
        ? { action: { label: text.actionLabel, element: tip.element } }
        : {}),
    };
  });
}
