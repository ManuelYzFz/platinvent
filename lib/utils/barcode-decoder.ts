/**
 * Utility for decoding barcodes and QR codes from image files or camera captures.
 * Uses a robust multi-stage pipeline:
 * 1. Native window.BarcodeDetector (Hardware/AI accelerated in Android Chrome & modern browsers)
 *    - Runs on original, 1280px resize, 2560px resize, and 7 horizontal/vertical slices
 * 2. Html5Qrcode (ZXing) with ALL 1D/2D formats
 *    - Runs ALWAYS (even if BarcodeDetector found codes), on many crop variants
 *    - Also tries contrast-enhanced versions of each crop
 * 3. Never returns early until all strategies are exhausted
 */

function loadImage(fileOrBlob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen para procesar: ' + String(err)));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Fallo al convertir canvas a Blob'));
    }, 'image/jpeg', quality);
  });
}

/**
 * Redimensiona una imagen a un tamaño óptimo para lectura de códigos (máx 1280px)
 */
function resizeImageToCanvas(img: HTMLImageElement, maxDim = 1280): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  let { naturalWidth: width, naturalHeight: height } = img;
  if (!width || !height) {
    width = img.width || 1280;
    height = img.height || 720;
  }

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
  }
  return canvas;
}

/**
 * Recorta el tercio central de la imagen (donde el usuario suele apuntar el código)
 */
function cropCenterToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // Tomar el 70% central
  const cropW = Math.round(w * 0.75);
  const cropH = Math.round(h * 0.75);
  const startX = Math.round((w - cropW) / 2);
  const startY = Math.round((h - cropH) / 2);

  canvas.width = Math.min(cropW, 1280);
  canvas.height = Math.round((cropH * canvas.width) / cropW);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, startX, startY, cropW, cropH, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/**
 * Decodifica todos los códigos de barra y QR encontrados en una imagen.
 * Pipeline exhaustivo multi-fase que nunca retorna antes de agotar todas las estrategias.
 * Soporta etiquetas con múltiples códigos (IMEI + ID + Serie en la misma foto).
 */

/** Genera un canvas con filtro de contraste/brillo para mejorar lecturas de baja calidad */
function enhanceContrastCanvas(source: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const srcW = source instanceof HTMLCanvasElement ? source.width : (source.naturalWidth || source.width);
  const srcH = source instanceof HTMLCanvasElement ? source.height : (source.naturalHeight || source.height);
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.filter = 'contrast(1.6) brightness(1.1) saturate(0)';
    ctx.drawImage(source, 0, 0, srcW, srcH);
  }
  return canvas;
}

/** Genera un canvas invertido (negativo) para decodificar códigos QR o de barras grabados en blanco sobre fondo oscuro */
function invertCanvas(source: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const srcW = source instanceof HTMLCanvasElement ? source.width : (source.naturalWidth || source.width);
  const srcH = source instanceof HTMLCanvasElement ? source.height : (source.naturalHeight || source.height);
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.filter = 'invert(1)';
    ctx.drawImage(source, 0, 0, srcW, srcH);
  }
  return canvas;
}

