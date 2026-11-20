'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Save,
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
  Calendar,
  Activity,
  ChevronDown,
  Check,
  Settings2,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { DeviceRecord, VehicleRecord, SimRecord } from '@/lib/types/inventory';
import { useTranslation } from '@/lib/i18n';
import { DEFAULT_COMPANY_OPTIONS, USE_LOCAL_DATA } from '@/lib/constants';
import { MAX_LENGTHS, IMEI_LENGTH, firstFieldError } from '@/lib/validation/inventory';
import CreatableSelect from '@/components/common/CreatableSelect';
import { useDeviceOptions } from '@/components/devices/useDeviceOptions';
import { formatDate } from '@/lib/utils/date-format';
import { useScrollLock } from '@/lib/utils/useScrollLock';

interface EditLocalDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceRecord | null;
  onUpdateDevice: (updatedDevice: DeviceRecord) => void;
  onOpenManageCatalog?: () => void;
  companiesList?: { id?: string | number; name?: string }[];
  vehiclesList?: VehicleRecord[];
  simsList?: SimRecord[];
}

export default function EditLocalDeviceModal({
  isOpen,
  onClose,
  device,
  onUpdateDevice,
  onOpenManageCatalog,
  companiesList = [],
  vehiclesList = [],
  simsList = [],
}: EditLocalDeviceModalProps) {
  const { t } = useTranslation();

  // Estados del Formulario
  const [devIDNO, setDevIDNO] = useState('');
  const [serialID, setSerialID] = useState('');
  const [imei, setImei] = useState('');
  const [simInfo, setSimInfo] = useState('');
  const [actualCardNumber, setActualCardNumber] = useState('');
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

  const fetchedFallbackRef = useRef(false);

  useScrollLock(isOpen);

  // Cargar datos del dispositivo a editar cuando se abre el modal o cambia el dispositivo
  useEffect(() => {
    let ignore = false;

    if (!isOpen || !device) return;

    const populateForm = async () => {
      await Promise.resolve();
      if (ignore) return;

      const currentDevId = String(device.devIDNO ?? device.id ?? '').trim();
      setDevIDNO(currentDevId);
      setSerialID(device.serialID ? String(device.serialID).trim() : '');
      setImei(device.imei ? String(device.imei).trim() : '');
      setSimInfo(device.simInfo ? String(device.simInfo).trim() : '');
      setActualCardNumber(device.actualCardNumber ? String(device.actualCardNumber).trim() : '');

      // Marca y modelo
      setBrand(device.brand ? String(device.brand).trim() : '');
      setModel(device.model ? String(device.model).trim() : '');

      // Tipo
      const rawType = Number(device.devType ?? device.type);
      setDevType(rawType === 5 ? 5 : 7);

      // Estado Instalación
      const isInst = Number(device.install) === 1 || String(device.install) === '1' || device.install === true;
      const isUninst = Number(device.install) === 0 || String(device.install) === '0' || device.install === false;
      setInstall(isInst ? 1 : (isUninst ? 0 : 0));

      // Estado Servicio
      if (device.serviceStatus) {
        const rawStatus = String(device.serviceStatus).toLowerCase().trim();
        setServiceStatus(rawStatus === 'active' || rawStatus === 'activo' || rawStatus === '1' ? 'active' : 'inactive');
      } else {
        setServiceStatus(isInst ? 'active' : 'inactive');
      }

      // Compañía
      const comp = device.companyName || ((device as Record<string, unknown>).company as string) || '';
      setSelectedCompany(comp && comp !== 'Sin Asignar' && comp !== 'Libre' ? comp : '');
      setCustomCompanyName('');

      // Vehículo
      const vehVid = device.vehiIdno || device.vehiIDNO || device.vid || '';
      setSelectedVehicleVid(vehVid && vehVid !== 'Sin Asignar' ? String(vehVid) : '');
      setCustomVehiclePlate('');

      setErrorMessage('');
    };

    void populateForm();

    return () => {
      ignore = true;
    };
  }, [isOpen, device]);

  // Carga de compañías / vehículos si no vienen por props
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
        .catch((err) => { console.warn('Error cargando compañías en editar:', err); });
    }

    if (!vehiclesList || vehiclesList.length === 0) {
      fetch(`/api/local-vehicles?t=${Date.now()}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data.infos) ? data.infos : [];
          setInternalVehicles(list);
        })
        .catch((err) => { console.warn('Error cargando vehículos en editar:', err); });
    }

    if (!simsList || simsList.length === 0) {
      fetch('/api/local-sims')
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data.infos) ? data.infos : [];
          setInternalSims(list);
        })
        .catch((err) => { console.warn('Error cargando SIM cards en editar:', err); });
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
      ...(selectedCompany ? [selectedCompany] : []),
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

  const previewAssignmentDate = useMemo(() => {
    const hasVeh =
      (selectedVehicleVid && selectedVehicleVid !== '__REGISTER_NEW_VEHICLE__') ||
      (selectedVehicleVid === '__REGISTER_NEW_VEHICLE__' && customVehiclePlate.trim());
    if (install !== 1 || !hasVeh) return null;
    if (device?.assignmentDate) return device.assignmentDate;
    return formatDate();
  }, [install, selectedVehicleVid, customVehiclePlate, device]);

  if (!isOpen || !device) return null;

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
      setErrorMessage(t('error_devid_requerido') || 'El device No es obligatorio.');
      return;
    }

    let finalCompany = selectedCompany;
    if (selectedCompany === '__REGISTER_NEW_COMPANY__') {
      const trimmed = customCompanyName.trim();
      if (!trimmed) {
        setErrorMessage(t('error_compania_requerida') || 'La Empresa es obligatoria.');
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
        setErrorMessage(t('error_vehiculo_requerido') || 'El Vehículo Asignado es obligatorio.');
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
        setErrorMessage(t('error_compania_requerida') || 'La Empresa es obligatoria para dispositivos instalados.');
        return;
      }
      if (!finalVehicleVid) {
        setErrorMessage(t('error_vehiculo_requerido') || 'El Vehículo Asignado es obligatorio para dispositivos instalados.');
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
    const compId = matchedCompanyObj?.id ? Number(matchedCompanyObj.id) : (device.companyId ?? 1);

    const hasAssignedVehicle = install === 1 && Boolean(finalVehicleVid);
    const nowTimestamp = Date.now();
    const todayStr = formatDate(nowTimestamp);

    // Si ya tenía fecha de asignación previa y sigue instalado, mantenerla; si es nueva asignación, poner todayStr
    const finalAssignmentDate = hasAssignedVehicle
      ? (device.assignmentDate || todayStr)
      : null;

    // Generar o actualizar código QR en Base64 combinando devIDNO e IMEI
    let generatedQrCode: string | null = device.qrCode ?? null;
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
      console.warn('Error generando código QR para dispositivo editado:', qrErr);
    }

    const updatedDevice: DeviceRecord = {
      ...device,
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
      assignmentDate: finalAssignmentDate,
      registrationDate: device.registrationDate || todayStr,
      stlTm: null,
      stlTmStr: null,
      vehiIdno: hasAssignedVehicle ? finalVehicleVid : null,
      simInfo: simInfo.trim() || null,
      chnName: devType === 7 ? (device.chnName || 'CH1,CH2,CH3,CH4') : null,
      factoryDevType: devType === 7 ? (install === 1 ? 1 : 0) : 0,
    };

    onUpdateDevice(updatedDevice);
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
            <div className="rounded-xl bg-[#00A3E0]/15 p-2.5 text-[#00A3E0] border border-[#00A3E0]/20">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Editar Dispositivo</span>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#00A3E0]/10 dark:bg-[#00A3E0]/20 text-[#00A3E0] border border-[#00A3E0]/20">
                  {devIDNO || device.devIDNO}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Modifica los datos del registro. Los cambios se sincronizarán en el inventario.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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

          <form id="edit-device-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 font-sans">

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
                            key={`edit-sim-opt-${sim.id ?? idx}-${sim.simCard}`}
                            onClick={() => handleSelectSim(sim)}
                            className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors text-xs sm:text-sm ${
                              isSelected
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
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      devType === 7
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
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      devType === 5
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

            {/* Fila 4: Marca & Modelo */}
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
                    className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      install === 1
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
                    className={`flex items-center justify-center gap-2 py-3.5 px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      install === 0
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
                    className={`w-full rounded-xl border border-slate-200 dark:border-white/10 py-3 px-4 text-sm sm:text-base font-semibold outline-none transition-all shadow-2xs ${
                      install !== 1
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
                    className={`w-full rounded-xl border border-slate-200 dark:border-white/10 py-3 px-4 text-sm sm:text-base font-semibold outline-none transition-all font-mono shadow-2xs ${
                      install !== 1 || !selectedCompany
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
                          <option key={`veh-edit-opt-${vid}`} value={vid}>
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
                        {t('modal_no_vehiculos') || 'No hay vehículos asociados a'} {selectedCompany}.
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5 font-medium">
                        {t('modal_mostrando_vehiculos') || 'Mostrando'} {filteredVehiclesForCompany.length} {t('modal_vehiculos_asociados') || 'vehículo(s) asociados a'} {selectedCompany}.
                      </p>
                    )
                  )}
                </div>
              </div>

              {/* Información de Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2 font-medium">
                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('fecha_registro') || 'Fecha Registro'}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-[#121927] px-2.5 py-1 rounded border border-slate-200 dark:border-white/10">
                    {device.registrationDate || '2026-08-12'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2 font-medium">
                    <Clock className="w-4 h-4 text-[#00A3E0]" />
                    <span>{t('fecha_asignacion') || 'Fecha Asignación'}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-[#121927] px-2.5 py-1 rounded border border-slate-200 dark:border-white/10">
                    {previewAssignmentDate ? previewAssignmentDate : t('sin_fecha_asignada')}
                  </span>
                </div>
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

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#121927] px-5 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1E293B] transition-colors cursor-pointer min-h-11"
              >
                {t('modal_cancelar')}
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-[#00A3E0] hover:bg-[#0092c8] px-6 py-3 text-sm font-bold text-white shadow-xs transition-all cursor-pointer min-h-11 active:scale-95"
              >
                <Save className="h-4 w-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
