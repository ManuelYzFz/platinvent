import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Loader2,
  Copy,
  Check,
  Plus,
  RotateCcw,
  ImageIcon
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { decodeBarcodeFromImage, decodeAllBarcodesFromImage } from '@/lib/utils/barcode-decoder';
import { useScrollLock } from '@/lib/utils/useScrollLock';
import type { DeviceRecord } from '@/lib/types/inventory';

interface ScanSearchDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (query: string) => void;
  devices?: DeviceRecord[];
  onOpenCreate?: (initialCode?: string) => void;
}

export default function ScanSearchDeviceModal({
  isOpen,
  onClose,
  onScanResult,
  devices = [],
  onOpenCreate,
}: ScanSearchDeviceModalProps) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [scanSuccessCode, setScanSuccessCode] = useState<string | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);

  const html5QrcodeRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const cancelCameraStartRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const startSessionIdRef = useRef<number>(0);
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
    setCopied(false);
    setUploadedFile(null);
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
        instance.clear();
      } catch {
        // Fallback
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

  // Buscar coincidencia en la lista de dispositivos existente
  const matchedDevice = useMemo(() => {
    if (!scanSuccessCode || !devices || devices.length === 0) return null;
    const clean = scanSuccessCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return (
      devices.find((d) => {
        const imeiClean = String(d.imei ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const idnoClean = String(d.devIDNO ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const serialClean = String(d.serialID ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return (
          (imeiClean && imeiClean === clean) ||
          (idnoClean && idnoClean === clean) ||
          (serialClean && serialClean === clean)
        );
      }) || null
    );
  }, [scanSuccessCode, devices]);

  const handleCopyCode = () => {
    if (!scanSuccessCode) return;
    navigator.clipboard.writeText(scanSuccessCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startCamera = async () => {
    cancelCameraStartRef.current = false;
    const sessionId = ++startSessionIdRef.current;
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }
    setCameraError(null);
    setScanSuccessCode(null);
    setCopied(false);
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
          setCameraError('Los navegadores moviles exigen HTTPS para transmitir video en vivo. Pulsa "Tomar foto con la camara" para escanear.');
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
          aspectRatio: 1.777778,
        };

        const onScanSuccess = async (decodedText: string) => {
          if (cancelCameraStartRef.current || sessionId !== startSessionIdRef.current) return;
          const targetQuery = parseScannedText(decodedText);
          setScanSuccessCode(targetQuery);
          setIsScanning(false);
          await stopCamera();
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
            console.error('Error al iniciar escaner de camara:', err);
            setCameraError('No se pudo activar el video en vivo (los navegadores requieren HTTPS o permisos de camara). Pulsa "Tomar foto con la camara" abajo para escanear.');
          }
          setIsScanning(false);
          void stopCamera();
        }
      }
    }, 150);
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile({ name: file.name, size: file.size });
    setIsAnalyzingFile(true);
    setCameraError(null);

    try {
      const rawCodes = await decodeAllBarcodesFromImage(file, 'search-device-file-helper');
      if (!rawCodes || rawCodes.length === 0) {
        throw new Error('No se detectó un código legible.');
      }

      // Si hay múltiples códigos (ej: etiqueta con ID y IMEI), priorizar el que coincida con algún dispositivo existente
      let selectedCode = rawCodes[0];
      if (devices && devices.length > 0) {
        for (const code of rawCodes) {
          const target = parseScannedText(code);
          const clean = target.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const match = devices.find((d) => {
            const imeiClean = String(d.imei ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const idnoClean = String(d.devIDNO ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const serialClean = String(d.serialID ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            return (
              (imeiClean && imeiClean === clean) ||
              (idnoClean && idnoClean === clean) ||
              (serialClean && serialClean === clean)
            );
          });
          if (match) {
            selectedCode = target;
            break;
          }
        }
      }

      const targetQuery = parseScannedText(selectedCode);
      setScanSuccessCode(targetQuery);
      setIsScanning(false);
      void stopCamera();
    } catch (err) {
      console.warn('Error al decodificar la imagen:', err);
      setCameraError('No se detectó un código legible en la imagen. Intenta tomarla más de cerca con buena iluminación o escribe el código abajo.');
      setUploadedFile(null);
    } finally {
      setIsAnalyzingFile(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  // Capturar fotograma desde el stream activo de la cámara
  const capturePhotoFromVideo = async () => {
    const readerElement = document.getElementById('search-device-reader');
    const video = readerElement?.querySelector('video');
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Esperando que la cámara enfoque... Intenta de nuevo.');
      return;
    }

    setIsAnalyzingFile(true);
    setCameraError(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
        if (blob) {
          const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
          const rawCodes = await decodeAllBarcodesFromImage(file, 'search-device-file-helper');
          if (!rawCodes || rawCodes.length === 0) {
            throw new Error('No se detectó un código legible.');
          }

          let selectedCode = rawCodes[0];
          if (devices && devices.length > 0) {
            for (const code of rawCodes) {
              const target = parseScannedText(code);
              const clean = target.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              const match = devices.find((d) => {
                const imeiClean = String(d.imei ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const idnoClean = String(d.devIDNO ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                const serialClean = String(d.serialID ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                return (
                  (imeiClean && imeiClean === clean) ||
                  (idnoClean && idnoClean === clean) ||
                  (serialClean && serialClean === clean)
                );
              });
              if (match) {
                selectedCode = target;
                break;
              }
            }
          }

          const targetQuery = parseScannedText(selectedCode);
          setScanSuccessCode(targetQuery);
          setIsScanning(false);
          void stopCamera();
        }
      }
    } catch (err) {
      console.warn('Error al capturar foto desde la cámara:', err);
      setCameraError('No se detectó un código nítido en el momento del disparo. Acerca más la cámara al código con buena iluminación.');
    } finally {
      setIsAnalyzingFile(false);
    }
  };

  // Manejar clic en "Tomar foto": si hay cámara activa captura, si no la activa
  const handleTakePhotoClick = async () => {
    setCameraError(null);

    // Si la cámara ya está activa, capturar fotograma
    if (isScanning) {
      await capturePhotoFromVideo();
      return;
    }

    // Si el navegador soporta getUserMedia, abrir la cámara directamente
    if (typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function') {
      try {
        await startCamera();
        return;
      } catch (err) {
        console.warn('No se pudo iniciar transmisión web de cámara, recurriendo a input nativo:', err);
      }
    }

    // Fallback: abrir cámara nativa del dispositivo
    cameraInputRef.current?.click();
  };

  useScrollLock(isOpen);

  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      const initScanner = async () => {
        resetState();
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
      setScanSuccessCode(targetQuery);
      void stopCamera();
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
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {scanSuccessCode ? 'Resultado del Escaneo' : t('escanear_buscar_dispositivo')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {scanSuccessCode ? 'Informacion previa detectada del dispositivo' : t('escanear_dispositivo_desc')}
              </p>
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

        {scanSuccessCode ? (
          /* VISTA PREVIA DEL ESCANEO */
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Estado de coincidencia */}
            {matchedDevice ? (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                <div>
                  <div>Dispositivo registrado en inventario</div>
                  <div className="text-[11px] font-normal text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                    Coincide con un registro existente en la base de datos.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-bold">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
                <div>
                  <div>Codigo no registrado en el inventario</div>
                  <div className="text-[11px] font-normal text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    Este dispositivo no se encuentra registrado actualmente.
                  </div>
                </div>
              </div>
            )}

            {/* Código escaneado con botón copiar */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Codigo detectado
              </span>
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#121927] p-3 rounded-xl border border-slate-200 dark:border-white/10">
                <span className="font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-wider break-all select-all">
                  {scanSuccessCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shrink-0 active:scale-95 cursor-pointer border border-slate-200 dark:border-white/10"
                  title="Copiar codigo al portapapeles"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Detalles si el dispositivo fue encontrado */}
            {matchedDevice && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Informacion del dispositivo
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Marca y Modelo:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {matchedDevice.brand || 'Generico'} {matchedDevice.model || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Estado:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {matchedDevice.install === 1 ? 'Instalado' : 'En Bodega'}
                    </span>
                  </div>
                  {Boolean(matchedDevice.plate || matchedDevice.vehiIDNO) && (
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Patente:</span>
                      <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                        {String(matchedDevice.plate ?? matchedDevice.vehiIDNO ?? '')}
                      </span>
                    </div>
                  )}
                  {Boolean(matchedDevice.companyName) && (
                    <div>
                      <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Empresa:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {String(matchedDevice.companyName ?? '')}
                      </span>
                    </div>
                  )}
                  {Boolean(matchedDevice.simInfo || matchedDevice.actualCardNumber) && (
                    <div className="col-span-2">
                      <span className="text-slate-400 dark:text-slate-500 block text-[11px]">SIM Card vinculada:</span>
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {String(matchedDevice.simInfo ?? matchedDevice.actualCardNumber ?? '')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  onScanResult(scanSuccessCode);
                  void handleModalClose();
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#00A3E0] hover:bg-[#0092c8] active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>Filtrar en tabla</span>
              </button>

              {onOpenCreate && (
                <button
                  type="button"
                  onClick={() => {
                    const code = scanSuccessCode;
                    void handleModalClose();
                    onOpenCreate(code);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar dispositivo</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setScanSuccessCode(null);
                  setManualCode('');
                  setCopied(false);
                  void startCamera();
                }}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-[#121927] dark:hover:bg-[#1E293B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-98"
              >
                <RotateCcw className="w-4 h-4 text-[#00A3E0]" />
                <span>Escanear otro</span>
              </button>
            </div>
          </div>
        ) : (
          /* Visor de Cámara y Formulario Normal */
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
                      onClick={handleTakePhotoClick}
                      className="px-4 py-2 bg-[#00A3E0] hover:bg-[#0092c8] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Tomar foto</span>
                    </button>
                    <button
                      onClick={() => {
                        resetState();
                        void startCamera();
                      }}
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
                  <p className="text-xs font-semibold text-slate-300">{t('modal_preparando_camara') || 'Preparando camara...'}</p>
                  <button
                    onClick={startCamera}
                    type="button"
                    className="px-4 py-2 bg-[#00A3E0] hover:bg-[#0092c8] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    {t('modal_reiniciar_camara') || 'Reiniciar Camara'}
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
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 pb-8">
                    <div className="w-[84%] max-w-105 h-[68%] max-h-55 border-2 border-dashed border-[#00A3E0]/80 rounded-2xl shadow-[0_0_15px_rgba(0,163,224,0.3)] relative">
                      <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-[#00A3E0] rounded-tl" />
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-[#00A3E0] rounded-tr" />
                      <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-[#00A3E0] rounded-bl" />
                      <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-[#00A3E0] rounded-br" />
                    </div>
                  </div>

                  {/* Barra inferior de disparo y control de cámara */}
                  <div className="absolute bottom-2 inset-x-2 z-20 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950/90 backdrop-blur-xs border border-white/10 text-white text-xs font-semibold">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                      <span className="text-[11px] text-slate-300 font-medium truncate">
                        {t('apunta_qr_o_barras') || 'Apunta al código QR o código de barras'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={capturePhotoFromVideo}
                        disabled={isAnalyzingFile}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00A3E0] hover:bg-[#0092c8] text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Capturar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsScanning(false);
                          void stopCamera();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cerrar</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Cuadro de archivo subido o botón de buscar imagen */}
            {uploadedFile ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100 dark:bg-[#121927] border border-slate-200 dark:border-white/10 animate-in fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-[#00A3E0]/15 text-[#00A3E0] shrink-0">
                    <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {uploadedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {(uploadedFile.size / 1024).toFixed(1)} KB {isAnalyzingFile ? '• Analizando...' : '• Archivo cargado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={isAnalyzingFile}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    disabled={isAnalyzingFile}
                    className="p-1.5 rounded-lg hover:bg-rose-500/15 text-slate-400 hover:text-rose-500 transition-all cursor-pointer disabled:opacity-50"
                    title="Quitar archivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isAnalyzingFile}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#121927] dark:hover:bg-[#1E293B] active:scale-98 text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-white/10 shadow-2xs"
                title="Buscar imagen en el equipo"
              >
                <UploadCloud className="w-4 h-4 text-[#00A3E0]" />
                <span>Buscar imagen</span>
              </button>
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
        )}

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
