'use client';

import React from 'react';

export interface AutoRefreshControlProps {
  lastUpdated?: Date | null;
  className?: string;
  interval?: number;
  onChangeInterval?: (interval: number) => void;
}

export default function AutoRefreshControl({
  lastUpdated,
  className = '',
}: AutoRefreshControlProps) {
  const formatLastUpdated = (date?: Date | null) => {
    if (!date) return '';
    try {
      return date.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formattedTime = formatLastUpdated(lastUpdated);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#121927] border border-[#E2E8F0] dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium select-none shadow-2xs shrink-0 transition-colors ${className}`}
      title={
        formattedTime
          ? `Actualización automática cada 30 segundos. Última sincronización: ${formattedTime}`
          : 'Actualización automática cada 30 segundos'
      }
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="whitespace-nowrap text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300">
        Actualización cada 30s
      </span>
    </div>
  );
}
