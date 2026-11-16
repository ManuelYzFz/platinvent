/**
 * Utility for decoding barcodes and QR codes from image files or camera captures.
 * Uses a robust multi-stage pipeline:
 * 1. Native window.BarcodeDetector (Hardware/AI accelerated in Android Chrome & modern browsers)
 * 2. High-performance downsampling via HTML5 Canvas (resolves ZXing pixel-grid resolution limits on 12MP+ photos)
 * 3. Html5Qrcode with all 1D/2D formats enabled
 * 4. Center-crop fallback for focused scanning
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
 * Pipeline principal de decodificación
 */
export async function decodeBarcodeFromImage(
  fileOrBlob: File | Blob,
  helperContainerId = 'barcode-decoder-helper'
): Promise<string> {
  // 1. Cargar imagen en memoria
  const img = await loadImage(fileOrBlob);

  // -------------------------------------------------------------
  // FASE 1: Native BarcodeDetector (Chrome Android / Edge / Opera)
  // Utiliza el motor MLKit acelerado por hardware de Google
  // -------------------------------------------------------------
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const DetectorClass = (window as unknown as { BarcodeDetector: { getSupportedFormats: () => Promise<string[]>; new(opt: { formats: string[] }): { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> } } }).BarcodeDetector;
      const supported = await DetectorClass.getSupportedFormats();
      const detector = new DetectorClass({ formats: supported });

      // Intento 1A: Con la imagen original completa
      const resultsOriginal = await detector.detect(img);
      if (resultsOriginal && resultsOriginal.length > 0 && resultsOriginal[0].rawValue) {
        return resultsOriginal[0].rawValue.trim();
      }

      // Intento 1B: Con la imagen redimensionada / normalizada
      const resizedCanvas = resizeImageToCanvas(img, 1280);
      const resultsResized = await detector.detect(resizedCanvas);
      if (resultsResized && resultsResized.length > 0 && resultsResized[0].rawValue) {
        return resultsResized[0].rawValue.trim();
      }

      // Intento 1C: Con recorte central
      const croppedCanvas = cropCenterToCanvas(img);
      const resultsCropped = await detector.detect(croppedCanvas);
      if (resultsCropped && resultsCropped.length > 0 && resultsCropped[0].rawValue) {
        return resultsCropped[0].rawValue.trim();
      }
    } catch (nativeErr) {
      console.warn('BarcodeDetector nativo no pudo procesar la imagen, pasando a ZXing/Html5Qrcode:', nativeErr);
    }
  }

  // -------------------------------------------------------------
  // FASE 2: Html5Qrcode / ZXing con todos los formatos habilitados
  // -------------------------------------------------------------
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

  // Asegurar que el elemento helper exista en el DOM con dimensiones reales para decodificación
  let helperElement = document.getElementById(helperContainerId);
  if (!helperElement) {
    helperElement = document.createElement('div');
    helperElement.id = helperContainerId;
    helperElement.style.position = 'fixed';
    helperElement.style.top = '-9999px';
    helperElement.style.left = '-9999px';
    helperElement.style.width = '800px';
    helperElement.style.height = '600px';
    helperElement.style.opacity = '0';
    helperElement.style.pointerEvents = 'none';
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
  ];

  const scanner = new Html5Qrcode(helperContainerId, {
    formatsToSupport: allFormats,
    verbose: false,
  });

  try {
    // Intento 2A: Imagen redimensionada a 1280px (óptimo para matriz ZXing)
    try {
      const resizedCanvas = resizeImageToCanvas(img, 1280);
      const resizedBlob = await canvasToBlob(resizedCanvas, 0.95);
      const fileFromBlob = new File([resizedBlob], 'photo_resized.jpg', { type: 'image/jpeg' });
      const decoded = await scanner.scanFile(fileFromBlob, false);
      if (decoded && decoded.trim()) {
        return decoded.trim();
      }
    } catch {
      // continuar al siguiente intento
    }

    // Intento 2B: Imagen redimensionada a 800px (para códigos con módulos grandes o fotos con algo de desenfoque)
    try {
      const scaledCanvas = resizeImageToCanvas(img, 800);
      const scaledBlob = await canvasToBlob(scaledCanvas, 0.95);
      const fileScaled = new File([scaledBlob], 'photo_scaled.jpg', { type: 'image/jpeg' });
      const decoded = await scanner.scanFile(fileScaled, false);
      if (decoded && decoded.trim()) {
        return decoded.trim();
      }
    } catch {
      // continuar
    }

    // Intento 2C: Recorte central al 75%
    try {
      const croppedCanvas = cropCenterToCanvas(img);
      const croppedBlob = await canvasToBlob(croppedCanvas, 0.95);
      const fileCropped = new File([croppedBlob], 'photo_crop.jpg', { type: 'image/jpeg' });
      const decoded = await scanner.scanFile(fileCropped, false);
      if (decoded && decoded.trim()) {
        return decoded.trim();
      }
    } catch {
      // continuar
    }

    // Intento 2D: Archivo original sin alterar
    if (fileOrBlob instanceof File) {
      const decodedOriginal = await scanner.scanFile(fileOrBlob, false);
      if (decodedOriginal && decodedOriginal.trim()) {
        return decodedOriginal.trim();
      }
    }

    throw new Error('No se detectó ningún código QR o de barras válido en la fotografía.');
  } finally {
    try {
      scanner.clear();
    } catch {
      // ignore
    }
  }
}
