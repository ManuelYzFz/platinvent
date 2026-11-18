'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, X, HardDrive, Cpu, Truck, Building2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { DeviceRecord } from '@/lib/types/inventory';
import { useScrollLock } from '@/lib/utils/useScrollLock';

interface ConfirmDeleteDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  device: DeviceRecord | null;
}

export default function ConfirmDeleteDeviceModal({
  isOpen,
  onClose,
  onConfirm,
  device,
}: ConfirmDeleteDeviceModalProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsDeleting(false);
      setError(null);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  useScrollLock(isOpen);

  if (!isOpen || !device) return null;

  const devId = String(device.devIDNO ?? device.id ?? '-').trim();
  const brand = String(device.brand ?? '').trim() || 'Sin Asignar';
  const model = String(device.model ?? '').trim() || 'Sin Asignar';
  const plate = String(device.vehiIdno ?? '').trim() || 'Sin Asignar';
  const company = String(device.companyName ?? '').trim() || 'Sin Asignar';

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el dispositivo';
      setError(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
      onClick={() => !isDeleting && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#162032] border border-slate-200 dark:border-white/14 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 dark:border-white/10 px-6 py-4 bg-rose-50/60 dark:bg-[#121927]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('confirmar_eliminacion_titulo') || '¿Eliminar Dispositivo?'}
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                Acción destructiva irreversible
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            {t('confirmar_eliminacion_msg') ||
              '¿Estás seguro de que deseas eliminar este dispositivo permanentemente del inventario? Esta acción no se puede deshacer.'}
          </p>

          {/* Device Summary Card */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0F1726] p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400">
                <HardDrive className="w-3.5 h-3.5 text-rose-500" />
                DEVIDNO:
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                {devId}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-2">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Cpu className="w-3.5 h-3.5 text-[#00A3E0]" />
                Marca / Modelo:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {brand} {model !== 'Sin Asignar' ? `/ ${model}` : ''}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-2">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Truck className="w-3.5 h-3.5 text-emerald-500" />
                Vehículo / Patente:
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {plate}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-2">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-purple-500" />
                Empresa:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {company}
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 dark:border-white/10 px-6 py-4 bg-slate-50/60 dark:bg-[#121927]">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1E293B] border border-slate-200 dark:border-white/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('modal_cancelar') || 'Cancelar'}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t('eliminando') || 'Eliminando...'}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('confirmar_eliminar_btn') || 'Sí, Eliminar'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
