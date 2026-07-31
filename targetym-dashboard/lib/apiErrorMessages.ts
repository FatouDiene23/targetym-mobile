import type { Translations } from '@/lib/i18n';

const EMAIL_ALREADY_EXISTS_MARKER = 'Un compte existe déjà avec ce mail';
const TECHNICAL_ERROR_MESSAGE = "Une erreur technique empêche de finaliser l'opération. Veuillez réessayer dans quelques instants ou contacter l'administrateur.";
const NETWORK_ERROR_MESSAGE = "Impossible de joindre le service pour le moment. Veuillez vérifier votre connexion ou réessayer dans quelques instants.";

export function normalizeApiErrorMessage(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (
    normalized === 'failed to fetch' ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network error') ||
    normalized.includes('fetch failed') ||
    normalized.includes('load failed') ||
    normalized.includes('connection error') ||
    normalized.includes('erreur de connexion')
  ) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (
    normalized === 'database error' ||
    normalized === 'database error.' ||
    normalized.includes('internal database error') ||
    normalized.includes('database error') ||
    normalized.includes('database temporarily unavailable') ||
    normalized.includes('internal server error') ||
    normalized.includes('server error') ||
    normalized.includes('api error') ||
    normalized.includes('erreur api') ||
    normalized.includes('please try again later')
  ) {
    return TECHNICAL_ERROR_MESSAGE;
  }

  return message;
}

export function normalizeApiErrorPayload(payload: unknown): unknown {
  if (typeof payload === 'string') {
    return normalizeApiErrorMessage(payload);
  }

  if (Array.isArray(payload)) {
    return payload.map(normalizeApiErrorPayload);
  }

  if (payload && typeof payload === 'object') {
    const normalizedPayload: Record<string, unknown> = { ...(payload as Record<string, unknown>) };
    for (const key of ['detail', 'message', 'error']) {
      const value = normalizedPayload[key];
      if (typeof value === 'string') {
        normalizedPayload[key] = normalizeApiErrorMessage(value);
      } else if (Array.isArray(value)) {
        normalizedPayload[key] = value.map(normalizeApiErrorPayload);
      }
    }
    return normalizedPayload;
  }

  return payload;
}

export function translateApiErrorMessage(message: string, t: Translations): string {
  if (message.includes(EMAIL_ALREADY_EXISTS_MARKER)) {
    return t.common.apiErrors.emailAlreadyExists;
  }

  return normalizeApiErrorMessage(message);
}
