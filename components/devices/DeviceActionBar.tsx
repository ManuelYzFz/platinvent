'use client';

import React, { useRef } from 'react';
import { Plus, Scan, Download, Upload, Search, XCircle, RefreshCw, Tag } from 'lucide-react';

export interface DeviceActionBarProps {
  onOpenCreateModal: () => void;
  onOpenScanModal: () => void;
  onOpenManageCatalogModal?: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rawSearchQuery: string;
  onSearchChange: (value: string) => void;
  onRefreshAll: () => void;
  loading: boolean;
  isReadOnly?: boolean;
  t: (key: string) => string;
}

export function DeviceActionBar({
  onOpenCreateModal,
  onOpenScanModal,
  onOpenManageCatalogModal,
  onExport,
  onImport,
  rawSearchQuery,
  onSearchChange,
  onRefreshAll,
  loading,
  isReadOnly = false,
  t,
}: DeviceActionBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="action-buttons-card flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 rounded-2xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#161B22] p-4 sm:p-5 shadow-xs">
      {/* Botones de Acción Principales */}
      <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
        {!isReadOnly && (
          <button
            onClick={onOpenCreateModal}
            type="button"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#00acee] hover:bg-[#0099d4] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-extrabold text-white shadow-sm transition-all cursor-pointer hover:shadow active:scale-95 border border-[#00acee]"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
            <span className="truncate">{t('agregar_dispositivo')}</span>
          </button>
        )}

        {!isReadOnly && onOpenManageCatalogModal && (
          <button
            onClick={onOpenManageCatalogModal}
            type="button"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-gray-50 dark:bg-[#161B22] dark:hover:bg-[#21262d] text-[#3a435d] dark:text-gray-100 px-3.5 sm:px-4 py-3 sm:py-3.5 text-xs sm:text-base font-bold shadow-xs transition-all cursor-pointer hover:shadow active:scale-95 border border-[#e8e9ed] dark:border-[#30363d] hover:border-[#00acee]"
            title="Administrar catálogo maestro de marcas y modelos"
          >
            <Tag className="h-4 w-4 sm:h-5 sm:w-5 text-[#00acee] shrink-0" />
            <span className="truncate">Marcas y Modelos</span>
          </button>
        )}

        <button
          onClick={onOpenScanModal}
          type="button"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#00acee] hover:bg-[#0099d4] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-extrabold text-white shadow-sm transition-all cursor-pointer hover:shadow active:scale-95 border border-[#00acee]"
          title="Escanear código QR o de barras para buscar por devIDNO o IMEI"
        >
          <Scan className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
          <span className="truncate">{t('escanear_buscar')}</span>
        </button>

        {/* Botón Exportar */}
        <button
          onClick={onExport}
          type="button"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#00acee] hover:bg-[#0099d4] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-extrabold text-white shadow-sm transition-all cursor-pointer hover:shadow active:scale-95 border border-[#00acee]"
          title="Descargar archivo Excel / CSV de dispositivos"
        >
          <Download className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
          <span className="truncate">{t('exportar') || 'Exportar'}</span>
        </button>

        {/* Botón Importar (solo para administradores) */}
        {!isReadOnly && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImport}
              accept=".json, .csv, .xlsx"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              type="button"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#00acee] hover:bg-[#0099d4] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-extrabold text-white shadow-sm transition-all cursor-pointer hover:shadow active:scale-95 border border-[#00acee]"
              title="Cargar archivo CSV, JSON o Excel"
            >
              <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
              <span className="truncate">{t('importar') || 'Importar'}</span>
            </button>
          </>
        )}
      </div>

      {/* Buscador y Botón Actualizar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:flex-1 lg:max-w-2xl lg:justify-end">
        <div className="relative flex items-center flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={rawSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('buscar_dispositivos_input')}
            className="w-full rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#0d1117] py-3 pl-10 pr-10 text-sm sm:text-base text-[#3a435d] dark:text-gray-100 outline-none transition-all focus:border-[#00acee] focus:ring-2 focus:ring-[#00acee]/20 shadow-2xs font-medium"
          />
          {rawSearchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 p-1 text-gray-400 hover:text-gray-700 active:scale-90 cursor-pointer rounded-lg hover:bg-gray-200/50"
              title={t('limpiar_busqueda')}
            >
              <XCircle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        <button
          onClick={onRefreshAll}
          disabled={loading}
          type="button"
          className="flex items-center justify-center gap-2 px-5 py-3 text-sm sm:text-base font-extrabold text-[#3a435d] dark:text-gray-200 hover:text-[#00acee] dark:hover:text-[#00acee] bg-[#f8f9fc] dark:bg-[#0d1117] hover:bg-[#e8e9ed]/70 dark:hover:bg-[#21262d] rounded-xl border border-[#e8e9ed] dark:border-[#30363d] transition-all cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs active:scale-95"
          title="Restablecer búsquedas y actualizar inventario"
        >
          <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${loading ? 'animate-spin text-[#00acee]' : ''}`} />
          <span>{t('actualizar')}</span>
        </button>
      </div>
    </div>
  );
}

export default DeviceActionBar;
