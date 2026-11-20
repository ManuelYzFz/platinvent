'use client';

import React from 'react';
import Preloader from '@/components/layout/Preloader';
import AccountTableRow from './AccountTableRow';
import type { AccountItem } from './account-helpers';

interface AccountTableProps {
  accounts: AccountItem[];
  loading: boolean;
  currentUsername: string;
  onEditRole: (account: AccountItem) => void;
  onResetPassword: (account: AccountItem) => void;
  onToggleActive: (account: AccountItem) => void;
}

export default function AccountTable({
  accounts,
  loading,
  currentUsername,
  onEditRole,
  onResetPassword,
  onToggleActive,
}: AccountTableProps) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#162032] shadow-xs overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121927] text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase">
              <th className="px-4 py-3.5 w-16 text-center">ID</th>
              <th className="px-4 py-3.5">Nombre de Usuario</th>
              <th className="px-4 py-3.5">Rol Asignado</th>
              <th className="px-4 py-3.5 text-center">Estado</th>
              <th className="px-4 py-3.5 text-center whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/10 text-slate-800 dark:text-slate-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  <Preloader fullScreen={false} message="Cargando cuentas registradas..." />
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400 italic">
                  No se encontraron cuentas que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              accounts.map((acc) => (
                <AccountTableRow
                  key={acc.id}
                  account={acc}
                  isSelf={acc.username.toLowerCase() === currentUsername.toLowerCase()}
                  onEditRole={onEditRole}
                  onResetPassword={onResetPassword}
                  onToggleActive={onToggleActive}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
