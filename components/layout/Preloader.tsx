'use client';

import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

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
        className="fixed inset-0 bg-white z-999999 flex flex-col items-center justify-center notranslate" 
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
          backgroundColor: '#ffffff'
        }}
      >
        <div className="loader-square" />
        {message && (
          <p className="mt-6 text-xs sm:text-sm font-bold uppercase tracking-widest text-[#3a435d] animate-pulse text-center px-4">
            {message}
          </p>
        )}
      </div>
    );

    if (mounted && typeof document !== 'undefined') {
      return createPortal(content, document.body);
    }
    return content;
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 w-full space-y-4 notranslate" translate="no">
      <div className="loader-square-sm" />
      {message && (
        <p className="text-xs font-bold text-[#5c647b] uppercase tracking-wider animate-pulse text-center">
          {message}
        </p>
      )}
    </div>
  );
}
