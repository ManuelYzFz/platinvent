'use client';

import { useState, useEffect } from 'react';
import DispositivosPage from './dispositivos/page';
import LoginPage from './login/page';
import { getSession } from '@/lib/utils/storage';

export default function Home() {
  const [session, setSession] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const initSession = async () => {
      await Promise.resolve();
      if (!ignore) {
        setSession(getSession() || '');
      }
    };
    void initSession();
    return () => {
      ignore = true;
    };
  }, []);

  if (session === null) {
    return null;
  }

  if (session) {
    return <DispositivosPage />;
  }

  return <LoginPage />;
}