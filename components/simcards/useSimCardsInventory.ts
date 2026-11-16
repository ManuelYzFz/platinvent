'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '@/lib/utils/useDebounce';
import { normalizeICCID } from '@/lib/utils/sim-utils';
import { PAGE_SIZE, USE_LOCAL_DATA } from '@/lib/constants';
import type { SimRecord, VehicleRecord, DeviceRecord } from '@/lib/types/inventory';
import { extractSimsArray, extractVehiclesArray, extractDevicesArray } from '@/lib/utils/data-extractors';
import {
  getSimDevIdno,
  getSimCompanyName,
  formatRegistrationTime,
  getMatchedPatent,
} from './sim-helpers';
import {
  getOfflineSims,
  saveOfflineSims,
  saveSingleOfflineSim,
  enqueueSyncMutation,
  getOfflineVehicles,
  saveOfflineVehicles,
  getOfflineDevices,
  saveOfflineDevices,
} from '@/lib/services/offlineStorage';

export function useSimCardsInventory(session?: string) {
  const [sims, setSims] = useState<SimRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [dbCompanies, setDbCompanies] = useState<{ id?: string | number; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [rawSearchQuery, setRawSearchQuery] = useState<string>('');
  const searchQuery = useDebounce(rawSearchQuery, 250);
  const [scanFilter, setScanFilter] = useState<string>('');

  const [isSimCardModalOpen, setIsSimCardModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedEditSim, setSelectedEditSim] = useState<SimRecord | null>(null);
  const [isScanSearchModalOpen, setIsScanSearchModalOpen] = useState<boolean>(false);

  const [expandedRows, setExpandedRows] = useState({
    simsWithDevices: true,
    simsWithoutDevices: true,
  });

  const [pageAssigned, setPageAssigned] = useState(1);
  const [pageFree, setPageFree] = useState(1);

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
      setError('');
    }

    // Caché IndexedDB deshabilitada mientras USE_LOCAL_DATA = false: sólo se muestran datos de la BD
    if (USE_LOCAL_DATA) try {
      const [cachedSims, cachedVehs, cachedDevs] = await Promise.all([
        getOfflineSims(),
        getOfflineVehicles(),
        getOfflineDevices(),
      ]);

      if (cachedSims.length > 0) setSims(cachedSims);
      if (cachedVehs.length > 0) setVehicles(cachedVehs);
      if (cachedDevs.length > 0) setDevices(cachedDevs);
    } catch (e) {
      console.warn('Error leyendo SIMs de IndexedDB:', e);
    } finally {
      setLoading(false);
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    try {
      const ts = Date.now();
      const [resSims, resVehs, resDevs, resComps] = await Promise.all([
        fetch(`/api/local-sims?t=${ts}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/local-vehicles?t=${ts}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/local-devices?t=${ts}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/local-companies?t=${ts}`, { cache: 'no-store' }).catch(() => null),
      ]);

      const compsData = resComps?.ok ? await resComps.json().catch(() => null) : null;
      if (compsData && Array.isArray(compsData.companys)) {
        setDbCompanies(compsData.companys);
      }

      const [simsData, vehsData, devsData] = await Promise.all([
        resSims?.ok ? resSims.json().catch(() => null) : Promise.resolve(null),
        resVehs?.ok ? resVehs.json().catch(() => null) : Promise.resolve(null),
        resDevs?.ok ? resDevs.json().catch(() => null) : Promise.resolve(null),
      ]);

      let simList: SimRecord[] = extractSimsArray(simsData);
      const vehList: VehicleRecord[] = extractVehiclesArray(vehsData);
      const devList: DeviceRecord[] = extractDevicesArray(devsData);

      if (simList.length > 0 || (!USE_LOCAL_DATA && simsData)) {
        simList = simList.map((s) => ({
          ...s,
          simCard: s.simCard ? normalizeICCID(s.simCard) : s.simCard,
        }));
        setSims(simList);
        await saveOfflineSims(simList);
      }
      if (vehList.length > 0 || (!USE_LOCAL_DATA && vehsData)) {
        setVehicles(vehList);
        await saveOfflineVehicles(vehList);
      }
      if (devList.length > 0 || (!USE_LOCAL_DATA && devsData)) {
        setDevices(devList);
        await saveOfflineDevices(devList);
      }
    } catch (err) {
      console.error('Error fetching SIM Cards data:', err);
      setSims((currentSims) => {
        if (currentSims.length === 0) {
          setError('Error al sincronizar datos de SIM Cards');
        }
        return currentSims;
      });
    } finally {
      setLoading(false);
    }
  }, [session]);

  const handleSearchChange = (val: string) => {
    setRawSearchQuery(val);
    setPageAssigned(1);
    setPageFree(1);
  };

  const handleScanFilterChange = (val: string) => {
    setScanFilter(val);
    setPageAssigned(1);
    setPageFree(1);
  };

  const handleRefresh = useCallback(() => {
    setRawSearchQuery('');
    setScanFilter('');
    setPageAssigned(1);
    setPageFree(1);
    void fetchData(true);
  }, [fetchData]);

  // El servidor rechazó los datos (400): no se reintenta offline; se recarga y se muestra el motivo
  const handleRejectedSave = useCallback(async (res: Response) => {
    const data = await res.json().catch(() => null);
    await fetchData(false);
    setError(data?.error || 'Datos inválidos: no se pudo guardar.');
  }, [fetchData]);

  // Exportar SIM Cards a CSV compatible con Excel
  const handleExport = useCallback(() => {
    if (sims.length === 0) return;
    const headers = [
      '#',
      'ICCID SIM',
      'Número Teléfono',
      'Compañía / Cliente',
      'Dispositivo Asignado (devIDNO)',
      'Patente Vehículo',
      'Operador',
      'Estado Instalación',
      'Fecha Registro',
    ];

    const rows = sims.map((s, idx) => {
      const devId = getSimDevIdno(s);
      const isAssigned = devId !== '-';
      const company = getSimCompanyName(s) || 'Sin Asignar';
      const patent = getMatchedPatent(s, vehicles, devices, isAssigned) || (isAssigned ? 'Sin Asignar' : '-');
      const installStatus = Number(s.status) === 1 ? 'Instalado' : 'No Instalado';
      const regDate = formatRegistrationTime(s.registrationTime);

      return [
        `"${idx + 1}"`,
        `"${String(s.simCard ?? '').replace(/"/g, '""')}"`,
        `"${String(s.phoneNum ?? '').replace(/"/g, '""')}"`,
        `"${company.replace(/"/g, '""')}"`,
        `"${devId.replace(/"/g, '""')}"`,
        `"${patent.replace(/"/g, '""')}"`,
        `"${String(s.serviceProvider ?? '').replace(/"/g, '""')}"`,
        `"${installStatus}"`,
        `"${regDate}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `simcards_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sims, vehicles, devices]);

  // Importar SIM Cards desde CSV o JSON
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
          const list: SimRecord[] = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed.infos)
              ? parsed.infos
              : (Array.isArray(parsed.sims) ? parsed.sims : []));
          for (const item of list) {
            await saveSingleOfflineSim(item);
            await enqueueSyncMutation('sim', 'create', { sim: item });
          }
        } else {
          const lines = text.split(/\r?\n/).filter((line) => line.trim());
          if (lines.length > 1) {
            const separator = lines[0].includes(';') ? ';' : ',';
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(separator).map((c) => c.replace(/^"|"$/g, '').trim());
              if (cols[1]) {
                const parsedId = Number(cols[0]);
                const isInstalled =
                  cols[7]?.includes('1') ||
                  (cols[7]?.toLowerCase().includes('instalado') && !cols[7]?.toLowerCase().includes('no'));
                const newSim: SimRecord = {
                  id: !isNaN(parsedId) && parsedId > 0 ? parsedId : (Date.now() + i),
                  simCard: normalizeICCID(cols[1]),
                  phoneNum: cols[2] || undefined,
                  companyName: cols[3] && cols[3] !== 'Sin Asignar' ? cols[3] : undefined,
                  devId: cols[4] && cols[4] !== 'Sin Asignar' && cols[4] !== '-' ? cols[4] : undefined,
                  serviceProvider: cols[6] || 'Entel',
                  status: isInstalled ? 1 : 0,
                };
                await saveSingleOfflineSim(newSim);
                await enqueueSyncMutation('sim', 'create', { sim: newSim });
              }
            }
          }
        }
        void fetchData(false);
      } catch (err) {
        console.error('Error al importar archivo de SIM Cards:', err);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [fetchData]);

  const handleOpenEditSim = (sim: SimRecord) => {
    setSelectedEditSim(sim);
    setIsEditModalOpen(true);
  };

  const handleCloseEditSim = () => {
    setIsEditModalOpen(false);
    setSelectedEditSim(null);
  };

  const handleUpdateLocalSim = async (updatedSim: SimRecord) => {
    setSims((prev) =>
      prev.map((s) => {
        if (updatedSim.id !== undefined && updatedSim.id !== null && s.id !== undefined && s.id !== null) {
          return String(s.id) === String(updatedSim.id) ? updatedSim : s;
        }
        if (updatedSim.simCard && s.simCard) {
          return String(s.simCard).trim() === String(updatedSim.simCard).trim() ? updatedSim : s;
        }
        if (updatedSim.cardNum && s.cardNum) {
          return String(s.cardNum).trim() === String(updatedSim.cardNum).trim() ? updatedSim : s;
        }
        return s;
      })
    );
    await saveSingleOfflineSim(updatedSim);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      await enqueueSyncMutation('sim', 'update', { sim: updatedSim });
      return;
    }

    try {
      const res = await fetch('/api/local-sims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sim: updatedSim }),
      });
      if (res.status === 400) {
        await handleRejectedSave(res);
      } else if (!res.ok) {
        await enqueueSyncMutation('sim', 'update', { sim: updatedSim });
      } else {
        void fetchData(false);
      }
    } catch (err) {
      console.warn('Error de red al actualizar SIM Card, encolando offline:', err);
      await enqueueSyncMutation('sim', 'update', { sim: updatedSim });
    }
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

  // Filtrado de búsqueda
  const filteredSims = useMemo(() => {
    let result = sims;

    if (scanFilter.trim()) {
      const sfRaw = scanFilter.toLowerCase().trim();
      const sfNorm = normalizeICCID(sfRaw).toLowerCase();
      result = result.filter((s) => {
        const simCardRaw = String(s.simCard ?? '').toLowerCase().trim();
        const simCardNorm = normalizeICCID(simCardRaw).toLowerCase();
        const cardNum = String(s.cardNum ?? '').toLowerCase().trim();
        return simCardRaw === sfRaw || simCardNorm === sfNorm || cardNum === sfRaw;
      });
    }

    if (searchQuery.trim()) {
      const qRaw = searchQuery.toLowerCase().trim();
      const qNorm = normalizeICCID(qRaw).toLowerCase();

      result = result.filter((s) => {
        const simCardRaw = String(s.simCard ?? '').toLowerCase();
        const simCardNorm = normalizeICCID(simCardRaw).toLowerCase();
        const cardNum = String(s.cardNum ?? '').toLowerCase();
        const devId = String(s.devIDNO ?? '').toLowerCase();
        const company = String(s.companyName ?? s.company?.name ?? '').toLowerCase();
        const patent = String(s.vehiIDNO ?? '').toLowerCase();

        return (
          simCardRaw.includes(qRaw) ||
          simCardNorm.includes(qNorm) ||
          cardNum.includes(qRaw) ||
          devId.includes(qRaw) ||
          company.includes(qRaw) ||
          patent.includes(qRaw)
        );
      });
    }

    return result;
  }, [sims, scanFilter, searchQuery]);

  // Lista unificada de compañías
  const companiesList = useMemo(() => {
    const map = new Map<string, { id?: string | number; name: string }>();
    dbCompanies.forEach((c) => {
      const name = String(c.name ?? '').trim();
      if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), { id: c.id, name });
    });
    vehicles.forEach((v) => {
      const name = String(v.com?.name ?? v.companyName ?? '').trim();
      const id = (v.com?.id ?? v.com?.companyId ?? v.companyId) ?? undefined;
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), { id, name });
      }
    });
    devices.forEach((d) => {
      const name = String(d.companyName ?? '').trim();
      const id = (d.companyId ?? d.companyID) ?? undefined;
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), { id: id ?? undefined, name });
      }
    });
    return Array.from(map.values());
  }, [dbCompanies, vehicles, devices]);

  // 4A: Con dispositivos asignados
  const simsWithDevices = useMemo(() => {
    return filteredSims.filter((s) => {
      const hasDevId = s.devIDNO !== null && s.devIDNO !== undefined && String(s.devIDNO).trim() !== '';
      const isInstall1 = Number(s.install) === 1 || String(s.install) === '1';
      return hasDevId || isInstall1;
    });
  }, [filteredSims]);

  // 4B: Sin dispositivo (libres)
  const simsWithoutDevices = useMemo(() => {
    return filteredSims.filter((s) => {
      const hasDevId = s.devIDNO !== null && s.devIDNO !== undefined && String(s.devIDNO).trim() !== '';
      const isInstall1 = Number(s.install) === 1 || String(s.install) === '1';
      return !hasDevId && !isInstall1;
    });
  }, [filteredSims]);

  const pagedAssigned = useMemo(
    () => simsWithDevices.slice((pageAssigned - 1) * PAGE_SIZE, pageAssigned * PAGE_SIZE),
    [simsWithDevices, pageAssigned]
  );
  const pagedFree = useMemo(
    () => simsWithoutDevices.slice((pageFree - 1) * PAGE_SIZE, pageFree * PAGE_SIZE),
    [simsWithoutDevices, pageFree]
  );

  return {
    sims,
    setSims,
    vehicles,
    devices,
    loading,
    error,
    rawSearchQuery,
    scanFilter,
    handleSearchChange,
    handleScanFilterChange,
    handleRefresh,
    handleExport,
    handleImport,
    handleOpenEditSim,
    handleCloseEditSim,
    handleUpdateLocalSim,
    companiesList,
    simsWithDevices,
    simsWithoutDevices,
    pagedAssigned,
    pagedFree,
    pageAssigned,
    setPageAssigned,
    pageFree,
    setPageFree,
    expandedRows,
    setExpandedRows,
    isSimCardModalOpen,
    setIsSimCardModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    selectedEditSim,
    isScanSearchModalOpen,
    setIsScanSearchModalOpen,
    fetchData,
  };
}

export default useSimCardsInventory;
