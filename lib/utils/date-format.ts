/**
 * Utilidades compartidas de formateo de fecha y hora
 */

export function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Retorna fecha en formato YYYY-MM-DD
 */
export function formatDate(input: Date | number | string = new Date()): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = padZero(d.getMonth() + 1);
  const dd = padZero(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Retorna fecha y hora en formato YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(input: Date | number | string = new Date()): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = padZero(d.getMonth() + 1);
  const dd = padZero(d.getDate());
  const hh = padZero(d.getHours());
  const min = padZero(d.getMinutes());
  const ss = padZero(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
