'use client';

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { SimRecord, VehicleRecord, DeviceRecord } from '@/lib/types/inventory';
import Pagination from '@/components/common/Pagination';
import SimTableRow from './SimTableRow';

export interface SimTableProps {
  type: 'assigned' | 'free';
  title: string;
  subtitle: string;
  sims: SimRecord[];
  pagedSims: SimRecord[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  vehicles: VehicleRecord[];
  devices: DeviceRecord[];
  onEditSim: (sim: SimRecord) => void;
  emptyMessage: string;
  isReadOnly?: boolean;
  t: (key: string) => string;
}

export function SimTable({
  type,
  title,
  subtitle,
  sims,
  pagedSims,
  page,
  pageSize,
  onPageChange,
  isExpanded,
  onToggleExpand,
  vehicles,
  devices,
  onEditSim,
  emptyMessage,
  isReadOnly = false,
  t,
}: SimTableProps) {
  const isAssigned = type === 'assigned';

  const headerBg = isAssigned
    ? 'bg-emerald-50/70 dark:bg-[#121927] border-emerald-100/60 dark:border-white/10 hover:bg-emerald-100/40 dark:hover:bg-[#162032]'
    : 'bg-amber-50/70 dark:bg-[#121927] border-amber-100/60 dark:border-white/10 hover:bg-amber-100/40 dark:hover:bg-[#162032]';

  const dotBg = isAssigned ? 'bg-emerald-500' : 'bg-amber-500';

  const countBadge = isAssigned
    ? 'text-emerald-700 dark:text-emerald-300 bg-white/90 dark:bg-[#162032] border-emerald-200 dark:border-white/10'
    : 'text-amber-700 dark:text-amber-300 bg-white/90 dark:bg-[#162032] border-amber-200 dark:border-white/10';

  const chevronColor = isAssigned ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';

  return (
    <div className="w-full max-w-full min-w-0 rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#162032] shadow-xs overflow-hidden">
      {/* Encabezado colapsable */}
      <div
        onClick={onToggleExpand}
        className={`flex items-center justify-between px-6 py-4 border-b cursor-pointer transition-colors select-none ${headerBg}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${dotBg} shadow-xs`} />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${countBadge}`}>
            {sims.length} {t('unidades')}
          </span>
          {isExpanded ? (
            <ChevronUp className={`w-5 h-5 ${chevronColor}`} />
          ) : (
            <ChevronDown className={`w-5 h-5 ${chevronColor}`} />
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="w-full overflow-x-auto scrollbar-thin">
            <table className="min-w-175 w-full text-left text-xs text-slate-800 dark:text-slate-200">
              <thead className="bg-slate-50 dark:bg-[#121927] text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="px-2 py-2 text-center w-10">#</th>
                  <th className="px-2 py-2">{t('iccid_sim')}</th>
                  <th className="px-2 py-2">{t('numero_telefono')}</th>
                  <th className="px-2 py-2">{t('compania')}</th>
                  {/* Solo en 4A (con dispositivo asignado): columna Dispositivo / Patente */}
                  {isAssigned && <th className="px-2 py-2">{t('dispositivo_patente')}</th>}
                  {/* Nueva columna: Datos (entre dispositivo/patente y estado) */}
                  <th className="px-2 py-2 text-center whitespace-nowrap">Datos</th>
                  <th className="px-2 py-2 text-center whitespace-nowrap">{t('estado_col')}</th>
                  <th className="px-2 py-2 text-center whitespace-nowrap">{t('fecha_registro')}</th>
                  <th className="px-2 py-2 text-center whitespace-nowrap">{t('acciones_col') || 'Acciones'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-white/10">
                {sims.length === 0 ? (
                  <tr>
                    <td colSpan={isAssigned ? 9 : 8} className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400 italic">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  pagedSims.map((sim, idx) => (
                    <SimTableRow
                      key={`sim-${type}-${sim.id ?? 'no-id'}-${sim.simCard ?? ''}-${idx}`}
                      sim={sim}
                      idx={(page - 1) * pageSize + idx}
                      vehicles={vehicles}
                      devices={devices}
                      type={type}
                      onEditSim={onEditSim}
                      isReadOnly={isReadOnly}
                      t={t}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            total={sims.length}
            page={page}
            pageSize={pageSize}
            onPageChange={onPageChange}
            t={t}
          />
        </>
      )}
    </div>
  );
}

export default SimTable;
