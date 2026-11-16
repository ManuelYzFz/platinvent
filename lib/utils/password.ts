import crypto from 'crypto';

/*Genera un hash seguro para la contraseña usando scrypt + salt aleatorio, Formato resultante: scrypt:<salt>:<hash>*/
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/*Verifica si una contraseña en texto plano coincide con el hash almacenado */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  const parts = storedHash.split(':');
  if (parts.length === 3 && parts[0] === 'scrypt') {
    const salt = parts[1];
    const key = parts[2];
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }

  // Compatibilidad con cuentas antiguas sin hash: comparación en tiempo constante
  const a = Buffer.from(password);
  const b = Buffer.from(storedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
