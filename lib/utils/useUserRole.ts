'use client';

import { useSyncExternalStore } from 'react';
import { getUserRole, type UserRole } from './storage';

function subscribeSession(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('session_updated', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('session_updated', callback);
  };
}

const getServerSnapshot = (): UserRole => 'admin';

export function useUserRole(): UserRole {
  return useSyncExternalStore(subscribeSession, getUserRole, getServerSnapshot);
}
