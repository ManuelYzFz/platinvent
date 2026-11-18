'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  X,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { exportToCsv, exportToExcel, exportToPdf } from '@/lib/utils/export-helpers';

export interface ExportColumn<T> {
  id: string;
  label: string;
  getValue: (item: T, index: number) => string | number;
  defaultSelected?: boolean;
}

export type ExportFormat = 'excel' | 'pdf' | 'csv';

export interface ExportModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  filenamePrefix: string;
  data: T[];
  columns: ExportColumn<T>[];
  entityName?: string;
}

export default function ExportModal<T>({
  isOpen,
  onClose,
  title = 'Exportar Datos de Inventario',
  filenamePrefix,
  data,
  columns,
  entityName = 'Inventario',
}: ExportModalProps<T>) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Inicializar columnas seleccionadas cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      const initialIds = columns
        .filter((col) => col.defaultSelected !== false)
        .map((col) => col.id);
      setSelectedColumnIds(initialIds);
      setErrorMsg('');
      setIsExporting(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, columns]);

  // Manejo de tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  if (!isOpen) return null;

  const toggleColumn = (id: string) => {
    setSelectedColumnIds((prev) =>
      prev.includes(id) ? prev.filter((colId) => colId !== id) : [...prev, id]
    );
    if (errorMsg) setErrorMsg('');
  };

  const selectAll = () => {
    setSelectedColumnIds(columns.map((c) => c.id));
    if (errorMsg) setErrorMsg('');
  };

  const deselectAll = () => {
    setSelectedColumnIds([]);
  };

  const handleDownload = async () => {
    if (selectedColumnIds.length === 0) {
      setErrorMsg('Debes seleccionar al menos una columna para incluir en el archivo.');
      return;
    }

    if (data.length === 0) {
      setErrorMsg('No hay registros disponibles para exportar.');
      return;
    }

    setIsExporting(true);
    setErrorMsg('');

    try {
      // Filtrar columnas activas en el orden original
      const activeColumns = columns.filter((col) => selectedColumnIds.includes(col.id));
      const headers = activeColumns.map((col) => col.label);

      // Generar filas procesadas (reemplazando null, undefined o cadenas vacías por '-')
      const rows = data.map((item, idx) =>
        activeColumns.map((col) => {
          const val = col.getValue(item, idx);
          if (
            val === null ||
            val === undefined ||
            String(val).trim() === '' ||
            String(val).trim().toLowerCase() === 'null' ||
            String(val).trim().toLowerCase() === 'undefined'
          ) {
            return '-';
          }
          return val;
        })
      );

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${filenamePrefix}_${timestamp}`;

      // Breve respiro para que el spinner se dibuje inmediatamente
      await new Promise((r) => setTimeout(r, 50));

      if (selectedFormat === 'excel') {
        exportToExcel(filename, entityName, headers, rows);
      } else if (selectedFormat === 'pdf') {
        exportToPdf(filename, title, headers, rows);
      } else {
        exportToCsv(filename, headers, rows);
      }

      // Cerrar modal al completar descarga
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 300);
    } catch (err: unknown) {
      console.error('Error al generar la descarga:', err);
      setErrorMsg(
        err instanceof Error ? err.message : 'Ocurrió un error inesperado al generar el archivo.'
      );
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={() => !isExporting && onClose()}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363d] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header compacto */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#30363d] px-5 py-3.5 bg-gray-50/70 dark:bg-[#1c2128]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00acee]/10 text-[#00acee] dark:bg-[#00acee]/20 border border-[#00acee]/30 shrink-0">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#3a435d] dark:text-white leading-tight">
                {title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {data.length} {data.length === 1 ? 'registro' : 'registros'} para exportar
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-[#282e33] transition-colors cursor-pointer disabled:opacity-50"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body (Espacio optimizado sin scroll innecesario) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* 1. Selector de Formato (Excel, PDF, CSV - Limpio y sin subtítulos) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              1. Formato de Archivo
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Opción Excel */}
              <button
                type="button"
                onClick={() => setSelectedFormat('excel')}
                className={`relative flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFormat === 'excel'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'border-gray-200 dark:border-[#30363d] hover:border-emerald-300 dark:hover:border-emerald-800 bg-white dark:bg-[#1c2128] text-[#3a435d] dark:text-gray-200'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    selectedFormat === 'excel'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <span className="text-xs sm:text-sm font-extrabold truncate">Excel</span>
              </button>

              {/* Opción PDF */}
              <button
                type="button"
                onClick={() => setSelectedFormat('pdf')}
                className={`relative flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFormat === 'pdf'
                    ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 shadow-xs'
                    : 'border-gray-200 dark:border-[#30363d] hover:border-rose-300 dark:hover:border-rose-800 bg-white dark:bg-[#1c2128] text-[#3a435d] dark:text-gray-200'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    selectedFormat === 'pdf'
                      ? 'bg-rose-500 text-white'
                      : 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-xs sm:text-sm font-extrabold truncate">PDF</span>
              </button>

              {/* Opción CSV */}
              <button
                type="button"
                onClick={() => setSelectedFormat('csv')}
                className={`relative flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedFormat === 'csv'
                    ? 'border-[#00acee] bg-[#00acee]/15 dark:bg-[#00acee]/25 text-[#0089be] dark:text-[#38bdf8] shadow-xs'
                    : 'border-gray-200 dark:border-[#30363d] hover:border-[#00acee]/60 bg-white dark:bg-[#1c2128] text-[#3a435d] dark:text-gray-200'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    selectedFormat === 'csv'
                      ? 'bg-[#00acee] text-white'
                      : 'bg-[#00acee]/10 dark:bg-[#00acee]/20 text-[#00acee]'
                  }`}
                >
                  <FileCode className="h-4 w-4" />
                </div>
                <span className="text-xs sm:text-sm font-extrabold truncate">CSV</span>
              </button>
            </div>
          </div>

          {/* 2. Selector de Columnas con Checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                2. Contenido a Incluir ({selectedColumnIds.length} de {columns.length})
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-semibold text-[#00acee] hover:underline cursor-pointer"
                >
                  Marcar todos
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:underline cursor-pointer"
                >
                  Desmarcar todos
                </button>
              </div>
            </div>

            {/* Cuadrícula de checkboxes compacta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2.5 rounded-xl border border-gray-200 dark:border-[#30363d] bg-gray-50/50 dark:bg-[#161B22]/60">
              {columns.map((col) => {
                const isChecked = selectedColumnIds.includes(col.id);
                return (
                  <label
                    key={col.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer text-xs select-none ${
                      isChecked
                        ? 'border-[#00acee]/40 bg-white dark:bg-[#1c2128] text-[#3a435d] dark:text-white shadow-2xs font-semibold'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100/70 dark:hover:bg-[#21262d]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleColumn(col.id)}
                      className="sr-only"
                    />
                    {isChecked ? (
                      <CheckSquare className="h-3.5 w-3.5 text-[#00acee] shrink-0" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-gray-400 dark:text-gray-600 shrink-0" />
                    )}
                    <span className="truncate">{col.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Mensaje de error / advertencia */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-2.5 text-xs text-amber-700 dark:text-amber-400 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-gray-100 dark:border-[#30363d] px-5 py-3 bg-gray-50/50 dark:bg-[#1c2128]">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="rounded-xl border border-gray-300 dark:border-[#30363d] px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#282e33] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isExporting || selectedColumnIds.length === 0}
            onClick={handleDownload}
            className={`flex items-center gap-2 rounded-xl px-4.5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition-all cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedFormat === 'excel'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                : selectedFormat === 'pdf'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'
                : 'bg-[#00acee] hover:bg-[#0099d4] shadow-[#00acee]/20'
            }`}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Generando {selectedFormat.toUpperCase()}...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 shrink-0" />
                <span>
                  Descargar {selectedFormat === 'excel' ? 'Excel' : selectedFormat.toUpperCase()}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
