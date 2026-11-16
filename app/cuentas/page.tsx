'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import AccountsView from '@/components/accounts/AccountsView';
import { getSession, getUsername, getUserRole, clearSession } from '@/lib/utils/storage';

export default function CuentasPage() {
  const router = useRouter();

  const [username, setUsername] = useState<string>('');
  const [authorized, setAuthorized] = useState(false);

  // Verificar sesión y rol de Superadmin
  useEffect(() => {
    let ignore = false;

    const initAuth = async () => {
      await Promise.resolve();
      if (ignore) return;

      if (!getSession()) {
        router.replace('/login');
        return;
      }

      if (getUserRole() !== 'superadmin') {
        router.replace('/dispositivos');
        return;
      }

      setUsername(getUsername());
      setAuthorized(true);
    };

    void initAuth();
    return () => {
      ignore = true;
    };
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0d1117] flex flex-col w-full max-w-full overflow-x-hidden font-sans">
      <Navbar userName={username} onLogout={handleLogout} />
      <main className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-6 lg:px-10 py-6 sm:py-10 flex-1">
        {authorized && <AccountsView currentUsername={username} />}
      </main>
    </div>
  );
}
