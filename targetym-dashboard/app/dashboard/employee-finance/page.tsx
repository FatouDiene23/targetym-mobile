'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import SearchableSelect from '@/components/SearchableSelect';
import { useAuth } from '@/context/AuthContext';
import {
  Banknote,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileCheck,
  Filter,
  HandCoins,
  Info,
  Loader2,
  MoreVertical,
  Paperclip,
  Percent,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Settings,
  TrendingUp,
  Undo2,
  Upload,
  Users,
  Wallet,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import { getEmployees, type Employee } from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nContext';
import type { Locale } from '@/lib/i18n';
import {
  EMPLOYEE_FINANCE_STATUS,
  MONTHS_FR,
  employeeFinanceApi,
  formatMoney,
  type EmployeeFinanceRequest,
  type EmployeeFinanceSettings,
  type EmployeeBankLoan,
  type EmployeeBankLoanInput,
  type EmployeeBankLoanStatus,
} from '@/lib/employeeFinanceApi';
import CustomDatePicker from '@/components/CustomDatePicker';
import CustomSelect from '@/components/CustomSelect';

type TabId = 'dashboard' | 'requests' | 'advances' | 'loans' | 'bank-loans' | 'payouts' | 'repayments' | 'settings';

const tabs: { id: TabId; icon: typeof BarChart3 }[] = [
  { id: 'dashboard', icon: BarChart3 },
  { id: 'requests', icon: FileCheck },
  { id: 'advances', icon: HandCoins },
  { id: 'loans', icon: CreditCard },
  { id: 'bank-loans', icon: Briefcase },
  { id: 'payouts', icon: Banknote },
  { id: 'repayments', icon: CheckCircle2 },
  { id: 'settings', icon: Settings },
];

const validTabs = new Set<TabId>(tabs.map((item) => item.id));
const financierAllowedTabs = new Set<TabId>(['dashboard', 'payouts', 'repayments']);

const EF_TRANSLATIONS: Record<Exclude<Locale, 'fr'>, Record<string, string>> = {
  en: {
    'Avances & Prêts': 'Advances & Loans',
    'Demandes, décaissements et remboursements employés': 'Employee requests, payouts and repayments',
    'Tableau de bord global': 'Global dashboard',
    'Demandes': 'Requests',
    'Avances': 'Advances',
    'Prêts': 'Loans',
    'Prêts bancaires': 'Bank loans',
    "Suivi des engagements bancaires déclarés pour contrôler le taux d'endettement.": 'Track declared bank liabilities used to control the debt ratio.',
    "Taux d'endettement": 'Debt ratio',
    'Seuil maximal calculé sur le salaire net': 'Maximum threshold calculated from net salary',
    'Bloquer les demandes au-delà du seuil': 'Block requests above the threshold',
    'Le calcul inclut les prêts bancaires, les prêts internes et les avances actives.': 'The calculation includes bank loans, internal loans and active advances.',
    'Désactivé': 'Disabled',
    'Enregistrer un prêt bancaire': 'Register a bank loan',
    "Ce prêt sert uniquement au calcul du taux d'endettement.": 'This loan is only used to calculate the debt ratio.',
    'Renseignez les champs obligatoires': 'Complete the required fields',
    'La mensualité est obligatoire': 'The monthly payment is required',
    'Complétez toutes les échéances': 'Complete every installment',
    'Prêt bancaire enregistré': 'Bank loan registered',
    'Banque': 'Bank',
    'Référence du prêt': 'Loan reference',
    'Solde restant': 'Remaining balance',
    'Date de début': 'Start date',
    'Date de fin': 'End date',
    "Type d'échéancier": 'Schedule type',
    'Mensualité fixe': 'Fixed monthly payment',
    'Échéancier personnalisé': 'Custom schedule',
    'Échéances': 'Installments',
    'Ajouter une échéance': 'Add an installment',
    'Notes': 'Notes',
    'Actif': 'Active',
    'Suspendu': 'Suspended',
    'Clôturé': 'Closed',
    'Statut mis à jour': 'Status updated',
    'Prêts bancaires actifs': 'Active bank loans',
    'Solde bancaire restant': 'Remaining bank balance',
    'Charge bancaire ce mois': 'Bank payments this month',
    'Nouveau prêt bancaire': 'New bank loan',
    'Employé, banque ou référence...': 'Employee, bank or reference...',
    'Variable': 'Variable',
    'Modifier le statut': 'Change status',
    'Aucun prêt bancaire': 'No bank loan',
    'Décaissements': 'Payouts',
    'Remboursements': 'Repayments',
    'Paramètres': 'Settings',
    'Avance': 'Advance',
    'Prêt': 'Loan',
    'Avance sur salaire': 'Salary advance',
    'Prêt interne': 'Internal loan',
    'En attente': 'Pending',
    'Rejetée': 'Rejected',
    'Rejeté': 'Rejected',
    'À analyser': 'To review',
    'À décaisser': 'To pay out',
    'Versée': 'Paid out',
    'Approuvée': 'Approved',
    'Approuvées': 'Approved',
    'Terminée': 'Completed',
    'Annulée': 'Cancelled',
    'En remboursement': 'Being repaid',
    'Soldée': 'Settled',
    'Soldé': 'Settled',
    'En cours': 'In progress',
    'En retard': 'Late',
    'Risque élevé': 'High risk',
    'Risque moyen': 'Medium risk',
    'Risque faible': 'Low risk',
    'Basse': 'Low',
    'Moyenne': 'Medium',
    'Haute': 'High',
    'Exporter': 'Export',
    'Exporter CSV': 'Export CSV',
    'Filtres avancés': 'Advanced filters',
    'Réinitialiser': 'Reset',
    'Rechercher': 'Search',
    'Rechercher...': 'Search...',
    'Rechercher un employé...': 'Search for an employee...',
    'Type': 'Type',
    'Statut': 'Status',
    'Département': 'Department',
    'Employé': 'Employee',
    'Sélectionner un employé': 'Select an employee',
    'Chargement des employés...': 'Loading employees...',
    'Aucun employé disponible': 'No employee available',
    'Erreur de chargement des employés': 'Could not load employees',
    'Période': 'Period',
    'Priorité': 'Priority',
    'Action': 'Action',
    'Actions': 'Actions',
    'Tous': 'All',
    'Toutes': 'All',
    'Tous les types': 'All types',
    'Tous les statuts': 'All statuses',
    'Tous les départements': 'All departments',
    'Tous les modes': 'All methods',
    'Mode de paiement': 'Payment method',
    'Virement bancaire': 'Bank transfer',
    'Espèces': 'Cash',
    'Montant demandé': 'Requested amount',
    'Montant approuvé': 'Approved amount',
    'Montant initial': 'Initial amount',
    'Restant dû': 'Remaining due',
    'Mensualité': 'Installment',
    'Première retenue': 'First deduction',
    'Prochaine retenue': 'Next deduction',
    'Fin prévue': 'Expected end',
    'Date': 'Date',
    'Date approbation RH': 'HR approval date',
    'Affecté à': 'Assigned to',
    'Réf': 'Ref',
    'Réf.': 'Ref.',
    'Salaire net': 'Net salary',
    'Taux engagé actuel': 'Current commitment rate',
    'Taux après demande': 'Rate after request',
    'Validateur actuel': 'Current validator',
    'Risque': 'Risk',
    'Non renseigné': 'Not provided',
    'Aucune donnée': 'No data',
    'Aucune demande': 'No request',
    'Aucun décaissement': 'No payout',
    'Aucune échéance': 'No installment',
    'Aucune avance': 'No advance',
    'Aucune activité': 'No activity',
    'Aucune donnée département': 'No department data',
    'résultats': 'results',
    'échéances': 'installments',
    'Lignes par page:': 'Rows per page:',
    'Affichage de': 'Showing',
    'à': 'to',
    'sur': 'of',
    'Nouvelle demande': 'New request',
    'Nouvelle avance': 'New advance',
    'Nouveau prêt': 'New loan',
    'Créer': 'Create',
    'Annuler': 'Cancel',
    'Fermer': 'Close',
    'Mensualités': 'Installments',
    'Année': 'Year',
    'Motif': 'Reason',
    'Motif de la demande': 'Request reason',
    'Paramètres Avance': 'Advance settings',
    'Paramètres Prêt': 'Loan settings',
    'Activé': 'Enabled',
    'Preuve requise': 'Proof required',
    'Plafond': 'Limit',
    'Mensualités max': 'Max installments',
    'Enregistrer': 'Save',
    'Montant total en cours': 'Total outstanding amount',
    'Demandes en attente': 'Pending requests',
    'Remboursé': 'Repaid',
    'Dossiers à risque': 'At-risk files',
    'Taux d’engagement moyen': 'Average commitment rate',
    'Évolution mensuelle': 'Monthly trend',
    'Répartition par type': 'Breakdown by type',
    'Demandes à traiter': 'Requests to process',
    'Remboursements actifs': 'Active repayments',
    'Alertes intelligentes': 'Smart alerts',
    'Top départements': 'Top departments',
    'Capital restant dû': 'Remaining principal',
    'Accordés': 'Approved',
    'Décaissés': 'Paid out',
    'Remboursés': 'Repaid',
    'Plafond dépassé': 'Limit exceeded',
    'Dossiers à décaisser': 'Files to pay out',
    'Gérez et suivez toutes les demandes d’avances et de prêts': 'Manage and track all advance and loan requests',
    'Total des demandes': 'Total requests',
    'En attente de validation': 'Pending validation',
    'Approuvées ce mois': 'Approved this month',
    'Liste des demandes': 'Request list',
    'Détail rapide': 'Quick detail',
    'Activité récente': 'Recent activity',
    'Demande soumise': 'Request submitted',
    'Par l’employé': 'By employee',
    'Validation RH': 'HR validation',
    'Traitée': 'Processed',
    'Demande rejetée': 'Request rejected',
    'Analyse Finance': 'Finance review',
    'En cours d’analyse': 'Under review',
    'Circuit finance': 'Finance flow',
    'Décaissement': 'Payout',
    'Preuve enregistrée': 'Proof saved',
    'En attente Finance': 'Waiting for Finance',
    'Voir': 'View',
    'Approuver': 'Approve',
    'Rejeter': 'Reject',
    'Marquer versée': 'Mark as paid',
    'Demander des infos': 'Request info',
    'Sélectionnez une demande': 'Select a request',
    'Suivi de toutes les avances accordées aux collaborateurs.': 'Track all advances granted to employees.',
    'Suivi de tous les prêts accordés aux collaborateurs.': 'Track all loans granted to employees.',
    'Total des avances en cours': 'Total active advances',
    'Total des prêts en cours': 'Total active loans',
    "Nombre d'avances actives": 'Active advances count',
    'Nombre de prêts actifs': 'Active loans count',
    'Collaborateurs concernés': 'Employees concerned',
    'À prélever sur la paie (ce mois)': 'To deduct from payroll this month',
    'Montant total prévu': 'Total planned amount',
    'Avance moyenne par employé': 'Average advance per employee',
    'Durée moyenne des prêts': 'Average loan duration',
    'Employés avec avance active': 'Employees with active advance',
    'Prêts actifs': 'Active loans',
    'Plus d’actions': 'More actions',
    'Traitement des avances et prêts approuvés par RH avant comptabilisation.': 'Processing advances and loans approved by HR before accounting.',
    'Décaisser': 'Pay out',
    'Montant à décaisser': 'Amount to pay out',
    'Demandes approuvées en attente': 'Approved requests pending',
    'Dossiers à traiter': 'Files to process',
    'File active finance': 'Active finance queue',
    'Preuves à uploader': 'Proofs to upload',
    'Décaissements non finalisés': 'Unfinalized payouts',
    'Décaissements ce mois': 'Payouts this month',
    'Dossiers comptabilisés': 'Accounted files',
    'File de décaissement': 'Payout queue',
    'Détail du décaissement': 'Payout detail',
    'Preuve à uploader': 'Proof to upload',
    'Décaissé': 'Paid out',
    'Échéancier': 'Schedule',
    'Preuve de décaissement': 'Payout proof',
    'Référence de paiement': 'Payment reference',
    'Valider le décaissement': 'Validate payout',
    'Uploader la preuve': 'Upload proof',
    'Retourner au RH': 'Return to HR',
    'Demande approuvée par RH': 'Request approved by HR',
    'Dossier transmis à Finance': 'File sent to Finance',
    'Virement initié': 'Transfer initiated',
    'Preuve en attente': 'Proof pending',
    'Suivi des retenues paie, échéances, retards et soldes restants.': 'Track payroll deductions, installments, delays and remaining balances.',
    'À prélever ce mois': 'To deduct this month',
    'Prélevé ce mois': 'Deducted this month',
    'Retenues planifiées': 'Planned deductions',
    'Retenues confirmées': 'Confirmed deductions',
    'Échéances en retard': 'Late installments',
    'À régulariser': 'To regularize',
    'Avances et prêts actifs': 'Active advances and loans',
    'Échéancier des remboursements': 'Repayment schedule',
    'Montant dû': 'Amount due',
    'Prélevé': 'Deducted',
    'Restant dossier': 'File balance',
    'Détail du remboursement': 'Repayment detail',
    'Montant prélevé': 'Deducted amount',
    'Vérifier la retenue': 'Verify deduction',
    'Reporter l’échéance': 'Postpone installment',
    'Alertes remboursement': 'Repayment alerts',
    'Dossiers soldés': 'Settled files',
    'Prélevée': 'Deducted',
    'Reportée': 'Postponed',
    'À prélever': 'To deduct',
    'Ce mois': 'This month',
    'Mois prochain': 'Next month',
    'Vue consolidée des avances, prêts, décaissements et remboursements.': 'Consolidated view of advances, loans, payouts and repayments.',
    'Configurez les règles tenant des avances et prêts.': 'Configure tenant rules for advances and loans.',
    'Aucune demande à traiter': 'No request to process',
    'Banque / Compte': 'Bank / Account',
    'Demande approuvée': 'Request approved',
    'Demande d’informations à connecter au workflow notifications': 'Information request to connect to the notification workflow',
    'Demande créée': 'Request created',
    'Décaissement confirmé': 'Payout confirmed',
    'Erreur': 'Error',
    'Erreur de chargement': 'Loading error',
    'Export basé sur les filtres actifs.': 'Export based on active filters.',
    'La paie applique la retenue prévue. Les reports et prélèvements partiels suivront la politique configurée par le tenant.': 'Payroll applies the planned deduction. Postponements and partial deductions will follow the tenant policy.',
    'Le dossier n’est comptabilisé qu’après upload de la preuve de décaissement.': 'The file is only accounted for after payout proof is uploaded.',
    'Les colonnes peuvent être triées plus tard.': 'Columns can be sorted later.',
    'Les filtres banque / compte seront ajoutés dès que l’API les expose.': 'Bank/account filters will be added as soon as the API exposes them.',
    'Les règles de report/net insuffisant seront pilotées par les paramètres tenant.': 'Postponement and insufficient-net rules will be driven by tenant settings.',
    'Les sites seront disponibles quand l’API exposera l’entité.': 'Sites will be available when the API exposes the entity.',
    'Motif du rejet': 'Rejection reason',
    'Paramètres enregistrés': 'Settings saved',
    'Enregistrer les paramètres': 'Save settings',
    'Finance': 'Finance',
    'Admin': 'Admin',
    'Qui peut décaisser ?': 'Who can pay out?',
    'Sélectionnez les rôles autorisés à effectuer un décaissement.': 'Select the roles allowed to perform a payout.',
    'Rôles autorisés': 'Allowed roles',
    'Rejetées': 'Rejected',
    'Remboursement en retard': 'Late repayment',
    'Renseignez l’employé et le montant': 'Enter the employee and amount',
    'Report à connecter aux paramètres tenant': 'Postponement to connect to tenant settings',
    'Retenue marquée comme vérifiée côté UI': 'Deduction marked as verified in the UI',
    'Retenue vérifiée': 'Deduction verified',
    'Échéance reportée': 'Installment postponed',
    'Reporter': 'Postpone',
    'Retour RH à connecter au workflow': 'HR return to connect to the workflow',
    'Sélectionnez un dossier': 'Select a file',
    'Sélectionnez une échéance': 'Select an installment',
    'Téléverser le justificatif': 'Upload supporting document',
    'Upload de preuve enregistré dans le formulaire': 'Proof upload saved in the form',
    'mois': 'months',
  },
  pt: {
    'Avances & Prêts': 'Adiantamentos & Empréstimos',
    'Demandes, décaissements et remboursements employés': 'Pedidos, desembolsos e reembolsos de funcionários',
    'Tableau de bord global': 'Painel global',
    'Demandes': 'Pedidos',
    'Avances': 'Adiantamentos',
    'Prêts': 'Empréstimos',
    'Prêts bancaires': 'Empréstimos bancários',
    "Suivi des engagements bancaires déclarés pour contrôler le taux d'endettement.": 'Acompanhamento dos compromissos bancários declarados para controlar a taxa de endividamento.',
    "Taux d'endettement": 'Taxa de endividamento',
    'Seuil maximal calculé sur le salaire net': 'Limite máxima calculada sobre o salário líquido',
    'Bloquer les demandes au-delà du seuil': 'Bloquear pedidos acima do limite',
    'Le calcul inclut les prêts bancaires, les prêts internes et les avances actives.': 'O cálculo inclui empréstimos bancários, empréstimos internos e adiantamentos ativos.',
    'Désactivé': 'Desativado',
    'Enregistrer un prêt bancaire': 'Registrar um empréstimo bancário',
    "Ce prêt sert uniquement au calcul du taux d'endettement.": 'Este empréstimo é usado apenas para calcular a taxa de endividamento.',
    'Renseignez les champs obligatoires': 'Preencha os campos obrigatórios',
    'La mensualité est obligatoire': 'A mensalidade é obrigatória',
    'Complétez toutes les échéances': 'Preencha todas as prestações',
    'Prêt bancaire enregistré': 'Empréstimo bancário registrado',
    'Banque': 'Banco',
    'Référence du prêt': 'Referência do empréstimo',
    'Solde restant': 'Saldo restante',
    'Date de début': 'Data de início',
    'Date de fin': 'Data de fim',
    "Type d'échéancier": 'Tipo de cronograma',
    'Mensualité fixe': 'Mensalidade fixa',
    'Échéancier personnalisé': 'Cronograma personalizado',
    'Échéances': 'Prestações',
    'Ajouter une échéance': 'Adicionar uma prestação',
    'Notes': 'Notas',
    'Actif': 'Ativo',
    'Suspendu': 'Suspenso',
    'Clôturé': 'Encerrado',
    'Statut mis à jour': 'Status atualizado',
    'Prêts bancaires actifs': 'Empréstimos bancários ativos',
    'Solde bancaire restant': 'Saldo bancário restante',
    'Charge bancaire ce mois': 'Encargos bancários deste mês',
    'Nouveau prêt bancaire': 'Novo empréstimo bancário',
    'Employé, banque ou référence...': 'Funcionário, banco ou referência...',
    'Variable': 'Variável',
    'Modifier le statut': 'Alterar status',
    'Aucun prêt bancaire': 'Nenhum empréstimo bancário',
    'Décaissements': 'Desembolsos',
    'Remboursements': 'Reembolsos',
    'Paramètres': 'Configurações',
    'Avance': 'Adiantamento',
    'Prêt': 'Empréstimo',
    'Avance sur salaire': 'Adiantamento salarial',
    'Prêt interne': 'Empréstimo interno',
    'En attente': 'Pendente',
    'Rejetée': 'Rejeitada',
    'Rejeté': 'Rejeitado',
    'À analyser': 'A analisar',
    'À décaisser': 'A desembolsar',
    'Versée': 'Pago',
    'Approuvée': 'Aprovada',
    'Approuvées': 'Aprovadas',
    'Terminée': 'Concluída',
    'Annulée': 'Cancelada',
    'En remboursement': 'Em reembolso',
    'Soldée': 'Liquidada',
    'Soldé': 'Liquidado',
    'En cours': 'Em curso',
    'En retard': 'Em atraso',
    'Risque élevé': 'Risco alto',
    'Risque moyen': 'Risco médio',
    'Risque faible': 'Risco baixo',
    'Basse': 'Baixa',
    'Moyenne': 'Média',
    'Haute': 'Alta',
    'Exporter': 'Exportar',
    'Exporter CSV': 'Exportar CSV',
    'Filtres avancés': 'Filtros avançados',
    'Réinitialiser': 'Redefinir',
    'Rechercher': 'Pesquisar',
    'Rechercher...': 'Pesquisar...',
    'Rechercher un employé...': 'Pesquisar funcionário...',
    'Type': 'Tipo',
    'Statut': 'Status',
    'Département': 'Departamento',
    'Employé': 'Funcionário',
    'Sélectionner un employé': 'Selecionar funcionário',
    'Chargement des employés...': 'Carregando funcionários...',
    'Aucun employé disponible': 'Nenhum funcionário disponível',
    'Erreur de chargement des employés': 'Erro ao carregar funcionários',
    'Période': 'Período',
    'Priorité': 'Prioridade',
    'Action': 'Ação',
    'Actions': 'Ações',
    'Tous': 'Todos',
    'Toutes': 'Todas',
    'Tous les types': 'Todos os tipos',
    'Tous les statuts': 'Todos os status',
    'Tous les départements': 'Todos os departamentos',
    'Tous les modes': 'Todos os modos',
    'Mode de paiement': 'Modo de pagamento',
    'Virement bancaire': 'Transferência bancária',
    'Espèces': 'Dinheiro',
    'Montant demandé': 'Valor solicitado',
    'Montant approuvé': 'Valor aprovado',
    'Montant initial': 'Valor inicial',
    'Restant dû': 'Saldo devedor',
    'Mensualité': 'Parcela',
    'Première retenue': 'Primeiro desconto',
    'Prochaine retenue': 'Próximo desconto',
    'Fin prévue': 'Fim previsto',
    'Date': 'Data',
    'Date approbation RH': 'Data de aprovação RH',
    'Affecté à': 'Atribuído a',
    'Réf': 'Ref',
    'Réf.': 'Ref.',
    'Salaire net': 'Salário líquido',
    'Taux engagé actuel': 'Taxa comprometida atual',
    'Taux après demande': 'Taxa após pedido',
    'Validateur actuel': 'Validador atual',
    'Risque': 'Risco',
    'Non renseigné': 'Não informado',
    'Aucune donnée': 'Nenhum dado',
    'Aucune demande': 'Nenhum pedido',
    'Aucun décaissement': 'Nenhum desembolso',
    'Aucune échéance': 'Nenhuma parcela',
    'Aucune avance': 'Nenhum adiantamento',
    'Aucune activité': 'Nenhuma atividade',
    'Aucune donnée département': 'Nenhum dado de departamento',
    'résultats': 'resultados',
    'échéances': 'parcelas',
    'Lignes par page:': 'Linhas por página:',
    'Affichage de': 'Exibição de',
    'à': 'a',
    'sur': 'de',
    'Nouvelle demande': 'Novo pedido',
    'Nouvelle avance': 'Novo adiantamento',
    'Nouveau prêt': 'Novo empréstimo',
    'Créer': 'Criar',
    'Annuler': 'Cancelar',
    'Fermer': 'Fechar',
    'Mensualités': 'Parcelas',
    'Année': 'Ano',
    'Motif': 'Motivo',
    'Motif de la demande': 'Motivo do pedido',
    'Paramètres Avance': 'Configurações de adiantamento',
    'Paramètres Prêt': 'Configurações de empréstimo',
    'Activé': 'Ativado',
    'Preuve requise': 'Comprovativo obrigatório',
    'Plafond': 'Limite',
    'Mensualités max': 'Máx. parcelas',
    'Enregistrer': 'Salvar',
    'Montant total en cours': 'Valor total em curso',
    'Demandes en attente': 'Pedidos pendentes',
    'Remboursé': 'Reembolsado',
    'Dossiers à risque': 'Dossiês em risco',
    'Taux d’engagement moyen': 'Taxa média de comprometimento',
    'Évolution mensuelle': 'Evolução mensal',
    'Répartition par type': 'Distribuição por tipo',
    'Demandes à traiter': 'Pedidos a tratar',
    'Remboursements actifs': 'Reembolsos ativos',
    'Alertes intelligentes': 'Alertas inteligentes',
    'Top départements': 'Top departamentos',
    'Capital restant dû': 'Capital restante devido',
    'Accordés': 'Aprovados',
    'Décaissés': 'Desembolsados',
    'Remboursés': 'Reembolsados',
    'Plafond dépassé': 'Limite excedido',
    'Dossiers à décaisser': 'Dossiês a desembolsar',
    'Gérez et suivez toutes les demandes d’avances et de prêts': 'Gerencie e acompanhe todos os pedidos de adiantamentos e empréstimos',
    'Total des demandes': 'Total de pedidos',
    'En attente de validation': 'Aguardando validação',
    'Approuvées ce mois': 'Aprovadas este mês',
    'Liste des demandes': 'Lista de pedidos',
    'Détail rapide': 'Detalhe rápido',
    'Activité récente': 'Atividade recente',
    'Demande soumise': 'Pedido submetido',
    'Par l’employé': 'Pelo funcionário',
    'Validation RH': 'Validação RH',
    'Traitée': 'Tratada',
    'Demande rejetée': 'Pedido rejeitado',
    'Analyse Finance': 'Análise Financeira',
    'En cours d’analyse': 'Em análise',
    'Circuit finance': 'Circuito financeiro',
    'Décaissement': 'Desembolso',
    'Preuve enregistrée': 'Comprovativo salvo',
    'En attente Finance': 'Aguardando Finanças',
    'Voir': 'Ver',
    'Approuver': 'Aprovar',
    'Rejeter': 'Rejeitar',
    'Marquer versée': 'Marcar como pago',
    'Demander des infos': 'Pedir informações',
    'Sélectionnez une demande': 'Selecione um pedido',
    'Suivi de toutes les avances accordées aux collaborateurs.': 'Acompanhe todos os adiantamentos concedidos aos colaboradores.',
    'Suivi de tous les prêts accordés aux collaborateurs.': 'Acompanhe todos os empréstimos concedidos aos colaboradores.',
    'Total des avances en cours': 'Total de adiantamentos em curso',
    'Total des prêts en cours': 'Total de empréstimos em curso',
    "Nombre d'avances actives": 'Número de adiantamentos ativos',
    'Nombre de prêts actifs': 'Número de empréstimos ativos',
    'Collaborateurs concernés': 'Colaboradores envolvidos',
    'À prélever sur la paie (ce mois)': 'A descontar na folha este mês',
    'Montant total prévu': 'Valor total previsto',
    'Avance moyenne par employé': 'Adiantamento médio por funcionário',
    'Durée moyenne des prêts': 'Duração média dos empréstimos',
    'Employés avec avance active': 'Funcionários com adiantamento ativo',
    'Prêts actifs': 'Empréstimos ativos',
    'Plus d’actions': 'Mais ações',
    'Traitement des avances et prêts approuvés par RH avant comptabilisation.': 'Tratamento de adiantamentos e empréstimos aprovados por RH antes da contabilização.',
    'Décaisser': 'Desembolsar',
    'Montant à décaisser': 'Valor a desembolsar',
    'Demandes approuvées en attente': 'Pedidos aprovados pendentes',
    'Dossiers à traiter': 'Dossiês a tratar',
    'File active finance': 'Fila ativa de finanças',
    'Preuves à uploader': 'Comprovativos a carregar',
    'Décaissements non finalisés': 'Desembolsos não finalizados',
    'Décaissements ce mois': 'Desembolsos este mês',
    'Dossiers comptabilisés': 'Dossiês contabilizados',
    'File de décaissement': 'Fila de desembolso',
    'Détail du décaissement': 'Detalhe do desembolso',
    'Preuve à uploader': 'Comprovativo a carregar',
    'Décaissé': 'Desembolsado',
    'Échéancier': 'Cronograma',
    'Preuve de décaissement': 'Comprovativo de desembolso',
    'Référence de paiement': 'Referência de pagamento',
    'Valider le décaissement': 'Validar desembolso',
    'Uploader la preuve': 'Carregar comprovativo',
    'Retourner au RH': 'Devolver ao RH',
    'Demande approuvée par RH': 'Pedido aprovado por RH',
    'Dossier transmis à Finance': 'Dossiê enviado para Finanças',
    'Virement initié': 'Transferência iniciada',
    'Preuve en attente': 'Comprovativo pendente',
    'Suivi des retenues paie, échéances, retards et soldes restants.': 'Acompanhe descontos em folha, parcelas, atrasos e saldos restantes.',
    'À prélever ce mois': 'A descontar este mês',
    'Prélevé ce mois': 'Descontado este mês',
    'Retenues planifiées': 'Descontos planejados',
    'Retenues confirmées': 'Descontos confirmados',
    'Échéances en retard': 'Parcelas em atraso',
    'À régulariser': 'A regularizar',
    'Avances et prêts actifs': 'Adiantamentos e empréstimos ativos',
    'Échéancier des remboursements': 'Cronograma de reembolsos',
    'Montant dû': 'Valor devido',
    'Prélevé': 'Descontado',
    'Restant dossier': 'Saldo do dossiê',
    'Détail du remboursement': 'Detalhe do reembolso',
    'Montant prélevé': 'Valor descontado',
    'Vérifier la retenue': 'Verificar desconto',
    'Reporter l’échéance': 'Adiar parcela',
    'Alertes remboursement': 'Alertas de reembolso',
    'Dossiers soldés': 'Dossiês liquidados',
    'Prélevée': 'Descontada',
    'Reportée': 'Adiada',
    'À prélever': 'A descontar',
    'Ce mois': 'Este mês',
    'Mois prochain': 'Próximo mês',
    'Vue consolidée des avances, prêts, décaissements et remboursements.': 'Visão consolidada de adiantamentos, empréstimos, desembolsos e reembolsos.',
    'Configurez les règles tenant des avances et prêts.': 'Configure as regras do tenant para adiantamentos e empréstimos.',
    'Aucune demande à traiter': 'Nenhum pedido a tratar',
    'Banque / Compte': 'Banco / Conta',
    'Demande approuvée': 'Pedido aprovado',
    'Demande d’informations à connecter au workflow notifications': 'Pedido de informações a conectar ao workflow de notificações',
    'Demande créée': 'Pedido criado',
    'Décaissement confirmé': 'Desembolso confirmado',
    'Erreur': 'Erro',
    'Erreur de chargement': 'Erro ao carregar',
    'Export basé sur les filtres actifs.': 'Exportação baseada nos filtros ativos.',
    'La paie applique la retenue prévue. Les reports et prélèvements partiels suivront la politique configurée par le tenant.': 'A folha aplica o desconto previsto. Adiamentos e descontos parciais seguirão a política configurada pelo tenant.',
    'Le dossier n’est comptabilisé qu’après upload de la preuve de décaissement.': 'O dossiê só é contabilizado após o upload do comprovativo de desembolso.',
    'Les colonnes peuvent être triées plus tard.': 'As colunas poderão ser ordenadas posteriormente.',
    'Les filtres banque / compte seront ajoutés dès que l’API les expose.': 'Os filtros banco/conta serão adicionados assim que a API os expuser.',
    'Les règles de report/net insuffisant seront pilotées par les paramètres tenant.': 'As regras de adiamento/salário líquido insuficiente serão controladas pelas configurações do tenant.',
    'Les sites seront disponibles quand l’API exposera l’entité.': 'Os sites estarão disponíveis quando a API expuser a entidade.',
    'Motif du rejet': 'Motivo da rejeição',
    'Paramètres enregistrés': 'Configurações salvas',
    'Enregistrer les paramètres': 'Salvar configurações',
    'Finance': 'Finanças',
    'Admin': 'Admin',
    'Qui peut décaisser ?': 'Quem pode desembolsar?',
    'Sélectionnez les rôles autorisés à effectuer un décaissement.': 'Selecione os papéis autorizados a efetuar um desembolso.',
    'Rôles autorisés': 'Papéis autorizados',
    'Rejetées': 'Rejeitadas',
    'Remboursement en retard': 'Reembolso em atraso',
    'Renseignez l’employé et le montant': 'Informe o funcionário e o valor',
    'Report à connecter aux paramètres tenant': 'Adiamento a conectar às configurações do tenant',
    'Retenue marquée comme vérifiée côté UI': 'Desconto marcado como verificado na interface',
    'Retenue vérifiée': 'Desconto verificado',
    'Échéance reportée': 'Parcela adiada',
    'Reporter': 'Adiar',
    'Retour RH à connecter au workflow': 'Retorno ao RH a conectar ao workflow',
    'Sélectionnez un dossier': 'Selecione um dossiê',
    'Sélectionnez une échéance': 'Selecione uma parcela',
    'Téléverser le justificatif': 'Carregar justificativo',
    'Upload de preuve enregistré dans le formulaire': 'Upload do comprovativo salvo no formulário',
    'mois': 'meses',
  },
};

function useEmployeeFinanceText() {
  const { locale } = useI18n();
  return useCallback((text: string) => (locale === 'fr' ? text : EF_TRANSLATIONS[locale]?.[text] ?? text), [locale]);
}

const CHART_COLORS = ['#2563eb', '#60a5fa', '#22c55e', '#f97316', '#ef4444', '#7c3aed'];

const toNumber = (value: number | string | null | undefined) => Number(value ?? 0) || 0;

const formatCompact = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
};

