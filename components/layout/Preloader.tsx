'use client';

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

const emptySubscribe = () => () => {};

interface PreloaderProps {
  fullScreen?: boolean;
  message?: string;
}

export default function Preloader({ fullScreen = true, message = 'Cargando datos...' }: PreloaderProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (fullScreen) {
    const content = (
      <div 
        id="preloader" 
        className="fixed inset-0 z-999999 flex flex-col items-center justify-center bg-white dark:bg-[#0B111E] transition-colors duration-200 notranslate" 
        translate="no"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          zIndex: 999999,
        }}
      >
        <div className="flex flex-col items-center justify-center p-6">
          {/* Logo Oficial VTRAXX */}
          <div className="relative mb-6">
            <Image
              src="/images/VtraxxOscuro.png"
              alt="VTRAXX"
              width={140}
              height={36}
              className="h-8 sm:h-9 w-auto dark:hidden"
              style={{ width: 'auto' }}
              priority
            />
            <Image
              src="/images/VtraxxBlanco.png"
              alt="VTRAXX"
              width={140}
              height={36}
              className="h-8 sm:h-9 w-auto hidden dark:block"
              style={{ width: 'auto' }}
              priority
            />
          </div>

          {/* Spinner de alta precisión en Cyan VTRAXX */}
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-3 border-[#00A3E0]/20 border-t-[#00A3E0] animate-spin" />
            <div className="absolute w-2 h-2 rounded-full bg-[#00A3E0] animate-ping" />
          </div>

          {message && (
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 animate-pulse text-center px-4">
              {message}
            </p>
          )}
        </div>
      </div>
    );

    if (mounted && typeof document !== 'undefined') {
      return createPortal(content, document.body);
    }
    return content;
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 w-full space-y-3 notranslate" translate="no">
      <div className="relative flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#00A3E0]/25 border-t-[#00A3E0] animate-spin" />
      </div>
      {message && (
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider animate-pulse text-center">
          {message}
        </p>
      )}
    </div>
  );
}
