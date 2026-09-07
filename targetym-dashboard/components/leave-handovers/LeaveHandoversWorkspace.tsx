'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileUp,
  Loader2,
  MessageCircleQuestion,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import Header from '@/components/Header';
import {
  acknowledgeLeaveHandover,
  cancelLeaveHandover,
  createLeaveHandover,
  decideLeaveHandoverAsManager,
  downloadLeaveHandoverAttachment,
  getHandoverSubstituteCandidates,
  getLeaveHandover,
  getLeaveHandovers,
  getLeaveRequests,
  getTeamMembers,
  requestLeaveHandoverClarification,
  sendLeaveHandover,
  updateLeaveHandover,
  uploadLeaveHandoverAttachment,
  type HandoverSubstituteCandidate,
  type LeaveHandover,
  type LeaveHandoverItem,
  type LeaveRequest,
} from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nContext';

type Mode = 'personal' | 'admin';
type PersonalTab = 'outgoing' | 'incoming' | 'team';
type HandoverForm = {
  leave_request_id: string;
  substitute_employee_id: string;
  override_reason: string;
  notes: string;
  items: LeaveHandoverItem[];
};

const copyByLocale = {
  fr: {
    title: 'Passations de congé',
    personalSubtitle: 'Préparez votre absence et suivez les intérims qui vous sont confiés.',
    adminSubtitle: 'Consultez les passations de congé du tenant sans déléguer de droits applicatifs.',
    outgoing: 'Mes passations', incoming: 'Mes intérims', team: 'Mon équipe', newHandover: 'Préparer une passation',
    newTeamHandover: 'Préparer pour mon équipe',
    empty: 'Aucune passation dans cette vue.', refresh: 'Actualiser', leave: 'Congé concerné',
    substitute: 'Intérimaire', choose: 'Sélectionner', notes: 'Consignes générales',
    task: 'Dossier / tâche', meeting: 'Réunion', titleField: 'Intitulé', description: 'Actions à réaliser',
    dueDate: 'Échéance', controlledBy: 'Contrôlé par', observation: 'Observation', location: 'Lieu',
    meetingStart: 'Début', meetingEnd: 'Fin', addTask: 'Ajouter un élément', remove: 'Retirer',
    saveDraft: 'Enregistrer le brouillon', saveAndSend: 'Enregistrer et envoyer', save: 'Enregistrer',
    cancel: 'Annuler', edit: 'Modifier', send: 'Envoyer', acknowledge: 'Confirmer la prise en charge',
    clarify: 'Demander une précision', clarification: 'Précision demandée', clarificationPlaceholder: 'Expliquez la précision nécessaire…',
    close: 'Fermer', attachments: 'Documents utiles', addAttachment: 'Ajouter un document', download: 'Télécharger',
    history: 'Journal', version: 'Version', owner: 'Absent(e)', period: 'Période', statusLabel: 'Statut', details: 'Voir le détail',
    availabilityWarning: 'Disponibilité à vérifier', saved: 'Passation enregistrée', sent: 'Passation envoyée',
    updated: 'Passation mise à jour', acknowledged: 'Prise en charge confirmée', clarificationSent: 'Demande de précision envoyée',
    cancelled: 'Passation annulée', confirmCancel: 'Annuler cette passation ?', required: 'Complétez les champs obligatoires.',
    noEligibleLeave: 'Aucun congé actif sans passation.', search: 'Rechercher un intérimaire', itemsLabel: 'élément(s)',
    noPermission: 'Cette vue est réservée aux RH et administrateurs.', secureInfo: "L’intérimaire reçoit les informations de passation, jamais les droits de l’employé absent.",
    managerReview: 'Validation du N+1', approve: 'Valider et envoyer', requestChanges: 'Demander des modifications',
    managerComment: 'Commentaire du manager', decisionComment: 'Commentaire ou modification demandée…',
    approved: 'Passation validée', changesRequested: 'Modifications demandées',
    useOverride: 'Choisir exceptionnellement dans toute l’entreprise', overrideReason: 'Justification obligatoire de l’exception',
    peer: 'Même équipe', directReport: 'Collaborateur direct', peerManager: 'Manager pair', tenantOverride: 'Exception RH',
  },
  en: {
    title: 'Leave handovers', personalSubtitle: 'Prepare your absence and track the handovers assigned to you.',
    adminSubtitle: 'Review tenant leave handovers without delegating application permissions.',
    outgoing: 'My handovers', incoming: 'My substitutions', team: 'My team', newHandover: 'Prepare a handover',
    newTeamHandover: 'Prepare for my team', empty: 'No handover in this view.',
    refresh: 'Refresh', leave: 'Related leave', substitute: 'Substitute', choose: 'Select', notes: 'General instructions',
    task: 'File / task', meeting: 'Meeting', titleField: 'Title', description: 'Actions to complete', dueDate: 'Due date',
    controlledBy: 'Controlled by', observation: 'Notes', location: 'Location', meetingStart: 'Start', meetingEnd: 'End',
    addTask: 'Add item', remove: 'Remove', saveDraft: 'Save draft', saveAndSend: 'Save and send', save: 'Save', cancel: 'Cancel',
    edit: 'Edit', send: 'Send', acknowledge: 'Acknowledge handover', clarify: 'Request clarification', clarification: 'Clarification requested',
    clarificationPlaceholder: 'Explain what needs clarification…', close: 'Close', attachments: 'Useful documents',
    addAttachment: 'Add document', download: 'Download', history: 'Audit trail', version: 'Version', owner: 'Absent employee',
    period: 'Period', statusLabel: 'Status', details: 'View details', availabilityWarning: 'Availability needs review', saved: 'Handover saved', sent: 'Handover sent',
    updated: 'Handover updated', acknowledged: 'Handover acknowledged', clarificationSent: 'Clarification request sent',
    cancelled: 'Handover cancelled', confirmCancel: 'Cancel this handover?', required: 'Complete the required fields.',
    noEligibleLeave: 'No active leave without a handover.', search: 'Search for a substitute', itemsLabel: 'item(s)',
    noPermission: 'This view is restricted to HR and administrators.', secureInfo: 'The substitute receives handover information, never the permissions of the absent employee.',
    managerReview: 'Manager approval', approve: 'Approve and send', requestChanges: 'Request changes',
    managerComment: 'Manager comment', decisionComment: 'Comment or requested change…', approved: 'Handover approved',
    changesRequested: 'Changes requested', useOverride: 'Exceptionally choose from the whole company',
    overrideReason: 'Required reason for the exception', peer: 'Same team', directReport: 'Direct report',
    peerManager: 'Peer manager', tenantOverride: 'HR exception',
  },
  pt: {
    title: 'Passagens de férias', personalSubtitle: 'Prepare a sua ausência e acompanhe as substituições que lhe foram confiadas.',
    adminSubtitle: 'Consulte as passagens do tenant sem delegar permissões da aplicação.', outgoing: 'Minhas passagens',
    incoming: 'Minhas substituições', team: 'Minha equipa', newHandover: 'Preparar uma passagem',
    newTeamHandover: 'Preparar para a minha equipa', empty: 'Nenhuma passagem nesta vista.', refresh: 'Atualizar',
    leave: 'Férias relacionadas', substitute: 'Substituto', choose: 'Selecionar', notes: 'Instruções gerais', task: 'Dossiê / tarefa',
    meeting: 'Reunião', titleField: 'Título', description: 'Ações a realizar', dueDate: 'Prazo', controlledBy: 'Controlado por',
    observation: 'Observação', location: 'Local', meetingStart: 'Início', meetingEnd: 'Fim', addTask: 'Adicionar elemento',
    remove: 'Remover', saveDraft: 'Guardar rascunho', saveAndSend: 'Guardar e enviar', save: 'Guardar', cancel: 'Cancelar', edit: 'Editar',
    send: 'Enviar', acknowledge: 'Confirmar a responsabilidade', clarify: 'Pedir esclarecimento', clarification: 'Esclarecimento pedido',
    clarificationPlaceholder: 'Explique o esclarecimento necessário…', close: 'Fechar', attachments: 'Documentos úteis',
    addAttachment: 'Adicionar documento', download: 'Baixar', history: 'Histórico', version: 'Versão', owner: 'Colaborador ausente',
    period: 'Período', statusLabel: 'Estado', details: 'Ver detalhes', availabilityWarning: 'Disponibilidade a verificar', saved: 'Passagem guardada',
    sent: 'Passagem enviada', updated: 'Passagem atualizada', acknowledged: 'Responsabilidade confirmada',
    clarificationSent: 'Pedido de esclarecimento enviado', cancelled: 'Passagem cancelada', confirmCancel: 'Cancelar esta passagem?',
    required: 'Preencha os campos obrigatórios.', noEligibleLeave: 'Nenhuma licença ativa sem passagem.', search: 'Pesquisar substituto', itemsLabel: 'elemento(s)',
    noPermission: 'Esta vista é reservada a RH e administradores.', secureInfo: 'O substituto recebe as informações da passagem, nunca as permissões do colaborador ausente.',
    managerReview: 'Validação do gestor', approve: 'Validar e enviar', requestChanges: 'Pedir alterações',
    managerComment: 'Comentário do gestor', decisionComment: 'Comentário ou alteração solicitada…', approved: 'Passagem validada',
    changesRequested: 'Alterações solicitadas', useOverride: 'Escolher excecionalmente em toda a empresa',
    overrideReason: 'Justificação obrigatória da exceção', peer: 'Mesma equipa', directReport: 'Colaborador direto',
    peerManager: 'Gestor par', tenantOverride: 'Exceção RH',
  },
} as const;

