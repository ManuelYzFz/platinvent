export interface NetworkCodeItem {
  mnc: string;
  prefix: string;
  operator: string;
  mainOperator: string;
  isSecondary: boolean;
  description: string;
}

export interface NetworkCodesCatalog {
  country: string;
  countryCode: string;
  industry: string;
  industryCode: string;
  networkCodes: NetworkCodeItem[];
}

export const NETWORK_CODES_CATALOG: NetworkCodesCatalog = {
  country: 'Chile',
  countryCode: '56',
  industry: 'Telecomunicaciones',
  industryCode: '89',
  networkCodes: [
    {
      mnc: '01',
      prefix: '895601',
      operator: 'Entel',
      mainOperator: 'Entel',
      isSecondary: false,
      description: 'Muy común (corresponde a Entel PCS).',
    },
    {
      mnc: '09',
      prefix: '895609',
      operator: 'WOM',
      mainOperator: 'WOM',
      isSecondary: false,
      description: 'Muy común.',
    },
    {
      mnc: '03',
      prefix: '895603',
      operator: 'Claro',
      mainOperator: 'Claro',
      isSecondary: false,
      description: 'Muy común (ClaroVTR).',
    },
    {
      mnc: '02',
      prefix: '895602',
      operator: 'Movistar',
      mainOperator: 'Movistar',
      isSecondary: false,
      description: 'Muy común.',
    },
    {
      mnc: '07',
      prefix: '895607',
      operator: 'Movistar (Secundario)',
      mainOperator: 'Movistar',
      isSecondary: true,
      description: 'Menos común, usado a veces para líneas corporativas o marcas específicas.',
    },
    {
      mnc: '04',
      prefix: '895604',
      operator: 'WOM (Secundario)',
      mainOperator: 'WOM',
      isSecondary: true,
      description: 'Frecuente en lotes de chips antiguos o de banda ancha móvil.',
    },
    {
      mnc: '10',
      prefix: '895610',
      operator: 'Entel (Secundario)',
      mainOperator: 'Entel',
      isSecondary: true,
      description: 'Usado en ciertas series de chips específicos de datos o prepago.',
    },
    {
      mnc: '08',
      prefix: '895608',
      operator: 'VTR Móvil',
      mainOperator: 'VTR Móvil',
      isSecondary: false,
      description: 'Poco común (la mayoría se maneja hoy bajo las series de Claro).',
    },
    {
      mnc: '05',
      prefix: '895605',
      operator: 'Nextel',
      mainOperator: 'Nextel',
      isSecondary: false,
      description: 'Obsoleto (histórico, previo a la compra que dio origen a WOM).',
    },
  ],
};
export const NETWORK_CODES_LIST: NetworkCodeItem[] = NETWORK_CODES_CATALOG.networkCodes;

export interface OperatorMatchResult {
  operator: string;
  mainOperator: string;
  mnc: string;
  fullPrefix: string;
  country: string;
  industry: string;
  description: string;
  isSecondary: boolean;
}

/**
 * Normaliza y detecta el operador a partir de un código ICCID o prefijo.
 * Soporta códigos completos (895601...), prefijos de 6 dígitos (895601),
 * prefijos sin industria (5601) o MNC directo (01, 09).
 */
export function detectOperatorFromCatalog(
  iccidOrPrefix: string,
  catalog: NetworkCodeItem[] = NETWORK_CODES_LIST
): OperatorMatchResult | null {
  if (!iccidOrPrefix) return null;
  const clean = iccidOrPrefix.replace(/\D/g, '').trim();
  if (!clean) return null;

  let mncCandidate = '';
  let fullPrefix = '';

  // 1. Caso estándar chileno: 8956xx...
  if (clean.startsWith('8956')) {
    mncCandidate = clean.slice(4, 6);
    fullPrefix = clean.slice(0, 6);
  }
  // 2. Caso prefijo país: 56xx...
  else if (clean.startsWith('56') && clean.length >= 4) {
    mncCandidate = clean.slice(2, 4);
    fullPrefix = `89${clean.slice(0, 4)}`;
  }
  // 3. Caso directo solo MNC de 2 dígitos (ej: "01", "09")
  else if (clean.length === 2) {
    mncCandidate = clean;
    fullPrefix = `8956${clean}`;
  }
  // 4. Caso general si tiene al menos 6 dígitos y empieza con 89
  else if (clean.startsWith('89') && clean.length >= 6) {
    mncCandidate = clean.slice(4, 6);
    fullPrefix = clean.slice(0, 6);
  }

  if (mncCandidate) {
    const match = catalog.find(
      (item) => item.mnc === mncCandidate || item.prefix === fullPrefix
    );

    if (match) {
      return {
        operator: match.operator,
        mainOperator: match.mainOperator,
        mnc: match.mnc,
        fullPrefix: match.prefix,
        country: `${NETWORK_CODES_CATALOG.country} (${NETWORK_CODES_CATALOG.countryCode}) 🇨🇱`,
        industry: `${NETWORK_CODES_CATALOG.industry} (${NETWORK_CODES_CATALOG.industryCode})`,
        description: match.description,
        isSecondary: match.isSecondary,
      };
    }
  }

  return null;
}
