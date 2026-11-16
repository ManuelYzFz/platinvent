'use client';

import { useState, useEffect } from 'react';
import { loginTranslations } from './login';
import { navbarTranslations } from './navbar';
import { sidebarTranslations } from './sidebar';
import { devicesTranslations } from './devices';
import { simcardsTranslations } from './simcards';
import { informesTranslations } from './informes';

export type SupportedLanguage = 'es' | 'en' | 'pt' | 'zh-CN';

export const ALL_TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  es: {
    ...loginTranslations.es,
    ...navbarTranslations.es,
    ...sidebarTranslations.es,
    ...devicesTranslations.es,
    ...simcardsTranslations.es,
    ...informesTranslations.es,
  },
  en: {
    ...loginTranslations.en,
    ...navbarTranslations.en,
    ...sidebarTranslations.en,
    ...devicesTranslations.en,
    ...simcardsTranslations.en,
    ...informesTranslations.en,
  },
  pt: {
    ...loginTranslations.pt,
    ...navbarTranslations.pt,
    ...sidebarTranslations.pt,
    ...devicesTranslations.pt,
    ...simcardsTranslations.pt,
    ...informesTranslations.pt,
  },
  'zh-CN': {
    ...loginTranslations['zh-CN'],
    ...navbarTranslations['zh-CN'],
    ...sidebarTranslations['zh-CN'],
    ...devicesTranslations['zh-CN'],
    ...simcardsTranslations['zh-CN'],
    ...informesTranslations['zh-CN'],
  },
};

export function getStoredLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'es';
  const saved = localStorage.getItem('app_lang') as SupportedLanguage;
  if (saved && ALL_TRANSLATIONS[saved]) return saved;
  return 'es';
}

export function useTranslation() {
  // Inicializamos en 'es' para que SSR y la hidratación inicial del cliente coincidan exactamente
  // evitando el fallo crítico de hidratación que bloqueaba los clics en la pantalla.
  const [lang, setLang] = useState<SupportedLanguage>('es');

  useEffect(() => {
    let ignore = false;

    // Sincronizar con el idioma guardado en el cliente una vez montado
    const syncStoredLang = async () => {
      await Promise.resolve();
      if (ignore) return;
      const saved = getStoredLanguage();
      if (saved && saved !== 'es') {
        setLang(saved);
      }
    };
    void syncStoredLang();

    const handleLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const newLang = (customEvent.detail || getStoredLanguage()) as SupportedLanguage;
      if (ALL_TRANSLATIONS[newLang]) {
        setLang(newLang);
      }
    };

    window.addEventListener('app_lang_changed', handleLangChange);
    return () => {
      ignore = true;
      window.removeEventListener('app_lang_changed', handleLangChange);
    };
  }, []);

  const t = (key: string): string => {
    const currentDict = ALL_TRANSLATIONS[lang] || ALL_TRANSLATIONS.es;
    return currentDict[key] || ALL_TRANSLATIONS.es[key] || key;
  };

  return { t, lang };
}
