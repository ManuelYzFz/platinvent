'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Event-driven fallback so toast.success() can be called anywhere
const TOAST_EVENT = 'platinvent-toast-event';

export const toast = {
  show: (message: string, type: ToastType = 'info', duration = 3500) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type, duration } }));
    }
  },
  success: (message: string, duration = 3500) => toast.show(message, 'success', duration),
  error: (message: string, duration = 3500) => toast.show(message, 'error', duration),
  info: (message: string, duration = 3500) => toast.show(message, 'info', duration),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; type: ToastType; duration?: number }>).detail;
      if (detail && detail.message) {
        addToast(detail.message, detail.type, detail.duration);
      }
    };
    window.addEventListener(TOAST_EVENT, handleCustomToast);
    return () => window.removeEventListener(TOAST_EVENT, handleCustomToast);
  }, [addToast]);

  const value: ToastContextValue = {
    show: addToast,
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Floating Container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0 notranslate"
        translate="no"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#162032] border shadow-xl shadow-black/10 dark:shadow-black/40 animate-in slide-in-from-bottom-3 fade-in duration-200 transition-all ${
                isSuccess
                  ? 'border-emerald-500/30'
                  : isError
                  ? 'border-rose-500/30'
                  : 'border-[#00A3E0]/30'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
                  isSuccess
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : isError
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-[#00A3E0]/10 text-[#00A3E0]'
                }`}
              >
                {isSuccess && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                {isError && <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                {!isSuccess && !isError && <Info className="w-4 h-4 sm:w-5 sm:h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                  {t.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return toast;
  }
  return ctx;
}
