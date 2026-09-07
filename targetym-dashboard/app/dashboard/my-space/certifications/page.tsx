'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award, CalendarClock, CheckCircle2, Clock3, Download, FileUp, Loader2,
  Plus, Search, ShieldCheck, Users, X, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Header from '@/components/Header';
import {
  confirmCertificationPayment, createCertificationAssignments, createCertificationRequest,
  decideCertificationRequest, listActionableCertificationRequests,
  listCertificationAssignmentTargets, listCertificationCatalog,
  listMyCertificationRequests, listMyCertificationWork, listMyCertifications,
  listPreparationCourses, submitCertificationResult, uploadCertificationQuote,
  uploadCertificationResultDocument, type CertificationAssignmentTarget,
  type CertificationCatalogItem, type CertificationRequest, type PersonalCertification,
  type PreparationCourse,
} from '@/lib/certificationsApi';
import { useI18n } from '@/lib/i18n/I18nContext';

type Tab = 'certificates' | 'todo' | 'requests' | 'approvals';
type ResultOutcome = 'obtained' | 'failed' | 'postponed';
type RequestForm = {
  certification_type_id: string; other_certification_name: string; provider: string;
  motivation: string; target_date: string; preparatory_training_required: boolean;
  preparation_course_id: string; training_cost: string; exam_cost: string;
  other_cost: string; currency: string;
  funding_mode: 'company' | 'employee_reimbursement' | 'self_funded';
};

