'use client';

// Mode vocal du Copilote, branché sur l'interface EXISTANTE.
//
// Ce hook n'apporte aucun écran : il expose un état et deux actions. Les
// résultats de tour qu'il reçoit ont exactement la forme de ceux du mode
// texte, pour être rendus par les mêmes composants — blocs, artefacts et
// cartes de validation comprises.
//
// L'accès suit la même règle que le Copilote écrit : si `canUseCopilot` est
// faux, le bouton n'existe pas. On ne réimplémente pas la politique d'accès.

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import type {
  VoicePhase,
  VoiceSession,
  VoiceTranscript,
  VoiceTurnResult,
} from '@/lib/copilotVoice';

export interface UseCopilotVoiceOptions {
  /** Reçoit chaque tour terminé, au même format que le mode texte. */
  onTurnResult?: (result: VoiceTurnResult) => void;
  /** Reçoit les transcriptions, à afficher dans le fil. */
  onTranscript?: (line: VoiceTranscript) => void;
}

export interface UseCopilotVoice {
  phase: VoicePhase;
  active: boolean;
  busy: boolean;
  muted: boolean;
  toggle: () => Promise<void>;
  toggleMute: () => Promise<void>;
}

export function useCopilotVoice(options: UseCopilotVoiceOptions = {}): UseCopilotVoice {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const sessionRef = useRef<VoiceSession | null>(null);

  // Les rappels changent à chaque rendu du parent ; on les lit par référence
  // pour ne pas reconstruire la session à chaque frappe au clavier.
  const handlersRef = useRef(options);
  handlersRef.current = options;

  // Une session vocale laissée ouverte continue de consommer un micro et un
  // CPU côté serveur. On la ferme systématiquement au démontage.
  useEffect(() => {
    return () => {
      void sessionRef.current?.disconnect();
      sessionRef.current = null;
    };
  }, []);

  const stop = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setMuted(false);
    if (session) await session.disconnect();
    setPhase('idle');
  }, []);

  const start = useCallback(async () => {
    const { startVoiceSession } = await import('@/lib/copilotVoice');
    sessionRef.current = await startVoiceSession({
      onPhase: setPhase,
      onTranscript: (line) => handlersRef.current.onTranscript?.(line),
      onTurnResult: (result) => {
        handlersRef.current.onTurnResult?.(result);
        // La voix ne confirme jamais une écriture : on le dit à l'écran.
        if (result.requiresScreenValidation) {
          toast('Une action attend votre validation ci-dessous.', { icon: '🖐' });
        }
      },
      onError: (_code, message) => {
        toast.error(message || 'Le mode vocal a été interrompu.');
      },
    });
  }, []);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (sessionRef.current) {
        await stop();
      } else {
        await start();
      }
    } catch (error) {
      setPhase('error');
      sessionRef.current = null;
      const message =
        error instanceof Error ? error.message : 'Mode vocal indisponible.';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [busy, start, stop]);

  const toggleMute = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    const suivant = !muted;
    setMuted(suivant);
    await session.setMicrophoneEnabled(!suivant);
  }, [muted]);

  return {
    phase,
    active: phase !== 'idle' && phase !== 'error',
    busy,
    muted,
    toggle,
    toggleMute,
  };
}
