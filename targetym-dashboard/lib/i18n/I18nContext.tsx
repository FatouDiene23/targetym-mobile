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
    const saved = localStorage.getItem('targetym_locale') as Locale;
    if (saved && ['fr', 'en', 'pt'].includes(saved)) {
      setLocaleState(saved);
    }
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