const copyByLocale = {
  fr: {
    title: 'Mes certifications', subtitle: 'Retrouvez vos certificats, vos certifications à réaliser et les validations de votre équipe.',
    certificates: 'Mes certificats', todo: 'À réaliser', requests: 'Mes demandes', approvals: 'À valider',
    newRequest: 'Demander une certification', assign: 'Attribuer à mon équipe', emptyCertificates: 'Aucune certification enregistrée.',
    emptyTodo: 'Aucune certification à réaliser.', emptyRequests: 'Aucune demande de certification.', emptyApprovals: 'Aucune validation en attente.',
    obtained: 'Obtenue le', expires: 'Expire le', permanent: 'Validité permanente', download: 'Télécharger', verify: 'Vérifier',
    certification: 'Certification', other: 'Autre certification', otherName: 'Nom de la certification', provider: 'Organisme',
    motivation: 'Motivation et objectif professionnel', targetDate: 'Date cible', preparation: 'Formation préparatoire nécessaire',
    preparationCourse: 'Formation préparatoire', trainingCost: 'Coût de formation', examCost: "Coût d'examen", otherCost: 'Autres coûts',
    currency: 'Devise', funding: 'Financement', company: 'Entreprise', reimbursement: 'Remboursement au collaborateur',
    selfFunded: 'Financement personnel', quote: 'Devis (facultatif)', submit: 'Envoyer la demande', saveAssignment: 'Attribuer',
    cancel: 'Annuler', loading: 'Chargement…', retry: 'Réessayer', requestSent: 'Demande envoyée', assignmentSent: 'Certification attribuée',
    approve: 'Approuver', reject: 'Refuser', comment: 'Commentaire', approvedAmount: 'Montant approuvé', confirm: 'Examiner',
    submitResult: 'Déclarer le résultat', result: 'Résultat', resultObtained: 'Certification obtenue', resultFailed: 'Certification non obtenue',
    resultPostponed: 'Examen reporté', obtainedDate: "Date d'obtention", postponedUntil: "Nouvelle date d'examen",
    credentialId: 'Identifiant du certificat', credentialUrl: 'Lien de vérification', resultDocument: 'Justificatif du résultat',
    resultHelp: 'Une certification obtenue doit être accompagnée d’un justificatif, d’un identifiant ou d’un lien de vérification.',
    resultSent: 'Résultat transmis pour vérification', payment: 'Confirmer le paiement', paidAmount: 'Montant payé',
    paymentReference: 'Référence du paiement', paymentConfirmed: 'Paiement confirmé', required: 'Champ obligatoire', status: 'Statut',
    identity: 'Certification visée', planning: 'Préparation et calendrier', budget: 'Budget et financement', people: 'Collaborateurs concernés',
    searchEmployee: 'Rechercher un collaborateur', noTarget: 'Aucun collaborateur direct disponible.', mandatory: 'Certification obligatoire',
    optional: 'Recommandée, mais non obligatoire', assignedByManager: 'Attribuée par votre manager', assignedByAdmin: 'Attribuée par RH / Formation',
    personalRequest: 'Demandée par vous', selected: 'sélectionné(s)',
  },
  en: {
    title: 'My certifications', subtitle: 'View your certificates, certifications to complete, and team approvals.',
    certificates: 'My certificates', todo: 'To complete', requests: 'My requests', approvals: 'To approve',
    newRequest: 'Request a certification', assign: 'Assign to my team', emptyCertificates: 'No certification recorded.',
    emptyTodo: 'No certification to complete.', emptyRequests: 'No certification request.', emptyApprovals: 'No pending approval.',
    obtained: 'Obtained on', expires: 'Expires on', permanent: 'Permanent validity', download: 'Download', verify: 'Verify',
    certification: 'Certification', other: 'Other certification', otherName: 'Certification name', provider: 'Provider',
    motivation: 'Motivation and professional goal', targetDate: 'Target date', preparation: 'Preparatory training required',
    preparationCourse: 'Preparatory course', trainingCost: 'Training cost', examCost: 'Exam cost', otherCost: 'Other costs',
    currency: 'Currency', funding: 'Funding', company: 'Company', reimbursement: 'Employee reimbursement', selfFunded: 'Self-funded',
    quote: 'Quote (optional)', submit: 'Submit request', saveAssignment: 'Assign', cancel: 'Cancel', loading: 'Loading…', retry: 'Retry',
    requestSent: 'Request submitted', assignmentSent: 'Certification assigned', approve: 'Approve', reject: 'Reject', comment: 'Comment',
    approvedAmount: 'Approved amount', confirm: 'Review', submitResult: 'Report result', result: 'Result',
    resultObtained: 'Certification obtained', resultFailed: 'Certification not obtained', resultPostponed: 'Exam postponed',
    obtainedDate: 'Obtained date', postponedUntil: 'New exam date', credentialId: 'Credential ID', credentialUrl: 'Verification URL',
    resultDocument: 'Result document', resultHelp: 'An obtained certification requires a document, credential ID, or verification URL.',
    resultSent: 'Result sent for verification', payment: 'Confirm payment', paidAmount: 'Paid amount', paymentReference: 'Payment reference',
    paymentConfirmed: 'Payment confirmed', required: 'Required field', status: 'Status', identity: 'Target certification',
    planning: 'Preparation and schedule', budget: 'Budget and funding', people: 'Selected employees', searchEmployee: 'Search employee',
    noTarget: 'No direct report available.', mandatory: 'Mandatory certification', optional: 'Recommended, but not mandatory',
    assignedByManager: 'Assigned by your manager', assignedByAdmin: 'Assigned by HR / Learning', personalRequest: 'Requested by you', selected: 'selected',
  },
  pt: {
    title: 'Minhas certificações', subtitle: 'Consulte certificados, certificações a realizar e aprovações da equipe.',
    certificates: 'Meus certificados', todo: 'A realizar', requests: 'Meus pedidos', approvals: 'Para aprovar',
    newRequest: 'Solicitar certificação', assign: 'Atribuir à minha equipe', emptyCertificates: 'Nenhuma certificação registrada.',
    emptyTodo: 'Nenhuma certificação a realizar.', emptyRequests: 'Nenhum pedido de certificação.', emptyApprovals: 'Nenhuma aprovação pendente.',
    obtained: 'Obtida em', expires: 'Expira em', permanent: 'Validade permanente', download: 'Baixar', verify: 'Verificar',
    certification: 'Certificação', other: 'Outra certificação', otherName: 'Nome da certificação', provider: 'Organismo',
    motivation: 'Motivação e objetivo profissional', targetDate: 'Data prevista', preparation: 'Formação preparatória necessária',
    preparationCourse: 'Formação preparatória', trainingCost: 'Custo da formação', examCost: 'Custo do exame', otherCost: 'Outros custos',
    currency: 'Moeda', funding: 'Financiamento', company: 'Empresa', reimbursement: 'Reembolso ao colaborador',
    selfFunded: 'Financiamento pessoal', quote: 'Orçamento (opcional)', submit: 'Enviar pedido', saveAssignment: 'Atribuir',
    cancel: 'Cancelar', loading: 'Carregando…', retry: 'Tentar novamente', requestSent: 'Pedido enviado', assignmentSent: 'Certificação atribuída',
    approve: 'Aprovar', reject: 'Recusar', comment: 'Comentário', approvedAmount: 'Valor aprovado', confirm: 'Analisar',
    submitResult: 'Declarar resultado', result: 'Resultado', resultObtained: 'Certificação obtida', resultFailed: 'Certificação não obtida',
    resultPostponed: 'Exame adiado', obtainedDate: 'Data de obtenção', postponedUntil: 'Nova data do exame', credentialId: 'ID do certificado',
    credentialUrl: 'Link de verificação', resultDocument: 'Comprovativo do resultado',
    resultHelp: 'Uma certificação obtida exige comprovativo, identificador ou link de verificação.', resultSent: 'Resultado enviado para verificação',
    payment: 'Confirmar pagamento', paidAmount: 'Valor pago', paymentReference: 'Referência do pagamento', paymentConfirmed: 'Pagamento confirmado',
    required: 'Campo obrigatório', status: 'Estado', identity: 'Certificação pretendida', planning: 'Preparação e calendário',
    budget: 'Orçamento e financiamento', people: 'Colaboradores selecionados', searchEmployee: 'Pesquisar colaborador',
    noTarget: 'Nenhum colaborador direto disponível.', mandatory: 'Certificação obrigatória', optional: 'Recomendada, mas não obrigatória',
    assignedByManager: 'Atribuída pelo seu gestor', assignedByAdmin: 'Atribuída por RH / Formação', personalRequest: 'Solicitada por você', selected: 'selecionado(s)',
  },
} as const;

