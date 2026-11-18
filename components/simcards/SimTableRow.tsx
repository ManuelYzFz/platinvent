'use client';

import React, { useState } from 'react';
import { Radio, Building2, HardDrive, Edit3, ChevronDown } from 'lucide-react';
import CopyableText from '@/components/common/CopyableText';
import type { SimRecord, VehicleRecord, DeviceRecord } from '@/lib/types/inventory';
import {
  getSimDevIdno,
  getSimCompanyName,
  formatRegistrationTime,
  getMatchedPatent,
} from './sim-helpers';

export interface SimTableRowProps {
  sim: SimRecord;
  idx: number;
  vehicles: VehicleRecord[];
  devices?: DeviceRecord[];
  type: 'assigned' | 'free';
  onEditSim: (sim: SimRecord) => void;
  isReadOnly?: boolean;
  t?: (key: string) => string;
}

export const SimTableRow = React.memo(function SimTableRow({
  sim,
  idx,
  vehicles,
  devices = [],
  type,
  onEditSim,
  isReadOnly = false,
  t,
}: SimTableRowProps) {
  const [isExpandedDetails, setIsExpandedDetails] = useState(false);
  const isAssigned = type === 'assigned';
  const isInstalled = Number(sim.install) === 1 || String(sim.install) === '1' || (isAssigned && sim.install !== 0);
  const isLineActive = Number(sim.status) === 1 || String(sim.status) === '1';
  const devId = getSimDevIdno(sim);
  const matchedPatent = getMatchedPatent(sim, vehicles, devices, isAssigned);

  return (
    <>
      <tr
        key={`sim-${type}-${sim.id ?? sim.simCard ?? idx}-${idx}`}
        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-[#1E293B]"
      >
        <td className="px-2 py-2 font-mono text-xs font-bold text-slate-400 dark:text-slate-500 text-center">
          #{idx + 1}
        </td>
        <td className="px-2 py-2 font-mono font-bold text-xs text-slate-800 dark:text-slate-100">
          <div className="flex items-center gap-1.5">
            <Radio className={`w-3.5 h-3.5 shrink-0 ${isAssigned ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`} />
            <CopyableText text={String(sim.simCard || sim.cardNum || '-')} />
          </div>
        </td>
        <td className={`px-2 py-2 font-mono font-bold text-xs ${isAssigned ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
          <CopyableText text={String(sim.cardNum ?? '-')} />
        </td>
        <td className="px-2 py-2 font-semibold text-xs text-slate-800 dark:text-slate-100 notranslate" translate="no">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{getSimCompanyName(sim, t)}</span>
          </div>
        </td>

        {/* Solo en 4A (Asignadas): Columna Dispositivo y Patente asignada */}
        {isAssigned && (
          <td className="px-2 py-2 font-mono text-emerald-700 dark:text-emerald-300 font-bold text-xs">
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                {devId !== '-' ? (
                  <CopyableText text={devId} />
                ) : (
                  <span>{t ? t('instalado_badge') : 'Asignado'}</span>
                )}
              </div>
              {matchedPatent && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                  {t ? t('patente') : 'Patente'}: <CopyableText text={matchedPatent} className="font-bold text-slate-800 dark:text-slate-200" />
                </span>
              )}
            </div>
          </td>
        )}

        {/* Nueva columna: Datos (entre dispositivo/patente y estado) */}
        <td className="px-2 py-2 text-center whitespace-nowrap">
          <button
            type="button"
            onClick={() => setIsExpandedDetails((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              isExpandedDetails
                ? 'bg-[#00A3E0] text-white border-[#00A3E0] shadow-xs'
                : 'bg-[#00A3E0]/10 text-[#00A3E0] border-[#00A3E0]/30 hover:bg-[#00A3E0]/20 dark:bg-[#00A3E0]/15'
            }`}
            title={isExpandedDetails ? 'Ocultar datos adicionales' : 'Desplegar datos adicionales'}
          >
            <span>{isExpandedDetails ? 'Ocultar' : 'Desplegar'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isExpandedDetails ? 'rotate-180' : ''
              }`}
            />
          </button>
        </td>

        <td className="px-2 py-2 text-center whitespace-nowrap">
          <span
            className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-extrabold border ${
              isInstalled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            {isInstalled
              ? t ? `1 (${t('instalado_badge')})` : '1 (Instalado)'
              : t ? `0 (${t('no_instalado_badge')})` : '0 (No Instalado)'}
          </span>
        </td>
        <td className="px-2 py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap text-center">
          {formatRegistrationTime(sim.registrationTime)}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-center">
          {isReadOnly ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              Solo lectura
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onEditSim(sim)}
              className="group/edit inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 bg-[#00A3E0]/10 dark:bg-[#00A3E0]/15 hover:bg-[#00A3E0] dark:hover:bg-[#00A3E0] border border-[#00A3E0]/40 text-[#00A3E0] hover:text-white dark:hover:text-white"
              title={t ? t('editar_simcard') || 'Editar SIM Card' : 'Editar SIM Card'}
            >
              <Edit3 className="w-3.5 h-3.5 text-[#00A3E0] group-hover/edit:text-white transition-colors" />
              <span>{t ? t('editar') || 'Editar' : 'Editar'}</span>
            </button>
          )}
        </td>
      </tr>

      {/* Fila expandible con los datos adicionales */}
      {isExpandedDetails && (
        <tr className="bg-slate-50/70 dark:bg-[#0F1726]/60 border-b border-slate-200/60 dark:border-white/5 animate-in fade-in duration-150">
          <td colSpan={isAssigned ? 9 : 8} className="px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 p-3 bg-white dark:bg-[#121927] rounded-xl border border-slate-200 dark:border-white/10 shadow-2xs">
              {/* 1. Estado de Línea */}
              <div className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Estado Línea
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-extrabold border ${
                    isLineActive
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isLineActive ? 'bg-blue-600' : 'bg-rose-600'}`} />
                  {isLineActive ? 'Habilitado' : 'No Habilitado'}
                </span>
              </div>

              {/* 2. Proveedor */}
              <div className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Proveedor
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate block">
                  {sim.serviceProvider || '-'}
                </span>
              </div>

              {/* 3. Tipo de Plan */}
              <div className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Tipo de Plan
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate block">
                  {sim.planName || '-'}
                </span>
              </div>

              {/* 4. Ciudad de Emisión */}
              <div className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Ciudad Emisión
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate block">
                  {sim.city || '-'}
                </span>
              </div>

              {/* 5. Fecha de Expiración */}
              <div className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Expiración
                </span>
                <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 truncate block">
                  {sim.endTime ? String(sim.endTime).slice(0, 10) : '-'}
                </span>
              </div>

              {/* 6. Card Merchant */}
              <div className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  Card Merchant
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate block">
                  {sim.cardMerchant || '-'}
                </span>
              </div>

              {/* 7. MSISDN */}
              <div className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                  MSISDN
                </span>
                <CopyableText text={sim.msisdn || '-'} className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 truncate block" />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

export default SimTableRow;
