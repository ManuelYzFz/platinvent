'use client';

import React from 'react';
import { ShieldCheck, Shield, Eye, KeyRound, PowerOff, Power, Edit2 } from 'lucide-react';
import { getRoleLabel, type AccountItem } from './account-helpers';

interface AccountTableRowProps {
  account: AccountItem;
  isSelf: boolean;
  onEditRole: (account: AccountItem) => void;
  onResetPassword: (account: AccountItem) => void;
  onToggleActive: (account: AccountItem) => void;
}

export default function AccountTableRow({
  account,
  isSelf,
  onEditRole,
  onResetPassword,
  onToggleActive,
}: AccountTableRowProps) {
  const isActive = account.is_active === 1;

  const roleClass =
    account.role === 'superadmin'
      ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
      : account.role === 'solo_lectura'
        ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
        : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';

  const RoleIcon = account.role === 'superadmin' ? ShieldCheck : account.role === 'solo_lectura' ? Eye : Shield;

  const toggleClass = isSelf
    ? 'opacity-30 cursor-not-allowed border-transparent text-gray-400'
    : isActive
      ? 'border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
      : 'border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40';

  const toggleTitle = isSelf
    ? 'No puedes desactivar tu propia cuenta'
    : isActive
      ? 'Desactivar cuenta'
      : 'Activar cuenta';

  return (
    <tr
      className={`hover:bg-slate-50 dark:hover:bg-[#1E293B] transition-colors ${
        !isActive ? 'opacity-60 bg-slate-50/40 dark:bg-[#0F1726]' : ''
      }`}
    >
      <td className="px-4 py-3.5 font-mono text-center text-xs font-semibold text-slate-400 dark:text-slate-500">#{account.id}</td>
      <td className="px-4 py-3.5 font-semibold text-sm">
        <div className="flex items-center gap-2">
          <span>{account.username}</span>
          {isSelf && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#00A3E0]/10 text-[#00A3E0] dark:bg-[#00A3E0]/20 dark:text-[#00A3E0]">
              Tu cuenta
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${roleClass}`}
        >
          <RoleIcon className="w-3.5 h-3.5" />
          {getRoleLabel(account.role)}
        </span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
            isActive
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {isActive ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-4 py-3.5 text-center whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEditRole(account)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-[#00A3E0] hover:border-[#00A3E0] dark:hover:text-[#00A3E0] transition-all cursor-pointer shadow-2xs"
            title="Editar cuenta"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onResetPassword(account)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:border-amber-400 dark:hover:text-amber-400 transition-all cursor-pointer shadow-2xs"
            title="Restablecer contraseña"
          >
            <KeyRound className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={isSelf}
            onClick={() => onToggleActive(account)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${toggleClass}`}
            title={toggleTitle}
          >
            {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
          </button>
        </div>
      </td>
    </tr>
  );
}
