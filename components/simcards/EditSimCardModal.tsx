'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Camera,
  Radio,
  CheckCircle2,
  AlertCircle,
  Scan,
  Building2,
  Phone,
  HardDrive,
  Clock,
  Activity,
  FileText,
  MapPin,
  CreditCard,
  Hash,
  Calendar,
  UploadCloud,
  Loader2,
  Save,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { decodeBarcodeFromImage } from '@/lib/utils/barcode-decoder';
import type { SimRecord } from '@/lib/types/inventory';
import { DEFAULT_COMPANY_OPTIONS, COUNTRY_CODES, USE_LOCAL_DATA } from '@/lib/constants';
import { MAX_LENGTHS, ICCID_MAX_LENGTH, E164_MAX_LENGTH, firstFieldError } from '@/lib/validation/inventory';
import { formatDate } from '@/lib/utils/date-format';
import { useScrollLock } from '@/lib/utils/useScrollLock';
import {
  normalizeICCID,
  detectOperatorFromICCID,
  type DeviceItemOption,
  type VehicleItemOption,
} from '@/lib/utils/sim-utils';

interface EditSimCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sim: SimRecord | null;
  onUpdateSim: (updatedSim: SimRecord) => void;
  companiesList?: { id?: string | number; name?: string }[];
  devicesList?: DeviceItemOption[];
  vehiclesList?: VehicleItemOption[];
}

