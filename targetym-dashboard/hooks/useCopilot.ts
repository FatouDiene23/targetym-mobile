'use client';

import { useCallback, useRef, useState } from 'react';
import {
  getChatConversations,
  getChatConversation,
  createChatConversation,
  deleteChatConversation,
  renameChatConversation,
  streamCopilotMessage,
  approveCopilotPending,
  rejectCopilotPending,
  CopilotForbiddenError,
  CopilotHttpError,
  CopilotStreamError,
  type ChatConversation,
  type CopilotPendingAction,
  type CopilotUiIntent,
  type CopilotStreamEvent,
  type CopilotResolutionStatus,
  type CopilotArtifact,
  type CopilotTurnOutcome,
  type CopilotFinalResponseV2,
  type CopilotResponseBlock,
  type CopilotPendingApprovalResult,
} from '@/lib/api';

export interface CopilotActionFeedback {
  kind: 'success' | 'error';
  message: string;
}

export type CopilotResolvedActionState = 'approved' | 'rejected' | 'failed';

export interface CopilotChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pendingActions: CopilotPendingAction[];
  uiIntents: CopilotUiIntent[];
  /** pending_id des actions résolues (validées/rejetées) pour ne plus proposer les boutons. */
  resolved: Record<string, CopilotResolvedActionState>;
  /** Résultat utilisateur confirmé par le serveur pour chaque action. */
  actionFeedback: Record<string, CopilotActionFeedback>;
  streaming?: boolean;
  /** Libellé métier de l'étape en cours (progression intermédiaire, événement `step`). */
  currentStep?: string | null;
  /** Commentaire naturel réellement produit par le moteur avant une phase. */
  narrativeStep?: string | null;
  /** Plan VIVANT : étapes du tour (orchestration visible), cochées au fur et à mesure. */
  steps?: Array<{ label: string; done: boolean }>;
  /** État canonique renvoyé par le serveur ; jamais déduit du texte côté client. */
  resolutionStatus?: CopilotResolutionStatus;
  stopReason?: string;
  providerStopReason?: string;
  artifacts?: CopilotArtifact[];
  taskPlan?: Array<Record<string, unknown>>;
  runId?: string;
  agentState?: Record<string, unknown>;
  turnOutcome?: CopilotTurnOutcome;
  /** Sortie structurée produite par le modèle et validée par le serveur. */
  finalResponseV2?: CopilotFinalResponseV2;
  /** Blocs visuels fermés ; source de présentation avant le repli `artifacts`. */
  responseBlocks?: CopilotResponseBlock[];
  /** Pièce jointe matérialisée dans la bulle (nom + texte extrait, pour l'aperçu). */
  attachment?: { name: string; text?: string } | null;
  timestamp: number;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type CopilotDoneEvent = Extract<CopilotStreamEvent, { type: 'done' }>;

/**
 * Révèle les fragments SSE à un rythme stable. Les proxies et `fetch()` peuvent
 * regrouper plusieurs trames réseau dans une seule lecture ; sans cette file,
 * React les applique dans le même rendu et la réponse apparaît d'un bloc même
 * lorsque le serveur a correctement fragmenté le texte.
 */
function createProgressiveTextBuffer(onChunk: (chunk: string) => void) {
  const CHARS_PER_FRAME = 48;
  const FRAME_DELAY_MS = 16;
  let queued = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let drainResolvers: Array<() => void> = [];

  const resolveDrains = () => {
    const resolvers = drainResolvers;
    drainResolvers = [];
    resolvers.forEach((resolve) => resolve());
  };

  const pump = () => {
    timer = null;
    if (!queued) {
      resolveDrains();
      return;
    }
    const chunk = queued.slice(0, CHARS_PER_FRAME);
    queued = queued.slice(chunk.length);
    onChunk(chunk);
    if (queued) timer = setTimeout(pump, FRAME_DELAY_MS);
    else resolveDrains();
  };

  return {
    push(text: string) {
      if (!text) return;
      queued += text;
      if (timer == null) timer = setTimeout(pump, 0);
    },
    retract(characters: number): number {
      let remaining = Math.max(0, Math.trunc(characters));
      if (!remaining) return 0;
      const queuedCharacters = Math.min(remaining, queued.length);
      if (queuedCharacters) {
        queued = queued.slice(0, queued.length - queuedCharacters);
        remaining -= queuedCharacters;
      }
      if (!queued && timer != null) {
        clearTimeout(timer);
        timer = null;
        resolveDrains();
      }
      // Le reliquat a déjà été rendu par React et doit être retiré de la bulle.
      return remaining;
    },
    drain(): Promise<void> {
      if (!queued && timer == null) return Promise.resolve();
      return new Promise((resolve) => drainResolvers.push(resolve));
    },
    cancel() {
      if (timer != null) clearTimeout(timer);
      timer = null;
      queued = '';
      resolveDrains();
    },
  };
}

