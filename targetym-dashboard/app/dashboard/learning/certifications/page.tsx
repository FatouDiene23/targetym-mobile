'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, Award, CheckCircle2, Eye, FileCheck2, FileUp,
  Loader2, Pencil, Plus, RotateCcw, Search, Settings2, ShieldCheck, Trash2,
  UserPlus, Users, X, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  addEmployeeCertification,
  createCertificationAssignments,
  createCertificationAdminItem,
  deactivateCertificationAdminItem,
  decideCertificationRequest,
  getCertificationSettings,
  linkCertificationRequest,
  listAdminCertificationRequests,
  listCertificationAssignmentTargets,
  listCertificationAdminItems,
  listCertificationHolders,
  listEmployeeCertificationsAdmin,
  resumeCertificationRequest,
  updateCertificationAdminItem,
  updateCertificationRequestStatus,
  updateCertificationSettings,
  uploadEmployeeCertificationDocument,
  verifyCertificationResult,
  type CertificationAdminItem,
  type CertificationAssignmentTarget,
  type CertificationCatalogItem,
  type CertificationHolder,
  type CertificationRequest,
  type CertificationWorkflowStep,
  type EmployeeCertificationAdminItem,
} from '@/lib/certificationsApi';
import { useI18n } from '@/lib/i18n/I18nContext';


type Tab = 'referential' | 'requests' | 'holders' | 'workflow';

