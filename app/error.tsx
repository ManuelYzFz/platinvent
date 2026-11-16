'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error no controlado en la aplicación:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc] dark:bg-[#121212] p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#161B22] rounded-2xl p-6 sm:p-8 border border-[#e8e9ed] dark:border-[#30363d] shadow-sm text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#3a435d] dark:text-white mb-2">
          Ha ocurrido un error
        </h2>
        <p className="text-sm text-[#5c647b] dark:text-gray-300 mb-6">
          Ocurrió un problema inesperado al cargar esta sección. Puedes reintentar la operación.
        </p>
        <button
          onClick={() => reset()}
          className="w-full py-3 px-4 bg-[#00acee] hover:bg-[#0095cd] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reintentar</span>
        </button>
      </div>
    </div>
  );
}
