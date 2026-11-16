/**
 * Shared data extraction utilities for OpenTraxx API responses.
 * These functions handle the various shapes that array data can arrive in
 * from both the local JSON files and the external OpenTraxx API.
 */

import type { DeviceRecord, VehicleRecord, SimRecord } from '@/lib/types/inventory';

export function extractDevicesArray(data: unknown): DeviceRecord[] {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data)) return data as DeviceRecord[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.infos)) return obj.infos as DeviceRecord[];
  if (Array.isArray(obj.devices)) return obj.devices as DeviceRecord[];
  if (Array.isArray(obj.root)) return obj.root as DeviceRecord[];
  return [];
}

export function extractVehiclesArray(data: unknown): VehicleRecord[] {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data)) return data as VehicleRecord[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.infos)) return obj.infos as VehicleRecord[];
  if (Array.isArray(obj.vehicles)) return obj.vehicles as VehicleRecord[];
  if (Array.isArray(obj.root)) return obj.root as VehicleRecord[];
  return [];
}

export function extractSimsArray(data: unknown): SimRecord[] {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data)) return data as SimRecord[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.infos)) return obj.infos as SimRecord[];
  if (Array.isArray(obj.sims)) return obj.sims as SimRecord[];
  if (Array.isArray(obj.root)) return obj.root as SimRecord[];
  return [];
}
