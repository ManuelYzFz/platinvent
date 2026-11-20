'use client';

import React from 'react';
import { Scan, AlertTriangle, Truck, Package } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { getUserRole } from '@/lib/utils/storage';
import { useDevicesInventory, PAGE_SIZE } from './useDevicesInventory';
import DeviceActionBar from './DeviceActionBar';
import DeviceTable from './DeviceTable';
import CreateLocalDeviceModal from './CreateLocalDeviceModal';
import EditLocalDeviceModal from './EditLocalDeviceModal';
import QrCodePreviewModal from './QrCodePreviewModal';
import ScanSearchDeviceModal from './ScanSearchDeviceModal';
import ManageBrandsModelsModal from './ManageBrandsModelsModal';
import ConfirmDeleteDeviceModal from './ConfirmDeleteDeviceModal';
import ExportModal, { type ExportColumn } from '@/components/common/ExportModal';
import {
  getCleanPatent,
  getCleanCompany,
  formatServiceStatus,
  formatAssignmentDate,
  formatRegistrationDate,
} from './device-helpers';
import type { DeviceRecord } from '@/lib/types/inventory';

export interface DevicesViewProps {
  session?: string;
}

export default function DevicesView({ session }: DevicesViewProps) {
  const { t } = useTranslation();

  const {
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
    selectedEditDevice,
    isEditModalOpen,
    selectedDeleteDevice,
    isDeleteModalOpen,
    handleOpenQrCode,
    handleCloseQrModal,
    handleOpenEditDevice,
    handleCloseEditModal,
    handleOpenDeleteDevice,
    handleCloseDeleteModal,
    handleDeleteLocalDevice,
    fetchData,
    searchedDevices,
    isExportModalOpen,
    setIsExportModalOpen,
    autoRefreshInterval,
    setAutoRefreshInterval,
    lastUpdated,
  } = useDevicesInventory(session);

  const userRole = getUserRole();
  const isReadOnly = userRole === 'solo_lectura';
  const [isManageCatalogModalOpen, setIsManageCatalogModalOpen] = React.useState(false);
  const [createInitialImei, setCreateInitialImei] = React.useState<string>('');

  const deviceExportColumns: ExportColumn<DeviceRecord>[] = React.useMemo(
    () => [
      {
        id: 'dbId',
        label: 'ID',
        getValue: (d) => (d.id !== undefined && d.id !== null ? Number(d.id) : '-'),
      },
      {
        id: 'devIDNO',
        label: 'devIDNO',
        getValue: (d) => String(d.devIDNO ?? d.id ?? ''),
      },
      {
        id: 'imei',
        label: 'IMEI',
        getValue: (d) => String(d.imei ?? ''),
      },
      {
        id: 'serialID',
        label: 'Número de Serie',
        getValue: (d) => String(d.serialID ?? ''),
      },
      {
        id: 'brand',
        label: 'Marca',
        getValue: (d) => String(d.brand ?? 'Sin Asignar'),
      },
      {
        id: 'model',
        label: 'Modelo',
        getValue: (d) => String(d.model ?? 'Sin Asignar'),
      },
      {
        id: 'devType',
        label: 'Tipo de Dispositivo',
        getValue: (d) =>
          Number(d.devType) === 7 ? 'MDVR' : Number(d.devType) === 5 ? 'GPS' : String(d.devType ?? '-'),
      },
      {
        id: 'patent',
        label: 'Patente Asignada',
        getValue: (d) => {
          const matchedVeh = getMatchedVehicle(d);
          return getCleanPatent(d, matchedVeh) || 'Sin Asignar';
        },
      },
      {
        id: 'company',
        label: 'Compañía / Cliente',
        getValue: (d) => {
          const matchedVeh = getMatchedVehicle(d);
          return getCleanCompany(d, matchedVeh) || 'Sin Asignar';
        },
      },
      {
        id: 'sim',
        label: 'SIM Card Vinculada',
        getValue: (d) => String(d.simCard ?? d.simcardId ?? 'Sin Asignar'),
      },
      {
        id: 'installStatus',
        label: 'Estado de Instalación',
        getValue: (d) =>
          Number(d.install) === 1
            ? 'Instalado'
            : Number(d.install) === 0
            ? 'No Instalado'
            : 'Indefinido',
      },
      {
        id: 'serviceStatus',
        label: 'Estado de Servicio',
        getValue: (d) => {
          const matchedVeh = getMatchedVehicle(d);
          return formatServiceStatus(d, matchedVeh).label;
        },
      },
      {
        id: 'assignmentDate',
        label: 'Fecha de Asignación',
        getValue: (d) => {
          const matchedVeh = getMatchedVehicle(d);
          return formatAssignmentDate(d, matchedVeh);
        },
      },
      {
        id: 'registrationDate',
        label: 'Fecha de Registro',
        getValue: (d) => formatRegistrationDate(d),
      },
    ],
    [getMatchedVehicle]
  );

  const exportDevices = React.useMemo(() => {
    return [...searchedDevices].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  }, [searchedDevices]);

  return (
    <section className="w-full max-w-full min-w-0 space-y-6 sm:space-y-8 font-sans">
      {/* 1. LÁMINA: Barra Superior de Acciones y Controles */}
      <DeviceActionBar
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        onOpenManageCatalogModal={() => setIsManageCatalogModalOpen(true)}
        onExport={() => setIsExportModalOpen(true)}
        onImport={handleImport}
        rawSearchQuery={rawSearchQuery}
        onSearchChange={handleSearchChange}
        onRefreshAll={handleRefreshAll}
        loading={loading}
        isReadOnly={isReadOnly}
        t={t}
        autoRefreshInterval={autoRefreshInterval}
        onChangeAutoRefreshInterval={setAutoRefreshInterval}
        lastUpdated={lastUpdated}
      />

      {/* Filtro activo por escaneo */}
      {scanFilter && (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs sm:text-sm font-bold animate-in fade-in shadow-2xs">
          <Scan className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>
            {t('filtro_escaneo_badge')} <strong className="font-mono">{scanFilter}</strong>
          </span>
          <button
            type="button"
            onClick={() => setScanFilter('')}
            className="ml-2 p-1 text-purple-500 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 font-extrabold cursor-pointer rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50"
            title={t('quitar_filtro_escaneo')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner de error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => void fetchData(true)} className="underline hover:no-underline font-bold cursor-pointer">
            {t('reintentar')}
          </button>
        </div>
      )}

      {/* 2. LÁMINAS PRINCIPALES DE RESUMEN: VENDIDOS (INSTALADOS) Y DISPONIBLES EN BODEGA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Lámina 1: Vendidos / Instalados */}
        <div
          onClick={() => setExpandedRows((prev) => ({ ...prev, installedDevices: !prev.installedDevices }))}
          className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border transition-all cursor-pointer select-none bg-white dark:bg-[#162032] hover:translate-y-[-2px] ${
            expandedRows.installedDevices
              ? 'border-emerald-500/50 dark:border-emerald-500/60 ring-1 ring-emerald-500/30 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06]'
              : 'border-[#E2E8F0] dark:border-white/10 hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/25 group-hover:scale-105 transition-transform shrink-0">
              <Truck className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-white">{t('vendidos_instalados')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('dispositivos_activos_vehiculos')}</p>
            </div>
          </div>
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E2E8F0] dark:border-white/10">
            <div className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400">{installedDevices.length}</div>
            <div className="text-xs font-bold text-emerald-600/80 dark:text-emerald-400/80">{t('unidades')}</div>
          </div>
        </div>

        {/* Lámina 2: Disponibles en Bodega */}
        <div
          onClick={() => setExpandedRows((prev) => ({ ...prev, uninstalledDevices: !prev.uninstalledDevices }))}
          className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border transition-all cursor-pointer select-none bg-white dark:bg-[#162032] hover:translate-y-[-2px] ${
            expandedRows.uninstalledDevices
              ? 'border-amber-500/50 dark:border-amber-500/60 ring-1 ring-amber-500/30 bg-amber-500/[0.03] dark:bg-amber-500/[0.06]'
              : 'border-[#E2E8F0] dark:border-white/10 hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/25 group-hover:scale-105 transition-transform shrink-0">
              <Package className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-white">{t('disponibles_bodega')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('dispositivos_no_vinculados')}</p>
            </div>
          </div>
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E2E8F0] dark:border-white/10">
            <div className="text-2xl sm:text-3xl font-black text-amber-500 dark:text-amber-400">{uninstalledDevices.length}</div>
            <div className="text-xs font-bold text-amber-600/80 dark:text-amber-400/80">{t('unidades')}</div>
          </div>
        </div>
      </div>

      {/* 3. TABLA 1: DISPOSITIVOS INSTALADOS */}
      <DeviceTable
        type="installed"
        title={t('vendidos_instalados')}
        devices={installedDevices}
        pagedDevices={pagedInstalled}
        page={pageInstalled}
        pageSize={PAGE_SIZE}
        onPageChange={setPageInstalled}
        isExpanded={expandedRows.installedDevices}
        getMatchedVehicle={getMatchedVehicle}
        onOpenQrCode={handleOpenQrCode}
        onEditDevice={handleOpenEditDevice}
        onDeleteDevice={isReadOnly ? undefined : handleOpenDeleteDevice}
        isReadOnly={isReadOnly}
        emptyMessage={t('sin_dispositivos_instalados')}
        t={t}
      />

      {/* 4. TABLA 2: DISPOSITIVOS EN BODEGA */}
      <DeviceTable
        type="uninstalled"
        title={t('disponibles_bodega')}
        devices={uninstalledDevices}
        pagedDevices={pagedUninstalled}
        page={pageUninstalled}
        pageSize={PAGE_SIZE}
        onPageChange={setPageUninstalled}
        isExpanded={expandedRows.uninstalledDevices}
        getMatchedVehicle={getMatchedVehicle}
        onOpenQrCode={handleOpenQrCode}
        onEditDevice={handleOpenEditDevice}
        onDeleteDevice={isReadOnly ? undefined : handleOpenDeleteDevice}
        isReadOnly={isReadOnly}
        emptyMessage={t('sin_dispositivos_disponibles')}
        t={t}
      />

      {/* 5. TABLA 3: DISPOSITIVOS INDEFINIDOS */}
      <DeviceTable
        type="indefinite"
        title={t('dispositivos_indefinidos')}
        description={t('dispositivos_indefinidos_desc')}
        devices={indefiniteDevices}
        pagedDevices={pagedIndefinite}
        page={pageIndefinite}
        pageSize={PAGE_SIZE}
        onPageChange={setPageIndefinite}
        isExpanded={expandedRows.indefiniteDevices}
        onToggleExpand={() => setExpandedRows((prev) => ({ ...prev, indefiniteDevices: !prev.indefiniteDevices }))}
        getMatchedVehicle={getMatchedVehicle}
        onOpenQrCode={handleOpenQrCode}
        onEditDevice={handleOpenEditDevice}
        onDeleteDevice={isReadOnly ? undefined : handleOpenDeleteDevice}
        isReadOnly={isReadOnly}
        emptyMessage="No hay dispositivos indefinidos."
        t={t}
      />

      {/* 6. MODALES DEL SISTEMA */}
      {!isReadOnly && isManageCatalogModalOpen && (
        <ManageBrandsModelsModal
          isOpen={isManageCatalogModalOpen}
          onClose={() => setIsManageCatalogModalOpen(false)}
        />
      )}

      {!isReadOnly && isCreateModalOpen && (
        <CreateLocalDeviceModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setCreateInitialImei('');
          }}
          onAddDevice={handleAddLocalDevice}
          onOpenManageCatalog={() => setIsManageCatalogModalOpen(true)}
          initialImei={createInitialImei}
        />
      )}

      {isScanModalOpen && (
        <ScanSearchDeviceModal
          isOpen={isScanModalOpen}
          onClose={() => setIsScanModalOpen(false)}
          onScanResult={handleScanResult}
          devices={devices}
          onOpenCreate={!isReadOnly ? (initialCode) => {
            setCreateInitialImei(initialCode || '');
            setIsCreateModalOpen(true);
          } : undefined}
        />
      )}

      {isQrModalOpen && (
        <QrCodePreviewModal
          isOpen={isQrModalOpen}
          onClose={handleCloseQrModal}
          device={selectedQrDevice}
        />
      )}

      {isEditModalOpen && selectedEditDevice && (
        <EditLocalDeviceModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          device={selectedEditDevice}
          onUpdateDevice={handleUpdateLocalDevice}
          onOpenManageCatalog={() => setIsManageCatalogModalOpen(true)}
        />
      )}

      {!isReadOnly && isDeleteModalOpen && selectedDeleteDevice && (
        <ConfirmDeleteDeviceModal
          isOpen={isDeleteModalOpen}
          onClose={handleCloseDeleteModal}
          onConfirm={() => handleDeleteLocalDevice(selectedDeleteDevice)}
          device={selectedDeleteDevice}
        />
      )}

      {/* 7. MODAL DE EXPORTACIÓN PERSONALIZADA */}
      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title="Inventario de Dispositivos"
          entityName="Dispositivos"
          filenamePrefix="dispositivos"
          data={exportDevices}
          columns={deviceExportColumns}
        />
      )}
    </section>
  );
}
