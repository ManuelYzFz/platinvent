'use client';

import React from 'react';
import { X } from 'lucide-react';

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
  submitClassName = 'bg-[#00acee] hover:bg-[#0099d4]',
  children,
}: AccountModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#161B22] border border-[#e8e9ed] dark:border-[#30363d] rounded-2xl p-6 sm:p-8 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 rounded-xl ${iconClassName}`}>{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-[#3a435d] dark:text-white">{title}</h3>
            <p className="text-xs text-[#5c647b] dark:text-gray-400">{description}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {children}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e8e9ed] dark:border-[#30363d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#e8e9ed] dark:border-[#30363d] text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2.5 rounded-xl text-sm font-extrabold text-white shadow-sm cursor-pointer disabled:opacity-50 ${submitClassName}`}
            >
              {submitting ? 'Guardando...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
