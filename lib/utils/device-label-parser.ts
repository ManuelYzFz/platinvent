/**
 * Analizador universal de información capturada desde etiquetas, códigos de barra y códigos QR.
 *
 * Flujo:
 * 1. Escaneo primario de códigos de barra y QR.
 * 2. Escaneo de texto impreso (OCR) para extraer ID, IMEI, Serie, Marca y Modelo.
 * 3. Cotejo cruzado: si un código de barra no trae etiqueta (ej. sólo un número), se compara
 *    con el texto de la etiqueta para determinar con precisión si corresponde al IMEI o al ID.
 * 4. Plasmado fiel de la etiqueta: entrega las líneas de texto exactamente como están impresas
 *    en la etiqueta física ("tal cual"), sin transcribir ni agregar líneas inventadas.
 */

export interface ParsedDeviceLabel {
  devIDNO?: string;
  imei?: string;
  serialID?: string;
  brand?: string;
  model?: string;
  labelTextLines: string[];
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
 * Limpia caracteres de ruido periférico (marcas de recorte OCR, símbolos aislados)
 * preservando fielmente el texto de la etiqueta física tal cual.
 */
function cleanLabelLine(raw: string): string {
  let s = raw.trim();
  // Quitar símbolos de ruido técnico OCR al inicio o final de línea
  s = s.replace(/^[|§=\-_~#*\[\]\(\)\s:;\\\/]+/, '');
  s = s.replace(/[|§=\-_~#*\[\]\(\)\s:;\\\/]+$/, '');

  // Limpiar artefactos típicos de inicio de escaneo de barras ('E—— ', 'i Hi ', '2 aaa ', 'JR ic ', 'TE © ')
  s = s.replace(/^[a-zA-Z0-9]{1,2}[—–=~_-]+\s*/, '');
  s = s.replace(/^(?:i\s+Hi\s+|Hi\s+)/i, '');
  s = s.replace(/^(?:[A-Za-z]\s+(?=[0-9A-Z])|JR\s+ic\s+|[0-9]\s+[a-z]{2,4}\s+|TE\s*©\s*)/i, '');

  // Limpiar sufijos técnicos de ruido (' =', ' T=', ' 7' sueltos por artefacto de borde)
  s = s.replace(/\s+[—–=~_-]+$/, '');
  s = s.replace(/\s+[A-Za-z0-9][=~]$/, '');

  // Normalizar 1D: a ID: si Tesseract leyó el número 1 en vez de la I
  s = s.replace(/^(?:1D|ID|10|I0)\s*[:=\s#-]?/i, 'ID: ');

  // Normalizar variaciones OCR comunes de IMEI ("SO IMEI", "1ME1", "1MEI", "IME1")
  s = s.replace(/^(?:SO\s+IMEI|1ME1|1MEI|IME1|lMEI|lME1)\s*[:=\s#-]?/i, 'IMEI: ');

  // Normalizar ANATEL si tiene ruido menor de OCR
  if (/^[a-zA-Z0-9]*ANATEL/i.test(s)) s = 'ANATEL';
  if (/^(?:vax|vEQXI|vkaxi)\s+/i.test(s)) s = s.replace(/^(?:vax|vEQXI|vkaxi)\s+/i, 'vtaxi ');
  if (/Fatiafonalhna|FabrcadonaChing|paintiin/i.test(s)) {
    s = s.replace(/(?:Fatiafonalhna|FabrcadonaChing|paintiin)[^]*$/i, 'Fabricado na China');
  }

  return s.trim();
}

/**
 * Filtra líneas de ruido de escaneo que no correspondan a texto impreso real (ej. artefactos gráficos)
 */
function isUsefulLabelLine(line: string): boolean {
  const clean = cleanLabelLine(line);
  if (clean.length < 3 || clean.includes('\uFFFD')) return false;

  const digits = (clean.match(/\d/g) || []).length;

  // PRIORIDAD ABSOLUTA: si la línea contiene la señal de IMEI o 14 a 17 dígitos, SIEMPRE preservarla
  const hasImeiSignal = /(?:(?:I|1|l)\.?M\.?(?:E|3)\.?(?:I|1|l)|MEID)/i.test(clean) || digits >= 14;
  if (hasImeiSignal) {
    return true;
  }

  // Si la línea contiene la señal de ID o devIDNO legítimo, SIEMPRE preservarla
  const hasIdSignal = /(?:DEVIDNO|DEV_?ID|DEVICE\s*ID|ID\s*DEV|ID\s*DISPOSITIVO|DEV\s*NO|\b(?:ID|1D|I0|IO|10)\b)/i.test(clean);
  if (hasIdSignal && digits >= 4) {
    return true;
  }

  // Descartar backslashes o pipes (ruido de ranuras leídas en vertical)
  if (/[\\\|]/.test(clean)) return false;

  // Descartar líneas con dos o más guiones o barras de disipadores de calor
  if (/(?:[—–_=~-]\s*){2,}/.test(clean)) return false;

  // Descartar símbolos extraños de ruido de OCR
  if (/[%<>\"'{}@$*]/.test(clean)) return false;

  // Descartar líneas con alta densidad de caracteres de código de barra
  const barcodeChars = (clean.match(/[lLiItT1|!=\-_/\\]/g) || []).length;
  if (barcodeChars / clean.length > 0.38) return false;

  // Toda línea legítima de etiqueta debe contener identificadores numéricos o palabras clave
  const hasKeyword = /(?:ANATEL|VTX|SERIAL|MODEL|BRAND|MARCA|FABRICAD|CHINA|TELTONIKA|QUECLINK|SUNTECH|VTAXI|VTRAXX|CONCOX|COBAN|MEITRACK|MADE\s*IN)/i.test(clean);

  if (!hasKeyword && digits < 4) {
    return false;
  }

  // Descartar líneas donde más del 50% de palabras tienen 1-2 letras sin ser palabra clave ('Ei 8 0 Ji vi Yee 16 i')
  const words = clean.split(/\s+/);
  const shortWords = words.filter((w) => w.length <= 2).length;
  if (words.length >= 4 && shortWords / words.length > 0.5 && !hasKeyword) {
    return false;
  }

  // Descartar cadenas con 4+ letras y cero vocales
  const vowels = (clean.match(/[aeiouáéíóúAEIOU]/g) || []).length;
  const letters = (clean.match(/[a-zA-Z]/g) || []).length;
  if (letters >= 4 && vowels === 0) return false;

  return true;
}

/**
 * Lista de marcas conocidas de rastreo GPS, MDVR y telemetría vehicular
 */
const KNOWN_BRANDS: readonly string[] = [
  'vtraxx',
  'vtaxi',
  'queclink',
  'teltonika',
  'suntech',
  'concox',
  'coban',
  'meitrack',
  'howen',
  'streamax',
  'jimilab',
  'ruptela',
  'calamp',
  'sinocastel',
  'topflytech',
  'jointech',
  'mictrack',
  'xirgo',
  'atrack',
  'castel',
] as const;

/**
 * Analiza un conjunto de textos/códigos escaneados y extrae los campos de dispositivo
 */
export function parseDeviceLabelData(
  inputs: string | string[] | { barcodes?: string[]; ocrLines?: string[] }
): ParsedDeviceLabel {
  let barcodeInputs: string[] = [];
  let ocrInputs: string[] = [];

  if (inputs && typeof inputs === 'object' && !Array.isArray(inputs) && ('barcodes' in inputs || 'ocrLines' in inputs)) {
    barcodeInputs = Array.isArray(inputs.barcodes) ? inputs.barcodes : [];
    ocrInputs = Array.isArray(inputs.ocrLines) ? inputs.ocrLines : [];
  } else {
    const rawArray = Array.isArray(inputs) ? inputs : [inputs];
    const bundle = rawArray as unknown as { barcodes?: string[]; ocrLines?: string[] };
    if (Array.isArray(bundle.barcodes) && Array.isArray(bundle.ocrLines)) {
      barcodeInputs = bundle.barcodes;
      ocrInputs = bundle.ocrLines;
    } else {
      for (const item of rawArray) {
        if (!item) continue;
        const s = String(item).trim();
        if (!s) continue;
        // Si tiene saltos de línea, espacios múltiples o dos puntos, es texto OCR; si es compacto, es código de barra
        if (/[\r\n]/.test(s) || /[:=]/.test(s) || s.includes(' ') || s.length > 25) {
          ocrInputs.push(s);
        } else {
          barcodeInputs.push(s);
        }
      }
    }
  }

  // Desglosar líneas de texto tal cual fueron leídas, aplicando limpieza de artefactos
  const labelTextLines: string[] = [];
  for (const item of ocrInputs) {
    const lines = String(item).split(/[\r\n]+/);
    for (const l of lines) {
      if (!isUsefulLabelLine(l)) continue;
      const cleaned = cleanLabelLine(l);
      if (cleaned && !cleaned.includes('\uFFFD') && !labelTextLines.includes(cleaned)) {
        labelTextLines.push(cleaned);
      }
    }
  }

  let devIDNO: string | undefined;
  let imei: string | undefined;
  let serialID: string | undefined;
  let brand: string | undefined;
  let model: string | undefined;

  // ---------------------------------------------------------------------------
  // 1. Extraer del texto de la etiqueta mediante patrones explícitos
  // ---------------------------------------------------------------------------
  let ocrImei: string | undefined;
  let ocrDevId: string | undefined;
  let ocrSerial: string | undefined;
  let ocrBrand: string | undefined;
  let ocrModel: string | undefined;

  for (const line of labelTextLines) {
    const clean = line.trim();
    if (!clean) continue;

    // Si la línea tiene 14 a 17 dígitos totales (ej. un IMEI con o sin espacios internos), asignar a IMEI
    const lineDigits = clean.replace(/\D/g, '');
    if (!ocrImei && lineDigits.length >= 14 && lineDigits.length <= 17 && !/^\d{5}\d{2}\d{5}$/.test(lineDigits)) {
      ocrImei = lineDigits;
    }

    // Buscar IMEI explícito (ej. "IMEI: 864431069498410", "SO IMEI: ...", "1ME1: ...", "IME1: ...")
    if (!ocrImei) {
      const m = clean.match(/(?:(?:I|1|l)\.?M\.?(?:E|3)\.?(?:I|1|l)|MEID)\s*[:=\s#\/\-\._]*\s*([0-9\s]{14,22})/i);
      if (m && m[1]) {
        const d = m[1].replace(/\D/g, '');
        if (d.length >= 14 && d.length <= 17) {
          ocrImei = d;
        }
      }
    }

    // Buscar cualquier secuencia de 14 a 17 dígitos continuos en la línea como IMEI
    if (!ocrImei) {
      const mNum = clean.match(/\b([0-9]{14,17})\b/);
      if (mNum && mNum[1]) {
        ocrImei = mNum[1];
      }
    }

    // Buscar ID explícito (ej. "ID: 202511000001", "DEVIDNO: ...", "1D: ...", "IO: ...")
    if (!ocrDevId) {
      const m = clean.match(/(?:DEVIDNO|DEV_?ID|DEVICE\s*ID|ID\s*DEV|ID\s*DISPOSITIVO|DEV\s*NO|\b(?:ID|1D|I0|IO|10)\b)\s*[:=\s#-]?\s*([A-Za-z0-9_-]{4,25})/i);
      if (m && m[1] && !m[1].toLowerCase().startsWith('dispositivo') && !/^\d{5}-\d{2}-\d{5}$/.test(m[1])) {
        ocrDevId = m[1].trim();
      }
    }

    // Si aún no se detecta ID con prefijo, buscar identificadores numéricos de 6 a 14 dígitos que no sean IMEI ni código de homologación
    if (!ocrDevId) {
      const numMatches = clean.match(/\b([0-9]{6,14})\b/g);
      if (numMatches) {
        for (const num of numMatches) {
          if (
            num !== ocrImei &&
            (!ocrImei || !ocrImei.includes(num)) &&
            !clean.includes(`IMEI: ${num}`) &&
            !/^\d{5}-\d{2}-\d{5}$/.test(clean)
          ) {
            ocrDevId = num;
            break;
          }
        }
      }
    }

    // Buscar Serie explícita (ej. "S/N: ...", "SN: ...", "SERIAL: ...")
    if (!ocrSerial) {
      const m = clean.match(/(?:S\/?N|S\.N\.?|SN|S\/NO|SRN|SERI[EAL]|SERIAL\s*(?:NO|ID)?)\s*[:=\s#-]?\s*([A-Za-z0-9_-]{4,30})/i);
      if (m && m[1] && !/^\d{5}-\d{2}-\d{5}$/.test(m[1])) {
        ocrSerial = m[1].trim();
      }
    }

    // Buscar Marca explícita (ej. "Marca: Vtraxx", "Brand: ...")
    if (!ocrBrand) {
      const m = clean.match(/(?:BRAND|MARCA|FABRICANTE)\s*[:=\s#-]?\s*([A-Za-z0-9\s_-]{2,30})/i);
      if (m && m[1]) ocrBrand = m[1].trim();
    }

    // Buscar Modelo explícito (ej. "Modelo: GV300", "Model: ...")
    if (!ocrModel) {
      const m = clean.match(/(?:MODEL[O]?|MOD(?:ELO)?|TYPE|TIPO)\s*[:=\s#-]?\s*([A-Za-z0-9\s()_-]{2,30})/i);
      if (m && m[1]) ocrModel = m[1].trim();
    }

    // Detección de marcas conocidas en cualquier posición del texto
    if (!ocrBrand) {
      for (const kb of KNOWN_BRANDS) {
        const re = new RegExp(`\\b${kb}\\b`, 'i');
        if (re.test(clean)) {
          ocrBrand = kb === 'vtaxi' ? 'Vtaxi' : kb.charAt(0).toUpperCase() + kb.slice(1);
          break;
        }
      }
    }

    // Variaciones comunes de lectura OCR para Vtaxi / Vtraxx
    if (!ocrBrand && /(?:vtax[il1]|vtraxx|vkaxi|vEQX[1I])/i.test(clean)) {
      ocrBrand = 'Vtaxi';
    }

    // Detección de modelos de la serie VTX (MDVR)
    if (!ocrModel) {
      const vtxMatch = clean.match(/\b(V[T]?X[- ]?[0-9]{3,4}(?:\s*\([A-Za-z0-9_-]+\))?)/i);
      if (vtxMatch && vtxMatch[1]) {
        let mStr = vtxMatch[1].trim();
        mStr = mStr.replace(/^VX/i, 'VTX');
        mStr = mStr.replace(/\(8CH-AD\)/i, '(8CH-AI)');
        ocrModel = mStr;
        if (!ocrBrand) ocrBrand = 'Vtaxi';
      }
    }

    // Detección de familias de modelos estándar en rastreo vehicular
    if (!ocrModel) {
      const known = clean.match(/\b((?:FMB|FMC|FMM|TAT|GH|FM)[- ]?[0-9]{3,4}[A-Za-z]?|(?:GV|GL|GMT)[- ]?[0-9]{2,3}[A-Za-z]?|ST[- ]?[0-9]{3}[A-Za-z]?|GT[0-9]{2}[A-Za-z]?|JM[- ]?VL[0-9]{2}|VL[0-9]{2}|(?:GPS|TK)[- ]?(?:103|303|403)[A-Za-z]?)\b/i);
      if (known && known[1]) {
        ocrModel = known[1].toUpperCase();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Procesar códigos de barra y cotejarlos contra el texto de la etiqueta
  // ---------------------------------------------------------------------------
  const unassignedBarcodes: string[] = [];

  for (const rawCode of barcodeInputs) {
    const trimmed = cleanCode(rawCode);
    if (!trimmed) continue;

    // Si viene en formato JSON estructurado
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
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
          continue;
        }
      } catch {}
    }

    // Cotejo cruzado: si el código de barra coincide con el IMEI rotulado en el texto
    if (ocrImei && (trimmed === ocrImei || trimmed.includes(ocrImei) || ocrImei.includes(trimmed))) {
      imei = trimmed;
      continue;
    }

    // Cotejo cruzado: si el código de barra coincide con el ID rotulado en el texto
    if (ocrDevId && (trimmed === ocrDevId || trimmed.includes(ocrDevId) || ocrDevId.includes(trimmed))) {
      devIDNO = trimmed;
      continue;
    }

    // Cotejo cruzado: si el código de barra coincide con la Serie rotulada en el texto
    if (ocrSerial && (trimmed === ocrSerial || trimmed.includes(ocrSerial) || ocrSerial.includes(trimmed))) {
      serialID = trimmed;
      continue;
    }

    unassignedBarcodes.push(trimmed);
  }

  // Asignación de códigos de barra sin etiqueta ni cotejo directo
  for (const code of unassignedBarcodes) {
    const digitsOnly = code.replace(/\D/g, '');

    // 14 a 17 dígitos: formato internacional de IMEI
    if (!imei && digitsOnly.length >= 14 && digitsOnly.length <= 17 && /^\d+$/.test(code)) {
      imei = code;
      continue;
    }

    // 4 a 16 caracteres alfanuméricos: formato típico de devIDNO
    if (!devIDNO && /^[A-Za-z0-9_-]{4,16}$/.test(code) && code !== imei && !/^\d{5}-\d{2}-\d{5}$/.test(code)) {
      devIDNO = code;
      continue;
    }

    // 6 a 30 caracteres alfanuméricos: formato de número de serie
    if (!serialID && /^[A-Za-z0-9_-]{6,30}$/.test(code) && /[A-Za-z]/.test(code) && /\d/.test(code) && code !== devIDNO && code !== imei) {
      serialID = code;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Completar campos no encontrados en códigos de barra usando el texto plano
  // ---------------------------------------------------------------------------
  if (!imei && ocrImei) imei = ocrImei;
  if (!devIDNO && ocrDevId && ocrDevId !== imei) devIDNO = ocrDevId;
  if (!serialID && ocrSerial && ocrSerial !== devIDNO && ocrSerial !== imei) serialID = ocrSerial;
  if (!brand && ocrBrand) brand = ocrBrand;
  if (!model && ocrModel) model = ocrModel;

  // Si aún no se detecta IMEI, buscar cualquier número de 14 a 17 dígitos en las líneas o textos crudos
  if (!imei) {
    for (const item of ocrInputs) {
      // 1. Buscar número de 14 a 17 dígitos continuos
      const directMatch = item.match(/\b([0-9]{14,17})\b/);
      if (directMatch && directMatch[1] && directMatch[1] !== devIDNO) {
        imei = directMatch[1];
        break;
      }
      // 2. Buscar dígitos en líneas individuales (por si hay espacios internos como "8644310 69498410")
      const lines = String(item).split(/[\r\n]+/);
      for (const line of lines) {
        const d = line.replace(/\D/g, '');
        if (d.length >= 14 && d.length <= 17 && d !== devIDNO && !/^\d{5}\d{2}\d{5}$/.test(d)) {
          imei = d;
          break;
        }
      }
      if (imei) break;
    }
  }

  // Si devIDNO fue erróneamente asignado con los 14-17 dígitos del IMEI, corregirlo
  if (devIDNO && !imei && devIDNO.length >= 14 && devIDNO.length <= 17 && /^\d+$/.test(devIDNO)) {
    imei = devIDNO;
    devIDNO = undefined;
  }
  if (devIDNO && imei && devIDNO === imei) {
    devIDNO = undefined;
  }

  // Si aún no se detecta ID, asignar el primer código de barra libre no asignado
  if (!devIDNO) {
    for (const b of barcodeInputs) {
      const trimmed = b.trim();
      if (trimmed !== imei && trimmed !== serialID && !/^\d{5}-\d{2}-\d{5}$/.test(trimmed) && /^[A-Za-z0-9_-]{4,20}$/.test(trimmed)) {
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
    labelTextLines,
    rawList: labelTextLines,
    hasAnyData,
  };
}
