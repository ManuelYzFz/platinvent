import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { validateApiSession } from '@/lib/utils/api-auth';

export async function GET(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  try {
    const filePath = path.join(process.cwd(), 'datoslocales', 'errores.json');
    if (!existsSync(filePath)) {
      return NextResponse.json({ result: 0, infos: [] });
    }
    const fileData = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(fileData);
    return NextResponse.json(json);
  } catch (error) {
    console.error('Error al leer errores.json:', error);
    return NextResponse.json({ error: 'No se pudo cargar la lista de errores' }, { status: 500 });
  }
}
