'use client';

import React, { useRef } from 'react';
import { Radio, Scan, Download, Upload, Search, XCircle, RefreshCw } from 'lucide-react';

export interface SimCardActionBarProps {
  onOpenCreateModal: () => void;
  onOpenScanModal: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rawSearchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
  isReadOnly?: boolean;
  t: (key: string) => string;
}

export function SimCardActionBar({
  onOpenCreateModal,
  onOpenScanModal,
  onExport,
  onImport,
  rawSearchQuery,
  onSearchChange,
  onRefresh,
  loading,
  isReadOnly = false,
  t,
}: SimCardActionBarProps) {
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
            <Radio className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
            <span className="truncate">{t('agregar_simcard')}</span>
          </button>
        )}

        <button
          onClick={onOpenScanModal}
          type="button"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#00acee] hover:bg-[#0099d4] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-extrabold text-white shadow-sm transition-all cursor-pointer hover:shadow active:scale-95 border border-[#00acee]"
          title="Escanear código de barra o QR para buscar SIM Card"
        >
          <Scan className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
          <span className="truncate">{t('escanear_buscar')}</span>
        </button>

        {/* Botón Exportar */}
        <button
          onClick={onExport}
          type="button"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#00acee] hover:bg-[#0099d4] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-extrabold text-white shadow-sm transition-all cursor-pointer hover:shadow active:scale-95 border border-[#00acee]"
          title="Descargar archivo Excel / CSV de SIM Cards"
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
              accept=".json, .csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              type="button"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#00acee] hover:bg-[#0099d4] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-extrabold text-white shadow-sm transition-all cursor-pointer hover:shadow active:scale-95 border border-[#00acee]"
              title="Cargar archivo CSV o JSON"
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
            placeholder={t('buscar_sims_input')}
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
          onClick={onRefresh}
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

export default SimCardActionBar;