const requestAmount = (request: EmployeeFinanceRequest) =>
  toNumber(request.amount_approved ?? request.amount_requested);

const requestDate = (request: EmployeeFinanceRequest) =>
  request.created_at ? new Date(request.created_at) : new Date(request.first_payroll_year, request.first_payroll_month - 1, 1);

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const monthLabel = (year: number, month: number) => `${MONTHS_FR[month - 1].slice(0, 3)} ${year}`;

const shortDate = (date: Date) => date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'EM';

const isPastPeriod = (year: number, month: number) => {
  const now = new Date();
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
};

const requestRef = (request: EmployeeFinanceRequest) =>
  `DEM-${requestDate(request).getFullYear()}-${String(request.id).padStart(3, '0')}`;

const requestTypeLabel = (request: EmployeeFinanceRequest, tt: (text: string) => string = (text) => text) =>
  request.request_type === 'advance' ? tt('Avance sur salaire') : tt('Prêt interne');

type RequestPriority = 'low' | 'medium' | 'high';

const priorityConfig: Record<RequestPriority, { label: string; color: string }> = {
  low: { label: 'Basse', color: 'bg-emerald-50 text-emerald-700' },
  medium: { label: 'Moyenne', color: 'bg-amber-50 text-amber-700' },
  high: { label: 'Haute', color: 'bg-red-50 text-red-700' },
};

const statusPill: Record<EmployeeFinanceRequest['status'], { label: string; color: string }> = {
  pending_hr: { label: 'En attente', color: 'bg-orange-50 text-orange-700' },
  rejected: { label: 'Rejetée', color: 'bg-red-50 text-red-700' },
  pending_finance: { label: 'À analyser', color: 'bg-blue-50 text-blue-700' },
  approved: { label: 'À décaisser', color: 'bg-indigo-50 text-indigo-700' },
  paid_out: { label: 'Versée', color: 'bg-emerald-50 text-emerald-700' },
  active: { label: 'Approuvée', color: 'bg-emerald-50 text-emerald-700' },
  completed: { label: 'Terminée', color: 'bg-gray-100 text-gray-700' },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-600' },
};

const getRequestPriority = (request: EmployeeFinanceRequest): RequestPriority => {
  const amount = requestAmount(request);
  if (amount >= 1_000_000 || request.status === 'pending_finance') return 'high';
  if (amount >= 500_000) return 'medium';
  return 'low';
};

const getRiskLabel = (request: EmployeeFinanceRequest) => {
  if (request.installments?.some((installment) => installment.status === 'pending' && isPastPeriod(installment.period_year, installment.period_month))) {
    return { label: 'Risque élevé', color: 'bg-red-50 text-red-700' };
  }
  if (getRequestPriority(request) === 'high') return { label: 'Risque moyen', color: 'bg-amber-50 text-amber-700' };
  return { label: 'Risque faible', color: 'bg-emerald-50 text-emerald-700' };
};

function RequestStatusPill({ status }: { status: EmployeeFinanceRequest['status'] }) {
  const tt = useEmployeeFinanceText();
  const cfg = statusPill[status] ?? statusPill.pending_hr;
  return <span className={`rounded px-3 py-1 text-xs font-semibold ${cfg.color}`}>{tt(cfg.label)}</span>;
}

const advanceRef = (request: EmployeeFinanceRequest) =>
  `ADV-${requestDate(request).getFullYear()}-${String(request.id).padStart(3, '0')}`;

