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
      bgClass: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/80 dark:border-emerald-700',
      textClass: 'text-emerald-700 dark:text-emerald-300',
    };
  }
  if (val === 5) {
    return {
      label: 'GPS',
      bgClass: 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/80 dark:border-indigo-700',
      textClass: 'text-indigo-700 dark:text-indigo-300',
    };
  }
  return {
    label: String(devType ?? type ?? '-'),
    bgClass: 'bg-gray-50 border-gray-300 dark:bg-slate-800 dark:border-slate-700',
    textClass: 'text-gray-700 dark:text-slate-300',
  };
}

export function formatInstallBadge(
  install?: number | string | boolean,
  t?: (k: string) => string
): React.ReactElement {
  const getTxt = (key: string, fallback: string) => (t ? t(key) : fallback);
  if (install === 1 || install === '1' || install === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
        {getTxt('instalado_badge', 'Instalado')}
      </span>
    );
  }
  if (install === 0 || install === '0' || install === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
        {getTxt('no_instalado_badge', 'No Instalado')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-700">
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
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/80',
      textClass: 'text-emerald-700 dark:text-emerald-300',
      borderClass: 'border-emerald-200 dark:border-emerald-700',
    };
  }

  return {
    label: t ? t('sin_servicio') : 'Sin Servicio',
    isActive: false,
    bgClass: 'bg-amber-50 dark:bg-amber-950/80',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-200 dark:border-amber-700',
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