const statusLabels: Record<string, Record<string, string>> = {
  fr: { valid: 'Valide', expiring: 'Expire bientôt', expired: 'Expirée', revoked: 'Révoquée', pending_manager_n1: 'En attente N+1', pending_manager_n2: 'En attente N+2', pending_learning_admin: 'En attente RH / Formation', pending_finance: 'En attente Finance', blocked_configuration: 'Configuration à corriger', approved: 'Approuvée', in_progress: 'En préparation', exam_scheduled: 'Examen planifié', awaiting_result: 'Résultat attendu', awaiting_verification: 'Résultat à vérifier', obtained: 'Obtenue', failed: 'Non obtenue', rejected: 'Refusée' },
  en: { valid: 'Valid', expiring: 'Expiring soon', expired: 'Expired', revoked: 'Revoked', pending_manager_n1: 'Waiting for N+1', pending_manager_n2: 'Waiting for N+2', pending_learning_admin: 'Waiting for HR / Learning', pending_finance: 'Waiting for Finance', blocked_configuration: 'Configuration issue', approved: 'Approved', in_progress: 'In progress', exam_scheduled: 'Exam scheduled', awaiting_result: 'Result expected', awaiting_verification: 'Result to verify', obtained: 'Obtained', failed: 'Not obtained', rejected: 'Rejected' },
  pt: { valid: 'Válida', expiring: 'Expira em breve', expired: 'Expirada', revoked: 'Revogada', pending_manager_n1: 'Aguardando N+1', pending_manager_n2: 'Aguardando N+2', pending_learning_admin: 'Aguardando RH / Formação', pending_finance: 'Aguardando Finanças', blocked_configuration: 'Configuração a corrigir', approved: 'Aprovada', in_progress: 'Em preparação', exam_scheduled: 'Exame agendado', awaiting_result: 'Resultado esperado', awaiting_verification: 'Resultado a verificar', obtained: 'Obtida', failed: 'Não obtida', rejected: 'Recusada' },
};

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50';
const initialForm: RequestForm = {
  certification_type_id: '', other_certification_name: '', provider: '', motivation: '', target_date: '',
  preparatory_training_required: false, preparation_course_id: '', training_cost: '0', exam_cost: '0',
  other_cost: '0', currency: 'XOF', funding_mode: 'company',
};

