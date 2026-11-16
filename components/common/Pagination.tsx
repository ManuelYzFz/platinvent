'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  t?: (key: string) => string;
}

export default function Pagination({ total, page, pageSize, onPageChange, t }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const showingStr = t ? t('mostrando_de') : 'Mostrando';
  const ofStr = t ? t('de_registros') : 'de';
  const recordsStr = t ? t('registros_totales') : 'registros';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#161b22]">
      <span className="text-xs text-[#5c647b] dark:text-gray-400 font-medium text-center sm:text-left">
        {showingStr} {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} {ofStr} {total} {recordsStr}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg border border-[#e8e9ed] dark:border-[#30363d] text-[#5c647b] dark:text-gray-300 hover:bg-white dark:hover:bg-[#21262d] hover:text-[#3a435d] dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              className={`min-w-11 min-h-11 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                pageNum === page
                  ? 'bg-[#00acee] dark:bg-[#00acee] text-white shadow-xs'
                  : 'border border-[#e8e9ed] dark:border-[#30363d] text-[#5c647b] dark:text-gray-300 hover:bg-white dark:hover:bg-[#21262d] hover:text-[#3a435d] dark:hover:text-white'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Página siguiente"
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg border border-[#e8e9ed] dark:border-[#30363d] text-[#5c647b] dark:text-gray-300 hover:bg-white dark:hover:bg-[#21262d] hover:text-[#3a435d] dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