const copyByLocale = {
  fr: {
    referential: 'Référentiel', requests: 'Attributions et demandes', holders: 'Titulaires', workflow: 'Circuit de validation', add: 'Ajouter une certification',
    assign: 'Attribuer à réaliser', recordObtained: 'Enregistrer une certification obtenue', selectEmployees: 'Collaborateurs',
    searchEmployee: 'Rechercher un collaborateur', mandatory: 'Certification obligatoire', motivation: 'Motivation', targetDate: 'Date cible',
    selected: 'sélectionné(s)', assignmentCreated: 'Attribution créée', obtainedRecorded: 'Certification enregistrée',
    source: 'Source', sourceNote: 'Précision sur la source', credentialId: 'Identifiant', credentialUrl: 'Lien de vérification', proof: 'Justificatif',
    sourceManual: 'Saisie manuelle', sourceLegacy: 'Ancien SIRH', sourceExcel: 'Import Excel', sourceDocument: 'Document', sourceOther: 'Autre',
    empty: 'Aucune certification dans le référentiel.', holdersCount: 'titulaires', expiring: 'expiration(s) proche(s)',
    name: 'Nom', category: 'Catégorie', provider: 'Organisme', description: 'Description', validity: 'Validité (mois)',
    permanent: 'Permanente', internal: 'Certification interne', save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', deactivate: 'Désactiver',
    loading: 'Chargement…', noRequests: 'Aucune demande.', employee: 'Collaborateur', status: 'Statut', amount: 'Coût total',
    approve: 'Approuver', reject: 'Refuser', verify: 'Valider le résultat', rejectResult: 'Refuser le résultat',
    link: 'Rattacher au référentiel', selectCertification: 'Sélectionner une certification', resume: 'Reprendre le circuit',
    markProgress: 'En préparation', markExam: 'Examen planifié', markResult: 'Résultat attendu',
    requestUpdated: 'Demande mise à jour', workflowHelp: 'Définissez les intervenants et leur ordre. La Finance intervient uniquement lorsqu’un financement est demandé.',
    required: 'Obligatoire', conditional: 'Conditionnelle', stepManager1: 'Manager N+1', stepManager2: 'Manager N+2',
    stepLearning: 'RH / Formation', stepFinance: 'Finance', workflowSaved: 'Circuit enregistré',
    prev: 'Précédent', next: 'Suivant', page: 'Page', of: 'sur', holderTitle: 'Titulaires', obtained: 'Obtenue le', expires: 'Expiration',
    confirmDeactivate: 'Désactiver cette certification ? Son historique sera conservé.', comment: 'Commentaire',
  },
  en: {
    referential: 'Referential', requests: 'Assignments and requests', holders: 'Holders', workflow: 'Approval workflow', add: 'Add certification', empty: 'No certification in the referential.',
    assign: 'Assign to complete', recordObtained: 'Record obtained certification', selectEmployees: 'Employees', searchEmployee: 'Search employee',
    mandatory: 'Mandatory certification', motivation: 'Motivation', targetDate: 'Target date', selected: 'selected',
    assignmentCreated: 'Assignment created', obtainedRecorded: 'Certification recorded', source: 'Source', sourceNote: 'Source details',
    credentialId: 'Credential ID', credentialUrl: 'Verification URL', proof: 'Supporting document',
    sourceManual: 'Manual entry', sourceLegacy: 'Legacy HRIS', sourceExcel: 'Excel import', sourceDocument: 'Document', sourceOther: 'Other',
    holdersCount: 'holders', expiring: 'expiring soon', name: 'Name', category: 'Category', provider: 'Provider', description: 'Description',
    validity: 'Validity (months)', permanent: 'Permanent', internal: 'Internal certification', save: 'Save', cancel: 'Cancel', edit: 'Edit', deactivate: 'Deactivate',
    loading: 'Loading…', noRequests: 'No request.', employee: 'Employee', status: 'Status', amount: 'Total cost', approve: 'Approve', reject: 'Reject',
    verify: 'Verify result', rejectResult: 'Reject result', link: 'Link to referential', selectCertification: 'Select a certification', resume: 'Resume workflow',
    markProgress: 'In preparation', markExam: 'Exam scheduled', markResult: 'Result expected', requestUpdated: 'Request updated',
    workflowHelp: 'Define participants and their order. Finance is included only when funding is requested.', required: 'Required', conditional: 'Conditional',
    stepManager1: 'N+1 manager', stepManager2: 'N+2 manager', stepLearning: 'HR / Learning', stepFinance: 'Finance', workflowSaved: 'Workflow saved',
    prev: 'Previous', next: 'Next', page: 'Page', of: 'of', holderTitle: 'Holders', obtained: 'Obtained on', expires: 'Expiry',
    confirmDeactivate: 'Deactivate this certification? Its history will be retained.', comment: 'Comment',
  },
  pt: {
    referential: 'Referencial', requests: 'Atribuições e pedidos', holders: 'Titulares', workflow: 'Circuito de aprovação', add: 'Adicionar certificação', empty: 'Nenhuma certificação no referencial.',
    assign: 'Atribuir para realizar', recordObtained: 'Registrar certificação obtida', selectEmployees: 'Colaboradores', searchEmployee: 'Pesquisar colaborador',
    mandatory: 'Certificação obrigatória', motivation: 'Motivação', targetDate: 'Data prevista', selected: 'selecionado(s)',
    assignmentCreated: 'Atribuição criada', obtainedRecorded: 'Certificação registrada', source: 'Fonte', sourceNote: 'Detalhes da fonte',
    credentialId: 'ID do certificado', credentialUrl: 'Link de verificação', proof: 'Comprovativo',
    sourceManual: 'Entrada manual', sourceLegacy: 'SIRH anterior', sourceExcel: 'Importação Excel', sourceDocument: 'Documento', sourceOther: 'Outro',
    holdersCount: 'titulares', expiring: 'expiração(ões) próxima(s)', name: 'Nome', category: 'Categoria', provider: 'Organismo', description: 'Descrição',
    validity: 'Validade (meses)', permanent: 'Permanente', internal: 'Certificação interna', save: 'Salvar', cancel: 'Cancelar', edit: 'Editar', deactivate: 'Desativar',
    loading: 'Carregando…', noRequests: 'Nenhum pedido.', employee: 'Colaborador', status: 'Estado', amount: 'Custo total', approve: 'Aprovar', reject: 'Recusar',
    verify: 'Validar resultado', rejectResult: 'Recusar resultado', link: 'Vincular ao referencial', selectCertification: 'Selecionar uma certificação', resume: 'Retomar o circuito',
    markProgress: 'Em preparação', markExam: 'Exame agendado', markResult: 'Resultado esperado', requestUpdated: 'Pedido atualizado',
    workflowHelp: 'Defina os participantes e a ordem. Finanças intervém apenas quando há financiamento.', required: 'Obrigatório', conditional: 'Condicional',
    stepManager1: 'Gestor N+1', stepManager2: 'Gestor N+2', stepLearning: 'RH / Formação', stepFinance: 'Finanças', workflowSaved: 'Circuito salvo',
    prev: 'Anterior', next: 'Próximo', page: 'Página', of: 'de', holderTitle: 'Titulares', obtained: 'Obtida em', expires: 'Expiração',
    confirmDeactivate: 'Desativar esta certificação? O histórico será mantido.', comment: 'Comentário',
  },
} as const;