const statusByLocale: Record<string, Record<string, string>> = {
  fr: { draft: 'Brouillon', pending_manager: 'À valider par le N+1', changes_requested: 'À corriger', sent: 'À confirmer', clarification_requested: 'Précision demandée', acknowledged: 'Confirmée', in_progress: 'En cours', closed: 'Archivée', cancelled: 'Annulée' },
  en: { draft: 'Draft', pending_manager: 'Awaiting manager approval', changes_requested: 'Changes requested', sent: 'Awaiting confirmation', clarification_requested: 'Clarification requested', acknowledged: 'Acknowledged', in_progress: 'In progress', closed: 'Archived', cancelled: 'Cancelled' },
  pt: { draft: 'Rascunho', pending_manager: 'A aguardar validação do gestor', changes_requested: 'Alterações solicitadas', sent: 'A confirmar', clarification_requested: 'Esclarecimento pedido', acknowledged: 'Confirmada', in_progress: 'Em curso', closed: 'Arquivada', cancelled: 'Cancelada' },
};

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50';
const blankItem = (): LeaveHandoverItem => ({ item_type: 'task', title: '', description: '', due_date: null, controlled_by_employee_id: null, observation: '', meeting_start_at: null, meeting_end_at: null, location: '' });
const blankForm = (): HandoverForm => ({ leave_request_id: '', substitute_employee_id: '', override_reason: '', notes: '', items: [blankItem()] });

