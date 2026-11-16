'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  isSessionRemembered,
  touchActivity,
  getLastActivity,
  clearSession,
  getSession,
} from './storage';

/** Tiempo máximo de inactividad antes de cerrar sesión (30 minutos) */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** Intervalo para verificar el estado de inactividad (30 segundos) */
const CHECK_INTERVAL_MS = 30 * 1000;
/** Intervalo mínimo entre escrituras de actividad a localStorage (5 segundos) */
const ACTIVITY_THROTTLE_MS = 5 * 1000;

/**
 * Hook para cerrar sesión automáticamente tras 30 minutos de inactividad.
 * Solo se activa cuando la sesión no fue marcada con "Recordarme en este equipo".
 */
export function useIdleLogout(): void {
  const router = useRouter();
  const lastWriteRef = useRef<number>(0);

  useEffect(() => {
    // Si no hay sesión o si la sesión tiene "Recordarme", no activar el temporizador
    if (!getSession() || isSessionRemembered()) {
      return;
    }

    // Inicializar timestamp de actividad si no existe aún
    if (getLastActivity() === 0) {
      touchActivity();
    }

    const checkInactivity = () => {
      // Re-verificar que sigue siendo sesión no recordada
      if (isSessionRemembered()) return;

      const last = getLastActivity();
      if (last > 0 && Date.now() - last >= IDLE_TIMEOUT_MS) {
        clearSession();
        try {
          router.replace('/login');
        } catch {
          window.location.replace('/login');
        }
      }
    };

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current >= ACTIVITY_THROTTLE_MS) {
        lastWriteRef.current = now;
        touchActivity();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };

    const handleWindowFocus = () => {
      checkInactivity();
    };

    // Eventos de actividad del usuario
    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    const intervalId = window.setInterval(checkInactivity, CHECK_INTERVAL_MS);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.clearInterval(intervalId);
    };
  }, [router]);
}
