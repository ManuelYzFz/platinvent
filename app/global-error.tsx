'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error crítico capturado por GlobalError:', error);
  }, [error]);

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'light';
                document.documentElement.classList.toggle('dark', theme === 'dark');
                document.documentElement.setAttribute('data-bs-theme', theme);
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen flex items-center justify-center bg-[#f8f9fc] dark:bg-[#121212] p-4 font-sans text-gray-900 dark:text-gray-100">
        <div 
          role="alert"
          className="max-w-md w-full bg-white dark:bg-[#161B22] rounded-2xl p-6 sm:p-8 border border-[#e8e9ed] dark:border-[#30363d] shadow-sm text-center"
        >
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#3a435d] dark:text-white mb-2">
            Error Crítico del Sistema
          </h2>
          <p className="text-sm text-[#5c647b] dark:text-gray-300 mb-6">
            Ocurrió un error general en la aplicación. Presiona el botón para recargar la página.
          </p>
          <button
            onClick={() => reset()}
            className="w-full py-3 px-4 bg-[#00acee] hover:bg-[#0095cd] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Recargar Aplicación
          </button>
        </div>
      </body>
    </html>
  );
}
