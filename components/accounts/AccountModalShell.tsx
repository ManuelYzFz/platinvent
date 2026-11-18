'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useScrollLock } from '@/lib/utils/useScrollLock';

interface AccountModalShellProps {
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  iconClassName: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  submitting: boolean;
  submitClassName?: string;
  children: React.ReactNode;
}

export default function AccountModalShell({
  title,
  description,
  icon,
  iconClassName,
  onClose,
  onSubmit,
  submitLabel,
  submitting,
  submitClassName = 'bg-[#00A3E0] hover:bg-[#0092c8]',
  children,
}: AccountModalShellProps) {
  useScrollLock(true);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#162032] border border-slate-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E293B] rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 rounded-xl ${iconClassName}`}>{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {children}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#121927] text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1E293B] cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-xs cursor-pointer disabled:opacity-50 transition-all active:scale-95 ${submitClassName}`}
            >
              {submitting ? 'Guardando...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
