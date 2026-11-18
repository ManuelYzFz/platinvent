import React from 'react';
import type { DeviceRecord, VehicleRecord } from '@/lib/types/inventory';

export function formatDeviceBadge(
  devType?: string | number,
  type?: string | number
): { label: string; bgClass: string; textClass: string } {
  const val = Number(devType ?? type);
  if (val === 7) {
    return {
      label: 'MDVR',
      bgClass: 'bg-emerald-500/10 border-emerald-500/25 dark:bg-emerald-500/15 dark:border-emerald-500/30',
      textClass: 'text-emerald-600 dark:text-emerald-400 font-extrabold',
    };
  }
  if (val === 5) {
    return {
      label: 'GPS',
      bgClass: 'bg-[#00A3E0]/10 border-[#00A3E0]/30 dark:bg-[#00A3E0]/15 dark:border-[#00A3E0]/35',
      textClass: 'text-[#00A3E0] dark:text-[#00A3E0] font-extrabold',
    };
  }
  return {
    label: String(devType ?? type ?? '-'),
    bgClass: 'bg-slate-500/10 border-slate-500/20 dark:bg-slate-700/20 dark:border-slate-600/30',
    textClass: 'text-slate-700 dark:text-slate-300 font-bold',
  };
}

export function formatInstallBadge(
  install?: number | string | boolean,
  t?: (k: string) => string
): React.ReactElement {
  const getTxt = (key: string, fallback: string) => (t ? t(key) : fallback);
  if (install === 1 || install === '1' || install === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {getTxt('instalado_badge', 'Instalado')}
      </span>
    );
  }
  if (install === 0 || install === '0' || install === false) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 border border-amber-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {getTxt('no_instalado_badge', 'No Instalado')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 dark:bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-600 dark:text-purple-400 border border-purple-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
      {getTxt('indefinido_badge', 'Indefinido')}
    </span>
  );
}

export function getCleanPatent(dev: DeviceRecord, matchedVeh?: VehicleRecord): string | null {
  const raw = (
    matchedVeh?.vid ||
    matchedVeh?.vehiIdno ||
    dev.vehiIdno ||
    dev.vehiIDNO ||
    dev.vid ||
    ''
  ).toString().trim();
  if (!raw || raw === 'Sin Asignar' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') {
    return null;
  }
  return raw;
}

export function getCleanCompany(dev: DeviceRecord, matchedVeh?: VehicleRecord): string | null {
  const raw = (
    matchedVeh?.com?.name ||
    matchedVeh?.com?.companyName ||
    dev.companyName ||
    (dev as Record<string, unknown>).company ||
    ((dev as Record<string, unknown>).com as Record<string, unknown> | undefined)?.name ||
    ''
  ).toString().trim();
  if (!raw || raw === 'Sin Asignar' || raw === 'Libre' || raw.toLowerCase() === 'null' || raw.toLowerCase() === 'undefined') {
    return null;
  }
  return raw;
}

export function formatAssignmentDate(dev: DeviceRecord, matchedVehicle?: VehicleRecord): string {
  const cleanPat = getCleanPatent(dev, matchedVehicle);
  if (!cleanPat) return '-';
  if (dev.assignmentDate && typeof dev.assignmentDate === 'string' && dev.assignmentDate.trim() !== '') {
    return dev.assignmentDate;
  }
  if (matchedVehicle?.itm && typeof matchedVehicle.itm === 'string') {
    return String(matchedVehicle.itm).slice(0, 10);
  }
  return '-';
}

export function formatRegistrationDate(dev: DeviceRecord): string {
  if (dev.registrationDate && typeof dev.registrationDate === 'string' && dev.registrationDate.trim() !== '') {
    return dev.registrationDate;
  }
  return '2026-08-12';
}

export interface ServiceStatusBadge {
  label: string;
  isActive: boolean;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export function formatServiceStatus(
  dev: DeviceRecord,
  matchedVehicle?: VehicleRecord,
  t?: (k: string) => string
): ServiceStatusBadge {
  let isActive = false;
  if (dev.serviceStatus) {
    const raw = String(dev.serviceStatus).toLowerCase().trim();
    isActive = raw === 'active' || raw === 'activo' || raw === 'servicio activo' || raw === '1';
  } else if (matchedVehicle?.stm && typeof matchedVehicle.stm === 'string' && matchedVehicle.stm.trim() !== '' && matchedVehicle.stm.toLowerCase() !== 'sin servicio') {
    isActive = true;
  } else {
    isActive = (Number(dev.install) === 1 || dev.install === true) && Boolean(matchedVehicle);
  }

  if (isActive) {
    return {
      label: t ? t('servicio_activo') : 'Servicio Activo',
      isActive: true,
      bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      textClass: 'text-emerald-600 dark:text-emerald-400 font-extrabold',
      borderClass: 'border-emerald-500/25 dark:border-emerald-500/30',
    };
  }

  return {
    label: t ? t('sin_servicio') : 'Sin Servicio',
    isActive: false,
    bgClass: 'bg-slate-500/10 dark:bg-slate-700/20',
    textClass: 'text-slate-500 dark:text-slate-400 font-bold',
    borderClass: 'border-slate-500/20 dark:border-slate-600/30',
  };
}

export function formatStm(dev: DeviceRecord, matchedVehicle?: VehicleRecord, t?: (k: string) => string): string {
  return formatServiceStatus(dev, matchedVehicle, t).label;
}

export function classifyDevice(
  dev: DeviceRecord,
  matchedVeh?: VehicleRecord
): 'installed' | 'uninstalled' | 'indefinite' {
  const hasVehicle = getCleanPatent(dev, matchedVeh) !== null;
  const hasCompany = getCleanCompany(dev, matchedVeh) !== null;

  const hasDevId = Boolean(dev.devIDNO && String(dev.devIDNO).trim() !== '');
  const hasDevType = dev.devType !== undefined && dev.devType !== null && String(dev.devType).trim() !== '';
  const hasInstall = dev.install !== undefined && dev.install !== null && String(dev.install).trim() !== '';

  const isInstalled = Number(dev.install) === 1 || String(dev.install) === '1' || dev.install === true;
  const isUninstalled = Number(dev.install) === 0 || String(dev.install) === '0' || dev.install === false;

  if (!hasDevId || !hasDevType || !hasInstall) {
    return 'indefinite';
  }

  if ((hasVehicle && !hasCompany) || (!hasVehicle && hasCompany)) {
    return 'indefinite';
  }

  if (hasVehicle && hasCompany && isUninstalled) {
    return 'indefinite';
  }
  if (isInstalled && (!hasVehicle || !hasCompany)) {
    return 'indefinite';
  }
  if (!isInstalled && !isUninstalled) {
    return 'indefinite';
  }

  if (isInstalled && hasVehicle && hasCompany) {
    return 'installed';
  }
  if (isUninstalled && !hasVehicle && !hasCompany) {
    return 'uninstalled';
  }

  return 'indefinite';
}
