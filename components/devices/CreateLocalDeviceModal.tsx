'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  Plus,
  HardDrive,
  Tag,
  ShieldCheck,
  Layers,
  Cpu,
  Building2,
  Truck,
  Hash,
  Barcode,
  Radio,
  Phone,
  Clock,
  QrCode,
  Activity,
  Camera,
  Scan,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Loader2,
  ChevronDown,
  Check,
  Settings2,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { DeviceRecord, VehicleRecord, SimRecord } from '@/lib/types/inventory';
import { useTranslation } from '@/lib/i18n';
import { DEFAULT_COMPANY_OPTIONS, BRAND_OPTIONS, MODEL_OPTIONS, USE_LOCAL_DATA } from '@/lib/constants';
import { MAX_LENGTHS, IMEI_LENGTH, firstFieldError } from '@/lib/validation/inventory';
import { formatDate } from '@/lib/utils/date-format';
import { decodeBarcodeFromImage } from '@/lib/utils/barcode-decoder';
import CreatableSelect from '@/components/common/CreatableSelect';
import { useDeviceOptions } from '@/components/devices/useDeviceOptions';

export { BRAND_OPTIONS, MODEL_OPTIONS };

interface CreateLocalDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDevice: (newDevice: DeviceRecord) => void;
  onOpenManageCatalog?: () => void;
  companiesList?: { id?: string | number; name?: string }[];
  vehiclesList?: VehicleRecord[];
  simsList?: SimRecord[];
}

