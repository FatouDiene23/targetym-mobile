'use client';

// Bouton micro de la barre de saisie du Copilote.
//
// Il se place à côté du bouton d'envoi, dans le composeur EXISTANT : le mode
// vocal n'ouvre aucune fenêtre, ne change pas de page et n'introduit pas une
// seconde interface. C'est la même conversation, entendue au lieu d'être lue.
//
// L'état est rendu par la couleur et par un anneau animé, jamais par du texte
// supplémentaire : l'espace du composeur est déjà dense.

import { Loader2, Mic, MicOff, Square } from 'lucide-react';

import type { VoicePhase } from '@/lib/copilotVoice';

interface CopilotMicButtonProps {
  phase: VoicePhase;
  active: boolean;
  busy: boolean;
  muted: boolean;
  fullscreen: boolean;
  onToggle: () => void;
  onToggleMute: () => void;
  labels: {
    start: string;
    stop: string;
    mute: string;
    unmute: string;
    listening: string;
    thinking: string;
    speaking: string;
    connecting: string;
  };
}

/** Couleur d'état : verte à l'écoute, ambre en réflexion, teal en parole. */
function tonalite(phase: VoicePhase): string {
  switch (phase) {
    case 'listening':
      return 'bg-emerald-500 hover:bg-emerald-600';
    case 'thinking':
      return 'bg-amber-500 hover:bg-amber-600';
    case 'speaking':
      return 'bg-primary-600 hover:bg-primary-700';
    case 'error':
      return 'bg-rose-500 hover:bg-rose-600';
    default:
      return 'bg-gray-200 text-gray-700 hover:bg-gray-300';
  }
}

export default function CopilotMicButton({
  phase,
  active,
  busy,
  muted,
  fullscreen,
  onToggle,
  onToggleMute,
  labels,
}: CopilotMicButtonProps) {
  const taille = fullscreen ? 'h-12 w-12' : 'h-10 w-10';
  const titre = busy
    ? labels.connecting
    : !active
      ? labels.start
      : phase === 'thinking'
        ? labels.thinking
        : phase === 'speaking'
          ? labels.speaking
          : labels.listening;

  return (
    <div className="flex flex-shrink-0 items-center gap-1.5">
      {active && (
        <button
          type="button"
          onClick={onToggleMute}
          className={`flex ${taille} items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40`}
          aria-label={muted ? labels.unmute : labels.mute}
          aria-pressed={muted}
          title={muted ? labels.unmute : labels.mute}
        >
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
      )}

      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={`relative flex ${taille} items-center justify-center rounded-full text-white transition disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 ${tonalite(
          active ? phase : 'idle',
        )}`}
        aria-label={active ? labels.stop : labels.start}
        aria-pressed={active}
        title={titre}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : active ? (
          <Square size={16} strokeWidth={2.5} />
        ) : (
          <Mic size={18} />
        )}

        {/* Anneau d'écoute. `motion-reduce` le supprime pour les personnes
            sensibles au mouvement, sans retirer l'information : la couleur
            du bouton porte déjà l'état. */}
        {active && phase === 'listening' && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none"
          />
        )}
      </button>
    </div>
  );
}
