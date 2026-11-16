import { NextResponse } from 'next/server';
import { verifySessionToken } from './token';
import type { UserRole } from './storage';

export interface ApiAuthResult {
  valid: boolean;
  session?: string;
  role?: UserRole;
  username?: string;
  response?: NextResponse;
}

/**
 * Validador de sesión y permisos para Route Handlers en /api/local-*
 * Verifica la presencia de una cookie 'jsession' válida y firmada.
 * Opcionalmente verifica que el rol del usuario cumpla con los privilegios requeridos.
 */
export function validateApiSession(
  request: Request,
  requiredRole?: UserRole
): ApiAuthResult {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)jsession=([^;]*)/);
  const session = match ? decodeURIComponent(match[1]).trim() : '';

  if (!session || session.length < 10 || session.startsWith('offline-')) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'No autorizado: Se requiere una sesión activa' },
        { status: 401 }
      ),
    };
  }

  const verified = verifySessionToken(session);
  if (!verified.valid || !verified.payload) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Sesión inválida o expirada. Por favor inicie sesión nuevamente.' },
        { status: 401 }
      ),
    };
  }

  const { role, username } = verified.payload;

  // Si se exige un rol específico (ejemplo: 'superadmin')
  if (requiredRole) {
    if (requiredRole === 'superadmin' && role !== 'superadmin') {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Acceso denegado: Se requieren permisos de Superadmin' },
          { status: 403 }
        ),
      };
    }

    if (requiredRole === 'admin' && role === 'solo_lectura') {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Acceso denegado: Tu cuenta tiene permisos de solo lectura' },
          { status: 403 }
        ),
      };
    }
  }

  return {
    valid: true,
    session,
    role,
    username,
  };
}

export const WRITE_ROLES: readonly UserRole[] = ['superadmin', 'admin'];

/**
 * Validador estricto para mutaciones (POST, PUT, DELETE) verificando roles permitidos en el servidor.
 */
export async function requireRole(
  request: Request,
  allowedRoles: readonly UserRole[] | UserRole[]
): Promise<{ ok: true; role: UserRole; username: string } | { ok: false; response: NextResponse }> {
  const auth = validateApiSession(request);
  if (!auth.valid || !auth.role || !auth.username) {
    return {
      ok: false,
      response: auth.response || NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(auth.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Acceso denegado: No tienes permisos suficientes para realizar esta acción' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, role: auth.role, username: auth.username };
}
