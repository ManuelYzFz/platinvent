'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, Download, Check, Copy, HardDrive, Barcode } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslation } from '@/lib/i18n';
import type { DeviceRecord } from '@/lib/types/inventory';
import { useScrollLock } from '@/lib/utils/useScrollLock';

interface QrCodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceRecord | null;
}

export default function QrCodePreviewModal({
  isOpen,
  onClose,
  device,
}: QrCodePreviewModalProps) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const devId = device ? String(device.devIDNO ?? device.id ?? '').trim() : '';
  const imei = device ? String(device.imei ?? '').trim() : '';

  useEffect(() => {
    let ignore = false;

    if (!isOpen || !device) {
      void Promise.resolve().then(() => {
        if (!ignore) setQrDataUrl(null);
      });
      return;
    }

    // Si el dispositivo ya tiene una imagen QR guardada, utilizarla
    if (device.qrCode && typeof device.qrCode === 'string' && device.qrCode.startsWith('data:image')) {
      void Promise.resolve().then(() => {
        if (!ignore) setQrDataUrl(device.qrCode!);
      });
      return;
    }

    // Si no tiene qrCode guardado previamente, generarlo en caliente para visualización
    const payload = JSON.stringify({
      devIDNO: devId,
      imei: imei || null,
    });

    QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!ignore) setQrDataUrl(url);
      })
      .catch((err) => console.warn('Error generando QR preview:', err));

    return () => {
      ignore = true;
    };
  }, [isOpen, device, devId, imei]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useScrollLock(isOpen);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  if (!isOpen || !device) return null;

  const handleCopyData = () => {
    const textToCopy = `devIDNO: ${devId}${imei ? `\nIMEI: ${imei}` : ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_Device_${devId || 'code'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200 overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-preview-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-[#162032] p-6 shadow-2xl border border-slate-200 dark:border-white/14 flex flex-col items-center max-h-[90vh] overflow-y-auto notranslate" 
        translate="no"
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          type="button"
          aria-label={t('cerrar') || 'Cerrar'}
          className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabecera */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-[#00A3E0]/10 dark:bg-[#00A3E0]/15 border border-[#00A3E0]/20 text-[#00A3E0]">
            <QrCode className="w-5 h-5 text-[#00A3E0]" />
          </div>
          <h3 id="qr-preview-title" className="text-base font-bold text-slate-900 dark:text-white">
            {t('codigo_qr_dispositivo')}
          </h3>
        </div>

        {/* Imagen del Código QR (fondo blanco fijo para escaneo óptico en dark mode) */}
        <div 
          style={{ backgroundColor: '#ffffff' }}
          className="p-4 rounded-2xl border-2 border-slate-200 dark:border-white/10 shadow-xs flex items-center justify-center min-w-55 min-h-55"
        >
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR para ${devId}`}
              className="w-52 h-52 object-contain"
            />
          ) : (
            <div className="text-xs text-gray-400 animate-pulse">
              {t('generando_codigo_qr_dots')}
            </div>
          )}
        </div>

        {/* Detalles del Dispositivo */}
        <div className="w-full mt-4 space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#0F1726] border border-slate-200/80 dark:border-white/10">
            <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[#00A3E0]" />
              devIDNO:
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{devId || '-'}</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#0F1726] border border-slate-200/80 dark:border-white/10">
            <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Barcode className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
              IMEI:
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{imei || t('no_asignado')}</span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="w-full mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopyData}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E293B] transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? t('copiado') : t('copiar')}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#00A3E0] hover:bg-[#0092c8] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('descargar_qr')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
