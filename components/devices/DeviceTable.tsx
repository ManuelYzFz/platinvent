'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { DeviceRecord, VehicleRecord } from '@/lib/types/inventory';
import Pagination from '@/components/common/Pagination';
import DeviceTableRow from './DeviceTableRow';

export interface DeviceTableProps {
  type: 'installed' | 'uninstalled' | 'indefinite';
  title: string;
  description?: string;
  devices: DeviceRecord[];
  pagedDevices: DeviceRecord[];
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  isExpanded: boolean;
  onToggleExpand?: () => void;
  getMatchedVehicle: (dev: DeviceRecord) => VehicleRecord | undefined;
  onOpenQrCode: (dev: DeviceRecord) => void;
  onEditDevice: (dev: DeviceRecord) => void;
  onDeleteDevice?: (dev: DeviceRecord) => void;
  emptyMessage: string;
  isReadOnly?: boolean;
  t: (key: string) => string;
}

export function DeviceTable({
  type,
  title,
  description,
  devices,
  pagedDevices,
  page,
  pageSize,
  onPageChange,
  isExpanded,
  onToggleExpand,
  getMatchedVehicle,
  onOpenQrCode,
  onEditDevice,
  onDeleteDevice,
  emptyMessage,
  isReadOnly = false,
  t,
}: DeviceTableProps) {
  const isInstalled = type === 'installed';
  const isUninstalled = type === 'uninstalled';
  const isIndefinite = type === 'indefinite';

  // Si no está expandido y no es la tabla de indefinidos (la cual conserva su barra para volver a desplegarse), no renderizar nada
  if (!isExpanded && !isIndefinite) return null;

  // Contenedor principal con bordes adaptados a cada tipo (neutral en modo oscuro)
  const containerBorder = isInstalled
    ? 'border-emerald-200 dark:border-[#30363d]'
    : isUninstalled
      ? 'border-amber-200 dark:border-[#30363d]'
      : 'border-[#3a435d] dark:border-[#30363d]';

  const theadClass = isInstalled
    ? 'border-b border-emerald-100 dark:border-[#30363d] bg-emerald-50/60 dark:bg-[#13171f] text-emerald-900 dark:text-emerald-400'
    : isUninstalled
      ? 'border-b border-amber-100 dark:border-[#30363d] bg-amber-50/60 dark:bg-[#13171f] text-amber-900 dark:text-amber-400'
      : 'border-b border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#13171f] text-[#5c647b] dark:text-gray-300';

  const divideClass = isInstalled
    ? 'divide-emerald-100 dark:divide-[#30363d]'
    : isUninstalled
      ? 'divide-amber-100 dark:divide-[#30363d]'
      : 'divide-[#e8e9ed] dark:divide-[#30363d]';

  return (
    <div className={`w-full max-w-full min-w-0 flex flex-col rounded-2xl border ${containerBorder} bg-white dark:bg-[#161B22] shadow-xs overflow-hidden`}>
      {/* Encabezado especial solo para tabla Indefinidos */}
      {isIndefinite && onToggleExpand && (
        <div
          className="flex items-center justify-between px-6 py-4 bg-[#3a435d] dark:bg-[#21262d] text-white cursor-pointer hover:bg-[#2c3347] dark:hover:bg-[#30363d] transition-colors select-none"
          onClick={onToggleExpand}
          title="Haz clic para contraer o expandir la tabla de Dispositivos Indefinidos"
        >
          <div className="flex items-center gap-3">
            <ChevronDown className={`w-5 h-5 text-purple-300 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
            <span className="flex h-3 w-3 rounded-full bg-purple-400 ring-4 ring-purple-400/20" />
            <div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-wide uppercase">{title}</h3>
              {description && <p className="text-[11px] text-purple-200/80 font-normal">{description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-extrabold text-purple-300 border border-purple-500/30">
              {devices.length} {t('registros')}
            </span>
            <span className="text-xs font-semibold text-purple-200">
              {isExpanded ? t('contraer') : t('expandir')}
            </span>
          </div>
        </div>
      )}

      {isExpanded && (
        <>
          <div className="w-full overflow-x-auto scrollbar-thin">
            <table className={`min-w-190 w-full text-left text-xs border-collapse ${isIndefinite ? 'min-w-215 sm:text-sm' : ''}`}>
              <thead>
                <tr className={`${theadClass} text-[11px] font-bold uppercase`}>
                  <th className="px-2.5 py-2 text-center w-12">#</th>
                  <th className="px-2.5 py-2">{t('placa_patente')}</th>
                  <th className="px-2.5 py-2">{t('compania')}</th>
                  <th className="px-2.5 py-2">DEVIDNO</th>
                  <th className="px-2.5 py-2">{t('codigo_qr')}</th>
                  <th className="px-2.5 py-2">{t('marca')}</th>
                  <th className="px-2.5 py-2">{t('modelo')}</th>
                  <th className="px-2.5 py-2">{t('tipo_dev')}</th>
                  <th className="px-2.5 py-2 whitespace-nowrap">{t('fecha_asignacion')}</th>
                  <th className="px-2.5 py-2 whitespace-nowrap">{t('fecha_registro')}</th>
                  <th className="px-2.5 py-2 whitespace-nowrap">{t('servicio_col')}</th>
                  <th className="px-2.5 py-2">{t('estado_col')}</th>
                  <th className="px-2.5 py-2 text-center whitespace-nowrap">{t('acciones_col') || 'Acciones'}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${divideClass} text-[#3a435d] dark:text-gray-200`}>
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-xs text-gray-500 dark:text-gray-400 italic">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  pagedDevices.map((dev, idx) => {
                    const devId = String(dev.devIDNO ?? dev.id ?? '').trim();
                    const globalIndex = (page - 1) * pageSize + idx + 1;
                    return (
                      <DeviceTableRow
                        key={`${type}-${dev.id ?? 'no-id'}-${devId}-${idx}`}
                        dev={dev}
                        idx={idx}
                        itemIndex={globalIndex}
                        matchedVehicle={getMatchedVehicle(dev)}
                        type={type}
                        onOpenQrCode={onOpenQrCode}
                        onEditDevice={onEditDevice}
                        onDeleteDevice={onDeleteDevice}
                        isReadOnly={isReadOnly}
                        t={t}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            total={devices.length}
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

export default DeviceTable;
