// Session vocale du Copilote — client LiveKit, chargé à la demande.
//
// Trois principes tenus ici.
//
// 1. AUCUNE INTERFACE NOUVELLE. Le mode vocal réutilise les composants du
//    Copilote existant : les blocs, les artefacts et surtout les cartes de
//    validation arrivent par le canal de données et sont rendus par le même
//    code qu'en texte. On ne duplique pas l'écran, on le nourrit autrement.
//
// 2. LA VOIX PROPOSE, L'ÉCRAN VALIDE. Rien dans ce fichier n'approuve une
//    action. Les `pending_actions` reçues sont remontées telles quelles pour
//    que l'utilisateur clique — un « oui » prononcé ne vaut jamais accord.
//
// 3. IMPORT DIFFÉRÉ. `livekit-client` pèse lourd et ne sert qu'au micro. Il
//    est importé dynamiquement au premier clic, pour ne pas alourdir le
//    paquet initial du dashboard de tous les utilisateurs qui n'en font
//    jamais usage.

import { API_URL, fetchWithAuth } from '@/lib/api';

/** Sujet du canal de données publié par le worker vocal. */
const TOPIC = 'targetym.copilot';

export type VoicePhase = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface VoiceTurnResult {
  runId: string;
  conversationId: number | null;
  messageId: number | null;
  resolutionStatus: string;
  reply: string;
  responseBlocks: unknown[];
  pendingActions: unknown[];
  artifacts: unknown[];
  uiIntents: unknown[];
  taskPlan: unknown[];
  turnOutcome: Record<string, unknown>;
  /** Vrai si une écriture attend un clic. Ne jamais l'ignorer. */
  requiresScreenValidation: boolean;
  truncated?: boolean;
}

export interface VoiceTranscript {
  role: 'user' | 'assistant';
  text: string;
  final: boolean;
}

export interface VoiceHandlers {
  onPhase?: (phase: VoicePhase) => void;
  onTranscript?: (line: VoiceTranscript) => void;
  onTurnResult?: (result: VoiceTurnResult) => void;
  onError?: (code: string, message: string) => void;
}

interface VoiceCredentials {
  server_url: string;
  token: string;
  room: string;
  identity: string;
  ticket: string;
}

export interface VoiceSession {
  disconnect: () => Promise<void>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  readonly room: string;
}

/** Demande au backend un jeton de salle et un ticket d'identité. */
async function requestCredentials(): Promise<VoiceCredentials> {
  const response = await fetchWithAuth(`${API_URL}/api/auth/voice-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.detail ?? `Session vocale refusée (${response.status})`);
  }
  return response.json();
}

/**
 * Ouvre une session vocale et branche les rappels sur la room.
 *
 * L'appelant reste maître de l'affichage : ce module ne rend rien.
 */
export async function startVoiceSession(handlers: VoiceHandlers): Promise<VoiceSession> {
  handlers.onPhase?.('connecting');

  const credentials = await requestCredentials();

  // Import différé — voir l'en-tête du fichier.
  const { Room, RoomEvent, Track } = await import('livekit-client');

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    // Le débruitage du NAVIGATEUR prend une voix faible pour du bruit et la
    // supprime avant l'envoi : c'est LA cause habituelle du « il faut parler
    // fort ». On le coupe, le serveur fait ce travail bien plus finement.
    audioCaptureDefaults: {
      echoCancellation: true,
      autoGainControl: true,
      noiseSuppression: false,
    },
  });

  const decoder = new TextDecoder();

  room.on(RoomEvent.DataReceived, (payload: Uint8Array, _p, _k, topic?: string) => {
    if (topic && topic !== TOPIC) return;
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(decoder.decode(payload));
    } catch {
      return;
    }

    switch (frame.kind) {
      case 'state':
        handlers.onPhase?.(String(frame.state ?? 'idle') as VoicePhase);
        break;
      case 'transcript':
        handlers.onTranscript?.({
          role: frame.role === 'user' ? 'user' : 'assistant',
          text: String(frame.text ?? ''),
          final: Boolean(frame.final),
        });
        break;
      case 'turn.result':
        handlers.onTurnResult?.({
          runId: String(frame.run_id ?? ''),
          conversationId: (frame.conversation_id as number) ?? null,
          messageId: (frame.message_id as number) ?? null,
          resolutionStatus: String(frame.resolution_status ?? 'unknown'),
          reply: String(frame.reply ?? ''),
          responseBlocks: (frame.response_blocks as unknown[]) ?? [],
          pendingActions: (frame.pending_actions as unknown[]) ?? [],
          artifacts: (frame.artifacts as unknown[]) ?? [],
          uiIntents: (frame.ui_intents as unknown[]) ?? [],
          taskPlan: (frame.task_plan as unknown[]) ?? [],
          turnOutcome: (frame.turn_outcome as Record<string, unknown>) ?? {},
          requiresScreenValidation: Boolean(frame.requires_screen_validation),
          truncated: Boolean(frame.truncated),
        });
        break;
      case 'error':
        handlers.onError?.(String(frame.code ?? 'voice_error'), String(frame.message ?? ''));
        handlers.onPhase?.('error');
        break;
      default:
        break;
    }
  });

  // L'attribut porté par l'agent renseigne l'état sans passer par le canal.
  room.on(RoomEvent.ParticipantAttributesChanged, (changed: Record<string, string>) => {
    const state = changed['lk.agent.state'];
    if (state) handlers.onPhase?.(state as VoicePhase);
  });

  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) track.attach();
  });

  room.on(RoomEvent.Disconnected, () => handlers.onPhase?.('idle'));

  await room.connect(credentials.server_url, credentials.token, {
    // Le ticket d'identité voyage dans les métadonnées : le worker n'a ni
    // cookie ni session, c'est sa seule façon de savoir au nom de qui agir.
    // Il est court, à usage unique, et échangé côté serveur.
    // @ts-expect-error — champ accepté par le SDK, absent de ses types publics
    metadata: JSON.stringify({ targetym_voice_ticket: credentials.ticket }),
  });

  await room.localParticipant.setMicrophoneEnabled(true);
  handlers.onPhase?.('listening');

  return {
    room: credentials.room,
    disconnect: async () => {
      await room.disconnect();
      handlers.onPhase?.('idle');
    },
    setMicrophoneEnabled: async (enabled: boolean) => {
      await room.localParticipant.setMicrophoneEnabled(enabled);
    },
  };
}