/**
 * Hook central du copilote : sessions, messages, streaming SSE, approbations.
 * Partagé par le tiroir et l'onglet plein écran (mêmes endpoints, mêmes sessions).
 */
export function useCopilot() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getChatConversations();
      setConversations(data);
    } catch (e) {
      if (e instanceof CopilotForbiddenError) setForbidden(true);
    }
  }, []);

  const selectConversation = useCallback(async (id: number) => {
    setActiveId(id);
    setError(null);
    try {
      const conv = await getChatConversation(id);
      // Tri défensif par id backend (monotone) : garantit l'ordre chronologique
      // même si l'API renvoyait les messages dans le désordre (défense en
      // profondeur — le backend trie déjà via la relation `order_by`).
      const ordered = [...conv.messages].sort((a, b) => Number(a.id) - Number(b.id));
      setMessages(
        ordered.map((m) => {
          const pendingActions = m.pending_actions ?? [];
          const resolved = pendingActions.reduce<Record<string, CopilotResolvedActionState>>(
            (states, action) => {
              if (action.status === 'executed' || action.status === 'approved') {
                states[action.pending_id] = 'approved';
              } else if (action.status === 'rejected') {
                states[action.pending_id] = 'rejected';
              } else if (action.status === 'failed' || action.status === 'expired') {
                states[action.pending_id] = 'failed';
              }
              return states;
            },
            {},
          );
          const actionFeedback = pendingActions.reduce<Record<string, CopilotActionFeedback>>(
            (items, action) => {
              if (action.status === 'executed' || action.status === 'approved') {
                items[action.pending_id] = {
                  kind: 'success',
                  message: action.user_message || "L'action a bien été réalisée.",
                };
              } else if (action.status === 'rejected') {
                items[action.pending_id] = {
                  kind: 'success',
                  message: 'Proposition annulée.',
                };
              } else if (action.status === 'failed' || action.status === 'expired') {
                items[action.pending_id] = {
                  kind: 'error',
                  message: action.user_message || "Cette action n'a pas pu être enregistrée.",
                };
              }
              return items;
            },
            {},
          );
          return {
          id: String(m.id),
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          pendingActions,
          resolved,
          actionFeedback,
          attachment: m.attachment ?? null,
          resolutionStatus: m.resolution_status ?? undefined,
          stopReason: m.stop_reason ?? undefined,
          providerStopReason: m.provider_stop_reason ?? undefined,
          uiIntents: m.ui_intents ?? [],
          artifacts: m.artifacts ?? [],
          finalResponseV2: m.final_response_v2 ?? undefined,
          responseBlocks: m.response_blocks
            ?? m.final_response_v2?.blocks
            ?? [],
          taskPlan: m.task_plan ?? [],
          runId: m.run_id ?? undefined,
          agentState: m.agent_state ?? {},
          turnOutcome: m.turn_outcome,
          timestamp: new Date(m.created_at).getTime(),
          };
        }),
      );
    } catch (e) {
      if (e instanceof CopilotForbiddenError) setForbidden(true);
    }
  }, []);

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setError(null);
  }, []);

  const removeConversation = useCallback(
    async (id: number) => {
      await deleteChatConversation(id);
      if (activeId === id) newConversation();
      await loadConversations();
    },
    [activeId, newConversation, loadConversations],
  );

  const renameConversation = useCallback(async (id: number, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const updated = await renameChatConversation(id, trimmed);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c)),
    );
  }, []);

  const patchMessage = useCallback(
    (id: string, patch: Partial<CopilotChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      text: string,
      pagePath?: string,
      attachment?: { name: string; text: string },
      responseStyle?: 'detaille' | 'bref',
      internal?: { hideUserMessage?: boolean; resumePendingId?: string },
    ) => {
      const trimmed = text.trim();
      const isResume = Boolean(internal?.resumePendingId);
      if ((!trimmed && !isResume) || streaming) return;
      const fileText = attachment?.text;
      const fileName = attachment?.name;
      setError(null);
      setStreaming(true);

      // Créer la session si nécessaire pour qu'elle apparaisse dans l'historique.
      let conversationId = activeId;
      if (conversationId == null) {
        try {
          const conv = await createChatConversation(
            (trimmed || 'Reprise du plan').slice(0, 60),
          );
          conversationId = conv.id;
          setActiveId(conv.id);
        } catch (e) {
          if (e instanceof CopilotForbiddenError) {
            setForbidden(true);
            setStreaming(false);
            return;
          }
          // On continue sans id : le backend peut auto-créer la session.
        }
      }

      const userMsg: CopilotChatMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
        pendingActions: [],
        uiIntents: [],
        resolved: {},
        actionFeedback: {},
        attachment: attachment ?? null,
        timestamp: Date.now(),
      };
      const assistantId = newId();
      const assistantMsg: CopilotChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        pendingActions: [],
        uiIntents: [],
        resolved: {},
        actionFeedback: {},
        streaming: true,
        timestamp: Date.now(),
      };
      setMessages((prev) => [
        ...prev,
        ...(internal?.hideUserMessage ? [] : [userMsg]),
        assistantMsg,
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      let receivedText = '';
      let doneEvent: CopilotDoneEvent | null = null;
      const progressiveText = createProgressiveTextBuffer((chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          ),
        );
      });

      const onEvent = (event: CopilotStreamEvent) => {
        if (event.type === 'token') {
          const chunk = event.text ?? event.content ?? '';
          receivedText += chunk;
          progressiveText.push(chunk);
        } else if (event.type === 'retract') {
          const characters = Math.min(
            Math.max(0, Math.trunc(event.characters ?? 0)),
            receivedText.length,
          );
          if (characters) {
            receivedText = receivedText.slice(0, -characters);
            const renderedCharacters = progressiveText.retract(characters);
            if (renderedCharacters) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: m.content.slice(
                          0,
                          Math.max(0, m.content.length - renderedCharacters),
                        ),
                      }
                    : m,
                ),
              );
            }
          }
        } else if (event.type === 'activity') {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m;
              return {
                ...m,
                narrativeStep: event.status === 'completed'
                  ? null
                  : event.label || m.narrativeStep,
              };
            }),
          );
        } else if (event.type === 'step') {
          // Progression intermédiaire (libellé métier déjà traduit côté backend).
          // À `tool_start` on affiche le libellé ; à `tool_done` on garde le
          // dernier libellé connu (lisible : évite un flash vide entre deux
          // étapes) jusqu'à ce que le texte de la réponse commence à arriver.
          if (event.label) {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const steps = [...(m.steps || [])];
                if (event.kind === 'tool_done') {
                  // Coche la dernière étape non terminée portant ce libellé.
                  for (let i = steps.length - 1; i >= 0; i -= 1) {
                    if (steps[i].label === event.label && !steps[i].done) {
                      steps[i] = { ...steps[i], done: true };
                      break;
                    }
                  }
                } else if (event.kind === 'tool_retry' || event.kind === 'phase_start') {
                  // `tool_retry` : nouvelle tentative de l'étape DÉJÀ affichée —
                  // ne pas l'empiler une seconde fois (elle serait cochée par le
                  // même `tool_done` et l'autre resterait ouverte à jamais).
                  // `phase_start` : indicateur transitoire (« Analyse de la
                  // demande ») porté par `currentStep`, pas une étape du plan —
                  // aucun `tool_done` ne viendra jamais le cocher.
                } else {
                  // tool_start : nouvelle étape en cours (évite un doublon consécutif).
                  const last = steps[steps.length - 1];
                  if (!last || last.label !== event.label || last.done) {
                    steps.push({ label: event.label as string, done: false });
                  }
                }
                return {
                  ...m,
                  currentStep: event.kind === 'phase_start'
                    ? event.label
                    : m.currentStep || event.label,
                  steps,
                };
              }),
            );
          }
        } else if (event.type === 'pending') {
          // Le backend envoie une action par événement (`tool_result`) ou un
          // tableau (`pending_actions`). On ACCUMULE (plusieurs actions possibles).
          const incoming = event.pending_actions
            ?? (event.tool_result ? [event.tool_result] : []);
          if (incoming.length) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, pendingActions: [...m.pendingActions, ...incoming] }
                  : m,
              ),
            );
          }
        } else if (event.type === 'tool_call') {
          // Événement informatif/après-coup : le backend l'émet une fois l'outil
          // exécuté, APRÈS avoir déjà notifié la progression via `step`
          // (kind `tool_start` puis `tool_done`, qui pilotent déjà `currentStep`
          // ci-dessus). `tool_call` ne porte aucune donnée que l'UI n'affiche pas
          // déjà (le résultat exploitable arrive via l'événement `pending`) : on
          // le reçoit donc explicitement pour ne plus l'ignorer silencieusement,
          // mais on ne déclenche volontairement aucune mise à jour d'état.
        } else if (event.type === 'done') {
          if (conversationId == null && event.conversation_id != null) {
            conversationId = event.conversation_id;
            setActiveId(event.conversation_id);
          }
          doneEvent = event;
          const finalText = event.reply ?? event.text ?? '';
          // Compatibilité avec un serveur plus ancien qui n'émettrait aucun
          // `token`, ou seulement un préfixe avant le `done` terminal.
          if (!receivedText && finalText) {
            receivedText = finalText;
            progressiveText.push(finalText);
          } else if (finalText.startsWith(receivedText)) {
            const suffix = finalText.slice(receivedText.length);
            if (suffix) {
              receivedText += suffix;
              progressiveText.push(suffix);
            }
          }
        } else if (event.type === 'error') {
          // `streamCopilotMessage` transforme cet événement en
          // `CopilotStreamError` après l'avoir transmis ici. La mise à jour
          // terminale est faite dans le `catch` unique, avec le motif et le
          // caractère relançable préservés.
        }
      };

      try {
        await streamCopilotMessage(
          {
            message: trimmed,
            conversation_id: conversationId ?? undefined,
            resume_pending_id: internal?.resumePendingId,
            page_path: pagePath,
            file_text: fileText,
            file_name: fileName,
            response_style: responseStyle,
          },
          onEvent,
          controller.signal,
        );
        await progressiveText.drain();
        const terminal = doneEvent as CopilotDoneEvent | null;
        if (terminal) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    // `reply` est la source canonique. Si un ancien backend
                    // envoie des fragments discordants, le terminal corrige le
                    // texte au lieu de présenter un assemblage non vérifié.
                    content: terminal.reply ?? terminal.text ?? receivedText,
                    pendingActions: terminal.pending_actions ?? m.pendingActions,
                    uiIntents: terminal.ui_intents ?? m.uiIntents,
                    resolutionStatus: terminal.resolution_status,
                    stopReason: terminal.stop_reason,
                    providerStopReason: terminal.provider_stop_reason,
                    artifacts: terminal.artifacts ?? m.artifacts,
                    taskPlan: terminal.task_plan ?? m.taskPlan,
                    runId: terminal.run_id ?? m.runId,
                    agentState: terminal.agent_state ?? m.agentState,
                    turnOutcome: terminal.turn_outcome ?? m.turnOutcome,
                    finalResponseV2: terminal.final_response_v2 ?? m.finalResponseV2,
                    responseBlocks: terminal.response_blocks
                      ?? terminal.final_response_v2?.blocks
                      ?? m.responseBlocks,
                    // Le tour est terminé : aucune étape ne peut rester « en
                    // cours » (un tool_done perdu laisserait un spinner éternel).
                    steps: (m.steps || []).map((s) =>
                      s.done ? s : { ...s, done: true },
                    ),
                    streaming: false,
                    currentStep: null,
                    narrativeStep: null,
                  }
                : m,
            ),
          );
        } else {
          patchMessage(assistantId, { streaming: false });
        }
      } catch (e) {
        progressiveText.cancel();
        if (e instanceof CopilotForbiddenError) {
          setForbidden(true);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        } else if ((e as Error)?.name === 'AbortError') {
          patchMessage(assistantId, { streaming: false });
        } else {
          // Aucun replay automatique : le serveur peut avoir déjà persisté le
          // tour ou préparé des actions avant une rupture SSE.
          const cause = e as Error;
          const validationRejected = e instanceof CopilotHttpError
            && [400, 413, 422].includes(e.statusCode);
          const serverStreamError = e instanceof CopilotStreamError;
          const serverHttpError = e instanceof CopilotHttpError;
          const detail = cause.message || 'Le tour copilote a échoué.';
          const message = validationRejected
            ? `Je n'ai pas pu traiter cette demande : ${detail}`
            : detail;
          const retryable = serverStreamError
            ? e.retryable
            : serverHttpError && typeof e.retryable === 'boolean'
              ? e.retryable
              : !validationRejected;
          const requiredAction = validationRejected
            ? 'correct_input'
            : serverHttpError && e.requiredAction
              ? e.requiredAction
              : retryable ? 'retry' : 'contact_support';
          const errorCode = serverStreamError
            ? e.code || 'stream_server_error'
            : serverHttpError
              ? e.code || `http_${e.statusCode}`
              : 'stream_transport_error';
          const category = validationRejected
            ? 'invalid_input'
            : serverHttpError && e.category
              ? e.category
              : retryable ? 'temporary' : 'technical';
          const nextStep = requiredAction === 'correct_input'
            ? 'Corrigez les informations indiquées puis renvoyez la demande.'
            : requiredAction === 'contact_administrator'
              ? "Contactez l'administrateur pour rétablir la configuration du module."
              : requiredAction === 'request_access'
                ? "Demandez l'accès nécessaire à votre administrateur."
                : retryable
                  ? 'Réessayez dans quelques instants.'
                  : 'Contactez le support en communiquant la référence affichée.';
          setError(message);
          patchMessage(assistantId, {
            // Le bandeau d'issue historique n'existe plus. Le motif sûr doit
            // donc rester visible dans la conversation, sans jargon interne.
            content: message,
            streaming: false,
            currentStep: null,
            narrativeStep: null,
            resolutionStatus: validationRejected ? 'needs_info' : 'failed',
            stopReason: 'error',
            turnOutcome: {
              status: validationRejected ? 'needs_info' : 'failed',
              canonical_status: validationRejected ? 'needs_input' : 'failed',
              reason: validationRejected ? 'request_validation_failed' : errorCode,
              complete: false,
              retryable,
              blockers: [{
                type: validationRejected ? 'request_validation' : 'transport_error',
                error_code: errorCode,
                category,
                user_message: message,
                retryable,
                required_action: requiredAction,
                action_executed: false,
              }],
              required_actions: [requiredAction],
              next_step: nextStep,
            },
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        loadConversations();
      }
    },
    [activeId, streaming, patchMessage, loadConversations],
  );

  const approveAction = useCallback(
    async (messageId: string, pendingId: string) => {
      try {
        const result: CopilotPendingApprovalResult = await approveCopilotPending(pendingId);
        const message = result.user_message
          || (result.message === 'already_resolved'
            ? "Cette proposition avait déjà été appliquée."
            : "L'action a bien été réalisée.");
        // Une réussite n'est visible qu'APRÈS confirmation du serveur. Le bouton
        // porte déjà son état de chargement et empêche le double-clic : aucune
        // raison d'afficher optimistement « validé » avant l'exécution réelle.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  resolved: { ...m.resolved, [pendingId]: 'approved' },
                  actionFeedback: {
                    ...m.actionFeedback,
                    [pendingId]: { kind: 'success', message },
                  },
                }
              : m,
          ),
        );
        if (
          result.approval_kind === 'mission_plan'
          && result.resume_pending_id
        ) {
          void sendMessage(
            '',
            undefined,
            undefined,
            undefined,
            {
              hideUserMessage: true,
              resumePendingId: result.resume_pending_id,
            },
          );
        }
        return result;
      } catch (e) {
        if (e instanceof Error) {
          const message = e.message || "Cette action n'a pas pu être enregistrée.";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    resolved: { ...m.resolved, [pendingId]: 'failed' },
                    actionFeedback: {
                      ...m.actionFeedback,
                      [pendingId]: { kind: 'error', message },
                    },
                  }
                : m,
            ),
          );
        }
        // L'appelant (carte individuelle ou « Tout confirmer ») affiche la
        // raison. Seul un refus d'exécution confirmé devient terminal ; une
        // rupture réseau ou un conflit temporaire reste rejouable.
        throw e;
      }
    },
    [sendMessage],
  );

  const rejectAction = useCallback(
    async (messageId: string, pendingId: string) => {
      try {
        await rejectCopilotPending(pendingId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  resolved: { ...m.resolved, [pendingId]: 'rejected' },
                  actionFeedback: {
                    ...m.actionFeedback,
                    [pendingId]: { kind: 'success', message: 'Proposition annulée.' },
                  },
                }
              : m,
          ),
        );
      } catch (e) {
        setError((e as Error).message || "Échec du rejet.");
        throw e;
      }
    },
    [],
  );

  return {
    conversations,
    activeId,
    messages,
    draft,
    setDraft,
    streaming,
    forbidden,
    error,
    loadConversations,
    selectConversation,
    newConversation,
    removeConversation,
    renameConversation,
    sendMessage,
    approveAction,
    rejectAction,
  };
}
