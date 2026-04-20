'use client';

import { TourStep } from './AppTour';

// ============================================================
// APP TOUR STEPS — multi-locale
// ============================================================

type LocaleStepText = { title: string; content: string };
type LocaleStep = {
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  fr: LocaleStepText;
  en: LocaleStepText;
  pt: LocaleStepText;
};

function resolveSteps(steps: LocaleStep[], locale: string): TourStep[] {
  const lang = (['fr', 'en', 'pt'].includes(locale) ? locale : 'fr') as 'fr' | 'en' | 'pt';
  return steps.map(({ target, position, fr, en, pt }) => {
    const text = { fr, en, pt }[lang];
    return { target, title: text.title, content: text.content, position };
  });
}

// ============================================================
// EMPLOYEE TOUR (11 steps)
// ============================================================
const employeeStepsData: LocaleStep[] = [
  {
    target: '[data-tour="welcome"]', position: 'bottom',
    fr: { title: 'Bienvenue sur Targetym AI! 👋', content: 'Nous allons vous faire découvrir les principales fonctionnalités de la plateforme pour vous aider à démarrer.' },
    en: { title: 'Welcome to Targetym AI! 👋', content: "Let's show you the main features of the platform to help you get started." },
    pt: { title: 'Bem-vindo ao Targetym AI! 👋', content: 'Vamos apresentar as principais funcionalidades da plataforma para ajudá-lo a começar.' },
  },
  {
    target: '[data-tour="sidebar-dashboard"]', position: 'right',
    fr: { title: 'Votre tableau de bord', content: 'Accédez à votre tableau de bord personnel avec vos statistiques, tâches et informations importantes.' },
    en: { title: 'Your dashboard', content: 'Access your personal dashboard with your statistics, tasks, and important information.' },
    pt: { title: 'Seu painel', content: 'Acesse seu painel pessoal com suas estatísticas, tarefas e informações importantes.' },
  },
  {
    target: '[data-tour="sidebar-tasks"]', position: 'right',
    fr: { title: 'Gestion des tâches', content: 'Gérez vos tâches quotidiennes, suivez votre progression et validez vos activités.' },
    en: { title: 'Task management', content: 'Manage your daily tasks, track your progress, and validate your activities.' },
    pt: { title: 'Gestão de tarefas', content: 'Gerencie suas tarefas diárias, acompanhe seu progresso e valide suas atividades.' },
  },
  {
    target: '[data-tour="sidebar-my-leaves"]', position: 'right',
    fr: { title: 'Demandes de congés', content: 'Consultez vos soldes de congés et soumettez vos demandes de congés rapidement.' },
    en: { title: 'Leave requests', content: 'Check your leave balances and submit leave requests quickly.' },
    pt: { title: 'Solicitações de férias', content: 'Consulte seus saldos de férias e envie solicitações rapidamente.' },
  },
  {
    target: '[data-tour="sidebar-my-objectives"]', position: 'right',
    fr: { title: 'Vos objectifs (OKR)', content: 'Définissez et suivez vos objectifs personnels et professionnels (OKR - Objectives and Key Results).' },
    en: { title: 'Your objectives (OKR)', content: 'Define and track your personal and professional objectives (OKR - Objectives and Key Results).' },
    pt: { title: 'Seus objetivos (OKR)', content: 'Defina e acompanhe seus objetivos pessoais e profissionais (OKR - Objectives and Key Results).' },
  },
  {
    target: '[data-tour="sidebar-performance"]', position: 'right',
    fr: { title: 'Évaluations de performance', content: 'Consultez vos évaluations, recevez des feedbacks et suivez votre évolution professionnelle.' },
    en: { title: 'Performance reviews', content: 'View your evaluations, receive feedback, and track your professional development.' },
    pt: { title: 'Avaliações de desempenho', content: 'Consulte suas avaliações, receba feedback e acompanhe seu desenvolvimento profissional.' },
  },
  {
    target: '[data-tour="sidebar-learning"]', position: 'right',
    fr: { title: 'Formations', content: 'Accédez à votre catalogue de formations, suivez vos cours assignés et obtenez des certificats.' },
    en: { title: 'Training', content: 'Access your training catalogue, follow your assigned courses, and earn certificates.' },
    pt: { title: 'Treinamentos', content: 'Acesse seu catálogo de treinamentos, siga os cursos atribuídos e obtenha certificados.' },
  },
  {
    target: '[data-tour="sidebar-career"]', position: 'right',
    fr: { title: 'Évolution de carrière', content: 'Explorez vos opportunités de carrière, les compétences requises et les formations recommandées.' },
    en: { title: 'Career development', content: 'Explore your career opportunities, required skills, and recommended training.' },
    pt: { title: 'Desenvolvimento de carreira', content: 'Explore suas oportunidades de carreira, competências necessárias e treinamentos recomendados.' },
  },
  {
    target: '[data-tour="quick-actions"]', position: 'left',
    fr: { title: 'Actions rapides', content: 'Accédez rapidement aux actions fréquentes comme demander un congé ou consulter vos objectifs.' },
    en: { title: 'Quick actions', content: 'Quickly access frequent actions such as requesting leave or viewing your objectives.' },
    pt: { title: 'Ações rápidas', content: 'Acesse rapidamente ações frequentes como solicitar férias ou consultar seus objetivos.' },
  },
  {
    target: '[data-tour="notifications"]', position: 'bottom',
    fr: { title: 'Notifications', content: 'Restez informé des événements importants : validations, nouvelles tâches, messages, etc.' },
    en: { title: 'Notifications', content: 'Stay informed of important events: approvals, new tasks, messages, etc.' },
    pt: { title: 'Notificações', content: 'Fique informado de eventos importantes: aprovações, novas tarefas, mensagens, etc.' },
  },
  {
    target: '[data-tour="user-menu"]', position: 'top',
    fr: { title: 'Menu utilisateur', content: 'Accédez à votre profil et déconnectez-vous ici. Le tour est terminé ! 🎉' },
    en: { title: 'User menu', content: 'Access your profile and sign out here. Tour complete! 🎉' },
    pt: { title: 'Menu do utilizador', content: 'Acesse seu perfil e saia aqui. Tour concluído! 🎉' },
  },
];