export default function EditSimCardModal({
  isOpen,
  onClose,
  sim,
  onUpdateSim,
  companiesList = [],
  devicesList = [],
  vehiclesList = [],
}: EditSimCardModalProps) {
  const { t } = useTranslation();

  // Estados del Formulario
  const [simCardCode, setSimCardCode] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [customCompanyName, setCustomCompanyName] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>('+56');
  const [phoneNumber, setPhoneNumber] = useState<string>('9');
  const [selectedDevIDNO, setSelectedDevIDNO] = useState<string>('');

  const [plan, setPlan] = useState<string>('Plan M2M Data');
  const [status, setStatus] = useState<number>(1);
  const [city, setCity] = useState<string>('');
  const [cardMerchant, setCardMerchant] = useState<string>('');
  const [msisdn, setMsisdn] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');

  // Fallbacks locales
  const [internalDevices, setInternalDevices] = useState<DeviceItemOption[]>([]);
  const [internalVehicles, setInternalVehicles] = useState<VehicleItemOption[]>([]);

  // Escáner y Alertas
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrcodeRef = useRef<any>(null);
  const cancelCameraStartRef = useRef<boolean>(false);
  const isStoppingCameraRef = useRef<boolean>(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const stopMediaTracks = () => {
    const readerElement = document.getElementById('edit-simcard-reader');
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

  useScrollLock(isOpen);

  const fetchedFallbackRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      fetchedFallbackRef.current = false;
      return;
    }
    if (fetchedFallbackRef.current) return;
    fetchedFallbackRef.current = true;

    if (!devicesList || devicesList.length === 0) {
      fetch('/api/local-devices')
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data.infos) ? data.infos : [];
          setInternalDevices(list);
        })
        .catch(() => {});
    }

    if (!vehiclesList || vehiclesList.length === 0) {
      fetch('/api/local-vehicles')
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data.infos) ? data.infos : [];
          setInternalVehicles(list);
        })
        .catch(() => {});
    }
  }, [isOpen, devicesList, vehiclesList]);

  // Cargar datos de la SIM al abrir o cambiar sim
  useEffect(() => {
    let ignore = false;
    if (!isOpen || !sim) return;

    const populate = async () => {
      await Promise.resolve();
      if (ignore) return;

      setErrorMessage(null);
      setSubmittedMessage(null);
      setCameraError(null);
      setScanSuccess(false);

      // ICCID
      setSimCardCode(sim.simCard ? String(sim.simCard).trim() : '');

      // Empresa
      const comp = sim.companyName || sim.company?.name || '';
      setCompanyName(comp && comp !== 'Sin Asignar' && comp !== 'Libre' ? comp : '');
      setCustomCompanyName('');

      // Teléfono y Código de País
      const rawCardNum = String(sim.cardNum || '').trim();
      if (rawCardNum.startsWith('+')) {
        const foundCc = COUNTRY_CODES.find((c) => rawCardNum.startsWith(c.code));
        if (foundCc) {
          setCountryCode(foundCc.code);
          setPhoneNumber(rawCardNum.slice(foundCc.code.length));
        } else {
          setCountryCode('+56');
          setPhoneNumber(rawCardNum.replace(/^\+/, ''));
        }
      } else if (rawCardNum.startsWith('56') && rawCardNum.length >= 11) {
        setCountryCode('+56');
        setPhoneNumber(rawCardNum.slice(2));
      } else {
        setCountryCode('+56');
        setPhoneNumber(rawCardNum);
      }

      // Estado
      setStatus(Number(sim.status) === 2 ? 2 : 1);

      // Plan
      setPlan(sim.planName ? String(sim.planName).trim() : 'Plan M2M Data');

      // Ciudad
      setCity(sim.city ? String(sim.city).trim() : '');

      // Card Merchant
      setCardMerchant(sim.cardMerchant ? String(sim.cardMerchant).trim() : '');

      // MSISDN
      setMsisdn(sim.msisdn ? String(sim.msisdn).trim() : '');

      // Expiration Date
      if (sim.endTime) {
        try {
          if (typeof sim.endTime === 'number') {
            setEndTime(formatDate(sim.endTime));
          } else {
            setEndTime(String(sim.endTime).slice(0, 10));
          }
        } catch {
          setEndTime('');
        }
      } else {
        setEndTime('');
      }

      // Dispositivo asignado
      setSelectedDevIDNO(sim.devIDNO ? String(sim.devIDNO).trim() : '');
    };

    void populate();

    return () => {
      ignore = true;
    };
  }, [isOpen, sim]);

  const effectiveDevices = useMemo(() => {
    return devicesList && devicesList.length > 0 ? devicesList : internalDevices;
  }, [devicesList, internalDevices]);

  const effectiveVehicles = useMemo(() => {
    return vehiclesList && vehiclesList.length > 0 ? vehiclesList : internalVehicles;
  }, [vehiclesList, internalVehicles]);

  const devicesWithVehiclesSet = useMemo(() => {
    const set = new Set<string>();

    effectiveVehicles.forEach((v) => {
      const devList = Array.isArray(v.devList) ? v.devList : (Array.isArray(v.dl) ? v.dl : []);
      devList.forEach((d) => {
        const idVal = String(d.name ?? d.id ?? d.serialID ?? '').trim();
        if (idVal) set.add(idVal);
      });
    });

    effectiveDevices.forEach((d) => {
      if (d.vehiIdno && String(d.vehiIdno).trim() !== '') {
        const devId = String(d.devIDNO ?? d.devIdno ?? d.id ?? '').trim();
        if (devId) set.add(devId);
      }
    });

    return set;
  }, [effectiveVehicles, effectiveDevices]);

  const filteredDevicesForCompany = useMemo(() => {
    if (!companyName) return [];

    const normSelectedComp = companyName.trim().toLowerCase();

    return effectiveDevices.filter((dev) => {
      const devId = String(dev.devIDNO ?? dev.devIdno ?? dev.id ?? '').trim();
      if (!devId) return false;

      // Si es el dispositivo actualmente asignado a esta SIM, incluirlo siempre
      const currentSimDev = sim?.devIDNO ? String(sim.devIDNO).trim() : '';
      const isCurrentlyAssigned = currentSimDev !== '' && currentSimDev === devId;

      if (!isCurrentlyAssigned && devicesWithVehiclesSet.has(devId)) {
        return false;
      }

      let devCompName = String(dev.companyName ?? '').trim();
      if (!devCompName && dev.companyId && companiesList.length > 0) {
        const matchC = companiesList.find((c) => String(c.id) === String(dev.companyId));
        if (matchC?.name) devCompName = matchC.name.trim();
      }

      if (devCompName && devCompName.toLowerCase() !== normSelectedComp) {
        return false;
      }

      return true;
    });
  }, [companyName, effectiveDevices, devicesWithVehiclesSet, companiesList, sim]);

  const availableCompanies = useMemo(() => {
    // Lista fija sólo en modo local; con BD se usan las empresas de la tabla companies
    const set = new Set<string>(USE_LOCAL_DATA ? DEFAULT_COMPANY_OPTIONS : []);
    if (companiesList) {
      companiesList.forEach((c) => { if (c.name) set.add(c.name); });
    }
    effectiveDevices.forEach((d) => {
      const name = String(d.companyName ?? '').trim();
      if (name && name !== 'Sin Asignar' && name !== 'Libre') set.add(name);
    });
    effectiveVehicles.forEach((v) => {
      const name = String(v.com?.name ?? v.companyName ?? '').trim();
      if (name && name !== 'Sin Asignar' && name !== 'Libre') set.add(name);
    });
    return Array.from(set);
  }, [companiesList, effectiveDevices, effectiveVehicles]);

  const handleCompanyChange = (newComp: string) => {
    setCompanyName(newComp);
    if (newComp !== '__REGISTER_NEW_COMPANY__') {
      setCustomCompanyName('');
    }
    setSelectedDevIDNO('');
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (countryCode === '+56') {
      if (rawVal === '') {
        setPhoneNumber('');
      } else {
        setPhoneNumber(rawVal.slice(0, 9));
      }
    } else {
      setPhoneNumber(rawVal.slice(0, 12));
    }
  };

  const stopCamera = useCallback(async () => {
    cancelCameraStartRef.current = true;
    if (isStoppingCameraRef.current) return;
    isStoppingCameraRef.current = true;

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
      } catch {}
    }

    stopMediaTracks();

    const readerElement = document.getElementById('edit-simcard-reader');
    if (readerElement) {
      readerElement.innerHTML = '';
    }

    isStoppingCameraRef.current = false;
    setIsScanning(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !isScanning) {
      void stopCamera();
    }
  }, [isOpen, isScanning, stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    setScanSuccess(false);
    cancelCameraStartRef.current = false;

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      if (cancelCameraStartRef.current) return;

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Los navegadores móviles exigen HTTPS para transmitir video en vivo. Pulsa "Tomar foto con la cámara" para escanear.');
        setIsScanning(false);
        return;
      }

      await stopCamera();

      const html5Qrcode = new Html5Qrcode('edit-simcard-reader', {
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

      html5QrcodeRef.current = html5Qrcode;
      setIsScanning(true);

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const width = Math.floor(Math.min(viewfinderWidth * 0.9, 440));
          const height = Math.floor(Math.min(viewfinderHeight * 0.7, 180));
          return { width, height };
        },
        aspectRatio: 1.4,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      const onScanSuccess = async (decodedText: string) => {
        const cleanCode = decodedText.trim();
        const normalized = normalizeICCID(cleanCode);
        setSimCardCode(normalized);
        setScanSuccess(true);
        setIsScanning(false);
        await stopCamera();
      };

      try {
        await html5Qrcode.start({ facingMode: 'environment' }, config, onScanSuccess, () => {});
      } catch (envErr) {
        if (cancelCameraStartRef.current) return;
        console.warn('Fallo facingMode environment, intentando facingMode user:', envErr);
        await html5Qrcode.start({ facingMode: 'user' }, config, onScanSuccess, () => {});
      }
    } catch (err: unknown) {
      console.warn('Error al iniciar la cámara:', err);
      setCameraError('No se pudo acceder a la cámara. Revisa los permisos o sube una foto de la SIM.');
      setIsScanning(false);
      void stopCamera();
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingFile(true);
    setCameraError(null);
    setScanSuccess(false);

    try {
      const rawText = await decodeBarcodeFromImage(file, 'edit-simcard-file-helper');
      const clean = rawText.trim();
      const normalized = normalizeICCID(clean);
      setSimCardCode(normalized);
      setScanSuccess(true);
    } catch (err) {
      console.warn('No se pudo decodificar la imagen de SIM:', err);
      setCameraError('No se detectó un código de barras o QR legible en la imagen. Intenta tomarla más de cerca con buena iluminación.');
    } finally {
      setIsAnalyzingFile(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const detectedOperator = useMemo(() => {
    if (!simCardCode.trim()) return null;
    return detectOperatorFromICCID(simCardCode.trim());
  }, [simCardCode]);

  const previewRegTime = useMemo(() => {
    if (!sim?.registrationTime) return null;
    const d = new Date(sim.registrationTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }, [sim]);

  if (!isOpen || !sim) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmittedMessage(null);

    const fieldError = firstFieldError([
      ['iccid', simCardCode],
      ['phone', phoneNumber.trim() ? `${countryCode}${phoneNumber}` : ''],
      ['planName', plan],
      ['city', city],
      ['cardMerchant', cardMerchant],
      ['msisdn', msisdn],
      ['companyName', customCompanyName],
    ]);
    if (fieldError) {
      setErrorMessage(fieldError);
      return;
    }

    if (!simCardCode.trim()) {
      setErrorMessage(t('error_iccid_requerido') || 'El código ICCID (simCard) es obligatorio.');
      return;
    }

    const cleanPhoneDigits = phoneNumber.trim().replace(/\D/g, '');
    if (!cleanPhoneDigits) {
      setErrorMessage(t('error_telefono_requerido') || 'El número telefónico es obligatorio.');
      return;
    }

    if (countryCode === '+56') {
      if (!cleanPhoneDigits.startsWith('9')) {
        setErrorMessage(t('error_telefono_chile_9') || 'El número telefónico para Chile (+56) debe comenzar con 9.');
        return;
      }
      if (cleanPhoneDigits.length !== 9) {
        setErrorMessage(t('error_telefono_chile_longitud') || 'El número para Chile (+56) debe tener exactamente 9 dígitos.');
        return;
      }
    }

    let finalCompanyName = companyName.trim();
    if (companyName === '__REGISTER_NEW_COMPANY__') {
      const trimmed = customCompanyName.trim();
      if (!trimmed) {
        setErrorMessage(t('error_compania_requerida') || 'Por favor ingresa el nombre de la nueva Empresa.');
        return;
      }
      finalCompanyName = trimmed;
      void fetch('/api/local-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: finalCompanyName }),
      }).catch(() => {});
    } else if (!finalCompanyName) {
      setErrorMessage(t('error_compania_requerida') || 'La Empresa es obligatoria.');
      return;
    }

    setIsSubmitting(true);

    const fullFormattedCardNum = `${countryCode}${cleanPhoneDigits}`;
    const finalDevIDNO = selectedDevIDNO.trim();
    const isInstalledVal = finalDevIDNO !== '' ? 1 : 0;
    const detectedOp = detectOperatorFromICCID(simCardCode.trim());

    let matchedCompanyId = sim.companyID || 1;
    if (companiesList.length > 0) {
      const matchComp = companiesList.find(
        (c) => c.name?.toLowerCase() === finalCompanyName.toLowerCase()
      );
      if (matchComp && matchComp.id !== undefined && matchComp.id !== null) {
        matchedCompanyId = Number(matchComp.id) || matchedCompanyId;
      }
    }

    const updatedSim: SimRecord = {
      ...sim,
      cardNum: fullFormattedCardNum,
      status: Number(status),
      updateTime: Date.now(),
      install: isInstalledVal,
      devIDNO: finalDevIDNO || null,
      vehiIDNO: isInstalledVal === 1 ? (sim.vehiIDNO || null) : null,
      companyID: matchedCompanyId,
      simCard: simCardCode.trim() || null,
      companyName: finalCompanyName,
      serviceProvider: detectedOp ? (detectedOp.mainOperator || detectedOp.operator) : (sim.serviceProvider || 'Entel'),
      planName: plan.trim() || null,
      city: city.trim() || null,
      endTime: endTime ? (new Date(endTime).getTime() || endTime) : null,
      cardMerchant: cardMerchant.trim() || null,
      msisdn: msisdn.trim() || null,
    };

    onUpdateSim(updatedSim);
    setIsSubmitting(false);
    void stopCamera();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 animate-in fade-in duration-200 overscroll-contain notranslate"
      onWheel={(e) => e.stopPropagation()}
      translate="no"
    >
      <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#162032] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Helper invisible para decodificar fotos */}
        <div id="edit-simcard-file-helper" style={{ position: 'fixed', top: -9999, left: -9999, width: 800, height: 600, opacity: 0, pointerEvents: 'none' }} />

        {/* Cabecera del Modal */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 bg-white dark:bg-[#121927] border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
              <Radio className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-wide">
                {t('modal_editar_simcard_titulo') || 'Editar SIM Card'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {t('modal_editar_simcard_desc') || 'Modifica los datos de la tarjeta SIM en el inventario'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              void stopCamera();
              onClose();
            }}
            type="button"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E293B] transition-colors cursor-pointer min-w-11 min-h-11 flex items-center justify-center"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-5">
          {/* Alertas */}
          {errorMessage && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs sm:text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {submittedMessage && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
              <span>{submittedMessage}</span>
            </div>
          )}

          {/* Sección de Escaneo con Cámara */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0F1726] p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scan className="w-4 h-4 sm:w-5 sm:h-5 text-[#00A3E0]" />
                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Escáner de Cámara
                </span>
              </div>
              {!isScanning ? (
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00A3E0] hover:bg-[#0092c8] text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{t('activar_camara')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsScanning(false);
                    void stopCamera();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>{t('detener_camara')}</span>
                </button>
              )}
            </div>

            {/* Inputs ocultos para captura nativa o galería */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileScan}
              className="hidden"
            />
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              onChange={handleFileScan}
              className="hidden"
            />

            {/* Visor de Cámara */}
            {isScanning && (
              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 bg-black min-h-65 md:min-h-75 flex items-center justify-center">
                <div id="edit-simcard-reader" className="w-full h-full min-h-65 md:min-h-75" />
              </div>
            )}

            {isAnalyzingFile && (
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-indigo-800 dark:text-indigo-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 animate-pulse">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                <span>{t('analizando_codigo_foto')}</span>
              </div>
            )}

            {/* Botones adicionales: tomar foto o subir archivo */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isAnalyzingFile}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-indigo-200" />
                <span>{t('tomar_foto_camara')}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isAnalyzingFile}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-3.5 bg-slate-100 dark:bg-[#121927] hover:bg-slate-200 dark:hover:bg-[#1E293B] active:scale-98 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-white/10 shadow-2xs"
                title="Abrir galería de fotos"
              >
                <UploadCloud className="w-4 h-4 text-[#00A3E0]" />
                <span>{t('buscar_imagen_galeria')}</span>
              </button>
            </div>

            {cameraError && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {scanSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in zoom-in-95">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                <span>¡Código escaneado correctamente y cargado en simCard!</span>
              </div>
            )}
          </div>

          {/* Formulario de Edición */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Campo 1: simCard */}
            <div>
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                simCard <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={simCardCode}
                  maxLength={ICCID_MAX_LENGTH}
                  inputMode="numeric"
                  onChange={(e) => setSimCardCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej: 89560900000127126850"
                  className="w-full px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all shadow-2xs"
                />
                {simCardCode && (
                  <button
                    type="button"
                    onClick={() => setSimCardCode('')}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {detectedOperator && (
                <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 animate-in fade-in">
                  <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">Compañía de red:</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                    <Radio className="w-3.5 h-3.5 text-blue-500" />
                    {detectedOperator.operator}
                  </span>
                </div>
              )}
            </div>

            {/* Fila 2: No. SIM y Empresa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* No. SIM */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  No. SIM <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-32 px-3 py-3 bg-slate-50 dark:bg-[#121927] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#00A3E0] transition-all cursor-pointer shrink-0"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>

                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={phoneNumber}
                      onChange={handlePhoneNumberChange}
                      placeholder={countryCode === '+56' ? '912345678' : '123456789'}
                      className="w-full px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all shadow-2xs pr-10"
                    />
                    {phoneNumber && (
                      <button
                        type="button"
                        onClick={() => setPhoneNumber('')}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title="Borrar número"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {countryCode === '+56'
                    ? 'Para Chile (🇨🇱 +56) se requiere el prefijo 9 (Ej: 912345678).'
                    : `Ingresa el número telefónico para ${countryCode}.`}
                </p>
              </div>

              {/* Empresa */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#00A3E0]" />
                  Empresa <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={companyName}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all cursor-pointer shadow-2xs"
                >
                  <option value="">Selecciona una Empresa *</option>
                  <option value="__REGISTER_NEW_COMPANY__" className="font-bold text-[#00A3E0]">
                    {t('registrar_empresa_sim_opcion') || '+ Registrar Empresa...'}
                  </option>
                  {availableCompanies.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
                {companyName === '__REGISTER_NEW_COMPANY__' && (
                  <div className="mt-2.5 p-3 bg-blue-50/70 dark:bg-[#0F1726] border border-blue-200 dark:border-[#00A3E0]/30 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#00A3E0]" />
                        {t('nombre_nueva_empresa') || 'Registrar nueva empresa:'} <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setCompanyName('');
                          setCustomCompanyName('');
                        }}
                        className="text-[11px] text-slate-400 hover:text-red-500 font-semibold cursor-pointer"
                      >
                        {t('cancelar') || 'Cancelar'}
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={customCompanyName}
                      maxLength={MAX_LENGTHS.company.name}
                      onChange={(e) => setCustomCompanyName(e.target.value)}
                      placeholder="Ej: Transportes del Norte SpA"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#121927] border border-blue-300 dark:border-white/10 rounded-lg text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-[#00A3E0] shadow-2xs"
                      autoFocus
                    />
                  </div>
                )}
                {!companyName && (
                  <p className="text-xs text-slate-400 mt-1 italic">
                    Campo obligatorio. Selecciona la empresa a la que pertenece la SIM.
                  </p>
                )}
              </div>
            </div>

            {/* Fila 3: Estado y Tipo de Plan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Estado */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Estado <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={status}
                  onChange={(e) => setStatus(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#00A3E0] transition-all cursor-pointer shadow-2xs"
                >
                  <option value={1}>1 - Habilitado</option>
                  <option value={2}>2 - No habilitado</option>
                </select>
              </div>

              {/* Tipo de Plan */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#00A3E0]" />
                  Tipo de Plan
                </label>
                <input
                  type="text"
                  value={plan}
                  maxLength={MAX_LENGTHS.simcard.plan_name}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder="Ej: Plan M2M Data"
                  className="w-full px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-[#00A3E0] transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Fila 4: Ciudad de Emisión y Card Merchant */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Ciudad de Emisión
                </label>
                <input
                  type="text"
                  value={city}
                  maxLength={MAX_LENGTHS.simcard.city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ej: Santiago"
                  className="w-full px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Card Merchant
                </label>
                <input
                  type="text"
                  value={cardMerchant}
                  maxLength={MAX_LENGTHS.simcard.card_merchant}
                  onChange={(e) => setCardMerchant(e.target.value)}
                  placeholder="Ej: Giesecke+Devrient / Idemia"
                  className="w-full px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Fila 5: MSISDN y Expiration Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  MSISDN
                </label>
                <input
                  type="text"
                  value={msisdn}
                  maxLength={E164_MAX_LENGTH}
                  inputMode="numeric"
                  onChange={(e) => setMsisdn(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej: 56912345678"
                  className="w-full px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all cursor-pointer shadow-2xs"
                />
              </div>
            </div>

            {/* Dispositivo Asignado */}
            <div>
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Dispositivo Asignado
              </label>
              <select
                disabled={!companyName}
                value={selectedDevIDNO}
                onChange={(e) => setSelectedDevIDNO(e.target.value)}
                className={`w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-sm sm:text-base font-semibold transition-all font-mono shadow-2xs ${
                  !companyName
                    ? 'bg-slate-100 dark:bg-[#121927]/60 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    : 'bg-white dark:bg-[#0F1726] text-slate-900 dark:text-white focus:outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] cursor-pointer'
                }`}
              >
                <option value="">
                  {!companyName ? 'Selecciona una Empresa primero' : 'Sin Dispositivo / Libre'}
                </option>
                {companyName &&
                  filteredDevicesForCompany.map((dev, idx) => {
                    const devId = String(dev.devIDNO ?? dev.devIdno ?? dev.id ?? '');
                    if (!devId) return null;
                    const brandModel = [dev.brand, dev.model].filter(Boolean).join(' ');
                    const brandText = brandModel ? ` - ${brandModel}` : '';
                    return (
                      <option key={`dev-opt-${devId}-${idx}`} value={devId}>
                        {devId}{brandText} (Disponible / Sin Vehículo)
                      </option>
                    );
                  })}
              </select>

              {!companyName ? (
                <p className="text-xs text-slate-400 mt-1 italic">
                  Selecciona una Empresa arriba para ver sus dispositivos disponibles sin vehículo.
                </p>
              ) : filteredDevicesForCompany.length === 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">
                  No hay dispositivos disponibles sin vehículo asociados a {companyName}. Se guardará sin dispositivo.
                </p>
              ) : (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                  Mostrando {filteredDevicesForCompany.length} dispositivo(s) disponibles sin vehículo para {companyName}.
                </p>
              )}

              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Estado de asignación:</span>
                <span
                  className={`font-extrabold px-2.5 py-1 rounded border ${
                    selectedDevIDNO
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                      : 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                  }`}
                >
                  {selectedDevIDNO ? '1 (Instalado en Dispositivo)' : '0 (Libre / No Instalado)'}
                </span>
              </div>
            </div>

            {/* Fecha de Registro Original */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2 font-medium">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#00A3E0]" />
                <span>Fecha de Registro:</span>
              </div>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-[#121927] px-3 py-1.5 rounded-md border border-slate-200 dark:border-white/10">
                {previewRegTime || 'Timestamp Unix (ms)'}
              </span>
            </div>

            {/* Pie de Página del Modal */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  void stopCamera();
                  onClose();
                }}
                className="px-4 sm:px-5 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#121927] text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1E293B] transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 sm:px-6 py-3 rounded-xl bg-[#00A3E0] hover:bg-[#0092c8] text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{isSubmitting ? 'Guardando...' : (t('guardar_cambios') || 'Actualizar SIM Card')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
