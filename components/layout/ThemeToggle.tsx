'use client';

import React, { useEffect, useCallback, useSyncExternalStore } from 'react';
import { Sun, MoonStar } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export type Theme = 'light' | 'dark';

export function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Atributo Bootstrap 5, ProyectoFactura y clase Tailwind
  root.setAttribute('data-bs-theme', theme);
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = theme;

  // Actualizar checkbox si existe en el DOM
  const themeSwitchCheckbox = document.getElementById('theme-switch-checkbox') as HTMLInputElement | null;
  if (themeSwitchCheckbox) {
    themeSwitchCheckbox.checked = (theme === 'dark');
  }

  // Actualizar logo del header si existe
  const headerLogo = document.getElementById('main-logo') as HTMLImageElement | null;
  if (headerLogo) {
    if (theme === 'dark' && headerLogo.dataset.darkSrc) {
      headerLogo.src = headerLogo.dataset.darkSrc;
    } else if (theme === 'light' && headerLogo.dataset.lightSrc) {
      headerLogo.src = headerLogo.dataset.lightSrc;
    }
  }
}

const emptySubscribe = () => () => {};

function subscribeTheme(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener('storage', callback);
  window.addEventListener('vtraxx-theme-change', callback);
  mediaQuery.addEventListener('change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('vtraxx-theme-change', callback);
    mediaQuery.removeEventListener('change', callback);
  };
}

function getThemeSnapshot(): Theme {
  return getPreferredTheme();
}

function getServerThemeSnapshot(): Theme {
  return 'light';
}

export default function ThemeToggle() {
  const { t } = useTranslation();
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('theme', nextTheme);
      window.dispatchEvent(new Event('vtraxx-theme-change'));
    } catch {}
    applyTheme(nextTheme);
  }, [theme]);

  if (!isMounted) {
    return (
      <div className="w-14.5 h-7.5 rounded-full bg-[#e2e5eb] opacity-0" />
    );
  }

  const isDark = theme === 'dark';

  return (
    <div className="relative inline-flex items-center">
      {/* Input oculto para compatibilidad con theme-switch-checkbox */}
      <input
        type="checkbox"
        id="theme-switch-checkbox"
        checked={isDark}
        onChange={toggleTheme}
        className="sr-only"
        aria-label={t('cambiar_tema') || 'Cambiar tema'}
      />

      {/* Switch estilo píldora como en la imagen */}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={toggleTheme}
        id="theme-toggle-btn"
        className={`relative w-14.5 h-7.5 rounded-full transition-colors duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00acee]/30 select-none shadow-2xs ${
          isDark
            ? 'bg-[#181e29] border border-[#263043]'
            : 'bg-[#e2e5eb] border border-[#d6dae3]'
        }`}
        title={isDark ? (t('modo_claro') || 'Modo claro') : (t('modo_oscuro') || 'Modo oscuro')}
        aria-label={isDark ? (t('modo_claro') || 'Modo claro') : (t('modo_oscuro') || 'Modo oscuro')}
      >
        {/* Icono Sol (#00ACEE) - Posición Izquierda (visible en modo oscuro) */}
        <span
          className={`absolute left-[6.5px] top-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300 ${
            isDark ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
          }`}
        >
          <Sun className="w-4 h-4 text-[#00acee]" strokeWidth={2.5} />
        </span>

        {/* Icono Luna con estrellas (#00ACEE) - Posición Derecha (visible en modo claro) */}
        <span
          className={`absolute right-[6.5px] top-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300 ${
            !isDark ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
          }`}
        >
          <MoonStar className="w-4 h-4 text-[#00acee] fill-[#00acee]/25" strokeWidth={2.2} />
        </span>

        {/* Círculo deslizante (Knob) */}
        <span
          id="theme-icon"
          className={`absolute top-1/2 -translate-y-1/2 left-0.75 z-10 block w-5.5 h-5.5 rounded-full transition-all duration-300 ease-out transform ${
            isDark
              ? 'translate-x-7 bg-[#10141d] border border-[#222c3d] shadow-sm'
              : 'translate-x-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.22)]'
          }`}
        />
      </button>
    </div>
  );
}