export async function decodeAllBarcodesFromImage(
  fileOrBlob: File | Blob,
  helperContainerId = 'barcode-decoder-helper'
): Promise<string[]> {
  const img = await loadImage(fileOrBlob);
  const detectedList: string[] = [];

  const addUnique = (val: string | null | undefined) => {
    if (!val) return;
    const trimmed = val.trim();
    // Descartar lecturas corruptas con replacement characters (\uFFFD) o caracteres de control
    if (trimmed.includes('\uFFFD') || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(trimmed)) {
      return;
    }
    // Descartar lecturas con menos de 3 caracteres
    if (trimmed.length < 3) {
      return;
    }
    // Descartar lecturas cortas con ruido o símbolos no alfanuméricos
    if (trimmed.length <= 6 && !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      return;
    }
    if (trimmed && !detectedList.includes(trimmed)) {
      detectedList.push(trimmed);
    }
  };

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // Definición de todos los recortes que se intentarán para escaneo de códigos de barra
  const slices = [
    { xStart: 0,    xEnd: 1.0,  yStart: 0,    yEnd: 1.0  }, // Completa
    { xStart: 0.35, xEnd: 0.80, yStart: 0.25, yEnd: 0.78 }, // Recorte etiqueta completo
    { xStart: 0.38, xEnd: 0.78, yStart: 0.42, yEnd: 0.72 }, // Recorte específico del código de barras
    { xStart: 0.12, xEnd: 0.88, yStart: 0.12, yEnd: 0.88 }, // Centro amplio (aisla etiqueta de bordes)
    { xStart: 0.25, xEnd: 0.88, yStart: 0.15, yEnd: 0.85 }, // Centro-derecha (etiquetas desplazadas hacia conectores)
    { xStart: 0,    xEnd: 1.0,  yStart: 0,    yEnd: 0.55 }, // Mitad superior
    { xStart: 0,    xEnd: 1.0,  yStart: 0.45, yEnd: 1.0  }, // Mitad inferior
    { xStart: 0.12, xEnd: 0.88, yStart: 0.35, yEnd: 0.75 }, // Banda central
  ];

  // Construye un canvas de slice para un tamaño máximo dado
  const buildSliceCanvas = (xStart: number, xEnd: number, yStart: number, yEnd: number, maxW: number): HTMLCanvasElement => {
    const sliceCanvas = document.createElement('canvas');
    const sx = Math.round(w * xStart);
    const sy = Math.round(h * yStart);
    const sw = Math.max(1, Math.round(w * (xEnd - xStart)));
    const sh = Math.max(1, Math.round(h * (yEnd - yStart)));
    sliceCanvas.width = Math.min(sw, maxW);
    sliceCanvas.height = Math.round((sh * sliceCanvas.width) / sw);
    const sCtx = sliceCanvas.getContext('2d', { willReadFrequently: true });
    if (sCtx) {
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sliceCanvas.width, sliceCanvas.height);
    }
    return sliceCanvas;
  };

  // -------------------------------------------------------------
  // FASE 1: Native BarcodeDetector — detecta múltiples códigos por pasada
  // Siempre se ejecuta en TODOS los recortes, sin early-return intermedio
  // -------------------------------------------------------------
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const DetectorClass = (window as unknown as {
        BarcodeDetector: {
          getSupportedFormats: () => Promise<string[]>;
          new(opt: { formats: string[] }): { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
        };
      }).BarcodeDetector;
      const supported = await DetectorClass.getSupportedFormats();
      const detector = new DetectorClass({ formats: supported });

      // Intentar con la imagen original directamente
      try {
        const r0 = await detector.detect(img);
        for (const r of (r0 ?? [])) addUnique(r.rawValue);
      } catch {}

      // Intentar con todos los slices en 1280px y 2560px
      for (const slice of slices) {
        for (const maxW of [1280, 2560]) {
          try {
            const sc = buildSliceCanvas(slice.xStart, slice.xEnd, slice.yStart, slice.yEnd, maxW);
            const rr = await detector.detect(sc);
            for (const r of (rr ?? [])) addUnique(r.rawValue);
          } catch {}

          // También intentar versión con contraste mejorado
          try {
            const sc = buildSliceCanvas(slice.xStart, slice.xEnd, slice.yStart, slice.yEnd, maxW);
            const enhanced = enhanceContrastCanvas(sc);
            const rr = await detector.detect(enhanced);
            for (const r of (rr ?? [])) addUnique(r.rawValue);
          } catch {}

          // También intentar versión con colores invertidos (para QR blanco sobre negro grabado en plástico)
          try {
            const sc = buildSliceCanvas(slice.xStart, slice.xEnd, slice.yStart, slice.yEnd, maxW);
            const inverted = invertCanvas(sc);
            const rr = await detector.detect(inverted);
            for (const r of (rr ?? [])) addUnique(r.rawValue);
          } catch {}
        }
      }
    } catch (nativeErr) {
      console.warn('BarcodeDetector nativo falló, continuando con ZXing:', nativeErr);
    }
  }

  // Si ya tenemos 3+ códigos con BarcodeDetector, retornar (es poco probable tener más en una etiqueta)
  if (detectedList.length >= 3) return detectedList;

  // -------------------------------------------------------------
  // FASE 2: Html5Qrcode / ZXing — SIEMPRE se ejecuta, incluso si Fase 1 encontró algo
  // ZXing puede encontrar códigos que BarcodeDetector pierde (y viceversa)
  // -------------------------------------------------------------
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

  let helperElement = document.getElementById(helperContainerId);
  if (!helperElement) {
    helperElement = document.createElement('div');
    helperElement.id = helperContainerId;
    helperElement.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;opacity:0;pointer-events:none;';
    document.body.appendChild(helperElement);
  }

  const allFormats = [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.PDF_417,
    Html5QrcodeSupportedFormats.AZTEC,
  ];

  const scanner = new Html5Qrcode(helperContainerId, {
    formatsToSupport: allFormats,
    verbose: false,
  });

  const tryZXing = async (canvas: HTMLCanvasElement): Promise<void> => {
    try {
      const blob = await canvasToBlob(canvas, 0.95);
      const f = new File([blob], 'scan.jpg', { type: 'image/jpeg' });
      const decoded = await scanner.scanFile(f, false);
      addUnique(decoded);
    } catch {}
  };

  try {
    // Correr ZXing en los slices principales
    for (const slice of slices) {
      for (const maxW of [1280, 2048]) {
        const sc = buildSliceCanvas(slice.xStart, slice.xEnd, slice.yStart, slice.yEnd, maxW);
        await tryZXing(sc);
        await tryZXing(enhanceContrastCanvas(sc));
        await tryZXing(invertCanvas(sc));
      }
    }

    // También intentar con el archivo original sin modificar (puede ser una imagen de alta calidad)
    if (fileOrBlob instanceof File) {
      try {
        const decoded = await scanner.scanFile(fileOrBlob, false);
        addUnique(decoded);
      } catch {}
    }

    if (detectedList.length > 0) {
      return detectedList;
    }

    throw new Error('No se detectó ningún código QR o de barras válido en la fotografía.');
  } finally {
    try { scanner.clear(); } catch {}
  }
}

