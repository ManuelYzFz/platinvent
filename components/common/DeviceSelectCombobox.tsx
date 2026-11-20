'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  ChevronDown, 
  X, 
  Check, 
  Truck, 
  Package, 
  HardDrive 
} from 'lucide-react';
import type { DeviceRecord, VehicleRecord } from '@/lib/types/inventory';
import type { DeviceItemOption, VehicleItemOption } from '@/lib/utils/sim-utils';

export interface DeviceComboboxOption {
  devIDNO: string;
  imei?: string | null;
  plate?: string | null;
  companyName?: string | null;
  brand?: string | null;
  model?: string | null;
  install?: number | string | boolean | null;
}

interface DeviceSelectComboboxProps {
  devices: (DeviceRecord | DeviceItemOption | any)[];
  vehicles?: (VehicleRecord | VehicleItemOption | any)[];
  value: string;
  onChange: (devId: string, matchedDevice?: DeviceComboboxOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function DeviceSelectCombobox({
  devices = [],
  vehicles = [],
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar por patente, devIDNO, cliente o modelo...',
  className = '',
}: DeviceSelectComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mapear y normalizar la lista de dispositivos con su información principal
  const normalizedDevices = useMemo<DeviceComboboxOption[]>(() => {
    // Mapa rápido de vehículo por ID de dispositivo
    const vehMap = new Map<string, string>();
    if (vehicles && vehicles.length > 0) {
      vehicles.forEach((v) => {
        const plate = String(v.vehiIdno ?? v.idno ?? v.nm ?? '').trim();
        const devList = Array.isArray(v.devList) ? v.devList : (Array.isArray(v.dl) ? v.dl : []);
        devList.forEach((d: { name?: string; id?: string | number; serialID?: string }) => {
          const idVal = String(d.name ?? d.id ?? d.serialID ?? '').trim();
          if (idVal && plate) vehMap.set(idVal, plate);
        });
      });
    }

    const result: DeviceComboboxOption[] = [];
    const seen = new Set<string>();

    for (const d of devices) {
      const devId = String(d.devIDNO ?? d.devIdno ?? d.id ?? '').trim();
      if (!devId || seen.has(devId)) continue;
      seen.add(devId);

      // Determinar patente
      let plate: string | null = null;
      if (d.plate && String(d.plate).trim()) {
        plate = String(d.plate).trim();
      } else if (d.vehiIdno && String(d.vehiIdno).trim()) {
        plate = String(d.vehiIdno).trim();
      } else if (d.vehiIDNO && String(d.vehiIDNO).trim()) {
        plate = String(d.vehiIDNO).trim();
      } else if (vehMap.has(devId)) {
        plate = vehMap.get(devId)!;
      }

      result.push({
        devIDNO: devId,
        imei: d.imei ? String(d.imei).trim() : null,
        plate: plate || null,
        companyName: d.companyName ? String(d.companyName).trim() : null,
        brand: d.brand ? String(d.brand).trim() : null,
        model: d.model ? String(d.model).trim() : null,
        install: d.install !== undefined && d.install !== null ? (d.install as number | string | boolean) : (plate ? 1 : 0),
      });
    }

    return result;
  }, [devices, vehicles]);

  // Encontrar el dispositivo actualmente seleccionado
  const selectedDevice = useMemo(() => {
    if (!value) return null;
    const cleanVal = value.trim().toLowerCase();
    return normalizedDevices.find((d) => d.devIDNO.toLowerCase() === cleanVal) || null;
  }, [value, normalizedDevices]);

  // Filtrado multi-término inteligente
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) {
      return normalizedDevices.slice(0, 60);
    }

    const terms = searchTerm
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return normalizedDevices
      .filter((dev) => {
        const plate = (dev.plate || 'en bodega').toLowerCase();
        const devId = dev.devIDNO.toLowerCase();
        const imei = (dev.imei || '').toLowerCase();
        const company = (dev.companyName || 'sin empresa').toLowerCase();
        const brandModel = `${dev.brand || ''} ${dev.model || ''}`.toLowerCase();

        return terms.every(
          (t) =>
            plate.includes(t) ||
            devId.includes(t) ||
            imei.includes(t) ||
            company.includes(t) ||
            brandModel.includes(t)
        );
      })
      .slice(0, 60);
  }, [searchTerm, normalizedDevices]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Enfocar buscador al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSelect = (dev: DeviceComboboxOption | null) => {
    if (!dev) {
      onChange('', null);
    } else {
      onChange(dev.devIDNO, dev);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Botón / Visualización del Dispositivo Seleccionado */}
      {selectedDevice ? (
        <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${
              selectedDevice.plate 
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' 
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
            }`}>
              {selectedDevice.plate ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedDevice.plate ? (
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                    {selectedDevice.plate}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                    En Bodega
                  </span>
                )}
                <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                  {selectedDevice.devIDNO}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                <span>{selectedDevice.companyName || 'Sin Empresa'}</span>
                {(selectedDevice.brand || selectedDevice.model) && (
                  <span> · {[selectedDevice.brand, selectedDevice.model].filter(Boolean).join(' ')}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!disabled && (
              <>
                <button
                  type="button"
                  onClick={() => setIsOpen((prev) => !prev)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#00A3E0] hover:text-[#008ec4] bg-[#00A3E0]/10 hover:bg-[#00A3E0]/20 rounded-lg transition-colors cursor-pointer"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Quitar dispositivo (dejar libre)"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-slate-500 dark:text-slate-400 focus:outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all shadow-2xs text-left cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-[#121927]' : 'hover:border-slate-300 dark:hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">{placeholder}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Menú Desplegable con Buscador */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-white dark:bg-[#162032] border border-slate-200 dark:border-white/14 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Input de Búsqueda */}
          <div className="p-2.5 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-[#121927]">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Escribe patente, devIDNO, cliente o modelo..."
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#00A3E0] font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Opciones */}
          <div className="max-h-60 overflow-y-auto overscroll-contain p-1.5 space-y-1">
            {/* Opción 1: Dejar Libre / Sin Dispositivo */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                !value
                  ? 'bg-[#00A3E0]/10 text-[#00A3E0] font-bold'
                  : 'hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-600 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400">
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-semibold">Sin Dispositivo / Libre</span>
                  <p className="text-[11px] text-slate-400">Guardar la tarjeta SIM sin vincular a ningún hardware</p>
                </div>
              </div>
              {!value && <Check className="w-4 h-4 text-[#00A3E0]" />}
            </button>

            {/* Opciones de Dispositivos */}
            {filteredList.map((dev) => {
              const isSelected = selectedDevice?.devIDNO === dev.devIDNO;
              const brandModel = [dev.brand, dev.model].filter(Boolean).join(' ');

              return (
                <button
                  key={`combobox-dev-${dev.devIDNO}`}
                  type="button"
                  onClick={() => handleSelect(dev)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#00A3E0]/10 text-[#00A3E0]'
                      : 'hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${
                      dev.plate 
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' 
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                    }`}>
                      {dev.plate ? <Truck className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {dev.plate ? (
                          <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            {dev.plate}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            Bodega
                          </span>
                        )}
                        <span className="font-mono font-bold text-xs sm:text-sm truncate">
                          {dev.devIDNO}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        <span className="font-medium">{dev.companyName || 'Sin Empresa'}</span>
                        {brandModel && <span> · {brandModel}</span>}
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-[#00A3E0] shrink-0 ml-2" />}
                </button>
              );
            })}

            {filteredList.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">
                No se encontraron dispositivos con ese criterio de búsqueda.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