const advanceStatusPill: Record<EmployeeFinanceRequest['status'], { label: string; color: string }> = {
  pending_hr: { label: 'En attente', color: 'bg-orange-50 text-orange-700' },
  rejected: { label: 'Rejetée', color: 'bg-red-50 text-red-700' },
  pending_finance: { label: 'À décaisser', color: 'bg-blue-50 text-blue-700' },
  approved: { label: 'À décaisser', color: 'bg-blue-50 text-blue-700' },
  paid_out: { label: 'En remboursement', color: 'bg-emerald-50 text-emerald-700' },
  active: { label: 'En remboursement', color: 'bg-emerald-50 text-emerald-700' },
  completed: { label: 'Soldée', color: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-600' },
};

function AdvanceStatusPill({ status }: { status: EmployeeFinanceRequest['status'] }) {
  const tt = useEmployeeFinanceText();
  const cfg = advanceStatusPill[status] ?? advanceStatusPill.pending_hr;
  return <span className={`rounded px-3 py-1 text-xs font-semibold ${cfg.color}`}>{tt(cfg.label)}</span>;
}

function StatusBadge({ status }: { status: EmployeeFinanceRequest['status'] }) {
  const tt = useEmployeeFinanceText();
  const cfg = EMPLOYEE_FINANCE_STATUS[status] ?? EMPLOYEE_FINANCE_STATUS.pending_hr;
  return <span className={`rounded px-2 py-1 text-xs font-medium ${cfg.color}`}>{tt(cfg.label)}</span>;
}

function SettingsPanel({
  settings,
  onSaved,
}: {
  settings: EmployeeFinanceSettings | null;
  onSaved: (settings: EmployeeFinanceSettings) => void;
}) {
  const tt = useEmployeeFinanceText();
  const [section, setSection] = useState<'advance' | 'loan' | 'payout' | 'repayment'>('advance');
  const [saving, setSaving] = useState(false);

  const advanceData = useMemo(() => settings?.advance_settings ?? {}, [settings?.advance_settings]);
  const loanData = useMemo(() => settings?.loan_settings ?? {}, [settings?.loan_settings]);
  const financeData = useMemo(() => settings?.finance_approval_settings ?? {}, [settings?.finance_approval_settings]);
  const repaymentData = useMemo(() => asRecord(financeData.repayment_policy), [financeData]);

  const [advanceEnabled, setAdvanceEnabled] = useState(true);
  const [advanceMaxType, setAdvanceMaxType] = useState('percent_net_salary');
  const [advanceMaxValue, setAdvanceMaxValue] = useState('50');
  const [advanceMaxInstallments, setAdvanceMaxInstallments] = useState('3');
  const [advanceProofRequired, setAdvanceProofRequired] = useState(false);
  const [advanceReasonRequired, setAdvanceReasonRequired] = useState(true);
  const [advanceFirstPayroll, setAdvanceFirstPayroll] = useState('next_month');
  const [advanceInsufficientNet, setAdvanceInsufficientNet] = useState('block_payroll');
  const [advanceAllowMultiple, setAdvanceAllowMultiple] = useState(false);
  const [advanceMinDays, setAdvanceMinDays] = useState('30');

  const [loanEnabled, setLoanEnabled] = useState(true);
  const [loanMaxType, setLoanMaxType] = useState('months_net_salary');
  const [loanMaxValue, setLoanMaxValue] = useState('3');
  const [loanMaxInstallments, setLoanMaxInstallments] = useState('12');
  const [loanProofRequired, setLoanProofRequired] = useState(true);
  const [loanReasonRequired, setLoanReasonRequired] = useState(true);
  const [loanInsufficientNet, setLoanInsufficientNet] = useState('defer_installment');
  const [loanDeparturePolicy, setLoanDeparturePolicy] = useState('create_remaining_debt');
  const [loanAllowMultiple, setLoanAllowMultiple] = useState(true);
  const [loanMinDays, setLoanMinDays] = useState('30');
  const [loanDebtRatioEnabled, setLoanDebtRatioEnabled] = useState(true);
  const [loanMaxDebtRatio, setLoanMaxDebtRatio] = useState('33');

  const [financeApprovalRequired, setFinanceApprovalRequired] = useState(true);
  const [payoutProofRequired, setPayoutProofRequired] = useState(true);
  const [paymentReferenceRequired, setPaymentReferenceRequired] = useState(true);
  const [allowedPayoutMethods, setAllowedPayoutMethods] = useState<string[]>(['bank_transfer', 'wave', 'orange_money']);
  const [allowedPayoutRoles, setAllowedPayoutRoles] = useState<string[]>(['finance', 'admin', 'dg']);
  const [accountingAfterProof, setAccountingAfterProof] = useState(true);
  const [validateAmountBeforePayout, setValidateAmountBeforePayout] = useState(true);
  const [auditPayer, setAuditPayer] = useState(true);
  const [allowMultipleProofs, setAllowMultipleProofs] = useState(true);

  const [allowInstallmentChanges, setAllowInstallmentChanges] = useState(true);
  const [installmentChangeMode, setInstallmentChangeMode] = useState('time_limited');
  const [repaymentInsufficientNet, setRepaymentInsufficientNet] = useState('partial_deduction');
  const [departurePolicy, setDeparturePolicy] = useState('settle_last_salary');
  const [payrollPlannedOnly, setPayrollPlannedOnly] = useState(true);
  const [noPayrollRevalidation, setNoPayrollRevalidation] = useState(false);
  const [createPayrollLinesAfterPayout, setCreatePayrollLinesAfterPayout] = useState(true);
  const [markRiskOnMissedDeduction, setMarkRiskOnMissedDeduction] = useState(true);
  const [alertHrFinanceOnLate, setAlertHrFinanceOnLate] = useState(true);
  const [notifyEmployeeOnLate, setNotifyEmployeeOnLate] = useState(true);
  const [closurePolicy, setClosurePolicy] = useState('when_zero_balance');

  useEffect(() => {
    setAdvanceEnabled(asBool(advanceData.enabled, true));
    setAdvanceMaxType(asString(advanceData.max_amount_type, 'percent_net_salary'));
    setAdvanceMaxValue(asNumberString(advanceData.max_amount_value, '50'));
    setAdvanceMaxInstallments(asNumberString(advanceData.max_installments, '3'));
    setAdvanceProofRequired(asBool(advanceData.proof_required, false));
    setAdvanceReasonRequired(asBool(advanceData.reason_required, true));
    setAdvanceFirstPayroll(asString(advanceData.first_payroll_policy, 'next_month'));
    setAdvanceInsufficientNet(asString(advanceData.insufficient_net_policy, 'block_payroll'));
    setAdvanceAllowMultiple(Number(advanceData.max_active_requests ?? 1) > 1);
    setAdvanceMinDays(asNumberString(advanceData.min_days_between_requests, '30'));

    setLoanEnabled(asBool(loanData.enabled, true));
    setLoanMaxType(asString(loanData.max_amount_type, 'months_net_salary'));
    setLoanMaxValue(asNumberString(loanData.max_amount_value, '3'));
    setLoanMaxInstallments(asNumberString(loanData.max_installments, '12'));
    setLoanProofRequired(asBool(loanData.proof_required, true));
    setLoanReasonRequired(asBool(loanData.reason_required, true));
    setLoanInsufficientNet(asString(loanData.insufficient_net_policy, 'defer_installment'));
    setLoanDeparturePolicy(asString(loanData.departure_policy, 'create_remaining_debt'));
    setLoanAllowMultiple(Number(loanData.max_active_requests ?? 2) > 1);
    setLoanMinDays(asNumberString(loanData.min_days_between_requests, '30'));
    setLoanDebtRatioEnabled(asBool(loanData.debt_ratio_check_enabled, true));
    setLoanMaxDebtRatio(asNumberString(loanData.max_debt_ratio_percent, '33'));

    setFinanceApprovalRequired(asBool(financeData.finance_approval_required, true));
    setPayoutProofRequired(asBool(financeData.payout_proof_required, true));
    setPaymentReferenceRequired(asBool(financeData.payment_reference_required, true));
    setAllowedPayoutMethods(normalizePayoutMethods(asStringArray(financeData.allowed_payout_methods, ['bank_transfer', 'wave', 'orange_money'])));
    setAllowedPayoutRoles(asStringArray(financeData.allowed_payout_roles, ['finance', 'admin', 'dg']));
    setAccountingAfterProof(asBool(financeData.accounting_after_proof, true));
    setValidateAmountBeforePayout(asBool(financeData.validate_amount_before_payout, true));
    setAuditPayer(asBool(financeData.audit_payer, true));
    setAllowMultipleProofs(asBool(financeData.allow_multiple_proofs, true));

    setAllowInstallmentChanges(asBool(repaymentData.allow_installment_changes, true));
    setInstallmentChangeMode(asString(repaymentData.installment_change_mode, 'time_limited'));
    setRepaymentInsufficientNet(asString(repaymentData.insufficient_net_policy, 'partial_deduction'));
    setDeparturePolicy(asString(repaymentData.departure_policy, 'settle_last_salary'));
    setPayrollPlannedOnly(asBool(repaymentData.payroll_planned_only, true));
    setNoPayrollRevalidation(asBool(repaymentData.no_payroll_revalidation, false));
    setCreatePayrollLinesAfterPayout(asBool(repaymentData.create_payroll_lines_after_payout, true));
    setMarkRiskOnMissedDeduction(asBool(repaymentData.mark_risk_on_missed_deduction, true));
    setAlertHrFinanceOnLate(asBool(repaymentData.alert_hr_finance_on_late, true));
    setNotifyEmployeeOnLate(asBool(repaymentData.notify_employee_on_late, true));
    setClosurePolicy(asString(repaymentData.closure_policy, 'when_zero_balance'));
  }, [advanceData, financeData, loanData, repaymentData]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const nextAdvanceSettings = {
        ...advanceData,
        enabled: advanceEnabled,
        max_amount_type: advanceMaxType,
        max_amount_value: Number(advanceMaxValue || 0),
        max_installments: Number(advanceMaxInstallments || 1),
        proof_required: advanceProofRequired,
        reason_required: advanceReasonRequired,
        first_payroll_policy: advanceFirstPayroll,
        insufficient_net_policy: advanceInsufficientNet,
        max_active_requests: advanceAllowMultiple ? 99 : 1,
        min_days_between_requests: Number(advanceMinDays || 0),
      };
      const nextLoanSettings = {
        ...loanData,
        enabled: loanEnabled,
        interest_rate: 0,
        max_amount_type: loanMaxType,
        max_amount_value: Number(loanMaxValue || 0),
        max_installments: Number(loanMaxInstallments || 1),
        proof_required: loanProofRequired,
        reason_required: loanReasonRequired,
        insufficient_net_policy: loanInsufficientNet,
        allow_installment_suspension_if_net_insufficient: loanInsufficientNet === 'defer_installment',
        departure_policy: loanDeparturePolicy,
        max_active_requests: loanAllowMultiple ? 99 : 1,
        min_days_between_requests: Number(loanMinDays || 0),
        debt_ratio_check_enabled: loanDebtRatioEnabled,
        max_debt_ratio_percent: Number(loanMaxDebtRatio || 33),
      };
      const nextRepaymentPolicy = {
        ...repaymentData,
        allow_installment_changes: allowInstallmentChanges,
        installment_change_mode: installmentChangeMode,
        insufficient_net_policy: repaymentInsufficientNet,
        departure_policy: departurePolicy,
        payroll_planned_only: payrollPlannedOnly,
        no_payroll_revalidation: noPayrollRevalidation,
        create_payroll_lines_after_payout: createPayrollLinesAfterPayout,
        mark_risk_on_missed_deduction: markRiskOnMissedDeduction,
        alert_hr_finance_on_late: alertHrFinanceOnLate,
        notify_employee_on_late: notifyEmployeeOnLate,
        closure_policy: closurePolicy,
      };
      const nextFinanceSettings = {
        ...financeData,
        finance_approval_required: financeApprovalRequired,
        payout_proof_required: payoutProofRequired,
        payment_reference_required: paymentReferenceRequired,
        allowed_payout_methods: allowedPayoutMethods,
        allowed_payout_roles: allowedPayoutRoles.length ? allowedPayoutRoles : ['finance'],
        accounting_after_proof: accountingAfterProof,
        validate_amount_before_payout: validateAmountBeforePayout,
        audit_payer: auditPayer,
        allow_multiple_proofs: allowMultipleProofs,
        repayment_policy: nextRepaymentPolicy,
      };
      const saved = await employeeFinanceApi.updateSettings({
        advance_settings: nextAdvanceSettings,
        loan_settings: nextLoanSettings,
        finance_approval_settings: nextFinanceSettings,
      });
      onSaved(saved);
      toast.success(tt('Paramètres enregistrés'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt('Erreur'));
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayValue = (values: string[], value: string) =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  const togglePayoutRole = (value: string) => {
    setAllowedPayoutRoles((items) => {
      if (!items.includes(value)) return [...items, value];
      if (items.length <= 1) return items;
      return items.filter((item) => item !== value);
    });
  };

  const settingTabs = [
    { id: 'advance' as const, label: tt('Avances'), icon: Wallet },
    { id: 'loan' as const, label: tt('Prêts'), icon: CreditCard },
    { id: 'payout' as const, label: tt('Décaissement (Finance)'), icon: Banknote },
    { id: 'repayment' as const, label: tt('Remboursement & départ'), icon: Users },
  ];

  const insufficientOptions = [
    { id: 'block_payroll', title: tt('Bloquer la paie'), description: tt("La retenue n'est pas validée tant que le solde n'est pas couvert."), icon: Wallet },
    { id: 'defer_installment', title: tt('Reporter la retenue'), description: tt('La retenue est reportée au mois suivant.'), icon: Clock },
    { id: 'partial_deduction', title: tt('Prélever partiellement'), description: tt('Prélever le montant disponible sur le net.'), icon: PieChart },
    { id: 'allow', title: tt('Laisser passer'), description: tt('Ne pas prélever ce mois-ci.'), icon: Send },
  ];

  const departureOptions = [
    { id: 'settle_last_salary', title: tt('Solder sur le dernier salaire'), description: tt('Déduire le solde restant du dernier salaire.'), icon: Wallet },
    { id: 'create_remaining_debt', title: tt('Créer une dette restante'), description: tt('Enregistrer le solde restant comme dette à recouvrer.'), icon: FileCheck },
    { id: 'cancel_partially', title: tt('Annuler partiellement'), description: tt('Annuler une partie du solde selon les règles définies.'), icon: PieChart },
    { id: 'escalate', title: tt('Escalader RH/Finance'), description: tt('Transmettre le dossier au service RH/Finance pour décision.'), icon: Users },
    { id: 'block_final_balance', title: tt('Bloquer le solde de tout compte'), description: tt("Bloquer le versement du solde de tout compte."), icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <section className="flex justify-end">
        <button
          onClick={save}
          disabled={saving || !settings}
          className="inline-flex items-center gap-2 rounded bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {tt('Enregistrer les paramètres')}
        </button>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {settingTabs.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
                  active ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {section === 'advance' && (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-3 2xl:grid-cols-5">
            <SettingsCard icon={CheckCircle2} title={tt('Activation')}>
              <ToggleRow
                label={tt("Activer les demandes d'avance")}
                description={tt("Les collaborateurs pourront soumettre des demandes d'avance.")}
                checked={advanceEnabled}
                onChange={setAdvanceEnabled}
              />
            </SettingsCard>
            <SettingsCard icon={Wallet} title={tt("Plafond d'avance")} subtitle={tt('Limite maximale par demande')}>
              <CustomSelect
                value={advanceMaxType}
                onChange={(v) => setAdvanceMaxType(v)}
                options={[
                  { value: 'percent_net_salary', label: tt('Pourcentage du salaire net') },
                  { value: 'fixed_amount', label: tt('Montant fixe') },
                  { value: 'none', label: tt('Aucune limite') },
                ]}
                className="w-full"
              />
              <InputWithSuffix value={advanceMaxValue} onChange={setAdvanceMaxValue} suffix={advanceMaxType === 'percent_net_salary' ? '%' : settings?.currency ?? 'XOF'} />
              <InfoLine>{tt("Le plafond sera calculé sur le salaire net de l'employé.")}</InfoLine>
            </SettingsCard>
            <SettingsCard icon={CalendarDays} title={tt('Mensualités / Retenues')} subtitle={tt('Nombre maximum de retenues autorisées')}>
              <InputWithSuffix value={advanceMaxInstallments} onChange={setAdvanceMaxInstallments} suffix={tt('retenues')} />
            </SettingsCard>
            <SettingsCard icon={FileCheck} title={tt('Motif / Justificatif')}>
              <ToggleRow label={tt('Justificatif obligatoire à la demande')} checked={advanceProofRequired} onChange={setAdvanceProofRequired} />
              <ToggleRow label={tt('Motif obligatoire')} checked={advanceReasonRequired} onChange={setAdvanceReasonRequired} />
            </SettingsCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_2fr_1fr]">
            <SettingsCard icon={CalendarDays} title={tt('Première retenue')} subtitle={tt('Mois à partir duquel la retenue peut commencer')}>
              <RadioStack
                value={advanceFirstPayroll}
                onChange={setAdvanceFirstPayroll}
                options={[
                  ['current_month', tt('Mois courant')],
                  ['next_month', tt('Mois suivant')],
                  ['employee_choice', tt("Mois choisi par l'employé")],
                  ['tenant_configurable', tt('Configurable (tenant)')],
                ]}
              />
            </SettingsCard>
            <SettingsCard icon={CheckCircle2} title={tt('Règle si net insuffisant')} subtitle={tt('Comportement à appliquer si le net à payer est insuffisant pour la retenue')}>
              <ChoiceGrid options={insufficientOptions} value={advanceInsufficientNet} onChange={setAdvanceInsufficientNet} columns="md:grid-cols-4" />
            </SettingsCard>
            <SettingsCard icon={SlidersHorizontal} title={tt('Autres options')}>
              <ToggleRow label={tt('Autoriser plusieurs avances actives')} checked={advanceAllowMultiple} onChange={setAdvanceAllowMultiple} />
              <label className="text-sm font-medium text-gray-700">
                {tt('Délai minimum entre 2 avances')}
                <InputWithSuffix value={advanceMinDays} onChange={setAdvanceMinDays} suffix={tt('jours')} />
              </label>
            </SettingsCard>
          </div>

          <PolicyPreview
            title={tt("Aperçu de votre politique d'avance")}
            items={[
              [tt('Plafond'), advanceMaxType === 'percent_net_salary' ? `${advanceMaxValue}% ${tt('du salaire net')}` : `${advanceMaxValue} ${settings?.currency ?? 'XOF'}`, Percent],
              [tt('Max. retenues'), `${advanceMaxInstallments} ${tt('retenues')}`, CalendarDays],
              [tt('Première retenue'), firstPayrollLabel(advanceFirstPayroll, tt), CalendarDays],
              [tt('Justificatif'), advanceProofRequired ? tt('Obligatoire') : tt('Optionnel'), FileCheck],
              [tt('Règle net insuffisant'), policyLabel(advanceInsufficientNet, insufficientOptions), CheckCircle2],
              [tt('Avances actives'), advanceAllowMultiple ? tt('Autorisées') : tt('Non autorisées'), Users],
            ]}
          />
          <NoteBox>{tt("Ces paramètres s'appliquent uniquement aux demandes d'avance. Les paramètres des prêts et des décaissements sont configurés dans leurs sections respectives.")}</NoteBox>
        </div>
      )}

      {section === 'loan' && (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-4">
            <SettingsCard icon={CheckCircle2} title={tt('Activation')}>
              <ToggleRow label={tt('Activer les demandes de prêt')} description={tt('Les collaborateurs pourront soumettre des demandes de prêt.')} checked={loanEnabled} onChange={setLoanEnabled} />
            </SettingsCard>
            <SettingsCard icon={Wallet} title={tt('Plafond du prêt')} subtitle={tt('Limite maximale par demande')}>
              <CustomSelect
                value={loanMaxType}
                onChange={(v) => setLoanMaxType(v)}
                options={[
                  { value: 'months_net_salary', label: tt('Multiple du salaire') },
                  { value: 'percent_net_salary', label: tt('Pourcentage du salaire net') },
                  { value: 'fixed_amount', label: tt('Montant fixe') },
                ]}
                className="w-full"
              />
              <InputWithSuffix value={loanMaxValue} onChange={setLoanMaxValue} suffix={loanMaxType === 'months_net_salary' ? `x ${tt('salaire')}` : settings?.currency ?? 'XOF'} />
              <InfoLine>{tt('Les prêts sont sans intérêt.')}</InfoLine>
            </SettingsCard>
            <SettingsCard icon={CalendarDays} title={tt('Mensualités')} subtitle={tt('Nombre maximum de mensualités autorisées')}>
              <InputWithSuffix value={loanMaxInstallments} onChange={setLoanMaxInstallments} suffix={tt('mensualités')} />
            </SettingsCard>
            <SettingsCard icon={FileCheck} title={tt('Motif / Justificatif')}>
              <ToggleRow label={tt('Justificatif obligatoire à la demande')} checked={loanProofRequired} onChange={setLoanProofRequired} />
              <ToggleRow label={tt('Motif obligatoire')} checked={loanReasonRequired} onChange={setLoanReasonRequired} />
            </SettingsCard>
            <SettingsCard icon={Percent} title={tt("Taux d'endettement")} subtitle={tt('Seuil maximal calculé sur le salaire net')}>
              <ToggleRow label={tt("Bloquer les demandes au-delà du seuil")} checked={loanDebtRatioEnabled} onChange={setLoanDebtRatioEnabled} />
              <InputWithSuffix value={loanMaxDebtRatio} onChange={setLoanMaxDebtRatio} suffix="%" />
              <InfoLine>{tt('Le calcul inclut les prêts bancaires, les prêts internes et les avances actives.')}</InfoLine>
            </SettingsCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.1fr_1.05fr_0.55fr]">
            <SettingsCard icon={CheckCircle2} title={tt('Règle si net insuffisant')} subtitle={tt('Comportement à appliquer si le net à payer est insuffisant pour la mensualité')}>
              <ChoiceGrid options={insufficientOptions} value={loanInsufficientNet} onChange={setLoanInsufficientNet} columns="md:grid-cols-4" />
            </SettingsCard>
            <SettingsCard icon={Users} title={tt("Employé quitte l'entreprise avec un solde restant")} subtitle={tt('Action à appliquer en cas de départ du salarié avec un solde de prêt')}>
              <ChoiceGrid options={departureOptions} value={loanDeparturePolicy} onChange={setLoanDeparturePolicy} columns="md:grid-cols-5" compact />
            </SettingsCard>
            <SettingsCard icon={SlidersHorizontal} title={tt('Autres options')}>
              <ToggleRow label={tt('Plusieurs prêts actifs')} checked={loanAllowMultiple} onChange={setLoanAllowMultiple} />
              <label className="text-sm font-medium text-gray-700">
                {tt('Délai minimum entre 2 prêts')}
                <InputWithSuffix value={loanMinDays} onChange={setLoanMinDays} suffix={tt('jours')} />
              </label>
            </SettingsCard>
          </div>
          <PolicyPreview
            title={tt('Aperçu de votre politique de prêt')}
            items={[
              [tt('Sans intérêt'), tt('Les prêts sont sans intérêt'), Percent],
              [tt('Plafond du prêt'), loanMaxType === 'months_net_salary' ? `${loanMaxValue}x ${tt('salaire')}` : `${loanMaxValue} ${settings?.currency ?? 'XOF'}`, Wallet],
              [tt('Max. mensualités'), `${loanMaxInstallments} ${tt('mensualités')}`, CalendarDays],
              [tt("Taux d'endettement"), loanDebtRatioEnabled ? `${loanMaxDebtRatio}%` : tt('Désactivé'), Percent],
              [tt('Net insuffisant'), policyLabel(loanInsufficientNet, insufficientOptions), CheckCircle2],
              [tt('Départ salarié'), policyLabel(loanDeparturePolicy, departureOptions), Users],
            ]}
          />
          <NoteBox>{tt("Ces paramètres s'appliquent uniquement aux prêts. Les paramètres des avances et des décaissements sont configurés dans leurs sections respectives.")}</NoteBox>
        </div>
      )}

      {section === 'payout' && (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-3">
            <SettingsCard icon={CheckCircle2} title={tt('Traitement des décaissements')}>
              <ToggleRow label={tt("Activer le processus de décaissement par l'équipe Finance.")} checked={financeApprovalRequired} onChange={setFinanceApprovalRequired} />
            </SettingsCard>
            <SettingsCard icon={FileCheck} title={tt('Preuve de décaissement')}>
              <ToggleRow label={tt('Preuve obligatoire avant comptabilisation.')} checked={payoutProofRequired} onChange={setPayoutProofRequired} />
            </SettingsCard>
            <SettingsCard icon={Paperclip} title={tt('Référence de paiement')}>
              <ToggleRow label={tt('Référence de paiement obligatoire.')} checked={paymentReferenceRequired} onChange={setPaymentReferenceRequired} />
            </SettingsCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <SettingsCard icon={CreditCard} title={tt('Modes de paiement autorisés')} subtitle={tt('Sélectionnez les modes de paiement acceptés.')}>
              <CheckGrid
                values={allowedPayoutMethods}
                options={[
                  ['bank_transfer', tt('Virement bancaire')],
                  ['wave', 'Wave'],
                  ['orange_money', 'Orange Money'],
                  ['cash', tt('Espèces')],
                ]}
                onToggle={(value) => setAllowedPayoutMethods((items) => toggleArrayValue(items, value))}
              />
            </SettingsCard>
            <SettingsCard icon={Users} title={tt('Qui peut décaisser ?')} subtitle={tt('Sélectionnez les rôles autorisés à effectuer un décaissement.')}>
              <CheckGrid
                values={allowedPayoutRoles}
                options={[
                  ['finance', tt('Finance')],
                  ['admin', tt('Admin')],
                  ['dg', 'DG'],
                  ['rh', 'RH'],
                ]}
                onToggle={togglePayoutRole}
              />
            </SettingsCard>
            <SettingsCard icon={FileCheck} title={tt('Comptabilisation')}>
              <ToggleRow label={tt('Décaissement comptabilisé seulement après upload preuve.')} checked={accountingAfterProof} onChange={setAccountingAfterProof} />
              <div className="border-t pt-4 text-sm text-gray-600">
                <p className="font-semibold text-gray-900">{tt('Statut automatique')}</p>
                <p className="mt-3 font-semibold text-primary-700">{tt('Décaisser')} &gt; {tt('Preuve uploadée')} &gt; {tt('Comptabilisé')}</p>
              </div>
            </SettingsCard>
          </div>
          <SettingsCard icon={SlidersHorizontal} title={tt('Contrôles complémentaires')}>
            <div className="grid gap-4 md:grid-cols-3">
              <ToggleRow label={tt('Validation du montant avant décaissement')} checked={validateAmountBeforePayout} onChange={setValidateAmountBeforePayout} />
              <ToggleRow label={tt("Journaliser l'utilisateur qui décaisse")} checked={auditPayer} onChange={setAuditPayer} />
              <ToggleRow label={tt('Uploader plusieurs pièces')} checked={allowMultipleProofs} onChange={setAllowMultipleProofs} />
            </div>
          </SettingsCard>
          <PolicyPreview
            title={tt('Aperçu de votre politique de décaissement')}
            items={[
              [tt('Preuve'), payoutProofRequired ? tt('Obligatoire') : tt('Optionnelle'), CheckCircle2],
              [tt('Référence'), paymentReferenceRequired ? tt('Obligatoire') : tt('Optionnelle'), Paperclip],
              [tt('Modes autorisés'), allowedPayoutMethods.map((method) => payoutMethodLabel(method, tt)).join(', '), CreditCard],
              [tt('Rôles autorisés'), allowedPayoutRoles.map((role) => roleLabel(role, tt)).join(', '), Users],
              [tt('Comptabilisation'), accountingAfterProof ? tt('Après preuve') : tt('Immédiate'), FileCheck],
            ]}
          />
          <NoteBox>{tt("Si la règle « Comptabilisation après upload preuve » est activée, le dossier est considéré comme final uniquement après l'upload d'une preuve valide par l'équipe Finance.")}</NoteBox>
        </div>
      )}

      {section === 'repayment' && (
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-[0.8fr_1.7fr_1.1fr]">
            <SettingsCard icon={CalendarDays} title={tt('Gestion des échéances')}>
              <ToggleRow label={tt("Activer les reports/suspensions d'échéance")} description={tt('Autorise le report ou la suspension des échéances selon la politique définie.')} checked={allowInstallmentChanges} onChange={setAllowInstallmentChanges} />
              <CustomSelect
                value={installmentChangeMode}
                onChange={(v) => setInstallmentChangeMode(v)}
                options={[
                  { value: 'time_limited', label: tt('Encadré par une limite de temps') },
                  { value: 'manual_approval', label: tt('Sur validation RH/Finance') },
                  { value: 'unlimited', label: tt('Sans limite') },
                ]}
                className="w-full"
              />
            </SettingsCard>
            <SettingsCard icon={CheckCircle2} title={tt('Net insuffisant')} subtitle={tt('Comportement à appliquer si le net à payer est insuffisant.')}>
              <ChoiceGrid
                options={[
                  { id: 'block_payroll', title: tt('Bloquer la paie'), description: tt('La ligne de retenue est bloquée si le solde ne peut pas être prélevé.'), icon: PieChart },
                  { id: 'defer_installment', title: tt('Reporter la mensualité'), description: tt("L'échéance est reportée au mois suivant."), icon: Clock },
                  { id: 'partial_deduction', title: tt('Prélever partiellement'), description: tt('Prélever le montant disponible sur le net.'), icon: PieChart },
                  { id: 'allow_negative_balance', title: tt('Autoriser un solde négatif'), description: tt('Autorise un solde négatif temporaire.'), icon: MoreVertical },
                ]}
                value={repaymentInsufficientNet}
                onChange={setRepaymentInsufficientNet}
                columns="md:grid-cols-4"
              />
            </SettingsCard>
            <SettingsCard icon={AlertTriangle} title={tt("Statuts d'échéance")} subtitle={tt('Statuts gérés dans le cycle de remboursement.')}>
              <StatusLegend label={tt('À prélever')} description={tt('Échéance prévue pour prélèvement')} color="bg-blue-50 text-blue-700" />
              <StatusLegend label={tt('Prélevée')} description={tt('Échéance prélevée avec succès')} color="bg-emerald-50 text-emerald-700" />
              <StatusLegend label={tt('Reportée / Suspendue')} description={tt('Échéance reportée ou suspendue')} color="bg-orange-50 text-orange-700" />
              <StatusLegend label={tt('En retard')} description={tt('Échéance non prélevée à la date prévue')} color="bg-red-50 text-red-700" />
            </SettingsCard>
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.5fr_0.55fr_0.55fr_0.6fr]">
            <SettingsCard icon={Users} title={tt('Sortie employé avec solde restant')} subtitle={tt("Action à appliquer lors du départ de l'employé.")}>
              <ChoiceGrid options={departureOptions} value={departurePolicy} onChange={setDeparturePolicy} columns="md:grid-cols-5" />
            </SettingsCard>
            <SettingsCard icon={RefreshCw} title={tt('Synchronisation paie')} subtitle={tt("Règles d'intégration avec la paie.")}>
              <ToggleRow label={tt('La paie exécute uniquement les lignes prévues')} checked={payrollPlannedOnly} onChange={setPayrollPlannedOnly} />
              <ToggleRow label={tt('Aucune revalidation paie')} checked={noPayrollRevalidation} onChange={setNoPayrollRevalidation} />
              <ToggleRow label={tt('Créer les lignes automatiquement après décaissement')} checked={createPayrollLinesAfterPayout} onChange={setCreatePayrollLinesAfterPayout} />
            </SettingsCard>
            <SettingsCard icon={AlertTriangle} title={tt('Alertes & risque')} subtitle={tt('Gestion des alertes liées au suivi.')}>
              <ToggleRow label={tt("Marquer un dossier en risque si une échéance n'est pas prélevée")} checked={markRiskOnMissedDeduction} onChange={setMarkRiskOnMissedDeduction} />
              <ToggleRow label={tt('Alerte RH/Finance sur retard')} checked={alertHrFinanceOnLate} onChange={setAlertHrFinanceOnLate} />
              <ToggleRow label={tt("Notifier l'employé")} checked={notifyEmployeeOnLate} onChange={setNotifyEmployeeOnLate} />
            </SettingsCard>
            <SettingsCard icon={FileCheck} title={tt('Clôture du dossier')} subtitle={tt('Règles de clôture des dossiers.')}>
              <RadioStack
                value={closurePolicy}
                onChange={setClosurePolicy}
                options={[
                  ['active_until_paid', tt("Actif tant qu'il reste un solde")],
                  ['when_zero_balance', tt('Complété quand le restant dû = 0')],
                ]}
              />
            </SettingsCard>
          </div>
          <PolicyPreview
            title={tt('Aperçu de votre politique de remboursement & départ')}
            items={[
              [tt('Net insuffisant'), repaymentInsufficientNet === 'partial_deduction' ? tt('Prélèvement partiel') : policyLabel(repaymentInsufficientNet, insufficientOptions), CheckCircle2],
              [tt('Reports / Suspensions'), allowInstallmentChanges ? tt('Autorisés') : tt('Non autorisés'), CalendarDays],
              [tt('Départ employé'), policyLabel(departurePolicy, departureOptions), Users],
              [tt('Alerte retard'), alertHrFinanceOnLate ? tt('Active') : tt('Inactive'), AlertTriangle],
              [tt('Clôture dossier'), closurePolicy === 'when_zero_balance' ? tt('Auto à solde zéro') : tt('Manuelle'), FileCheck],
            ]}
          />
          <NoteBox>{tt("Ces paramètres définissent le comportement d'exécution des remboursements dans la paie et la gestion des dossiers lors du départ d'un employé. Ils ne modifient pas la validation des demandes.")}</NoteBox>
        </div>
      )}
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asBool(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;
}

function normalizePayoutMethods(values: string[]) {
  const next = new Set(values);
  if (next.has('mobile_money')) {
    next.delete('mobile_money');
    next.add('wave');
    next.add('orange_money');
  }
  return Array.from(next);
}

function asNumberString(value: unknown, fallback: string) {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function SettingsCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Settings;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3 border-b border-gray-100 pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary-700">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-primary-600' : 'bg-gray-300'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function InputWithSuffix({ value, onChange, suffix }: { value: string; onChange: (value: string) => void; suffix: string }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 pr-24 text-sm"
      />
      <span className="absolute right-3 top-2 text-sm font-medium text-gray-500">{suffix}</span>
    </div>
  );
}

function InfoLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 text-sm leading-6 text-gray-500">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function RadioStack({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <div className="space-y-3">
      {options.map(([id, label]) => (
        <label key={id} className="flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
          <input type="radio" checked={value === id} onChange={() => onChange(id)} className="h-4 w-4 accent-primary-600" />
          {label}
        </label>
      ))}
    </div>
  );
}

function ChoiceGrid({
  options,
  value,
  onChange,
  columns = 'md:grid-cols-3',
  compact = false,
}: {
  options: { id: string; title: string; description: string; icon: typeof Settings }[];
  value: string;
  onChange: (value: string) => void;
  columns?: string;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-3 ${columns}`}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`relative rounded-lg border p-4 text-left transition ${
              active ? 'border-primary-500 bg-primary-50/40 ring-1 ring-primary-500' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {active && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-primary-600" />}
            <Icon className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} mb-4 text-gray-700`} />
            <p className="text-sm font-semibold text-gray-900">{option.title}</p>
            <p className="mt-2 text-xs leading-5 text-gray-500">{option.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function CheckGrid({ values, options, onToggle }: { values: string[]; options: [string, string][]; onToggle: (value: string) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map(([id, label]) => {
        const checked = values.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-semibold ${
              checked ? 'border-primary-400 bg-primary-50 text-gray-900' : 'border-gray-200 text-gray-700'
            }`}
          >
            {label}
            <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${checked ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300'}`}>
              {checked && <CheckCircle2 className="h-4 w-4" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PolicyPreview({ title, items }: { title: string; items: [string, string, typeof Settings][] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-5 flex items-center gap-2 border-b border-gray-100 pb-4 text-base font-semibold text-gray-900">
        <Eye className="h-5 w-5 text-primary-600" />
        {title}
      </h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {items.map(([label, value, Icon]) => (
          <div key={label} className="flex items-center gap-3 border-gray-100 xl:border-r xl:last:border-r-0">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary-700">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold text-gray-500">{label}</p>
              <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NoteBox({ children }: { children: ReactNode }) {
  return (
    <section className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
      <Info className="h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">Note importante</p>
        <p className="mt-1 leading-6">{children}</p>
      </div>
    </section>
  );
}

function StatusLegend({ label, description, color }: { label: string; description: string; color: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3">
      <span className={`rounded px-3 py-2 text-sm font-semibold ${color}`}>{label}</span>
      <span className="text-sm text-gray-500">{description}</span>
    </div>
  );
}

function policyLabel(value: string, options: { id: string; title: string }[]) {
  return options.find((option) => option.id === value)?.title ?? value;
}

function firstPayrollLabel(value: string, tt: (text: string) => string) {
  const labels: Record<string, string> = {
    current_month: tt('Mois courant'),
    next_month: tt('Mois suivant'),
    employee_choice: tt("Mois choisi par l'employé"),
    tenant_configurable: tt('Configurable (tenant)'),
  };
  return labels[value] ?? value;
}

function payoutMethodLabel(value: string, tt: (text: string) => string) {
  const labels: Record<string, string> = {
    bank_transfer: tt('Virement bancaire'),
    mobile_money: 'Mobile money',
    wave: 'Wave',
    orange_money: 'Orange Money',
    cash: tt('Espèces'),
    check: tt('Chèque'),
  };
  return labels[value] ?? value;
}

function roleLabel(value: string, tt: (text: string) => string) {
  const labels: Record<string, string> = {
    finance: tt('Finance'),
    admin: tt('Admin'),
    dg: 'DG',
    rh: 'RH',
  };
  return labels[value] ?? value;
}

function DashboardView({
  requests,
  settings,
  onApprove,
  onReject,
  onMarkPaid,
}: {
  requests: EmployeeFinanceRequest[];
  settings: EmployeeFinanceSettings | null;
  onApprove: (request: EmployeeFinanceRequest) => void;
  onReject: (request: EmployeeFinanceRequest) => void;
  onMarkPaid: (request: EmployeeFinanceRequest) => void;
}) {
  const tt = useEmployeeFinanceText();
  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [startDate, setStartDate] = useState(isoDate(sixMonthsAgo));
  const [endDate, setEndDate] = useState(isoDate(today));
  const [typeFilter, setTypeFilter] = useState<'all' | 'advance' | 'loan'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeFinanceRequest['status']>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const currency = settings?.currency ?? requests[0]?.currency ?? 'XOF';
  const departments = useMemo(() => {
    const names = new Set<string>();
    requests.forEach((request) => {
      if (request.employee_department) names.add(request.employee_department);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const search = employeeSearch.trim().toLowerCase();
    return requests.filter((request) => {
      const date = requestDate(request);
      const name = (request.employee_name ?? '').toLowerCase();
      return (
        date >= start &&
        date <= end &&
        (typeFilter === 'all' || request.request_type === typeFilter) &&
        (statusFilter === 'all' || request.status === statusFilter) &&
        (departmentFilter === 'all' || request.employee_department === departmentFilter) &&
        (!search || name.includes(search))
      );
    });
  }, [departmentFilter, employeeSearch, endDate, requests, startDate, statusFilter, typeFilter]);

  const monthlyData = useMemo(() => {
    const months: { year: number; month: number }[] = [];
    const start = new Date(`${startDate}T00:00:00`);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const end = new Date(`${endDate}T23:59:59`);
    while (cursor <= end && months.length < 18) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months.map(({ year, month }) => {
      const monthRequests = filteredRequests.filter((request) => {
        const date = requestDate(request);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
      });
      const installments = filteredRequests.flatMap((request) => request.installments ?? []).filter((installment) =>
        installment.period_year === year && installment.period_month === month,
      );
      return {
        label: MONTHS_FR[month - 1].slice(0, 3),
        accordes: monthRequests
          .filter((request) => !['pending_hr', 'rejected', 'cancelled'].includes(request.status))
          .reduce((sum, request) => sum + requestAmount(request), 0),
        decaisses: monthRequests
          .filter((request) => Boolean(request.paid_at) || ['active', 'completed'].includes(request.status))
          .reduce((sum, request) => sum + requestAmount(request), 0),
        rembourses: installments.reduce((sum, installment) => sum + toNumber(installment.amount_deducted), 0),
        restant: monthRequests.reduce((sum, request) => sum + toNumber(request.remaining_amount), 0),
      };
    });
  }, [endDate, filteredRequests, startDate]);

  const kpis = useMemo(() => {
    const totalInProgress = filteredRequests
      .filter((request) => !['completed', 'rejected', 'cancelled'].includes(request.status))
      .reduce((sum, request) => sum + (toNumber(request.remaining_amount) || requestAmount(request)), 0);
    const pendingCount = filteredRequests.filter((request) => request.status === 'pending_hr').length;
    const toPayout = filteredRequests
      .filter((request) => ['pending_finance', 'approved'].includes(request.status))
      .reduce((sum, request) => sum + requestAmount(request), 0);
    const reimbursed = filteredRequests
      .flatMap((request) => request.installments ?? [])
      .reduce((sum, installment) => sum + toNumber(installment.amount_deducted), 0);
    const atRisk = filteredRequests.filter((request) =>
      request.installments?.some((installment) => installment.status === 'pending' && isPastPeriod(installment.period_year, installment.period_month)),
    ).length;
    const approvedTotal = filteredRequests.reduce((sum, request) => sum + requestAmount(request), 0);
    const monthlyTotal = filteredRequests.reduce((sum, request) => sum + toNumber(request.monthly_amount), 0);
    const engagementRate = approvedTotal > 0 ? Math.round((monthlyTotal / approvedTotal) * 100) : 0;
    return { totalInProgress, pendingCount, toPayout, reimbursed, atRisk, engagementRate };
  }, [filteredRequests, tt]);

  const typeData = useMemo(() => {
    const totals = filteredRequests.reduce<Record<string, number>>((acc, request) => {
      const key = request.request_type === 'advance' ? tt('Avance sur salaire') : tt('Prêt interne');
      acc[key] = (acc[key] ?? 0) + requestAmount(request);
      return acc;
    }, {});
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [filteredRequests, tt]);

  const requestsToProcess = filteredRequests
    .filter((request) => ['pending_hr', 'pending_finance', 'approved'].includes(request.status))
    .slice(0, 6);

  const activeRepayments = filteredRequests
    .filter((request) => ['active', 'completed'].includes(request.status) && toNumber(request.remaining_amount) > 0)
    .slice(0, 6);

  const topDepartments = useMemo(() => {
    const totals = filteredRequests.reduce<Record<string, number>>((acc, request) => {
      const dept = request.employee_department || tt('Non renseigné');
      acc[dept] = (acc[dept] ?? 0) + (toNumber(request.remaining_amount) || requestAmount(request));
      return acc;
    }, {});
    const max = Math.max(...Object.values(totals), 1);
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value, pct: Math.round((value / max) * 100) }));
  }, [filteredRequests]);

  const alerts = [
    {
      label: tt('Remboursement en retard'),
      count: filteredRequests.filter((request) =>
        request.installments?.some((installment) => installment.status === 'pending' && isPastPeriod(installment.period_year, installment.period_month)),
      ).length,
      color: 'bg-red-100 text-red-700',
      icon: Clock,
    },
    {
      label: tt('Plafond dépassé'),
      count: filteredRequests.filter((request) => {
        const typeSettings = request.request_type === 'advance' ? settings?.advance_settings : settings?.loan_settings;
        const max = Number(typeSettings?.max_amount_value ?? 0);
        return max > 0 && requestAmount(request) > max && typeSettings?.max_amount_type === 'fixed_amount';
      }).length,
      color: 'bg-orange-100 text-orange-700',
      icon: AlertTriangle,
    },
    {
      label: tt('Dossiers à décaisser'),
      count: filteredRequests.filter((request) => ['pending_finance', 'approved'].includes(request.status)).length,
      color: 'bg-blue-100 text-blue-700',
      icon: Banknote,
    },
  ];

  const exportCsv = () => {
    const rows = [
      [tt('Employé'), tt('Département'), tt('Type'), tt('Statut'), tt('Montant demandé'), tt('Montant approuvé'), tt('Restant dû'), tt('Mensualité'), tt('Première retenue')],
      ...filteredRequests.map((request) => [
        request.employee_name ?? '',
        request.employee_department ?? '',
        request.request_type === 'advance' ? tt('Avance') : tt('Prêt'),
        tt(EMPLOYEE_FINANCE_STATUS[request.status]?.label ?? request.status),
        String(request.amount_requested ?? ''),
        String(request.amount_approved ?? ''),
        String(request.remaining_amount ?? ''),
        String(request.monthly_amount ?? ''),
        monthLabel(request.first_payroll_year, request.first_payroll_month),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `avances-prets-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm font-medium text-gray-700 xl:col-span-2">
            {tt('Période')}
            <div className="mt-1 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              <CustomDatePicker value={startDate} onChange={setStartDate} className="w-full" />
              <CustomDatePicker value={endDate} onChange={setEndDate} className="w-full" />
            </div>
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Type')}
            <CustomSelect
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as typeof typeFilter)}
              options={[
                { value: 'all', label: tt('Tous') },
                { value: 'advance', label: tt('Avances') },
                { value: 'loan', label: tt('Prêts') },
              ]}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Statut')}
            <CustomSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { value: 'all', label: tt('Tous') },
                ...Object.entries(EMPLOYEE_FINANCE_STATUS).map(([value, cfg]) => (
                ({ value: String(value), label: tt(cfg.label) })
              )),
              ]}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Département')}
            <CustomSelect
              value={departmentFilter}
              onChange={(v) => setDepartmentFilter(v)}
              options={[
                { value: 'all', label: tt('Tous') },
                ...departments.map((dept) => ({ value: String(dept), label: dept })),
              ]}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Employé')}
            <div className="relative mt-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder={tt('Rechercher...')} className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm" />
            </div>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            <Download className="h-4 w-4" />
            {tt('Exporter CSV')}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: tt('Montant total en cours'), value: formatMoney(kpis.totalInProgress, currency), icon: Wallet, color: 'bg-blue-600' },
          { label: tt('Demandes en attente'), value: kpis.pendingCount, icon: Clock, color: 'bg-orange-500' },
          { label: tt('À décaisser'), value: formatMoney(kpis.toPayout, currency), icon: Download, color: 'bg-blue-600' },
          { label: tt('Remboursé'), value: formatMoney(kpis.reimbursed, currency), icon: CheckCircle2, color: 'bg-green-600' },
          { label: tt('Dossiers à risque'), value: kpis.atRisk, icon: AlertTriangle, color: 'bg-red-600' },
          { label: tt("Taux d'engagement moyen"), value: `${kpis.engagementRate} %`, icon: Percent, color: 'bg-violet-600' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full text-white ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">{card.label}</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{card.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-5 xl:col-span-3">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{tt('Évolution mensuelle')}</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatCompact} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                <Legend />
                <Bar dataKey="accordes" name={tt('Accordés')} fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="decaisses" name={tt('Décaissés')} fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rembourses" name={tt('Remboursés')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="restant" name={tt('Capital restant dû')} stroke="#1e3a8a" strokeWidth={2} dot />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{tt('Répartition par type')}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie data={typeData} innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                    {typeData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 self-center">
              {typeData.map((entry, index) => {
                const total = typeData.reduce((sum, item) => sum + item.value, 0) || 1;
                return (
                  <div key={entry.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                      {entry.name}
                    </span>
                    <span className="font-medium text-gray-900">{Math.round((entry.value / total) * 100)} %</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-5">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white xl:col-span-3">
          <h2 className="border-b px-5 py-4 text-base font-semibold text-gray-900">{tt('Demandes à traiter')}</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">{tt('Employé')}</th>
                <th className="px-5 py-3">{tt('Type')}</th>
                <th className="px-5 py-3 text-right">Montant</th>
                <th className="px-5 py-3">{tt('Date')}</th>
                <th className="px-5 py-3">{tt('Statut')}</th>
                <th className="px-5 py-3 text-right">{tt('Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requestsToProcess.map((request) => (
                <tr key={request.id}>
                  <td className="px-5 py-3 text-gray-900">{request.employee_name ?? `#${request.employee_id}`}</td>
                  <td className="px-5 py-3 text-gray-600">{requestTypeLabel(request, tt)}</td>
                  <td className="px-5 py-3 text-right font-medium">{formatMoney(requestAmount(request), request.currency)}</td>
                  <td className="px-5 py-3 text-gray-600">{request.created_at ? new Date(request.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                  <td className="px-5 py-3"><StatusBadge status={request.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      {request.status === 'pending_hr' ? (
                        <>
                          <button onClick={() => onApprove(request)} className="rounded px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50">{tt('Approuver')}</button>
                          <button onClick={() => onReject(request)} className="rounded px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">{tt('Rejeter')}</button>
                        </>
                      ) : (
                        <button onClick={() => onMarkPaid(request)} className="rounded px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50">{tt('Décaisser')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {requestsToProcess.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">{tt('Aucune demande à traiter')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{tt('Alertes intelligentes')}</h2>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const Icon = alert.icon;
              return (
                <div key={alert.label} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <span className="flex items-center gap-3 text-sm text-gray-700">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${alert.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    {alert.label}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${alert.color}`}>{alert.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-5">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white xl:col-span-3">
          <h2 className="border-b px-5 py-4 text-base font-semibold text-gray-900">{tt('Remboursements actifs')}</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">{tt('Employé')}</th>
                <th className="px-5 py-3 text-right">{tt('Montant initial')}</th>
                <th className="px-5 py-3 text-right">{tt('Restant dû')}</th>
                <th className="px-5 py-3 text-right">{tt('Mensualité')}</th>
                <th className="px-5 py-3">{tt('Prochaine retenue')}</th>
                <th className="px-5 py-3">{tt('Statut')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeRepayments.map((request) => {
                const next = request.installments?.find((installment) => installment.status === 'pending');
                return (
                  <tr key={request.id}>
                    <td className="px-5 py-3 text-gray-900">{request.employee_name ?? `#${request.employee_id}`}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(requestAmount(request), request.currency)}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(request.remaining_amount, request.currency)}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(request.monthly_amount, request.currency)}</td>
                    <td className="px-5 py-3 text-gray-600">{next ? monthLabel(next.period_year, next.period_month) : '-'}</td>
                    <td className="px-5 py-3"><StatusBadge status={request.status} /></td>
                  </tr>
                );
              })}
              {activeRepayments.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Aucun remboursement actif</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-gray-900">{tt('Top départements')}</h2>
          <div className="space-y-4">
            {topDepartments.map((dept) => (
              <div key={dept.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-700"><Briefcase className="h-4 w-4 text-gray-400" />{dept.name}</span>
                  <span className="font-medium text-gray-900">{formatMoney(dept.value, currency)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-primary-600" style={{ width: `${dept.pct}%` }} />
                </div>
              </div>
            ))}
            {topDepartments.length === 0 && <p className="py-8 text-center text-sm text-gray-400">{tt('Aucune donnée département')}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function NewRequestModal({
  onClose,
  onCreated,
  defaultType = 'advance',
  lockType = false,
  title = 'Nouvelle demande',
}: {
  onClose: () => void;
  onCreated: () => void;
  defaultType?: 'advance' | 'loan';
  lockType?: boolean;
  title?: string;
}) {
  const tt = useEmployeeFinanceText();
  const nextPayroll = new Date();
  nextPayroll.setMonth(nextPayroll.getMonth() + 1);
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [requestType, setRequestType] = useState<'advance' | 'loan'>(defaultType);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [firstPayrollYear, setFirstPayrollYear] = useState(String(nextPayroll.getFullYear()));
  const [firstPayrollMonth, setFirstPayrollMonth] = useState(String(nextPayroll.getMonth() + 1));
  const [installmentsCount, setInstallmentsCount] = useState('3');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const data = await getEmployees({ page_size: 500, status: 'active' });
        if (mounted) setEmployees(data.items ?? []);
      } catch {
        if (mounted) {
          setEmployees([]);
          toast.error(tt('Erreur de chargement des employés'));
        }
      } finally {
        if (mounted) setLoadingEmployees(false);
      }
    };

    loadEmployees();
    return () => {
      mounted = false;
    };
  }, [tt]);

  const employeeOptions = useMemo(() => employees.map((employee) => {
    const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || `${tt('Employé')} #${employee.id}`;
    const details = [
      employee.employee_id ? `Matricule: ${employee.employee_id}` : null,
      employee.department_name,
      employee.position || employee.job_title,
    ].filter(Boolean);

    return {
      value: String(employee.id),
      label: fullName,
      subtitle: details.join(' · '),
    };
  }), [employees, tt]);

  const submit = async () => {
    const parsedEmployeeId = Number(employeeId);
    const parsedAmount = Number(amount);
    if (!parsedEmployeeId || !parsedAmount) {
      toast.error(tt('Renseignez l’employé et le montant'));
      return;
    }
    setSaving(true);
    try {
      await employeeFinanceApi.createRequest({
        employee_id: parsedEmployeeId,
        request_type: requestType,
        amount_requested: parsedAmount,
        reason: reason || undefined,
        first_payroll_year: Number(firstPayrollYear),
        first_payroll_month: Number(firstPayrollMonth),
        installments_count: requestType === 'loan' ? Number(installmentsCount || 1) : undefined,
      });
      toast.success(tt('Demande créée'));
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt('Erreur'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{tt(title)}</h2>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title={tt('Fermer')}>
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            {tt('Employé')}
            <SearchableSelect
              value={employeeId}
              onChange={setEmployeeId}
              options={employeeOptions}
              placeholder={loadingEmployees ? tt('Chargement des employés...') : tt('Sélectionner un employé')}
              searchPlaceholder={tt('Rechercher un employé...')}
              emptyLabel={tt('Aucun employé disponible')}
              disabled={loadingEmployees || saving}
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Type')}
            <CustomSelect
              value={requestType}
              onChange={(v) => setRequestType(v as typeof requestType)}
              disabled={lockType}
              options={[
                { value: 'advance', label: tt('Avance sur salaire') },
                { value: 'loan', label: tt('Prêt interne') },
              ]}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Montant demandé')}
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Ex: 500000"
            />
          </label>
          {requestType === 'loan' && (
            <label className="text-sm font-medium text-gray-700">
              {tt('Mensualités')}
              <input
                type="number"
                min={1}
                value={installmentsCount}
                onChange={(event) => setInstallmentsCount(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="text-sm font-medium text-gray-700">
            {tt('Première retenue')}
            <CustomSelect
              value={firstPayrollMonth}
              onChange={(v) => setFirstPayrollMonth(v)}
              options={[
                ...MONTHS_FR.map((month, index) => (
                ({ value: String(index + 1), label: month })
              )),
              ]}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Année')}
            <input
              type="number"
              value={firstPayrollYear}
              onChange={(event) => setFirstPayrollYear(event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-gray-700 md:col-span-2">
            {tt('Motif')}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder={tt('Motif de la demande')}
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t px-5 py-4">
          <button onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {tt('Annuler')}
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {tt('Créer')}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestsModule({
  requests,
  settings,
  onApprove,
  onReject,
  onMarkPaid,
  onRefresh,
}: {
  requests: EmployeeFinanceRequest[];
  settings: EmployeeFinanceSettings | null;
  onApprove: (request: EmployeeFinanceRequest) => void;
  onReject: (request: EmployeeFinanceRequest) => void;
  onMarkPaid: (request: EmployeeFinanceRequest) => void;
  onRefresh: () => void;
}) {
  const tt = useEmployeeFinanceText();
  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const [showFilters, setShowFilters] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [startDate, setStartDate] = useState(isoDate(sixMonthsAgo));
  const [endDate, setEndDate] = useState(isoDate(today));
  const [typeFilter, setTypeFilter] = useState<'all' | 'advance' | 'loan'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeFinanceRequest['status']>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | RequestPriority>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'pending' | 'analysis' | 'approved'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const departments = useMemo(() => {
    const values = new Set<string>();
    requests.forEach((request) => {
      if (request.employee_department) values.add(request.employee_department);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const search = employeeSearch.trim().toLowerCase();
    return requests.filter((request) => {
      const date = requestDate(request);
      const name = (request.employee_name ?? `#${request.employee_id}`).toLowerCase();
      const priority = getRequestPriority(request);
      const quickMatch =
        quickFilter === 'all' ||
        (quickFilter === 'pending' && request.status === 'pending_hr') ||
        (quickFilter === 'analysis' && ['pending_finance', 'approved'].includes(request.status)) ||
        (quickFilter === 'approved' && ['paid_out', 'active', 'completed'].includes(request.status));
      return (
        date >= start &&
        date <= end &&
        quickMatch &&
        (typeFilter === 'all' || request.request_type === typeFilter) &&
        (statusFilter === 'all' || request.status === statusFilter) &&
        (priorityFilter === 'all' || priority === priorityFilter) &&
        (departmentFilter === 'all' || request.employee_department === departmentFilter) &&
        (!search || name.includes(search) || requestRef(request).toLowerCase().includes(search))
      );
    });
  }, [departmentFilter, employeeSearch, endDate, priorityFilter, quickFilter, requests, startDate, statusFilter, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, employeeSearch, endDate, pageSize, priorityFilter, quickFilter, startDate, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const paginatedRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);
  const selectedRequest = filteredRequests.find((request) => request.id === selectedId) ?? paginatedRequests[0] ?? filteredRequests[0] ?? null;
  const selectedRisk = selectedRequest ? getRiskLabel(selectedRequest) : null;
  const selectedPriority = selectedRequest ? priorityConfig[getRequestPriority(selectedRequest)] : null;
  const estimatedRate = selectedRequest && toNumber(selectedRequest.monthly_amount) > 0 && requestAmount(selectedRequest) > 0
    ? Math.round((toNumber(selectedRequest.monthly_amount) / requestAmount(selectedRequest)) * 100)
    : null;

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const kpis = {
    total: filteredRequests.length,
    pending: filteredRequests.filter((request) => request.status === 'pending_hr').length,
    approvedThisMonth: filteredRequests.filter((request) => {
      const date = requestDate(request);
      return ['paid_out', 'active', 'completed'].includes(request.status) && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length,
    rejected: filteredRequests.filter((request) => request.status === 'rejected').length,
  };

  const exportCsv = () => {
    const rows = [
      ['Réf', 'Employé', 'Type', 'Montant demandé', 'Département', 'Date', 'Priorité', 'Statut'],
      ...filteredRequests.map((request) => [
        requestRef(request),
        request.employee_name ?? `#${request.employee_id}`,
        requestTypeLabel(request, tt),
        String(request.amount_requested ?? ''),
        request.employee_department ?? '',
        request.created_at ? new Date(request.created_at).toLocaleDateString('fr-FR') : '',
        tt(priorityConfig[getRequestPriority(request)].label),
        tt(statusPill[request.status]?.label ?? request.status),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `demandes-avances-prets-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const activities = selectedRequest
    ? [
        { label: tt('Demande soumise'), detail: tt('Par l’employé'), icon: Send, color: 'bg-blue-600', active: true },
        { label: tt('Validation RH'), detail: selectedRequest.status === 'pending_hr' ? tt('En attente de validation') : tt('Traitée'), icon: CheckCircle2, color: 'bg-violet-600', active: selectedRequest.status !== 'pending_hr' },
        { label: selectedRequest.status === 'rejected' ? tt('Demande rejetée') : tt('Analyse Finance'), detail: selectedRequest.status === 'pending_finance' ? tt('En cours d’analyse') : tt('Circuit finance'), icon: selectedRequest.status === 'rejected' ? XCircle : Search, color: selectedRequest.status === 'rejected' ? 'bg-red-600' : 'bg-cyan-600', active: ['rejected', 'pending_finance', 'approved', 'paid_out', 'active', 'completed'].includes(selectedRequest.status) },
        { label: tt('Décaissement'), detail: selectedRequest.paid_at ? tt('Preuve enregistrée') : tt('En attente Finance'), icon: Clock, color: 'bg-orange-500', active: Boolean(selectedRequest.paid_at) },
      ]
    : [];

  return (
    <div className="space-y-6">
      {showNewRequest && <NewRequestModal onClose={() => setShowNewRequest(false)} onCreated={onRefresh} />}

      <section className="flex flex-wrap justify-end gap-3">
        <div className="flex flex-wrap gap-3">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download className="h-4 w-4" />
            {tt('Exporter')}
          </button>
          <button onClick={() => setShowFilters((value) => !value)} className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            {tt('Filtres avancés')}
          </button>
          <button onClick={() => setShowNewRequest(true)} className="inline-flex items-center gap-2 rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            <Plus className="h-4 w-4" />
            {tt('Nouvelle demande')}
          </button>
        </div>
      </section>

      {showFilters && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="text-sm font-medium text-gray-700 xl:col-span-2">
              {tt('Période')}
              <div className="mt-1 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                <CustomDatePicker value={startDate} onChange={setStartDate} className="w-full" />
                <CustomDatePicker value={endDate} onChange={setEndDate} className="w-full" />
              </div>
            </label>
            <label className="text-sm font-medium text-gray-700">
              {tt('Type')}
              <CustomSelect
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as typeof typeFilter)}
                options={[
                  { value: 'all', label: tt('Tous') },
                  { value: 'advance', label: tt('Avance') },
                  { value: 'loan', label: tt('Prêt') },
                ]}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              {tt('Statut')}
              <CustomSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: 'all', label: tt('Tous') },
                  ...Object.entries(statusPill).map(([value, cfg]) => (
                  ({ value: String(value), label: tt(cfg.label) })
                )),
                ]}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              {tt('Département')}
              <CustomSelect
                value={departmentFilter}
                onChange={(v) => setDepartmentFilter(v)}
                options={[
                  { value: 'all', label: tt('Tous') },
                  ...departments.map((department) => (
                  ({ value: String(department), label: department })
                )),
                ]}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              {tt('Priorité')}
              <CustomSelect
                value={priorityFilter}
                onChange={(v) => setPriorityFilter(v as typeof priorityFilter)}
                options={[
                  { value: 'all', label: tt('Toutes') },
                  { value: 'high', label: tt('Haute') },
                  { value: 'medium', label: tt('Moyenne') },
                  { value: 'low', label: tt('Basse') },
                ]}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-700 xl:col-span-2">
              {tt('Employé')}
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder={tt('Rechercher un employé...')} className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm" />
              </div>
            </label>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: tt('Total des demandes'), value: kpis.total, icon: FileCheck, color: 'bg-blue-600' },
          { label: tt('En attente de validation'), value: kpis.pending, icon: Clock, color: 'bg-orange-500' },
          { label: tt('Approuvées ce mois'), value: kpis.approvedThisMonth, icon: CheckCircle2, color: 'bg-teal-600' },
          { label: tt('Rejetées'), value: kpis.rejected, icon: XCircle, color: 'bg-red-600' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white ${card.color}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{tt('Liste des demandes')}</h2>
              <span className="rounded bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">{filteredRequests.length} {tt('résultats')}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {[
                { id: 'all', label: tt('Toutes') },
                { id: 'pending', label: tt('En attente') },
                { id: 'analysis', label: tt('À analyser') },
                { id: 'approved', label: tt('Approuvées') },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setQuickFilter(item.id as typeof quickFilter)}
                  className={`rounded border px-4 py-2 text-sm font-medium ${
                    quickFilter === item.id ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-white text-left text-xs font-semibold text-gray-500">
                <tr>
                  <th className="px-5 py-3">{tt('Réf')}</th>
                  <th className="px-5 py-3">{tt('Employé')}</th>
                  <th className="px-5 py-3">{tt('Type')}</th>
                  <th className="px-5 py-3 text-right">{tt('Montant demandé')}</th>
                  <th className="px-5 py-3">{tt('Département')}</th>
                  <th className="px-5 py-3">{tt('Date')}</th>
                  <th className="px-5 py-3">{tt('Priorité')}</th>
                  <th className="px-5 py-3">{tt('Statut')}</th>
                  <th className="px-5 py-3 text-right">{tt('Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRequests.map((request) => {
                  const priority = priorityConfig[getRequestPriority(request)];
                  const active = selectedRequest?.id === request.id;
                  return (
                    <tr key={request.id} onClick={() => setSelectedId(request.id)} className={`cursor-pointer hover:bg-gray-50 ${active ? 'bg-primary-50/60' : ''}`}>
                      <td className="px-5 py-4 font-semibold text-primary-700">{requestRef(request)}</td>
                      <td className="px-5 py-4 text-gray-800">{request.employee_name ?? `#${request.employee_id}`}</td>
                      <td className="px-5 py-4 text-gray-600">{requestTypeLabel(request, tt)}</td>
                      <td className="px-5 py-4 text-right font-medium text-gray-900">{formatMoney(request.amount_requested, request.currency)}</td>
                      <td className="px-5 py-4 text-gray-600">{request.employee_department ?? '-'}</td>
                      <td className="px-5 py-4 text-gray-600">{request.created_at ? new Date(request.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                      <td className="px-5 py-4"><span className={`rounded px-3 py-1 text-xs font-semibold ${priority.color}`}>{tt(priority.label)}</span></td>
                      <td className="px-5 py-4"><RequestStatusPill status={request.status} /></td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={(event) => { event.stopPropagation(); setSelectedId(request.id); }} className="rounded border border-primary-200 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50">
                          {tt('Voir')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paginatedRequests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-gray-400">{tt('Aucune demande')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t px-5 py-4 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-3 text-sm text-gray-500">
              {tt('Lignes par page:')}
              <CustomSelect
                value={String(pageSize)}
                onChange={(v) => setPageSize(Number(v))}
                options={[
                  { value: String(10), label: '10' },
                  { value: String(20), label: '20' },
                  { value: String(50), label: '50' },
                ]}
              />
            </label>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((item) => (
                <button key={item} onClick={() => setPage(item)} className={`rounded border px-3 py-2 text-sm font-medium ${page === item ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {item}
                </button>
              ))}
              {totalPages > 5 && <span className="px-2 text-sm text-gray-400">...</span>}
              {totalPages > 5 && (
                <button onClick={() => setPage(totalPages)} className={`rounded border px-3 py-2 text-sm font-medium ${page === totalPages ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {totalPages}
                </button>
              )}
              <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{tt('Détail rapide')}</h2>
              {selectedRequest && <RequestStatusPill status={selectedRequest.status} />}
            </div>
            {selectedRequest ? (
              <>
                <dl className="space-y-3 text-sm">
                  {[
                    [tt('Réf'), requestRef(selectedRequest)],
                    [tt('Employé'), selectedRequest.employee_name ?? `#${selectedRequest.employee_id}`],
                    [tt('Type'), requestTypeLabel(selectedRequest, tt)],
                    [tt('Montant demandé'), formatMoney(selectedRequest.amount_requested, selectedRequest.currency)],
                    [tt('Salaire net'), tt('Non renseigné')],
                    [tt('Taux engagé actuel'), tt('Non renseigné')],
                    [tt('Taux après demande'), estimatedRate == null ? tt('Non renseigné') : `${estimatedRate} %`],
                    [tt('Validateur actuel'), selectedRequest.status === 'pending_hr' ? 'RH' : ['pending_finance', 'approved'].includes(selectedRequest.status) ? 'Finance' : '-'],
                    [tt('Risque'), selectedRisk?.label ? tt(selectedRisk.label) : '-'],
                    [tt('Priorité'), selectedPriority?.label ? tt(selectedPriority.label) : '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <dt className="text-gray-500">{label}</dt>
                      <dd className={`text-right font-semibold ${label === tt('Risque') ? selectedRisk?.color.split(' ').find((item) => item.startsWith('text-')) ?? 'text-gray-900' : 'text-gray-900'}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 grid gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button disabled={selectedRequest.status !== 'pending_hr'} onClick={() => onApprove(selectedRequest)} className="inline-flex items-center justify-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40">
                      <CheckCircle2 className="h-4 w-4" />
                      {tt('Approuver')}
                    </button>
                    <button disabled={selectedRequest.status !== 'pending_hr'} onClick={() => onReject(selectedRequest)} className="inline-flex items-center justify-center gap-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40">
                      <XCircle className="h-4 w-4" />
                      {tt('Rejeter')}
                    </button>
                  </div>
                  {['pending_finance', 'approved'].includes(selectedRequest.status) && (
                    <button onClick={() => onMarkPaid(selectedRequest)} className="inline-flex items-center justify-center gap-2 rounded border border-primary-300 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100">
                      <Download className="h-4 w-4" />
                      {tt('Marquer versée')}
                    </button>
                  )}
                  <button onClick={() => toast(tt('Demande d’informations à connecter au workflow notifications'))} className="inline-flex items-center justify-center gap-2 rounded border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                    <Info className="h-4 w-4" />
                    {tt('Demander des infos')}
                  </button>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">{tt('Sélectionnez une demande')}</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{tt('Activité récente')}</h2>
            <div className="space-y-4">
              {activities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.label} className={`flex gap-3 ${activity.active ? '' : 'opacity-45'}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${activity.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{activity.label}</p>
                      <p className="text-xs text-gray-500">{activity.detail}</p>
                    </div>
                    <span className="text-right text-xs text-gray-400">
                      {selectedRequest?.created_at ? new Date(selectedRequest.created_at).toLocaleDateString('fr-FR') : '-'}
                    </span>
                  </div>
                );
              })}
              {activities.length === 0 && <p className="py-8 text-center text-sm text-gray-400">{tt('Aucune activité')}</p>}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function AdvancesModule({
  requests,
  settings,
  onRefresh,
}: {
  requests: EmployeeFinanceRequest[];
  settings: EmployeeFinanceSettings | null;
  onRefresh: () => void;
}) {
  const tt = useEmployeeFinanceText();
  const today = new Date();
  const advanceRequests = useMemo(() => requests.filter((request) => request.request_type === 'advance'), [requests]);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'settled' | 'late' | 'to_payout' | 'pending' | 'rejected'>('in_progress');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const currency = settings?.currency ?? advanceRequests[0]?.currency ?? 'XOF';
  const departments = useMemo(() => {
    const values = new Set<string>();
    advanceRequests.forEach((request) => {
      if (request.employee_department) values.add(request.employee_department);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [advanceRequests]);

  const advanceState = (request: EmployeeFinanceRequest) => {
    const remaining = toNumber(request.remaining_amount);
    const hasLateInstallment = request.installments?.some((installment) =>
      installment.status === 'pending' && isPastPeriod(installment.period_year, installment.period_month),
    );
    if (request.status === 'rejected') return 'rejected';
    if (hasLateInstallment) return 'late';
    if (request.status === 'completed' || remaining === 0 && ['paid_out', 'active', 'completed'].includes(request.status)) return 'settled';
    if (['pending_finance', 'approved'].includes(request.status)) return 'to_payout';
    if (request.status === 'pending_hr') return 'pending';
    return 'in_progress';
  };

  const advanceStateConfig: Record<ReturnType<typeof advanceState>, { label: string; color: string }> = {
    in_progress: { label: 'En cours', color: 'bg-emerald-50 text-emerald-700' },
    settled: { label: 'Soldée', color: 'bg-gray-100 text-gray-600' },
    late: { label: 'En retard', color: 'bg-red-50 text-red-700' },
    to_payout: { label: 'À décaisser', color: 'bg-blue-50 text-blue-700' },
    pending: { label: 'En attente', color: 'bg-orange-50 text-orange-700' },
    rejected: { label: 'Rejetée', color: 'bg-red-50 text-red-700' },
  };

  const nextPendingInstallment = (request: EmployeeFinanceRequest) =>
    request.installments?.find((installment) => installment.status === 'pending');

  const endInstallment = (request: EmployeeFinanceRequest) =>
    request.installments?.[request.installments.length - 1];

  const nextDeductionLabel = (request: EmployeeFinanceRequest) => {
    const next = nextPendingInstallment(request);
    if (!next || advanceState(request) === 'settled') return '-';
    return shortDate(new Date(next.period_year, next.period_month - 1, 25));
  };

  const endDateLabel = (request: EmployeeFinanceRequest) => {
    const end = endInstallment(request);
    if (end) return monthLabel(end.period_year, end.period_month);
    const fallbackDate = new Date(request.first_payroll_year, request.first_payroll_month - 1, 1);
    fallbackDate.setMonth(fallbackDate.getMonth() + Math.max((request.installments_count ?? 1) - 1, 0));
    return monthLabel(fallbackDate.getFullYear(), fallbackDate.getMonth() + 1);
  };

  const employeeCode = (request: EmployeeFinanceRequest) => `EMP-${String(request.employee_id).padStart(5, '0')}`;

  const activeAdvances = advanceRequests.filter((request) => ['in_progress', 'late'].includes(advanceState(request)));
  const remainingTotal = activeAdvances.reduce((sum, request) => sum + (toNumber(request.remaining_amount) || requestAmount(request)), 0);
  const thisMonthDue = advanceRequests
    .flatMap((request) => request.installments ?? [])
    .filter((installment) => installment.status === 'pending' && installment.period_year === today.getFullYear() && installment.period_month === today.getMonth() + 1)
    .reduce((sum, installment) => sum + toNumber(installment.amount_due), 0);
  const fallbackMonthlyDue = activeAdvances.reduce((sum, request) => sum + toNumber(request.monthly_amount), 0);
  const averageAdvance = activeAdvances.length > 0 ? Math.round(remainingTotal / activeAdvances.length) : 0;

  const filterLabels = {
    in_progress: 'En cours',
    settled: 'Soldée',
    late: 'En retard',
    to_payout: 'À décaisser',
    pending: 'En attente',
    rejected: 'Rejetée',
  };

  const filteredAdvances = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    return advanceRequests.filter((request) => {
      const name = (request.employee_name ?? `#${request.employee_id}`).toLowerCase();
      const state = advanceState(request);
      return (
        (statusFilter === 'all' || state === statusFilter) &&
        (departmentFilter === 'all' || request.employee_department === departmentFilter) &&
        (!search || name.includes(search) || employeeCode(request).toLowerCase().includes(search) || advanceRef(request).toLowerCase().includes(search))
      );
    });
  }, [advanceRequests, departmentFilter, employeeSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, employeeSearch, pageSize, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAdvances.length / pageSize));
  const paginatedAdvances = filteredAdvances.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const rows = [
      ['Employé', 'Département', 'Montant initial', 'Restant dû', 'Mensualité', 'Prochaine retenue', 'Fin prévue', 'Statut'],
      ...filteredAdvances.map((request) => [
        request.employee_name ?? `#${request.employee_id}`,
        request.employee_department ?? '',
        String(request.amount_requested ?? ''),
        String(request.remaining_amount ?? ''),
        String(request.monthly_amount ?? ''),
        nextDeductionLabel(request),
        endDateLabel(request),
        advanceStateConfig[advanceState(request)].label,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'avances-suivi.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {showNewRequest && (
        <NewRequestModal
          onClose={() => setShowNewRequest(false)}
          onCreated={onRefresh}
          defaultType="advance"
          lockType
          title="Nouvelle avance"
        />
      )}

      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Avances</h1>
          <p className="mt-1 text-sm text-gray-500">Suivi de toutes les avances accordées aux collaborateurs.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Exporter
          </button>
          <button onClick={() => setShowNewRequest(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-700">
            <Plus className="h-4 w-4" />
            Nouvelle avance
          </button>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total des avances en cours', value: formatMoney(remainingTotal, currency), sub: 'Capital restant dû', icon: Wallet, color: 'bg-blue-50 text-blue-700' },
          { label: "Nombre d’avances actives", value: activeAdvances.length, sub: 'Collaborateurs concernés', icon: FileCheck, color: 'bg-emerald-50 text-emerald-700' },
          { label: 'À prélever sur la paie (ce mois)', value: formatMoney(thisMonthDue || fallbackMonthlyDue, currency), sub: 'Montant total prévu', icon: CalendarDays, color: 'bg-violet-50 text-violet-700' },
          { label: 'Avance moyenne par employé', value: formatMoney(averageAdvance, currency), sub: 'Employés avec avance active', icon: Percent, color: 'bg-orange-50 text-orange-700' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-5">
                <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${card.color}`}>
                  <Icon className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-600">{card.label}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="mt-1 text-sm text-gray-500">{card.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1.15fr_auto]">
          <label className="text-sm font-medium text-gray-600">
            {tt('Rechercher')}
            <div className="relative mt-2">
              <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
              <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Rechercher un employé..." className="w-full rounded-lg border border-gray-300 py-3 pl-4 pr-11 text-sm" />
            </div>
          </label>
          <label className="text-sm font-medium text-gray-600">
            Statut
            <CustomSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { value: 'all', label: 'Tous les statuts' },
                ...Object.entries(filterLabels).map(([value, label]) => (
                ({ value: String(value), label: label })
              )),
              ]}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm font-medium text-gray-600">
            Département
            <CustomSelect
              value={departmentFilter}
              onChange={(v) => setDepartmentFilter(v)}
              options={[
                { value: 'all', label: 'Tous les départements' },
                ...departments.map((department) => (
                ({ value: String(department), label: department })
              )),
              ]}
              className="mt-2 w-full"
            />
          </label>
          <div className="flex items-end">
            <button onClick={() => setShowAdvanced((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <SlidersHorizontal className="h-4 w-4" />
              Filtres avancés
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center gap-2 rounded bg-gray-100 px-3 py-2 text-sm text-gray-600">
              Statut: {filterLabels[statusFilter]}
              <button onClick={() => setStatusFilter('all')} className="text-gray-400 hover:text-gray-700">×</button>
            </span>
          )}
          {(statusFilter !== 'all' || departmentFilter !== 'all' || employeeSearch) && (
            <button
              onClick={() => {
                setEmployeeSearch('');
                setStatusFilter('all');
                setDepartmentFilter('all');
              }}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              Réinitialiser
            </button>
          )}
          {showAdvanced && <span className="text-sm text-gray-400">Filtres supplémentaires à connecter selon les données disponibles.</span>}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="border-b bg-white text-left text-xs font-semibold text-gray-600">
              <tr>
                <th className="px-5 py-4">Employé</th>
                <th className="px-5 py-4">Département</th>
                <th className="px-5 py-4">Montant initial</th>
                <th className="px-5 py-4">Restant dû</th>
                <th className="px-5 py-4">Mensualité</th>
                <th className="px-5 py-4">Prochaine retenue</th>
                <th className="px-5 py-4">Fin prévue</th>
                <th className="px-5 py-4">Statut</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedAdvances.map((request) => {
                const employeeName = request.employee_name ?? `Employé #${request.employee_id}`;
                const state = advanceState(request);
                const stateCfg = advanceStateConfig[state];
                const remaining = toNumber(request.remaining_amount);
                const remainingClass = state === 'late' ? 'text-red-600' : remaining > 0 ? 'text-orange-600' : 'text-emerald-600';
                return (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-5 py-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
                          {initials(employeeName)}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900">{employeeName}</p>
                          <p className="text-xs text-gray-500">{employeeCode(request)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-5 text-gray-700">{request.employee_department ?? '-'}</td>
                    <td className="px-5 py-5 font-medium text-gray-900">{formatMoney(request.amount_requested, request.currency)}</td>
                    <td className={`px-5 py-5 font-semibold ${remainingClass}`}>{formatMoney(request.remaining_amount ?? 0, request.currency)}</td>
                    <td className="px-5 py-5 text-gray-700">{formatMoney(request.monthly_amount ?? requestAmount(request), request.currency)}</td>
                    <td className="px-5 py-5 text-gray-700">{nextDeductionLabel(request)}</td>
                    <td className="px-5 py-5 text-gray-700">{endDateLabel(request)}</td>
                    <td className="px-5 py-5"><span className={`rounded px-3 py-1.5 text-xs font-semibold ${stateCfg.color}`}>{stateCfg.label}</span></td>
                    <td className="px-5 py-5">
                      <div className="flex justify-end gap-2">
                        <button className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" title="Voir">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="rounded-lg border border-gray-100 p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600" title="Plus d’actions">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedAdvances.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-gray-400">Aucune avance</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t px-5 py-5 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-500">
            Affichage de {filteredAdvances.length === 0 ? 0 : (page - 1) * pageSize + 1} à {Math.min(page * pageSize, filteredAdvances.length)} sur {filteredAdvances.length} résultats
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => index + 1).map((item) => (
              <button key={item} onClick={() => setPage(item)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${page === item ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {item}
              </button>
            ))}
            {totalPages > 4 && <span className="px-2 text-sm text-gray-400">...</span>}
            {totalPages > 3 && (
              <button onClick={() => setPage(totalPages)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${page === totalPages ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {totalPages}
              </button>
            )}
            <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
            <CustomSelect
              value={String(pageSize)}
              onChange={(v) => setPageSize(Number(v))}
              options={[
                { value: String(5), label: '5 / page' },
                { value: String(10), label: '10 / page' },
                { value: String(20), label: '20 / page' },
              ]}
              className="ml-2"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FinanceTrackingModule({
  kind,
  requests,
  settings,
  onRefresh,
}: {
  kind: 'advance' | 'loan';
  requests: EmployeeFinanceRequest[];
  settings: EmployeeFinanceSettings | null;
  onRefresh: () => void;
}) {
  const tt = useEmployeeFinanceText();
  const isLoan = kind === 'loan';
  const title = isLoan ? tt('Prêts') : tt('Avances');
  const subtitle = isLoan
    ? tt('Suivi de tous les prêts accordés aux collaborateurs.')
    : tt('Suivi de toutes les avances accordées aux collaborateurs.');
  const newLabel = isLoan ? tt('Nouveau prêt') : tt('Nouvelle avance');
  const typeRequests = useMemo(() => requests.filter((request) => request.request_type === kind), [kind, requests]);
  const currency = settings?.currency ?? typeRequests[0]?.currency ?? 'XOF';
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'settled' | 'late' | 'pending' | 'to_payout' | 'rejected'>('in_progress');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const statusLabels: Record<Exclude<typeof statusFilter, 'all'>, string> = {
    in_progress: tt('En cours'),
    settled: isLoan ? tt('Soldé') : tt('Soldée'),
    late: tt('En retard'),
    pending: tt('En attente'),
    to_payout: tt('À décaisser'),
    rejected: isLoan ? tt('Rejeté') : tt('Rejetée'),
  };

  const departments = useMemo(() => {
    const values = new Set<string>();
    typeRequests.forEach((request) => {
      if (request.employee_department) values.add(request.employee_department);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [typeRequests]);

  const getRemaining = (request: EmployeeFinanceRequest) => {
    const remaining = toNumber(request.remaining_amount);
    if (remaining > 0) return remaining;
    if (request.status === 'completed') return 0;
    return requestAmount(request);
  };

  const isLate = (request: EmployeeFinanceRequest) =>
    request.installments?.some((installment) => installment.status === 'pending' && isPastPeriod(installment.period_year, installment.period_month));

  const statusFor = (request: EmployeeFinanceRequest) => {
    if (isLate(request)) return { id: 'late', label: tt('En retard'), color: 'bg-red-50 text-red-700' };
    if (request.status === 'completed' || getRemaining(request) === 0) return { id: 'settled', label: tt('Soldé'), color: 'bg-gray-100 text-gray-700' };
    if (request.status === 'rejected') return { id: 'rejected', label: tt('Rejeté'), color: 'bg-red-50 text-red-700' };
    if (request.status === 'pending_hr') return { id: 'pending', label: tt('En attente'), color: 'bg-orange-50 text-orange-700' };
    if (['pending_finance', 'approved'].includes(request.status)) return { id: 'to_payout', label: tt('À décaisser'), color: 'bg-blue-50 text-blue-700' };
    return { id: 'in_progress', label: tt('En cours'), color: 'bg-emerald-50 text-emerald-700' };
  };

  const nextDeductionDate = (request: EmployeeFinanceRequest) => {
    const next = request.installments?.find((installment) => installment.status === 'pending');
    if (next) return shortDate(new Date(next.period_year, next.period_month - 1, 25));
    if (request.status === 'completed') return '-';
    return shortDate(new Date(request.first_payroll_year, request.first_payroll_month - 1, 25));
  };

  const endDate = (request: EmployeeFinanceRequest) => {
    const last = request.installments?.at(-1);
    if (last) return monthLabel(last.period_year, last.period_month);
    const duration = Math.max(1, Number(request.installments_count ?? 1));
    const end = new Date(request.first_payroll_year, request.first_payroll_month - 1 + duration - 1, 1);
    return monthLabel(end.getFullYear(), end.getMonth() + 1);
  };

  const filteredRows = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    return typeRequests.filter((request) => {
      const status = statusFor(request).id;
      const name = (request.employee_name ?? `#${request.employee_id}`).toLowerCase();
      return (
        (statusFilter === 'all' || status === statusFilter) &&
        (departmentFilter === 'all' || request.employee_department === departmentFilter) &&
        (!search || name.includes(search) || String(request.employee_id).includes(search))
      );
    });
  }, [departmentFilter, employeeSearch, statusFilter, typeRequests]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, employeeSearch, pageSize, statusFilter]);

  const activeRows = typeRequests.filter((request) => ['in_progress', 'late'].includes(statusFor(request).id));
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const payrollThisMonth = typeRequests.reduce((sum, request) => {
    const due = request.installments
      ?.filter((installment) => installment.status === 'pending' && installment.period_month === currentMonth && installment.period_year === currentYear)
      .reduce((subtotal, installment) => subtotal + toNumber(installment.amount_due), 0);
    return sum + (due || (['in_progress', 'late'].includes(statusFor(request).id) ? toNumber(request.monthly_amount) : 0));
  }, 0);
  const totalRemaining = activeRows.reduce((sum, request) => sum + getRemaining(request), 0);
  const averageAmount = activeRows.length
    ? Math.round(activeRows.reduce((sum, request) => sum + requestAmount(request), 0) / activeRows.length)
    : 0;
  const averageDuration = activeRows.length
    ? Math.round(activeRows.reduce((sum, request) => sum + Number(request.installments_count ?? 1), 0) / activeRows.length)
    : 0;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const firstRow = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, filteredRows.length);

  const exportCsv = () => {
    const rows = [
      [tt('Employé'), tt('Département'), tt('Montant initial'), tt('Restant dû'), tt('Mensualité'), tt('Prochaine retenue'), tt('Fin prévue'), tt('Statut')],
      ...filteredRows.map((request) => [
        request.employee_name ?? `#${request.employee_id}`,
        request.employee_department ?? '',
        String(requestAmount(request)),
        String(getRemaining(request)),
        String(request.monthly_amount ?? ''),
        nextDeductionDate(request),
        endDate(request),
        statusFor(request).label,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${isLoan ? 'prets' : 'avances'}-suivi.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setDepartmentFilter('all');
    setEmployeeSearch('');
  };

  return (
    <div className="space-y-6">
      {showNewRequest && (
        <NewRequestModal
          onClose={() => setShowNewRequest(false)}
          onCreated={onRefresh}
          defaultType={kind}
          lockType
          title={newLabel}
        />
      )}

      <section className="flex flex-wrap justify-end gap-3">
        <div className="flex flex-wrap gap-3">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <Download className="h-4 w-4" />
            {tt('Exporter')}
          </button>
          <button onClick={() => setShowNewRequest(true)} className="inline-flex items-center gap-2 rounded bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-700">
            <Plus className="h-4 w-4" />
            {newLabel}
          </button>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: isLoan ? tt('Total des prêts en cours') : tt('Total des avances en cours'),
            value: formatMoney(totalRemaining, currency),
            sub: tt('Capital restant dû'),
            icon: Wallet,
            color: 'bg-blue-50 text-blue-700',
          },
          {
            label: isLoan ? tt('Nombre de prêts actifs') : tt("Nombre d'avances actives"),
            value: activeRows.length,
            sub: tt('Collaborateurs concernés'),
            icon: isLoan ? Users : FileCheck,
            color: 'bg-emerald-50 text-emerald-700',
          },
          {
            label: tt('À prélever sur la paie (ce mois)'),
            value: formatMoney(payrollThisMonth, currency),
            sub: tt('Montant total prévu'),
            icon: CalendarDays,
            color: 'bg-violet-50 text-violet-700',
          },
          {
            label: isLoan ? tt('Durée moyenne des prêts') : tt('Avance moyenne par employé'),
            value: isLoan ? `${averageDuration} ${tt('mois')}` : formatMoney(averageAmount, currency),
            sub: isLoan ? tt('Prêts actifs') : tt('Employés avec avance active'),
            icon: isLoan ? PieChart : Percent,
            color: 'bg-orange-50 text-orange-700',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-5">
                <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${card.color}`}>
                  <Icon className="h-8 w-8" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-700">{card.label}</p>
                  <p className="mt-3 text-2xl font-bold text-gray-950">{card.value}</p>
                  <p className="mt-2 text-sm text-gray-500">{card.sub}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.2fr_0.9fr_1fr_auto]">
          <label className="text-sm font-medium text-gray-700">
            Rechercher
            <div className="relative mt-2">
              <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
              <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder={tt('Rechercher un employé...')} className="w-full rounded border border-gray-300 py-3 pl-4 pr-10 text-sm" />
            </div>
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Statut')}
            <CustomSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { value: 'all', label: tt('Tous les statuts') },
                ...Object.entries(statusLabels).map(([value, label]) => (
                ({ value: String(value), label: label })
              )),
              ]}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Département')}
            <CustomSelect
              value={departmentFilter}
              onChange={(v) => setDepartmentFilter(v)}
              options={[
                { value: 'all', label: tt('Tous les départements') },
                ...departments.map((department) => (
                ({ value: String(department), label: department })
              )),
              ]}
              className="mt-2 w-full"
            />
          </label>
          <div className="flex items-end">
            <button onClick={() => setShowAdvanced((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <SlidersHorizontal className="h-4 w-4" />
              {tt('Filtres avancés')}
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center gap-2 rounded bg-gray-100 px-4 py-2 text-sm text-gray-600">
              {tt('Statut')}: {statusLabels[statusFilter]}
              <button onClick={() => setStatusFilter('all')} className="text-gray-400 hover:text-gray-700">×</button>
            </span>
          )}
          {(statusFilter !== 'all' || departmentFilter !== 'all' || employeeSearch) && (
            <button onClick={resetFilters} className="text-sm font-semibold text-primary-700 hover:text-primary-800">
              {tt('Réinitialiser')}
            </button>
          )}
        </div>
        {showAdvanced && (
          <div className="mt-5 grid gap-3 border-t pt-5 text-sm text-gray-500 md:grid-cols-2">
            <span>{tt('Les colonnes peuvent être triées plus tard.')}</span>
            <span>{tt('Export basé sur les filtres actifs.')}</span>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="border-b bg-white text-left text-xs font-semibold text-gray-600">
              <tr>
                <th className="px-6 py-4">{tt('Employé')}</th>
                <th className="px-6 py-4">{tt('Département')}</th>
                <th className="px-6 py-4">{tt('Montant initial')}</th>
                <th className="px-6 py-4">{tt('Restant dû')}</th>
                <th className="px-6 py-4">{tt('Mensualité')}</th>
                <th className="px-6 py-4">{tt('Prochaine retenue')}</th>
                <th className="px-6 py-4">{tt('Fin prévue')}</th>
                <th className="px-6 py-4">{tt('Statut')}</th>
                <th className="px-6 py-4 text-right">{tt('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRows.map((request) => {
                const name = request.employee_name ?? `${tt('Employé')} #${request.employee_id}`;
                const status = statusFor(request);
                const remaining = getRemaining(request);
                return (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
                          {initials(name)}
                        </span>
                        <span>
                          <span className="block font-semibold text-gray-900">{name}</span>
                          <span className="text-xs text-gray-500">EMP-{String(request.employee_id).padStart(4, '0')}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-gray-700">{request.employee_department ?? '-'}</td>
                    <td className="px-6 py-5 text-gray-800">{formatMoney(requestAmount(request), request.currency)}</td>
                    <td className={`px-6 py-5 font-semibold ${remaining === 0 ? 'text-emerald-600' : isLate(request) ? 'text-red-600' : 'text-orange-600'}`}>
                      {formatMoney(remaining, request.currency)}
                    </td>
                    <td className="px-6 py-5 text-gray-800">{formatMoney(request.monthly_amount ?? requestAmount(request), request.currency)}</td>
                    <td className="px-6 py-5 text-gray-700">{nextDeductionDate(request)}</td>
                    <td className="px-6 py-5 text-gray-700">{endDate(request)}</td>
                    <td className="px-6 py-5">
                      <span className={`rounded px-3 py-1.5 text-xs font-semibold ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => toast(`${title}: ${name}`)} className="rounded border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" title={tt('Voir')}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="rounded border border-gray-100 p-2 text-gray-500 hover:bg-gray-50" title={tt('Plus d’actions')}>
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400">{tt('Aucune donnée')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-4 border-t px-6 py-5 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-500">
            {tt('Affichage de')} {firstRow} {tt('à')} {lastRow} {tt('sur')} {filteredRows.length} {tt('résultats')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => index + 1).map((item) => (
              <button key={item} onClick={() => setPage(item)} className={`rounded border px-3 py-2 text-sm font-medium ${page === item ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {item}
              </button>
            ))}
            {totalPages > 4 && <span className="px-2 text-sm text-gray-400">...</span>}
            {totalPages > 3 && (
              <button onClick={() => setPage(totalPages)} className={`rounded border px-3 py-2 text-sm font-medium ${page === totalPages ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {totalPages}
              </button>
            )}
            <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
            <CustomSelect
              value={String(pageSize)}
              onChange={(v) => setPageSize(Number(v))}
              options={[
                { value: String(5), label: '5 / page' },
                { value: String(10), label: '10 / page' },
                { value: String(20), label: '20 / page' },
              ]}
              className="ml-2"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function PayoutsModule({
  requests,
  settings,
  onMarkPaid,
}: {
  requests: EmployeeFinanceRequest[];
  settings: EmployeeFinanceSettings | null;
  onMarkPaid: (request: EmployeeFinanceRequest, proof?: { reference?: string; proofUrl?: string }) => void | Promise<void>;
}) {
  const tt = useEmployeeFinanceText();
  const payoutRequests = useMemo(
    () => requests.filter((request) => ['pending_finance', 'approved', 'paid_out', 'active'].includes(request.status)),
    [requests],
  );
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'advance' | 'loan'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'to_payout' | 'proof' | 'paid' | 'late'>('to_payout');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [payoutReference, setPayoutReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const currency = settings?.currency ?? payoutRequests[0]?.currency ?? 'XOF';
  const departments = useMemo(() => {
    const values = new Set<string>();
    payoutRequests.forEach((request) => {
      if (request.employee_department) values.add(request.employee_department);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [payoutRequests]);

  const paymentMethod = (request: EmployeeFinanceRequest) => {
    if (request.payout_method === 'mobile_money') return 'Mobile Money';
    if (request.payout_method === 'cash') return tt('Espèces');
    if (request.payout_method === 'wave') return 'Wave';
    return request.payout_method || (request.id % 3 === 0 ? 'Orange Money' : request.id % 2 === 0 ? 'Wave' : tt('Virement bancaire'));
  };

  const assignedTo = (request: EmployeeFinanceRequest) => (request.id % 2 === 0 ? 'A. Dia' : 'M. Sarr');

  const payoutStatus = (request: EmployeeFinanceRequest) => {
    const approvedDate = request.created_at ? new Date(request.created_at) : requestDate(request);
    const old = Date.now() - approvedDate.getTime() > 1000 * 60 * 60 * 24 * 7;
    if (old && ['pending_finance', 'approved'].includes(request.status)) return { id: 'late', label: tt('En retard'), color: 'bg-red-50 text-red-700' };
    if (['paid_out', 'active'].includes(request.status) && !request.payout_proof_url) return { id: 'proof', label: tt('Preuve à uploader'), color: 'bg-blue-50 text-blue-700' };
    if (['paid_out', 'active'].includes(request.status)) return { id: 'paid', label: tt('Décaissé'), color: 'bg-emerald-50 text-emerald-700' };
    return { id: 'to_payout', label: tt('À décaisser'), color: 'bg-orange-50 text-orange-700' };
  };

  const statusLabels = {
    to_payout: tt('À décaisser'),
    proof: tt('Preuve à uploader'),
    paid: tt('Décaissé'),
    late: tt('En retard'),
  };

  const filteredRows = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    return payoutRequests.filter((request) => {
      const name = (request.employee_name ?? `#${request.employee_id}`).toLowerCase();
      const status = payoutStatus(request).id;
      const method = paymentMethod(request);
      return (
        (typeFilter === 'all' || request.request_type === typeFilter) &&
        (statusFilter === 'all' || status === statusFilter) &&
        (departmentFilter === 'all' || request.employee_department === departmentFilter) &&
        (paymentFilter === 'all' || method === paymentFilter) &&
        (!search || name.includes(search) || String(request.employee_id).includes(search))
      );
    });
  }, [departmentFilter, employeeSearch, paymentFilter, payoutRequests, statusFilter, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, employeeSearch, pageSize, paymentFilter, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const selectedRequest = filteredRows.find((request) => request.id === selectedId) ?? paginatedRows[0] ?? filteredRows[0] ?? null;
  const firstRow = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, filteredRows.length);
  const toPayoutAmount = payoutRequests
    .filter((request) => ['to_payout', 'late'].includes(payoutStatus(request).id))
    .reduce((sum, request) => sum + requestAmount(request), 0);
  const proofCount = payoutRequests.filter((request) => payoutStatus(request).id === 'proof').length;
  const paidThisMonth = payoutRequests.filter((request) => {
    const paidDate = request.paid_at ? new Date(request.paid_at) : null;
    return paidDate && paidDate.getFullYear() === new Date().getFullYear() && paidDate.getMonth() === new Date().getMonth();
  }).length;

  const exportCsv = () => {
    const rows = [
      [tt('Employé'), tt('Type'), tt('Montant approuvé'), tt('Date approbation RH'), tt('Mode de paiement'), tt('Affecté à'), tt('Statut')],
      ...filteredRows.map((request) => [
        request.employee_name ?? `#${request.employee_id}`,
        requestTypeLabel(request, tt),
        String(requestAmount(request)),
        request.created_at ? new Date(request.created_at).toLocaleDateString('fr-FR') : '',
        paymentMethod(request),
        assignedTo(request),
        payoutStatus(request).label,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'decaissements.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setEmployeeSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setPaymentFilter('all');
  };

  useEffect(() => {
    setProofFile(null);
    setProofUrl('');
    setPayoutReference('');
  }, [selectedId]);

  const uploadProofForSelected = async () => {
    if (!selectedRequest || !proofFile) return proofUrl || selectedRequest.payout_proof_url || '';
    setUploadingProof(true);
    try {
      const updated = await employeeFinanceApi.uploadPayoutProof(selectedRequest.id, proofFile);
      const uploadedUrl = updated.payout_proof_url || '';
      setProofUrl(uploadedUrl);
      setProofFile(null);
      toast.success(tt('Preuve de décaissement enregistrée'));
      return uploadedUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt('Erreur'));
      return '';
    } finally {
      setUploadingProof(false);
    }
  };

  const validateSelected = async () => {
    if (!selectedRequest) return;
    const uploadedProofUrl = proofFile ? await uploadProofForSelected() : proofUrl || selectedRequest.payout_proof_url || '';
    await onMarkPaid(selectedRequest, {
      reference: payoutReference || `DEC-${new Date().getFullYear()}-${String(selectedRequest.id).padStart(3, '0')}`,
      proofUrl: uploadedProofUrl || undefined,
    });
  };

  const paymentMethods = [tt('Virement bancaire'), 'Wave', 'Orange Money', 'Mobile Money', tt('Espèces')];

  return (
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <section className="flex flex-wrap justify-end gap-3">
          <div className="flex flex-wrap gap-3">
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
              <Download className="h-4 w-4" />
              {tt('Exporter')}
            </button>
            <button onClick={validateSelected} disabled={!selectedRequest || uploadingProof} className="inline-flex items-center gap-2 rounded bg-primary-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50">
              {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {tt('Décaisser')}
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {[
            { label: tt('Montant à décaisser'), value: formatMoney(toPayoutAmount, currency), sub: tt('Demandes approuvées en attente'), icon: Wallet, color: 'bg-blue-50 text-blue-700' },
            { label: tt('Dossiers à traiter'), value: filteredRows.length, sub: tt('File active finance'), icon: FileCheck, color: 'bg-emerald-50 text-emerald-700' },
            { label: tt('Preuves à uploader'), value: proofCount, sub: tt('Décaissements non finalisés'), icon: FileCheck, color: 'bg-violet-50 text-violet-700' },
            { label: tt('Décaissements ce mois'), value: paidThisMonth, sub: tt('Dossiers comptabilisés'), icon: TrendingUp, color: 'bg-orange-50 text-orange-700' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex min-w-0 items-center gap-4">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${card.color}`}>
                    <Icon className="h-7 w-7" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-700">{card.label}</p>
                    <p className="mt-2 break-words text-xl font-bold text-gray-950">{card.value}</p>
                    <p className="mt-1 text-xs text-gray-500">{card.sub}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_1fr_auto]">
            <label className="text-sm font-medium text-gray-600">
              {tt('Rechercher')}
              <div className="relative mt-2">
                <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder={tt('Rechercher un employé...')} className="w-full rounded border border-gray-300 py-3 pl-4 pr-10 text-sm" />
              </div>
            </label>
            <label className="text-sm font-medium text-gray-600">
              {tt('Type')}
              <CustomSelect
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as typeof typeFilter)}
                options={[
                  { value: 'all', label: tt('Tous les types') },
                  { value: 'advance', label: tt('Avances') },
                  { value: 'loan', label: tt('Prêts') },
                ]}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-600">
              {tt('Statut')}
              <CustomSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: 'all', label: tt('Tous les statuts') },
                  ...Object.entries(statusLabels).map(([value, label]) => ({ value: String(value), label: label })),
                ]}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-600">
              {tt('Département')}
              <CustomSelect
                value={departmentFilter}
                onChange={(v) => setDepartmentFilter(v)}
                options={[
                  { value: 'all', label: tt('Tous les départements') },
                  ...departments.map((department) => ({ value: String(department), label: department })),
                ]}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-600">
              {tt('Mode de paiement')}
              <CustomSelect
                value={paymentFilter}
                onChange={(v) => setPaymentFilter(v)}
                options={[
                  { value: 'all', label: tt('Tous les modes') },
                  ...paymentMethods.map((method) => ({ value: String(method), label: method })),
                ]}
                className="mt-2 w-full"
              />
            </label>
            <div className="flex items-end">
              <button onClick={() => setShowAdvanced((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <SlidersHorizontal className="h-4 w-4" />
                {tt('Filtres avancés')}
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-2 rounded bg-gray-100 px-3 py-2 text-sm text-gray-600">
                {tt('Statut')}: {statusLabels[statusFilter]}
                <button onClick={() => setStatusFilter('all')} className="text-gray-400 hover:text-gray-700">×</button>
              </span>
            )}
            {(employeeSearch || typeFilter !== 'all' || statusFilter !== 'all' || departmentFilter !== 'all' || paymentFilter !== 'all') && (
              <button onClick={resetFilters} className="text-sm font-semibold text-primary-700 hover:text-primary-800">{tt('Réinitialiser')}</button>
            )}
            {showAdvanced && <span className="text-sm text-gray-400">{tt('Les filtres banque / compte seront ajoutés dès que l’API les expose.')}</span>}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">{tt('File de décaissement')}</h2>
            <span className="rounded bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">{filteredRows.length} {tt('résultats')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-b bg-white text-left text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-5 py-4">{tt('Employé')}</th>
                  <th className="px-5 py-4">{tt('Type')}</th>
                  <th className="px-5 py-4">{tt('Montant approuvé')}</th>
                  <th className="px-5 py-4">{tt('Date approbation RH')}</th>
                  <th className="px-5 py-4">{tt('Mode de paiement')}</th>
                  <th className="px-5 py-4">{tt('Affecté à')}</th>
                  <th className="px-5 py-4">{tt('Statut')}</th>
                  <th className="px-5 py-4 text-right">{tt('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRows.map((request) => {
                  const name = request.employee_name ?? `${tt('Employé')} #${request.employee_id}`;
                  const status = payoutStatus(request);
                  const active = selectedRequest?.id === request.id;
                  return (
                    <tr key={request.id} onClick={() => setSelectedId(request.id)} className={`cursor-pointer hover:bg-gray-50 ${active ? 'bg-primary-50/60 ring-1 ring-inset ring-primary-300' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{initials(name)}</span>
                          <span>
                            <span className="block font-semibold text-gray-900">{name}</span>
                            <span className="text-xs text-gray-500">EMP-{String(request.employee_id).padStart(5, '0')}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{requestTypeLabel(request, tt)}</td>
                      <td className="px-5 py-4 font-medium text-gray-900">{formatMoney(requestAmount(request), request.currency)}</td>
                      <td className="px-5 py-4 text-gray-700">{request.created_at ? shortDate(new Date(request.created_at)) : '-'}</td>
                      <td className="px-5 py-4 text-gray-700">{paymentMethod(request)}</td>
                      <td className="px-5 py-4 text-gray-700">{assignedTo(request)}</td>
                      <td className="px-5 py-4"><span className={`rounded px-3 py-1.5 text-xs font-semibold ${status.color}`}>{status.label}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={(event) => { event.stopPropagation(); setSelectedId(request.id); }} className="rounded border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" title={tt('Voir')}>
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="rounded border border-gray-100 p-2 text-gray-500 hover:bg-gray-50" title={tt('Plus d’actions')}>
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedRows.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">{tt('Aucun décaissement')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-4 border-t px-5 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-500">{tt('Affichage de')} {firstRow} {tt('à')} {lastRow} {tt('sur')} {filteredRows.length} {tt('résultats')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((item) => (
                <button key={item} onClick={() => setPage(item)} className={`rounded border px-3 py-2 text-sm font-medium ${page === item ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{item}</button>
              ))}
              {totalPages > 5 && <span className="px-2 text-sm text-gray-400">...</span>}
              {totalPages > 5 && <button onClick={() => setPage(totalPages)} className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">{totalPages}</button>}
              <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              <CustomSelect
                value={String(pageSize)}
                onChange={(v) => setPageSize(Number(v))}
                options={[
                  { value: String(5), label: '5 / page' },
                  { value: String(10), label: '10 / page' },
                  { value: String(20), label: '20 / page' },
                ]}
                className="ml-2"
              />
            </div>
          </div>
        </section>
      </div>

      <aside className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:block 2xl:space-y-4">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{tt('Détail du décaissement')}</h2>
          {selectedRequest ? (
            <div className="mt-5 space-y-4 text-sm">
              {[
                [tt('Réf.'), `DEC-${new Date().getFullYear()}-${String(selectedRequest.id).padStart(3, '0')}`],
                [tt('Employé'), `${selectedRequest.employee_name ?? `#${selectedRequest.employee_id}`} (EMP-${String(selectedRequest.employee_id).padStart(5, '0')})`],
                [tt('Type'), requestTypeLabel(selectedRequest, tt)],
                [tt('Montant approuvé'), formatMoney(requestAmount(selectedRequest), selectedRequest.currency)],
                [tt('Date approbation RH'), selectedRequest.created_at ? shortDate(new Date(selectedRequest.created_at)) : '-'],
                [tt('Mode de paiement'), paymentMethod(selectedRequest)],
                [tt('Banque / Compte'), selectedRequest.payout_reference || 'CBAO •••• 4831'],
                [tt('Affecté à'), assignedTo(selectedRequest)],
                [tt('Échéancier'), selectedRequest.installments_count ? `${selectedRequest.installments_count} ${tt('mois')}` : `1 ${tt('mois')}`],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-900">{value}</span>
                </div>
              ))}
              <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3">
                <span className="text-gray-500">{tt('Statut')}</span>
                <span><span className={`rounded px-3 py-1.5 text-xs font-semibold ${payoutStatus(selectedRequest).color}`}>{payoutStatus(selectedRequest).label}</span></span>
              </div>
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{tt('Le dossier n’est comptabilisé qu’après upload de la preuve de décaissement.')}</span>
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">{tt('Preuve de décaissement')}</h3>
                <label className="flex cursor-pointer items-center justify-center gap-3 rounded border border-dashed border-primary-300 p-4 text-sm text-gray-700 hover:bg-primary-50">
                  <Paperclip className="h-5 w-5 text-primary-700" />
                  <span>
                    <span className="block font-semibold">{tt('Téléverser le justificatif')}</span>
                    <span className="text-xs text-gray-500">PDF, JPG ou PNG</span>
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setProofFile(file);
                      if (file) setProofUrl('');
                    }}
                  />
                </label>
                {(proofFile || proofUrl || selectedRequest.payout_proof_url) && (
                  <p className="mt-2 break-all text-xs text-gray-500">
                    {proofFile?.name || proofUrl || selectedRequest.payout_proof_url}
                  </p>
                )}
                <input value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder={tt('Référence de paiement')} className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <button onClick={validateSelected} disabled={uploadingProof} className="inline-flex w-full items-center justify-center gap-2 rounded bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {tt('Valider le décaissement')}
              </button>
              <button onClick={uploadProofForSelected} disabled={!proofFile || uploadingProof} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {tt('Uploader la preuve')}
              </button>
              <button onClick={() => toast(tt('Retour RH à connecter au workflow'))} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Undo2 className="h-4 w-4" />
                {tt('Retourner au RH')}
              </button>
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-gray-400">{tt('Sélectionnez un dossier')}</p>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{tt('Activité récente')}</h2>
          <div className="mt-5 space-y-4">
            {[
              [tt('Demande approuvée par RH'), 'bg-emerald-500'],
              [tt('Dossier transmis à Finance'), 'bg-blue-600'],
              [tt('Virement initié'), 'bg-violet-600'],
              [tt('Preuve en attente'), 'bg-orange-500'],
            ].map(([label, color], index) => (
              <div key={label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-3 text-gray-700">
                  <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                  {label}
                </span>
                <span className="text-xs text-gray-500">{selectedRequest?.created_at ? shortDate(new Date(selectedRequest.created_at)) : '-'} {index === 0 ? '09:15' : index === 1 ? '09:23' : '10:02'}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

type RepaymentRow = {
  request: EmployeeFinanceRequest;
  installment: EmployeeFinanceRequest['installments'][number] | null;
};

function RepaymentsModule({
  requests,
  settings,
  onRequestUpdated,
}: {
  requests: EmployeeFinanceRequest[];
  settings: EmployeeFinanceSettings | null;
  onRequestUpdated: (request: EmployeeFinanceRequest) => void;
}) {
  const tt = useEmployeeFinanceText();
  const today = new Date();
  const repaymentRequests = useMemo(
    () => requests.filter((request) => ['paid_out', 'active', 'completed'].includes(request.status)),
    [requests],
  );
  const currency = settings?.currency ?? repaymentRequests[0]?.currency ?? 'XOF';
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'advance' | 'loan'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'deducted' | 'late' | 'skipped'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'current' | 'late' | 'next'>('all');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [repaymentAction, setRepaymentAction] = useState<string | null>(null);

  const departments = useMemo(() => {
    const values = new Set<string>();
    repaymentRequests.forEach((request) => {
      if (request.employee_department) values.add(request.employee_department);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [repaymentRequests]);

  const rows = useMemo<RepaymentRow[]>(() => repaymentRequests.reduce<RepaymentRow[]>((acc, request) => {
    if (request.installments?.length) {
      request.installments.forEach((installment) => acc.push({ request, installment }));
    } else {
      acc.push({ request, installment: null });
    }
    return acc;
  }, []), [repaymentRequests]);

  const rowPeriodDate = (row: RepaymentRow) => {
    if (row.installment) return new Date(row.installment.period_year, row.installment.period_month - 1, 25);
    return new Date(row.request.first_payroll_year, row.request.first_payroll_month - 1, 25);
  };

  const rowAmountDue = (row: RepaymentRow) => toNumber(row.installment?.amount_due ?? row.request.monthly_amount ?? row.request.remaining_amount ?? row.request.amount_requested);
  const rowAmountDeducted = (row: RepaymentRow) => toNumber(row.installment?.amount_deducted ?? 0);
  const rowRemaining = (row: RepaymentRow) => {
    const remaining = toNumber(row.request.remaining_amount);
    if (row.request.status === 'completed') return 0;
    return remaining || requestAmount(row.request);
  };

  const rowStatus = (row: RepaymentRow) => {
    const rawStatus = row.installment?.status?.toLowerCase();
    const periodDate = rowPeriodDate(row);
    if (rawStatus === 'deducted' || rawStatus === 'paid' || rowAmountDeducted(row) >= rowAmountDue(row)) {
      return { id: 'deducted', label: tt('Prélevée'), color: 'bg-emerald-50 text-emerald-700' };
    }
    if (rawStatus === 'skipped' || rawStatus === 'suspended') {
      return { id: 'skipped', label: tt('Reportée'), color: 'bg-amber-50 text-amber-700' };
    }
    if (row.request.status === 'completed') {
      return { id: 'deducted', label: tt('Soldée'), color: 'bg-gray-100 text-gray-700' };
    }
    if (periodDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return { id: 'late', label: tt('En retard'), color: 'bg-red-50 text-red-700' };
    }
    return { id: 'pending', label: tt('À prélever'), color: 'bg-blue-50 text-blue-700' };
  };

  const periodMatches = (row: RepaymentRow) => {
    if (periodFilter === 'all') return true;
    const period = rowPeriodDate(row);
    if (periodFilter === 'current') return period.getFullYear() === today.getFullYear() && period.getMonth() === today.getMonth();
    if (periodFilter === 'late') return rowStatus(row).id === 'late';
    if (periodFilter === 'next') {
      const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return period.getFullYear() === next.getFullYear() && period.getMonth() === next.getMonth();
    }
    return true;
  };

  const filteredRows = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const request = row.request;
      const name = (request.employee_name ?? `#${request.employee_id}`).toLowerCase();
      return (
        (typeFilter === 'all' || request.request_type === typeFilter) &&
        (statusFilter === 'all' || rowStatus(row).id === statusFilter) &&
        (departmentFilter === 'all' || request.employee_department === departmentFilter) &&
        periodMatches(row) &&
        (!search || name.includes(search) || String(request.employee_id).includes(search))
      );
    });
  }, [departmentFilter, employeeSearch, periodFilter, rows, statusFilter, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, employeeSearch, pageSize, periodFilter, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const selectedRow = selectedIndex == null ? paginatedRows[0] ?? filteredRows[0] ?? null : filteredRows[selectedIndex] ?? paginatedRows[0] ?? null;
  const firstRow = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, filteredRows.length);

  const dueThisMonth = rows
    .filter((row) => {
      const date = rowPeriodDate(row);
      return rowStatus(row).id === 'pending' && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    })
    .reduce((sum, row) => sum + rowAmountDue(row), 0);
  const deductedThisMonth = rows
    .filter((row) => {
      const date = rowPeriodDate(row);
      return rowStatus(row).id === 'deducted' && date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    })
    .reduce((sum, row) => sum + rowAmountDeducted(row), 0);
  const lateRows = rows.filter((row) => rowStatus(row).id === 'late');
  const totalRemaining = repaymentRequests.reduce((sum, request) => sum + (toNumber(request.remaining_amount) || (request.status === 'completed' ? 0 : requestAmount(request))), 0);

  const exportCsv = () => {
    const exportRows = [
      [tt('Employé'), tt('Type'), tt('Période'), tt('Montant dû'), tt('Montant prélevé'), tt('Restant dossier'), tt('Statut')],
      ...filteredRows.map((row) => [
        row.request.employee_name ?? `#${row.request.employee_id}`,
        requestTypeLabel(row.request, tt),
        shortDate(rowPeriodDate(row)),
        String(rowAmountDue(row)),
        String(rowAmountDeducted(row)),
        String(rowRemaining(row)),
        rowStatus(row).label,
      ]),
    ];
    const csv = exportRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'remboursements.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setEmployeeSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setPeriodFilter('all');
  };

  const rowActionKey = (row: RepaymentRow, action: string) => `${action}-${row.installment?.id ?? `request-${row.request.id}`}`;

  const verifyDeduction = async (row: RepaymentRow) => {
    const key = rowActionKey(row, 'deduct');
    setRepaymentAction(key);
    try {
      const amount = rowAmountDue(row);
      const updated = row.installment
        ? await employeeFinanceApi.deductInstallment(row.installment.id, { amount_deducted: amount })
        : await employeeFinanceApi.deductRequestRepayment(row.request.id, { amount_deducted: amount });
      onRequestUpdated(updated);
      toast.success(tt('Retenue vérifiée'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt('Erreur'));
    } finally {
      setRepaymentAction(null);
    }
  };

  const postponeDeduction = async (row: RepaymentRow) => {
    const key = rowActionKey(row, 'postpone');
    setRepaymentAction(key);
    try {
      const updated = row.installment
        ? await employeeFinanceApi.postponeInstallment(row.installment.id, { months: 1 })
        : await employeeFinanceApi.postponeRequestRepayment(row.request.id, { months: 1 });
      onRequestUpdated(updated);
      toast.success(tt('Échéance reportée'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt('Erreur'));
    } finally {
      setRepaymentAction(null);
    }
  };

  const statusLabels = {
    pending: tt('À prélever'),
    deducted: tt('Prélevée'),
    late: tt('En retard'),
    skipped: tt('Reportée'),
  };

  return (
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <section className="flex flex-wrap justify-end gap-3">
          <button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <Download className="h-4 w-4" />
            {tt('Exporter')}
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {[
            { label: tt('À prélever ce mois'), value: formatMoney(dueThisMonth, currency), sub: tt('Retenues planifiées'), icon: CalendarDays, color: 'bg-blue-50 text-blue-700' },
            { label: tt('Prélevé ce mois'), value: formatMoney(deductedThisMonth, currency), sub: tt('Retenues confirmées'), icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700' },
            { label: tt('Échéances en retard'), value: lateRows.length, sub: tt('À régulariser'), icon: AlertTriangle, color: 'bg-red-50 text-red-700' },
            { label: tt('Capital restant dû'), value: formatMoney(totalRemaining, currency), sub: tt('Avances et prêts actifs'), icon: Wallet, color: 'bg-orange-50 text-orange-700' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex min-w-0 items-center gap-4">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${card.color}`}>
                    <Icon className="h-7 w-7" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-700">{card.label}</p>
                    <p className="mt-2 break-words text-xl font-bold text-gray-950">{card.value}</p>
                    <p className="mt-1 text-xs text-gray-500">{card.sub}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[1.2fr_0.8fr_0.9fr_1fr_0.9fr_auto]">
            <label className="text-sm font-medium text-gray-600">
              {tt('Rechercher')}
              <div className="relative mt-2">
                <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder={tt('Rechercher un employé...')} className="w-full rounded border border-gray-300 py-3 pl-4 pr-10 text-sm" />
              </div>
            </label>
            <label className="text-sm font-medium text-gray-600">
              {tt('Type')}
              <CustomSelect
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as typeof typeFilter)}
                options={[
                  { value: 'all', label: tt('Tous les types') },
                  { value: 'advance', label: tt('Avances') },
                  { value: 'loan', label: tt('Prêts') },
                ]}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-600">
              {tt('Statut')}
              <CustomSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: 'all', label: tt('Tous les statuts') },
                  ...Object.entries(statusLabels).map(([value, label]) => ({ value: String(value), label: label })),
                ]}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-600">
              {tt('Département')}
              <CustomSelect
                value={departmentFilter}
                onChange={(v) => setDepartmentFilter(v)}
                options={[
                  { value: 'all', label: tt('Tous les départements') },
                  ...departments.map((department) => ({ value: String(department), label: department })),
                ]}
                className="mt-2 w-full"
              />
            </label>
            <label className="text-sm font-medium text-gray-600">
              {tt('Période')}
              <CustomSelect
                value={periodFilter}
                onChange={(v) => setPeriodFilter(v as typeof periodFilter)}
                options={[
                  { value: 'all', label: tt('Toutes') },
                  { value: 'current', label: tt('Ce mois') },
                  { value: 'next', label: tt('Mois prochain') },
                  { value: 'late', label: tt('En retard') },
                ]}
                className="mt-2 w-full"
              />
            </label>
            <div className="flex items-end">
              <button onClick={() => setShowAdvanced((value) => !value)} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <SlidersHorizontal className="h-4 w-4" />
                {tt('Filtres avancés')}
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {(employeeSearch || typeFilter !== 'all' || statusFilter !== 'all' || departmentFilter !== 'all' || periodFilter !== 'all') && (
              <button onClick={resetFilters} className="text-sm font-semibold text-primary-700 hover:text-primary-800">{tt('Réinitialiser')}</button>
            )}
            {showAdvanced && <span className="text-sm text-gray-400">{tt('Les règles de report/net insuffisant seront pilotées par les paramètres tenant.')}</span>}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">{tt('Échéancier des remboursements')}</h2>
            <span className="rounded bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">{filteredRows.length} {tt('échéances')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-b bg-white text-left text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-5 py-4">{tt('Employé')}</th>
                  <th className="px-5 py-4">{tt('Type')}</th>
                  <th className="px-5 py-4">{tt('Période')}</th>
                  <th className="px-5 py-4">{tt('Montant dû')}</th>
                  <th className="px-5 py-4">{tt('Prélevé')}</th>
                  <th className="px-5 py-4">{tt('Restant dossier')}</th>
                  <th className="px-5 py-4">{tt('Statut')}</th>
                  <th className="px-5 py-4 text-right">{tt('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRows.map((row) => {
                  const request = row.request;
                  const name = request.employee_name ?? `${tt('Employé')} #${request.employee_id}`;
                  const status = rowStatus(row);
                  const globalIndex = filteredRows.indexOf(row);
                  return (
                    <tr key={`${request.id}-${row.installment?.id ?? 'fallback'}`} onClick={() => setSelectedIndex(globalIndex)} className={`cursor-pointer hover:bg-gray-50 ${selectedRow === row ? 'bg-primary-50/60 ring-1 ring-inset ring-primary-300' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{initials(name)}</span>
                          <span>
                            <span className="block font-semibold text-gray-900">{name}</span>
                            <span className="text-xs text-gray-500">EMP-{String(request.employee_id).padStart(5, '0')}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{requestTypeLabel(request, tt)}</td>
                      <td className="px-5 py-4 text-gray-700">{shortDate(rowPeriodDate(row))}</td>
                      <td className="px-5 py-4 font-medium text-gray-900">{formatMoney(rowAmountDue(row), request.currency)}</td>
                      <td className="px-5 py-4 text-gray-700">{formatMoney(rowAmountDeducted(row), request.currency)}</td>
                      <td className="px-5 py-4 font-semibold text-orange-600">{formatMoney(rowRemaining(row), request.currency)}</td>
                      <td className="px-5 py-4"><span className={`rounded px-3 py-1.5 text-xs font-semibold ${status.color}`}>{status.label}</span></td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={(event) => { event.stopPropagation(); setSelectedIndex(globalIndex); }} className="rounded border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" title={tt('Voir')}>
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(event) => { event.stopPropagation(); postponeDeduction(row); }}
                            disabled={repaymentAction === rowActionKey(row, 'postpone') || ['deducted'].includes(status.id)}
                            className="rounded border border-gray-100 p-2 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={tt('Reporter')}
                          >
                            {repaymentAction === rowActionKey(row, 'postpone') ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedRows.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">{tt('Aucune échéance')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-4 border-t px-5 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-500">{tt('Affichage de')} {firstRow} {tt('à')} {lastRow} {tt('sur')} {filteredRows.length} {tt('échéances')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((item) => (
                <button key={item} onClick={() => setPage(item)} className={`rounded border px-3 py-2 text-sm font-medium ${page === item ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{item}</button>
              ))}
              <button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              <CustomSelect
                value={String(pageSize)}
                onChange={(v) => setPageSize(Number(v))}
                options={[
                  { value: String(8), label: '8 / page' },
                  { value: String(15), label: '15 / page' },
                  { value: String(30), label: '30 / page' },
                ]}
                className="ml-2"
              />
            </div>
          </div>
        </section>
      </div>

      <aside className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:block 2xl:space-y-4">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{tt('Détail du remboursement')}</h2>
          {selectedRow ? (
            <div className="mt-5 space-y-4 text-sm">
              {[
                [tt('Employé'), selectedRow.request.employee_name ?? `#${selectedRow.request.employee_id}`],
                [tt('Type'), requestTypeLabel(selectedRow.request, tt)],
                [tt('Période'), shortDate(rowPeriodDate(selectedRow))],
                [tt('Montant dû'), formatMoney(rowAmountDue(selectedRow), selectedRow.request.currency)],
                [tt('Montant prélevé'), formatMoney(rowAmountDeducted(selectedRow), selectedRow.request.currency)],
                [tt('Restant dossier'), formatMoney(rowRemaining(selectedRow), selectedRow.request.currency)],
                [tt('Statut'), rowStatus(selectedRow).label],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-900">{value}</span>
                </div>
              ))}
              <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                {tt('La paie applique la retenue prévue. Les reports et prélèvements partiels suivront la politique configurée par le tenant.')}
              </div>
              <button
                onClick={() => verifyDeduction(selectedRow)}
                disabled={repaymentAction === rowActionKey(selectedRow, 'deduct') || rowStatus(selectedRow).id === 'deducted'}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {repaymentAction === rowActionKey(selectedRow, 'deduct') ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {tt('Vérifier la retenue')}
              </button>
              <button
                onClick={() => postponeDeduction(selectedRow)}
                disabled={repaymentAction === rowActionKey(selectedRow, 'postpone') || rowStatus(selectedRow).id === 'deducted'}
                className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {repaymentAction === rowActionKey(selectedRow, 'postpone') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                {tt('Reporter l’échéance')}
              </button>
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-gray-400">{tt('Sélectionnez une échéance')}</p>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{tt('Alertes remboursement')}</h2>
          <div className="mt-5 space-y-4 text-sm">
            {[
              [tt('Échéances en retard'), lateRows.length, 'text-red-700 bg-red-50'],
              [tt('À prélever ce mois'), rows.filter((row) => rowStatus(row).id === 'pending').length, 'text-blue-700 bg-blue-50'],
              [tt('Dossiers soldés'), repaymentRequests.filter((request) => request.status === 'completed').length, 'text-emerald-700 bg-emerald-50'],
            ].map(([label, value, color]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-gray-700">{label}</span>
                <span className={`rounded px-2 py-1 text-xs font-semibold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

const bankLoanStatusConfig: Record<EmployeeBankLoanStatus, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'bg-emerald-50 text-emerald-700' },
  settled: { label: 'Soldé', color: 'bg-gray-100 text-gray-700' },
  suspended: { label: 'Suspendu', color: 'bg-amber-50 text-amber-700' },
  closed: { label: 'Clôturé', color: 'bg-blue-50 text-blue-700' },
};

function BankLoanForm({
  currency,
  onClose,
  onCreated,
}: {
  currency: string;
  onClose: () => void;
  onCreated: (loan: EmployeeBankLoan) => void;
}) {
  const tt = useEmployeeFinanceText();
  const today = new Date();
  const end = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [bankName, setBankName] = useState('');
  const [reference, setReference] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [remainingBalance, setRemainingBalance] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [startDate, setStartDate] = useState(isoDate(today));
  const [endDate, setEndDate] = useState(isoDate(end));
  const [scheduleType, setScheduleType] = useState<'fixed' | 'custom'>('fixed');
  const [customRows, setCustomRows] = useState([{ period: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`, amount: '' }]);
  const [notes, setNotes] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    getEmployees({ page_size: 500, status: 'active' })
      .then((data) => {
        if (mounted) setEmployees(data.items ?? []);
      })
      .catch(() => toast.error(tt('Erreur de chargement des employés')))
      .finally(() => {
        if (mounted) setLoadingEmployees(false);
      });
    return () => {
      mounted = false;
    };
  }, [tt]);

  const employeeOptions = useMemo(() => employees.map((employee) => ({
    value: String(employee.id),
    label: `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || `${tt('Employé')} #${employee.id}`,
    subtitle: [employee.employee_id, employee.department_name, employee.job_title || employee.position].filter(Boolean).join(' · '),
  })), [employees, tt]);

  const submit = async () => {
    const parsedEmployeeId = Number(employeeId);
    const parsedInitialAmount = Number(initialAmount);
    if (!parsedEmployeeId || !bankName.trim() || parsedInitialAmount <= 0 || !startDate || !endDate) {
      toast.error(tt('Renseignez les champs obligatoires'));
      return;
    }
    const installments = scheduleType === 'custom'
      ? customRows.map((row) => {
          const [periodYear, periodMonth] = row.period.split('-').map(Number);
          return { period_year: periodYear, period_month: periodMonth, amount_due: Number(row.amount) };
        })
      : undefined;
    if (scheduleType === 'fixed' && Number(monthlyAmount) <= 0) {
      toast.error(tt('La mensualité est obligatoire'));
      return;
    }
    if (scheduleType === 'custom' && installments?.some((item) => !item.period_year || !item.period_month || item.amount_due <= 0)) {
      toast.error(tt('Complétez toutes les échéances'));
      return;
    }

    const payload: EmployeeBankLoanInput = {
      employee_id: parsedEmployeeId,
      bank_name: bankName.trim(),
      loan_reference: reference.trim() || undefined,
      initial_amount: parsedInitialAmount,
      remaining_balance: remainingBalance ? Number(remainingBalance) : parsedInitialAmount,
      currency,
      start_date: startDate,
      end_date: endDate,
      schedule_type: scheduleType,
      monthly_amount: scheduleType === 'fixed' ? Number(monthlyAmount) : undefined,
      installments,
      notes: notes.trim() || undefined,
    };
    setSaving(true);
    try {
      const created = await employeeFinanceApi.createBankLoan(payload);
      onCreated(created);
      toast.success(tt('Prêt bancaire enregistré'));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tt('Erreur'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{tt('Enregistrer un prêt bancaire')}</h2>
            <p className="mt-1 text-sm text-gray-500">{tt("Ce prêt sert uniquement au calcul du taux d'endettement.")}</p>
          </div>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100" title={tt('Fermer')}>
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 md:col-span-2">
            {tt('Employé')} *
            <SearchableSelect
              value={employeeId}
              onChange={setEmployeeId}
              options={employeeOptions}
              placeholder={loadingEmployees ? tt('Chargement des employés...') : tt('Sélectionner un employé')}
              searchPlaceholder={tt('Rechercher un employé...')}
              emptyLabel={tt('Aucun employé disponible')}
              disabled={loadingEmployees || saving}
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Banque')} *
            <input value={bankName} onChange={(event) => setBankName(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Référence du prêt')}
            <input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Montant initial')} *
            <input type="number" min="0" value={initialAmount} onChange={(event) => setInitialAmount(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Solde restant')}
            <input type="number" min="0" value={remainingBalance} onChange={(event) => setRemainingBalance(event.target.value)} placeholder={initialAmount || '0'} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Date de début')} *
            <CustomDatePicker value={startDate} onChange={setStartDate} className="mt-1 w-full" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Date de fin')} *
            <CustomDatePicker value={endDate} onChange={setEndDate} className="mt-1 w-full" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt("Type d'échéancier")}
            <CustomSelect
              value={scheduleType}
              onChange={(v) => setScheduleType(v as 'fixed' | 'custom')}
              options={[
                { value: 'fixed', label: tt('Mensualité fixe') },
                { value: 'custom', label: tt('Échéancier personnalisé') },
              ]}
              className="mt-1 w-full"
            />
          </label>
          {scheduleType === 'fixed' && (
            <label className="text-sm font-medium text-gray-700">
              {tt('Mensualité')} *
              <input type="number" min="0" value={monthlyAmount} onChange={(event) => setMonthlyAmount(event.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
            </label>
          )}
          {scheduleType === 'custom' && (
            <div className="space-y-3 rounded border border-gray-200 p-4 md:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{tt('Échéances')}</p>
                <button
                  type="button"
                  onClick={() => setCustomRows((rows) => [...rows, { period: '', amount: '' }])}
                  className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" /> {tt('Ajouter une échéance')}
                </button>
              </div>
              {customRows.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-3">
                  <input type="month" value={row.period} onChange={(event) => setCustomRows((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, period: event.target.value } : item))} className="rounded border border-gray-300 px-3 py-2 text-sm" />
                  <input type="number" min="0" value={row.amount} placeholder={tt('Montant')} onChange={(event) => setCustomRows((rows) => rows.map((item, rowIndex) => rowIndex === index ? { ...item, amount: event.target.value } : item))} className="rounded border border-gray-300 px-3 py-2 text-sm" />
                  <button type="button" onClick={() => setCustomRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} disabled={customRows.length === 1} className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-30" title={tt('Supprimer')}>
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="text-sm font-medium text-gray-700 md:col-span-2">
            {tt('Notes')}
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{tt('Annuler')}</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {tt('Enregistrer')}
          </button>
        </div>
      </div>
    </div>
  );
}

function BankLoansModule({ settings }: { settings: EmployeeFinanceSettings | null }) {
  const tt = useEmployeeFinanceText();
  const [loans, setLoans] = useState<EmployeeBankLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeBankLoanStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const currency = settings?.currency ?? loans[0]?.currency ?? 'XOF';

  useEffect(() => {
    employeeFinanceApi.listBankLoans()
      .then(setLoans)
      .catch((error) => toast.error(error instanceof Error ? error.message : tt('Erreur de chargement')))
      .finally(() => setLoading(false));
  }, [tt]);

  const departments = useMemo(() => Array.from(new Set(loans.map((loan) => loan.employee_department).filter(Boolean) as string[])).sort(), [loans]);
  const filteredLoans = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return loans.filter((loan) => (
      (statusFilter === 'all' || loan.status === statusFilter) &&
      (departmentFilter === 'all' || loan.employee_department === departmentFilter) &&
      (!needle || `${loan.employee_name ?? ''} ${loan.bank_name} ${loan.loan_reference ?? ''}`.toLowerCase().includes(needle))
    ));
  }, [departmentFilter, loans, search, statusFilter]);

  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const currentDate = new Date();
  const monthlyBurden = activeLoans.reduce((sum, loan) => {
    const installment = loan.installments.find((item) => item.period_year === currentDate.getFullYear() && item.period_month === currentDate.getMonth() + 1);
    return sum + toNumber(installment?.amount_due ?? loan.monthly_amount);
  }, 0);
  const remainingTotal = activeLoans.reduce((sum, loan) => sum + toNumber(loan.remaining_balance), 0);
  const summaryCards: Array<{
    label: string;
    value: string | number;
    icon: typeof Users;
    color: string;
  }> = [
    { label: tt('Prêts bancaires actifs'), value: activeLoans.length, icon: Users, color: 'bg-emerald-50 text-emerald-700' },
    { label: tt('Solde bancaire restant'), value: formatMoney(remainingTotal, currency), icon: Wallet, color: 'bg-blue-50 text-blue-700' },
    { label: tt('Charge bancaire ce mois'), value: formatMoney(monthlyBurden, currency), icon: CalendarDays, color: 'bg-violet-50 text-violet-700' },
  ];

  const updateStatus = async (loan: EmployeeBankLoan, status: EmployeeBankLoanStatus) => {
    setUpdatingId(loan.id);
    try {
      const updated = await employeeFinanceApi.updateBankLoan(loan.id, { status });
      setLoans((items) => items.map((item) => item.id === updated.id ? updated : item));
      toast.success(tt('Statut mis à jour'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tt('Erreur'));
    } finally {
      setUpdatingId(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Employé', 'Département', 'Banque', 'Référence', 'Montant initial', 'Solde restant', 'Mensualité', 'Fin', 'Statut'],
      ...filteredLoans.map((loan) => [
        loan.employee_name ?? `#${loan.employee_id}`,
        loan.employee_department ?? '',
        loan.bank_name,
        loan.loan_reference ?? '',
        String(loan.initial_amount),
        String(loan.remaining_balance ?? ''),
        String(loan.monthly_amount ?? ''),
        loan.end_date,
        bankLoanStatusConfig[loan.status].label,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `prets-bancaires-${isoDate(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-3">
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Download className="h-4 w-4" /> {tt('Exporter')}
        </button>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
          <Plus className="h-4 w-4" /> {tt('Nouveau prêt bancaire')}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex min-w-0 items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <span className={`rounded-lg p-3 ${color}`}><Icon className="h-6 w-6" /></span>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="mt-1 truncate text-xl font-semibold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">
            {tt('Rechercher')}
            <div className="relative mt-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tt('Employé, banque ou référence...')} className="w-full rounded border border-gray-300 py-2 pl-9 pr-3" />
            </div>
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Statut')}
            <CustomSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { value: 'all', label: tt('Tous les statuts') },
                ...Object.entries(bankLoanStatusConfig).map(([value, config]) => ({ value: String(value), label: tt(config.label) })),
              ]}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            {tt('Département')}
            <CustomSelect
              value={departmentFilter}
              onChange={(v) => setDepartmentFilter(v)}
              options={[
                { value: 'all', label: tt('Tous les départements') },
                ...departments.map((department) => ({ value: String(department), label: department })),
              ]}
              className="mt-1 w-full"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-5 py-4">{tt('Employé')}</th>
                <th className="px-5 py-4">{tt('Banque')}</th>
                <th className="px-5 py-4">{tt('Montant initial')}</th>
                <th className="px-5 py-4">{tt('Solde restant')}</th>
                <th className="px-5 py-4">{tt('Mensualité')}</th>
                <th className="px-5 py-4">{tt('Période')}</th>
                <th className="px-5 py-4">{tt('Statut')}</th>
                <th className="px-5 py-4">{tt('Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLoans.map((loan) => {
                const config = bankLoanStatusConfig[loan.status];
                return (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{loan.employee_name ?? `#${loan.employee_id}`}</p>
                      <p className="text-xs text-gray-500">{loan.employee_department ?? '-'}</p>
                    </td>
                    <td className="px-5 py-4"><p className="font-medium text-gray-900">{loan.bank_name}</p><p className="text-xs text-gray-500">{loan.loan_reference ?? '-'}</p></td>
                    <td className="px-5 py-4">{formatMoney(loan.initial_amount, loan.currency)}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{formatMoney(loan.remaining_balance, loan.currency)}</td>
                    <td className="px-5 py-4">{loan.schedule_type === 'fixed' ? formatMoney(loan.monthly_amount, loan.currency) : tt('Variable')}</td>
                    <td className="px-5 py-4">{shortDate(new Date(`${loan.start_date}T00:00:00`))} - {shortDate(new Date(`${loan.end_date}T00:00:00`))}</td>
                    <td className="px-5 py-4"><span className={`rounded px-2 py-1 text-xs font-semibold ${config.color}`}>{tt(config.label)}</span></td>
                    <td className="px-5 py-4">
                      <CustomSelect
                        value={loan.status}
                        onChange={(v) => updateStatus(loan, v as EmployeeBankLoanStatus)}
                        disabled={updatingId === loan.id}
                        options={[
                          ...Object.entries(bankLoanStatusConfig).map(([value, item]) => ({ value: String(value), label: tt(item.label) })),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredLoans.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-16 text-center text-gray-400">{tt('Aucun prêt bancaire')}</td></tr>
              )}
              {loading && (
                <tr><td colSpan={8} className="px-5 py-16 text-center text-gray-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <BankLoanForm
          currency={currency}
          onClose={() => setShowForm(false)}
          onCreated={(loan) => setLoans((items) => [loan, ...items])}
        />
      )}
    </div>
  );
}

export default function EmployeeFinancePage() {
  const tt = useEmployeeFinanceText();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>('dashboard');
  const [requests, setRequests] = useState<EmployeeFinanceRequest[]>([]);
  const [settings, setSettings] = useState<EmployeeFinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payoutReference, setPayoutReference] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const userRole = user?.role?.toLowerCase() ?? 'employee';
  const isFinanceRestrictedProfile = !['admin', 'rh', 'dg', 'super_admin'].includes(userRole);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [reqsResult, cfgResult] = await Promise.allSettled([
        employeeFinanceApi.listRequests(),
        employeeFinanceApi.getSettings(),
      ]);
      if (reqsResult.status === 'fulfilled') setRequests(reqsResult.value);
      if (cfgResult.status === 'fulfilled') setSettings(cfgResult.value);

      const failed = [reqsResult, cfgResult].find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') {
        const message = failed.reason instanceof Error ? failed.reason.message : tt('Erreur de chargement');
        setLoadError(message);
        toast.error(message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : tt('Erreur de chargement');
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [tt]);

  useEffect(() => {
    load();
  }, [load]);

  const replaceRequest = useCallback((updatedRequest: EmployeeFinanceRequest) => {
    setRequests((items) => items.map((item) => (item.id === updatedRequest.id ? updatedRequest : item)));
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab && validTabs.has(requestedTab as TabId)) {
      const nextTab = requestedTab as TabId;
      setTab(!isFinanceRestrictedProfile || financierAllowedTabs.has(nextTab) ? nextTab : 'dashboard');
    } else {
      setTab('dashboard');
    }
  }, [isFinanceRestrictedProfile, searchParams]);

  const filtered = useMemo(() => {
    if (tab === 'advances') return requests.filter((r) => r.request_type === 'advance');
    if (tab === 'loans') return requests.filter((r) => r.request_type === 'loan');
    if (tab === 'payouts') return requests.filter((r) => ['pending_finance', 'approved'].includes(r.status));
    if (tab === 'repayments') return requests.filter((r) => ['active', 'completed'].includes(r.status));
    return requests;
  }, [requests, tab]);

  const approve = async (request: EmployeeFinanceRequest) => {
    try {
      await employeeFinanceApi.approve(request.id, {
        amount_approved: Number(request.amount_requested),
        installments_count: request.installments_count ?? undefined,
      });
      toast.success(tt('Demande approuvée'));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt('Erreur'));
    }
  };

  const reject = async (request: EmployeeFinanceRequest) => {
    const reason = window.prompt(tt('Motif du rejet'));
    if (!reason) return;
    try {
      await employeeFinanceApi.reject(request.id, reason);
      toast.success(tt('Demande rejetée'));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt('Erreur'));
    }
  };

  const markPaid = async (request: EmployeeFinanceRequest, proof?: { reference?: string; proofUrl?: string }) => {
    try {
      await employeeFinanceApi.markPaid(request.id, {
        payout_method: 'bank_transfer',
        payout_reference: proof?.reference || payoutReference || undefined,
        payout_proof_url: proof?.proofUrl || proofUrl || undefined,
      });
      setPayoutReference('');
      setProofUrl('');
      toast.success(tt('Décaissement confirmé'));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tt('Erreur'));
    }
  };

  const headerMeta = {
    dashboard: {
      title: tt('Tableau de bord global'),
      subtitle: tt('Vue consolidée des avances, prêts, décaissements et remboursements.'),
    },
    requests: {
      title: tt('Demandes'),
      subtitle: tt('Gérez et suivez toutes les demandes d’avances et de prêts'),
    },
    advances: {
      title: tt('Avances'),
      subtitle: tt('Suivi de toutes les avances accordées aux collaborateurs.'),
    },
    loans: {
      title: tt('Prêts'),
      subtitle: tt('Suivi de tous les prêts accordés aux collaborateurs.'),
    },
    'bank-loans': {
      title: tt('Prêts bancaires'),
      subtitle: tt("Suivi des engagements bancaires déclarés pour contrôler le taux d'endettement."),
    },
    payouts: {
      title: tt('Décaissements'),
      subtitle: tt('Traitement des avances et prêts approuvés par RH avant comptabilisation.'),
    },
    repayments: {
      title: tt('Remboursements'),
      subtitle: tt('Suivi des retenues paie, échéances, retards et soldes restants.'),
    },
    settings: {
      title: tt('Paramètres'),
      subtitle: tt('Configurez les règles et politiques applicables aux avances, prêts et décaissements.'),
    },
  } satisfies Record<TabId, { title: string; subtitle: string }>;

  return (
    <div>
      <Header title={headerMeta[tab].title} subtitle={headerMeta[tab].subtitle} hideAddButton />
      <main className="bg-gray-50 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement...
          </div>
        ) : (
          <div className="space-y-5">
            {loadError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {loadError}
              </div>
            )}

            {tab === 'dashboard' && (
              <DashboardView
                requests={requests}
                settings={settings}
                onApprove={approve}
                onReject={reject}
                onMarkPaid={markPaid}
              />
            )}

            {tab === 'requests' && (
              <RequestsModule
                requests={requests}
                settings={settings}
                onApprove={approve}
                onReject={reject}
                onMarkPaid={markPaid}
                onRefresh={load}
              />
            )}

            {tab === 'advances' && (
              <FinanceTrackingModule
                kind="advance"
                requests={requests}
                settings={settings}
                onRefresh={load}
              />
            )}

            {tab === 'loans' && (
              <FinanceTrackingModule
                kind="loan"
                requests={requests}
                settings={settings}
                onRefresh={load}
              />
            )}

            {tab === 'bank-loans' && (
              <BankLoansModule settings={settings} />
            )}

            {tab === 'payouts' && (
              <PayoutsModule
                requests={requests}
                settings={settings}
                onMarkPaid={markPaid}
              />
            )}

            {tab === 'repayments' && (
              <RepaymentsModule
                requests={requests}
                settings={settings}
                onRequestUpdated={replaceRequest}
              />
            )}

            {tab === 'settings' && (
              <SettingsPanel
                settings={settings}
                onSaved={setSettings}
              />
            )}

            {!['dashboard', 'requests', 'advances', 'loans', 'bank-loans', 'payouts', 'repayments', 'settings'].includes(tab) && (
              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Employé</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3">Première retenue</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{request.employee_name ?? `#${request.employee_id}`}</td>
                      <td className="px-4 py-3 text-gray-600">{request.request_type === 'advance' ? 'Avance' : 'Prêt'}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatMoney(request.amount_approved ?? request.amount_requested, request.currency)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {MONTHS_FR[request.first_payroll_month - 1]} {request.first_payroll_year}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {request.status === 'pending_hr' && (
                            <>
                              <button onClick={() => approve(request)} className="rounded p-2 text-green-600 hover:bg-green-50" title="Approuver">
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => reject(request)} className="rounded p-2 text-red-600 hover:bg-red-50" title="Rejeter">
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {['pending_finance', 'approved'].includes(request.status) && (
                            <button onClick={() => markPaid(request)} className="rounded px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50">
                              Marquer versé
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-400">Aucune demande</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
