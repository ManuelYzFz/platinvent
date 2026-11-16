'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, UploadCloud } from 'lucide-react';
import { 
  getPendingCount, 
  syncPendingChanges, 
  type SyncStatus 
} from '@/lib/services/offlineStorage';
import { useTranslation } from '@/lib/i18n';

export default function SyncIndicator() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Estado inicial
    const checkInitial = async () => {
      const offline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
      setIsOffline(offline);
      const count = await getPendingCount();
      setPendingCount(count);
      if (offline) {
        setStatus('offline');
      } else if (count > 0) {
        setStatus('pending');
      } else {
        setStatus('synced');
      }
    };
    void checkInitial();

    const handleSyncStatus = (event: Event) => {
      const custom = event as CustomEvent<{ count: number; status: SyncStatus; isOffline: boolean }>;
      if (custom.detail) {
        setPendingCount(custom.detail.count);
        setStatus(custom.detail.status);
        setIsOffline(custom.detail.isOffline);
      }
    };

    const handleDataSynchronized = (event: Event) => {
      const custom = event as CustomEvent<{ synced: number }>;
      const syncedCount = custom.detail?.synced || 0;
      if (syncedCount > 0) {
        setToastMessage(`¡${syncedCount} cambio${syncedCount > 1 ? 's' : ''} sincronizado${syncedCount > 1 ? 's' : ''} con éxito!`);
        setTimeout(() => setToastMessage(null), 4000);
      }
    };

    window.addEventListener('vtraxx-sync-status', handleSyncStatus);
    window.addEventListener('vtraxx-data-synchronized', handleDataSynchronized);

    return () => {
      window.removeEventListener('vtraxx-sync-status', handleSyncStatus);
      window.removeEventListener('vtraxx-data-synchronized', handleDataSynchronized);
    };
  }, []);

  const handleManualSync = async () => {
    if (isOffline || status === 'syncing') return;
    setStatus('syncing');
    await syncPendingChanges();
  };

  return (
    <div className="relative flex items-center notranslate" translate="no">
      {/* Toast flotante tras sincronizar */}
      {toastMessage && (
        <div className="absolute top-10 right-0 z-50 whitespace-nowrap bg-emerald-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg border border-emerald-600 animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Sincronizando */}
      {status === 'syncing' && (
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs animate-pulse"
          title="Sincronizando cambios locales con el servidor..."
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
          <span className="hidden sm:inline">{t('sincronizando_badge')}</span>
          <span className="sm:hidden">{t('sincronizando_badge')}</span>
        </div>
      )}

      {/* Modo Offline */}
      {status === 'offline' && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 shadow-2xs"
          title={
            pendingCount > 0
              ? `Sin conexión. ${pendingCount} registro(s) guardado(s) localmente listos para sincronizar.`
              : 'Modo sin conexión activo (Datos cacheados en el equipo)'
          }
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="hidden sm:inline">
            {pendingCount > 0 ? `${pendingCount} ${t('pendientes_badge')}` : t('sin_conexion_badge')}
          </span>
          <span className="sm:hidden">
            {pendingCount > 0 ? `${pendingCount} pend.` : t('sin_conexion_badge')}
          </span>
        </div>
      )}

      {/* Conectado con cambios pendientes */}
      {status === 'pending' && (
        <button
          type="button"
          onClick={handleManualSync}
          className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-all shadow-2xs cursor-pointer active:scale-95"
          title="Hay registros guardados offline. Haz clic para sincronizar ahora."
        >
          <UploadCloud className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>
            {pendingCount} {t('pendientes_badge')}
          </span>
        </button>
      )}

      {/* Todo Sincronizado */}
      {status === 'synced' && (
        <div 
          className="sync-badge-synced flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-[#121212] text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-600/60 shadow-2xs"
          title="Todos los datos están sincronizados con el servidor"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{t('todo_sincronizado')}</span>
        </div>
      )}
    </div>
  );
}
