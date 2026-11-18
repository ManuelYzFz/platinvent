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
    <div className="action-buttons-card flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#162032] p-4 sm:p-5 shadow-xs">
      {/* Botones de Acción Principales */}
      <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
        {!isReadOnly && (
          <button
            onClick={onOpenCreateModal}
            type="button"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#00A3E0] hover:bg-[#0092c8] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-extrabold text-white shadow-xs transition-all cursor-pointer hover:shadow active:scale-95 border border-[#00A3E0]"
          >
            <Radio className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
            <span className="truncate">{t('agregar_simcard')}</span>
          </button>
        )}

        <button
          onClick={onOpenScanModal}
          type="button"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#121927] dark:hover:bg-[#1E293B] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-bold text-slate-700 dark:text-slate-200 hover:text-[#00A3E0] dark:hover:text-[#00A3E0] shadow-xs transition-all cursor-pointer active:scale-95 border border-slate-200 dark:border-white/10"
          title="Escanear código de barra o QR para buscar SIM Card"
        >
          <Scan className="h-4 w-4 sm:h-5 sm:w-5 text-[#00A3E0] shrink-0" />
          <span className="truncate">{t('escanear_buscar')}</span>
        </button>

        {/* Botón Exportar */}
        <button
          onClick={onExport}
          type="button"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#121927] dark:hover:bg-[#1E293B] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-bold text-slate-700 dark:text-slate-200 hover:text-[#00A3E0] dark:hover:text-[#00A3E0] shadow-xs transition-all cursor-pointer active:scale-95 border border-slate-200 dark:border-white/10"
          title="Descargar archivo Excel / CSV de SIM Cards"
        >
          <Download className="h-4 w-4 sm:h-5 sm:w-5 text-[#00A3E0] shrink-0" />
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#121927] dark:hover:bg-[#1E293B] px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-base font-bold text-slate-700 dark:text-slate-200 hover:text-[#00A3E0] dark:hover:text-[#00A3E0] shadow-xs transition-all cursor-pointer active:scale-95 border border-slate-200 dark:border-white/10"
              title="Cargar archivo CSV, JSON o Excel"
            >
              <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-[#00A3E0] shrink-0" />
              <span className="truncate">{t('importar') || 'Importar'}</span>
            </button>
          </>
        )}
      </div>

      {/* Buscador y Botón Actualizar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:flex-1 lg:max-w-2xl lg:justify-end">
        <div className="relative flex items-center flex-1">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={rawSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('buscar_sims_input')}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0F1726] py-3 pl-10 pr-10 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] shadow-2xs font-medium"
          />
          {rawSearchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-90 cursor-pointer rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10"
              title={t('limpiar_busqueda')}
            >
              <XCircle className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
            </button>
          )}
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          type="button"
          className="flex items-center justify-center p-3 text-slate-700 dark:text-slate-200 hover:text-[#00A3E0] dark:hover:text-[#00A3E0] bg-slate-50 dark:bg-[#121927] hover:bg-slate-100 dark:hover:bg-[#1E293B] rounded-xl border border-slate-200 dark:border-white/10 transition-all cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs active:scale-95"
          title="Restablecer búsquedas y actualizar inventario"
          aria-label="Restablecer búsquedas y actualizar inventario"
        >
          <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${loading ? 'animate-spin text-[#00A3E0]' : 'text-[#00A3E0]'}`} />
        </button>
      </div>
    </div>
  );
}

export default SimCardActionBar;
