import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { validateApiSession, requireRole, WRITE_ROLES } from '@/lib/utils/api-auth';
import { USE_LOCAL_DATA } from '@/lib/constants';
import { ValidationError } from '@/lib/validation/inventory';
import { listCompanies, saveCompany } from '@/lib/db-inventory';

const LOCAL_DATA_DIR = path.join(process.cwd(), 'datoslocales');
const LOCAL_COMPANIES_FILE = path.join(LOCAL_DATA_DIR, 'company.json');

export async function GET(request: Request) {
  const auth = validateApiSession(request);
  if (!auth.valid && auth.response) return auth.response;

  if (!USE_LOCAL_DATA) {
    try {
      return NextResponse.json(await listCompanies());
    } catch (error) {
      console.error('Error consultando MySQL (listCompanies):', error);
      return NextResponse.json({ error: 'Error al obtener la lista de empresas' }, { status: 500 });
    }
  }

  try {
    const rawContent = await fs.readFile(LOCAL_COMPANIES_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Error leyendo datoslocales/company.json:', error);
    return NextResponse.json({ error: 'Error al obtener la lista de empresas' }, { status: 500 });
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
    const rawName = typeof body === 'string' ? body : (body.name || body.company?.name || '');
    const cleanName = String(rawName).trim();

    if (!cleanName) {
      return NextResponse.json({ error: 'El nombre de la empresa es obligatorio' }, { status: 400 });
    }

    if (cleanName.length > 100) {
      return NextResponse.json({ error: 'El nombre de la empresa no puede superar los 100 caracteres' }, { status: 400 });
    }

    if (!USE_LOCAL_DATA) {
      return NextResponse.json({ success: true, company: await saveCompany(cleanName) });
    }

    let parsed = { result: 0, companys: [] as { id: number; name: string; pId: number }[] };
    try {
      const rawContent = await fs.readFile(LOCAL_COMPANIES_FILE, 'utf-8');
      parsed = JSON.parse(rawContent);
    } catch {
      await fs.mkdir(LOCAL_DATA_DIR, { recursive: true });
    }

    if (!Array.isArray(parsed.companys)) {
      parsed.companys = [];
    }

    // Si ya existe una empresa con ese nombre (case-insensitive), devolverla
    const existing = parsed.companys.find(
      (c) => c.name && c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      return NextResponse.json({ success: true, company: existing });
    }

    const maxId = parsed.companys.reduce((max, c) => {
      const num = Number(c.id) || 0;
      return num > max ? num : max;
    }, 0);

    const newCompany = {
      id: maxId + 1,
      name: cleanName,
      pId: 1,
    };

    parsed.companys.push(newCompany);
    await fs.writeFile(LOCAL_COMPANIES_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

    return NextResponse.json({ success: true, company: newCompany });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, errors: error.errors }, { status: 400 });
    }
    console.error('Error guardando empresa:', error);
    return NextResponse.json({ error: 'Error interno al guardar la empresa' }, { status: 500 });
  }
}
