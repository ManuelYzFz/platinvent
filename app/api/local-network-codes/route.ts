import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validateApiSession } from '@/lib/utils/api-auth';

const LOCAL_DATA_DIR = path.join(process.cwd(), 'datoslocales');
const LOCAL_MNC_FILE = path.join(LOCAL_DATA_DIR, 'mobileNetworkCodes.json');

export async function GET(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  try {
    const rawContent = await fs.readFile(LOCAL_MNC_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent);

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix');
    const mnc = searchParams.get('mnc');

    if (prefix) {
      const cleanPrefix = prefix.replace(/\D/g, '');
      const match = parsed.networkCodes.find(
        (c: { prefix: string }) => c.prefix === cleanPrefix
      );
      return NextResponse.json({ result: 0, data: match || null });
    }

    if (mnc) {
      const cleanMnc = mnc.padStart(2, '0');
      const match = parsed.networkCodes.find(
        (c: { mnc: string }) => c.mnc === cleanMnc
      );
      return NextResponse.json({ result: 0, data: match || null });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error leyendo datoslocales/mobileNetworkCodes.json:', error);
    return NextResponse.json(
      { error: 'Error al consultar códigos de red móvil' },
      { status: 500 }
    );
  }
}
