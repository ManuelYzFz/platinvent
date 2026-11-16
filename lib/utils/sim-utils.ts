import { detectOperatorFromCatalog } from '@/lib/utils/network-codes';

export function normalizeICCID(code: string): string {
  if (!code) return '';
  const trimmed = code.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  // Si mide 18 dígitos y empieza con 56 (prefijo Chile sin el 89 inicial), estandarizar a 20 dígitos agregando 89
  if (digitsOnly.length === 18 && digitsOnly.startsWith('56')) {
    return '89' + digitsOnly;
  }

  // Si tiene entre 16 y 18 dígitos y empieza con 56
  if (digitsOnly.startsWith('56') && digitsOnly.length >= 16 && digitsOnly.length <= 18) {
    return '89' + digitsOnly;
  }

  return trimmed;
}

export interface OperatorDetectionResult {
  operator: string;
  mainOperator: string;
  mnc: string;
  country: string;
  industry: string;
  description?: string;
  isSecondary?: boolean;
}

export function detectOperatorFromICCID(iccid: string): OperatorDetectionResult | null {
  const match = detectOperatorFromCatalog(iccid);
  if (!match) return null;
  return {
    operator: match.operator,
    mainOperator: match.mainOperator,
    mnc: match.mnc,
    country: match.country,
    industry: match.industry,
    description: match.description,
    isSecondary: match.isSecondary,
  };
}

export interface DeviceItemOption {
  devIDNO?: string | null;
  devIdno?: string | null;
  id?: string | number | null;
  companyName?: string | null;
  companyId?: string | number | null;
  companyID?: string | number | null;
  vehiIdno?: string | null;
  brand?: string | null;
  model?: string | null;
  [key: string]: unknown;
}

export interface VehicleItemOption {
  vid?: string | null;
  vehiIdno?: string | null;
  id?: string | number | null;
  com?: { id?: string | number; name?: string; companyId?: string | number } | null;
  companyId?: string | number | null;
  companyName?: string | null;
  devList?: { id?: string; name?: string; serialID?: string }[] | null;
  [key: string]: unknown;
}
