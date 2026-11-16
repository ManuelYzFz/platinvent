import type { SimRecord, VehicleRecord, DeviceRecord } from '@/lib/types/inventory';
import { formatDateTime } from '@/lib/utils/date-format';

export function getSimDevIdno(sim: SimRecord): string {
  if (sim.devIDNO && String(sim.devIDNO).trim() !== '') {
    return String(sim.devIDNO).trim();
  }
  if (sim.devId && String(sim.devId).trim() !== '') {
    return String(sim.devId).trim();
  }
  return '-';
}

export function getSimCompanyName(sim: SimRecord, t?: (k: string) => string): string {
  if (sim.company?.name && String(sim.company.name).trim() !== '') {
    return String(sim.company.name);
  }
  if (sim.companyName && String(sim.companyName).trim() !== '') {
    return String(sim.companyName);
  }
  return t ? t('sin_asignar') : 'Sin Asignar';
}

export function formatRegistrationTime(time?: number | string): string {
  if (!time) return '-';
  const formatted = formatDateTime(time);
  return formatted || String(time);
}

export function getMatchedPatent(
  sim: SimRecord,
  vehicles: VehicleRecord[] = [],
  devices: DeviceRecord[] = [],
  isAssigned = false
): string {
  if (!isAssigned) return '';

  const devId = getSimDevIdno(sim);
  let matchedPatent = '';

  // 1. Verificar si la SIM ya tiene vehiIdno registrado
  if (sim.vehiIdno && String(sim.vehiIdno).trim() !== '') {
    matchedPatent = String(sim.vehiIdno).trim();
  } else if (sim.vehiIDNO && String(sim.vehiIDNO).trim() !== '') {
    matchedPatent = String(sim.vehiIDNO).trim();
  }

  // 2. Si no tiene patente directa, buscar en la lista de vehículos mediante devList
  if (!matchedPatent && devId && devId !== '-' && vehicles.length > 0) {
    const matchV = vehicles.find((v) => {
      const devList = Array.isArray(v.devList) ? v.devList : (Array.isArray(v.dl) ? v.dl : []);
      return devList.some((d) => String(d.name ?? d.id ?? d.serialID).trim() === devId);
    });
    if (matchV) {
      matchedPatent = String(matchV.lp || matchV.vehiIdno || matchV.vid || '');
    }
  }

  // 3. Si aún no se encuentra, verificar si el dispositivo en devices.json fue vinculado con un vehículo
  if (!matchedPatent && devId && devId !== '-' && devices.length > 0) {
    const matchD = devices.find((d) => String(d.devIDNO ?? d.devIdno ?? d.id).trim() === devId);
    if (matchD?.vehiIdno && String(matchD.vehiIdno).trim() !== '') {
      matchedPatent = String(matchD.vehiIdno).trim();
    }
  }

  // 4. Si matchedPatent es un ID interno (vid), traducir a patente real (lp) si existe
  if (matchedPatent && vehicles.length > 0) {
    const matchV = vehicles.find(
      (v) => String(v.vid ?? v.vehiIdno ?? v.id ?? '').toLowerCase() === matchedPatent.toLowerCase()
    );
    if (matchV?.lp && String(matchV.lp).trim() !== '') {
      matchedPatent = String(matchV.lp).trim();
    }
  }

  return matchedPatent;
}