// ============================================================
// MANAGER TOUR (12 steps)
// ============================================================
const managerStepsData: LocaleStep[] = [
  {
    target: '[data-tour="welcome"]', position: 'bottom',
    fr: { title: 'Bienvenue Manager! 🎯', content: "En tant que manager, vous avez accès à des fonctionnalités supplémentaires pour gérer votre équipe efficacement." },
    en: { title: 'Welcome Manager! 🎯', content: 'As a manager, you have access to additional features to manage your team effectively.' },
    pt: { title: 'Bem-vindo Gestor! 🎯', content: 'Como gestor, você tem acesso a funcionalidades adicionais para gerir sua equipe com eficácia.' },
  },
  {
    target: '[data-tour="sidebar-dashboard"]', position: 'right',
    fr: { title: 'Tableau de bord manager', content: "Visualisez les indicateurs de votre équipe : tâches, congés, performances et objectifs." },
    en: { title: 'Manager dashboard', content: "Visualise your team's metrics: tasks, leave, performance, and objectives." },
    pt: { title: 'Painel do gestor', content: 'Visualize os indicadores da sua equipe: tarefas, férias, desempenho e objetivos.' },
  },
  {
    target: '[data-tour="sidebar-team"]', position: 'right',
    fr: { title: "Gestion de l'équipe", content: 'Consultez la liste de vos collaborateurs directs et accédez à leurs profils détaillés.' },
    en: { title: 'Team management', content: 'View your direct reports list and access their detailed profiles.' },
    pt: { title: 'Gestão da equipe', content: 'Consulte a lista dos seus colaboradores diretos e acesse seus perfis detalhados.' },
  },
  {
    target: '[data-tour="sidebar-tasks"]', position: 'right',
    fr: { title: "Tâches de l'équipe", content: "Assignez des tâches, suivez l'avancement et validez les tâches de votre équipe." },
    en: { title: "Team tasks", content: "Assign tasks, track progress, and validate your team's tasks." },
    pt: { title: 'Tarefas da equipe', content: 'Atribua tarefas, acompanhe o progresso e valide as tarefas da sua equipe.' },
  },
  {
    target: '[data-tour="sidebar-my-leaves"]', position: 'right',
    fr: { title: 'Validation des congés', content: 'Approuvez ou refusez les demandes de congés de vos collaborateurs.' },
    en: { title: 'Leave approval', content: "Approve or reject your team members' leave requests." },
    pt: { title: 'Aprovação de férias', content: 'Aprove ou rejeite as solicitações de férias dos seus colaboradores.' },
  },
  {
    target: '[data-tour="sidebar-okr"]', position: 'right',
    fr: { title: "OKR d'équipe", content: "Définissez les objectifs de votre équipe et suivez leur progression collective." },
    en: { title: 'Team OKRs', content: "Define your team's objectives and track their collective progress." },
    pt: { title: 'OKRs da equipe', content: 'Defina os objetivos da sua equipe e acompanhe o progresso coletivo.' },
  },
  {
    target: '[data-tour="sidebar-performance"]', position: 'right',
    fr: { title: "Évaluations d'équipe", content: 'Réalisez les évaluations de performance de vos collaborateurs et donnez du feedback.' },
    en: { title: 'Team evaluations', content: "Conduct performance evaluations for your team members and provide feedback." },
    pt: { title: 'Avaliações da equipe', content: 'Realize avaliações de desempenho dos seus colaboradores e forneça feedback.' },
  },
  {
    target: '[data-tour="sidebar-learning"]', position: 'right',
    fr: { title: "Formation de l'équipe", content: 'Assignez des formations à vos collaborateurs et suivez leur progression.' },
    en: { title: 'Team training', content: 'Assign training to your team members and track their progress.' },
    pt: { title: 'Treinamento da equipe', content: 'Atribua treinamentos aos seus colaboradores e acompanhe o progresso.' },
  },
  {
    target: '[data-tour="sidebar-analytics"]', position: 'right',
    fr: { title: "Analytiques d'équipe", content: 'Analysez les performances et tendances de votre équipe.' },
    en: { title: 'Team analytics', content: "Analyse your team's performance and trends." },
    pt: { title: 'Análises da equipe', content: 'Analise o desempenho e as tendências da sua equipe.' },
  },
  {
    target: '[data-tour="quick-actions"]', position: 'left',
    fr: { title: 'Actions rapides', content: 'Accédez rapidement aux actions fréquentes : nouvelle tâche, validation, feedback, etc.' },
    en: { title: 'Quick actions', content: 'Quickly access frequent actions: new task, approval, feedback, etc.' },
    pt: { title: 'Ações rápidas', content: 'Acesse rapidamente ações frequentes: nova tarefa, aprovação, feedback, etc.' },
  },
  {
    target: '[data-tour="notifications"]', position: 'bottom',
    fr: { title: 'Notifications', content: "Restez informé des demandes de votre équipe et actions à valider." },
    en: { title: 'Notifications', content: "Stay informed of your team's requests and actions to approve." },
    pt: { title: 'Notificações', content: 'Fique informado das solicitações da sua equipe e ações a aprovar.' },
  },
  {
    target: '[data-tour="user-menu"]', position: 'top',
    fr: { title: 'Votre profil', content: 'Accédez à votre espace personnel. Le tour est terminé ! 🎉' },
    en: { title: 'Your profile', content: 'Access your personal space. Tour complete! 🎉' },
    pt: { title: 'Seu perfil', content: 'Acesse seu espaço pessoal. Tour concluído! 🎉' },
  },
];

