'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Scan, AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { PAGE_SIZE } from '@/lib/constants';
import { getUserRole } from '@/lib/utils/storage';
import type { SimRecord } from '@/lib/types/inventory';
import { useSimCardsInventory } from './useSimCardsInventory';
import SimCardActionBar from './SimCardActionBar';
import SimTable from './SimTable';
import ExportModal, { type ExportColumn } from '@/components/common/ExportModal';
import {
  getSimDevIdno,
  getSimCompanyName,
  formatRegistrationTime,
  getMatchedPatent,
} from './sim-helpers';

const CreateSimCardModal = dynamic(() => import('./CreateSimCardModal'), { ssr: false });
const EditSimCardModal = dynamic(() => import('./EditSimCardModal'), { ssr: false });
const ScanSearchSimModal = dynamic(() => import('./ScanSearchSimModal'), { ssr: false });

export interface SimCardsViewProps {
  session?: string;
}

export default function SimCardsView({ session }: SimCardsViewProps) {
  const { t } = useTranslation();

  const {
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
    selectedEditSim,
    isScanSearchModalOpen,
    setIsScanSearchModalOpen,
    fetchData,
    filteredSims,
  } = useSimCardsInventory(session);

  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);

  const userRole = getUserRole();
  const isReadOnly = userRole === 'solo_lectura';

  const simExportColumns: ExportColumn<SimRecord>[] = React.useMemo(
    () => [
      {
        id: 'index',
        label: '#',
        getValue: (_s, idx) => idx + 1,
      },
      {
        id: 'simCard',
        label: 'ICCID SIM',
        getValue: (s) => String(s.simCard ?? ''),
      },
      {
        id: 'phoneNum',
        label: 'Número de Teléfono',
        getValue: (s) => String(s.cardNum ?? s.phoneNum ?? ''),
      },
      {
        id: 'company',
        label: 'Compañía / Cliente',
        getValue: (s) => getSimCompanyName(s) || 'Sin Asignar',
      },
      {
        id: 'devIDNO',
        label: 'Dispositivo Asignado (devIDNO)',
        getValue: (s) => getSimDevIdno(s),
      },
      {
        id: 'patent',
        label: 'Patente Vehículo',
        getValue: (s) => {
          const devId = getSimDevIdno(s);
          const isAssigned = devId !== '-';
          return getMatchedPatent(s, vehicles, devices, isAssigned) || (isAssigned ? 'Sin Asignar' : '-');
        },
      },
      {
        id: 'operator',
        label: 'Operador / Proveedor',
        getValue: (s) => String(s.serviceProvider ?? ''),
      },
      {
        id: 'installStatus',
        label: 'Estado de Instalación',
        getValue: (s) => (Number(s.status) === 1 ? 'Instalado' : 'No Instalado'),
      },
      {
        id: 'registrationDate',
        label: 'Fecha de Registro',
        getValue: (s) => formatRegistrationTime(s.registrationTime),
      },
    ],
    [devices, vehicles]
  );

  return (
    <section className="w-full max-w-full min-w-0 space-y-6 sm:space-y-8 font-sans">
      {/* 1. LÁMINA: Barra Superior de Acciones y Controles */}
      <SimCardActionBar
        onOpenCreateModal={() => setIsSimCardModalOpen(true)}
        onOpenScanModal={() => setIsScanSearchModalOpen(true)}
        onExport={() => setIsExportModalOpen(true)}
        onImport={handleImport}
        rawSearchQuery={rawSearchQuery}
        onSearchChange={handleSearchChange}
        onRefresh={handleRefresh}
        loading={loading}
        isReadOnly={isReadOnly}
        t={t}
      />

      {/* Badge de Escaneo Activo con botón de eliminación fácil */}
      {scanFilter && (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm font-bold animate-in fade-in shadow-2xs">
          <Scan className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>
            {t('filtro_escaneo_badge')} <strong className="font-mono">{scanFilter}</strong>
          </span>
          <button
            type="button"
            onClick={() => handleScanFilterChange('')}
            className="ml-2 p-1 text-indigo-500 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 font-extrabold cursor-pointer rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
            title={t('quitar_filtro_escaneo')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Banner de Error */}
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

      {/* 2. SECCIÓN 4A: SIM CARDS ASOCIADAS A DISPOSITIVOS (Incluye columna Dispositivo y Patente asignada) */}
      <SimTable
        type="assigned"
        title={t('sim_cards_con_dispositivo')}
        subtitle={t('lineas_activas_vinculadas')}
        sims={simsWithDevices}
        pagedSims={pagedAssigned}
        page={pageAssigned}
        pageSize={PAGE_SIZE}
        onPageChange={setPageAssigned}
        isExpanded={expandedRows.simsWithDevices}
        onToggleExpand={() => setExpandedRows((prev) => ({ ...prev, simsWithDevices: !prev.simsWithDevices }))}
        vehicles={vehicles}
        devices={devices}
        onEditSim={handleOpenEditSim}
        isReadOnly={isReadOnly}
        emptyMessage={t('sin_sims_asociadas')}
        t={t}
      />

      {/* 3. SECCIÓN 4B: SIM CARDS LIBRES / SIN DISPOSITIVO (Sin columna Dispositivo) */}
      <SimTable
        type="free"
        title={t('sim_cards_sin_dispositivo')}
        subtitle={t('lineas_en_stock_sin_asignar')}
        sims={simsWithoutDevices}
        pagedSims={pagedFree}
        page={pageFree}
        pageSize={PAGE_SIZE}
        onPageChange={setPageFree}
        isExpanded={expandedRows.simsWithoutDevices}
        onToggleExpand={() => setExpandedRows((prev) => ({ ...prev, simsWithoutDevices: !prev.simsWithoutDevices }))}
        vehicles={vehicles}
        devices={devices}
        onEditSim={handleOpenEditSim}
        isReadOnly={isReadOnly}
        emptyMessage={t('sin_sims_libres')}
        t={t}
      />

      {/* 4. MODALES DEL SISTEMA */}
      {!isReadOnly && isSimCardModalOpen && (
        <CreateSimCardModal
          isOpen={isSimCardModalOpen}
          onClose={() => setIsSimCardModalOpen(false)}
          companiesList={companiesList}
          devicesList={devices}
          vehiclesList={vehicles}
          onSuccess={(newSim?: SimRecord) => {
            if (newSim) {
              setSims((prev) => [newSim, ...prev.filter((s) => s.id !== newSim.id)]);
            }
            void fetchData(false);
          }}
        />
      )}

      {isEditModalOpen && (
        <EditSimCardModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditSim}
          sim={selectedEditSim}
          onUpdateSim={handleUpdateLocalSim}
          companiesList={companiesList}
          devicesList={devices}
          vehiclesList={vehicles}
        />
      )}

      {isScanSearchModalOpen && (
        <ScanSearchSimModal
          isOpen={isScanSearchModalOpen}
          onClose={() => setIsScanSearchModalOpen(false)}
          onScanResult={(scannedCode) => {
            handleScanFilterChange(scannedCode.trim());
          }}
        />
      )}

      {/* 5. MODAL DE EXPORTACIÓN PERSONALIZADA */}
      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title="Inventario de Tarjetas SIM"
          entityName="SIM Cards"
          filenamePrefix="simcards"
          data={filteredSims ?? sims ?? []}
          columns={simExportColumns}
        />
      )}
    </section>
  );
}