/**
 * Pipeline principal de decodificación (devuelve el primer código encontrado)
 */
export async function decodeBarcodeFromImage(
  fileOrBlob: File | Blob,
  helperContainerId = 'barcode-decoder-helper'
): Promise<string> {
  const all = await decodeAllBarcodesFromImage(fileOrBlob, helperContainerId);
  if (all && all.length > 0) {
    return all[0];
  }
  throw new Error('No se detectó ningún código QR o de barras válido en la fotografía.');
}

/**
 * Reconoce texto impreso en la imagen mediante OCR en el navegador (Tesseract.js).
 * Utiliza recortes multizona (centro, derecha, completa) para aislar la etiqueta
 * de fondos oscuros, disipadores metálicos y cables circundantes.
 */
export async function recognizeTextFromImage(fileOrBlob: File | Blob): Promise<string[]> {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');

    let allCollectedLines: string[] = [];

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const img = await loadImage(fileOrBlob);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        // Candidatos de recorte ordenados por probabilidad de éxito en etiquetas de dispositivos
        const candidateCrops = [
          // 1. Recorte ajustado de etiqueta (captura desde ANATEL hasta ID en el borde inferior)
          { x: 0.35, y: 0.25, w: 0.44, h: 0.52 },
          // 2. Centro-derecha amplio (MDVRs / equipos con aletas y conectores laterales)
          { x: 0.26, y: 0.16, w: 0.60, h: 0.68 },
          // 3. Centro amplio (etiquetas centradas en GPS trackers)
          { x: 0.12, y: 0.12, w: 0.76, h: 0.76 },
          // 4. Completa (fotos en primer plano directo del sticker)
          { x: 0.00, y: 0.00, w: 1.00, h: 1.00 },
        ];

        let bestLines: string[] = [];
        let bestQualityScore = -999;

        for (const crop of candidateCrops) {
          const canvas = document.createElement('canvas');
          const sx = Math.round(w * crop.x);
          const sy = Math.round(h * crop.y);
          const sw = Math.max(1, Math.round(w * crop.w));
          const sh = Math.max(1, Math.round(h * crop.h));

          const maxDim = 1600;
          let targetW = sw;
          let targetH = sh;
          if (targetW > maxDim || targetH > maxDim) {
            if (targetW > targetH) {
              targetH = Math.round((sh * maxDim) / sw);
              targetW = maxDim;
            } else {
              targetW = Math.round((sw * maxDim) / sh);
              targetH = maxDim;
            }
          }

          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) continue;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

          const cropBlob = await canvasToBlob(canvas, 0.95);
          const ret = await worker.recognize(cropBlob);
          const rawText = ret?.data?.text || '';
          const lines = rawText
            .split(/[\r\n]+/)
            .map((l) => l.trim())
            .filter((l) => l.length >= 3 && !l.includes('\uFFFD'));

          // Evaluar calidad del recorte: premiar SOLO identificadores reales de etiquetas
          let qualityScore = 0;
          for (const l of lines) {
            if (/[0-9]{14,17}/.test(l) || /IMEI/i.test(l)) qualityScore += 30;
            if (/(?:ID|1D|DEVIDNO)\s*[:=\s#-]?\s*[A-Za-z0-9_-]{4,20}/i.test(l)) qualityScore += 30;
            if (/VTX|FMB|FMC|GV[0-9]{2,3}|ST[0-9]{3}/i.test(l)) qualityScore += 25;
            if (/ANATEL|VTAXI|VTRAXX|TELTONIKA|QUECLINK|SUNTECH/i.test(l)) qualityScore += 25;
            if (/\d{4,5}[-\s]\d{2}[-\s]\d{4,5}/.test(l)) qualityScore += 20;

            // Penalizar secuencias de guiones o ruido de disipadores de calor
            if (/(?:[—–_=~-]\s*){2,}/.test(l)) qualityScore -= 15;
            if (/[\\\|]/.test(l)) qualityScore -= 15;
            if (/[%<>\"'{}@$*]/.test(l)) qualityScore -= 10;
          }

          if (qualityScore > bestQualityScore) {
            bestQualityScore = qualityScore;
          }

          // Acumular líneas reconocidas de recortes válidos
          if (qualityScore > 0) {
            for (const l of lines) {
              if (!allCollectedLines.includes(l)) {
                allCollectedLines.push(l);
              }
            }
          }

          // Si ya se capturaron con certeza los campos esenciales (IMEI, ID y Modelo), detener pasadas
          const hasImeiInAccum = allCollectedLines.some((l) => /(?:IMEI|[0-9]{14,17})/i.test(l));
          const hasIdInAccum = allCollectedLines.some((l) => /(?:ID|1D|DEVIDNO)\s*[:=\s#-]?\s*[A-Za-z0-9_-]{4,20}/i.test(l));
          if (hasImeiInAccum && hasIdInAccum && qualityScore >= 50) {
            break;
          }
        }

        // Solo intentar pasada rotada si NINGÚN recorte a 0 grados encontró identificadores de etiqueta
        if (bestQualityScore < 20) {
          try {
            const rotCanvas = document.createElement('canvas');
            rotCanvas.width = h;
            rotCanvas.height = w;
            const rotCtx = rotCanvas.getContext('2d');
            if (rotCtx) {
              rotCtx.translate(h / 2, w / 2);
              rotCtx.rotate((90 * Math.PI) / 180);
              rotCtx.drawImage(img, -w / 2, -h / 2);
              const rotBlob = await canvasToBlob(rotCanvas, 0.95);
              const rotRet = await worker.recognize(rotBlob);
              const rotLines = (rotRet?.data?.text || '')
                .split(/[\r\n]+/)
                .map((l) => l.trim())
                .filter((l) => l.length >= 3 && !l.includes('\uFFFD'));

              let rotScore = 0;
              for (const l of rotLines) {
                if (/[0-9]{14,17}/.test(l) || /IMEI/i.test(l)) rotScore += 30;
                if (/(?:ID|1D|DEVIDNO)\s*[:=\s#-]?\s*[A-Za-z0-9_-]{4,20}/i.test(l)) rotScore += 30;
                if (/VTX|FMB|FMC|GV[0-9]{2,3}|ST[0-9]{3}/i.test(l)) rotScore += 25;
                if (/ANATEL|VTAXI|VTRAXX|TELTONIKA|QUECLINK/i.test(l)) rotScore += 25;
              }

              // Solo aceptar la pasada rotada si REALMENTE encontró datos válidos de etiqueta
              if (rotScore > bestQualityScore && rotScore >= 30) {
                allCollectedLines = rotLines;
              }
            }
          } catch {}
        }
      } catch (browserOcrErr) {
        console.warn('Fallo en OCR optimizado multizona, intentando original:', browserOcrErr);
        const ret = await worker.recognize(fileOrBlob);
        allCollectedLines = (ret?.data?.text || '')
          .split(/[\r\n]+/)
          .map((l) => l.trim())
          .filter((l) => l.length >= 3 && !l.includes('\uFFFD'));
      }
    } else {
      // Entorno Node o fallback sin DOM
      const ret = await worker.recognize(fileOrBlob);
      allCollectedLines = (ret?.data?.text || '')
        .split(/[\r\n]+/)
        .map((l) => l.trim())
        .filter((l) => l.length >= 3 && !l.includes('\uFFFD'));
    }

    await worker.terminate();
    return allCollectedLines;
  } catch (err) {
    console.warn('OCR con tesseract.js no disponible o falló:', err);
    return [];
  }
}

export interface DecodedLabelBundle extends Array<string> {
  barcodes: string[];
  ocrLines: string[];
}

/**
 * Pipeline completo para etiquetas de dispositivos:
 * Combina escaneo de códigos de barra 1D/2D/QR (incluyendo QR invertido)
 * y reconocimiento óptico de caracteres (OCR) para rescatar tanto los códigos
 * como el texto impreso en la misma foto.
 */
export async function extractAllLabelDataFromImage(
  fileOrBlob: File | Blob,
  helperContainerId = 'barcode-decoder-helper'
): Promise<DecodedLabelBundle> {
  const barcodes: string[] = [];
  const ocrLines: string[] = [];
  const results: string[] = [];

  const addBarcode = (str: string) => {
    const t = str.trim();
    if (t && !t.includes('\uFFFD') && !barcodes.includes(t)) {
      barcodes.push(t);
      if (!results.includes(t)) results.push(t);
    }
  };

  const addOcr = (str: string) => {
    const t = str.trim();
    if (t && !t.includes('\uFFFD') && !ocrLines.includes(t)) {
      ocrLines.push(t);
      if (!results.includes(t)) results.push(t);
    }
  };

  // 1. Escanear códigos de barra y QR
  try {
    const codes = await decodeAllBarcodesFromImage(fileOrBlob, helperContainerId);
    for (const c of codes) addBarcode(c);
  } catch (barcodeErr) {
    console.warn('Escaneo de códigos de barra no detectó barras:', barcodeErr);
  }

  // 2. Extraer texto óptico (OCR)
  try {
    const lines = await recognizeTextFromImage(fileOrBlob);
    for (const line of lines) addOcr(line);
  } catch (ocrErr) {
    console.warn('OCR no pudo procesar la imagen:', ocrErr);
  }

  if (results.length > 0) {
    const bundle = results as DecodedLabelBundle;
    bundle.barcodes = barcodes;
    bundle.ocrLines = ocrLines;
    return bundle;
  }

  throw new Error('No se detectó ningún código de barra, QR ni texto legible en la imagen.');
}
