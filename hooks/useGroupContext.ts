// Re-export depuis le vrai React Context partagé
// Tous les composants importent depuis @/hooks/useGroupContext — les imports restent valides
export type { GroupContextState } from '@/context/GroupContext';
export { useGroupContext } from '@/context/GroupContext';
