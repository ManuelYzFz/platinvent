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
  Sparkles,
  ArrowDownToLine,
  RotateCcw,
  CheckCheck,
  Copy,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { DeviceRecord, VehicleRecord, SimRecord } from '@/lib/types/inventory';
import { useTranslation } from '@/lib/i18n';
import { DEFAULT_COMPANY_OPTIONS, BRAND_OPTIONS, MODEL_OPTIONS, USE_LOCAL_DATA } from '@/lib/constants';
import { MAX_LENGTHS, IMEI_LENGTH, firstFieldError } from '@/lib/validation/inventory';
import { formatDate } from '@/lib/utils/date-format';
import { decodeBarcodeFromImage, decodeAllBarcodesFromImage, extractAllLabelDataFromImage } from '@/lib/utils/barcode-decoder';
import { parseDeviceLabelData, type ParsedDeviceLabel } from '@/lib/utils/device-label-parser';
import CreatableSelect from '@/components/common/CreatableSelect';
import { useDeviceOptions } from '@/components/devices/useDeviceOptions';
import { useScrollLock } from '@/lib/utils/useScrollLock';

export { BRAND_OPTIONS, MODEL_OPTIONS };

interface CreateLocalDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDevice: (newDevice: DeviceRecord) => void;
  onOpenManageCatalog?: () => void;
  companiesList?: { id?: string | number; name?: string }[];
  vehiclesList?: VehicleRecord[];
  simsList?: SimRecord[];
  initialImei?: string;
}