// ============================================================
// HR TOUR (13 steps)
// ============================================================
const hrStepsData: LocaleStep[] = [
  {
    target: '[data-tour="welcome"]', position: 'bottom',
    fr: { title: "Bienvenue dans l'espace RH! 💼", content: 'Vous avez accès à toutes les fonctionnalités RH pour gérer efficacement vos collaborateurs.' },
    en: { title: 'Welcome to the HR space! 💼', content: 'You have access to all HR features to manage your employees effectively.' },
    pt: { title: 'Bem-vindo ao espaço de RH! 💼', content: 'Você tem acesso a todas as funcionalidades de RH para gerir seus colaboradores com eficácia.' },
  },
  {
    target: '[data-tour="sidebar-employees"]', position: 'right',
    fr: { title: 'Gestion des employés', content: 'Accédez à la base de données complète des employés : ajout, modification, exports, etc.' },
    en: { title: 'Employee management', content: 'Access the complete employee database: add, edit, export, etc.' },
    pt: { title: 'Gestão de funcionários', content: 'Acesse o banco de dados completo de funcionários: adição, edição, exportação, etc.' },
  },
  {
    target: '[data-tour="sidebar-recruitment"]', position: 'right',
    fr: { title: 'Recrutement', content: 'Gérez vos processus de recrutement : candidats, entretiens et embauches.' },
    en: { title: 'Recruitment', content: 'Manage your recruitment processes: candidates, interviews, and hires.' },
    pt: { title: 'Recrutamento', content: 'Gerencie seus processos de recrutamento: candidatos, entrevistas e contratações.' },
  },
  {
    target: '[data-tour="sidebar-onboarding"]', position: 'right',
    fr: { title: 'Onboarding RH', content: "Créez des programmes d'intégration pour les nouveaux collaborateurs avec tâches et documents." },
    en: { title: 'HR Onboarding', content: 'Create integration programmes for new employees with tasks and documents.' },
    pt: { title: 'Onboarding de RH', content: 'Crie programas de integração para novos colaboradores com tarefas e documentos.' },
  },
  {
    target: '[data-tour="sidebar-leaves"]', position: 'right',
    fr: { title: 'Gestion des congés', content: 'Configurez les types de congés, gérez les soldes et supervisez toutes les demandes.' },
    en: { title: 'Leave management', content: 'Configure leave types, manage balances, and oversee all requests.' },
    pt: { title: 'Gestão de férias', content: 'Configure tipos de férias, gerencie saldos e supervisione todas as solicitações.' },
  },
  {
    target: '[data-tour="sidebar-okr"]', position: 'right',
    fr: { title: "OKR & Objectifs", content: "Suivez les objectifs stratégiques et opérationnels de l'organisation." },
    en: { title: 'OKR & Objectives', content: "Track the organisation's strategic and operational objectives." },
    pt: { title: 'OKR e Objetivos', content: 'Acompanhe os objetivos estratégicos e operacionais da organização.' },
  },
  {
    target: '[data-tour="sidebar-performance"]', position: 'right',
    fr: { title: 'Évaluations globales', content: "Supervisez toutes les évaluations de performance de l'entreprise et analysez les tendances." },
    en: { title: 'Global evaluations', content: "Oversee all performance evaluations across the company and analyse trends." },
    pt: { title: 'Avaliações globais', content: 'Supervisione todas as avaliações de desempenho da empresa e analise tendências.' },
  },
  {
    target: '[data-tour="sidebar-learning"]', position: 'right',
    fr: { title: 'Gestion de la formation', content: 'Créez des catalogues de formation, assignez des cours et suivez la progression.' },
    en: { title: 'Training management', content: 'Create training catalogues, assign courses, and track progression.' },
    pt: { title: 'Gestão de treinamento', content: 'Crie catálogos de treinamento, atribua cursos e acompanhe o progresso.' },
  },
  {
    target: '[data-tour="sidebar-career"]', position: 'right',
    fr: { title: 'Gestion de carrière', content: 'Définissez les parcours de carrière, compétences requises et gérez les promotions.' },
    en: { title: 'Career management', content: 'Define career paths, required skills, and manage promotions.' },
    pt: { title: 'Gestão de carreira', content: 'Defina percursos de carreira, competências necessárias e gerencie promoções.' },
  },
  {
    target: '[data-tour="sidebar-analytics"]', position: 'right',
    fr: { title: 'Analytiques RH', content: 'Analysez les données RH : turnover, absentéisme, performances, et plus encore.' },
    en: { title: 'HR analytics', content: 'Analyse HR data: turnover, absenteeism, performance, and more.' },
    pt: { title: 'Análises de RH', content: 'Analise dados de RH: rotatividade, absenteísmo, desempenho e muito mais.' },
  },
  {
    target: '[data-tour="quick-actions"]', position: 'left',
    fr: { title: 'Actions rapides', content: 'Accédez rapidement aux tâches RH quotidiennes.' },
    en: { title: 'Quick actions', content: 'Quickly access daily HR tasks.' },
    pt: { title: 'Ações rápidas', content: 'Acesse rapidamente as tarefas diárias de RH.' },
  },
  {
    target: '[data-tour="notifications"]', position: 'bottom',
    fr: { title: 'Notifications', content: "Restez informé des demandes de congés, évaluations et alertes RH." },
    en: { title: 'Notifications', content: 'Stay informed of leave requests, evaluations, and HR alerts.' },
    pt: { title: 'Notificações', content: 'Fique informado das solicitações de férias, avaliações e alertas de RH.' },
  },
  {
    target: '[data-tour="user-menu"]', position: 'top',
    fr: { title: 'Votre profil', content: 'Accédez à votre espace personnel. Le tour est terminé ! 🎉' },
    en: { title: 'Your profile', content: 'Access your personal space. Tour complete! 🎉' },
    pt: { title: 'Seu perfil', content: 'Acesse seu espaço pessoal. Tour concluído! 🎉' },
  },
];

