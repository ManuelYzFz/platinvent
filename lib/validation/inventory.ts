/**
 * Validación de datos de entrada según los tipos de las tablas MySQL
 * (companies, vehicles, simcards, devices) y los estándares de cada dato:
 *  - IMEI: 3GPP TS 23.003 (15 dígitos con dígito verificador Luhn)
 *  - ICCID: ITU-T E.118 (prefijo 89, 19–20 dígitos)
 *  - Números telefónicos / MSISDN: ITU-T E.164 (sólo dígitos, máx. 15 con código de país)
 * Se usa en el servidor antes de escribir y en los formularios antes de enviar.
 */

export const MAX_LENGTHS = {
  company: { name: 100 },
  vehicle: { plate_number: 20, brand: 50, model: 50, vehicle_type: 50 },
  simcard: {
    simcard: 100,
    card_number: 20,
    plan_name: 100,
    city: 100,
    card_merchant: 100,
    msisdn: 100,
    service_provider: 100,
  },
  device: { devidno: 50, imei: 50, serial_id: 50, brand: 50, model: 50 },
} as const;

export const IMEI_LENGTH = 15;
export const ICCID_MAX_LENGTH = 20;
/** E.164: máximo 15 dígitos incluyendo el código de país */
export const E164_MAX_LENGTH = 15;

/** Tipos de dispositivo soportados por la plataforma */
export const DEVICE_TYPES = { GPS: 5, MDVR: 7 } as const;

/** Límite de una columna TEXT de MySQL (bytes; en latin1 1 carácter = 1 byte) */
const TEXT_MAX = 65535;
const INT_MAX = 2147483647;

export class ValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(' '));
    this.name = 'ValidationError';
  }
}

// Las tablas usan charset latin1 (cp1252 en MySQL): caracteres fuera de él no se pueden guardar
const CP1252_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const isLatin1 = (s: string) => [...s].every((ch) => ch.charCodeAt(0) <= 0xff || CP1252_EXTRAS.has(ch));

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Algoritmo de Luhn (ISO/IEC 7812), usado como dígito verificador del IMEI */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Reglas por campo
// ---------------------------------------------------------------------------

const LETTERS = 'A-Za-zÀ-ÖØ-öø-ÿ';
/** Nombres comerciales: letras, números, espacios y puntuación habitual */
const NAME_PATTERN = new RegExp(`^[${LETTERS}0-9][${LETTERS}0-9 .,&'()/+#_-]*$`);
const NAME_HINT = 'sólo puede contener letras, números, espacios y los signos . , & \' ( ) / + # - _';
/** Identificadores técnicos: sin espacios */
const IDENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const IDENT_HINT = 'sólo puede contener letras, números y los signos . _ / - (sin espacios)';

interface FieldRule {
  label: string;
  max: number;
  pattern?: RegExp;
  hint?: string;
  /** Se aplica antes de validar; el valor normalizado es el que se guarda */
  normalize?: (s: string) => string;
  /** Validación adicional; devuelve el mensaje de error o null */
  check?: (s: string) => string | null;
}

const digitsOnly = (label: string) => ({ pattern: /^\d+$/, hint: 'sólo puede contener números', label });