export default function MyCertificationsPage() {
  const { locale } = useI18n();
  const copy = copyByLocale[locale];
  const dateLocale = locale === 'fr' ? 'fr-FR' : locale === 'pt' ? 'pt-BR' : 'en-US';
  const [tab, setTab] = useState<Tab>('certificates');
  const [certificates, setCertificates] = useState<PersonalCertification[]>([]);
  const [requests, setRequests] = useState<CertificationRequest[]>([]);
  const [todo, setTodo] = useState<CertificationRequest[]>([]);
  const [approvals, setApprovals] = useState<CertificationRequest[]>([]);
  const [catalog, setCatalog] = useState<CertificationCatalogItem[]>([]);
  const [courses, setCourses] = useState<PreparationCourse[]>([]);
  const [targets, setTargets] = useState<CertificationAssignmentTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [showAssignment, setShowAssignment] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [quote, setQuote] = useState<File | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<CertificationRequest | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [resultRequest, setResultRequest] = useState<CertificationRequest | null>(null);
  const [resultOutcome, setResultOutcome] = useState<ResultOutcome>('obtained');
  const [resultDate, setResultDate] = useState('');
  const [postponedUntil, setPostponedUntil] = useState('');
  const [resultComment, setResultComment] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [credentialUrl, setCredentialUrl] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<CertificationRequest | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [myCertificates, myRequests, myTodo, myApprovals, catalogItems, courseItems] = await Promise.all([
        listMyCertifications(), listMyCertificationRequests(), listMyCertificationWork(), listActionableCertificationRequests(),
        listCertificationCatalog(), listPreparationCourses(),
      ]);
      setCertificates(myCertificates); setRequests(myRequests); setTodo(myTodo); setApprovals(myApprovals);
      setCatalog(catalogItems); setCourses(courseItems);
      try { setTargets(await listCertificationAssignmentTargets()); } catch { setTargets([]); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Une erreur est survenue'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const money = (value: number, currency: string) => new Intl.NumberFormat(dateLocale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  const formatDate = (value: string) => new Intl.DateTimeFormat(dateLocale).format(new Date(`${value}T00:00:00`));
  const selectedCertification = useMemo(() => catalog.find((item) => item.id === Number(form.certification_type_id)), [catalog, form.certification_type_id]);
  const todoIds = useMemo(() => new Set(todo.map((item) => item.id)), [todo]);
  const requestHistory = useMemo(() => requests.filter((item) => !todoIds.has(item.id)), [requests, todoIds]);
  const filteredTargets = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    return term ? targets.filter((item) => `${item.name} ${item.email} ${item.employee_number || ''}`.toLowerCase().includes(term)) : targets;
  }, [employeeSearch, targets]);

  const payloadFromForm = () => {
    const total = Number(form.training_cost) + Number(form.exam_cost) + Number(form.other_cost);
    return {
      certification_type_id: form.certification_type_id ? Number(form.certification_type_id) : null,
      other_certification_name: form.certification_type_id ? null : form.other_certification_name.trim(),
      provider: form.provider.trim() || selectedCertification?.provider || null,
      motivation: form.motivation, target_date: form.target_date || null,
      preparatory_training_required: form.preparatory_training_required,
      preparation_course_id: form.preparatory_training_required && form.preparation_course_id ? Number(form.preparation_course_id) : null,
      training_cost: Number(form.training_cost), exam_cost: Number(form.exam_cost), other_cost: Number(form.other_cost),
      currency: form.currency, funding_mode: form.funding_mode,
      requires_finance: total > 0 && form.funding_mode !== 'self_funded',
    };
  };

  const closeRequest = () => { setShowRequest(false); setForm(initialForm); setQuote(null); };
  const closeAssignment = () => { setShowAssignment(false); setForm(initialForm); setQuote(null); setSelectedEmployeeIds([]); setEmployeeSearch(''); setMandatory(true); };
  const submitRequest = async (event: FormEvent) => {
    event.preventDefault(); if (!form.certification_type_id && !form.other_certification_name.trim()) return toast.error(copy.required);
    setSubmitting(true);
    try { const created = await createCertificationRequest(payloadFromForm()); if (quote) await uploadCertificationQuote(created.id, quote); toast.success(copy.requestSent); closeRequest(); setTab('requests'); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };
  const submitAssignment = async (event: FormEvent) => {
    event.preventDefault(); if (!selectedEmployeeIds.length) return toast.error(copy.required); setSubmitting(true);
    try { const result = await createCertificationAssignments({ ...payloadFromForm(), employee_ids: selectedEmployeeIds, is_mandatory: mandatory }); if (quote) await Promise.all(result.items.map((item) => uploadCertificationQuote(item.id, quote))); toast.success(copy.assignmentSent); closeAssignment(); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };
  const applyDecision = async (approved: boolean) => {
    if (!decision) return; setSubmitting(true);
    try { await decideCertificationRequest(decision.id, approved, decisionComment, approvedAmount ? Number(approvedAmount) : undefined); toast.success(approved ? copy.approve : copy.reject); setDecision(null); setDecisionComment(''); setApprovedAmount(''); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };
  const resetResult = () => { setResultOutcome('obtained'); setResultDate(''); setPostponedUntil(''); setResultComment(''); setCredentialId(''); setCredentialUrl(''); setResultFile(null); };
  const sendResult = async (event: FormEvent) => {
    event.preventDefault(); if (!resultRequest) return; setSubmitting(true);
    try { if (resultFile) await uploadCertificationResultDocument(resultRequest.id, resultFile); await submitCertificationResult(resultRequest.id, resultOutcome, resultDate, credentialId, credentialUrl, postponedUntil, resultComment); toast.success(copy.resultSent); setResultRequest(null); resetResult(); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };
  const confirmPayment = async (event: FormEvent) => {
    event.preventDefault(); if (!paymentRequest) return; setSubmitting(true);
    try { await confirmCertificationPayment(paymentRequest.id, Number(paidAmount), paymentReference); toast.success(copy.paymentConfirmed); setPaymentRequest(null); setPaidAmount(''); setPaymentReference(''); await load(); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : 'Erreur'); }
    finally { setSubmitting(false); }
  };

  const canSubmitResult = (request: CertificationRequest) => ['approved', 'in_progress', 'exam_scheduled', 'awaiting_result', 'failed'].includes(request.status);
  const originLabel = (request: CertificationRequest) => request.request_origin === 'manager_assignment' ? copy.assignedByManager : request.request_origin === 'admin_assignment' ? copy.assignedByAdmin : copy.personalRequest;

  return <div className="min-h-screen bg-gray-50"><Header /><main className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
    <section className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-purple-700 to-primary-600 px-6 py-7 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><div className="rounded-xl bg-white/15 p-3"><Award className="h-7 w-7" /></div><div><h1 className="text-2xl font-bold">{copy.title}</h1><p className="mt-1 max-w-2xl text-sm text-white/85">{copy.subtitle}</p></div></div><div className="flex flex-wrap gap-2">{targets.length > 0 && <button onClick={() => setShowAssignment(true)} className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 font-semibold text-white hover:bg-white/20"><Users className="h-4 w-4" />{copy.assign}</button>}<button onClick={() => setShowRequest(true)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-primary-700 hover:bg-primary-50"><Plus className="h-4 w-4" />{copy.newRequest}</button></div></section>
    <div className="flex gap-2 overflow-x-auto rounded-xl border border-gray-100 bg-white p-2 shadow-sm">{([['certificates', copy.certificates, certificates.length], ['todo', copy.todo, todo.length], ['requests', copy.requests, requestHistory.length], ['approvals', copy.approvals, approvals.length]] as [Tab, string, number][]).map(([value, label, count]) => <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{label} <span className="ml-1 opacity-80">({count})</span></button>)}</div>
    {loading ? <Empty icon={<Loader2 className="h-7 w-7 animate-spin" />} text={copy.loading} /> : error ? <Empty icon={<XCircle className="h-7 w-7 text-red-500" />} text={error}><button onClick={() => void load()} className="mt-3 font-semibold text-primary-700 underline">{copy.retry}</button></Empty> : tab === 'certificates' ? (certificates.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{certificates.map((item) => <article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div className="rounded-xl bg-purple-100 p-3 text-purple-700"><Award className="h-6 w-6" /></div><Status value={item.status} label={statusLabels[locale]?.[item.status] || item.status} /></div><h2 className="mt-4 text-lg font-bold text-gray-900">{item.name}</h2><p className="text-sm text-gray-500">{item.provider || '—'}</p><div className="mt-4 space-y-2 text-sm text-gray-600"><p>{copy.obtained} : {formatDate(item.obtained_date)}</p><p>{item.expiry_date ? `${copy.expires} : ${formatDate(item.expiry_date)}` : copy.permanent}</p></div><div className="mt-5 flex gap-2">{item.certificate_url && <a href={item.certificate_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white"><Download className="h-4 w-4" />{copy.download}</a>}{item.credential_url && <a href={item.credential_url} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700">{copy.verify}</a>}</div></article>)}</div> : <Empty icon={<Award className="h-7 w-7" />} text={copy.emptyCertificates} />) : tab === 'todo' ? <RequestList items={todo} empty={copy.emptyTodo} locale={locale} copy={copy} money={money} originLabel={originLabel} onResult={setResultRequest} canSubmitResult={canSubmitResult} /> : tab === 'requests' ? <RequestList items={requestHistory} empty={copy.emptyRequests} locale={locale} copy={copy} money={money} originLabel={originLabel} /> : approvals.length ? <div className="space-y-3">{approvals.map((item) => <article key={`${item.id}-${item.actionable_type}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-gray-900">{item.certification_name}</h2><p className="text-sm text-gray-500">{item.employee_name}</p><p className="mt-2 text-sm text-gray-600">{item.motivation}</p>{item.total_cost > 0 && <p className="mt-1 text-sm font-semibold text-gray-700">{money(item.total_cost, item.currency)}</p>}</div><button onClick={() => item.actionable_type === 'payment' ? setPaymentRequest(item) : setDecision(item)} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white">{item.actionable_type === 'payment' ? copy.payment : copy.confirm}</button></div></article>)}</div> : <Empty icon={<ShieldCheck className="h-7 w-7" />} text={copy.emptyApprovals} />}
  </main>

  {showRequest && <Modal title={copy.newRequest} icon={<Award />} onClose={closeRequest}><form onSubmit={submitRequest} className="space-y-5"><RequestFields form={form} setForm={setForm} catalog={catalog} courses={courses} quote={quote} setQuote={setQuote} copy={copy} /><ModalActions cancel={copy.cancel} submit={copy.submit} submitting={submitting} onCancel={closeRequest} /></form></Modal>}
  {showAssignment && <Modal title={copy.assign} icon={<Users />} onClose={closeAssignment} wide><form onSubmit={submitAssignment} className="space-y-5"><FormSection title={copy.people} icon={<Users className="h-4 w-4" />}><div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" /><input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder={copy.searchEmployee} className={`${inputClass} pl-10`} /></div><div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-gray-100 p-2">{filteredTargets.length ? filteredTargets.map((target) => <label key={target.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 hover:bg-gray-50"><input type="checkbox" checked={selectedEmployeeIds.includes(target.id)} onChange={() => setSelectedEmployeeIds((current) => current.includes(target.id) ? current.filter((id) => id !== target.id) : [...current, target.id])} className="h-4 w-4 rounded border-gray-300 text-primary-600" /><span><span className="block text-sm font-semibold text-gray-900">{target.name}</span><span className="block text-xs text-gray-500">{target.job_title || target.email}</span></span></label>) : <p className="p-4 text-center text-sm text-gray-500">{copy.noTarget}</p>}</div><p className="mt-2 text-xs font-semibold text-primary-700">{selectedEmployeeIds.length} {copy.selected}</p><label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"><input type="checkbox" checked={mandatory} onChange={(event) => setMandatory(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600" /><span><span className="block text-sm font-semibold text-gray-900">{copy.mandatory}</span><span className="block text-xs text-gray-500">{copy.optional}</span></span></label></FormSection><RequestFields form={form} setForm={setForm} catalog={catalog} courses={courses} quote={quote} setQuote={setQuote} copy={copy} /><ModalActions cancel={copy.cancel} submit={copy.saveAssignment} submitting={submitting} onCancel={closeAssignment} /></form></Modal>}
  {decision && <Modal title={`${copy.confirm} — ${decision.certification_name}`} icon={<ShieldCheck />} onClose={() => setDecision(null)}><div className="space-y-4"><Field label={copy.comment}><textarea value={decisionComment} onChange={(e) => setDecisionComment(e.target.value)} className={`${inputClass} min-h-24 resize-y`} /></Field>{decision.current_step === 'finance' && <Field label={copy.approvedAmount}><input type="number" min="0" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} className={inputClass} /></Field>}<div className="flex justify-end gap-2"><button disabled={submitting} onClick={() => void applyDecision(false)} className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 font-semibold text-red-700"><XCircle className="h-4 w-4" />{copy.reject}</button><button disabled={submitting} onClick={() => void applyDecision(true)} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 font-semibold text-white"><CheckCircle2 className="h-4 w-4" />{copy.approve}</button></div></div></Modal>}
  {resultRequest && <Modal title={`${copy.submitResult} — ${resultRequest.certification_name}`} icon={<Award />} onClose={() => { setResultRequest(null); resetResult(); }}><form onSubmit={sendResult} className="space-y-5"><FormSection title={copy.result} icon={<CheckCircle2 className="h-4 w-4" />}><div className="grid gap-3 sm:grid-cols-3">{([['obtained', copy.resultObtained], ['failed', copy.resultFailed], ['postponed', copy.resultPostponed]] as [ResultOutcome, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setResultOutcome(value)} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${resultOutcome === value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>{label}</button>)}</div></FormSection>{resultOutcome === 'obtained' && <FormSection title={copy.resultObtained} icon={<Award className="h-4 w-4" />}><p className="mb-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">{copy.resultHelp}</p><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.obtainedDate}><input required type="date" value={resultDate} onChange={(e) => setResultDate(e.target.value)} className={inputClass} /></Field><FileField label={copy.resultDocument} file={resultFile} onChange={setResultFile} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label={copy.credentialId}><input value={credentialId} onChange={(e) => setCredentialId(e.target.value)} className={inputClass} /></Field><Field label={copy.credentialUrl}><input type="url" value={credentialUrl} onChange={(e) => setCredentialUrl(e.target.value)} className={inputClass} /></Field></div></FormSection>}{resultOutcome === 'postponed' && <Field label={copy.postponedUntil}><input required type="date" value={postponedUntil} onChange={(e) => setPostponedUntil(e.target.value)} className={inputClass} /></Field>}{resultOutcome !== 'obtained' && <Field label={copy.comment}><textarea value={resultComment} onChange={(e) => setResultComment(e.target.value)} className={`${inputClass} min-h-24 resize-y`} /></Field>}<ModalActions cancel={copy.cancel} submit={copy.submit} submitting={submitting} onCancel={() => { setResultRequest(null); resetResult(); }} /></form></Modal>}
  {paymentRequest && <Modal title={copy.payment} icon={<ShieldCheck />} onClose={() => setPaymentRequest(null)}><form onSubmit={confirmPayment} className="space-y-4"><Field label={copy.paidAmount}><input required type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className={inputClass} /></Field><Field label={copy.paymentReference}><input required minLength={2} value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className={inputClass} /></Field><ModalActions cancel={copy.cancel} submit={copy.submit} submitting={submitting} onCancel={() => setPaymentRequest(null)} /></form></Modal>}
  </div>;
}

type Copy = typeof copyByLocale.fr | typeof copyByLocale.en | typeof copyByLocale.pt;

function RequestFields({ form, setForm, catalog, courses, quote, setQuote, copy }: { form: RequestForm; setForm: (value: RequestForm) => void; catalog: CertificationCatalogItem[]; courses: PreparationCourse[]; quote: File | null; setQuote: (file: File | null) => void; copy: Copy }) {
  return <><FormSection title={copy.identity} icon={<Award className="h-4 w-4" />}><Field label={copy.certification}><select value={form.certification_type_id} onChange={(e) => { const selected = catalog.find((item) => item.id === Number(e.target.value)); setForm({ ...form, certification_type_id: e.target.value, other_certification_name: e.target.value ? '' : form.other_certification_name, provider: selected?.provider || '' }); }} className={inputClass}><option value="">{copy.other}</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{form.certification_type_id ? <div className="mt-4"><Field label={copy.provider}><input value={form.provider} readOnly className={`${inputClass} bg-gray-50 text-gray-600`} /></Field></div> : <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label={copy.otherName}><input required value={form.other_certification_name} onChange={(e) => setForm({ ...form, other_certification_name: e.target.value })} className={inputClass} /></Field><Field label={copy.provider}><input required value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className={inputClass} /></Field></div>}<div className="mt-4"><Field label={copy.motivation}><textarea required minLength={3} value={form.motivation} onChange={(e) => setForm({ ...form, motivation: e.target.value })} className={`${inputClass} min-h-28 resize-y`} /></Field></div></FormSection><FormSection title={copy.planning} icon={<CalendarClock className="h-4 w-4" />}><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.targetDate}><input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} className={inputClass} /></Field><FileField label={copy.quote} file={quote} onChange={setQuote} /></div><label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.preparatory_training_required} onChange={(e) => setForm({ ...form, preparatory_training_required: e.target.checked, preparation_course_id: e.target.checked ? form.preparation_course_id : '' })} className="h-4 w-4 rounded border-gray-300 text-primary-600" />{copy.preparation}</label>{form.preparatory_training_required && <div className="mt-4"><Field label={copy.preparationCourse}><select value={form.preparation_course_id} onChange={(e) => setForm({ ...form, preparation_course_id: e.target.value })} className={inputClass}><option value="">—</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field></div>}</FormSection><FormSection title={copy.budget} icon={<ShieldCheck className="h-4 w-4" />}><div className="grid gap-4 sm:grid-cols-3">{([['training_cost', copy.trainingCost], ['exam_cost', copy.examCost], ['other_cost', copy.otherCost]] as const).map(([key, label]) => <Field key={key} label={label}><input type="number" min="0" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass} /></Field>)}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label={copy.currency}><input required value={form.currency} maxLength={10} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className={inputClass} /></Field><Field label={copy.funding}><select value={form.funding_mode} onChange={(e) => setForm({ ...form, funding_mode: e.target.value as RequestForm['funding_mode'] })} className={inputClass}><option value="company">{copy.company}</option><option value="employee_reimbursement">{copy.reimbursement}</option><option value="self_funded">{copy.selfFunded}</option></select></Field></div></FormSection></>;
}

function RequestList({ items, empty, locale, copy, money, originLabel, onResult, canSubmitResult }: { items: CertificationRequest[]; empty: string; locale: 'fr' | 'en' | 'pt'; copy: Copy; money: (value: number, currency: string) => string; originLabel: (request: CertificationRequest) => string; onResult?: (request: CertificationRequest) => void; canSubmitResult?: (request: CertificationRequest) => boolean }) {
  if (!items.length) return <Empty icon={<Clock3 className="h-7 w-7" />} text={empty} />;
  return <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-gray-900">{item.certification_name}</h2>{item.is_mandatory && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">{copy.mandatory}</span>}</div><p className="mt-1 text-xs font-medium text-gray-500">{originLabel(item)}</p><p className="mt-2 text-sm text-gray-500">{copy.status} : {statusLabels[locale]?.[item.status] || item.status}</p>{item.target_date && <p className="mt-1 text-sm text-gray-600">{copy.targetDate} : {item.target_date}</p>}{item.total_cost > 0 && <p className="mt-1 text-sm text-gray-600">{money(item.total_cost, item.currency)}</p>}</div><div className="flex items-center gap-2"><Status value={item.status} label={statusLabels[locale]?.[item.status] || item.status} />{onResult && canSubmitResult?.(item) && <button onClick={() => onResult(item)} className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white">{copy.submitResult}</button>}</div></div></article>)}</div>;
}

function Empty({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) { return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-6 text-center text-gray-500 shadow-sm"><div className="rounded-full bg-gray-100 p-4">{icon}</div><p className="mt-4">{text}</p>{children}</div>; }
function Status({ value, label }: { value: string; label: string }) { const success = ['valid', 'obtained', 'approved'].includes(value); const danger = ['expired', 'revoked', 'failed', 'rejected', 'blocked_configuration'].includes(value); return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${success ? 'bg-green-100 text-green-700' : danger ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{label}</span>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-gray-700"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function FormSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700"><span className="rounded-lg bg-primary-50 p-2 text-primary-700">{icon}</span>{title}</h3>{children}</section>; }
function FileField({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) { return <Field label={label}><label className="flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600 hover:border-primary-400 hover:bg-primary-50"><FileUp className="h-4 w-4 text-primary-600" /><span className="truncate">{file?.name || label}</span><input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(e) => onChange(e.target.files?.[0] || null)} className="sr-only" /></label></Field>; }
function Modal({ title, icon, onClose, children, wide = false }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm"><section className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-gray-50 shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-3xl'}`}><header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-primary-50 p-2.5 text-primary-700">{icon}</span><h2 className="text-xl font-bold text-gray-900">{title}</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></header><div className="p-5 sm:p-6">{children}</div></section></div>; }
function ModalActions({ cancel, submit, submitting, onCancel }: { cancel: string; submit: string; submitting: boolean; onCancel: () => void }) { return <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-gray-50 pt-4"><button type="button" onClick={onCancel} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700">{cancel}</button><button disabled={submitting} className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submit}</button></div>; }
