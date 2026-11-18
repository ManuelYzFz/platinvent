'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import DevicesView from '@/components/devices/DevicesView';
import { getSession, getUsername, clearSession } from '@/lib/utils/storage';

export default function DispositivosPage() {
  const router = useRouter();

  const [username, setUsername] = useState<string>(() => getUsername());
  const [session, setSession] = useState<string>(() => getSession());

  useEffect(() => {
    let ignore = false;

    const initAuth = async () => {
      await Promise.resolve();
      if (ignore) return;

      const savedSession = getSession();
      const savedUser = getUsername();

      if (!savedSession) {
        try {
          router.replace('/login');
        } catch {
          window.location.replace('/login');
        }
        return;
      }

      if (savedSession !== session) setSession(savedSession);
      if (savedUser && savedUser !== username) setUsername(savedUser);
    };

    void initAuth();

    return () => {
      ignore = true;
    };
  }, [router]);


  const handleLogout = () => {
    clearSession();
    try {
      router.push('/login');
    } catch {
      window.location.replace('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col w-full max-w-full overflow-x-hidden">
      <Navbar userName={username} onLogout={handleLogout} />
      <main className="w-full max-w-full min-w-0 space-y-6 sm:space-y-8 px-3 sm:px-6 lg:px-10 py-4 sm:py-8 flex-1">
        <DevicesView session={session} />
      </main>
      <Footer />
    </div>
  );
}
