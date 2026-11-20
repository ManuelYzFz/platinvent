import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validateApiSession, requireRole, WRITE_ROLES } from '@/lib/utils/api-auth';
import { BRAND_OPTIONS, MODEL_OPTIONS, USE_LOCAL_DATA } from '@/lib/constants';
import {
  listDeviceOptions,
  addBrandModel,
  updateBrand,
  updateModel,
  deleteBrand,
  deleteModel,
} from '@/lib/db-inventory';

const LOCAL_DATA_DIR = path.join(process.cwd(), 'datoslocales');
const LOCAL_CATALOG_FILE = path.join(LOCAL_DATA_DIR, 'deviceModels.json');

async function getLocalCatalog(): Promise<{ brand: string; model: string }[]> {
  try {
    const raw = await fs.readFile(LOCAL_CATALOG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const initial = [
      { brand: 'Queclink', model: 'GV300' },
      { brand: 'Queclink', model: 'GV50' },
      { brand: 'Teltonika', model: 'FMM920' },
      { brand: 'Teltonika', model: 'FMC130' },
      { brand: 'Suntech', model: 'ST310U' },
      { brand: 'Concox', model: 'JM-VL03' },
    ];
    await fs.writeFile(LOCAL_CATALOG_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

async function saveLocalCatalog(data: { brand: string; model: string }[]) {
  await fs.writeFile(LOCAL_CATALOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function formatCatalog(items: { brand: string; model: string }[]) {
  const brands = new Map<string, string>();
  const models: { brand: string; model: string }[] = [];
  for (const item of items) {
    const b = item.brand.trim();
    if (!b) continue;
    const key = b.toLowerCase();
    if (!brands.has(key)) brands.set(key, b);
    if (item.model && item.model.trim()) {
      models.push({ brand: brands.get(key)!, model: item.model.trim() });
    }
  }
  return { brands: Array.from(brands.values()), models };
}

// GET: Marcas y modelos disponibles para los comboboxes de dispositivos
export async function GET(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  if (USE_LOCAL_DATA) {
    try {
      const items = await getLocalCatalog();
      return NextResponse.json(formatCatalog(items));
    } catch {
      return NextResponse.json({
        brands: [...BRAND_OPTIONS],
        models: MODEL_OPTIONS.map((model) => ({ brand: '', model })),
      });
    }
  }

  try {
    return NextResponse.json(await listDeviceOptions());
  } catch (error) {
    console.error('Error consultando MySQL (listDeviceOptions):', error);
    return NextResponse.json({ error: 'Error al obtener marcas y modelos' }, { status: 500 });
  }
}

// POST: Agregar nueva marca o nuevo modelo
export async function POST(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  const roleCheck = await requireRole(request, WRITE_ROLES);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = await request.json();
    const brand = String(body.brand || '').trim();
    const model = String(body.model || '').trim();

    if (!brand) {
      return NextResponse.json({ error: 'El nombre de la marca es obligatorio' }, { status: 400 });
    }

    if (USE_LOCAL_DATA) {
      const catalog = await getLocalCatalog();
      const exists = catalog.some(
        (c) => c.brand.toLowerCase() === brand.toLowerCase() && c.model.toLowerCase() === model.toLowerCase()
      );
      if (!exists) {
        catalog.push({ brand, model });
        await saveLocalCatalog(catalog);
      }
      return NextResponse.json(formatCatalog(catalog));
    }

    const updated = await addBrandModel(brand, model);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error agregando marca/modelo:', error);
    return NextResponse.json({ error: (error as Error).message || 'Error al agregar' }, { status: 500 });
  }
}

// PUT: Modificar/Renombrar marca o modelo
export async function PUT(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  const roleCheck = await requireRole(request, WRITE_ROLES);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = await request.json();
    const { action, oldBrand, newBrand, brand, oldModel, newModel } = body;

    if (action === 'updateBrand') {
      const oBrand = String(oldBrand || '').trim();
      const nBrand = String(newBrand || '').trim();
      if (!oBrand || !nBrand) {
        return NextResponse.json({ error: 'Debes indicar el nombre anterior y nuevo de la marca' }, { status: 400 });
      }

      if (USE_LOCAL_DATA) {
        const catalog = await getLocalCatalog();
        catalog.forEach((item) => {
          if (item.brand.toLowerCase() === oBrand.toLowerCase()) {
            item.brand = nBrand;
          }
        });
        await saveLocalCatalog(catalog);
        return NextResponse.json(formatCatalog(catalog));
      }

      const updated = await updateBrand(oBrand, nBrand);
      return NextResponse.json(updated);
    }

    if (action === 'updateModel') {
      const b = String(brand || '').trim();
      const oModel = String(oldModel || '').trim();
      const nModel = String(newModel || '').trim();
      if (!b || !oModel || !nModel) {
        return NextResponse.json({ error: 'Debes indicar la marca, el modelo anterior y el nuevo' }, { status: 400 });
      }

      if (USE_LOCAL_DATA) {
        const catalog = await getLocalCatalog();
        catalog.forEach((item) => {
          if (item.brand.toLowerCase() === b.toLowerCase() && item.model.toLowerCase() === oModel.toLowerCase()) {
            item.model = nModel;
          }
        });
        await saveLocalCatalog(catalog);
        return NextResponse.json(formatCatalog(catalog));
      }

      const updated = await updateModel(b, oModel, nModel);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    console.error('Error actualizando marca/modelo:', error);
    return NextResponse.json({ error: (error as Error).message || 'Error al actualizar' }, { status: 500 });
  }
}

// DELETE: Eliminar marca o modelo
export async function DELETE(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  const roleCheck = await requireRole(request, WRITE_ROLES);
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = await request.json();
    const { action, brand, model } = body;
    const b = String(brand || '').trim();
    const m = String(model || '').trim();

    if (action === 'deleteModel') {
      if (!b || !m) {
        return NextResponse.json({ error: 'Debes indicar la marca y el modelo a eliminar' }, { status: 400 });
      }

      if (USE_LOCAL_DATA) {
        let catalog = await getLocalCatalog();
        catalog = catalog.filter(
          (item) => !(item.brand.toLowerCase() === b.toLowerCase() && item.model.toLowerCase() === m.toLowerCase())
        );
        await saveLocalCatalog(catalog);
        return NextResponse.json(formatCatalog(catalog));
      }

      const updated = await deleteModel(b, m);
      return NextResponse.json(updated);
    }

    if (action === 'deleteBrand') {
      if (!b) {
        return NextResponse.json({ error: 'Debes indicar la marca a eliminar' }, { status: 400 });
      }

      if (USE_LOCAL_DATA) {
        let catalog = await getLocalCatalog();
        catalog = catalog.filter((item) => item.brand.toLowerCase() !== b.toLowerCase());
        await saveLocalCatalog(catalog);
        return NextResponse.json(formatCatalog(catalog));
      }

      const updated = await deleteBrand(b);
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    console.error('Error eliminando marca/modelo:', error);
    return NextResponse.json({ error: (error as Error).message || 'Error al eliminar' }, { status: 500 });
  }
}