export const FIELD_RULES = {
  companyName: { label: 'El nombre de la empresa', max: MAX_LENGTHS.company.name, pattern: NAME_PATTERN, hint: NAME_HINT },

  plate: {
    label: 'La patente',
    max: MAX_LENGTHS.vehicle.plate_number,
    normalize: (s: string) => s.toUpperCase().replace(/\s+/g, ' '),
    pattern: /^[A-Z0-9]+(?:[- ][A-Z0-9]+)*$/,
    hint: 'sólo puede contener letras y números (separados opcionalmente por un guion)',
    check: (s: string) => {
      const n = s.replace(/[- ]/g, '').length;
      return n < 4 || n > 10 ? 'La patente debe tener entre 4 y 10 letras o números.' : null;
    },
  },

  devidno: { label: 'El device No', max: MAX_LENGTHS.device.devidno, pattern: IDENT_PATTERN, hint: IDENT_HINT },
  serialId: { label: 'El número de serie', max: MAX_LENGTHS.device.serial_id, pattern: IDENT_PATTERN, hint: IDENT_HINT },
  deviceBrand: { label: 'La marca', max: MAX_LENGTHS.device.brand, pattern: NAME_PATTERN, hint: NAME_HINT },
  deviceModel: { label: 'El modelo', max: MAX_LENGTHS.device.model, pattern: NAME_PATTERN, hint: NAME_HINT },

  imei: {
    ...digitsOnly('El IMEI'),
    max: IMEI_LENGTH,
    check: (s: string) =>
      s.length !== IMEI_LENGTH
        ? `El IMEI debe tener exactamente ${IMEI_LENGTH} dígitos (tiene ${s.length}).`
        : !passesLuhn(s)
        ? 'El IMEI no es válido (el dígito verificador no coincide). Revisa que esté bien escrito.'
        : null,
  },

  iccid: {
    ...digitsOnly('El código simCard (ICCID)'),
    label: 'El código simCard (ICCID)',
    max: ICCID_MAX_LENGTH,
    normalize: (s: string) => s.replace(/[\s+-]/g, ''),
    check: (s: string) =>
      !s.startsWith('89')
        ? 'El código simCard (ICCID) debe comenzar con 89.'
        : s.length < 19
        ? `El código simCard (ICCID) debe tener 19 o 20 dígitos (tiene ${s.length}).`
        : null,
  },

  phone: {
    ...digitsOnly('El número de tarjeta'),
    max: E164_MAX_LENGTH,
    normalize: (s: string) => s.replace(/[\s+()-]/g, ''),
    check: (s: string) =>
      s.length < 8 ? `El número de tarjeta debe incluir el código de país (8 a ${E164_MAX_LENGTH} dígitos).` : null,
  },

  msisdn: {
    ...digitsOnly('El MSISDN'),
    max: E164_MAX_LENGTH,
    normalize: (s: string) => s.replace(/[\s+()-]/g, ''),
    check: (s: string) =>
      s.length < 8 ? `El MSISDN debe incluir el código de país (8 a ${E164_MAX_LENGTH} dígitos).` : null,
  },

  planName: { label: 'El plan', max: MAX_LENGTHS.simcard.plan_name, pattern: NAME_PATTERN, hint: NAME_HINT },
  city: {
    label: 'La ciudad',
    max: MAX_LENGTHS.simcard.city,
    pattern: new RegExp(`^[${LETTERS}][${LETTERS} .'-]*$`),
    hint: 'sólo puede contener letras, espacios y los signos . \' -',
  },
  cardMerchant: { label: 'El comerciante', max: MAX_LENGTHS.simcard.card_merchant, pattern: NAME_PATTERN, hint: NAME_HINT },
  serviceProvider: { label: 'El proveedor de servicio', max: MAX_LENGTHS.simcard.service_provider, pattern: NAME_PATTERN, hint: NAME_HINT },

  /** Referencias a una SIM existente desde el formulario de dispositivo (sólo búsqueda) */
  simRef: { ...digitsOnly('La SIM'), max: MAX_LENGTHS.simcard.simcard, normalize: (s: string) => s.replace(/[\s+-]/g, '') },
  cardRef: { ...digitsOnly('El número de tarjeta'), max: MAX_LENGTHS.simcard.card_number, normalize: (s: string) => s.replace(/[\s+()-]/g, '') },
} satisfies Record<string, FieldRule>;

export type FieldKey = keyof typeof FIELD_RULES;

/**
 * Acumula errores campo a campo y devuelve los valores ya convertidos al tipo de la columna.
 */
export class FieldValidator {
  readonly errors: string[] = [];

  /** VARCHAR(max) / TEXT sin formato específico. Devuelve null si viene vacío. */
  string(label: string, v: unknown, max: number, opts: { required?: boolean } = {}): string | null {
    if (isBlank(v)) {
      if (opts.required) this.errors.push(`${label} es obligatorio.`);
      return null;
    }
    if (typeof v !== 'string' && typeof v !== 'number') {
      this.errors.push(`${label} debe ser texto.`);
      return null;
    }
    const s = String(v).trim();
    if (s.length > max) {
      this.errors.push(`${label} no puede superar los ${max} caracteres (tiene ${s.length}).`);
      return null;
    }
    if (!isLatin1(s)) {
      this.errors.push(`${label} contiene caracteres no permitidos (emojis o símbolos especiales).`);
      return null;
    }
    return s;
  }

