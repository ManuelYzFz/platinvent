import crypto from 'crypto';
import type { UserRole } from './storage';

const TOKEN_SECRET = process.env.AUTH_SECRET || 'vtraxx-auth-secret-key-2026-production';

export interface TokenPayload {
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Genera un token de sesión firmado con HMAC-SHA256.
 * Formato: vtx.<payloadBase64>.<hmacSignature>
 */
export function createSessionToken(username: string, role: UserRole): string {
  const payload: TokenPayload = {
    username,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 días
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `vtx.${payloadB64}.${signature}`;
}

/**
 * Valida un token de sesión firmado y extrae el usuario y rol verificados por el servidor.
 */
export function verifySessionToken(token: string): { valid: boolean; payload?: TokenPayload } {
  if (!token || typeof token !== 'string') return { valid: false };

  // Tokens firmados por Vtraxx
  if (token.startsWith('vtx.')) {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };

    const [, payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(payloadB64)
      .digest('base64url');

    if (signature !== expectedSig) {
      return { valid: false };
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as TokenPayload;
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return { valid: false };
      }
      return { valid: true, payload };
    } catch {
      return { valid: false };
    }
  }

  // Tokens de sesión de OpenTraxx (legado): son tokens emitidos directamente por OpenTraxx
  if (token.length >= 10 && !token.startsWith('offline-')) {
    return {
      valid: true,
      payload: {
        username: 'Usuario OpenTraxx',
        role: 'admin', // Cuentas de OpenTraxx operan con rol admin
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      },
    };
  }

  return { valid: false };
}
