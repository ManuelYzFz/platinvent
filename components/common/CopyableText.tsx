'use client';

import React, { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from './Toast';

interface CopyableTextProps {
  text: string;
  displayValue?: React.ReactNode;
  title?: string;
  className?: string;
  iconSize?: number;
}

export default function CopyableText({
  text,
  displayValue,
  title,
  className = '',
  iconSize = 13,
}: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const val = String(text ?? '').trim();
      if (!val || val === '-' || val === 'Sin Asignar' || val === 'null') return;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(val);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = val;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          textArea.remove();
        }
        setCopied(true);
        toast.success(`Copiado: ${val}`, 2000);
        setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        console.warn('Error al copiar al portapapeles:', err);
      }
    },
    [text]
  );

  const val = String(text ?? '').trim();
  const isValidValue = Boolean(val && val !== '-' && val !== 'Sin Asignar' && val !== 'null');

  if (!isValidValue) {
    return <span className={className}>{displayValue ?? text}</span>;
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`group/copy inline-flex items-center gap-1.5 text-left rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-all cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 ${
        copied
          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15'
          : 'hover:text-[#00A3E0]'
      } ${className}`}
      title={copied ? '¡Copiado al portapapeles!' : (title || `Copiar "${val}"`)}
    >
      <span className="truncate">{displayValue ?? text}</span>
      <span className="shrink-0 opacity-40 group-hover/copy:opacity-100 transition-opacity">
        {copied ? (
          <Check className="text-emerald-500 dark:text-emerald-400 animate-in zoom-in-75 duration-150" style={{ width: iconSize, height: iconSize }} />
        ) : (
          <Copy className="group-hover/copy:text-[#00A3E0] transition-colors" style={{ width: iconSize, height: iconSize }} />
        )}
      </span>
    </button>
  );
}
