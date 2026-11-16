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
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#161B22] shadow-xs">
      <div className="relative flex items-center flex-1 max-w-md">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por usuario o rol..."
          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#0d1117] text-[#3a435d] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00acee]/40"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          Total: <strong>{total}</strong> cuentas
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2.5 rounded-xl border border-[#e8e9ed] dark:border-[#30363d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#21262d] transition-all cursor-pointer"
          title="Refrescar listado"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