// ============================================================
// ADMIN / DG TOUR (15 steps)
// ============================================================
const adminStepsData: LocaleStep[] = [
  {
    target: '[data-tour="welcome"]', position: 'bottom',
    fr: { title: 'Bienvenue Administrateur! 🔐', content: "En tant qu'administrateur, vous avez un contrôle total sur la plateforme et ses configurations." },
    en: { title: 'Welcome Administrator! 🔐', content: 'As an administrator, you have full control over the platform and its configurations.' },
    pt: { title: 'Bem-vindo Administrador! 🔐', content: 'Como administrador, você tem controle total sobre a plataforma e suas configurações.' },
  },
  {
    target: '[data-tour="sidebar-dashboard"]', position: 'right',
    fr: { title: 'Tableau de bord exécutif', content: "Vue d'ensemble de toute l'organisation avec KPIs stratégiques et indicateurs clés." },
    en: { title: 'Executive dashboard', content: "Overview of the entire organisation with strategic KPIs and key indicators." },
    pt: { title: 'Painel executivo', content: 'Visão geral de toda a organização com KPIs estratégicos e indicadores-chave.' },
  },
  {
    target: '[data-tour="sidebar-employees"]', position: 'right',
    fr: { title: 'Gestion complète des employés', content: "Contrôle total sur tous les employés de l'organisation avec droits d'administration." },
    en: { title: 'Complete employee management', content: "Full control over all employees in the organisation with administration rights." },
    pt: { title: 'Gestão completa de funcionários', content: 'Controle total sobre todos os funcionários da organização com direitos de administração.' },
  },
  {
    target: '[data-tour="sidebar-recruitment"]', position: 'right',
    fr: { title: 'Recrutement', content: "Gérez les offres d'emploi, candidatures et processus de recrutement." },
    en: { title: 'Recruitment', content: 'Manage job offers, applications, and recruitment processes.' },
    pt: { title: 'Recrutamento', content: 'Gerencie ofertas de emprego, candidaturas e processos de recrutamento.' },
  },
  {
    target: '[data-tour="sidebar-onboarding"]', position: 'right',
    fr: { title: 'Onboarding', content: "Créez des parcours d'intégration pour accueillir vos nouveaux collaborateurs." },
    en: { title: 'Onboarding', content: 'Create integration paths to welcome your new employees.' },
    pt: { title: 'Onboarding', content: 'Crie percursos de integração para acolher os novos colaboradores.' },
  },
  {
    target: '[data-tour="sidebar-leaves"]', position: 'right',
    fr: { title: 'Gestion des congés', content: 'Approuvez les demandes de congés et gérez les soldes de congés de vos équipes.' },
    en: { title: 'Leave management', content: "Approve leave requests and manage your teams' leave balances." },
    pt: { title: 'Gestão de férias', content: 'Aprove solicitações de férias e gerencie os saldos de férias das suas equipes.' },
  },
  {
    target: '[data-tour="sidebar-okr"]', position: 'right',
    fr: { title: 'OKR & Objectifs', content: "Suivez et pilotez les objectifs stratégiques de toute l'organisation." },
    en: { title: 'OKR & Objectives', content: "Track and steer the strategic objectives of the entire organisation." },
    pt: { title: 'OKR e Objetivos', content: 'Acompanhe e pilote os objetivos estratégicos de toda a organização.' },
  },
  {
    target: '[data-tour="sidebar-performance"]', position: 'right',
    fr: { title: 'Performance & Feedback', content: 'Gérez les évaluations de performance et le feedback continu.' },
    en: { title: 'Performance & Feedback', content: 'Manage performance evaluations and continuous feedback.' },
    pt: { title: 'Desempenho e Feedback', content: 'Gerencie avaliações de desempenho e feedback contínuo.' },
  },
  {
    target: '[data-tour="sidebar-learning"]', position: 'right',
    fr: { title: 'Formation & Développement', content: 'Créez des parcours de formation et gérez le développement des compétences.' },
    en: { title: 'Training & Development', content: 'Create training paths and manage skills development.' },
    pt: { title: 'Treinamento e Desenvolvimento', content: 'Crie percursos de treinamento e gerencie o desenvolvimento de competências.' },
  },
  {
    target: '[data-tour="sidebar-career"]', position: 'right',
    fr: { title: 'Talents & Carrière', content: 'Gérez les plans de succession, nine-box et parcours de carrière.' },
    en: { title: 'Talent & Career', content: 'Manage succession plans, nine-box, and career paths.' },
    pt: { title: 'Talentos e Carreira', content: 'Gerencie planos de sucessão, nine-box e percursos de carreira.' },
  },
  {
    target: '[data-tour="sidebar-analytics"]', position: 'right',
    fr: { title: 'People Analytics', content: 'Accédez aux rapports détaillés, prévisions et analyses stratégiques RH.' },
    en: { title: 'People Analytics', content: 'Access detailed reports, forecasts, and strategic HR analyses.' },
    pt: { title: 'People Analytics', content: 'Acesse relatórios detalhados, previsões e análises estratégicas de RH.' },
  },
  {
    target: '[data-tour="sidebar-settings"]', position: 'right',
    fr: { title: 'Paramètres système', content: 'Configurez les paramètres globaux : types de congés, rôles, permissions, intégrations.' },
    en: { title: 'System settings', content: 'Configure global settings: leave types, roles, permissions, integrations.' },
    pt: { title: 'Configurações do sistema', content: 'Configure as definições globais: tipos de férias, funções, permissões, integrações.' },
  },
  {
    target: '[data-tour="quick-actions"]', position: 'left',
    fr: { title: 'Actions rapides', content: 'Accédez rapidement aux fonctionnalités les plus utilisées.' },
    en: { title: 'Quick actions', content: 'Quickly access the most-used features.' },
    pt: { title: 'Ações rápidas', content: 'Acesse rapidamente as funcionalidades mais usadas.' },
  },
  {
    target: '[data-tour="notifications"]', position: 'bottom',
    fr: { title: 'Notifications', content: "Restez informé des événements importants et des actions requises." },
    en: { title: 'Notifications', content: 'Stay informed of important events and required actions.' },
    pt: { title: 'Notificações', content: 'Fique informado de eventos importantes e ações necessárias.' },
  },
  {
    target: '[data-tour="user-menu"]', position: 'top',
    fr: { title: 'Votre profil', content: 'Accédez à votre profil personnel et paramètres utilisateur. Le tour est terminé ! 🎉' },
    en: { title: 'Your profile', content: 'Access your personal profile and user settings. Tour complete! 🎉' },
    pt: { title: 'Seu perfil', content: 'Acesse seu perfil pessoal e configurações de utilisador. Tour concluído! 🎉' },
  },
];