function formatDate(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale === 'fr' ? 'fr-FR' : locale === 'pt' ? 'pt-PT' : 'en-GB');
}

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === 'fr' ? 'fr-FR' : locale === 'pt' ? 'pt-PT' : 'en-GB');
}

export default function LeaveHandoversWorkspace({ mode }: { mode: Mode }) {
  const { locale } = useI18n();
  const copy = copyByLocale[locale];
  const [isManager] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return Boolean(
        user.has_manager_access
        || user.is_manager
        || Number(user.managed_employee_count || 0) > 0
        || user.role === 'manager',
      );
    } catch {
      return false;
    }
  });
  const [tab, setTab] = useState<PersonalTab>('outgoing');
  const [rows, setRows] = useState<LeaveHandover[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [candidates, setCandidates] = useState<HandoverSubstituteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<HandoverForm>(blankForm());
  const [editing, setEditing] = useState<LeaveHandover | null>(null);
  const [selected, setSelected] = useState<LeaveHandover | null>(null);
  const [clarification, setClarification] = useState('');
  const [managerComment, setManagerComment] = useState('');
  const [search, setSearch] = useState('');
  const [useTenantOverride, setUseTenantOverride] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getLeaveHandovers(mode === 'admin' ? 'admin' : tab, 1, 100);
      setRows(result.items);
      if (mode === 'personal' && ['outgoing', 'team'].includes(tab)) {
        const [requests, teamMembers] = await Promise.all([
          getLeaveRequests({ page: 1, page_size: 100 }),
          tab === 'team' ? getTeamMembers() : Promise.resolve([]),
        ]);
        let currentEmployeeId: number | null = null;
        try {
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          currentEmployeeId = Number(storedUser.employee_id) || null;
        } catch {
          currentEmployeeId = null;
        }
        const teamIds = new Set(teamMembers.map(member => member.id));
        const visibleLeaves = requests.items.filter(request => (
          tab === 'team'
            ? teamIds.has(request.employee_id)
            : request.employee_id === currentEmployeeId
        ));
        setLeaves(visibleLeaves);
        const requestedLeaveId = Number(
          new URL(window.location.href).searchParams.get('leave_request_id'),
        );
        if (
          requestedLeaveId
          && tab === 'outgoing'
          && visibleLeaves.some(request => request.id === requestedLeaveId)
        ) {
          setEditing(null);
          setForm({ ...blankForm(), leave_request_id: String(requestedLeaveId) });
          setFormOpen(true);
        }
      }
      const requestedId = Number(new URL(window.location.href).searchParams.get('handover'));
      if (requestedId) {
        const requested = result.items.find(item => item.id === requestedId)
          || await getLeaveHandover(requestedId);
        setSelected(requested);
        if (mode === 'personal') {
          try {
            const employeeId = Number(JSON.parse(localStorage.getItem('user') || '{}').employee_id);
            if (requested.can_validate && tab !== 'team') {
              setTab('team');
            } else if (employeeId === requested.substitute_employee_id && tab !== 'incoming') {
              setTab('incoming');
            }
          } catch {
            // The API still enforces access when the local profile is unavailable.
          }
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.empty);
    } finally {
      setLoading(false);
    }
  }, [copy.empty, mode, tab]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setManagerComment(selected?.manager_comment || '');
    setClarification('');
  }, [selected?.id, selected?.manager_comment]);

  useEffect(() => {
    const leaveRequestId = Number(form.leave_request_id);
    if (!formOpen || !leaveRequestId) {
      setCandidates([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void getHandoverSubstituteCandidates(
        leaveRequestId,
        search,
        {
          includeTenantOverride: mode === 'admin' && useTenantOverride,
          overrideReason: form.override_reason,
        },
      ).then(people => {
        if (
          editing
          && !people.some(person => person.id === editing.substitute_employee_id)
        ) {
          setCandidates([
            {
              id: editing.substitute_employee_id,
              first_name: editing.substitute_name,
              last_name: '',
              email: editing.substitute_email || '',
              relationship_scope: 'tenant_override',
            },
            ...people,
          ]);
        } else {
          setCandidates(people);
        }
      }).catch(() => setCandidates([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [editing, form.leave_request_id, form.override_reason, formOpen, mode, search, useTenantOverride]);

  const usedLeaveIds = useMemo(() => new Set(rows.map(row => row.leave_request_id)), [rows]);
  const eligibleLeaves = leaves.filter(leave =>
    ['pending', 'manager_approved', 'n2_approved', 'approved'].includes(leave.status)
    && (!usedLeaveIds.has(leave.id) || editing?.leave_request_id === leave.id),
  );

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setUseTenantOverride(false);
    setFormOpen(true);
  };

  const openEdit = (handover: LeaveHandover) => {
    setEditing(handover);
    setForm({
      leave_request_id: String(handover.leave_request_id),
      substitute_employee_id: String(handover.substitute_employee_id),
      override_reason: handover.override_reason || '',
      notes: handover.notes || '',
      items: handover.items.map(item => ({ ...item })),
    });
    setSelected(null);
    setUseTenantOverride(Boolean(handover.override_reason));
    setFormOpen(true);
  };

  const updateItem = (index: number, patch: Partial<LeaveHandoverItem>) => {
    setForm(current => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  };

  const saveForm = async (shouldSend: boolean) => {
    if (!form.leave_request_id || !form.substitute_employee_id || !form.items.length || form.items.some(item => !item.title.trim())) {
      toast.error(copy.required);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        substitute_employee_id: Number(form.substitute_employee_id),
        override_reason: form.override_reason || undefined,
        notes: form.notes || undefined,
        items: form.items.map(item => ({
          item_type: item.item_type,
          title: item.title,
          description: item.description,
          due_date: item.due_date,
          controlled_by_employee_id: item.controlled_by_employee_id,
          observation: item.observation,
          meeting_start_at: item.meeting_start_at,
          meeting_end_at: item.meeting_end_at,
          location: item.location,
        })),
      };
      let saved: LeaveHandover;
      if (editing) {
        saved = await updateLeaveHandover(editing.id, payload);
        toast.success(copy.updated);
      } else {
        saved = await createLeaveHandover({ leave_request_id: Number(form.leave_request_id), ...payload });
        toast.success(copy.saved);
      }
      if (shouldSend && saved.status === 'draft') {
        saved = await sendLeaveHandover(saved.id);
        toast.success(copy.sent);
      }
      setFormOpen(false);
      setEditing(null);
      await load();
      setSelected(saved);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : copy.required);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: () => Promise<LeaveHandover>, success: string) => {
    setSaving(true);
    try {
      const updated = await action();
      setSelected(updated);
      toast.success(success);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : copy.required);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || !selected) return;
    await runAction(() => uploadLeaveHandoverAttachment(selected.id, file), copy.updated);
  };

  return (
    <>
      <Header title={copy.title} subtitle={mode === 'admin' ? copy.adminSubtitle : copy.personalSubtitle} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><UsersRound className="h-5 w-5" />{copy.secureInfo}</span>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" />{copy.refresh}</button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {mode === 'personal' ? (
            <div className="inline-flex rounded-xl bg-gray-100 p-1">
              {(['outgoing', 'incoming', ...(isManager ? ['team' as const] : [])] as PersonalTab[]).map(value => (
                <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  {value === 'outgoing' ? copy.outgoing : value === 'incoming' ? copy.incoming : copy.team}
                </button>
              ))}
            </div>
          ) : <div />}
          {mode === 'personal' && ['outgoing', 'team'].includes(tab) && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              <Plus className="h-4 w-4" />{tab === 'team' ? copy.newTeamHandover : copy.newHandover}
            </button>
          )}
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
            <ClipboardList className="mx-auto mb-3 h-9 w-9 text-gray-300" /><p>{copy.empty}</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map(handover => (
              <button key={handover.id} onClick={() => setSelected(handover)} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:border-primary-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{handover.leave_type_name}</p><h2 className="mt-1 text-lg font-bold text-gray-900">{mode === 'admin' || ['incoming', 'team'].includes(tab) ? handover.owner_name : handover.substitute_name}</h2></div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{statusByLocale[locale][handover.status] || handover.status}</span>
                </div>
                <p className="mt-4 text-sm text-gray-600">{formatDate(handover.start_date, locale)} — {formatDate(handover.end_date, locale)}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500"><span>{copy.version} {handover.version} · {handover.items.length} {copy.itemsLabel}</span><span className="inline-flex items-center gap-1 font-semibold text-primary-700">{copy.details}<ChevronRight className="h-4 w-4" /></span></div>
                {handover.availability_warning && <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800"><AlertTriangle className="h-4 w-4" />{copy.availabilityWarning}</p>}
              </button>
            ))}
          </div>
        )}
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/50 p-4">
          <form onSubmit={event => { event.preventDefault(); void saveForm(false); }} className="mx-auto my-6 max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5"><div><h2 className="text-xl font-bold text-gray-900">{editing ? copy.edit : copy.newHandover}</h2>{editing && <p className="text-sm text-gray-500">{copy.version} {editing.version}</p>}</div><button type="button" onClick={() => setFormOpen(false)}><X className="h-6 w-6 text-gray-400" /></button></div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-gray-700">{copy.leave}<select required disabled={Boolean(editing)} value={form.leave_request_id} onChange={event => { setForm(current => ({ ...current, leave_request_id: event.target.value, substitute_employee_id: '' })); setSearch(''); }} className={inputClass}><option value="">{copy.choose}</option>{editing && <option value={editing.leave_request_id}>{editing.owner_name} · {editing.leave_type_name} · {formatDate(editing.start_date, locale)} — {formatDate(editing.end_date, locale)}</option>}{eligibleLeaves.filter(leave => leave.id !== editing?.leave_request_id).map(leave => <option key={leave.id} value={leave.id}>{leave.employee_name ? `${leave.employee_name} · ` : ''}{leave.leave_type_name} · {formatDate(leave.start_date, locale)} — {formatDate(leave.end_date, locale)}</option>)}</select>{!editing && eligibleLeaves.length === 0 && <span className="text-xs font-normal text-amber-700">{copy.noEligibleLeave}</span>}</label>
                <label className="space-y-2 text-sm font-semibold text-gray-700">{copy.substitute}<input disabled={!form.leave_request_id} value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.search} className={`${inputClass} mb-2`} /><select required disabled={!form.leave_request_id} value={form.substitute_employee_id} onChange={event => setForm(current => ({ ...current, substitute_employee_id: event.target.value }))} className={inputClass}><option value="">{copy.choose}</option>{candidates.map(person => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}{person.job_title ? ` · ${person.job_title}` : ''} · {person.relationship_scope === 'peer' ? copy.peer : person.relationship_scope === 'direct_report' ? copy.directReport : person.relationship_scope === 'peer_manager' ? copy.peerManager : copy.tenantOverride}</option>)}</select></label>
              </div>
              {mode === 'admin' && editing && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <label className="block space-y-2 text-sm font-semibold text-amber-900">
                    {copy.overrideReason}
                    <textarea value={form.override_reason} onChange={event => setForm(current => ({ ...current, override_reason: event.target.value }))} rows={2} className={inputClass} />
                  </label>
                  <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <input type="checkbox" checked={useTenantOverride} disabled={form.override_reason.trim().length < 10} onChange={event => setUseTenantOverride(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                    {copy.useOverride}
                  </label>
                </div>
              )}
              <label className="block space-y-2 text-sm font-semibold text-gray-700">{copy.notes}<textarea value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} rows={3} className={inputClass} /></label>
              <div className="space-y-4">
                {form.items.map((item, index) => (
                  <section key={index} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3"><select value={item.item_type} onChange={event => updateItem(index, { item_type: event.target.value as 'task' | 'meeting' })} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold"><option value="task">{copy.task}</option><option value="meeting">{copy.meeting}</option></select>{form.items.length > 1 && <button type="button" onClick={() => setForm(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-1 text-sm font-semibold text-red-600"><Trash2 className="h-4 w-4" />{copy.remove}</button>}</div>
                    <div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-sm font-medium text-gray-700">{copy.titleField}<input required value={item.title} onChange={event => updateItem(index, { title: event.target.value })} className={inputClass} /></label><label className="space-y-2 text-sm font-medium text-gray-700">{copy.controlledBy}<select value={item.controlled_by_employee_id || ''} onChange={event => updateItem(index, { controlled_by_employee_id: event.target.value ? Number(event.target.value) : null })} className={inputClass}><option value="">—</option>{candidates.map(person => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}</select></label><label className="space-y-2 text-sm font-medium text-gray-700 md:col-span-2">{copy.description}<textarea value={item.description || ''} onChange={event => updateItem(index, { description: event.target.value })} rows={2} className={inputClass} /></label>{item.item_type === 'task' ? <label className="space-y-2 text-sm font-medium text-gray-700">{copy.dueDate}<input type="date" value={item.due_date || ''} onChange={event => updateItem(index, { due_date: event.target.value || null })} className={inputClass} /></label> : <><label className="space-y-2 text-sm font-medium text-gray-700">{copy.meetingStart}<input type="datetime-local" value={item.meeting_start_at?.slice(0, 16) || ''} onChange={event => updateItem(index, { meeting_start_at: event.target.value || null })} className={inputClass} /></label><label className="space-y-2 text-sm font-medium text-gray-700">{copy.meetingEnd}<input type="datetime-local" value={item.meeting_end_at?.slice(0, 16) || ''} onChange={event => updateItem(index, { meeting_end_at: event.target.value || null })} className={inputClass} /></label><label className="space-y-2 text-sm font-medium text-gray-700 md:col-span-2">{copy.location}<input value={item.location || ''} onChange={event => updateItem(index, { location: event.target.value })} className={inputClass} /></label></>}<label className="space-y-2 text-sm font-medium text-gray-700 md:col-span-2">{copy.observation}<textarea value={item.observation || ''} onChange={event => updateItem(index, { observation: event.target.value })} rows={2} className={inputClass} /></label></div>
                  </section>
                ))}
                <button type="button" onClick={() => setForm(current => ({ ...current, items: [...current.items, blankItem()] }))} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-primary-300 px-4 py-2 text-sm font-semibold text-primary-700"><Plus className="h-4 w-4" />{copy.addTask}</button>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-semibold text-gray-700">{copy.cancel}</button>{!editing && <button type="submit" disabled={saving} className="rounded-xl border border-primary-200 bg-white px-4 py-2.5 font-semibold text-primary-700">{copy.saveDraft}</button>}<button type="button" disabled={saving} onClick={() => void saveForm(!editing)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? copy.save : copy.saveAndSend}</button></div>
          </form>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/50 p-4">
          <div className="mx-auto my-6 max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-wide text-primary-600">{selected.leave_type_name}</p><h2 className="mt-1 text-xl font-bold text-gray-900">{copy.owner}: {selected.owner_name}</h2><p className="mt-1 text-sm text-gray-500">{copy.substitute}: {selected.substitute_name} · {copy.version} {selected.version}</p></div><button onClick={() => setSelected(null)}><X className="h-6 w-6 text-gray-400" /></button></div>
            <div className="space-y-6 p-6">
              <div className="grid gap-3 rounded-2xl bg-gray-50 p-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase text-gray-400">{copy.period}</p><p className="mt-1 font-semibold text-gray-900">{formatDate(selected.start_date, locale)} — {formatDate(selected.end_date, locale)}</p></div><div><p className="text-xs font-semibold uppercase text-gray-400">{copy.statusLabel}</p><p className="mt-1 font-semibold text-gray-900">{statusByLocale[locale][selected.status] || selected.status}</p></div></div>
              {selected.availability_warning && <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="h-5 w-5 shrink-0" />{selected.availability_warning}</p>}
              {selected.clarification_message && <div className="rounded-xl border border-purple-200 bg-purple-50 p-4"><p className="text-sm font-bold text-purple-900">{copy.clarification}</p><p className="mt-1 text-sm text-purple-800">{selected.clarification_message}</p></div>}
              {selected.manager_comment && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="text-sm font-bold text-blue-900">{copy.managerComment}</p><p className="mt-1 whitespace-pre-wrap text-sm text-blue-800">{selected.manager_comment}</p></div>}
              {selected.notes && <p className="whitespace-pre-wrap text-sm text-gray-700">{selected.notes}</p>}
              <div className="space-y-3">{selected.items.map(item => <div key={item.id} className="rounded-xl border border-gray-200 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-gray-900">{item.title}</h3><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold">{item.item_type === 'meeting' ? copy.meeting : copy.task}</span></div>{item.description && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{item.description}</p>}{item.due_date && <p className="mt-2 text-xs text-gray-500">{copy.dueDate}: {formatDate(item.due_date, locale)}</p>}{item.meeting_start_at && <p className="mt-2 text-xs text-gray-500">{copy.meetingStart}: {formatDateTime(item.meeting_start_at, locale)}</p>}{item.meeting_end_at && <p className="mt-1 text-xs text-gray-500">{copy.meetingEnd}: {formatDateTime(item.meeting_end_at, locale)}</p>}{item.location && <p className="mt-1 text-xs text-gray-500">{copy.location}: {item.location}</p>}{item.controlled_by_name && <p className="mt-1 text-xs text-gray-500">{copy.controlledBy}: {item.controlled_by_name}</p>}{item.observation && <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-600">{item.observation}</p>}</div>)}</div>
              <section><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-gray-900">{copy.attachments}</h3>{selected.can_edit && <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary-700"><FileUp className="h-4 w-4" />{copy.addAttachment}<input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp" onChange={event => void upload(event.target.files?.[0])} /></label>}</div><div className="space-y-2">{selected.attachments.map(file => <button key={file.id} onClick={() => void downloadLeaveHandoverAttachment(selected.id, file.id)} className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50"><span className="truncate">{file.file_name}</span><ArrowDownToLine className="h-4 w-4 text-primary-600" /></button>)}</div></section>
              {selected.can_acknowledge && <div className="space-y-3 rounded-2xl border border-primary-100 bg-primary-50 p-4"><textarea value={clarification} onChange={event => setClarification(event.target.value)} placeholder={copy.clarificationPlaceholder} rows={2} className={inputClass} /><div className="flex flex-wrap gap-2"><button disabled={saving} onClick={() => void runAction(() => acknowledgeLeaveHandover(selected.id), copy.acknowledged)} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" />{copy.acknowledge}</button><button disabled={saving || clarification.trim().length < 2} onClick={() => void runAction(() => requestLeaveHandoverClarification(selected.id, clarification), copy.clarificationSent)} className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-700 disabled:opacity-50"><MessageCircleQuestion className="h-4 w-4" />{copy.clarify}</button></div></div>}
              {selected.can_validate && <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="text-sm font-bold text-blue-900">{copy.managerReview}</p><textarea value={managerComment} onChange={event => setManagerComment(event.target.value)} placeholder={copy.decisionComment} rows={2} className={inputClass} /><div className="flex flex-wrap gap-2"><button disabled={saving} onClick={() => void runAction(() => decideLeaveHandoverAsManager(selected.id, true, managerComment), copy.approved)} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{copy.approve}</button><button disabled={saving || managerComment.trim().length < 2} onClick={() => void runAction(() => decideLeaveHandoverAsManager(selected.id, false, managerComment), copy.changesRequested)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"><MessageCircleQuestion className="h-4 w-4" />{copy.requestChanges}</button></div></div>}
              <details><summary className="cursor-pointer font-bold text-gray-900">{copy.history} ({selected.audit_events.length})</summary><div className="mt-3 space-y-2">{selected.audit_events.slice().reverse().map((event, index) => <div key={`${event.created_at}-${index}`} className="flex justify-between gap-3 border-l-2 border-gray-200 pl-3 text-xs text-gray-500"><span>{event.event_type} · v{event.version}</span><span>{new Date(event.created_at).toLocaleString()}</span></div>)}</div></details>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">{selected.can_edit && <button onClick={() => openEdit(selected)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700"><Pencil className="h-4 w-4" />{copy.edit}</button>}{selected.can_edit && ['draft', 'changes_requested'].includes(selected.status) && <button disabled={saving} onClick={() => void runAction(() => sendLeaveHandover(selected.id), copy.sent)} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 font-semibold text-white"><Send className="h-4 w-4" />{copy.send}</button>}{selected.can_edit && !['closed', 'cancelled'].includes(selected.status) && <button disabled={saving} onClick={() => window.confirm(copy.confirmCancel) && void runAction(() => cancelLeaveHandover(selected.id), copy.cancelled)} className="rounded-xl px-4 py-2 font-semibold text-red-600">{copy.cancel}</button>}<button onClick={() => setSelected(null)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700">{copy.close}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
