import type { UserRole } from '@/lib/utils/storage';

export interface AccountItem {
  id: number;
  username: string;
  role: UserRole;
  is_active: number;
}

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'solo_lectura', label: 'Solo Lectura (Consulta y Reportes)' },
  { value: 'admin', label: 'Administrador (Creación y Edición de Equipos/SIMs)' },
  { value: 'superadmin', label: 'Superadmin (Acceso Total + Gestión de Cuentas)' },
];

export function getRoleLabel(role: UserRole): string {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'solo_lectura') return 'Solo Lectura';
  return 'Administrador';
}

export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#0d1117] text-[#3a435d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00acee]';

export const LABEL_CLASS = 'block text-xs font-bold text-[#3a435d] dark:text-gray-300 uppercase mb-1';