  /** Campo con regla de FIELD_RULES: largo, caracteres permitidos y formato estándar. */
  field(key: FieldKey, v: unknown, opts: { required?: boolean } = {}): string | null {
    const rule: FieldRule = FIELD_RULES[key];
    if (isBlank(v)) {
      if (opts.required) this.errors.push(`${rule.label} es obligatorio.`);
      return null;
    }
    if (typeof v !== 'string' && typeof v !== 'number') {
      this.errors.push(`${rule.label} debe ser texto.`);
      return null;
    }
    const s = rule.normalize ? rule.normalize(String(v).trim()) : String(v).trim();
    if (rule.pattern && !rule.pattern.test(s)) {
      this.errors.push(`${rule.label} ${rule.hint}.`);
      return null;
    }
    if (s.length > rule.max) {
      this.errors.push(`${rule.label} no puede superar los ${rule.max} caracteres (tiene ${s.length}).`);
      return null;
    }
    const extra = rule.check?.(s);
    if (extra) {
      this.errors.push(extra);
      return null;
    }
    return s;
  }

  text(label: string, v: unknown): string | null {
    return this.string(label, v, TEXT_MAX);
  }

  /** INT. Acepta number o string de dígitos; `allowed` restringe a un conjunto de valores. */
  int(
    label: string,
    v: unknown,
    opts: { required?: boolean; min?: number; allowed?: readonly number[] } = {}
  ): number | null {
    if (isBlank(v)) {
      if (opts.required) this.errors.push(`${label} es obligatorio.`);
      return null;
    }
    const n = typeof v === 'number' ? v : /^-?\d+$/.test(String(v).trim()) ? Number(String(v).trim()) : NaN;
    if (!Number.isInteger(n) || Math.abs(n) > INT_MAX) {
      this.errors.push(`${label} debe ser un número entero.`);
      return null;
    }
    if (opts.min !== undefined && n < opts.min) {
      this.errors.push(`${label} debe ser mayor o igual a ${opts.min}.`);
      return null;
    }
    if (opts.allowed && !opts.allowed.includes(n)) {
      this.errors.push(`${label} no es válido (valores permitidos: ${opts.allowed.join(', ')}).`);
      return null;
    }
    return n;
  }

  /**
   * BOOLEAN (TINYINT(1)): sólo 0/1/true/false.
   * `aliases` permite valores propios de la UI (p. ej. 'active' → 1).
   */
  bool(
    label: string,
    v: unknown,
    opts: { required?: boolean; aliases?: Record<string, 0 | 1> } = {}
  ): 0 | 1 | null {
    if (isBlank(v)) {
      if (opts.required) this.errors.push(`${label} es obligatorio.`);
      return null;
    }
    const key = String(v).trim().toLowerCase();
    if (opts.aliases && key in opts.aliases) return opts.aliases[key];
    if (v === true || key === '1' || key === 'true') return 1;
    if (v === false || key === '0' || key === 'false') return 0;
    this.errors.push(`${label} debe ser verdadero o falso (1 / 0).`);
    return null;
  }

  /** DATE: acepta 'YYYY-MM-DD' (o ISO con hora) o timestamp en ms. Devuelve 'YYYY-MM-DD'. */
  date(label: string, v: unknown, opts: { required?: boolean } = {}): string | null {
    if (isBlank(v)) {
      if (opts.required) this.errors.push(`${label} es obligatorio.`);
      return null;
    }
    const raw = String(v).trim();
    let ymd: string | null = null;

    if (typeof v === 'number' || /^\d{10,}$/.test(raw)) {
      const d = new Date(Number(raw));
      if (!isNaN(d.getTime())) ymd = d.toISOString().slice(0, 10);
    } else {
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
      if (m) {
        const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const dt = new Date(Date.UTC(y, mo - 1, d));
        // Rechaza fechas inexistentes como 2026-02-30
        if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) {
          ymd = `${m[1]}-${m[2]}-${m[3]}`;
        }
      }
    }

    if (!ymd || ymd < '1000-01-01' || ymd > '9999-12-31') {
      this.errors.push(`${label} debe ser una fecha válida (AAAA-MM-DD).`);
      return null;
    }
    return ymd;
  }

  /** Lanza ValidationError si se acumuló algún error. */
  assert() {
    if (this.errors.length) throw new ValidationError(this.errors);
  }
}

/**
 * Validación para formularios: aplica las mismas reglas que el servidor.
 * Devuelve el primer mensaje de error o null si todo es válido.
 */
export function firstFieldError(fields: [key: FieldKey, value: unknown][]): string | null {
  const v = new FieldValidator();
  for (const [key, value] of fields) v.field(key, value);
  return v.errors[0] ?? null;
}
