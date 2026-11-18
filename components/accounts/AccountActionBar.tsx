'use client';

import React from 'react';
import { Search, RefreshCw } from 'lucide-react';

interface AccountActionBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  total: number;
  loading: boolean;
  onRefresh: () => void;
}

export default function AccountActionBar({
  searchQuery,
  onSearchChange,
  total,
  loading,
  onRefresh,
}: AccountActionBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#162032] shadow-xs">
      <div className="relative flex items-center flex-1 max-w-md">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por usuario o rol..."
          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0F1726] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#00A3E0] focus:ring-1 focus:ring-[#00A3E0] transition-all"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Total: <strong className="text-slate-800 dark:text-white">{total}</strong> cuentas
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-[#00A3E0] bg-slate-50 dark:bg-[#121927] hover:bg-slate-100 dark:hover:bg-[#1E293B] transition-all cursor-pointer shadow-2xs"
          title="Refrescar listado"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
