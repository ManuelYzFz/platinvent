import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validateApiSession, requireRole, WRITE_ROLES } from '@/lib/utils/api-auth';
import { USE_LOCAL_DATA } from '@/lib/constants';
import { ValidationError } from '@/lib/validation/inventory';
import { listSims, saveSim, countSims } from '@/lib/db-inventory';

const LOCAL_DATA_DIR = path.join(process.cwd(), 'datoslocales');
const LOCAL_JSON_FILE = path.join(LOCAL_DATA_DIR, 'simCard.json');

let writeLock = false;
// GET: Obtener todas las SIM Cards de datoslocales/simCard.json
export async function GET(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  if (!USE_LOCAL_DATA) {
    try {
      return NextResponse.json(await listSims());
    } catch (error) {
      console.error('Error consultando MySQL (listSims):', error);
      return NextResponse.json({ error: 'Error al consultar SIM cards' }, { status: 500 });
    }
  }
  try {
    const rawContent = await fs.readFile(LOCAL_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error leyendo datoslocales/simCard.json:', error);
    return NextResponse.json(
      { error: 'Error al consultar SIM cards' },
      { status: 500 }
    );
  }
}

// POST: Agregar una nueva SIM Card a datoslocales/simCard.json sin perder ningún campo
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
    const newSim = body.sim;


    if (!newSim || (!newSim.simCard && !newSim.cardNum)) {
      return NextResponse.json(
        { error: 'Se requieren los campos obligatorios de la SIM Card' },
        { status: 400 }
      );
    }

    if (!USE_LOCAL_DATA) {
      const sim = await saveSim(newSim);
      return NextResponse.json({ success: true, count: await countSims(), sim });
    }

    const rawContent = await fs.readFile(LOCAL_JSON_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent);

    const infos = Array.isArray(parsed.infos) ? parsed.infos : [];

    // Generar un ID único incremental
    const maxId = infos.reduce((max: number, item: { id?: number }) => {
      const numId = Number(item.id) || 0;
      return numId > max ? numId : max;
    }, 0);

    const devIdnoVal = (newSim.devIDNO || '').trim();
    const installVal = newSim.install !== undefined ? Number(newSim.install) : (devIdnoVal ? 1 : 0);
    const statusVal = newSim.status !== undefined ? Number(newSim.status) : 1;
    const companyIDVal = Number(newSim.companyID || newSim.companyId || 1);
    const regTimeVal = newSim.registrationTime || Date.now();
    const cleanCardNumVal = (newSim.cardNum || '').replace(/\+/g, '').trim();
    const cleanSimCardVal = (newSim.simCard || '').replace(/\+/g, '').trim() || null;
    const serviceProviderVal = newSim.serviceProvider || null;
    let vehiIDNOVal = newSim.vehiIDNO || newSim.vehiIdno || null;

    // Si se especificó un ID existente, actualizar en lugar de insertar duplicado
    const existingIndex = (newSim.id !== undefined && newSim.id !== null)
      ? infos.findIndex((item: { id?: number | string }) => String(item.id) === String(newSim.id))
      : -1;

    // Si se especificó un dispositivo (devIDNO), sincronizar datos con devices.json
    const LOCAL_DEVICES_FILE = path.join(LOCAL_DATA_DIR, 'devices.json');
    if (devIdnoVal) {
      try {
        const rawDevContent = await fs.readFile(LOCAL_DEVICES_FILE, 'utf-8');
        const parsedDev = JSON.parse(rawDevContent);
        const devInfos = Array.isArray(parsedDev.infos) ? parsedDev.infos : [];

        const targetDev = devInfos.find(
          (d: { devIDNO?: string; devIdno?: string; id?: string | number }) =>
            String(d.devIDNO ?? d.devIdno ?? d.id).trim() === devIdnoVal
        );

        if (targetDev) {
          targetDev.simInfo = cleanSimCardVal;
          targetDev.actualCardNumber = cleanCardNumVal;
          // Si el dispositivo ya tenía un vehículo asignado, heredar su vehiIdno
          if (targetDev.vehiIdno && !vehiIDNOVal) {
            vehiIDNOVal = String(targetDev.vehiIdno);
          }
          await fs.writeFile(LOCAL_DEVICES_FILE, JSON.stringify(parsedDev, null, 2), 'utf-8');
        }
      } catch (devErr) {
        console.warn('Advertencia sincronizando simInfo en devices.json:', devErr);
      }
    }

    if (existingIndex >= 0) {
      const previousSim = infos[existingIndex];
      const prevDevIdno = (previousSim.devIDNO || '').trim();

      // Si cambió de dispositivo o se desasignó, desvincular el dispositivo anterior
      if (prevDevIdno && prevDevIdno !== devIdnoVal) {
        try {
          const rawDevContent = await fs.readFile(LOCAL_DEVICES_FILE, 'utf-8');
          const parsedDev = JSON.parse(rawDevContent);
          const devInfos = Array.isArray(parsedDev.infos) ? parsedDev.infos : [];
          const prevDev = devInfos.find(
            (d: { devIDNO?: string; devIdno?: string; id?: string | number }) =>
              String(d.devIDNO ?? d.devIdno ?? d.id).trim() === prevDevIdno
          );
          if (prevDev) {
            prevDev.simInfo = null;
            prevDev.actualCardNumber = null;
            await fs.writeFile(LOCAL_DEVICES_FILE, JSON.stringify(parsedDev, null, 2), 'utf-8');
          }
        } catch (devErr) {
          console.warn('Advertencia desvinculando dispositivo anterior en devices.json:', devErr);
        }
      }

      const updatedRecord = {
        ...previousSim,
        cardNum: cleanCardNumVal,
        status: statusVal,
        updateTime: Date.now(),
        install: installVal,
        devIDNO: devIdnoVal || null,
        vehiIDNO: vehiIDNOVal,
        companyID: companyIDVal,
        simCard: cleanSimCardVal,
        companyName: (typeof newSim.companyName === 'string' && newSim.companyName.trim()) || previousSim.companyName || 'Opentraxx',
        serviceProvider: serviceProviderVal,
        planName: typeof newSim.planName === 'string' ? newSim.planName.slice(0, 100) : null,
        city: typeof newSim.city === 'string' ? newSim.city.slice(0, 100) : null,
        operator: typeof newSim.operator === 'string' ? newSim.operator.slice(0, 50) : (previousSim.operator ?? null),
        devId: typeof newSim.devId === 'number' || typeof newSim.devId === 'string' ? newSim.devId : (previousSim.devId ?? null),
        oldDevId: typeof newSim.oldDevId === 'number' || typeof newSim.oldDevId === 'string' ? newSim.oldDevId : (previousSim.oldDevId ?? null),
        remark: typeof newSim.remark === 'string' ? newSim.remark.slice(0, 500) : (previousSim.remark ?? null),
        endTime: typeof newSim.endTime === 'number' || typeof newSim.endTime === 'string' ? newSim.endTime : null,
        cardMerchant: typeof newSim.cardMerchant === 'string' ? newSim.cardMerchant.slice(0, 100) : null,
        msisdn: typeof newSim.msisdn === 'string' ? newSim.msisdn.slice(0, 50) : null,
        id: previousSim.id,
      };

      infos[existingIndex] = updatedRecord;
      parsed.infos = infos;

      await fs.writeFile(LOCAL_JSON_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

      return NextResponse.json({ success: true, count: infos.length, sim: updatedRecord });
    }

    const simToInsert = {
      cardNum: cleanCardNumVal,
      status: statusVal,
      registrationTime: regTimeVal,
      remark: newSim.remark ?? null,
      updateTime: newSim.updateTime ?? null,
      install: installVal,
      devIDNO: devIdnoVal || null,
      vehiIDNO: vehiIDNOVal,
      companyID: companyIDVal,
      simCard: cleanSimCardVal,
      companyName: newSim.companyName || 'Opentraxx',
      serviceProvider: serviceProviderVal,
      planName: newSim.planName ?? null,
      city: newSim.city ?? null,
      operator: null,
      devId: newSim.devId ?? null,
      oldDevId: newSim.oldDevId ?? null,
      endTime: newSim.endTime ?? null,
      cardMerchant: newSim.cardMerchant ?? null,
      msisdn: newSim.msisdn ?? null,
      id: maxId + 1,
    };

    const updatedInfos = [simToInsert, ...infos];
    parsed.infos = updatedInfos;

    await fs.writeFile(LOCAL_JSON_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

    return NextResponse.json({ success: true, count: updatedInfos.length, sim: simToInsert });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    console.error('Error guardando en datoslocales/simCard.json:', error);
    return NextResponse.json(
      { error: 'Error interno al guardar la tarjeta SIM' },
      { status: 500 }
    );
  } finally {
    writeLock = false;
  }
}

// PUT: Actualizar una SIM Card existente (delega a POST con soporte de ID)
export async function PUT(req: Request) {
  return POST(req);
}

