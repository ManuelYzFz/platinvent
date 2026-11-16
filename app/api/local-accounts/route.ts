import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/utils/api-auth';
import {
  listAccounts,
  createAccount,
  updateAccount,
  findAccountById,
  type UserRole,
} from '@/lib/services/accountService';

// GET: Listar cuentas (solo Superadmin)
export async function GET(request: Request) {
  const auth = await requireRole(request, ['superadmin']);
  if (!auth.ok) return auth.response;

  try {
    const accounts = await listAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error al listar cuentas:', error);
    return NextResponse.json(
      { error: 'Error al consultar la lista de cuentas' },
      { status: 500 }
    );
  }
}

// POST: Crear cuenta (solo Superadmin)
export async function POST(request: Request) {
  const auth = await requireRole(request, ['superadmin']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { username, password, role } = body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json(
        { error: 'El nombre de usuario es obligatorio' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 4 caracteres' },
        { status: 400 }
      );
    }

    const validRoles: UserRole[] = ['superadmin', 'admin', 'solo_lectura'];
    const assignedRole: UserRole = validRoles.includes(role) ? role : 'solo_lectura';

    const newAccount = await createAccount(username.trim(), password, assignedRole);
    return NextResponse.json({ account: newAccount, message: 'Cuenta creada exitosamente' });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || 'Error al crear la cuenta' },
      { status: 400 }
    );
  }
}

// PUT: Modificar cuenta (rol, estado activo/inactivo, o restablecer contraseña)
export async function PUT(request: Request) {
  const auth = await requireRole(request, ['superadmin']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { id, username, role, is_active, password } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json(
        { error: 'El identificador de la cuenta es obligatorio' },
        { status: 400 }
      );
    }

    if (username !== undefined && (typeof username !== 'string' || !username.trim())) {
      return NextResponse.json(
        { error: 'El nombre de usuario no puede estar vacío' },
        { status: 400 }
      );
    }

    // Regla de seguridad: Si el superadmin actual está editando su propia cuenta, no puede desactivarse ni bajarse el rol
    const targetAccount = await findAccountById(id);
    if (!targetAccount) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    if (targetAccount.username.toLowerCase() === auth.username.toLowerCase()) {
      if (is_active !== undefined && !is_active) {
        return NextResponse.json(
          { error: 'No puedes desactivar tu propia cuenta activa de Superadmin' },
          { status: 400 }
        );
      }
      if (role !== undefined && role !== 'superadmin') {
        return NextResponse.json(
          { error: 'No puedes degradar tu propio rol de Superadmin' },
          { status: 400 }
        );
      }
    }

    await updateAccount(id, { username, role, is_active, password });
    return NextResponse.json({ success: true, message: 'Cuenta actualizada exitosamente' });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || 'Error al actualizar la cuenta' },
      { status: 400 }
    );
  }
}
