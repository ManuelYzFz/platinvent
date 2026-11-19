/**
 * Analizador inteligente de información capturada desde etiquetas, códigos de barra y códigos QR de dispositivos.
 * Extrae devIDNO, IMEI, Serial ID, Marca y Modelo analizando múltiples códigos, patrones con prefijo o JSON.
 */

export interface ParsedDeviceLabel {
  devIDNO?: string;
  imei?: string;
  serialID?: string;
  brand?: string;
  model?: string;
  rawList: string[];
  hasAnyData: boolean;
}

/**
 * Normaliza y limpia un string de código de barra o texto escaneado
 */
function cleanCode(str: string): string {
  return str.replace(/[\r\n\t]/g, ' ').trim();
}

/**
 * Analiza un conjunto de textos/códigos escaneados y extrae los campos de dispositivo
 */
export function parseDeviceLabelData(inputs: string | string[]): ParsedDeviceLabel {
  const rawList: string[] = [];
  const items = Array.isArray(inputs) ? inputs : [inputs];

  for (const item of items) {
    if (!item) continue;
    const trimmed = String(item).trim();
    if (!trimmed) continue;
    if (!rawList.includes(trimmed)) {
      rawList.push(trimmed);
    }
  }

  let devIDNO: string | undefined;
  let imei: string | undefined;
  let serialID: string | undefined;
  let brand: string | undefined;
  let model: string | undefined;

  // 1. Revisar si algún input es JSON estructurado
  for (const raw of rawList) {
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (!devIDNO && (parsed.devIDNO || parsed.devidno || parsed.id || parsed.deviceId)) {
            devIDNO = String(parsed.devIDNO ?? parsed.devidno ?? parsed.id ?? parsed.deviceId).trim();
          }
          if (!imei && (parsed.imei || parsed.IMEI)) {
            imei = String(parsed.imei ?? parsed.IMEI).trim();
          }
          if (!serialID && (parsed.serialID || parsed.serialId || parsed.serial_id || parsed.sn || parsed.serial)) {
            serialID = String(parsed.serialID ?? parsed.serialId ?? parsed.serial_id ?? parsed.sn ?? parsed.serial).trim();
          }
          if (!brand && (parsed.brand || parsed.deviceBrand)) {
            brand = String(parsed.brand ?? parsed.deviceBrand).trim();
          }
          if (!model && (parsed.model || parsed.deviceModel)) {
            model = String(parsed.model ?? parsed.deviceModel).trim();
          }
        }
      } catch {}
    }
  }

  // 2. Extraer mediante patrones con etiquetas explícitas (IMEI:, ID:, S/N:, etc.)
  for (const raw of rawList) {
    const lines = raw.split(/[\r\n;|,]+/);
    for (const line of lines) {
      const clean = line.trim();
      if (!clean) continue;

      // Buscar IMEI explícito
      if (!imei) {
        const imeiMatch = clean.match(/(?:IMEI|I\.M\.E\.I\.?)\s*[:=\s#-]?\s*([0-9]{14,16})/i);
        if (imeiMatch && imeiMatch[1]) {
          imei = imeiMatch[1].trim();
        }
      }

      // Buscar Serial explícito
      if (!serialID) {
        const snMatch = clean.match(/(?:S\/N|S\.N\.|SN|SERIAL\s*NO|SERIAL\s*ID|SERIAL|SERIE)\s*[:=\s#-]?\s*([A-Za-z0-9_-]{4,30})/i);
        if (snMatch && snMatch[1]) {
          serialID = snMatch[1].trim();
        }
      }

      // Buscar ID explícito
      if (!devIDNO) {
        const idMatch = clean.match(/(?:DEVIDNO|DEV_ID|DEVICE\s*ID|ID\s*DEV|ID\s*DISPOSITIVO|DISPOSITIVO|DEV\s*NO|ID)\s*[:=\s#-]?\s*([A-Za-z0-9_-]{4,20})/i);
        if (idMatch && idMatch[1] && !idMatch[1].toLowerCase().startsWith('dispositivo')) {
          const val = idMatch[1].trim();
          if (val !== imei) {
            devIDNO = val;
          }
        }
      }

      // Buscar Marca/Modelo explícitos si vienen en el texto
      if (!brand) {
        const brandMatch = clean.match(/(?:BRAND|MARCA)\s*[:=\s#-]?\s*([A-Za-z0-9\s_-]{2,30})/i);
        if (brandMatch && brandMatch[1]) brand = brandMatch[1].trim();
      }
      if (!model) {
        const modelMatch = clean.match(/(?:MODEL|MODELO)\s*[:=\s#-]?\s*([A-Za-z0-9\s_-]{2,30})/i);
        if (modelMatch && modelMatch[1]) model = modelMatch[1].trim();
      }

      // Detectar Marca y Modelo cuando vienen en una línea combinada (ej. Vtraxx-M5504, vtaxi VTX 800)
      if (!brand || !model) {
        const comboMatch = clean.match(/^(vtraxx|vtaxi|coban|teltonika|queclink|concox|meitrack)[-_ ]+([A-Za-z0-9\s()_-]{2,25})$/i);
        if (comboMatch && comboMatch[1] && comboMatch[2]) {
          if (!brand) {
            brand = comboMatch[1].charAt(0).toUpperCase() + comboMatch[1].slice(1).toLowerCase();
          }
          if (!model) {
            model = comboMatch[2].trim();
          }
        }
      }
    }
  }

  // 3. Heurística para códigos sin etiqueta explícita (códigos de barra numéricos o alfanuméricos puros)
  for (const raw of rawList) {
    const trimmed = cleanCode(raw);
    const digitsOnly = trimmed.replace(/\D/g, '');

    // Si es un número de 14 a 17 dígitos (formato estándar de IMEI o IMEI SV) y aún no tenemos IMEI
    if (!imei && (digitsOnly.length >= 14 && digitsOnly.length <= 17) && /^\d+$/.test(trimmed)) {
      imei = digitsOnly;
      continue;
    }

    // Si aún no tenemos devIDNO y el valor es un identificador típico (4 a 14 caracteres, ej. 02050041)
    if (!devIDNO && /^[A-Za-z0-9_-]{4,14}$/.test(trimmed) && trimmed !== imei && trimmed !== serialID) {
      if (digitsOnly.length >= 14 && digitsOnly.length <= 17) {
        if (!imei) imei = digitsOnly;
      } else {
        devIDNO = trimmed;
        continue;
      }
    }

    // Si aún no tenemos serialID y es alfanumérico diferente (con letras y dígitos)
    if (!serialID && /^[A-Za-z0-9_-]{6,30}$/.test(trimmed) && trimmed !== devIDNO && trimmed !== imei) {
      if (/[A-Za-z]/.test(trimmed) && /\d/.test(trimmed)) {
        serialID = trimmed;
      }
    }
  }

  // 4. Si aún no tenemos devIDNO pero tenemos un código válido no asignado a IMEI ni Serial
  if (!devIDNO) {
    for (const raw of rawList) {
      const trimmed = cleanCode(raw);
      if (
        trimmed !== imei &&
        trimmed !== serialID &&
        trimmed.length >= 4 &&
        trimmed.length <= 20 &&
        !trimmed.includes('\uFFFD') &&
        /^[A-Za-z0-9_-]+$/.test(trimmed)
      ) {
        devIDNO = trimmed;
        break;
      }
    }
  }

  const hasAnyData = Boolean(devIDNO || imei || serialID || brand || model);

  return {
    devIDNO,
    imei,
    serialID,
    brand,
    model,
    rawList,
    hasAnyData,
  };
}
