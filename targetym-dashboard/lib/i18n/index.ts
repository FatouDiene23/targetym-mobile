import { fr } from './translations/fr';
import { en } from './translations/en';
import { pt } from './translations/pt';

export type Locale = 'fr' | 'en' | 'pt';
export type Translations = typeof fr;

const translations: Record<Locale, Translations> = { fr, en: en as unknown as Translations, pt: pt as unknown as Translations };

export function getTranslation(locale: Locale): Translations {
  return translations[locale] || translations.fr;
}

export function t(locale: Locale, key: string): string {
  const keys = key.split('.');
  let result: any = translations[locale] || translations.fr;
  for (const k of keys) {
    result = result?.[k];
    if (result === undefined) {
      let fallback: any = translations.fr;
      for (const fk of keys) { fallback = fallback?.[fk]; }
      return fallback || key;
    }
  }
  return result;
}
