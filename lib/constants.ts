/**
 * Constantes compartidas para el inventario de la plataforma Vtraxx
 */

export const DEFAULT_COMPANY_OPTIONS: readonly string[] = [
  'Opentraxx',
  'Vtraxx',
  'SantoTomas',
  'VtraxxChina',
  'TurBus',
] as const;

export const APP_METADATA = {
  name: 'Plataforma de Inventariado Vtraxx',
  shortName: 'Vtraxx',
  description: 'Plataforma de inventario y gestión técnica de dispositivos GPS, DVR y tarjetas SIM',
  themeColor: '#3a435d',
} as const;

export const BRAND_OPTIONS = ['Queclink', 'Teltonika', 'Suntech', 'Concox'] as const;
export const MODEL_OPTIONS = ['GV300', 'FMM920', 'ST310U', 'JM-VL03'] as const;

export const COUNTRY_CODES = [
  { code: '+56', country: 'Chile 🇨🇱', flag: '🇨🇱' },
  { code: '+55', country: 'Brasil 🇧🇷', flag: '🇧🇷' },
  { code: '+86', country: 'China 🇨🇳', flag: '🇨🇳' },
] as const;

export const PAGE_SIZE = 50;

/**
 * TEMPORAL: false = empresas, vehículos, SIMs y dispositivos se leen/escriben solo en MySQL
 * (lib/db-inventory.ts) y se ignora la caché IndexedDB al cargar.
 * Cambiar a true para volver a usar los JSON de datoslocales/.
 */
export const USE_LOCAL_DATA = false;