// ============================================================
// SUPER ADMIN TOUR (4 steps)
// ============================================================
const superAdminStepsData: LocaleStep[] = [
  {
    target: '[data-tour="super-admin-dashboard"]', position: 'right',
    fr: { title: 'Dashboard Plateforme 🔐', content: "Vue d'ensemble de toute la plateforme : tenants, utilisateurs actifs, statistiques globales." },
    en: { title: 'Platform Dashboard 🔐', content: 'Overview of the entire platform: tenants, active users, global statistics.' },
    pt: { title: 'Painel da Plataforma 🔐', content: 'Visão geral de toda a plataforma: tenants, utilizadores ativos, estatísticas globais.' },
  },
  {
    target: '[data-tour="super-admin-users"]', position: 'right',
    fr: { title: 'Gestion des Utilisateurs', content: 'Créez, modifiez et gérez tous les comptes utilisateurs de la plateforme.' },
    en: { title: 'User Management', content: 'Create, edit, and manage all user accounts on the platform.' },
    pt: { title: 'Gestão de Utilizadores', content: 'Crie, edite e gerencie todas as contas de utilizadores da plataforma.' },
  },
  {
    target: '[data-tour="super-admin-help"]', position: 'right',
    fr: { title: "Centre d'Aide", content: "Gérez les articles d'aide, les FAQs et le contenu de support pour tous les utilisateurs." },
    en: { title: 'Help Centre', content: 'Manage help articles, FAQs, and support content for all users.' },
    pt: { title: 'Centro de Ajuda', content: 'Gerencie artigos de ajuda, FAQs e conteúdo de suporte para todos os utilizadores.' },
  },
  {
    target: '[data-tour="user-menu"]', position: 'top',
    fr: { title: 'Votre profil', content: 'Accédez à votre profil et options. Le tour est terminé ! 🎉' },
    en: { title: 'Your profile', content: 'Access your profile and options. Tour complete! 🎉' },
    pt: { title: 'Seu perfil', content: 'Acesse seu perfil e opções. Tour concluído! 🎉' },
  },
];

