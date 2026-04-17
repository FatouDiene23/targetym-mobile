'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, Translations, getTranslation } from './index';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'fr',
  setLocale: () => {},
  t: getTranslation('fr'),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    const init = async () => {
      // 1. Vérifier localStorage (choix explicite de l'utilisateur)
      const saved = localStorage.getItem('targetym_locale') as Locale;
      if (saved && ['fr', 'en', 'pt'].includes(saved)) {
        setLocaleState(saved);
        return;
      }

      // 2. Sinon, récupérer la langue par défaut du tenant
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.targetym.ai').replace(/^http:\/\//, 'https://');
          const res = await fetch(`${apiUrl}/api/auth/tenant-settings`, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            const lang = data.default_language;
            if (lang && ['fr', 'en', 'pt'].includes(lang)) {
              setLocaleState(lang as Locale);
              localStorage.setItem('targetym_locale', lang);
              return;
            }
          }
        }
      } catch {
        // Silencieux — on garde 'fr' par défaut
      }
    };
    init();
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('targetym_locale', newLocale);
  };

  return (
    <I18nContext.Provider value={{
      locale,
      setLocale,
      t: getTranslation(locale)
    }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
