import { NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/utils/api-auth';
import { BRAND_OPTIONS, MODEL_OPTIONS, USE_LOCAL_DATA } from '@/lib/constants';
import { listDeviceOptions } from '@/lib/db-inventory';

// GET: Marcas y modelos disponibles para los comboboxes de dispositivos
export async function GET(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  if (USE_LOCAL_DATA) {
    // Modo local: listas fijas; los modelos no están asociados a una marca
    return NextResponse.json({
      brands: [...BRAND_OPTIONS],
      models: MODEL_OPTIONS.map((model) => ({ brand: '', model })),
    });
  }

  try {
    return NextResponse.json(await listDeviceOptions());
  } catch (error) {
    console.error('Error consultando MySQL (listDeviceOptions):', error);
    return NextResponse.json({ error: 'Error al obtener marcas y modelos' }, { status: 500 });
  }
}