// ============================================================
// PUBLIC API
// ============================================================

export function getTourStepsByRole(role: string, locale: string = 'fr'): TourStep[] {
  const normalizedRole = role?.toLowerCase() || 'employee';
  switch (normalizedRole) {
    case 'super_admin':  return resolveSteps(superAdminStepsData, locale);
    case 'admin':
    case 'dg':           return resolveSteps(adminStepsData, locale);
    case 'rh':
    case 'hr':           return resolveSteps(hrStepsData, locale);
    case 'manager':      return resolveSteps(managerStepsData, locale);
    case 'employee':
    default:             return resolveSteps(employeeStepsData, locale);
  }
}

export function getWelcomeMessage(role: string, locale: string = 'fr'): string {
  const normalizedRole = role?.toLowerCase() || 'employee';
  const lang = (['fr', 'en', 'pt'].includes(locale) ? locale : 'fr') as 'fr' | 'en' | 'pt';

  const messages: Record<string, Record<'fr' | 'en' | 'pt', string>> = {
    admin: {
      fr: 'Bienvenue dans votre espace administrateur ! Vous avez le contrôle total de la plateforme.',
      en: 'Welcome to your administrator space! You have full control of the platform.',
      pt: 'Bem-vindo ao seu espaço de administrador! Você tem controle total da plataforma.',
    },
    dg: {
      fr: 'Bienvenue DG ! Pilotez votre organisation avec des outils de gestion avancés.',
      en: 'Welcome CEO! Steer your organisation with advanced management tools.',
      pt: 'Bem-vindo DG! Pilote sua organização com ferramentas de gestão avançadas.',
    },
    rh: {
      fr: 'Bienvenue dans votre espace RH ! Gérez vos collaborateurs efficacement.',
      en: 'Welcome to your HR space! Manage your employees effectively.',
      pt: 'Bem-vindo ao seu espaço de RH! Gerencie seus colaboradores com eficácia.',
    },
    manager: {
      fr: 'Bienvenue Manager ! Accompagnez votre équipe vers la réussite.',
      en: 'Welcome Manager! Lead your team towards success.',
      pt: 'Bem-vindo Gestor! Conduza sua equipe rumo ao sucesso.',
    },
    employee: {
      fr: 'Bienvenue sur Targetym AI ! Votre espace personnel pour gérer votre carrière.',
      en: 'Welcome to Targetym AI! Your personal space to manage your career.',
      pt: 'Bem-vindo ao Targetym AI! Seu espaço pessoal para gerir sua carreira.',
    },
  };

  return (messages[normalizedRole] ?? messages.employee)[lang];
}
