import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Camera, 
  Scan, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  HardDrive, 
  Barcode, 
  UploadCloud, 
  ShieldAlert,
  Loader2 
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { decodeBarcodeFromImage } from '@/lib/utils/barcode-decoder';
import { useScrollLock } from '@/lib/utils/useScrollLock';

interface ScanSearchDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (query: string) => void;
}

export default function ScanSearchDeviceModal({
  isOpen,
  onClose,
  onScanResult,
}: ScanSearchDeviceModalProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [scanSuccessCode, setScanSuccessCode] = useState<string | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState<boolean>(false);

  const html5QrcodeRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const cancelCameraStartRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const startSessionIdRef = useRef<number>(0);
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const stopMediaTracks = () => {
    const readerElement = document.getElementById('search-device-reader');
    if (readerElement) {
      const videos = readerElement.querySelectorAll('video');
      videos.forEach((video) => {
        const stream = video.srcObject as MediaStream | null;
        if (stream && typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
        }
        video.srcObject = null;
      });
    }
  };

  const resetState = () => {
    setCameraError(null);
    setScanSuccessCode(null);
    setManualCode('');
    setIsScanning(false);
    setIsAnalyzingFile(false);
  };

  const handleModalClose = async () => {
    await stopCamera();
    resetState();
    onClose();
  };

  const stopCamera = async () => {
    cancelCameraStartRef.current = true;
    ++startSessionIdRef.current;
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    stopMediaTracks();

    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    const instance = html5QrcodeRef.current;
    html5QrcodeRef.current = null;

    if (instance) {
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already under transition') && !msg.includes('not running')) {
          console.warn('Error al detener la cámara:', err);
        }
      }

      try {
        instance.clear();
      } catch {
        // Ignore clear errors if DOM element is unmounted
      }
    }

    stopMediaTracks();

    const readerElement = document.getElementById('search-device-reader');
    if (readerElement) {
      readerElement.innerHTML = '';
    }

    isStoppingRef.current = false;
    setIsScanning(false);
  };

  const parseScannedText = (raw: string): string => {
    const trimmed = raw.trim();
    // 1. Verificar si es un JSON generado con { devIDNO, imei }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.devIDNO) return String(parsed.devIDNO).trim();
        if (parsed.imei) return String(parsed.imei).trim();
      } catch {
        // fallback
      }
    }
    return trimmed;
  };

  const startCamera = async () => {
    cancelCameraStartRef.current = false;
    const sessionId = ++startSessionIdRef.current;
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }
    setCameraError(null);
    setScanSuccessCode(null);
    setIsScanning(true);

    startTimeoutRef.current = setTimeout(async () => {
      if (cancelCameraStartRef.current || sessionId !== startSessionIdRef.current) return;

      try {
        const readerElement = document.getElementById('search-device-reader');
        if (!readerElement || cancelCameraStartRef.current || sessionId !== startSessionIdRef.current) return;

        stopMediaTracks();
        readerElement.innerHTML = '';

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelCameraStartRef.current || sessionId !== startSessionIdRef.current) return;

        if (html5QrcodeRef.current) {
          try {
            if (html5QrcodeRef.current.isScanning) {
              await html5QrcodeRef.current.stop();
            }
            html5QrcodeRef.current.clear();
          } catch {
            // ignore
          }
          html5QrcodeRef.current = null;
        }

        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Los navegadores móviles exigen HTTPS para transmitir video en vivo. Pulsa "Tomar foto con la cámara" para escanear.');
          setIsScanning(false);
          return;
        }

        const html5Qrcode = new Html5Qrcode('search-device-reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
          verbose: false,
        });

        if (cancelCameraStartRef.current || sessionId !== startSessionIdRef.current) {
          try { html5Qrcode.clear(); } catch {}
          return;
        }

        html5QrcodeRef.current = html5Qrcode;

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.floor(Math.min(viewfinderWidth * 0.88, 420));
            const height = Math.floor(Math.min(viewfinderHeight * 0.75, 220));
            return { width, height };
          },
          aspectRatio: 1.4,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        };

        const onScanSuccess = async (decodedText: string) => {
          const targetQuery = parseScannedText(decodedText);
          setScanSuccessCode(targetQuery);
          setIsScanning(false);
          await stopCamera();
          onScanResult(targetQuery);
          closeTimeoutRef.current = setTimeout(() => { void handleModalClose(); }, 500);
        };

        try {
          await html5Qrcode.start(
            { facingMode: 'environment' },
            config,
            onScanSuccess,
            () => {}
          );
        } catch (envErr) {
          if (cancelCameraStartRef.current || sessionId !== startSessionIdRef.current) return;
          console.warn('Fallo facingMode environment, intentando facingMode user:', envErr);
          await html5Qrcode.start(
            { facingMode: 'user' },
            config,
            onScanSuccess,
            () => {}
          );
        }

        if (cancelCameraStartRef.current || sessionId !== startSessionIdRef.current) {
          try {
            if (html5Qrcode.isScanning) {
              await html5Qrcode.stop();
            }
            html5Qrcode.clear();
          } catch {}
          stopMediaTracks();
          if (html5QrcodeRef.current === html5Qrcode) {
            html5QrcodeRef.current = null;
          }
        }
      } catch (err: unknown) {
        if (!cancelCameraStartRef.current && sessionId === startSessionIdRef.current) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('already under transition')) {
            console.error('Error al iniciar escáner de cámara:', err);
            setCameraError('No se pudo activar el video en vivo (los navegadores requieren HTTPS o permisos de cámara). Pulsa "Tomar foto con la cámara" abajo para escanear.');
          }
          setIsScanning(false);
          void stopCamera();
        }
      }
    }, 150);
  };

  // Escanear archivo de imagen capturado o seleccionado (funciona 100% sobre HTTP en móviles)
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingFile(true);
    setCameraError(null);

    try {
      const rawText = await decodeBarcodeFromImage(file, 'search-device-file-helper');
      const targetQuery = parseScannedText(rawText);
      setScanSuccessCode(targetQuery);
      setIsScanning(false);
      void stopCamera();
      onScanResult(targetQuery);
      closeTimeoutRef.current = setTimeout(() => { handleModalClose(); }, 600);
    } catch (err) {
      console.warn('Error al decodificar la imagen:', err);
      setCameraError('No se detectó un código legible en la imagen. Intenta tomarla más de cerca con buena iluminación o escribe el código abajo.');
    } finally {
      setIsAnalyzingFile(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  useScrollLock(isOpen);

  useEffect(() => {
    let ignore = false;

    if (isOpen) {
      const initScanner = async () => {
        await Promise.resolve();
        if (!ignore) {
          void startCamera();
        }
      };
      void initScanner();
    } else {
      void stopCamera();
    }
    return () => {
      ignore = true;
      void stopCamera();
    };
  }, [isOpen]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      const targetQuery = parseScannedText(manualCode.trim());
      onScanResult(targetQuery);
      handleModalClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-1.5 sm:p-4 animate-in fade-in duration-200 overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => { if (e.target === e.currentTarget) void handleModalClose(); }}
    >
      <div className="relative w-[96vw] max-w-xl rounded-2xl bg-white dark:bg-[#162032] p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-white/14 max-h-[92vh] overflow-y-auto notranslate" translate="no">

        {/* Inputs ocultos para cámara y galería */}
        <div id="search-device-file-helper" style={{ position: 'fixed', top: -9999, left: -9999, width: 800, height: 600, opacity: 0, pointerEvents: 'none' }} />
        <input 
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileScan}
          className="hidden"
        />
        <input 
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileScan}
          className="hidden"
        />

        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00A3E0]/10 dark:bg-[#00A3E0]/15 text-[#00A3E0] border border-[#00A3E0]/20">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{t('escanear_buscar_dispositivo')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('escanear_dispositivo_desc')}</p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            type="button"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor de Cámara */}
        <div className="space-y-4">
          <div className="relative w-full bg-slate-950 rounded-2xl overflow-hidden min-h-60 sm:min-h-70 flex flex-col items-center justify-center border-2 border-[#00A3E0]/40 shadow-inner">
            <div id="search-device-reader" className="w-full h-full min-h-60 sm:min-h-70" />

            {cameraError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 text-white gap-3">
                <ShieldAlert className="w-12 h-12 text-amber-400" />
                <p className="text-sm font-bold text-amber-300">{t('camara_no_disponible')}</p>
                <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-4 py-2 bg-[#00A3E0] hover:bg-[#0092c8] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{t('tomar_foto_camara')}</span>
                  </button>
                  <button
                    onClick={startCamera}
                    type="button"
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                  >
                    {t('reintentar')}
                  </button>
                </div>
              </div>
            )}

            {!isScanning && !cameraError && !scanSuccessCode && !isAnalyzingFile && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 text-white gap-3 z-10">
                <Camera className="w-12 h-12 text-[#00A3E0] animate-pulse" />
                <p className="text-xs font-semibold text-slate-300">{t('modal_preparando_camara') || 'Preparando cámara...'}</p>
                <button
                  onClick={startCamera}
                  type="button"
                  className="px-4 py-2 bg-[#00A3E0] hover:bg-[#0092c8] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {t('modal_reiniciar_camara') || 'Reiniciar Cámara'}
                </button>
              </div>
            )}

            {isAnalyzingFile && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 text-white p-6 text-center gap-3">
                <Loader2 className="w-10 h-10 text-[#00A3E0] animate-spin" />
                <p className="text-sm font-bold text-slate-200">{t('analizando_codigo_foto')}</p>
              </div>
            )}

            {isScanning && (
              <>
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-black/75 px-3 py-1.5 rounded-full text-white text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#00A3E0] animate-ping" />
                  <span>{t('apunta_qr_o_barras')}</span>
                </div>
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                  <div className="w-[84%] max-w-105 h-[68%] max-h-55 border-2 border-dashed border-[#00A3E0]/80 rounded-2xl shadow-[0_0_15px_rgba(0,163,224,0.3)] relative">
                    <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-[#00A3E0] rounded-tl" />
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-[#00A3E0] rounded-tr" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-[#00A3E0] rounded-bl" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-[#00A3E0] rounded-br" />
                  </div>
                </div>
              </>
            )}

            {scanSuccessCode && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 text-white p-6 text-center gap-2 animate-in zoom-in-95">
                <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                <h4 className="text-base font-extrabold text-emerald-300">{t('codigo_detectado')}</h4>
                <p className="font-mono text-sm font-bold bg-[#121927] px-4 py-1.5 rounded-lg border border-[#00A3E0]/40 text-[#00A3E0]">
                  {scanSuccessCode}
                </p>
                <p className="text-xs text-slate-300">{t('buscando_dispositivo')}</p>
              </div>
            )}
          </div>

          {/* BOTONES: TOMAR FOTO O ABRIR GALERÍA */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isAnalyzingFile}
              className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 bg-[#00A3E0] hover:bg-[#0092c8] active:scale-98 text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span>{t('tomar_foto_camara')}</span>
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={isAnalyzingFile}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-[#121927] dark:hover:bg-[#1E293B] active:scale-98 text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-white/10 shadow-2xs"
              title="Abrir galería de imágenes o archivos"
            >
              <UploadCloud className="w-4 h-4 text-[#00A3E0]" />
              <span>{t('buscar_imagen_galeria')}</span>
            </button>
          </div>

          {cameraError && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Búsqueda Manual / Código */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <HardDrive className="w-4 h-4 text-[#00A3E0]" />
              <span>{t('preferir_escribir_devidno')}</span>
            </div>

            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Ej. 4142434445 o 864521041234567"
                  className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#121927] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#00A3E0] hover:bg-[#0092c8] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{t('modal_buscar') || 'Buscar'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Pie */}
        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-end">
          <button
            onClick={handleModalClose}
            type="button"
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#121927] dark:hover:bg-[#1E293B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-bold transition-colors cursor-pointer"
          >
            {t('modal_cancelar') || 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
