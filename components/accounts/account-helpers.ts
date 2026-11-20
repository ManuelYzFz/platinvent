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
  'w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F1726] text-slate-900 dark:text-white focus:outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all shadow-2xs';

export const LABEL_CLASS = 'block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5';
