import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Camera, 
  Scan, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  UploadCloud, 
  ShieldAlert,
  Loader2 
} from 'lucide-react';
import { normalizeICCID } from '@/lib/utils/sim-utils';
import { useTranslation } from '@/lib/i18n';
import { decodeBarcodeFromImage } from '@/lib/utils/barcode-decoder';

interface ScanSearchSimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (code: string) => void;
}

export default function ScanSearchSimModal({
  isOpen,
  onClose,
  onScanResult,
}: ScanSearchSimModalProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [scanSuccessCode, setScanSuccessCode] = useState<string | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState<boolean>(false);

  const html5QrcodeRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const cancelCameraStartRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const hasProcessedRef = useRef<boolean>(false);
  const startSessionIdRef = useRef<number>(0);
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const stopMediaTracks = () => {
    const readerElement = document.getElementById('search-simcard-reader');
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

  const stopCamera = useCallback(async () => {
    cancelCameraStartRef.current = true;
    ++startSessionIdRef.current;
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
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

    const readerElement = document.getElementById('search-simcard-reader');
    if (readerElement) {
      readerElement.innerHTML = '';
    }

    isStoppingRef.current = false;
    setIsScanning(false);
  }, []);

  const handleModalClose = useCallback(async () => {
    await stopCamera();
    resetState();
    onClose();
  }, [stopCamera, onClose]);

  const startCamera = useCallback(async () => {
    cancelCameraStartRef.current = false;
    const sessionId = ++startSessionIdRef.current;
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }
    setCameraError(null);
    setScanSuccessCode(null);
    setIsScanning(true);

    startTimeoutRef.current = setTimeout(async () => {
      if (cancelCameraStartRef.current || sessionId !== startSessionIdRef.current) {
        return;
      }

      const elem = document.getElementById('search-simcard-reader');
      if (!elem) {
        setIsScanning(false);
        return;
      }

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

        if (cancelCameraStartRef.current || sessionId !== startSessionIdRef.current) {
          return;
        }

        const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const qrBoxSize = isMobileDevice
          ? { width: 260, height: 180 }
          : { width: 340, height: 220 };

        const config = {
          fps: 15,
          qrbox: qrBoxSize,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
        };

        const html5Qrcode = new Html5Qrcode('search-simcard-reader', {
          verbose: false,
          formatsToSupport: config.formatsToSupport,
        });
        html5QrcodeRef.current = html5Qrcode;

        let cameraStarted = false;

        try {
          await html5Qrcode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              if (hasProcessedRef.current) return;
              hasProcessedRef.current = true;

              const clean = decodedText.trim();
              const normalized = normalizeICCID(clean);
              setScanSuccessCode(normalized);
              setIsScanning(false);
              void stopCamera();
              onScanResult(normalized);
              setTimeout(() => {
                onClose();
              }, 600);
            },
            () => {}
          );
          cameraStarted = true;
        } catch (firstErr) {
          console.warn('Fallo intento de cámara con facingMode environment:', firstErr);
        }

        if (!cameraStarted && (!cancelCameraStartRef.current && sessionId === startSessionIdRef.current)) {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) {
            throw new Error('No se detectaron cámaras en este dispositivo.');
          }
          const backCam = cameras.find((c) =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('trasera') ||
            c.label.toLowerCase().includes('rear')
          );
          const cameraId = backCam ? backCam.id : cameras[0].id;

          await html5Qrcode.start(
            cameraId,
            config,
            (decodedText) => {
              if (hasProcessedRef.current) return;
              hasProcessedRef.current = true;

              const clean = decodedText.trim();
              const normalized = normalizeICCID(clean);
              setScanSuccessCode(normalized);
              setIsScanning(false);
              void stopCamera();
              onScanResult(normalized);
              setTimeout(() => {
                onClose();
              }, 600);
            },
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
  }, [onClose, onScanResult, stopCamera]);

  // Bloquear scroll de fondo mientras el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    let ignore = false;

    if (isOpen) {
      const initScanner = async () => {
        await Promise.resolve();
        if (!ignore) {
          setCameraError(null);
          setScanSuccessCode(null);
          setManualCode('');
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
  }, [isOpen, startCamera, stopCamera]);


  // Escanear foto capturada o imagen seleccionada (funciona 100% sobre HTTP y celulares)
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingFile(true);
    setCameraError(null);

    try {
      const rawText = await decodeBarcodeFromImage(file, 'search-simcard-file-helper');
      const clean = rawText.trim();
      const normalized = normalizeICCID(clean);
      setScanSuccessCode(normalized);
      setIsScanning(false);
      void stopCamera();
      onScanResult(normalized);
      setTimeout(() => { onClose(); }, 600);
    } catch (err) {
      console.warn('No se pudo decodificar la imagen de SIM:', err);
      setCameraError('No se detectó un código legible en la imagen. Intenta tomarla más de cerca con buena iluminación o escribe el ICCID abajo.');
    } finally {
      setIsAnalyzingFile(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanResult(normalizeICCID(manualCode.trim()));
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-1.5 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) void handleModalClose(); }}
    >
      <div className="relative w-[96vw] max-w-xl rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border border-gray-100 max-h-[92vh] overflow-y-auto notranslate" translate="no">

        {/* Inputs ocultos para cámara y galería */}
        <div id="search-simcard-file-helper" style={{ position: 'fixed', top: -9999, left: -9999, width: 800, height: 600, opacity: 0, pointerEvents: 'none' }} />
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
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#3a435d]">{t('modal_escanear_sim')}</h3>
              <p className="text-xs text-gray-500">{t('modal_escanear_desc')}</p>
            </div>
          </div>
          <button
            onClick={() => void handleModalClose()}
            type="button"
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor de Cámara */}
        <div className="space-y-4">
          <div className="relative w-full bg-slate-900 rounded-2xl overflow-hidden min-h-60 sm:min-h-70 flex flex-col items-center justify-center border-2 border-indigo-300 shadow-inner">
            <div id="search-simcard-reader" className="w-full h-full min-h-60 sm:min-h-70" />

            {cameraError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 text-white gap-3">
                <ShieldAlert className="w-12 h-12 text-amber-400" />
                <p className="text-sm font-bold text-amber-300">{t('camara_no_disponible')}</p>
                <p className="text-xs text-gray-300 max-w-xs">{cameraError}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{t('tomar_foto_camara')}</span>
                  </button>
                  <button
                    onClick={startCamera}
                    type="button"
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                  >
                    {t('reintentar')}
                  </button>
                </div>
              </div>
            )}

            {!isScanning && !cameraError && !scanSuccessCode && !isAnalyzingFile && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 text-white gap-3 z-10">
                <Camera className="w-12 h-12 text-indigo-400 animate-pulse" />
                <p className="text-xs font-semibold text-gray-300">{t('modal_preparando_camara')}</p>
                <button
                  onClick={startCamera}
                  type="button"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  {t('modal_reiniciar_camara')}
                </button>
              </div>
            )}

            {isAnalyzingFile && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-indigo-950/90 text-white p-6 text-center gap-3">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                <p className="text-sm font-bold text-indigo-200">{t('analizando_codigo_foto')}</p>
              </div>
            )}

            {isScanning && (
              <>
                <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-black/75 px-3 py-1.5 rounded-full text-white text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{t('modal_apunta_codigo')}</span>
                </div>
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                  <div className="w-[84%] max-w-105 h-[68%] max-h-55 border-2 border-dashed border-emerald-400/80 rounded-2xl shadow-[0_0_15px_rgba(52,211,153,0.3)] relative">
                    <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br" />
                  </div>
                </div>
              </>
            )}

            {scanSuccessCode && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-950/90 text-white p-6 text-center gap-2 animate-in zoom-in-95">
                <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                <h4 className="text-base font-extrabold text-emerald-200">{t('modal_codigo_escaneado')}</h4>
                <p className="font-mono text-sm font-bold bg-emerald-900/60 px-4 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-300">
                  {scanSuccessCode}
                </p>
                <p className="text-xs text-emerald-300/80 mt-1">{t('modal_aplicando_filtro')}</p>
              </div>
            )}
          </div>

          {/* BOTONES: TOMAR FOTO O ABRIR GALERÍA */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isAnalyzingFile}
              className="flex-1 flex items-center justify-center gap-2.5 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-200" />
              <span>{t('tomar_foto_camara')}</span>
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={isAnalyzingFile}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50 border border-slate-200 shadow-2xs"
              title="Abrir galería de fotos"
            >
              <UploadCloud className="w-4 h-4 text-indigo-600" />
              <span>{t('buscar_imagen_galeria')}</span>
            </button>
          </div>

          {cameraError && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Búsqueda manual */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs font-bold text-[#3a435d] mb-1.5">
              {t('modal_camara_fallback')}
            </label>
            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder={t('modal_buscar_placeholder_sim')}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-xs text-[#3a435d] outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                {t('modal_buscar')}
              </button>
            </form>
          </div>
        </div>

        {/* Pie */}
        <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => void handleModalClose()}
            type="button"
            className="px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
          >
            {t('modal_cancelar')}
          </button>
        </div>
      </div>
    </div>
  );
}
