'use client';

import React, { useState } from 'react';
import { ShieldCheck, UserPlus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAccounts } from './useAccounts';
import AccountActionBar from './AccountActionBar';
import AccountTable from './AccountTable';
import CreateAccountModal from './CreateAccountModal';
import EditRoleModal from './EditRoleModal';
import ResetPasswordModal from './ResetPasswordModal';
import type { AccountItem } from './account-helpers';

interface AccountsViewProps {
  currentUsername: string;
}

export default function AccountsView({ currentUsername }: AccountsViewProps) {
  const {
    accounts,
    loading,
    searchQuery,
    setSearchQuery,
    errorBanner,
    setErrorBanner,
    successBanner,
    setSuccessBanner,
    submitting,
    fetchAccounts,
    createAccount,
    updateAccountData,
    resetPassword,
    toggleActive,
  } = useAccounts(currentUsername);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<AccountItem | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AccountItem | null>(null);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Módulo Superadmin
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Gestión de Cuentas y Accesos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Crea y administra los usuarios con permisos personalizados (Superadmin, Administrador y Solo Lectura).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorBanner('');
            setIsCreateOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#00A3E0] hover:bg-[#0092c8] px-5 py-3 text-sm sm:text-base font-bold text-white shadow-sm transition-all cursor-pointer hover:shadow active:scale-95 border border-[#00A3E0] shrink-0"
        >
          <UserPlus className="w-5 h-5 text-white shrink-0" />
          <span>Crear Nueva Cuenta</span>
        </button>
      </div>

      {errorBanner && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner('')}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-200 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner('')}
            className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <AccountActionBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        total={accounts.length}
        loading={loading}
        onRefresh={() => void fetchAccounts(true)}
      />

      <AccountTable
        accounts={accounts}
        loading={loading}
        currentUsername={currentUsername}
        onEditRole={setRoleTarget}
        onResetPassword={setPasswordTarget}
        onToggleActive={(acc) => void toggleActive(acc)}
      />

      {isCreateOpen && (
        <CreateAccountModal
          submitting={submitting}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={async (data) => {
            if (await createAccount(data)) setIsCreateOpen(false);
          }}
        />
      )}

      {roleTarget && (
        <EditRoleModal
          account={roleTarget}
          submitting={submitting}
          onClose={() => setRoleTarget(null)}
          onSubmit={async (data) => {
            if (await updateAccountData(roleTarget, data)) setRoleTarget(null);
          }}
        />
      )}

      {passwordTarget && (
        <ResetPasswordModal
          account={passwordTarget}
          submitting={submitting}
          onClose={() => setPasswordTarget(null)}
          onSubmit={async (password) => {
            if (await resetPassword(passwordTarget, password)) setPasswordTarget(null);
          }}
        />
      )}
    </>
  );
}
