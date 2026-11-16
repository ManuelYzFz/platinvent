'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import Preloader from '@/components/layout/Preloader';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: {
          new (
            options: { pageLanguage: string; multilanguage?: boolean; layout?: unknown },
            elementId: string
          ): unknown;
          InlineLayout?: {
            SIMPLE?: unknown;
          };
        };
      };
    };
  }
}

interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'zh-CN', label: '中文 (Chino)', flag: '🇨🇳' },
];

export const PRELOADER_DURATION_MS = 1500;

function clearGoogleTranslateCookies() {
  if (typeof document === 'undefined') return;

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const domainParts = hostname.split('.');
  const domains: string[] = ['', hostname, `.${hostname}`];

  for (let i = 0; i < domainParts.length - 1; i++) {
    domains.push(`.${domainParts.slice(i).join('.')}`);
  }

  const paths = ['/', typeof window !== 'undefined' ? window.location.pathname : '/'];
  const cookieNames = ['googtrans', 'googtrans_backup'];

  cookieNames.forEach((name) => {
    domains.forEach((dom) => {
      paths.forEach((p) => {
        const domainStr = dom ? `; domain=${dom}` : '';
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${p}${domainStr}; max-age=0;`;
      });
    });
  });
}

function clearGoogleTranslateHash() {
  if (typeof window === 'undefined') return;
  if (window.location.hash.includes('googtrans')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

// Disparador del selector oculto de Google Translate con reintentos controlados
function triggerGoogleCombo(langCode: string) {
  if (typeof document === 'undefined') return;
  let attempts = 0;
  const targetVal = langCode === 'es' ? '' : langCode;

  const run = () => {
    const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
    if (select) {
      select.value = targetVal;
      select.dispatchEvent(new Event('change'));
    } else if (attempts < 15) {
      attempts++;
      setTimeout(run, 100);
    }
  };
  run();
}

export default function GoogleTranslator() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('es');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translatingLangName, setTranslatingLangName] = useState<string>('');

  // 1. Sincronizar cookies/hash de Google Translate e idioma guardado en el cliente sin romper la hidratación
  useEffect(() => {
    let ignore = false;

    const syncLanguage = async () => {
      await Promise.resolve();
      if (ignore) return;

      try {
        const savedLang =
          sessionStorage.getItem('app_lang_code') ||
          localStorage.getItem('app_lang') ||
          'es';

        setSelectedLanguage(savedLang);
        if (savedLang === 'es') {
          clearGoogleTranslateCookies();
          clearGoogleTranslateHash();
        } else {
          window.location.hash = `#googtrans(es|${savedLang})`;
          document.cookie = `googtrans=/es/${savedLang}; path=/;`;
          if (window.location.hostname) {
            document.cookie = `googtrans=/es/${savedLang}; path=/; domain=.${window.location.hostname};`;
          }
        }
      } catch (e) {
        console.warn('Error sincronizando idioma guardado:', e);
      }
    };

    void syncLanguage();

    return () => {
      ignore = true;
    };
  }, []);

  // 2. Inicialización oficial del widget con soporte 'multilanguage: true'
  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'es',
            multilanguage: true,
            layout: window.google.translate.TranslateElement.InlineLayout?.SIMPLE,
          },
          'google_translate_element'
        );
      }
    };

    const scriptId = 'google-translate-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }

    // Blindaje CSS en tiempo de ejecución para ocultar banners invasivos de Google
    const killBanners = () => {
      const htmlEl = document.documentElement;
      const bodyEl = document.body;

      htmlEl.style.setProperty('top', '0px', 'important');
      htmlEl.style.setProperty('margin-top', '0px', 'important');
      htmlEl.style.setProperty('padding-top', '0px', 'important');
      htmlEl.style.setProperty('position', 'static', 'important');

      bodyEl.style.setProperty('top', '0px', 'important');
      bodyEl.style.setProperty('margin-top', '0px', 'important');
      bodyEl.style.setProperty('padding-top', '0px', 'important');
      bodyEl.style.setProperty('position', 'static', 'important');

      const bannerElements = document.querySelectorAll(
        '.goog-te-banner-frame, iframe.goog-te-banner-frame, .VIpgJd-Z44Wjh-FWnhvd-haAclf, #goog-gt-tt, iframe[src*="translate.google"], iframe[id*="google"]'
      );
      bannerElements.forEach((elem) => {
        const htmlElem = elem as HTMLElement;
        if (htmlElem.style.display !== 'none') {
          htmlElem.style.setProperty('display', 'none', 'important');
          htmlElem.style.setProperty('visibility', 'hidden', 'important');
          htmlElem.style.setProperty('height', '0px', 'important');
          htmlElem.style.setProperty('width', '0px', 'important');
          htmlElem.style.setProperty('opacity', '0', 'important');
        }
      });
    };

    killBanners();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        killBanners();
        debounceTimer = null;
      }, 150);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const observerTimeout = setTimeout(() => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    }, 12_000);

    return () => {
      observer.disconnect();
      clearTimeout(observerTimeout);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // 3. Flujo de selección en caliente: traduce detrás del preloader SIN parpadeos ni recargas
  const handleSelectLanguage = useCallback((langCode: string) => {
    setSelectedLanguage(langCode);
    const targetLang = LANGUAGES.find((l) => l.code === langCode);
    setTranslatingLangName(targetLang ? targetLang.label : langCode);
    setIsTranslating(true);
    setIsOpen(false);

    try {
      sessionStorage.setItem('app_lang_code', langCode);
      localStorage.setItem('app_lang', langCode);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app_lang_changed', { detail: langCode }));
      }
    } catch (e) {
      console.warn('Error guardando preferencia de idioma:', e);
    }

    if (langCode === 'es') {
      // Regreso a español
      clearGoogleTranslateCookies();
      clearGoogleTranslateHash();
      triggerGoogleCombo('es');

      // Esperar a que la clase translated se retire y los textos vuelvan a español
      const startTime = Date.now();
      const checkRestored = () => {
        const isTranslated =
          document.documentElement.classList.contains('translated-ltr') ||
          document.documentElement.classList.contains('translated-rtl');
        const elapsed = Date.now() - startTime;

        if ((!isTranslated && elapsed >= 600) || elapsed >= 1500) {
          setIsTranslating(false);
        } else {
          setTimeout(checkRestored, 100);
        }
      };
      setTimeout(checkRestored, 200);
    } else {
      // Cambio a idioma extranjero
      if (typeof window !== 'undefined') {
        window.location.hash = `#googtrans(es|${langCode})`;
        document.cookie = `googtrans=/es/${langCode}; path=/;`;
        if (window.location.hostname) {
          document.cookie = `googtrans=/es/${langCode}; path=/; domain=.${window.location.hostname};`;
        }
      }
      triggerGoogleCombo(langCode);

      // El preloader permanece ACTIVO hasta que Google Translate termine de mutar el DOM
      const startTime = Date.now();
      const checkTranslated = () => {
        const isTranslated =
          document.documentElement.classList.contains('translated-ltr') ||
          document.documentElement.classList.contains('translated-rtl');
        const elapsed = Date.now() - startTime;

        // Ocultar el preloader SOLO cuando la traducción ya se aplicó efectivamente al HTML
        if ((isTranslated && elapsed >= 800) || elapsed >= 2000) {
          setIsTranslating(false);
        } else {
          setTimeout(checkTranslated, 100);
        }
      };
      setTimeout(checkTranslated, 250);
    }
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === selectedLanguage) || LANGUAGES[0];

  return (
    <>
      {/* Preloader corporativo activo durante el cambio de idioma */}
      {isTranslating && (
        <>
          <Preloader fullScreen message={`Cambiando idioma a ${translatingLangName}...`} />
          <style>{`
            html, body {
              top: 0px !important;
              margin-top: 0px !important;
              padding-top: 0px !important;
              overflow: hidden !important;
            }
            iframe[id*="google"], .goog-te-banner-frame, #goog-gt-tt {
              display: none !important;
              visibility: hidden !important;
            }
          `}</style>
        </>
      )}

      <div className="relative inline-block text-left notranslate" translate="no">
        <div
          id="google_translate_element"
          className="fixed top-[-9999px] left-[-9999px] opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
        />

        <div className="flex flex-col items-center sm:items-end">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="group flex items-center gap-2 rounded-xl border border-[#e8e9ed] bg-white dark:bg-[#161b22] dark:border-[#30363d] px-3 py-1.5 shadow-xs hover:shadow-md hover:border-[#00acee] transition-all cursor-pointer notranslate"
            translate="no"
            suppressHydrationWarning
          >
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04z" fill="#4285F4" />
                <path d="M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="#34A853" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 font-sans">
              <span className="text-sm">{currentLang.flag}</span>
              <span className="text-xs font-bold text-[#3a435d] dark:text-gray-200 uppercase tracking-wider">
                {currentLang.code}
              </span>
              <span className="text-xs text-[#5c647b] dark:text-gray-400 hidden md:inline">
                ({currentLang.label})
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#5c647b] dark:text-gray-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-[#00acee]' : ''
              }`}
            />
          </button>
        </div>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div
              className="absolute right-0 mt-2 w-48 rounded-2xl border border-[#e8e9ed] bg-white dark:bg-[#161b22] dark:border-[#30363d] p-1.5 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 notranslate"
              translate="no"
            >
              <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#00acee] border-b border-[#e8e9ed] dark:border-[#30363d] mb-1">
                Seleccionar Idioma
              </div>
              {LANGUAGES.map((lang) => {
                const isSelected = lang.code === selectedLanguage;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer notranslate ${
                      isSelected
                        ? 'bg-[#00acee]/10 dark:bg-[#00acee]/20 font-bold text-[#00acee] dark:text-[#38bdf8]'
                        : 'text-[#3a435d] dark:text-gray-200 hover:bg-[#f8f9fa] dark:hover:bg-[#21262d]'
                    }`}
                    translate="no"
                  >
                    <div className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#00acee]" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}