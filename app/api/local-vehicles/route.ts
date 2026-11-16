import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validateApiSession, requireRole, WRITE_ROLES } from '@/lib/utils/api-auth';
import { USE_LOCAL_DATA } from '@/lib/constants';
import { ValidationError } from '@/lib/validation/inventory';
import { listVehicles, saveVehicle } from '@/lib/db-inventory';

const LOCAL_DATA_DIR = path.join(process.cwd(), 'datoslocales');
const LOCAL_VEHICLES_FILE = path.join(LOCAL_DATA_DIR, 'vehicles.json');

export async function GET(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  if (!USE_LOCAL_DATA) {
    try {
      return NextResponse.json(await listVehicles());
    } catch (error) {
      console.error('Error consultando MySQL (listVehicles):', error);
      return NextResponse.json({ error: 'Error al consultar lista de vehículos' }, { status: 500 });
    }
  }

  try {
    const rawContent = await fs.readFile(LOCAL_VEHICLES_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error leyendo datoslocales/vehicles.json:', error);
    return NextResponse.json({ error: 'Error al consultar lista de vehículos' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = validateApiSession(req);
  if (!auth.valid && auth.response) return auth.response;

  // Solo superadmin/admin pueden escribir (verificado en el servidor)
  const roleCheck = await requireRole(req, WRITE_ROLES);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = await req.json();
    const rawVid = body.vid || body.lp || body.vehiIdno || body.vehicle?.vid || body.vehicle?.lp || '';
    const cleanVid = String(rawVid).trim().toUpperCase();

    if (!cleanVid) {
      return NextResponse.json({ error: 'La patente o identificador del vehículo es obligatorio' }, { status: 400 });
    }

    if (cleanVid.length > 50) {
      return NextResponse.json({ error: 'El identificador del vehículo no puede superar los 50 caracteres' }, { status: 400 });
    }

    if (!USE_LOCAL_DATA) {
      return NextResponse.json({ success: true, vehicle: await saveVehicle(body) });
    }

    const companyName = String(body.companyName || body.vehicle?.companyName || 'Opentraxx').trim();
    const companyId = Number(body.companyId || body.vehicle?.companyId || 1);

    let parsed = {
      result: 0,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        pageRecords: 10,
        totalRecords: 0,
        startRecord: 0,
        endRecord: 0,
        nextPage: 1,
        previousPage: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        primaryKey: 'id',
        sortParams: {},
        pagin: null,
        rp: null,
        query: null,
        qtype: null,
        directQuery: false,
        page: false,
      },
      infos: [] as Record<string, unknown>[],
    };

    try {
      const rawContent = await fs.readFile(LOCAL_VEHICLES_FILE, 'utf-8');
      parsed = JSON.parse(rawContent);
    } catch {
      await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
    }

    if (!Array.isArray(parsed.infos)) {
      parsed.infos = [];
    }

    // Verificar si ya existe el vehículo
    const existing = parsed.infos.find(
      (v) =>
        String(v.vid ?? '').trim().toLowerCase() === cleanVid.toLowerCase() ||
        String(v.lp ?? '').trim().toLowerCase() === cleanVid.toLowerCase() ||
        String(v.vehiIdno ?? '').trim().toLowerCase() === cleanVid.toLowerCase()
    );

    if (existing) {
      return NextResponse.json({ success: true, vehicle: existing });
    }

    const maxId = parsed.infos.reduce((max, v) => {
      const num = Number(v.id) || 0;
      return num > max ? num : max;
    }, 100);

    const nowTimestamp = Date.now();
    const d = new Date(nowTimestamp);
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const newVehicle = {
      id: maxId + 1,
      vid: cleanVid,
      lp: cleanVid,
      vehiIdno: cleanVid,
      com: {
        id: String(companyId),
        name: companyName,
        parentId: 27,
        level: 1,
        companyId,
        companyName,
      },
      companyName,
      companyId,
      stu: 0,
      ptp: 2,
      cor: null,
      ol: 0,
      tm: null,
      itm: todayStr,
      itmDate: nowTimestamp,
      btm: null,
      stm: 'Sin servicio',
      devList: [],
      abbr: null,
      describe: null,
      chnName: null,
      brand: null,
      speedLimit: null,
      dateProduct: null,
      datePurchase: null,
      mrid: null,
    };

    parsed.infos.push(newVehicle);
    if (parsed.pagination) {
      parsed.pagination.totalRecords = parsed.infos.length;
    }

    await fs.writeFile(LOCAL_VEHICLES_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

    return NextResponse.json({ success: true, vehicle: newVehicle });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    console.error('Error guardando vehículo:', error);
    return NextResponse.json({ error: 'Error interno al guardar el vehículo' }, { status: 500 });
  }
}