export default function CreateLocalDeviceModal({
  isOpen,
  onClose,
  onAddDevice,
  onOpenManageCatalog,
  companiesList = [],
  vehiclesList = [],
  simsList = [],
}: CreateLocalDeviceModalProps) {
  const { t } = useTranslation();

  // Estados del Formulario
  const [devIDNO, setDevIDNO] = useState(''); // device No
  const [serialID, setSerialID] = useState(''); // serie de dispositivo
  const [imei, setImei] = useState(''); // IMEI
  const [simInfo, setSimInfo] = useState(''); // No. SIM -> simInfo
  const [actualCardNumber, setActualCardNumber] = useState(''); // Actual Card Number
  const [brand, setBrand] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const { brands, modelsForBrand } = useDeviceOptions(isOpen);
  const [devType, setDevType] = useState<number>(7);
  const [install, setInstall] = useState<number>(1);
  const [serviceStatus, setServiceStatus] = useState<'active' | 'inactive'>('active');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [customCompanyName, setCustomCompanyName] = useState<string>('');
  const [selectedVehicleVid, setSelectedVehicleVid] = useState<string>('');
  const [customVehiclePlate, setCustomVehiclePlate] = useState<string>('');
  const [internalCompanies, setInternalCompanies] = useState<{ id?: string | number; name?: string }[]>([]);
  const [internalVehicles, setInternalVehicles] = useState<VehicleRecord[]>([]);
  const [internalSims, setInternalSims] = useState<SimRecord[]>([]);
  const [isSimDropdownOpen, setIsSimDropdownOpen] = useState<boolean>(false);
  const simComboboxRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Estados y refs del Escáner de Código de Barras / QR
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState<boolean>(false);

  const html5QrcodeRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const cancelCameraStartRef = useRef<boolean>(false);
  const isStoppingCameraRef = useRef<boolean>(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Evitar bucle infinito de peticiones usando un ref de control estricto
  const fetchedFallbackRef = useRef(false);

  // Detener pistas de hardware de medios
  const stopMediaTracks = () => {
    const readerElement = document.getElementById('device-barcode-reader');
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

  // Detener la cámara y limpiar contenedor
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
      } catch {
        // ignore
      }
    }

    stopMediaTracks();

    const readerElement = document.getElementById('device-barcode-reader');
    if (readerElement) {
      readerElement.innerHTML = '';
    }

    isStoppingCameraRef.current = false;
    setIsScanning(false);
  }, []);

  // Extraer el devIDNO limpio del texto escaneado
  const parseScannedDevId = (text: string): string => {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.devIDNO) return String(parsed.devIDNO).trim();
        if (parsed.id) return String(parsed.id).trim();
        if (parsed.imei) return String(parsed.imei).trim();
      } catch {
        // fallback
      }
    }
    const matchPrefix = trimmed.match(/^ID\s*:\s*(.+)$/i);
    if (matchPrefix) {
      return matchPrefix[1].trim();
    }
    return trimmed;
  };

  // Iniciar transmisión de video de cámara
  const startCamera = async () => {
    cancelCameraStartRef.current = false;
    setCameraError(null);
    setScanSuccess(false);
    setIsScanning(true);

    setTimeout(async () => {
      if (cancelCameraStartRef.current) return;

      try {
        const readerElement = document.getElementById('device-barcode-reader');
        if (!readerElement || cancelCameraStartRef.current) return;

        stopMediaTracks();
        readerElement.innerHTML = '';

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelCameraStartRef.current) return;

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

        const html5Qrcode = new Html5Qrcode('device-barcode-reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
          verbose: false,
        });

        if (cancelCameraStartRef.current) {
          try { html5Qrcode.clear(); } catch {}
          return;
        }

        html5QrcodeRef.current = html5Qrcode;

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.floor(Math.min(viewfinderWidth * 0.88, 400));
            const height = Math.floor(Math.min(viewfinderHeight * 0.75, 210));
            return { width, height };
          },
          aspectRatio: 1.4,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        };

        const onScanSuccess = (decodedText: string) => {
          const targetDevId = parseScannedDevId(decodedText);
          setDevIDNO(targetDevId);
          setScanSuccess(true);
          setIsScanning(false);
          void stopCamera();
        };

        try {
          await html5Qrcode.start(
            { facingMode: 'environment' },
            config,
            onScanSuccess,
            () => {}
          );
        } catch (envErr) {
          if (cancelCameraStartRef.current) return;
          console.warn('Fallo facingMode environment en CreateLocalDeviceModal, reintentando user:', envErr);
          await html5Qrcode.start(
            { facingMode: 'user' },
            config,
            onScanSuccess,
            () => {}
          );
        }

        if (cancelCameraStartRef.current) {
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
        if (!cancelCameraStartRef.current) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('already under transition')) {
            console.error('Error al iniciar escáner de cámara:', err);
            setCameraError('No se pudo acceder a la transmisión de cámara (se requiere HTTPS o permisos). Puedes usar el botón "Tomar foto con la cámara" o ingresar el código manualmente.');
          }
          setIsScanning(false);
          void stopCamera();
        }
      }
    }, 150);
  };

  // Escanear archivo de imagen capturado con la cámara nativa o subido desde galería
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingFile(true);
    setCameraError(null);

    try {
      const rawText = await decodeBarcodeFromImage(file, 'create-device-file-helper');
      const targetDevId = parseScannedDevId(rawText);
      setDevIDNO(targetDevId);
      setScanSuccess(true);
      setIsScanning(false);
      void stopCamera();
    } catch (err) {
      console.warn('No se pudo decodificar el código en CreateLocalDeviceModal:', err);
      setCameraError('No se detectó un código de barra o QR legible en la imagen. Intenta tomar la foto más de cerca con buena iluminación o escribe el device No manualmente.');
    } finally {
      setIsAnalyzingFile(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  // Resetear campos del formulario
  const resetForm = () => {
    void stopCamera();
    setIsScanning(false);
    setScanSuccess(false);
    setCameraError(null);
    setIsAnalyzingFile(false);
    setDevIDNO('');
    setSerialID('');
    setImei('');
    setSimInfo('');
    setActualCardNumber('');
    setIsSimDropdownOpen(false);
    setBrand('');
    setModel('');
    setDevType(7);
    setInstall(1);
    setServiceStatus('active');
    setErrorMessage('');
    setSelectedCompany('');
    setCustomCompanyName('');
    setSelectedVehicleVid('');
    setCustomVehiclePlate('');
  };

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  // Detener escáner al abrir/cerrar modal
  useEffect(() => {
    if (!isOpen || !isScanning) {
      void stopCamera();
    }
  }, [isOpen, isScanning, stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      fetchedFallbackRef.current = false;
      return;
    }

    if (fetchedFallbackRef.current) return;
    fetchedFallbackRef.current = true;

    if (!companiesList || companiesList.length === 0) {
      fetch(`/api/local-companies?t=${Date.now()}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data.companys) ? data.companys : Array.isArray(data.infos) ? data.infos : [];
          setInternalCompanies(list);
        })
        .catch((err) => { console.warn('Error cargando compañías:', err); });
    }

    if (!vehiclesList || vehiclesList.length === 0) {
      fetch(`/api/local-vehicles?t=${Date.now()}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data.infos) ? data.infos : [];
          setInternalVehicles(list);
        })
        .catch((err) => { console.warn('Error cargando vehículos:', err); });
    }

    if (!simsList || simsList.length === 0) {
      fetch('/api/local-sims')
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data.infos) ? data.infos : [];
          setInternalSims(list);
        })
        .catch((err) => { console.warn('Error cargando SIM cards:', err); });
    }
  }, [isOpen, companiesList, vehiclesList, simsList]);

  const effectiveCompanies = useMemo(() => {
    return companiesList && companiesList.length > 0 ? companiesList : internalCompanies;
  }, [companiesList, internalCompanies]);

  const effectiveVehicles = useMemo(() => {
    return vehiclesList && vehiclesList.length > 0 ? vehiclesList : internalVehicles;
  }, [vehiclesList, internalVehicles]);

  const effectiveSims = useMemo(() => {
    return simsList && simsList.length > 0 ? simsList : internalSims;
  }, [simsList, internalSims]);

  const filteredSims = useMemo(() => {
    const term = simInfo.trim().toLowerCase();
    if (!term) return effectiveSims;
    return effectiveSims.filter((s) => {
      const simVal = String(s.simCard || '').toLowerCase();
      const cardVal = String(s.cardNum || '').toLowerCase();
      const compVal = String(s.companyName || '').toLowerCase();
      const provVal = String(s.serviceProvider || '').toLowerCase();
      return (
        simVal.includes(term) ||
        cardVal.includes(term) ||
        compVal.includes(term) ||
        provVal.includes(term)
      );
    });
  }, [effectiveSims, simInfo]);

  const handleSelectSim = (sim: SimRecord) => {
    const chosenSim = sim.simCard ? String(sim.simCard).trim() : '';
    const chosenCardNum = sim.cardNum ? String(sim.cardNum).trim() : '';
    setSimInfo(chosenSim);
    setActualCardNumber(chosenCardNum);
    setIsSimDropdownOpen(false);
  };

  const handleSimInputChange = (val: string) => {
    setSimInfo(val);
    setIsSimDropdownOpen(true);
    const matched = effectiveSims.find(
      (s) => s.simCard && String(s.simCard).trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (matched && matched.cardNum) {
      setActualCardNumber(String(matched.cardNum).trim());
    }
  };

  // Cerrar dropdown del combobox al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (simComboboxRef.current && !simComboboxRef.current.contains(e.target as Node)) {
        setIsSimDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableCompanies = Array.from(
    new Set([
      // Lista fija sólo en modo local; con BD se usan únicamente las empresas de la tabla companies
      ...(USE_LOCAL_DATA ? DEFAULT_COMPANY_OPTIONS : []),
      ...effectiveCompanies.map((c) => c.name).filter((n): n is string => Boolean(n)),
    ])
  );

  const filteredVehiclesForCompany = useMemo(() => {
    if (!selectedCompany || install !== 1) return [];
    const compLower = selectedCompany.trim().toLowerCase();

    return effectiveVehicles.filter((v) => {
      const vComName = String(v.com?.name ?? v.com?.companyName ?? '').trim().toLowerCase();
      if (vComName && vComName === compLower) return true;

      const vCompanyName = String(v.companyName ?? '').trim().toLowerCase();
      if (vCompanyName && vCompanyName === compLower) return true;

      const matchedCompanyObj = effectiveCompanies.find(
        (c) => c.name?.trim().toLowerCase() === compLower
      );
      if (matchedCompanyObj && matchedCompanyObj.id !== undefined && matchedCompanyObj.id !== null) {
        const targetId = String(matchedCompanyObj.id);
        if (String(v.com?.companyId ?? v.com?.id ?? v.companyId) === targetId) {
          return true;
        }
      }

      return false;
    });
  }, [selectedCompany, install, effectiveVehicles, effectiveCompanies]);

  // Fecha de asignación en vivo: solo si se selecciona un vehículo (instalado)
  const previewAssignmentDate = useMemo(() => {
    const hasVeh =
      (selectedVehicleVid && selectedVehicleVid !== '__REGISTER_NEW_VEHICLE__') ||
      (selectedVehicleVid === '__REGISTER_NEW_VEHICLE__' && customVehiclePlate.trim());
    if (install !== 1 || !hasVeh) return null;
    return formatDate();
  }, [install, selectedVehicleVid, customVehiclePlate]);

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const fieldError = firstFieldError([
      ['devidno', devIDNO],
      ['serialId', serialID],
      ['imei', imei],
      ['deviceBrand', brand],
      ['deviceModel', model],
      ['simRef', simInfo],
      ['cardRef', actualCardNumber],
      ['companyName', customCompanyName],
      ['plate', customVehiclePlate],
    ]);
    if (fieldError) {
      setErrorMessage(fieldError);
      return;
    }

    if (!devIDNO.trim()) {
      setErrorMessage('El device No es obligatorio.');
      return;
    }

    let finalCompany = selectedCompany;
    if (selectedCompany === '__REGISTER_NEW_COMPANY__') {
      const trimmed = customCompanyName.trim();
      if (!trimmed) {
        setErrorMessage('El nombre de la nueva empresa es obligatorio.');
        return;
      }
      finalCompany = trimmed;
      void fetch('/api/local-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: finalCompany }),
      }).catch(() => {});
    }

    let finalVehicleVid = selectedVehicleVid;
    if (selectedVehicleVid === '__REGISTER_NEW_VEHICLE__') {
      const trimmedPlate = customVehiclePlate.trim().toUpperCase();
      if (!trimmedPlate) {
        setErrorMessage('La patente o identificador del nuevo vehículo es obligatorio.');
        return;
      }
      finalVehicleVid = trimmedPlate;
      void fetch('/api/local-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vid: finalVehicleVid,
          lp: finalVehicleVid,
          companyName: finalCompany,
        }),
      }).catch(() => {});
    }

    if (install === 1) {
      if (!finalCompany) {
        setErrorMessage('La Empresa es obligatoria para dispositivos instalados.');
        return;
      }
      if (!finalVehicleVid) {
        setErrorMessage('El Vehículo Asignado es obligatorio para dispositivos instalados.');
        return;
      }
    }

    if (!devType) {
      setErrorMessage('El Tipo de Dispositivo es obligatorio.');
      return;
    }

    const finalBrand = brand.trim() || 'Sin Asignar';
    const finalModel = model.trim() || 'Sin Asignar';

    const matchedCompanyObj = effectiveCompanies.find(
      (c) => c.name?.trim().toLowerCase() === finalCompany.trim().toLowerCase()
    );
    const compId = matchedCompanyObj?.id ? Number(matchedCompanyObj.id) : 1;
    
    // Solo generar fecha de encuadernación si tiene un vehículo asignado (instalado)
    const hasAssignedVehicle = install === 1 && Boolean(finalVehicleVid);
    const nowTimestamp = Date.now();
    const todayStr = formatDate(nowTimestamp);

    // Generar código QR en Base64 combinando devIDNO e IMEI
    let generatedQrCode: string | null = null;
    try {
      const qrPayload = JSON.stringify({
        devIDNO: devIDNO.trim(),
        imei: imei.trim() || null,
      });
      generatedQrCode = await QRCode.toDataURL(qrPayload, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff',
        },
      });
    } catch (qrErr) {
      console.warn('Error generando código QR para dispositivo:', qrErr);
    }

    const newDevice: DeviceRecord = {
      id: Date.now(),
      devIDNO: devIDNO.trim(),
      companyId: install === 1 ? compId : null,
      companyName: install === 1 ? finalCompany : null,
      devType,
      type: devType,
      serialID: serialID.trim() || null,
      imei: imei.trim() || null,
      qrCode: generatedQrCode,
      actualCardNumber: actualCardNumber.trim() || null,
      brand: finalBrand,
      model: finalModel,
      install,
      serviceStatus,
      assignmentDate: hasAssignedVehicle ? todayStr : null,
      registrationDate: todayStr,
      stlTm: null,
      stlTmStr: null,
      vehiIdno: hasAssignedVehicle ? finalVehicleVid : null,
      simInfo: simInfo.trim() || null,
      chnName: devType === 7 ? 'CH1,CH2,CH3,CH4' : null,
      stlTmEx: null,
      stlTmExStr: null,
      factoryDevType: devType === 7 ? (install === 1 ? 1 : 0) : 0,
      checkStatus: null,
      checkTime: null,
      checkTimeStr: null,
      ifMainDefense: 0,
    };

    onAddDevice(newDevice);

    setDevIDNO('');
    setSerialID('');
    setImei('');
    setSimInfo('');
    setActualCardNumber('');
    setBrand('');
    setModel('');
    setDevType(7);
    setInstall(1);
    setSelectedCompany('');
    setSelectedVehicleVid('');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 animate-in fade-in duration-200 notranslate"
      translate="no"
    >
      <div className="w-full sm:max-w-2xl bg-white dark:bg-[#161b22] rounded-t-2xl sm:rounded-2xl border border-[#e8e9ed] dark:border-[#30363d] shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Header fijo */}
        <div className="shrink-0 flex items-center justify-between border-b border-[#e8e9ed] dark:border-[#30363d] px-5 py-4 bg-white dark:bg-[#161b22]">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#3a435d] dark:bg-[#21262d] p-2.5 text-[#00acee]">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#3a435d] dark:text-white">
                {t('modal_agregar_dispositivo')}
              </h3>
              <p className="text-xs text-[#5c647b] dark:text-gray-400">
                {t('modal_dispositivo_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            type="button"
            className="rounded-lg p-2 text-gray-400 hover:bg-[#e8e9ed]/50 dark:hover:bg-[#21262d] hover:text-[#3a435d] dark:hover:text-white transition-colors cursor-pointer min-w-11 min-h-11 flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body con scroll */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:py-5">

        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 text-xs font-medium text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <form id="device-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 font-sans">

          {/* Sección de Escaneo con Cámara / Código de Barras */}
          <div className="rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#0d1117] p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scan className="w-4 h-4 sm:w-5 sm:h-5 text-[#00acee]" />
                <span className="text-xs sm:text-sm font-bold text-[#3a435d] dark:text-gray-200 uppercase tracking-wider">
                  Escáner de Cámara
                </span>
              </div>
              {!isScanning ? (
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00acee] hover:bg-[#0098d4] text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{t('activar_camara') || 'Activar Cámara'}</span>
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
                  <span>{t('detener_camara') || 'Detener Cámara'}</span>
                </button>
              )}
            </div>

            {/* Hidden inputs para captura nativa o galería */}
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
                <div id="device-barcode-reader" className="w-full h-full min-h-65 md:min-h-75" />
              </div>
            )}

            {isAnalyzingFile && (
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 animate-pulse">
                <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                <span>{t('analizando_codigo_foto') || 'Analizando código en la imagen...'}</span>
              </div>
            )}

            {/* BOTONES ADICIONALES: TOMAR FOTO CON CÁMARA O SUBIR DE GALERÍA */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isAnalyzingFile}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-indigo-200" />
                <span>{t('tomar_foto_camara') || 'Tomar foto con la cámara'}</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isAnalyzingFile}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#21262d] dark:hover:bg-[#30363d] active:scale-98 text-slate-700 dark:text-gray-200 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-[#30363d] shadow-2xs"
                title="Abrir galería de fotos"
              >
                <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t('buscar_imagen_galeria') || 'Buscar imagen (Galería)'}</span>
              </button>
            </div>

            {cameraError && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Badge de Escaneo Exitoso */}
            {scanSuccess && devIDNO && (
              <div className="p-3.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in zoom-in-95">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Código detectado e ingresado en DEVIDNO: <span className="font-mono underline">{devIDNO}</span></span>
              </div>
            )}
          </div>

          {/* Fila 1: device No & serie de dispositivo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#00acee]" />
                {t('modal_id_dispositivo_label')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={devIDNO}
                maxLength={MAX_LENGTHS.device.devidno}
                onChange={(e) => setDevIDNO(e.target.value)}
                placeholder="Ej. 4142434445"
                className="w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#0d1117] py-3 px-4 text-sm sm:text-base text-[#3a435d] dark:text-white font-mono font-bold outline-none focus:border-[#00acee] focus:ring-2 focus:ring-[#00acee]/20 transition-all shadow-2xs"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2 flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                {t('serie_dispositivo')}
              </label>
              <input
                type="text"
                value={serialID}
                maxLength={MAX_LENGTHS.device.serial_id}
                onChange={(e) => setSerialID(e.target.value)}
                placeholder="Ej. 4142434445"
                className="w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#0d1117] py-3 px-4 text-sm sm:text-base text-[#3a435d] dark:text-white font-mono outline-none focus:border-[#00acee] focus:ring-2 focus:ring-[#00acee]/20 transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Fila 2: IMEI & SimCard (Combobox que autocompleta actualCardNumber) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2 flex items-center gap-2">
                <Barcode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                IMEI
              </label>
              <input
                type="text"
                value={imei}
                maxLength={IMEI_LENGTH}
                inputMode="numeric"
                onChange={(e) => setImei(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej. 490154203237518"
                className="w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#0d1117] py-3 px-4 text-sm sm:text-base text-[#3a435d] dark:text-white font-mono outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all shadow-2xs"
              />
            </div>

            {/* SimCard Combobox */}
            <div className="relative" ref={simComboboxRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  SimCard
                </label>
                {simInfo && (
                  <button
                    type="button"
                    onClick={() => {
                      setSimInfo('');
                      setActualCardNumber('');
                    }}
                    className="text-[11px] text-gray-400 hover:text-red-500 font-semibold cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={simInfo}
                  maxLength={MAX_LENGTHS.simcard.simcard}
                  onChange={(e) => handleSimInputChange(e.target.value)}
                  onFocus={() => setIsSimDropdownOpen(true)}
                  placeholder="Selecciona o escribe un SimCard..."
                  className="w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#0d1117] py-3 pl-4 pr-10 text-sm sm:text-base text-[#3a435d] dark:text-white font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-2xs"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setIsSimDropdownOpen((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-1"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSimDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Desplegable del Combobox con todos los SimCards */}
              {isSimDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#161b22] shadow-xl py-1 animate-in fade-in-50 duration-150">
                  {filteredSims.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-center">
                      No se encontraron SimCards que coincidan
                    </div>
                  ) : (
                    filteredSims.map((sim, idx) => {
                      const isSelected = sim.simCard && String(sim.simCard).trim() === simInfo.trim();
                      return (
                        <div
                          key={`sim-opt-${sim.id ?? idx}-${sim.simCard}`}
                          onClick={() => handleSelectSim(sim)}
                          className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs sm:text-sm ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-bold'
                              : 'hover:bg-slate-50 dark:hover:bg-[#21262d] text-[#3a435d] dark:text-gray-200'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold">{sim.simCard || '(Sin SimCard)'}</span>
                              {sim.serviceProvider && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  {sim.serviceProvider}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                              <span>Tel: <strong className="font-mono">{sim.cardNum || 'N/A'}</strong></span>
                              {sim.companyName && <span>• {sim.companyName}</span>}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fila 3: Actual Card Number & Tipo de Dispositivo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Actual Card Number
                </span>
                {actualCardNumber && simInfo && (
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    Asociado a SimCard
                  </span>
                )}
              </label>
              <input
                type="text"
                value={actualCardNumber}
                maxLength={MAX_LENGTHS.simcard.card_number}
                onChange={(e) => setActualCardNumber(e.target.value)}
                placeholder="Ej. +56987654321"
                className="w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#0d1117] py-3 px-4 text-sm sm:text-base text-[#3a435d] dark:text-white font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2">
                {t('modal_tipo_dispositivo_label')} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDevType(7)}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                    devType === 7
                      ? 'border-[#00acee] bg-[#00acee]/10 dark:bg-[#00acee]/20 text-[#3a435d] dark:text-[#38bdf8] shadow-xs'
                      : 'border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#1a2230] text-[#5c647b] dark:text-gray-400 hover:bg-[#e8e9ed]/50 dark:hover:bg-[#242f42]'
                  }`}
                >
                  <Cpu className="h-4 w-4 text-[#00acee]" />
                  <span>7 - DVR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDevType(5)}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                    devType === 5
                      ? 'border-indigo-500 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 shadow-xs'
                      : 'border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#1a2230] text-[#5c647b] dark:text-gray-400 hover:bg-[#e8e9ed]/50 dark:hover:bg-[#242f42]'
                  }`}
                >
                  <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>5 - GPS</span>
                </button>
              </div>
            </div>
          </div>

          {/* Fila 4: Marca & Modelo (Opcionales) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200">
                  {t('modal_marca_label')}
                </label>
                {onOpenManageCatalog && (
                  <button
                    type="button"
                    onClick={onOpenManageCatalog}
                    className="text-xs font-bold text-[#00acee] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                    title="Administrar catálogo de marcas y modelos"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>Gestionar</span>
                  </button>
                )}
              </div>
              <CreatableSelect
                value={brand}
                onChange={(val) => {
                  setBrand(val);
                  if (val === 'Sin Asignar') {
                    setModel('Sin Asignar');
                  } else if (model === 'Sin Asignar') {
                    setModel('');
                  }
                }}
                options={brands}
                placeholder={t('modal_selecciona_marca')}
                addLabel={t('modal_agregar_marca')}
                inputPlaceholder={t('modal_escribe_marca')}
                cancelLabel={t('modal_volver_lista')}
              />
            </div>

            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2">
                {t('modal_modelo_label')}
              </label>
              <CreatableSelect
                key={brand.trim().toLowerCase()}
                value={model}
                onChange={setModel}
                options={brand.trim() ? modelsForBrand(brand) : []}
                placeholder={t('modal_selecciona_modelo')}
                addLabel={t('modal_agregar_modelo')}
                inputPlaceholder={t('modal_escribe_modelo')}
                cancelLabel={t('modal_volver_lista')}
              />
            </div>
          </div>

          {/* Fila 5: Estado install y Estado de Servicio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2">
                {t('modal_estado_instalacion_label')} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setInstall(1);
                    setServiceStatus('active');
                  }}
                  className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    install === 1
                      ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 shadow-xs'
                      : 'border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#1a2230] text-[#5c647b] dark:text-gray-400 hover:bg-[#e8e9ed]/50 dark:hover:bg-[#242f42]'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">1 - {t('modal_instalado_vendido')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInstall(0);
                    setServiceStatus('inactive');
                    setSelectedCompany('');
                    setSelectedVehicleVid('');
                  }}
                  className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    install === 0
                      ? 'border-amber-500 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 shadow-xs'
                      : 'border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#1a2230] text-[#5c647b] dark:text-gray-400 hover:bg-[#e8e9ed]/50 dark:hover:bg-[#242f42]'
                  }`}
                >
                  <Tag className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">0 - {t('modal_no_instalado_disponible')}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00acee]" />
                {t('estado_servicio_label') || 'Estado de Servicio'} <span className="text-red-500">*</span>
              </label>
              <select
                value={serviceStatus}
                onChange={(e) => setServiceStatus(e.target.value as 'active' | 'inactive')}
                className="w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#0d1117] py-3 px-4 text-sm sm:text-base font-semibold text-[#3a435d] dark:text-white outline-none focus:border-[#00acee] focus:ring-2 focus:ring-[#00acee]/20 transition-all shadow-2xs cursor-pointer"
              >
                <option value="active">🟢 {t('servicio_activo') || 'Servicio Activo'}</option>
                <option value="inactive">🟠 {t('sin_servicio') || 'Sin Servicio'}</option>
              </select>
            </div>
          </div>

          {/* Fila 6: Empresa y Vehículo Asignado */}
          <div className="pt-3 border-t border-[#e8e9ed] dark:border-[#30363d] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#00acee]" />
                  {t('modal_compania_label')} {install === 1 && <span className="text-red-500">*</span>}
                </label>
                <select
                  disabled={install !== 1}
                  value={selectedCompany}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCompany(val);
                    if (val !== '__REGISTER_NEW_COMPANY__') {
                      setCustomCompanyName('');
                    }
                    setSelectedVehicleVid('');
                    setCustomVehiclePlate('');
                  }}
                  className={`w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] py-3 px-4 text-sm sm:text-base font-semibold outline-none transition-all shadow-2xs ${
                    install !== 1
                      ? 'bg-gray-100 dark:bg-[#161b22] text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-white dark:bg-[#0d1117] text-[#3a435d] dark:text-white focus:border-[#00acee] focus:ring-2 focus:ring-[#00acee]/20 cursor-pointer'
                  }`}
                  required={install === 1}
                >
                  <option value="">
                    {install === 1 ? t('modal_selecciona_compania') : t('modal_no_aplica_no_instalado')}
                  </option>
                  {install === 1 && (
                    <option value="__REGISTER_NEW_COMPANY__" className="font-bold text-blue-600 dark:text-blue-400">
                      {t('registrar_empresa_opcion') || '+ Registrar Empresa / Cliente...'}
                    </option>
                  )}
                  {availableCompanies.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
                {install === 1 && selectedCompany === '__REGISTER_NEW_COMPANY__' && (
                  <div className="mt-2.5 p-3 bg-blue-50/70 dark:bg-[#0c1c2e] border border-blue-200 dark:border-[#1e3a5f] rounded-xl space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        {t('nombre_nueva_empresa') || 'Registrar nueva empresa / cliente:'} <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCompany('');
                          setCustomCompanyName('');
                        }}
                        className="text-[11px] text-gray-400 hover:text-red-600 font-semibold cursor-pointer"
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
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0d1117] border border-blue-300 dark:border-blue-700 rounded-lg text-sm font-semibold text-[#3a435d] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                      autoFocus
                    />
                  </div>
                )}
                {install !== 1 && (
                  <p className="text-xs text-gray-400 mt-1.5 italic">
                    {t('modal_solo_instalado')}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-bold uppercase tracking-wider text-[#3a435d] dark:text-gray-200 mb-2 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {t('modal_vehiculo_label')} {install === 1 && <span className="text-red-500">*</span>}
                </label>
                <select
                  disabled={install !== 1 || !selectedCompany}
                  value={selectedVehicleVid}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedVehicleVid(val);
                    if (val !== '__REGISTER_NEW_VEHICLE__') {
                      setCustomVehiclePlate('');
                    }
                  }}
                  className={`w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] py-3 px-4 text-sm sm:text-base font-semibold outline-none transition-all font-mono shadow-2xs ${
                    install !== 1 || !selectedCompany
                      ? 'bg-gray-100 dark:bg-[#161b22] text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-white dark:bg-[#0d1117] text-[#3a435d] dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer'
                  }`}
                  required={install === 1}
                >
                  <option value="">
                    {install !== 1
                      ? t('modal_no_aplica_no_instalado')
                      : !selectedCompany
                      ? t('modal_primero_compania')
                      : t('modal_selecciona_vehiculo')}
                  </option>
                  {install === 1 && selectedCompany && (
                    <option value="__REGISTER_NEW_VEHICLE__" className="font-bold text-emerald-600 dark:text-emerald-400">
                      {t('registrar_vehiculo_opcion') || '+ Registrar Vehículo Asignado...'}
                    </option>
                  )}
                  {install === 1 &&
                    selectedCompany &&
                    filteredVehiclesForCompany.map((veh) => {
                      const vid = String(veh.vid ?? veh.vehiIdno ?? veh.id ?? '');
                      const plate = veh.lp || (veh.vehiIdno !== vid ? veh.vehiIdno : '');
                      const plateText = plate ? ` (${t('patente')}: ${plate})` : '';
                      return (
                        <option key={`veh-opt-${vid}`} value={vid}>
                          {vid}{plateText}
                        </option>
                      );
                    })}
                </select>

                {install === 1 && selectedCompany && selectedVehicleVid === '__REGISTER_NEW_VEHICLE__' && (
                  <div className="mt-2.5 p-3 bg-emerald-50/70 dark:bg-[#0c2317] border border-emerald-200 dark:border-[#14532d] rounded-xl space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        {t('patente_nuevo_vehiculo') || 'Registrar nuevo vehículo asignado (Patente):'} <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVehicleVid('');
                          setCustomVehiclePlate('');
                        }}
                        className="text-[11px] text-gray-400 hover:text-red-600 font-semibold cursor-pointer"
                      >
                        {t('cancelar') || 'Cancelar'}
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={customVehiclePlate}
                      maxLength={MAX_LENGTHS.vehicle.plate_number}
                      onChange={(e) => setCustomVehiclePlate(e.target.value.toUpperCase())}
                      placeholder="Ej: AB-123-CD o ABCD-12"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0d1117] border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm font-mono font-bold text-[#3a435d] dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs uppercase"
                      autoFocus
                    />
                  </div>
                )}

                {install === 1 && selectedCompany && selectedCompany !== '__REGISTER_NEW_COMPANY__' && selectedVehicleVid !== '__REGISTER_NEW_VEHICLE__' && (
                  filteredVehiclesForCompany.length === 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5 font-medium">
                      {t('modal_no_vehiculos')} {selectedCompany}.
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5 font-medium">
                      {t('modal_mostrando_vehiculos')} {filteredVehiclesForCompany.length} {t('modal_vehiculos_asociados')} {selectedCompany}.
                    </p>
                  )
                )}
              </div>
            </div>

            {/* Fecha de Asignación */}
            <div className="p-4 rounded-xl bg-[#f8f9fc] dark:bg-[#131722] border border-[#e8e9ed] dark:border-[#30363d] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-[#5c647b] dark:text-gray-400">
              <div className="flex items-center gap-2 font-medium">
                <Clock className="w-4 h-4 text-[#00acee]" />
                <span>{t('fecha_asignacion') || 'Fecha de Asignación'}</span>
              </div>
              <span className="font-mono font-bold text-[#3a435d] dark:text-gray-200 bg-white dark:bg-[#1a202c] px-3 py-1.5 rounded-md border border-[#e8e9ed] dark:border-[#30363d]">
                {previewAssignmentDate ? previewAssignmentDate : t('sin_fecha_asignada')}
              </span>
            </div>

            {/* Generación Automática de Código QR */}
            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-[#1a1226] border border-purple-200/80 dark:border-[#4c1d95] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-purple-900 dark:text-purple-200">
              <div className="flex items-center gap-2 font-medium">
                <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>{t('generacion_codigo_qr')}</span>
              </div>
              <span className="font-mono text-xs sm:text-sm font-semibold text-purple-700 dark:text-purple-300 bg-white dark:bg-[#241738] px-3 py-1.5 rounded-md border border-purple-200 dark:border-[#581c87]">
                {devIDNO.trim() ? `${t('qr_listo')} (ID: ${devIDNO.trim()}${imei.trim() ? ` | IMEI: ${imei.trim()}` : ''})` : t('ingresa_devidno_qr')}
              </span>
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e8e9ed] dark:border-[#30363d]">
            <button
              type="button"
              onClick={handleModalClose}
              className="rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#1a2230] px-5 py-3 text-sm font-bold text-[#5c647b] dark:text-gray-300 hover:bg-[#e8e9ed]/50 dark:hover:bg-[#242f42] transition-colors cursor-pointer min-h-11"
            >
              {t('modal_cancelar')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-[#00acee] hover:bg-[#0099d4] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all cursor-pointer min-h-11"
            >
              <Plus className="h-4 w-4 text-white" />
              <span>{t('modal_guardar_dispositivo')}</span>
            </button>
          </div>
        </form>
        </div>{/* fin body-scroll */}
      </div>
    </div>
  );
}