export default function CreateLocalDeviceModal({
  isOpen,
  onClose,
  onAddDevice,
  onOpenManageCatalog,
  companiesList = [],
  vehiclesList = [],
  simsList = [],
  initialImei,
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
  const [capturedInfo, setCapturedInfo] = useState<ParsedDeviceLabel | null>(null);
  const [fillFeedback, setFillFeedback] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
            } catch { }
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
          try { html5Qrcode.clear(); } catch { }
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

        const liveCodes: string[] = [];
        let autoCloseTimeout: NodeJS.Timeout | null = null;

        const onScanSuccess = (decodedText: string) => {
          const trimmed = decodedText.trim();
          if (trimmed && !liveCodes.includes(trimmed)) {
            liveCodes.push(trimmed);
          }
          const parsed = parseDeviceLabelData(liveCodes);
          setCapturedInfo(parsed);
          setScanSuccess(true);

          // Si ya detectó ambos (devIDNO e IMEI), cerrar inmediatamente la cámara
          if (parsed.devIDNO && parsed.imei) {
            if (autoCloseTimeout) clearTimeout(autoCloseTimeout);
            setIsScanning(false);
            void stopCamera();
            return;
          }

          // Si solo tiene 1 dato, dar un margen de 5 segundos para intentar captar el segundo código
          if (!autoCloseTimeout) {
            autoCloseTimeout = setTimeout(() => {
              setIsScanning(false);
              void stopCamera();
            }, 5000);
          }
        };

        try {
          await html5Qrcode.start(
            { facingMode: 'environment' },
            config,
            onScanSuccess,
            () => { }
          );
        } catch (envErr) {
          if (cancelCameraStartRef.current) return;
          console.warn('Fallo facingMode environment en CreateLocalDeviceModal, reintentando user:', envErr);
          await html5Qrcode.start(
            { facingMode: 'user' },
            config,
            onScanSuccess,
            () => { }
          );
        }

        if (cancelCameraStartRef.current) {
          try {
            if (html5Qrcode.isScanning) {
              await html5Qrcode.stop();
            }
            html5Qrcode.clear();
          } catch { }
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

  // Capturar fotograma de la cámara activa y analizarlo
  const capturePhotoFromVideo = async () => {
    const readerElement = document.getElementById('device-barcode-reader');
    const video = readerElement?.querySelector('video');
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Esperando que la cámara enfoque... Intenta de nuevo en un segundo.');
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
          const rawCodes = await extractAllLabelDataFromImage(file, 'create-device-file-helper');
          const parsed = parseDeviceLabelData(rawCodes);
          if (!parsed.hasAnyData && rawCodes.length === 0) {
            throw new Error('No se detectó un código legible en la captura.');
          }
          setCapturedInfo(parsed);
          setScanSuccess(true);
          void stopCamera();
        }
      }
    } catch (err) {
      console.warn('Error al capturar foto desde la cámara:', err);
      setCameraError('No se detectó un código nítido en el momento del disparo. Acerca más la cámara a la etiqueta con buena iluminación.');
    } finally {
      setIsAnalyzingFile(false);
    }
  };

  // Manejar clic en "Tomar foto": si hay cámara web abre la cámara, si no recurre a la cámara nativa
  const handleTakePhotoClick = async () => {
    setCameraError(null);

    // Si la cámara ya está activa, capturar la foto
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

  // Escanear archivo de imagen capturado con la cámara nativa o subido desde galería
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingFile(true);
    setCameraError(null);

    try {
      const rawCodes = await extractAllLabelDataFromImage(file, 'create-device-file-helper');
      const parsed = parseDeviceLabelData(rawCodes);
      if (!parsed.hasAnyData && rawCodes.length === 0) {
        throw new Error('No se detectaron códigos válidos en la imagen.');
      }
      setCapturedInfo(parsed);
      setScanSuccess(true);
      setIsScanning(false);
      void stopCamera();
    } catch (err) {
      console.warn('No se pudo decodificar el código en CreateLocalDeviceModal:', err);
      setCameraError('No se detectó un código de barra o QR legible en la imagen. Intenta tomar la foto más de cerca con buena iluminación o escribe los datos manualmente.');
    } finally {
      setIsAnalyzingFile(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  // Rellenar campos del formulario con la información captada
  const handleApplyCapturedData = (specificField?: 'devIDNO' | 'imei' | 'serialID' | 'brand' | 'model') => {
    if (!capturedInfo) return;

    if (specificField) {
      if (specificField === 'devIDNO' && capturedInfo.devIDNO) {
        setDevIDNO(capturedInfo.devIDNO);
        setFillFeedback('ID de Dispositivo aplicado.');
      } else if (specificField === 'imei' && capturedInfo.imei) {
        setImei(capturedInfo.imei);
        setFillFeedback('IMEI aplicado.');
      } else if (specificField === 'serialID' && capturedInfo.serialID) {
        setSerialID(capturedInfo.serialID);
        setFillFeedback('Número de Serie aplicado.');
      } else if (specificField === 'brand' && capturedInfo.brand) {
        setBrand(capturedInfo.brand);
        setFillFeedback('Marca aplicada.');
      } else if (specificField === 'model' && capturedInfo.model) {
        setModel(capturedInfo.model);
        setFillFeedback('Modelo aplicado.');
      }
    } else {
      let appliedCount = 0;
      if (capturedInfo.devIDNO) {
        setDevIDNO(capturedInfo.devIDNO);
        appliedCount++;
      }
      if (capturedInfo.imei) {
        setImei(capturedInfo.imei);
        appliedCount++;
      }
      if (capturedInfo.serialID) {
        setSerialID(capturedInfo.serialID);
        appliedCount++;
      }
      if (capturedInfo.brand && !brand) {
        setBrand(capturedInfo.brand);
        appliedCount++;
      }
      if (capturedInfo.model && !model) {
        setModel(capturedInfo.model);
        appliedCount++;
      }

      setFillFeedback(`¡Información aplicada! Se rellenaron ${appliedCount} campos en el formulario.`);
    }

    setTimeout(() => setFillFeedback(null), 4000);
  };

  // Quitar campo específico del formulario en caso de error
  const handleRemoveAppliedData = (specificField: 'devIDNO' | 'imei' | 'serialID' | 'brand' | 'model') => {
    if (specificField === 'devIDNO') {
      setDevIDNO('');
      setFillFeedback('ID de Dispositivo quitado del formulario.');
    } else if (specificField === 'imei') {
      setImei('');
      setFillFeedback('IMEI quitado del formulario.');
    } else if (specificField === 'serialID') {
      setSerialID('');
      setFillFeedback('Número de Serie quitado del formulario.');
    } else if (specificField === 'brand') {
      setBrand('');
      setFillFeedback('Marca quitada del formulario.');
    } else if (specificField === 'model') {
      setModel('');
      setFillFeedback('Modelo quitado del formulario.');
    }
    setTimeout(() => setFillFeedback(null), 3000);
  };

  const handleClearCaptured = () => {
    setCapturedInfo(null);
    setScanSuccess(false);
    setFillFeedback(null);
  };

  const handleCopyValue = (val: string, key: string) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Resetear campos del formulario
  const resetForm = () => {
    void stopCamera();
    setIsScanning(false);
    setScanSuccess(false);
    setCameraError(null);
    setIsAnalyzingFile(false);
    setCapturedInfo(null);
    setFillFeedback(null);
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

  // Si se abre con un código o IMEI pre-escaneado
  useEffect(() => {
    if (isOpen && initialImei) {
      setImei(initialImei);
      setDevIDNO(initialImei);
    }
  }, [isOpen, initialImei]);

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

  useScrollLock(isOpen);

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
      }).catch(() => { });
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
      }).catch(() => { });
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overscroll-contain notranslate"
      onWheel={(e) => e.stopPropagation()}
      translate="no"
    >
      <div className="w-full sm:max-w-2xl bg-white dark:bg-[#162032] rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-white/14 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Header fijo */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 py-4 bg-slate-50/70 dark:bg-[#121927]">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#00A3E0]/10 dark:bg-[#00A3E0]/15 p-2.5 text-[#00A3E0] border border-[#00A3E0]/20">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('modal_agregar_dispositivo')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('modal_dispositivo_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer min-w-11 min-h-11 flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body con scroll */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:py-5">

          {errorMessage && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <form id="device-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 font-sans">

            {/* Sección de Escaneo con Cámara / Código de Barras */}
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#0F1726] p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scan className="w-4 h-4 sm:w-5 sm:h-5 text-[#00A3E0]" />
                  <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Captura de Etiqueta
                  </span>
                </div>
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

              {/* Visor de Cámara con botón de captura integrado */}
              {isScanning && (
                <div className="relative rounded-xl overflow-hidden border-2 border-[#00A3E0] bg-black flex flex-col items-center justify-center animate-in fade-in">
                  <div id="device-barcode-reader" className="w-full min-h-65 md:min-h-75" />

                  {/* Barra de disparo y control de cámara */}
                  <div className="w-full bg-slate-900/95 backdrop-blur-xs p-3 flex items-center justify-between gap-3 border-t border-white/10 z-10">
                    <span className="text-[11px] text-slate-300 flex items-center gap-1.5 font-medium truncate">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                      Apunta a la etiqueta o presiona Capturar
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void capturePhotoFromVideo()}
                        disabled={isAnalyzingFile}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00A3E0] hover:bg-[#008cc0] active:scale-95 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
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
                </div>
              )}

              {isAnalyzingFile && (
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 animate-pulse">
                  <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  <span>{t('analizando_codigo_foto') || 'Analizando código en la imagen...'}</span>
                </div>
              )}

              {/* BOTONES PRINCIPALES: ACTIVAR CÁMARA O BUSCAR IMAGEN */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  disabled={isScanning || isAnalyzingFile}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-4 h-4 text-indigo-200" />
                  <span>Activar cámara</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isAnalyzingFile}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#121927] dark:hover:bg-[#1E293B] active:scale-98 text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-white/10 shadow-2xs"
                  title="Buscar imagen en el equipo"
                >
                  <UploadCloud className="w-4 h-4 text-[#00A3E0]" />
                  <span>Buscar imagen</span>
                </button>
              </div>

              {cameraError && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* CUADRO INFORMATIVO DE DATOS CAPTADOS */}
              {capturedInfo && capturedInfo.hasAnyData && (
                <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-[#0c1f2e] p-4 sm:p-5 shadow-sm space-y-3.5 animate-in fade-in zoom-in-95">
                  {/* Encabezado del Cuadro Informativo */}
                  <div className="flex items-start justify-between gap-3 border-b border-emerald-200/80 dark:border-emerald-800/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Sparkles className="w-4 h-4 text-emerald-100" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-extrabold text-emerald-950 dark:text-emerald-200 uppercase tracking-wide flex items-center gap-2">
                          <span>Información Captada de la Etiqueta</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300">
                            {capturedInfo.rawList.length} código(s)
                          </span>
                        </h4>
                        <p className="text-[11px] sm:text-xs text-emerald-800/90 dark:text-emerald-300/80 mt-0.5">
                          El sistema analizó los datos de la etiqueta. Presiona el botón para autocompletar el formulario.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearCaptured}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Descartar esta lectura"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tarjetas de datos captados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                    {/* Tarjeta de ID / devIDNO */}
                    {capturedInfo.devIDNO ? (
                      <div className="flex flex-col justify-between p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-white dark:bg-[#0f172a] shadow-2xs overflow-hidden min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
                            <span className="flex items-center gap-1.5 text-[#00A3E0] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                              <HardDrive className="w-3.5 h-3.5 shrink-0" /> ID Dispositivo
                            </span>
                            {devIDNO === capturedInfo.devIDNO ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 whitespace-nowrap">
                                <Check className="w-3 h-3" /> En form
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 shrink-0 whitespace-nowrap">Captado</span>
                            )}
                          </div>
                          <p className="font-mono font-black text-sm sm:text-base text-slate-900 dark:text-white break-all select-all">
                            {capturedInfo.devIDNO}
                          </p>
                        </div>
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 dark:border-white/5 mt-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleCopyValue(capturedInfo.devIDNO!, 'devIDNO')}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-0.5"
                            title="Copiar ID al portapapeles"
                          >
                            {copiedKey === 'devIDNO' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-emerald-500">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                                <span>Copiar ID</span>
                              </>
                            )}
                          </button>
                          {devIDNO === capturedInfo.devIDNO ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveAppliedData('devIDNO')}
                              className="text-[11px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer transition-colors py-0.5"
                              title="Quitar este ID del formulario"
                            >
                              <span>Quitar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplyCapturedData('devIDNO')}
                              className="text-[11px] font-bold text-[#00A3E0] hover:text-[#008cc0] dark:text-[#38bdf8] cursor-pointer transition-colors py-0.5"
                              title="Usar este ID en el formulario"
                            >
                              <span>Usar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Tarjeta de IMEI */}
                    {capturedInfo.imei ? (
                      <div className="flex flex-col justify-between p-3 rounded-xl border border-purple-200 dark:border-purple-800/70 bg-white dark:bg-[#0f172a] shadow-2xs overflow-hidden min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
                            <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                              <Barcode className="w-3.5 h-3.5 shrink-0" /> IMEI
                            </span>
                            {imei === capturedInfo.imei ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 whitespace-nowrap">
                                <Check className="w-3 h-3" /> En form
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 shrink-0 whitespace-nowrap">Captado</span>
                            )}
                          </div>
                          <p className="font-mono font-black text-sm sm:text-base text-slate-900 dark:text-white break-all select-all">
                            {capturedInfo.imei}
                          </p>
                        </div>
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 dark:border-white/5 mt-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleCopyValue(capturedInfo.imei!, 'imei')}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-0.5"
                            title="Copiar IMEI al portapapeles"
                          >
                            {copiedKey === 'imei' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-emerald-500">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                                <span>Copiar IMEI</span>
                              </>
                            )}
                          </button>
                          {imei === capturedInfo.imei ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveAppliedData('imei')}
                              className="text-[11px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer transition-colors py-0.5"
                              title="Quitar este IMEI del formulario"
                            >
                              <span>Quitar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplyCapturedData('imei')}
                              className="text-[11px] font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 cursor-pointer transition-colors py-0.5"
                              title="Usar este IMEI en el formulario"
                            >
                              <span>Usar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Tarjeta de Serial ID */}
                    {capturedInfo.serialID ? (
                      <div className="flex flex-col justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-2xs overflow-hidden min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
                            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                              <Hash className="w-3.5 h-3.5 shrink-0" /> Serie
                            </span>
                            {serialID === capturedInfo.serialID ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 whitespace-nowrap">
                                <Check className="w-3 h-3" /> En form
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 shrink-0 whitespace-nowrap">Captado</span>
                            )}
                          </div>
                          <p className="font-mono font-black text-sm sm:text-base text-slate-900 dark:text-white break-all select-all">
                            {capturedInfo.serialID}
                          </p>
                        </div>
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 dark:border-white/5 mt-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleCopyValue(capturedInfo.serialID!, 'serialID')}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-0.5"
                            title="Copiar Serie al portapapeles"
                          >
                            {copiedKey === 'serialID' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-emerald-500">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                                <span>Copiar Serie</span>
                              </>
                            )}
                          </button>
                          {serialID === capturedInfo.serialID ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveAppliedData('serialID')}
                              className="text-[11px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer transition-colors py-0.5"
                              title="Quitar este Número de Serie del formulario"
                            >
                              <span>Quitar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplyCapturedData('serialID')}
                              className="text-[11px] font-bold text-slate-600 hover:text-slate-800 dark:text-slate-300 cursor-pointer transition-colors py-0.5"
                              title="Usar este Número de Serie en el formulario"
                            >
                              <span>Usar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Tarjeta de Marca (si se extrajo de la etiqueta) */}
                    {capturedInfo.brand ? (
                      <div className="flex flex-col justify-between p-3 rounded-xl border border-sky-200 dark:border-sky-800/70 bg-white dark:bg-[#0f172a] shadow-2xs overflow-hidden min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
                            <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                              Marca
                            </span>
                            {brand === capturedInfo.brand ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 whitespace-nowrap">
                                <Check className="w-3 h-3" /> En form
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 shrink-0 whitespace-nowrap">Captado</span>
                            )}
                          </div>
                          <p className="font-mono font-bold text-sm text-slate-900 dark:text-white break-all select-all">
                            {capturedInfo.brand}
                          </p>
                        </div>
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 dark:border-white/5 mt-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleCopyValue(capturedInfo.brand!, 'brand')}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-0.5"
                            title="Copiar Marca al portapapeles"
                          >
                            {copiedKey === 'brand' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-emerald-500">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                          {brand === capturedInfo.brand ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveAppliedData('brand')}
                              className="text-[11px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer transition-colors py-0.5"
                              title="Quitar Marca del formulario"
                            >
                              <span>Quitar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplyCapturedData('brand')}
                              className="text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 cursor-pointer transition-colors py-0.5"
                              title="Usar Marca en el formulario"
                            >
                              <span>Usar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Tarjeta de Modelo (si se extrajo de la etiqueta) */}
                    {capturedInfo.model ? (
                      <div className="flex flex-col justify-between p-3 rounded-xl border border-teal-200 dark:border-teal-800/70 bg-white dark:bg-[#0f172a] shadow-2xs overflow-hidden min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
                            <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                              Modelo
                            </span>
                            {model === capturedInfo.model ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 whitespace-nowrap">
                                <Check className="w-3 h-3" /> En form
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 shrink-0 whitespace-nowrap">Captado</span>
                            )}
                          </div>
                          <p className="font-mono font-bold text-sm text-slate-900 dark:text-white break-all select-all">
                            {capturedInfo.model}
                          </p>
                        </div>
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 dark:border-white/5 mt-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleCopyValue(capturedInfo.model!, 'model')}
                            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-0.5"
                            title="Copiar Modelo al portapapeles"
                          >
                            {copiedKey === 'model' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="text-emerald-500">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                          {model === capturedInfo.model ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveAppliedData('model')}
                              className="text-[11px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer transition-colors py-0.5"
                              title="Quitar Modelo del formulario"
                            >
                              <span>Quitar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplyCapturedData('model')}
                              className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer transition-colors py-0.5"
                              title="Usar Modelo en el formulario"
                            >
                              <span>Usar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Información adicional de la etiqueta (no tiene campo en el formulario: para leer y/o copiar) */}
                    {capturedInfo.rawList
                      .filter((c) => c !== capturedInfo.devIDNO && c !== capturedInfo.imei && c !== capturedInfo.serialID && c !== capturedInfo.brand && c !== capturedInfo.model)
                      .map((otherInfo, idx) => {
                        const copyKey = `other-${idx}`;
                        return (
                          <div key={copyKey} className="flex flex-col justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-2xs overflow-hidden min-w-0">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 whitespace-nowrap">
                                Información adicional #{idx + 1}
                              </span>
                              <p className="font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 break-all select-all">
                                {otherInfo}
                              </p>
                            </div>
                            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/5 mt-2">
                              <span className="text-[10px] text-slate-400 italic">Sólo lectura</span>
                              <button
                                type="button"
                                onClick={() => handleCopyValue(otherInfo, copyKey)}
                                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-0.5"
                                title="Copiar este dato"
                              >
                                {copiedKey === copyKey ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    <span className="text-emerald-500">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 shrink-0" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* BOTÓN PRINCIPAL: Rellenar campos del formulario */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApplyCapturedData()}
                      className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#00A3E0] hover:bg-[#008cc0] active:scale-98 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer border border-[#00A3E0]"
                    >
                      <ArrowDownToLine className="w-4 h-4 text-white" />
                      <span>Rellenar campos del formulario</span>
                    </button>

                    {fillFeedback && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{fillFeedback}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fila 1: device No & serie de dispositivo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#00A3E0]" />
                  {t('modal_id_dispositivo_label')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={devIDNO}
                  maxLength={MAX_LENGTHS.device.devidno}
                  onChange={(e) => setDevIDNO(e.target.value)}
                  placeholder="Ej. 4142434445"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F1726] py-3 px-4 text-sm sm:text-base text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-slate-400" />
                  {t('serie_dispositivo')}
                </label>
                <input
                  type="text"
                  value={serialID}
                  maxLength={MAX_LENGTHS.device.serial_id}
                  onChange={(e) => setSerialID(e.target.value)}
                  placeholder="Ej. 4142434445"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F1726] py-3 px-4 text-sm sm:text-base text-slate-900 dark:text-white font-mono outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Fila 2: IMEI & SimCard (Combobox que autocompleta actualCardNumber) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
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
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F1726] py-3 px-4 text-sm sm:text-base text-slate-900 dark:text-white font-mono outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-2xs"
                />
              </div>

              {/* SimCard Combobox */}
              <div className="relative" ref={simComboboxRef}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
                      className="text-[11px] text-slate-400 hover:text-red-500 font-semibold cursor-pointer"
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
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F1726] py-3 pl-4 pr-10 text-sm sm:text-base text-slate-900 dark:text-white font-mono outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIsSimDropdownOpen((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSimDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Desplegable del Combobox con todos los SimCards */}
                {isSimDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/14 bg-white dark:bg-[#162032] shadow-xl py-1 animate-in fade-in-50 duration-150">
                    {filteredSims.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">
                        No se encontraron SimCards que coincidan
                      </div>
                    ) : (
                      filteredSims.map((sim, idx) => {
                        const isSelected = sim.simCard && String(sim.simCard).trim() === simInfo.trim();
                        return (
                          <div
                            key={`sim-opt-${sim.id ?? idx}-${sim.simCard}`}
                            onClick={() => handleSelectSim(sim)}
                            className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs sm:text-sm ${isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-[#1E293B] text-slate-800 dark:text-slate-200'
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
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
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
                <label className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#00A3E0]" />
                    Actual Card Number
                  </span>
                  {actualCardNumber && simInfo && (
                    <span className="text-[11px] font-semibold text-[#00A3E0]">
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
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F1726] py-3 px-4 text-sm sm:text-base text-slate-900 dark:text-white font-mono outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  {t('modal_tipo_dispositivo_label')} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDevType(7)}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${devType === 7
                        ? 'border-[#00A3E0] bg-[#00A3E0]/15 dark:bg-[#00A3E0]/20 text-[#00A3E0] dark:text-[#00A3E0] shadow-xs'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121927] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
                      }`}
                  >
                    <Cpu className="h-4 w-4 text-[#00A3E0]" />
                    <span>7 - DVR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDevType(5)}
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${devType === 5
                        ? 'border-indigo-500 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121927] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
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
                  <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {t('modal_marca_label')}
                  </label>
                  {onOpenManageCatalog && (
                    <button
                      type="button"
                      onClick={onOpenManageCatalog}
                      className="text-xs font-bold text-[#00A3E0] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
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
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
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
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  {t('modal_estado_instalacion_label')} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setInstall(1);
                      setServiceStatus('active');
                    }}
                    className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${install === 1
                        ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121927] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
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
                    className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${install === 0
                        ? 'border-amber-500 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121927] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
                      }`}
                  >
                    <Tag className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate">0 - {t('modal_no_instalado_disponible')}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00A3E0]" />
                  {t('estado_servicio_label') || 'Estado de Servicio'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={serviceStatus}
                  onChange={(e) => setServiceStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F1726] py-3 px-4 text-sm sm:text-base font-semibold text-slate-800 dark:text-white outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all shadow-2xs cursor-pointer"
                >
                  <option value="active">🟢 {t('servicio_activo') || 'Servicio Activo'}</option>
                  <option value="inactive">🟠 {t('sin_servicio') || 'Sin Servicio'}</option>
                </select>
              </div>
            </div>

            {/* Fila 6: Empresa y Vehículo Asignado */}
            <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#00A3E0]" />
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
                    className={`w-full rounded-xl border border-slate-200 dark:border-white/10 py-3 px-4 text-sm sm:text-base font-semibold outline-none transition-all shadow-2xs ${install !== 1
                        ? 'bg-slate-100 dark:bg-[#121927] text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        : 'bg-white dark:bg-[#0F1726] text-slate-900 dark:text-white focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] cursor-pointer'
                      }`}
                    required={install === 1}
                  >
                    <option value="">
                      {install === 1 ? t('modal_selecciona_compania') : t('modal_no_aplica_no_instalado')}
                    </option>
                    {install === 1 && (
                      <option value="__REGISTER_NEW_COMPANY__" className="font-bold text-[#00A3E0] dark:text-[#00A3E0]">
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
                    <div className="mt-2.5 p-3 bg-blue-50/70 dark:bg-[#0F1726] border border-blue-200 dark:border-[#00A3E0]/30 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#00A3E0]" />
                          {t('nombre_nueva_empresa') || 'Registrar nueva empresa / cliente:'} <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCompany('');
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
                  {install !== 1 && (
                    <p className="text-xs text-slate-400 mt-1.5 italic">
                      {t('modal_solo_instalado')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
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
                    className={`w-full rounded-xl border border-slate-200 dark:border-white/10 py-3 px-4 text-sm sm:text-base font-semibold outline-none transition-all font-mono shadow-2xs ${install !== 1 || !selectedCompany
                        ? 'bg-slate-100 dark:bg-[#121927] text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        : 'bg-white dark:bg-[#0F1726] text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer'
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
                    <div className="mt-2.5 p-3 bg-emerald-50/70 dark:bg-[#0F1726] border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-1.5 animate-in fade-in duration-150">
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
                          className="text-[11px] text-slate-400 hover:text-red-500 font-semibold cursor-pointer"
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
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-[#121927] border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs uppercase"
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
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2 font-medium">
                  <Clock className="w-4 h-4 text-[#00A3E0]" />
                  <span>{t('fecha_asignacion') || 'Fecha de Asignación'}</span>
                </div>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-[#121927] px-3 py-1.5 rounded-md border border-slate-200 dark:border-white/10">
                  {previewAssignmentDate ? previewAssignmentDate : t('sin_fecha_asignada')}
                </span>
              </div>

              {/* Generación Automática de Código QR */}
              <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-[#0F1726] border border-purple-200/80 dark:border-purple-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-purple-900 dark:text-purple-200">
                <div className="flex items-center gap-2 font-medium">
                  <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>{t('generacion_codigo_qr')}</span>
                </div>
                <span className="font-mono text-xs sm:text-sm font-semibold text-purple-700 dark:text-purple-300 bg-white dark:bg-[#121927] px-3 py-1.5 rounded-md border border-purple-200 dark:border-purple-800">
                  {devIDNO.trim() ? `${t('qr_listo')} (ID: ${devIDNO.trim()}${imei.trim() ? ` | IMEI: ${imei.trim()}` : ''})` : t('ingresa_devidno_qr')}
                </span>
              </div>
            </div>

            {/* Botones */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={handleModalClose}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#121927] px-5 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1E293B] transition-colors cursor-pointer min-h-11"
              >
                {t('modal_cancelar')}
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-[#00A3E0] hover:bg-[#0092c8] px-6 py-3 text-sm font-bold text-white shadow-xs transition-all cursor-pointer min-h-11"
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

