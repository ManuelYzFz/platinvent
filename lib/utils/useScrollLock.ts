'use client';

import { useEffect } from 'react';

/**
 * Bloquea completamente el scroll del viewport (tanto <html> como <body>)
 * mientras un modal esté abierto, evitando el molesto scroll-bleed de fondo.
 */
export function useScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock || typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    root.classList.add('modal-open');
    body.classList.add('modal-open');
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      root.classList.remove('modal-open');
      body.classList.remove('modal-open');
      root.style.overflow = '';
      body.style.overflow = '';
    };
  }, [lock]);
}
