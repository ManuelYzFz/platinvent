'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '@/lib/utils/useDebounce';
import type { DeviceRecord, VehicleRecord, VehicleCompany } from '@/lib/types/inventory';
import { extractDevicesArray, extractVehiclesArray } from '@/lib/utils/data-extractors';
import { USE_LOCAL_DATA } from '@/lib/constants';
import {
  getOfflineDevices,
  saveOfflineDevices,
  saveSingleOfflineDevice,
  getOfflineVehicles,
  saveOfflineVehicles,
  getOfflineCompanies,
  saveOfflineCompanies,
  enqueueSyncMutation,
} from '@/lib/services/offlineStorage';
import {
  classifyDevice,
  getCleanPatent,
  getCleanCompany,
  formatAssignmentDate,
  formatRegistrationDate,
  formatServiceStatus,
} from './device-helpers';

export const PAGE_SIZE = 10;

export function useDevicesInventory(session?: string) {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [, setCompanies] = useState<VehicleCompany[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [rawSearchQuery, setRawSearchQuery] = useState<string>('');
  const searchQuery = useDebounce(rawSearchQuery, 250);
  const [scanFilter, setScanFilter] = useState<string>('');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [selectedQrDevice, setSelectedQrDevice] = useState<DeviceRecord | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [selectedEditDevice, setSelectedEditDevice] = useState<DeviceRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Expansión de secciones
  const [expandedRows, setExpandedRows] = useState({
    installedDevices: true,
    uninstalledDevices: true,
    indefiniteDevices: true,
  });

  // Paginación por sección
  const [pageInstalled, setPageInstalled] = useState(1);
  const [pageUninstalled, setPageUninstalled] = useState(1);
  const [pageIndefinite, setPageIndefinite] = useState(1);

  const handleSearchChange = (val: string) => {
    setRawSearchQuery(val);
    setPageInstalled(1);
    setPageUninstalled(1);
    setPageIndefinite(1);
  };

  const handleScanResult = (scannedQuery: string) => {
    setScanFilter(scannedQuery.trim());
    setPageInstalled(1);
    setPageUninstalled(1);
    setPageIndefinite(1);
  };

  const handleOpenQrCode = useCallback((dev: DeviceRecord) => {
    setSelectedQrDevice(dev);
    setIsQrModalOpen(true);
  }, []);

  const handleCloseQrModal = useCallback(() => {
    setIsQrModalOpen(false);
    setSelectedQrDevice(null);
  }, []);

  const handleOpenEditDevice = useCallback((dev: DeviceRecord) => {
    setSelectedEditDevice(dev);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedEditDevice(null);
  }, []);

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError('');

    // 1. Cargar inmediatamente desde IndexedDB para visualización instantánea y offline
    // (deshabilitado mientras USE_LOCAL_DATA = false: sólo se muestran datos de la BD)
    if (USE_LOCAL_DATA) try {
      const [cachedDevs, cachedVehs, cachedComps] = await Promise.all([
        getOfflineDevices(),
        getOfflineVehicles(),
        getOfflineCompanies(),
      ]);

      if (cachedDevs.length > 0) setDevices(cachedDevs);
      if (cachedVehs.length > 0) setVehicles(cachedVehs);
      if (cachedComps.length > 0) setCompanies(cachedComps);
    } catch (e) {
      console.warn('Error leyendo IndexedDB en inicialización:', e);
    } finally {
      setLoading(false);
    }

    // 2. Si no hay conexión a internet, detenerse aquí
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    try {
      const ts = Date.now();
      const [resDevices, resVehicles, resCompanies] = await Promise.all([
        fetch(`/api/local-devices?t=${ts}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/local-vehicles?t=${ts}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/local-companies?t=${ts}`, { cache: 'no-store' }).catch(() => null),
      ]);

      const [devData, vehData, compData] = await Promise.all([
        resDevices?.ok ? resDevices.json().catch(() => null) : Promise.resolve(null),
        resVehicles?.ok ? resVehicles.json().catch(() => null) : Promise.resolve(null),
        resCompanies?.ok ? resCompanies.json().catch(() => null) : Promise.resolve(null),
      ]);

      const devList: DeviceRecord[] = extractDevicesArray(devData);
      const vehList: VehicleRecord[] = extractVehiclesArray(vehData);
      let compList: VehicleCompany[] = [];

      if (compData) {
        if (Array.isArray(compData)) compList = compData as VehicleCompany[];
        else if (Array.isArray(compData.companys)) compList = compData.companys as VehicleCompany[];
        else if (Array.isArray(compData.companies)) compList = compData.companies as VehicleCompany[];
        else if (Array.isArray(compData.root)) compList = compData.root as VehicleCompany[];
      }

      if (devList.length > 0 || (!USE_LOCAL_DATA && devData)) {
        setDevices(devList);
        await saveOfflineDevices(devList);
      }
      if (vehList.length > 0 || (!USE_LOCAL_DATA && vehData)) {
        setVehicles(vehList);
        await saveOfflineVehicles(vehList);
      }
      if (compList.length > 0 || (!USE_LOCAL_DATA && compData)) {
        setCompanies(compList);
        await saveOfflineCompanies(compList);
      }
    } catch (err) {
      console.error('Error fetching local devices:', err);
      setDevices((currentDevs) => {
        if (currentDevs.length === 0) {
          setError('Error al sincronizar datos de dispositivos');
        }
        return currentDevs;
      });
    } finally {
      setLoading(false);
    }
  }, [session]);

  const handleRefreshAll = () => {
    setRawSearchQuery('');
    setScanFilter('');
    setPageInstalled(1);
    setPageUninstalled(1);
    setPageIndefinite(1);
    void fetchData(true);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialData = async () => {
      await Promise.resolve();
      if (!ignore) {
        await fetchData(false);
      }
    };

    void loadInitialData();

    const handleSyncComplete = () => {
      void fetchData(false);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('vtraxx-data-synchronized', handleSyncComplete);
    }

    return () => {
      ignore = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('vtraxx-data-synchronized', handleSyncComplete);
      }
    };
  }, [fetchData]);

  // El servidor rechazó los datos (400): no se reintenta offline; se recarga y se muestra el motivo
  const handleRejectedSave = useCallback(async (res: Response) => {
    const data = await res.json().catch(() => null);
    await fetchData(false);
    setError(data?.error || 'Datos inválidos: no se pudo guardar.');
  }, [fetchData]);

  const handleAddLocalDevice = useCallback(async (newDevice: DeviceRecord) => {
    setDevices((prev) => [newDevice, ...prev]);
    await saveSingleOfflineDevice(newDevice);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      await enqueueSyncMutation('device', 'create', newDevice);
      return;
    }

    try {
      const res = await fetch('/api/local-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: newDevice }),
      });
      if (res.status === 400) {
        await handleRejectedSave(res);
      } else if (!res.ok) {
        await enqueueSyncMutation('device', 'create', newDevice);
      } else {
        void fetchData(false);
      }
    } catch (err) {
      console.warn('Error de red al guardar dispositivo, encolando offline:', err);
      await enqueueSyncMutation('device', 'create', newDevice);
    }
  }, [fetchData, handleRejectedSave]);

  const handleUpdateLocalDevice = async (updatedDevice: DeviceRecord) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (updatedDevice.id !== undefined && updatedDevice.id !== null && d.id !== undefined && d.id !== null) {
          return String(d.id) === String(updatedDevice.id) ? updatedDevice : d;
        }
        const devId = String(d.devIDNO ?? d.devIdno ?? '').trim();
        const updatedDevId = String(updatedDevice.devIDNO ?? updatedDevice.devIdno ?? '').trim();
        if (devId && updatedDevId) {
          return devId === updatedDevId ? updatedDevice : d;
        }
        return d;
      })
    );
    await saveSingleOfflineDevice(updatedDevice);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      await enqueueSyncMutation('device', 'update', updatedDevice);
      return;
    }

    try {
      const res = await fetch('/api/local-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: updatedDevice }),
      });
      if (res.status === 400) {
        await handleRejectedSave(res);
      } else if (!res.ok) {
        await enqueueSyncMutation('device', 'update', updatedDevice);
      } else {
        void fetchData(false);
      }
    } catch (err) {
      console.warn('Error de red al actualizar dispositivo, encolando offline:', err);
      await enqueueSyncMutation('device', 'update', updatedDevice);
    }
  };

  // Mapas rápidos de vehículos
  const vehicleByDeviceId = useMemo(() => {
    const map = new Map<string, VehicleRecord>();
    vehicles.forEach((veh) => {
      const devList = Array.isArray(veh.devList) ? veh.devList : (Array.isArray(veh.dl) ? veh.dl : []);
      devList.forEach((d) => {
        const idKey = String(d.name ?? d.id ?? d.serialID ?? '').trim();
        if (idKey) map.set(idKey, veh);
      });
    });
    return map;
  }, [vehicles]);

  const vehicleByPatent = useMemo(() => {
    const map = new Map<string, VehicleRecord>();
    vehicles.forEach((veh) => {
      const vid = String(veh.vid ?? veh.vehiIdno ?? '').trim().toLowerCase();
      if (vid) map.set(vid, veh);
    });
    return map;
  }, [vehicles]);

  const getMatchedVehicle = useCallback((dev: DeviceRecord): VehicleRecord | undefined => {
    const devId = String(dev.devIDNO ?? dev.id ?? '').trim();
    if (devId && vehicleByDeviceId.has(devId)) {
      return vehicleByDeviceId.get(devId);
    }
    const patent = String(dev.vehiIdno ?? dev.vehiIDNO ?? dev.vid ?? '').trim().toLowerCase();
    if (patent && vehicleByPatent.has(patent)) {
      return vehicleByPatent.get(patent);
    }
    return undefined;
  }, [vehicleByDeviceId, vehicleByPatent]);

  // Exportar dispositivos a CSV compatible con Excel
  const handleExport = useCallback(() => {
    if (devices.length === 0) return;
    const headers = [
      'ID Dispositivo (devIDNO)',
      'IMEI',
      'Serie',
      'Marca',
      'Modelo',
      'Tipo (devType)',
      'Patente Asignada',
      'Compañía / Cliente',
      'Estado Instalación',
      'Estado Servicio',
      'Fecha Asignación',
      'Fecha Registro',
    ];
    const rows = devices.map((d) => {
      const matchedVeh = getMatchedVehicle(d);
      const patent = getCleanPatent(d, matchedVeh) || 'Sin Asignar';
      const company = getCleanCompany(d, matchedVeh) || 'Sin Asignar';
      const installStatus =
        Number(d.install) === 1
          ? 'Instalado'
          : Number(d.install) === 0
            ? 'No Instalado'
            : 'Indefinido';
      const devTypeStr =
        Number(d.devType) === 7 ? 'MDVR' : Number(d.devType) === 5 ? 'GPS' : String(d.devType ?? '-');
      const serviceStatusStr = formatServiceStatus(d, matchedVeh).label;
      const asgDate = formatAssignmentDate(d, matchedVeh);
      const regDate = formatRegistrationDate(d);

      return [
        `"${String(d.devIDNO ?? d.id ?? '').replace(/"/g, '""')}"`,
        `"${String(d.imei ?? '').replace(/"/g, '""')}"`,
        `"${String(d.serialID ?? '').replace(/"/g, '""')}"`,
        `"${String(d.brand ?? '').replace(/"/g, '""')}"`,
        `"${String(d.model ?? '').replace(/"/g, '""')}"`,
        `"${devTypeStr}"`,
        `"${patent.replace(/"/g, '""')}"`,
        `"${company.replace(/"/g, '""')}"`,
        `"${installStatus}"`,
        `"${serviceStatusStr}"`,
        `"${asgDate}"`,
        `"${regDate}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dispositivos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [devices, getMatchedVehicle]);

  // Importar dispositivos desde CSV o JSON
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const list: DeviceRecord[] = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed.infos)
              ? parsed.infos
              : (Array.isArray(parsed.devices) ? parsed.devices : []));
          for (const item of list) {
            await handleAddLocalDevice(item);
          }
        } else {
          const lines = text.split(/\r?\n/).filter((line) => line.trim());
          if (lines.length > 1) {
            const separator = lines[0].includes(';') ? ';' : ',';
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(separator).map((c) => c.replace(/^"|"$/g, '').trim());
              if (cols[0]) {
                const installCol = cols.length > 8 ? cols[8] : cols[7];
                const isInstalled = installCol ? (installCol.toLowerCase().includes('no') || installCol.includes('0') ? 0 : 1) : 1;
                const devTypeStr = cols[5]?.toUpperCase();
                const devType = devTypeStr?.includes('MDVR') ? 7 : devTypeStr?.includes('GPS') ? 5 : undefined;
                const patent = cols[6] && cols[6] !== 'Sin Asignar' ? cols[6] : undefined;
                const company = cols[7] && cols[7] !== 'Sin Asignar' && cols.length > 8 ? cols[7] : undefined;

                const newDev: DeviceRecord = {
                  id: cols[0],
                  devIDNO: cols[0],
                  imei: cols[1] || undefined,
                  serialID: cols[2] || undefined,
                  brand: cols[3] || undefined,
                  model: cols[4] || undefined,
                  devType: devType ?? undefined,
                  vehiIdno: patent,
                  companyName: company,
                  install: isInstalled,
                };
                await handleAddLocalDevice(newDev);
              }
            }
          }
        }
        void fetchData(false);
      } catch (err) {
        console.error('Error al importar archivo de dispositivos:', err);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [handleAddLocalDevice, fetchData]);

  // Filtrado de búsqueda
  const searchedDevices = useMemo(() => {
    let result = devices;

    if (scanFilter.trim()) {
      const sf = scanFilter.toLowerCase().trim();
      result = result.filter((d) => {
        const devId = String(d.devIDNO ?? d.id ?? '').toLowerCase().trim();
        const imei = String(d.imei ?? '').toLowerCase().trim();
        const serial = String(d.serialID ?? '').toLowerCase().trim();
        return devId === sf || imei === sf || serial === sf;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) => {
        const matchedVeh = getMatchedVehicle(d);
        const cleanPat = (getCleanPatent(d, matchedVeh) || '').toLowerCase();
        const cleanComp = (getCleanCompany(d, matchedVeh) || '').toLowerCase();
        const devId = String(d.devIDNO ?? d.id ?? '').toLowerCase();
        const brand = String(d.brand ?? '').toLowerCase();
        const model = String(d.model ?? '').toLowerCase();
        const imei = String(d.imei ?? '').toLowerCase();
        const serial = String(d.serialID ?? '').toLowerCase();

        return (
          cleanPat.includes(q) ||
          cleanComp.includes(q) ||
          devId.includes(q) ||
          brand.includes(q) ||
          model.includes(q) ||
          imei.includes(q) ||
          serial.includes(q)
        );
      });
    }

    return result;
  }, [devices, scanFilter, searchQuery, getMatchedVehicle]);

  // Clasificación de dispositivos
  const { installedDevices, uninstalledDevices, indefiniteDevices } = useMemo(() => {
    const installed: DeviceRecord[] = [];
    const uninstalled: DeviceRecord[] = [];
    const indefinite: DeviceRecord[] = [];

    searchedDevices.forEach((dev) => {
      const matchedVeh = getMatchedVehicle(dev);
      const category = classifyDevice(dev, matchedVeh);

      if (category === 'installed') {
        installed.push(dev);
      } else if (category === 'uninstalled') {
        uninstalled.push(dev);
      } else {
        indefinite.push(dev);
      }
    });

    return {
      installedDevices: installed,
      uninstalledDevices: uninstalled,
      indefiniteDevices: indefinite,
    };
  }, [searchedDevices, getMatchedVehicle]);

  // Paginación
  const pagedInstalled = useMemo(
    () => installedDevices.slice((pageInstalled - 1) * PAGE_SIZE, pageInstalled * PAGE_SIZE),
    [installedDevices, pageInstalled]
  );
  const pagedUninstalled = useMemo(
    () => uninstalledDevices.slice((pageUninstalled - 1) * PAGE_SIZE, pageUninstalled * PAGE_SIZE),
    [uninstalledDevices, pageUninstalled]
  );
  const pagedIndefinite = useMemo(
    () => indefiniteDevices.slice((pageIndefinite - 1) * PAGE_SIZE, pageIndefinite * PAGE_SIZE),
    [indefiniteDevices, pageIndefinite]
  );

  return {
    devices,
    loading,
    error,
    rawSearchQuery,
    scanFilter,
    setScanFilter,
    handleSearchChange,
    handleRefreshAll,
    handleScanResult,
    handleExport,
    handleImport,
    handleAddLocalDevice,
    handleUpdateLocalDevice,
    getMatchedVehicle,
    installedDevices,
    uninstalledDevices,
    indefiniteDevices,
    pagedInstalled,
    pagedUninstalled,
    pagedIndefinite,
    pageInstalled,
    setPageInstalled,
    pageUninstalled,
    setPageUninstalled,
    pageIndefinite,
    setPageIndefinite,
    expandedRows,
    setExpandedRows,
    isCreateModalOpen,
    setIsCreateModalOpen,
    isScanModalOpen,
    setIsScanModalOpen,
    selectedQrDevice,
    isQrModalOpen,
    setIsQrModalOpen,
    selectedEditDevice,
    isEditModalOpen,
    setIsEditModalOpen,
    handleOpenQrCode,
    handleCloseQrModal,
    handleOpenEditDevice,
    handleCloseEditModal,
    fetchData,
  };
}

export default useDevicesInventory;
