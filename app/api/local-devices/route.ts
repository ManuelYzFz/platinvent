import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validateApiSession, requireRole, WRITE_ROLES } from '@/lib/utils/api-auth';
import { USE_LOCAL_DATA } from '@/lib/constants';
import { ValidationError } from '@/lib/validation/inventory';
import { listDevices, saveDevice, countDevices, deleteDevice } from '@/lib/db-inventory';

// Simple in-process write lock to prevent race conditions on concurrent POSTs.
// NOTE: For multi-instance / serverless production, replace with database or
// distributed lock (Redis, Firestore transactions, etc.).
let writeLock = false;


const LOCAL_DATA_DIR = path.join(process.cwd(), 'datoslocales');
const LOCAL_JSON_FILE = path.join(LOCAL_DATA_DIR, 'devices.json');


// GET: Leer dispositivos físicamente desde datoslocales/devices.json
export async function GET(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  if (!USE_LOCAL_DATA) {
    try {
      return NextResponse.json(await listDevices());
    } catch (error) {
      console.error('Error consultando MySQL (listDevices):', error);
      return NextResponse.json({ error: 'Error al consultar dispositivos' }, { status: 500 });
    }
  }
  try {
    const rawContent = await fs.readFile(LOCAL_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error leyendo datoslocales/devices.json:', error);
    return NextResponse.json(
      { error: 'Error al consultar dispositivos' },
      { status: 500 }
    );
  }
}

// POST: Escribir nuevo dispositivo físicamente en datoslocales/devices.json
export async function POST(req: Request) {
  const auth = validateApiSession(req);
  if (!auth.valid && auth.response) return auth.response;

  // Solo superadmin/admin pueden escribir (verificado en el servidor)
  const roleCheck = await requireRole(req, WRITE_ROLES);
  if (!roleCheck.ok) return roleCheck.response;

  // Race-condition guard: reject concurrent writes
  if (writeLock) {
    return NextResponse.json(
      { error: 'El servidor está procesando otra solicitud. Intenta nuevamente.' },
      { status: 503 }
    );
  }

  try {
    writeLock = true;
    const body = await req.json();
    const newDevice = body.device;

    if (!newDevice || (!newDevice.devIDNO && !newDevice.devIdno)) {
      return NextResponse.json(
        { error: 'Se requiere el objeto device con devIDNO (device No).' },
        { status: 400 }
      );
    }

    const devIdnoVal = String(newDevice.devIDNO || newDevice.devIdno || '').trim();
    if (!devIdnoVal) {
      return NextResponse.json(
        { error: 'El device No es obligatorio.' },
        { status: 400 }
      );
    }

    const isInstalled = newDevice.install !== undefined ? Number(newDevice.install) : 0;
    const companyNameVal = typeof newDevice.companyName === 'string' ? newDevice.companyName.trim() : '';
    if (isInstalled === 1 && !companyNameVal) {
      return NextResponse.json(
        { error: 'La Empresa es obligatoria para dispositivos instalados.' },
        { status: 400 }
      );
    }

    if (newDevice.devType === undefined || newDevice.devType === null || isNaN(Number(newDevice.devType))) {
      return NextResponse.json(
        { error: 'El Tipo de Dispositivo es obligatorio.' },
        { status: 400 }
      );
    }

    if (!USE_LOCAL_DATA) {
      const device = await saveDevice(newDevice);
      return NextResponse.json({ success: true, count: await countDevices(), device });
    }

    const rawContent = await fs.readFile(LOCAL_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent);

    const infos = Array.isArray(parsed.infos) ? parsed.infos : [];

    // Generar un ID único incremental
    const maxId = infos.reduce((max: number, item: { id?: number }) => {
      const numId = Number(item.id) || 0;
      return numId > max ? numId : max;
    }, 0);

    const vehiIdnoVal = isInstalled === 1 && newDevice.vehiIdno ? String(newDevice.vehiIdno).trim() : null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const assignmentDateVal = vehiIdnoVal
      ? (newDevice.assignmentDate ? String(newDevice.assignmentDate).slice(0, 10) : todayStr)
      : null;
    const registrationDateVal = newDevice.registrationDate
      ? String(newDevice.registrationDate).slice(0, 10)
      : todayStr;

    // --- Allowlist explícita de campos según esquema solicitado ---
    const deviceToInsert = {
      id: maxId + 1,
      devIDNO: devIdnoVal,
      companyId: isInstalled === 1 ? (newDevice.companyId ? Number(newDevice.companyId) : 1) : null,
      companyName: isInstalled === 1 ? (companyNameVal || 'Opentraxx') : null,
      devType: Number(newDevice.devType) || 7,
      serialID: newDevice.serialID ? String(newDevice.serialID).trim() : null,
      actualCardNumber: newDevice.actualCardNumber ? String(newDevice.actualCardNumber).trim() : null,
      brand: newDevice.brand ? String(newDevice.brand).trim() : null,
      model: newDevice.model ? String(newDevice.model).trim() : null,
      install: isInstalled,
      serviceStatus: newDevice.serviceStatus ? String(newDevice.serviceStatus).trim() : (isInstalled === 1 ? 'active' : 'inactive'),
      stlTm: null,
      stlTmStr: null,
      vehiIdno: vehiIdnoVal,
      simInfo: newDevice.simInfo ? String(newDevice.simInfo).trim() : null,
      chnName: Number(newDevice.devType) === 7 ? 'CH1,CH2,CH3,CH4' : null,
      stlTmEx: null,
      stlTmExStr: null,
      factoryDevType: Number(newDevice.devType) === 7 ? (isInstalled === 1 ? 1 : 0) : 0,
      checkStatus: null,
      checkTime: null,
      checkTimeStr: null,
      ifMainDefense: 0,
      assignmentDate: assignmentDateVal,
      registrationDate: registrationDateVal,
      imei: newDevice.imei ? String(newDevice.imei).trim() : null,
      qrCode: newDevice.qrCode ? String(newDevice.qrCode).trim() : null,
    };

    // Si ya existe un dispositivo (primero por ID numérico en ediciones, o por devIDNO en altas), actualizarlo en lugar de duplicar
    let existingIndex = -1;
    if (newDevice.id !== undefined && newDevice.id !== null && String(newDevice.id).trim() !== '') {
      existingIndex = infos.findIndex(
        (d: { id?: number | string }) => String(d.id ?? '').trim() === String(newDevice.id).trim()
      );
    }

    if (existingIndex < 0) {
      existingIndex = infos.findIndex(
        (d: { devIDNO?: string; devIdno?: string; serialID?: string }) =>
          String(d.devIDNO ?? d.devIdno ?? d.serialID ?? '').trim() === devIdnoVal
      );
    }

    let updatedInfos;
    if (existingIndex >= 0) {
      const existing = infos[existingIndex];
      deviceToInsert.id = existing.id ?? deviceToInsert.id;
      deviceToInsert.simInfo = deviceToInsert.simInfo || existing.simInfo || null;
      deviceToInsert.actualCardNumber = deviceToInsert.actualCardNumber || existing.actualCardNumber || null;
      infos[existingIndex] = { ...existing, ...deviceToInsert };
      updatedInfos = [...infos];
    } else {
      updatedInfos = [deviceToInsert, ...infos];
    }

    parsed.infos = updatedInfos;
    await fs.writeFile(LOCAL_JSON_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

    // Sincronizar en datoslocales/vehicles.json agregando el dispositivo a devList del vehículo seleccionado
    const LOCAL_VEHICLES_FILE = path.join(LOCAL_DATA_DIR, 'vehicles.json');
    if (deviceToInsert.install === 1 && deviceToInsert.vehiIdno) {
      try {
        const targetVehicleId = String(deviceToInsert.vehiIdno).trim();
        const rawVehContent = await fs.readFile(LOCAL_VEHICLES_FILE, 'utf-8');
        const parsedVeh = JSON.parse(rawVehContent);
        const vehInfos = Array.isArray(parsedVeh.infos) ? parsedVeh.infos : [];

        const targetVeh = vehInfos.find((v: { vid?: string; vehiIdno?: string; id?: number | string }) => {
          return (
            String(v.vid ?? '').trim().toLowerCase() === targetVehicleId.toLowerCase() ||
            String(v.vehiIdno ?? '').trim().toLowerCase() === targetVehicleId.toLowerCase() ||
            String(v.id ?? '').trim() === targetVehicleId
          );
        });

        if (targetVeh) {
          if (!Array.isArray(targetVeh.devList)) {
            targetVeh.devList = [];
          }
          const alreadyInList = targetVeh.devList.some(
            (d: { name?: string; id?: string | number; serialID?: string }) =>
              String(d.name ?? d.id ?? d.serialID) === devIdnoVal
          );
          if (!alreadyInList) {
            targetVeh.devList.push({
              id: String(deviceToInsert.id),
              name: devIdnoVal,
              simInfo: deviceToInsert.simInfo || null,
              serialID: devIdnoVal,
            });
            await fs.writeFile(LOCAL_VEHICLES_FILE, JSON.stringify(parsedVeh, null, 2), 'utf-8');
          }
        }
      } catch (vehErr) {
        console.warn('Advertencia actualizando devList en vehicles.json:', vehErr);
      }

      // Sincronizar en datoslocales/simCard.json: Si existe una SIM asignada a este devIDNO, actualizarle el vehiIdno
      const LOCAL_SIM_FILE = path.join(LOCAL_DATA_DIR, 'simCard.json');
      try {
        const rawSimContent = await fs.readFile(LOCAL_SIM_FILE, 'utf-8');
        const parsedSim = JSON.parse(rawSimContent);
        const simInfos = Array.isArray(parsedSim.infos) ? parsedSim.infos : [];

        let simModified = false;
        for (const s of simInfos) {
          const isMatchedByDev = devIdnoVal && String(s.devIDNO ?? s.devIdno ?? '').trim() === devIdnoVal;
          const isMatchedBySim = deviceToInsert.simInfo && (
            String(s.simCard ?? '').trim() === deviceToInsert.simInfo ||
            String(s.cardNum ?? '').trim() === deviceToInsert.simInfo
          );

          if (isMatchedByDev || isMatchedBySim) {
            s.devIDNO = devIdnoVal;
            s.vehiIDNO = deviceToInsert.vehiIdno;
            s.install = deviceToInsert.install;
            if (deviceToInsert.companyName && (!s.companyName || s.companyName === 'Sin Asignar' || s.companyName === 'Libre')) {
              s.companyName = deviceToInsert.companyName;
            }
            if (deviceToInsert.companyId) {
              s.companyID = deviceToInsert.companyId;
            }
            simModified = true;

            if (!deviceToInsert.simInfo && s.simCard) {
              deviceToInsert.simInfo = s.simCard;
            }
            if (!deviceToInsert.actualCardNumber && s.cardNum) {
              deviceToInsert.actualCardNumber = s.cardNum;
            }
          }
        }

        if (simModified) {
          await fs.writeFile(LOCAL_SIM_FILE, JSON.stringify(parsedSim, null, 2), 'utf-8');
        }
      } catch (simErr) {
        console.warn('Advertencia sincronizando vehiIdno en simCard.json:', simErr);
      }
    }

    return NextResponse.json({ success: true, count: updatedInfos.length, device: deviceToInsert });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    console.error('Error escribiendo en datoslocales/devices.json:', error);
    return NextResponse.json(
      { error: 'Error interno al guardar el dispositivo' },
      { status: 500 }
    );
  } finally {
    // Always release the lock, even if an exception was thrown
    writeLock = false;
  }
}

// DELETE: Eliminar dispositivo (MySQL o fallback local JSON)
export async function DELETE(req: Request) {
  const auth = validateApiSession(req);
  if (!auth.valid && auth.response) return auth.response;

  // Solo superadmin/admin pueden eliminar (verificado en el servidor)
  const roleCheck = await requireRole(req, WRITE_ROLES);
  if (!roleCheck.ok) return roleCheck.response;

  if (writeLock) {
    return NextResponse.json(
      { error: 'El servidor está procesando otra solicitud. Intenta nuevamente.' },
      { status: 503 }
    );
  }

  try {
    writeLock = true;
    const body = await req.json().catch(() => ({}));
    const id = body.id;
    const devIdno = body.devIDNO || body.devIdno;

    if (!id && !devIdno) {
      return NextResponse.json(
        { error: 'Se requiere el id o devIDNO del dispositivo a eliminar.' },
        { status: 400 }
      );
    }

    if (!USE_LOCAL_DATA) {
      const result = await deleteDevice(id, devIdno);
      return NextResponse.json({ success: true, count: await countDevices(), deleted: result });
    }

    // Local JSON fallback
    const rawContent = await fs.readFile(LOCAL_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent);
    const infos = Array.isArray(parsed.infos) ? parsed.infos : [];

    const targetDevIdno = String(devIdno || '').trim();
    const targetId = id !== undefined && id !== null ? String(id).trim() : '';

    const deviceToDelete = infos.find((d: { id?: number | string; devIDNO?: string; devIdno?: string }) => {
      if (targetId && String(d.id ?? '').trim() === targetId) return true;
      if (targetDevIdno && String(d.devIDNO ?? d.devIdno ?? '').trim() === targetDevIdno) return true;
      return false;
    });

    if (!deviceToDelete) {
      return NextResponse.json({ error: 'Dispositivo no encontrado en datos locales.' }, { status: 404 });
    }

    parsed.infos = infos.filter((d: { id?: number | string; devIDNO?: string; devIdno?: string }) => {
      if (targetId && String(d.id ?? '').trim() === targetId) return false;
      if (targetDevIdno && String(d.devIDNO ?? d.devIdno ?? '').trim() === targetDevIdno) return false;
      return true;
    });

    await fs.writeFile(LOCAL_JSON_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

    // Desvincular de vehicles.json si estaba asignado
    const actualDevIdno = String(deviceToDelete.devIDNO ?? deviceToDelete.devIdno ?? targetDevIdno).trim();
    if (actualDevIdno) {
      const LOCAL_VEHICLES_FILE = path.join(LOCAL_DATA_DIR, 'vehicles.json');
      try {
        const rawVeh = await fs.readFile(LOCAL_VEHICLES_FILE, 'utf-8');
        const parsedVeh = JSON.parse(rawVeh);
        const vehInfos = Array.isArray(parsedVeh.infos) ? parsedVeh.infos : [];
        let vehModified = false;
        for (const v of vehInfos) {
          if (Array.isArray(v.devList)) {
            const initialLen = v.devList.length;
            v.devList = v.devList.filter((d: { name?: string; id?: string | number; serialID?: string }) => {
              return String(d.name ?? d.id ?? d.serialID) !== actualDevIdno && (targetId ? String(d.id) !== targetId : true);
            });
            if (v.devList.length !== initialLen) vehModified = true;
          }
        }
        if (vehModified) {
          await fs.writeFile(LOCAL_VEHICLES_FILE, JSON.stringify(parsedVeh, null, 2), 'utf-8');
        }
      } catch (e) {
        console.warn('Advertencia desvinculando de vehicles.json:', e);
      }

      // Desvincular de simCard.json
      const LOCAL_SIM_FILE = path.join(LOCAL_DATA_DIR, 'simCard.json');
      try {
        const rawSim = await fs.readFile(LOCAL_SIM_FILE, 'utf-8');
        const parsedSim = JSON.parse(rawSim);
        const simInfos = Array.isArray(parsedSim.infos) ? parsedSim.infos : [];
        let simModified = false;
        for (const s of simInfos) {
          if (String(s.devIDNO ?? s.devIdno ?? '').trim() === actualDevIdno) {
            s.devIDNO = null;
            s.vehiIDNO = null;
            s.install = 0;
            simModified = true;
          }
        }
        if (simModified) {
          await fs.writeFile(LOCAL_SIM_FILE, JSON.stringify(parsedSim, null, 2), 'utf-8');
        }
      } catch (e) {
        console.warn('Advertencia desvinculando de simCard.json:', e);
      }
    }

    return NextResponse.json({ success: true, count: parsed.infos.length, deleted: deviceToDelete });
  } catch (error: any) {
    console.error('Error eliminando dispositivo:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno al eliminar el dispositivo' },
      { status: 500 }
    );
  } finally {
    writeLock = false;
  }
}