const statusLabels: Record<string, Record<string, string>> = {
  fr: { pending_manager_n1: 'En attente N+1', pending_manager_n2: 'En attente N+2', pending_learning_admin: 'En attente RH / Formation', pending_finance: 'En attente Finance', blocked_configuration: 'Configuration à corriger', approved: 'Approuvée', in_progress: 'En préparation', exam_scheduled: 'Examen planifié', awaiting_result: 'Résultat attendu', awaiting_verification: 'Résultat à vérifier', obtained: 'Obtenue', failed: 'Non obtenue', rejected: 'Refusée' },
  en: { pending_manager_n1: 'Waiting for N+1', pending_manager_n2: 'Waiting for N+2', pending_learning_admin: 'Waiting for HR / Learning', pending_finance: 'Waiting for Finance', blocked_configuration: 'Configuration issue', approved: 'Approved', in_progress: 'In progress', exam_scheduled: 'Exam scheduled', awaiting_result: 'Result expected', awaiting_verification: 'Result to verify', obtained: 'Obtained', failed: 'Not obtained', rejected: 'Rejected' },
  pt: { pending_manager_n1: 'Aguardando N+1', pending_manager_n2: 'Aguardando N+2', pending_learning_admin: 'Aguardando RH / Formação', pending_finance: 'Aguardando Finanças', blocked_configuration: 'Configuração a corrigir', approved: 'Aprovada', in_progress: 'Em preparação', exam_scheduled: 'Exame agendado', awaiting_result: 'Resultado esperado', awaiting_verification: 'Resultado a verificar', obtained: 'Obtida', failed: 'Não obtida', rejected: 'Recusada' },
};

const initialCertification: Omit<CertificationCatalogItem, 'id'> = {
  name: '', category: '', provider: '', description: '', validity_months: null, is_internal: false,
};

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100';
type AssignmentForm = {
  certification_type_id: string;
  motivation: string;
  target_date: string;
  training_cost: string;
  exam_cost: string;
  other_cost: string;
  currency: string;
  funding_mode: 'company' | 'employee_reimbursement' | 'self_funded';
};

type ObtainedForm = {
  employee_id: string;
  certification_type_id: string;
  obtained_date: string;
  expiry_date: string;
  credential_id: string;
  credential_url: string;
  source: 'manual' | 'legacy_sirh' | 'excel' | 'document' | 'other';
  source_note: string;
};

const initialAssignment: AssignmentForm = {
  certification_type_id: '', motivation: '', target_date: '', training_cost: '0',
  exam_cost: '0', other_cost: '0', currency: 'XOF', funding_mode: 'company',
};
const initialObtained: ObtainedForm = {
  employee_id: '', certification_type_id: '', obtained_date: '', expiry_date: '',
  credential_id: '', credential_url: '', source: 'manual', source_note: '',
};

