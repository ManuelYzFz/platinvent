/**
 * Centralized session & auth storage utilities.
 *
 * All session read/write operations go through this module.
 * When transitioning to production (Firebase Auth or HttpOnly cookies),
 * update only this file — all consuming pages stay unchanged.
 */

export type UserRole = 'superadmin' | 'admin' | 'solo_lectura';

const KEYS = {
  session: 'jsession',
  username: 'username',
  role: 'user_role',
  dashboardData: 'dashboardData',
  rememberedUsername: 'remembered_username',
  sessionExpires: 'session_expires',
  lastActivity: 'last_activity',
} as const;

/** Duración de la sesión cuando se marca "Recordarme" (30 días) */
const REMEMBER_SECONDS = 60 * 60 * 24 * 30;

/** Read the active session token (sessionStorage first, then localStorage) */
export function getSession(): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = sessionStorage.getItem(KEYS.session) || localStorage.getItem(KEYS.session);
    if (stored && !sessionStorage.getItem(KEYS.session)) {
      sessionStorage.setItem(KEYS.session, stored);
    }
    if (stored && typeof document !== 'undefined' && !document.cookie.includes(`${KEYS.session}=`)) {
      const isRemembered = Boolean(localStorage.getItem(KEYS.session));
      const cookieDuration = isRemembered ? `; max-age=${REMEMBER_SECONDS}` : '';
      const secureFlag = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${KEYS.session}=${encodeURIComponent(stored)}; path=/${cookieDuration}; SameSite=Strict${secureFlag}`;
    }
    return stored || '';
  } catch {
    return '';
  }
}

/** Read the active user role */
export function getUserRole(): UserRole {
  if (typeof window === 'undefined') return 'admin';
  try {
    const stored = sessionStorage.getItem(KEYS.role) || localStorage.getItem(KEYS.role);
    if (stored === 'superadmin' || stored === 'admin' || stored === 'solo_lectura') {
      return stored;
    }
    return 'admin';
  } catch {
    return 'admin';
  }
}

/** Read the active username */
export function getUsername(): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = sessionStorage.getItem(KEYS.username) || localStorage.getItem(KEYS.username);
    if (stored && !sessionStorage.getItem(KEYS.username)) {
      sessionStorage.setItem(KEYS.username, stored);
    }
    return stored || 'Usuario Vtraxx';
  } catch {
    return 'Usuario Vtraxx';
  }
}

interface SaveSessionOptions {
  session: string;
  username: string;
  role?: UserRole;
  /** If true, also persists to localStorage (Remember Me) */
  remember?: boolean;
  dashboardData?: unknown;
}

/** Persist a new session after login */
export function saveSession({ session, username, role = 'admin', remember = true, dashboardData }: SaveSessionOptions): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(KEYS.session, session);
    sessionStorage.setItem(KEYS.username, username);
    sessionStorage.setItem(KEYS.role, role);

    if (remember) {
      localStorage.setItem(KEYS.session, session);
      localStorage.setItem(KEYS.username, username);
      localStorage.setItem(KEYS.role, role);
      localStorage.setItem(KEYS.rememberedUsername, username);
    } else {
      localStorage.removeItem(KEYS.session);
      localStorage.removeItem(KEYS.username);
      localStorage.removeItem(KEYS.role);
    }

    if (typeof document !== 'undefined') {
      const cookieDuration = remember ? `; max-age=${REMEMBER_SECONDS}` : ''; // 30 días o cookie de sesión volátil
      const secureFlag = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${KEYS.session}=${encodeURIComponent(session)}; path=/${cookieDuration}; SameSite=Strict${secureFlag}`;
    }

    if (dashboardData) {
      const dataStr = typeof dashboardData === 'string' ? dashboardData : JSON.stringify(dashboardData);
      sessionStorage.setItem(KEYS.dashboardData, dataStr);
      if (remember) {
        localStorage.setItem(KEYS.dashboardData, dataStr);
      } else {
        localStorage.removeItem(KEYS.dashboardData);
      }
    }

    touchActivity();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('session_updated'));
    }
  } catch (err) {
    console.warn('Error guardando sesión en storage:', err);
  }
}


/** Clear all session data (logout) */
export function clearSession(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(KEYS.session);
    sessionStorage.removeItem(KEYS.username);
    sessionStorage.removeItem(KEYS.role);
    sessionStorage.removeItem(KEYS.dashboardData);
    localStorage.removeItem(KEYS.session);
    localStorage.removeItem(KEYS.username);
    localStorage.removeItem(KEYS.role);
    localStorage.removeItem(KEYS.dashboardData);
    localStorage.removeItem(KEYS.lastActivity);
    if (typeof document !== 'undefined') {
      const secureFlag = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${KEYS.session}=; path=/; max-age=0; SameSite=Strict${secureFlag}`;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('session_updated'));
    }
    // Se preserva KEYS.rememberedUsername para que al volver al login el usuario siga recordado
  } catch {}
}

/** Get the remembered username for auto-fill */
export function getRememberedUsername(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(KEYS.rememberedUsername) || '';
  } catch {
    return '';
  }
}

/** True si la sesión actual fue guardada con "Recordarme" (existe copia en localStorage) */
export function isSessionRemembered(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(KEYS.session));
  } catch {
    return false;
  }
}

/** Guarda la hora de la última actividad del usuario (para el cierre por inactividad) */
export function touchActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEYS.lastActivity, String(Date.now()));
  } catch {}
}

/** Devuelve la hora (ms) de la última actividad, o 0 si no existe */
export function getLastActivity(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return Number(localStorage.getItem(KEYS.lastActivity)) || 0;
  } catch {
    return 0;
  }
}
