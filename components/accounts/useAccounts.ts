'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { UserRole } from '@/lib/utils/storage';
import type { AccountItem } from './account-helpers';

async function sendAccountRequest(method: 'POST' | 'PUT', body: Record<string, unknown>, fallbackError: string) {
  const res = await fetch('/api/local-accounts', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || fallbackError);
}

export function useAccounts(currentUsername: string) {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAccounts = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setErrorBanner('');
    try {
      const res = await fetch('/api/local-accounts');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las cuentas');
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      await Promise.resolve();
      if (!ignore) await fetchAccounts(true);
    };
    void init();
    return () => {
      ignore = true;
    };
  }, [fetchAccounts]);

  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase().trim();
    return accounts.filter(
      (acc) =>
        acc.username.toLowerCase().includes(q) ||
        acc.role.toLowerCase().includes(q) ||
        (acc.is_active ? 'activo' : 'inactivo').includes(q)
    );
  }, [accounts, searchQuery]);

  /** Ejecuta una mutación mostrando errores/éxitos; devuelve true si salió bien. */
  const runMutation = async (
    method: 'POST' | 'PUT',
    body: Record<string, unknown>,
    fallbackError: string,
    successMessage: string,
    refresh = true
  ): Promise<boolean> => {
    setSubmitting(true);
    setErrorBanner('');
    try {
      await sendAccountRequest(method, body, fallbackError);
      setSuccessBanner(successMessage);
      if (refresh) void fetchAccounts(false);
      return true;
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : fallbackError);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const createAccount = (data: { username: string; password: string; role: UserRole }) =>
    runMutation('POST', data, 'Error al crear la cuenta', `Cuenta "${data.username}" creada exitosamente`);

  const updateAccountData = (account: AccountItem, data: { username: string; role: UserRole }) =>
    runMutation(
      'PUT',
      { id: account.id, username: data.username, role: data.role },
      'Error al actualizar la cuenta',
      `Cuenta "${data.username}" actualizada correctamente`
    );

  const resetPassword = (account: AccountItem, password: string) =>
    runMutation(
      'PUT',
      { id: account.id, password },
      'Error al restablecer contraseña',
      `Contraseña de "${account.username}" actualizada correctamente`,
      false
    );

  const toggleActive = async (account: AccountItem) => {
    const nextStatus = account.is_active === 1 ? 0 : 1;
    const actionLabel = nextStatus === 1 ? 'activar' : 'desactivar';

    if (account.username.toLowerCase() === currentUsername.toLowerCase()) {
      setErrorBanner('No puedes desactivar tu propia cuenta activa de Superadmin.');
      return;
    }
    if (!window.confirm(`¿Estás seguro de ${actionLabel} la cuenta de "${account.username}"?`)) return;

    await runMutation(
      'PUT',
      { id: account.id, is_active: nextStatus },
      `Error al ${actionLabel} la cuenta`,
      `Cuenta "${account.username}" ${nextStatus === 1 ? 'activada' : 'desactivada'} correctamente`
    );
  };

  return {
    accounts: filteredAccounts,
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
  };
}