export default function CertificationsPage() {
  const { locale } = useI18n();
  const copy = copyByLocale[locale];
  const localeTag = locale === 'fr' ? 'fr-FR' : locale === 'pt' ? 'pt-BR' : 'en-US';
  const [tab, setTab] = useState<Tab>('referential');
  const [certifications, setCertifications] = useState<CertificationAdminItem[]>([]);
  const [requests, setRequests] = useState<CertificationRequest[]>([]);
  const [employeeCertifications, setEmployeeCertifications] = useState<EmployeeCertificationAdminItem[]>([]);
  const [employeeCertificationTotal, setEmployeeCertificationTotal] = useState(0);
  const [holderPage, setHolderPage] = useState(1);
  const [holderSearch, setHolderSearch] = useState('');
  const [targets, setTargets] = useState<CertificationAssignmentTarget[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [workflow, setWorkflow] = useState<CertificationWorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<CertificationAdminItem | null | 'new'>(null);
  const [certificationForm, setCertificationForm] = useState(initialCertification);
  const [holdersOf, setHoldersOf] = useState<CertificationAdminItem | null>(null);
  const [holders, setHolders] = useState<CertificationHolder[]>([]);
  const [decision, setDecision] = useState<CertificationRequest | null>(null);
  const [comment, setComment] = useState('');
  const [linkFor, setLinkFor] = useState<CertificationRequest | null>(null);
  const [linkId, setLinkId] = useState('');
  const [showAssignment, setShowAssignment] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState(initialAssignment);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [assignmentMandatory, setAssignmentMandatory] = useState(true);
  const [showObtained, setShowObtained] = useState(false);
  const [obtainedForm, setObtainedForm] = useState(initialObtained);
  const [obtainedFile, setObtainedFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, requestResult, settings, holderResult, targetItems] = await Promise.all([
        listCertificationAdminItems(), listAdminCertificationRequests(page), getCertificationSettings(),
        listEmployeeCertificationsAdmin(holderPage, holderSearch), listCertificationAssignmentTargets(),
      ]);
      setCertifications(items); setRequests(requestResult.items); setTotal(requestResult.total); setWorkflow(settings.validation_workflow);
      setEmployeeCertifications(holderResult.items); setEmployeeCertificationTotal(holderResult.total); setTargets(targetItems);
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setLoading(false); }
  }, [holderPage, holderSearch, page]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const totalHolders = useMemo(() => certifications.reduce((sum, item) => sum + item.total_holders, 0), [certifications]);

  const openEditor = (item?: CertificationAdminItem) => {
    setEditing(item || 'new');
    setCertificationForm(item ? {
      name: item.name, category: item.category || '', provider: item.provider || '', description: item.description || '',
      validity_months: item.validity_months || null, is_internal: item.is_internal,
    } : initialCertification);
  };

  const saveCertification = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true);
    try {
      if (editing === 'new') await createCertificationAdminItem(certificationForm);
      else if (editing) await updateCertificationAdminItem(editing.id, certificationForm);
      toast.success(copy.save); setEditing(null); await load();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };

  const filteredTargets = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    return term
      ? targets.filter((target) => `${target.name} ${target.email} ${target.employee_number || ''}`.toLowerCase().includes(term))
      : targets;
  }, [employeeSearch, targets]);

  const submitAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedEmployeeIds.length || !assignmentForm.certification_type_id) return;
    setSubmitting(true);
    try {
      const totalCost = Number(assignmentForm.training_cost) + Number(assignmentForm.exam_cost) + Number(assignmentForm.other_cost);
      await createCertificationAssignments({
        employee_ids: selectedEmployeeIds,
        is_mandatory: assignmentMandatory,
        certification_type_id: Number(assignmentForm.certification_type_id),
        other_certification_name: null,
        provider: certifications.find((item) => item.id === Number(assignmentForm.certification_type_id))?.provider || null,
        motivation: assignmentForm.motivation,
        target_date: assignmentForm.target_date || null,
        preparatory_training_required: false,
        preparation_course_id: null,
        training_cost: Number(assignmentForm.training_cost),
        exam_cost: Number(assignmentForm.exam_cost),
        other_cost: Number(assignmentForm.other_cost),
        currency: assignmentForm.currency,
        funding_mode: assignmentForm.funding_mode,
        requires_finance: totalCost > 0 && assignmentForm.funding_mode !== 'self_funded',
      });
      toast.success(copy.assignmentCreated);
      setShowAssignment(false); setAssignmentForm(initialAssignment); setSelectedEmployeeIds([]); setEmployeeSearch('');
      await load();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };

  const submitObtained = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true);
    try {
      const created = await addEmployeeCertification({
        employee_id: Number(obtainedForm.employee_id),
        certification_type_id: Number(obtainedForm.certification_type_id),
        obtained_date: obtainedForm.obtained_date,
        expiry_date: obtainedForm.expiry_date || null,
        credential_id: obtainedForm.credential_id || null,
        credential_url: obtainedForm.credential_url || null,
        source: obtainedForm.source,
        source_note: obtainedForm.source_note || null,
      });
      if (obtainedFile) await uploadEmployeeCertificationDocument(created.id, obtainedFile);
      toast.success(copy.obtainedRecorded); setShowObtained(false); setObtainedForm(initialObtained); setObtainedFile(null); setTab('holders'); await load();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };

  const deactivate = async (item: CertificationAdminItem) => {
    if (!window.confirm(copy.confirmDeactivate)) return;
    try { await deactivateCertificationAdminItem(item.id); toast.success(copy.deactivate); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
  };

  const viewHolders = async (item: CertificationAdminItem) => {
    setHoldersOf(item); setHolders([]);
    try { setHolders(await listCertificationHolders(item.id)); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
  };

  const applyDecision = async (approved: boolean) => {
    if (!decision) return; setSubmitting(true);
    try { await decideCertificationRequest(decision.id, approved, comment); toast.success(copy.requestUpdated); setDecision(null); setComment(''); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };

  const verifyResult = async (request: CertificationRequest, approved: boolean) => {
    try { await verifyCertificationResult(request.id, approved); toast.success(copy.requestUpdated); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
  };

  const linkCertification = async (event: FormEvent) => {
    event.preventDefault(); if (!linkFor || !linkId) return;
    try { await linkCertificationRequest(linkFor.id, Number(linkId)); toast.success(copy.requestUpdated); setLinkFor(null); setLinkId(''); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
  };

  const changeStatus = async (request: CertificationRequest, status: string) => {
    try { await updateCertificationRequestStatus(request.id, status); toast.success(copy.requestUpdated); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
  };

  const resume = async (request: CertificationRequest) => {
    try { await resumeCertificationRequest(request.id); toast.success(copy.requestUpdated); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= workflow.length) return;
    const next = [...workflow]; [next[index], next[target]] = [next[target], next[index]]; setWorkflow(next);
  };

  const saveWorkflow = async () => {
    setSubmitting(true);
    try { const result = await updateCertificationSettings(workflow); setWorkflow(result.validation_workflow); toast.success(copy.workflowSaved); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };

  const formatDate = (value?: string | null) => value && value !== 'Permanent' ? new Intl.DateTimeFormat(localeTag).format(new Date(`${value}T00:00:00`)) : copy.permanent;
  const stepName = (type: CertificationWorkflowStep['type']) => ({ manager_n1: copy.stepManager1, manager_n2: copy.stepManager2, learning_admin: copy.stepLearning, finance: copy.stepFinance })[type];

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3"><Stat icon={<Award />} label={copy.referential} value={certifications.length} /><Stat icon={<Users />} label={copy.holders} value={employeeCertificationTotal || totalHolders} /><Stat icon={<ShieldCheck />} label={copy.requests} value={total} /></div>
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2 overflow-x-auto">{(['referential', 'requests', 'holders', 'workflow'] as Tab[]).map((value) => <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{copy[value]}</button>)}</div>
      <div className="flex flex-wrap gap-2">{tab === 'referential' && <button onClick={() => openEditor()} className="flex items-center justify-center gap-2 rounded-lg border border-primary-200 px-4 py-2 text-sm font-semibold text-primary-700"><Plus className="h-4 w-4" />{copy.add}</button>}{tab === 'requests' && <button onClick={() => setShowAssignment(true)} className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white"><UserPlus className="h-4 w-4" />{copy.assign}</button>}{tab === 'holders' && <button onClick={() => setShowObtained(true)} className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white"><FileCheck2 className="h-4 w-4" />{copy.recordObtained}</button>}</div>
    </div>

    {loading ? <Empty icon={<Loader2 className="h-7 w-7 animate-spin" />} text={copy.loading} /> : tab === 'referential' ? (
      certifications.length ? <div className="grid gap-4 md:grid-cols-2">{certifications.map((item) => <article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-xl bg-purple-100 p-3 text-purple-700"><Award className="h-6 w-6" /></div><div><h2 className="font-bold text-gray-900">{item.name}</h2><p className="text-sm text-gray-500">{item.provider || '—'}</p></div></div><div className="flex gap-1"><button onClick={() => openEditor(item)} title={copy.edit} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button><button onClick={() => void deactivate(item)} title={copy.deactivate} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div><p className="mt-4 text-sm text-gray-600">{item.description || '—'}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4 text-sm"><span>{item.validity_months ? `${item.validity_months} mois` : copy.permanent}</span><button onClick={() => void viewHolders(item)} className="flex items-center gap-1 font-semibold text-primary-700"><Eye className="h-4 w-4" />{item.total_holders} {copy.holdersCount}</button></div>{item.expiring_soon > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-orange-600"><AlertTriangle className="h-3.5 w-3.5" />{item.expiring_soon} {copy.expiring}</p>}</article>)}</div> : <Empty icon={<Award className="h-7 w-7" />} text={copy.empty} />
    ) : tab === 'requests' ? (
      requests.length ? <><div className="space-y-3">{requests.map((item) => <article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="font-bold text-gray-900">{item.certification_name}</h2><p className="text-sm text-gray-500">{copy.employee} : {item.employee_name}</p><p className="mt-1 text-sm text-gray-600">{copy.status} : {statusLabels[locale]?.[item.status] || item.status}</p>{item.total_cost > 0 && <p className="mt-1 text-sm font-semibold">{copy.amount} : {item.total_cost.toLocaleString(localeTag)} {item.currency}</p>}</div><div className="flex flex-wrap gap-2">{item.status === 'pending_learning_admin' && <button onClick={() => setDecision(item)} className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white">{copy.approve} / {copy.reject}</button>}{item.status === 'blocked_configuration' && <button onClick={() => void resume(item)} className="flex items-center gap-1 rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700"><RotateCcw className="h-4 w-4" />{copy.resume}</button>}{item.status === 'awaiting_verification' && !item.certification_type_id && <button onClick={() => setLinkFor(item)} className="rounded-lg border border-primary-200 px-3 py-2 text-sm font-semibold text-primary-700">{copy.link}</button>}{item.status === 'awaiting_verification' && item.certification_type_id && <><button onClick={() => void verifyResult(item, false)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">{copy.rejectResult}</button><button onClick={() => void verifyResult(item, true)} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white">{copy.verify}</button></>}{['approved', 'in_progress', 'exam_scheduled', 'awaiting_result'].includes(item.status) && <select value="" onChange={(event) => event.target.value && void changeStatus(item, event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm"><option value="">{copy.status}</option><option value="in_progress">{copy.markProgress}</option><option value="exam_scheduled">{copy.markExam}</option><option value="awaiting_result">{copy.markResult}</option></select>}</div></div></article>)}</div><div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600"><span>{copy.page} {page} {copy.of} {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{copy.prev}</button><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{copy.next}</button></div></div></> : <Empty icon={<ShieldCheck className="h-7 w-7" />} text={copy.noRequests} />
    ) : tab === 'holders' ? <><div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"><div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" /><input value={holderSearch} onChange={(event) => { setHolderSearch(event.target.value); setHolderPage(1); }} placeholder={copy.searchEmployee} className={`${inputClass} pl-10`} /></div></div>{employeeCertifications.length ? <div className="space-y-3">{employeeCertifications.map((item) => <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-gray-900">{item.employee_name}</h2><p className="text-sm font-medium text-primary-700">{item.certification_name}</p><p className="mt-1 text-xs text-gray-500">{copy.obtained} : {formatDate(item.obtained_date)} · {copy.source} : {item.source}</p></div><span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{statusLabels[locale]?.[item.status] || item.status}</span></article>)}</div> : <Empty icon={<Users className="h-7 w-7" />} text={copy.noRequests} />}<div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600"><span>{copy.page} {holderPage} {copy.of} {Math.max(1, Math.ceil(employeeCertificationTotal / 20))}</span><div className="flex gap-2"><button disabled={holderPage <= 1} onClick={() => setHolderPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{copy.prev}</button><button disabled={holderPage >= Math.ceil(employeeCertificationTotal / 20)} onClick={() => setHolderPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">{copy.next}</button></div></div></> : <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="mb-5 flex gap-3"><div className="rounded-xl bg-primary-100 p-3 text-primary-700"><Settings2 className="h-6 w-6" /></div><div><h2 className="font-bold text-gray-900">{copy.workflow}</h2><p className="mt-1 text-sm text-gray-500">{copy.workflowHelp}</p></div></div><div className="space-y-3">{workflow.map((step, index) => <div key={step.type} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-gray-900">{index + 1}. {stepName(step.type)}</p><p className="text-xs text-gray-500">{step.type === 'finance' ? copy.conditional : step.required ? copy.required : ''}</p></div><div className="flex items-center gap-2">{step.type !== 'finance' && <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={step.required} onChange={(event) => setWorkflow(workflow.map((value, i) => i === index ? { ...value, required: event.target.checked } : value))} />{copy.required}</label>}<button disabled={index === 0} onClick={() => moveStep(index, -1)} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button disabled={index === workflow.length - 1} onClick={() => moveStep(index, 1)} className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button></div></div>)}</div><div className="mt-5 flex justify-end"><button disabled={submitting} onClick={() => void saveWorkflow()} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{copy.save}</button></div></section>}

    {editing && <Modal title={editing === 'new' ? copy.add : copy.edit} onClose={() => setEditing(null)}><form onSubmit={saveCertification} className="space-y-5"><section className="rounded-2xl border border-gray-100 bg-gray-50 p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.name}><input required value={certificationForm.name} onChange={(e) => setCertificationForm({ ...certificationForm, name: e.target.value })} className={inputClass} /></Field><Field label={copy.category}><input value={certificationForm.category || ''} onChange={(e) => setCertificationForm({ ...certificationForm, category: e.target.value })} className={inputClass} /></Field><Field label={copy.provider}><input value={certificationForm.provider || ''} onChange={(e) => setCertificationForm({ ...certificationForm, provider: e.target.value })} className={inputClass} /></Field><Field label={copy.validity}><input type="number" min="1" max="1200" value={certificationForm.validity_months || ''} onChange={(e) => setCertificationForm({ ...certificationForm, validity_months: e.target.value ? Number(e.target.value) : null })} className={inputClass} /></Field></div><div className="mt-4"><Field label={copy.description}><textarea value={certificationForm.description || ''} onChange={(e) => setCertificationForm({ ...certificationForm, description: e.target.value })} className={`${inputClass} min-h-28 resize-y`} /></Field></div><label className="mt-4 flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-sm"><input type="checkbox" checked={certificationForm.is_internal} onChange={(e) => setCertificationForm({ ...certificationForm, is_internal: e.target.checked })} />{copy.internal}</label></section><Actions copy={copy} submitting={submitting} onCancel={() => setEditing(null)} /></form></Modal>}
    {holdersOf && <Modal title={`${copy.holderTitle} — ${holdersOf.name}`} onClose={() => setHoldersOf(null)}>{holders.length ? <div className="space-y-3">{holders.map((holder) => <div key={holder.id} className="rounded-xl border border-gray-100 p-4"><p className="font-semibold text-gray-900">{holder.employee_name}</p><p className="mt-1 text-sm text-gray-500">{copy.obtained} : {formatDate(holder.obtained_date)} · {copy.expires} : {formatDate(holder.expiry_date)}</p></div>)}</div> : <p className="py-8 text-center text-gray-500">{copy.noRequests}</p>}</Modal>}
    {decision && <Modal title={`${copy.status} — ${decision.certification_name}`} onClose={() => setDecision(null)}><div className="space-y-4"><Field label={copy.comment}><textarea value={comment} onChange={(e) => setComment(e.target.value)} className={`${inputClass} min-h-24 resize-y`} /></Field><div className="flex justify-end gap-2"><button disabled={submitting} onClick={() => void applyDecision(false)} className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-700"><XCircle className="h-4 w-4" />{copy.reject}</button><button disabled={submitting} onClick={() => void applyDecision(true)} className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white"><CheckCircle2 className="h-4 w-4" />{copy.approve}</button></div></div></Modal>}
    {linkFor && <Modal title={copy.link} onClose={() => setLinkFor(null)}><form onSubmit={linkCertification} className="space-y-4"><Field label={copy.selectCertification}><select required value={linkId} onChange={(e) => setLinkId(e.target.value)} className={inputClass}><option value="">—</option>{certifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Actions copy={copy} submitting={false} onCancel={() => setLinkFor(null)} /></form></Modal>}
    {showAssignment && <Modal title={copy.assign} onClose={() => setShowAssignment(false)}><form onSubmit={submitAssignment} className="space-y-5"><section className="rounded-2xl border border-gray-100 bg-gray-50 p-5"><Field label={copy.selectCertification}><select required value={assignmentForm.certification_type_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, certification_type_id: e.target.value })} className={inputClass}><option value="">—</option>{certifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><div className="mt-4"><Field label={copy.motivation}><textarea required minLength={3} value={assignmentForm.motivation} onChange={(e) => setAssignmentForm({ ...assignmentForm, motivation: e.target.value })} className={`${inputClass} min-h-24 resize-y`} /></Field></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label={copy.targetDate}><input type="date" value={assignmentForm.target_date} onChange={(e) => setAssignmentForm({ ...assignmentForm, target_date: e.target.value })} className={inputClass} /></Field><label className="flex items-center gap-3 self-end rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm font-medium"><input type="checkbox" checked={assignmentMandatory} onChange={(e) => setAssignmentMandatory(e.target.checked)} />{copy.mandatory}</label></div></section><section className="rounded-2xl border border-gray-100 bg-gray-50 p-5"><Field label={copy.selectEmployees}><div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" /><input value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder={copy.searchEmployee} className={`${inputClass} pl-10`} /></div></Field><div className="mt-3 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2">{filteredTargets.map((target) => <label key={target.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-gray-50"><input type="checkbox" checked={selectedEmployeeIds.includes(target.id)} onChange={() => setSelectedEmployeeIds((ids) => ids.includes(target.id) ? ids.filter((id) => id !== target.id) : [...ids, target.id])} /><span><span className="block text-sm font-semibold">{target.name}</span><span className="text-xs text-gray-500">{target.job_title || target.email}</span></span></label>)}</div><p className="mt-2 text-xs font-semibold text-primary-700">{selectedEmployeeIds.length} {copy.selected}</p></section><section className="rounded-2xl border border-gray-100 bg-gray-50 p-5"><div className="grid gap-4 sm:grid-cols-3">{(['training_cost', 'exam_cost', 'other_cost'] as const).map((key) => <Field key={key} label={key === 'training_cost' ? 'Formation' : key === 'exam_cost' ? 'Examen' : copy.amount}><input type="number" min="0" value={assignmentForm[key]} onChange={(e) => setAssignmentForm({ ...assignmentForm, [key]: e.target.value })} className={inputClass} /></Field>)}</div></section><Actions copy={copy} submitting={submitting} onCancel={() => setShowAssignment(false)} /></form></Modal>}
    {showObtained && <Modal title={copy.recordObtained} onClose={() => setShowObtained(false)}><form onSubmit={submitObtained} className="space-y-5"><section className="rounded-2xl border border-gray-100 bg-gray-50 p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.employee}><select required value={obtainedForm.employee_id} onChange={(e) => setObtainedForm({ ...obtainedForm, employee_id: e.target.value })} className={inputClass}><option value="">—</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></Field><Field label={copy.selectCertification}><select required value={obtainedForm.certification_type_id} onChange={(e) => setObtainedForm({ ...obtainedForm, certification_type_id: e.target.value })} className={inputClass}><option value="">—</option>{certifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label={copy.obtained}><input required type="date" value={obtainedForm.obtained_date} onChange={(e) => setObtainedForm({ ...obtainedForm, obtained_date: e.target.value })} className={inputClass} /></Field><Field label={copy.expires}><input type="date" value={obtainedForm.expiry_date} onChange={(e) => setObtainedForm({ ...obtainedForm, expiry_date: e.target.value })} className={inputClass} /></Field><Field label={copy.source}><select value={obtainedForm.source} onChange={(e) => setObtainedForm({ ...obtainedForm, source: e.target.value as ObtainedForm['source'] })} className={inputClass}><option value="manual">{copy.sourceManual}</option><option value="legacy_sirh">{copy.sourceLegacy}</option><option value="excel">{copy.sourceExcel}</option><option value="document">{copy.sourceDocument}</option><option value="other">{copy.sourceOther}</option></select></Field><Field label={copy.sourceNote}><input value={obtainedForm.source_note} onChange={(e) => setObtainedForm({ ...obtainedForm, source_note: e.target.value })} className={inputClass} /></Field><Field label={copy.credentialId}><input value={obtainedForm.credential_id} onChange={(e) => setObtainedForm({ ...obtainedForm, credential_id: e.target.value })} className={inputClass} /></Field><Field label={copy.credentialUrl}><input type="url" value={obtainedForm.credential_url} onChange={(e) => setObtainedForm({ ...obtainedForm, credential_url: e.target.value })} className={inputClass} /></Field></div><div className="mt-4"><Field label={copy.proof}><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-3.5 py-3 text-sm text-gray-600"><FileUp className="h-4 w-4 text-primary-600" /><span className="truncate">{obtainedFile?.name || copy.proof}</span><input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(e) => setObtainedFile(e.target.files?.[0] || null)} className="sr-only" /></label></Field></div></section><Actions copy={copy} submitting={submitting} onCancel={() => setShowObtained(false)} /></form></Modal>}
  </div>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"><div className="rounded-lg bg-primary-100 p-2.5 text-primary-700">{icon}</div><div><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900">{value}</p></div></div>; }
function Empty({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white text-gray-500 shadow-sm"><div className="rounded-full bg-gray-100 p-4">{icon}</div><p className="mt-4">{text}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-gray-700"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/50 p-4"><section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></header><div className="p-6">{children}</div></section></div>; }
function Actions({ copy, submitting, onCancel }: { copy: typeof copyByLocale.fr | typeof copyByLocale.en | typeof copyByLocale.pt; submitting: boolean; onCancel: () => void }) { return <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 font-semibold">{copy.cancel}</button><button disabled={submitting} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{copy.save}</button></div>; }
