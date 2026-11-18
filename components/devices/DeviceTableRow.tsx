'use client';

import React, { useState } from 'react';
import { HardDrive, QrCode, Edit3, Trash2, ChevronDown } from 'lucide-react';
import type { DeviceRecord, VehicleRecord } from '@/lib/types/inventory';
import {
  formatDeviceBadge,
  formatInstallBadge,
  formatAssignmentDate,
  formatRegistrationDate,
  formatServiceStatus,
  formatStm,
  getCleanPatent,
  getCleanCompany,
} from './device-helpers';

export interface DeviceTableRowProps {
  dev: DeviceRecord;
  idx: number;
  itemIndex?: number;
  matchedVehicle?: VehicleRecord;
  type: 'installed' | 'uninstalled' | 'indefinite';
  onOpenQrCode: (dev: DeviceRecord) => void;
  onEditDevice: (dev: DeviceRecord) => void;
  onDeleteDevice?: (dev: DeviceRecord) => void;
  isReadOnly?: boolean;
  t: (key: string) => string;
}

export const DeviceTableRow = React.memo(function DeviceTableRow({
  dev,
  idx,
  itemIndex,
  matchedVehicle,
  type,
  onOpenQrCode,
  onEditDevice,
  onDeleteDevice,
  isReadOnly = false,
  t,
}: DeviceTableRowProps) {
  const displayIndex = itemIndex ?? (idx + 1);
  const badge = formatDeviceBadge(dev.devType, dev.type);

  const cleanPat = getCleanPatent(dev, matchedVehicle);
  const patent = cleanPat || 'Sin Asignar';

  const cleanComp = getCleanCompany(dev, matchedVehicle);
  const company = cleanComp || 'Sin Asignar';

  const isIndefinite = type === 'indefinite';
  const isUninstalled = type === 'uninstalled';
  const [isExpandedDetails, setIsExpandedDetails] = useState(false);

  const brandStr = String(dev.brand ?? '').trim() || '-';
  const modelStr = String(dev.model ?? '').trim() || '-';
  const imeiStr = String(dev.imei ?? '').trim() || '-';
  const serialStr = String(dev.serialID ?? '').trim() || '-';
  const simStr = String(dev.actualCardNumber ?? dev.simInfo ?? dev.sim ?? dev.cardNum ?? '').trim() || '-';

  if (isIndefinite) {
    const brandRaw = dev.brand;
    const modelRaw = dev.model;

    const brandDisplay =
      brandRaw === null || brandRaw === undefined
        ? 'null'
        : String(brandRaw).trim() === ''
          ? '"" (Vacío)'
          : String(brandRaw);

    const modelDisplay =
      modelRaw === null || modelRaw === undefined
        ? 'null'
        : String(modelRaw).trim() === ''
          ? '"" (Vacío)'
          : String(modelRaw);

    return (
      <>
        <tr key={`indef-${dev.devIDNO ?? dev.id ?? idx}-${idx}`} className="hover:bg-purple-50/40 dark:hover:bg-[#1c2128] transition-colors">
          <td className="px-2.5 py-2 font-mono font-bold text-xs text-[#3a435d] dark:text-gray-200 text-center">
            #{displayIndex}
          </td>
          <td className="px-2.5 py-2 font-mono font-bold text-xs text-[#3a435d] dark:text-gray-200">
            {patent === 'Sin Asignar' ? <span className="text-gray-400 dark:text-gray-500 font-semibold italic">{t('sin_asignar')}</span> : patent}
          </td>
          <td className="px-2.5 py-2 font-semibold text-xs text-[#3a435d] dark:text-gray-200 notranslate" translate="no">
            {company === 'Sin Asignar' ? <span className="text-gray-400 dark:text-gray-500 font-semibold italic">{t('sin_asignar')}</span> : company}
          </td>
          <td className="px-2.5 py-2 font-mono font-bold text-xs text-[#3a435d] dark:text-gray-200">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
              <span>{String(dev.devIDNO ?? dev.id ?? '-')}</span>
            </div>
          </td>
          <td className="px-2.5 py-2 text-center">
            <button
              type="button"
              onClick={() => onOpenQrCode(dev)}
              className="group/qr inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all cursor-pointer active:scale-95 min-h-9"
              title={t('ver_descargar_qr')}
            >
              <QrCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover/qr:scale-110 transition-transform" />
              <span className="text-[10px]">{t('ver_qr')}</span>
            </button>
          </td>
          <td className="px-2.5 py-2 font-semibold text-xs text-purple-700 dark:text-purple-300">
            <span className={brandDisplay === 'null' || brandDisplay.includes('Vacío') ? 'text-purple-500 font-bold' : ''}>
              {brandDisplay}
            </span>
          </td>
          <td className="px-2.5 py-2 font-semibold text-xs text-purple-700 dark:text-purple-300">
            <span className={modelDisplay === 'null' || modelDisplay.includes('Vacío') ? 'text-purple-500 font-bold' : ''}>
              {modelDisplay}
            </span>
          </td>
          <td className="px-2.5 py-2 text-center">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bgClass} ${badge.textClass}`}>
              {badge.label}
            </span>
          </td>
          {/* Columna Datos — botón desplegable antes de Estado Servicio */}
          <td className="px-2.5 py-2 text-center whitespace-nowrap">
            <button
              type="button"
              onClick={() => setIsExpandedDetails((p) => !p)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                isExpandedDetails
                  ? 'bg-[#00acee] text-white border-[#00acee] shadow-2xs'
                  : 'bg-[#00acee]/10 text-[#00acee] border-[#00acee]/30 hover:bg-[#00acee]/20 dark:bg-[#00acee]/15'
              }`}
              title={isExpandedDetails ? 'Ocultar datos adicionales' : 'Desplegar datos adicionales'}
            >
              <span>{isExpandedDetails ? 'Ocultar' : 'Desplegar'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpandedDetails ? 'rotate-180' : ''}`} />
            </button>
          </td>
          <td className="px-2.5 py-2 font-semibold text-xs whitespace-nowrap">
            {(() => {
              const sBadge = formatServiceStatus(dev, matchedVehicle, t);
              return (
                <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-extrabold border ${sBadge.bgClass} ${sBadge.textClass} ${sBadge.borderClass}`}>
                  {sBadge.label}
                </span>
              );
            })()}
          </td>
          <td className="px-2.5 py-2 whitespace-nowrap">
            {formatInstallBadge(dev.install, t)}
          </td>
          <td className="px-2.5 py-2 whitespace-nowrap text-center">
            {isReadOnly ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#21262d] border border-gray-200 dark:border-gray-800">
                Solo lectura
              </span>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onEditDevice(dev)}
                  className="group/edit inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 bg-[#00acee]/10 dark:bg-[#00acee]/15 hover:bg-[#00acee] dark:hover:bg-[#00acee] border border-[#00acee] text-[#00acee] hover:text-white dark:hover:text-white"
                  title={t('editar_dispositivo') || 'Editar dispositivo'}
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#00acee] group-hover/edit:text-white transition-colors" />
                  <span>{t('editar_dispositivo') || 'Editar'}</span>
                </button>
                {onDeleteDevice && (
                  <button
                    type="button"
                    onClick={() => onDeleteDevice(dev)}
                    className="group/del inline-flex items-center justify-center p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-600 dark:hover:bg-rose-600 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:text-white dark:hover:text-white"
                    title={t('eliminar_dispositivo') || 'Eliminar'}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 group-hover/del:text-white transition-colors" />
                  </button>
                )}
              </div>
            )}
          </td>
        </tr>
        {isExpandedDetails && (
          <tr className="bg-purple-50/30 dark:bg-purple-950/10">
            <td colSpan={12} className="px-6 py-3">
              <div className="flex flex-wrap gap-6 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">IMEI</span>
                  <span className={`font-mono font-semibold ${imeiStr === '-' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-[#3a435d] dark:text-gray-200'}`}>{imeiStr}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Número de Serie</span>
                  <span className={`font-mono font-semibold ${serialStr === '-' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-[#3a435d] dark:text-gray-200'}`}>{serialStr}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">SIM Vinculada</span>
                  <span className={`font-mono font-semibold ${simStr === '-' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-[#00acee]'}`}>{simStr}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Fecha Asignación</span>
                  <span className={`font-mono font-semibold ${cleanPat ? 'text-[#3a435d] dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 italic'}`}>{formatAssignmentDate(dev, matchedVehicle)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Fecha Registro</span>
                  <span className="font-mono font-semibold text-[#3a435d] dark:text-gray-200">{formatRegistrationDate(dev)}</span>
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <>
      <tr
        className={`transition-colors ${
          isUninstalled
            ? 'hover:bg-amber-50/40 dark:hover:bg-amber-950/20'
            : 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20'
        }`}
      >
        <td className="px-2.5 py-2 font-mono font-bold text-xs text-[#3a435d] dark:text-gray-200 text-center">
          #{displayIndex}
        </td>
        <td className={`px-2.5 py-2 font-mono text-xs ${isUninstalled ? 'font-semibold text-amber-800/70 dark:text-amber-400/80 italic' : 'font-bold text-[#3a435d] dark:text-gray-200'}`}>
          {patent === 'Sin Asignar' ? <span className="text-gray-400 dark:text-gray-500 font-normal italic">{t('sin_asignar')}</span> : patent}
        </td>
        <td className={`px-2.5 py-2 font-semibold text-xs notranslate ${isUninstalled ? 'text-amber-800/70 dark:text-amber-400/80 italic' : 'text-[#3a435d] dark:text-gray-200'}`} translate="no">
          {company === 'Sin Asignar' ? <span className="text-gray-400 dark:text-gray-500 font-normal italic">{t('sin_asignar')}</span> : company}
        </td>
        <td className="px-2.5 py-2 font-mono font-bold text-xs text-[#3a435d] dark:text-gray-200">
          <div className="flex items-center gap-1.5">
            <HardDrive className={`w-3.5 h-3.5 shrink-0 ${isUninstalled ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
            <span className={isUninstalled ? 'text-amber-700 dark:text-amber-400' : 'text-[#3a435d] dark:text-gray-200'}>
              {String(dev.devIDNO ?? dev.id ?? '-')}
            </span>
          </div>
        </td>
        <td className="px-2.5 py-2 text-center">
          <button
            type="button"
            onClick={() => onOpenQrCode(dev)}
            className="group/qr inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all cursor-pointer active:scale-95 min-h-9"
            title={t('ver_descargar_qr')}
          >
            <QrCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover/qr:scale-110 transition-transform" />
            <span className="text-[10px]">{t('ver_qr')}</span>
          </button>
        </td>
        <td className="px-2.5 py-2 font-semibold text-xs text-[#3a435d] dark:text-gray-200">
          {brandStr === 'Sin Asignar' || brandStr === '-' ? (
            <span className="text-gray-400 dark:text-gray-500 font-normal italic">{t('sin_asignar')}</span>
          ) : (
            brandStr
          )}
        </td>
        <td className="px-2.5 py-2 font-semibold text-xs text-[#3a435d] dark:text-gray-200">
          {modelStr === 'Sin Asignar' || modelStr === '-' ? (
            <span className="text-gray-400 dark:text-gray-500 font-normal italic">{t('sin_asignar')}</span>
          ) : (
            modelStr
          )}
        </td>
        <td className="px-2.5 py-2 text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bgClass} ${badge.textClass}`}>
            {badge.label}
          </span>
        </td>
        {/* Columna Datos — botón desplegable antes de Estado Servicio */}
        <td className="px-2.5 py-2 text-center whitespace-nowrap">
          <button
            type="button"
            onClick={() => setIsExpandedDetails((p) => !p)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              isExpandedDetails
                ? 'bg-[#00acee] text-white border-[#00acee] shadow-2xs'
                : 'bg-[#00acee]/10 text-[#00acee] border-[#00acee]/30 hover:bg-[#00acee]/20 dark:bg-[#00acee]/15'
            }`}
            title={isExpandedDetails ? 'Ocultar datos adicionales' : 'Desplegar datos adicionales'}
          >
            <span>{isExpandedDetails ? 'Ocultar' : 'Desplegar'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpandedDetails ? 'rotate-180' : ''}`} />
          </button>
        </td>
        <td className="px-2.5 py-2 font-semibold text-xs whitespace-nowrap">
          {(() => {
            const sBadge = formatServiceStatus(dev, matchedVehicle, t);
            return (
              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-extrabold border ${sBadge.bgClass} ${sBadge.textClass} ${sBadge.borderClass}`}>
                {sBadge.label}
              </span>
            );
          })()}
        </td>
        <td className="px-2.5 py-2 whitespace-nowrap">
          {formatInstallBadge(dev.install, t)}
        </td>
        <td className="px-2.5 py-2 whitespace-nowrap text-center">
          {isReadOnly ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#21262d] border border-gray-200 dark:border-gray-800">
              Solo lectura
            </span>
          ) : (
            <div className="flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => onEditDevice(dev)}
                className="group/edit inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 bg-[#00acee]/10 dark:bg-[#00acee]/15 hover:bg-[#00acee] dark:hover:bg-[#00acee] border border-[#00acee] text-[#00acee] hover:text-white dark:hover:text-white"
                title={t('editar_dispositivo') || 'Editar dispositivo'}
              >
                <Edit3 className="w-3.5 h-3.5 text-[#00acee] group-hover/edit:text-white transition-colors" />
                <span>{t('editar_dispositivo') || 'Editar'}</span>
              </button>
              {onDeleteDevice && (
                <button
                  type="button"
                  onClick={() => onDeleteDevice(dev)}
                  className="group/del inline-flex items-center justify-center p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-600 dark:hover:bg-rose-600 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:text-white dark:hover:text-white"
                  title={t('eliminar_dispositivo') || 'Eliminar'}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 group-hover/del:text-white transition-colors" />
                </button>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* Fila expandible con IMEI, Serie, SIM y fechas */}
      {isExpandedDetails && (
        <tr className={`${isUninstalled ? 'bg-amber-50/30 dark:bg-amber-950/10' : 'bg-emerald-50/30 dark:bg-emerald-950/10'}`}>
          <td colSpan={12} className="px-6 py-3">
            <div className="flex flex-wrap gap-6 text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">IMEI</span>
                <span className={`font-mono font-semibold ${imeiStr === '-' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-[#3a435d] dark:text-gray-200'}`}>{imeiStr}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Número de Serie</span>
                <span className={`font-mono font-semibold ${serialStr === '-' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-[#3a435d] dark:text-gray-200'}`}>{serialStr}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">SIM Vinculada</span>
                <span className={`font-mono font-semibold ${simStr === '-' ? 'text-gray-400 dark:text-gray-500 italic' : 'text-[#00acee]'}`}>{simStr}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Fecha Asignación</span>
                <span className={`font-mono font-semibold ${isUninstalled ? 'text-gray-400 dark:text-gray-500 italic' : 'text-[#3a435d] dark:text-gray-200'}`}>{formatAssignmentDate(dev, matchedVehicle)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Fecha Registro</span>
                <span className="font-mono font-semibold text-[#3a435d] dark:text-gray-200">{formatRegistrationDate(dev)}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});
export default DeviceTableRow;
