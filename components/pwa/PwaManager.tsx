'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __pwaDeferredPrompt?: BeforeInstallPromptEvent | null;
    MSStream?: unknown;
  }
  interface Navigator {
    standalone?: boolean;
  }
}

export async function triggerInstallPrompt(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const prompt = window.__pwaDeferredPrompt;
  if (prompt) {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      window.__pwaDeferredPrompt = null;
      return true;
    }
  } else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    alert('Para instalar en iOS: presiona el botón Compartir en Safari y selecciona "Agregar a inicio".');
  } else {
    alert('La aplicación ya se encuentra instalada o puedes abrirla desde tu pantalla de inicio.');
  }
  return false;
}

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ignore = false;

    // Limpiar claves persistentes anteriores para evitar que se bloquee la reinstalación
    try {
      localStorage.removeItem('pwa_installed');
      localStorage.removeItem('pwa_banner_dismissed');
      localStorage.removeItem('pwa_prompt_dismissed');
    } catch {
      // Ignorar errores de localStorage
    }

    // Verificar si se está ejecutando dentro de la app PWA instalada
    const checkStandalone = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        navigator.standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    const initInstallState = async () => {
      await Promise.resolve();
      if (ignore) return;

      const standaloneActive = checkStandalone();
      setIsStandalone(standaloneActive);
      if (standaloneActive) {
        setDismissed(true);
        return;
      }

      try {
        if (sessionStorage.getItem('pwa_dismissed') === 'true') {
          setDismissed(true);
        }
      } catch {}

      setIsIOS(
        /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
      );
    };

    void initInstallState();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__pwaDeferredPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      try {
        if (sessionStorage.getItem('pwa_dismissed') !== 'true') {
          setDismissed(false);
        }
      } catch {}
    };

    const handleAppInstalled = () => {
      window.__pwaDeferredPrompt = null;
      setDeferredPrompt(null);
      setDismissed(true);
      try {
        sessionStorage.setItem('pwa_dismissed', 'true');
      } catch {}
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      window.__pwaDeferredPrompt = null;
      setDeferredPrompt(null);
      setDismissed(true);
      try {
        sessionStorage.setItem('pwa_dismissed', 'true');
      } catch {}
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('pwa_dismissed', 'true');
    } catch {}
  };

  const pathname = usePathname();

  // El banner flotante de instalación SOLO aparece en la pantalla de Login
  if (pathname !== '/login') {
    return null;
  }

  if (isStandalone || dismissed) {
    return null;
  }

  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Instalar aplicacion"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-30 bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom duration-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-lg shrink-0 shadow">
            V
          </div>
          <div>
            <h4 className="font-bold text-sm leading-tight text-white">Instalar Vtraxx App</h4>
            <p className="text-xs text-slate-300 leading-tight">Accede rapidamente desde tu pantalla de inicio</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 text-sm font-bold leading-none"
          title="Cerrar"
        >
          X
        </button>
      </div>

      {isIOS ? (
        <p className="text-xs text-slate-300 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 leading-relaxed">
          Para instalar en iOS: presiona el boton compartir en Safari y selecciona &quot;Agregar a inicio&quot;.
        </p>
      ) : (
        <div className="flex gap-2 justify-end mt-1">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white font-medium"
          >
            Ahora no
          </button>
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow transition-colors"
          >
            Instalar
          </button>
        </div>
      )}
    </aside>
  );
}

export default function PwaManager() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/service-worker.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        .catch((err) => {
          console.error('Error al registrar Service Worker en PwaManager:', err);
        });
    } else {
      // En desarrollo: desregistrar service worker y vaciar caches para evitar colisiones con Turbopack / HMR
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            void caches.delete(key);
          });
        });
      }
    }
  }, []);

  return <InstallPrompt />;
}