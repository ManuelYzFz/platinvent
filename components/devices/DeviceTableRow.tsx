'use client';

import React from 'react';
import { HardDrive, QrCode, Edit3 } from 'lucide-react';
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

  if (isIndefinite) {
    const brandRaw = dev.brand;
    const modelRaw = dev.model;

    const brandStr =
      brandRaw === null || brandRaw === undefined
        ? 'null'
        : String(brandRaw).trim() === ''
          ? '"" (Vacío)'
          : String(brandRaw);

    const modelStr =
      modelRaw === null || modelRaw === undefined
        ? 'null'
        : String(modelRaw).trim() === ''
          ? '"" (Vacío)'
          : String(modelRaw);

    return (
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
        <td className="px-2.5 py-2">
          <button
            type="button"
            onClick={() => onOpenQrCode(dev)}
            className="group/qr flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all cursor-pointer active:scale-95 min-h-9"
            title={t('ver_descargar_qr')}
          >
            <QrCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover/qr:scale-110 transition-transform" />
            <span className="text-[10px]">{t('ver_qr')}</span>
          </button>
        </td>
        <td className="px-2.5 py-2 font-semibold text-xs text-purple-700 dark:text-purple-300">
          <span className={brandStr === 'null' || brandStr.includes('Vacío') ? 'text-purple-500 font-bold' : ''}>
            {brandStr}
          </span>
        </td>
        <td className="px-2.5 py-2 font-semibold text-xs text-purple-700 dark:text-purple-300">
          <span className={modelStr === 'null' || modelStr.includes('Vacío') ? 'text-purple-500 font-bold' : ''}>
            {modelStr}
          </span>
        </td>
        <td className="px-2.5 py-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bgClass} ${badge.textClass}`}>
            {badge.label}
          </span>
        </td>
        <td className={`px-2.5 py-2 font-mono text-xs font-semibold whitespace-nowrap ${cleanPat ? 'text-[#3a435d] dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 italic'}`}>
          {formatAssignmentDate(dev, matchedVehicle)}
        </td>
        <td className="px-2.5 py-2 font-mono text-xs font-semibold whitespace-nowrap text-[#3a435d] dark:text-gray-200">
          {formatRegistrationDate(dev)}
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
          <button
            type="button"
            onClick={() => onEditDevice(dev)}
            className="group/edit inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 bg-[#00acee]/10 dark:bg-[#00acee]/15 hover:bg-[#00acee] dark:hover:bg-[#00acee] border border-[#00acee] text-[#00acee] hover:text-white dark:hover:text-white"
            title={t('editar_dispositivo') || 'Editar dispositivo'}
          >
            <Edit3 className="w-3.5 h-3.5 text-[#00acee] group-hover/edit:text-white transition-colors" />
            <span>{t('editar_dispositivo') || 'Editar'}</span>
          </button>
        </td>
      </tr>
    );
  }

  const brandStr = String(dev.brand ?? '').trim() || '-';
  const modelStr = String(dev.model ?? '').trim() || '-';
  const isUninstalled = type === 'uninstalled';

  return (
    <tr
      key={`${type}-${dev.devIDNO ?? dev.id ?? idx}-${idx}`}
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
      <td className="px-2.5 py-2">
        <button
          type="button"
          onClick={() => onOpenQrCode(dev)}
          className="group/qr flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all cursor-pointer active:scale-95 min-h-9"
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
      <td className="px-2.5 py-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bgClass} ${badge.textClass}`}>
          {badge.label}
        </span>
      </td>
      <td className={`px-2.5 py-2 font-mono text-xs font-semibold whitespace-nowrap ${isUninstalled ? 'text-gray-400 dark:text-gray-500 italic' : 'text-[#3a435d] dark:text-gray-200'}`}>
        {formatAssignmentDate(dev, matchedVehicle)}
      </td>
      <td className="px-2.5 py-2 font-mono text-xs font-semibold whitespace-nowrap text-[#3a435d] dark:text-gray-200">
        {formatRegistrationDate(dev)}
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
          <button
            type="button"
            onClick={() => onEditDevice(dev)}
            className="group/edit inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 bg-[#00acee]/10 dark:bg-[#00acee]/15 hover:bg-[#00acee] dark:hover:bg-[#00acee] border border-[#00acee] text-[#00acee] hover:text-white dark:hover:text-white"
            title={t('editar_dispositivo') || 'Editar dispositivo'}
          >
            <Edit3 className="w-3.5 h-3.5 text-[#00acee] group-hover/edit:text-white transition-colors" />
            <span>{t('editar_dispositivo') || 'Editar'}</span>
          </button>
        )}
      </td>
    </tr>
  );
});
export default DeviceTableRow;
