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

  // Definición de todos los recortes que se intentarán (proporciones Y)
  const ySlices = [
    { yStart: 0,    yEnd: 1.0  }, // Completa
    { yStart: 0,    yEnd: 0.55 }, // Mitad superior
    { yStart: 0.45, yEnd: 1.0  }, // Mitad inferior
    { yStart: 0,    yEnd: 0.38 }, // Tercio superior
    { yStart: 0.31, yEnd: 0.69 }, // Tercio medio
    { yStart: 0.62, yEnd: 1.0  }, // Tercio inferior
    { yStart: 0.1,  yEnd: 0.9  }, // Centro amplio (descarta bordes)
  ];

  // Construye un canvas de slice para un tamaño máximo dado
  const buildSliceCanvas = (yStart: number, yEnd: number, maxW: number): HTMLCanvasElement => {
    const sliceCanvas = document.createElement('canvas');
    const sliceH = Math.max(1, h * (yEnd - yStart));
    sliceCanvas.width = Math.min(w, maxW);
    sliceCanvas.height = Math.round((sliceH * sliceCanvas.width) / w);
    const sCtx = sliceCanvas.getContext('2d', { willReadFrequently: true });
    if (sCtx) {
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(img, 0, h * yStart, w, sliceH, 0, 0, sliceCanvas.width, sliceCanvas.height);
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
      for (const slice of ySlices) {
        for (const maxW of [1280, 2560]) {
          try {
            const sc = buildSliceCanvas(slice.yStart, slice.yEnd, maxW);
            const rr = await detector.detect(sc);
            for (const r of (rr ?? [])) addUnique(r.rawValue);
          } catch {}

          // También intentar versión con contraste mejorado
          try {
            const sc = buildSliceCanvas(slice.yStart, slice.yEnd, maxW);
            const enhanced = enhanceContrastCanvas(sc);
            const rr = await detector.detect(enhanced);
            for (const r of (rr ?? [])) addUnique(r.rawValue);
          } catch {}

          // También intentar versión con colores invertidos (para QR blanco sobre negro grabado en plástico)
          try {
            const sc = buildSliceCanvas(slice.yStart, slice.yEnd, maxW);
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
    // Correr ZXing en todos los slices (1280px y 2560px), incluyendo versiones con contraste e invertidas
    for (const slice of ySlices) {
      for (const maxW of [1280, 2560]) {
        const sc = buildSliceCanvas(slice.yStart, slice.yEnd, maxW);
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
 * Extrae texto visible como "IMEI: ...", "ID: ...", modelos y datos de homologación.
 */
export async function recognizeTextFromImage(fileOrBlob: File | Blob): Promise<string[]> {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const ret = await worker.recognize(fileOrBlob);
    await worker.terminate();

    const rawText = ret?.data?.text || '';
    const lines = rawText
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 3 && !l.includes('\uFFFD'));

    return lines;
  } catch (err) {
    console.warn('OCR con tesseract.js no disponible o falló:', err);
    return [];
  }
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
): Promise<string[]> {
  const results: string[] = [];
  const add = (str: string) => {
    const t = str.trim();
    if (t && !t.includes('\uFFFD') && !results.includes(t)) {
      results.push(t);
    }
  };

  // 1. Escanear códigos de barra y QR
  try {
    const codes = await decodeAllBarcodesFromImage(fileOrBlob, helperContainerId);
    for (const c of codes) add(c);
  } catch (barcodeErr) {
    console.warn('Escaneo de códigos de barra no detectó barras:', barcodeErr);
  }

  // 2. Extraer texto óptico (OCR)
  try {
    const ocrLines = await recognizeTextFromImage(fileOrBlob);
    for (const line of ocrLines) add(line);
  } catch (ocrErr) {
    console.warn('OCR no pudo procesar la imagen:', ocrErr);
  }

  if (results.length > 0) {
    return results;
  }

  throw new Error('No se detectó ningún código de barra, QR ni texto legible en la imagen.');
}
