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
    <div className="w-full rounded-2xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#161B22] shadow-xs overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#13171f] text-[#5c647b] dark:text-gray-300 text-[11px] font-bold uppercase">
              <th className="px-4 py-3.5 w-16 text-center">ID</th>
              <th className="px-4 py-3.5">Nombre de Usuario</th>
              <th className="px-4 py-3.5">Rol Asignado</th>
              <th className="px-4 py-3.5 text-center">Estado</th>
              <th className="px-4 py-3.5 text-center whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8e9ed] dark:divide-[#30363d] text-[#3a435d] dark:text-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  <Preloader fullScreen={false} message="Cargando cuentas registradas..." />
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400 italic">
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
