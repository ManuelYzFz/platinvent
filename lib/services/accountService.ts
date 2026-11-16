import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { hashPassword } from '@/lib/utils/password';

export type UserRole = 'superadmin' | 'admin' | 'solo_lectura';

export interface AccountRecord {
  id: number;
  username: string;
  password: string;
  role: UserRole;
  is_active: number;
}

export type SafeAccount = Omit<AccountRecord, 'password'>;

interface AccountRow extends RowDataPacket, AccountRecord {}
interface SafeAccountRow extends RowDataPacket, SafeAccount {}
interface CountRow extends RowDataPacket {
  total: number;
}

/**
 * Busca una cuenta en la tabla accounts de MySQL por su nombre de usuario.
 */
export async function findAccountByUsername(username: string): Promise<AccountRecord | null> {
  const cleanUsername = username.trim();
  if (!cleanUsername) return null;

  try {
    const [rows] = await pool.query<AccountRow[]>(
      'SELECT id, username, password, role, is_active FROM accounts WHERE username = ? LIMIT 1',
      [cleanUsername]
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return {
        id: rows[0].id,
        username: rows[0].username,
        password: rows[0].password,
        role: rows[0].role,
        is_active: Number(rows[0].is_active),
      };
    }

    return null;
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[Accounts] La tabla `accounts` aún no existe en MySQL. Se usará autenticación OpenTraxx.');
    } else {
      console.error('[Accounts Error] Error al consultar tabla accounts:', err.message || error);
    }
    return null;
  }
}

/**
 * Busca una cuenta por su ID.
 */
export async function findAccountById(id: number): Promise<AccountRecord | null> {
  try {
    const [rows] = await pool.query<AccountRow[]>(
      'SELECT id, username, password, role, is_active FROM accounts WHERE id = ? LIMIT 1',
      [id]
    );

    if (Array.isArray(rows) && rows.length > 0) {
      return {
        id: rows[0].id,
        username: rows[0].username,
        password: rows[0].password,
        role: rows[0].role,
        is_active: Number(rows[0].is_active),
      };
    }
    return null;
  } catch (error) {
    console.error('[Accounts Error] Error findAccountById:', error);
    return null;
  }
}

/**
 * Lista todas las cuentas registradas sin exponer sus contraseñas.
 */
export async function listAccounts(): Promise<SafeAccount[]> {
  try {
    const [rows] = await pool.query<SafeAccountRow[]>(
      'SELECT id, username, role, is_active FROM accounts ORDER BY id ASC'
    );
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      role: r.role,
      is_active: Number(r.is_active),
    }));
  } catch (error) {
    console.error('[Accounts Error] Error listAccounts:', error);
    throw error;
  }
}

/**
 * Crea una nueva cuenta con contraseña hasheada.
 */
export async function createAccount(
  username: string,
  rawPassword: string,
  role: UserRole = 'solo_lectura'
): Promise<SafeAccount> {
  const cleanUsername = username.trim();
  if (!cleanUsername) throw new Error('El nombre de usuario es obligatorio');
  if (!rawPassword || rawPassword.length < 4) {
    throw new Error('La contraseña debe tener al menos 4 caracteres');
  }

  const existing = await findAccountByUsername(cleanUsername);
  if (existing) {
    throw new Error(`El nombre de usuario "${cleanUsername}" ya existe`);
  }

  const hashedPassword = hashPassword(rawPassword);

  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO accounts (username, password, role, is_active) VALUES (?, ?, ?, 1)',
    [cleanUsername, hashedPassword, role]
  );

  return {
    id: result.insertId,
    username: cleanUsername,
    role,
    is_active: 1,
  };
}

/**
 * Cuenta la cantidad de superadmins activos para evitar que se desactiven todos.
 */
export async function countActiveSuperadmins(): Promise<number> {
  try {
    const [rows] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM accounts WHERE role = 'superadmin' AND is_active = 1"
    );
    return rows[0]?.total ?? 0;
  } catch (error) {
    console.error('[Accounts Error] Error countActiveSuperadmins:', error);
    return 1;
  }
}

/**
 * Actualiza los datos de una cuenta (rol, estado activo/inactivo o nueva contraseña).
 */
export async function updateAccount(
  id: number,
  fields: { username?: string; role?: UserRole; is_active?: number | boolean; password?: string }
): Promise<boolean> {
  const current = await findAccountById(id);
  if (!current) throw new Error('Cuenta no encontrada');

  // Si se va a desactivar o cambiar el rol de un superadmin activo, verificar que quede al menos otro
  if (
    current.role === 'superadmin' &&
    current.is_active === 1 &&
    ((fields.is_active !== undefined && Number(fields.is_active) === 0) ||
      (fields.role !== undefined && fields.role !== 'superadmin'))
  ) {
    const activeSuperCount = await countActiveSuperadmins();
    if (activeSuperCount <= 1) {
      throw new Error('No es posible desactivar o degradar al único Superadmin activo del sistema');
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (fields.username !== undefined) {
    const cleanUsername = fields.username.trim();
    if (!cleanUsername) throw new Error('El nombre de usuario no puede estar vacío');
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM accounts WHERE username = ? AND id != ?',
      [cleanUsername, id]
    );
    if (existing && existing.length > 0) {
      throw new Error(`El nombre de usuario "${cleanUsername}" ya está en uso`);
    }
    updates.push('username = ?');
    params.push(cleanUsername);
  }

  if (fields.role !== undefined) {
    updates.push('role = ?');
    params.push(fields.role);
  }

  if (fields.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(fields.is_active ? 1 : 0);
  }

  if (fields.password && fields.password.trim()) {
    if (fields.password.length < 4) {
      throw new Error('La nueva contraseña debe tener al menos 4 caracteres');
    }
    updates.push('password = ?');
    params.push(hashPassword(fields.password));
  }

  if (updates.length === 0) return true;

  params.push(id);
  await pool.query(
    `UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return true;
}
