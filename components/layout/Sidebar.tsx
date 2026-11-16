'use client';

import React, { useState, useEffect, Suspense, useSyncExternalStore } from 'react';

import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutDashboard, BarChart3, X, ChevronDown, HardDrive, Radio, Smartphone, Users } from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n';
import { triggerInstallPrompt } from '@/components/pwa/PwaManager';
import { useUserRole } from '@/lib/utils/useUserRole';
import SyncIndicator from './SyncIndicator';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptySubscribe = () => () => {};

function SidebarContent({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const userRole = useUserRole();

  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);


  // Estado para desplegar / contraer el menú padre "Dashboard"
  const [isDashboardOpen, setIsDashboardOpen] = useState<boolean>(true);
  const isStandalone = useSyncExternalStore(
    emptySubscribe,
    () => {
      if (typeof window === 'undefined') return false;
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true
      );
    },
    () => false
  );

  // Evitar que la página de fondo haga scroll cuando el menú está abierto en móvil y cerrar con tecla ESC
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const isDispositivosPath = pathname === '/dispositivos' || (pathname === '/dashboard' && searchParams?.get('tab') !== 'simcards');
  const isSimCardsPath = pathname === '/simcards' || (pathname === '/dashboard' && searchParams?.get('tab') === 'simcards');
  const isDashboardSection = pathname === '/dashboard' || pathname === '/dispositivos' || pathname === '/simcards' || pathname === '/';

  const content = (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* Backdrop desvanecido */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200"
        style={{ touchAction: 'none' }}
        onClick={onClose}
      />

      {/* Drawer Lateral Desplegable (fijado top-0 bottom-0 y con fondo continuo) */}
      <aside 
        className="fixed top-0 bottom-0 left-0 h-dvh w-[85vw] max-w-xs sm:w-80 bg-white dark:bg-[#161B22] z-50 shadow-2xl flex flex-col border-r border-[#e8e9ed] dark:border-[#30363d] animate-in slide-in-from-left duration-200 font-sans overscroll-contain select-none"
        style={{ touchAction: 'pan-y' }}
      >

        
        {/* Encabezado del Menú */}
        <div className="sidebar-header h-20 px-5 sm:px-6 border-b border-[#e8e9ed] dark:border-[#30363d] flex items-center justify-between shrink-0 bg-white dark:bg-[#121212]!">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Logo"
              width={150}
              height={40}
              className="h-9 sm:h-11 w-auto object-contain"
              style={{ width: 'auto' }}
            />
            <span className="text-base sm:text-lg font-extrabold text-[#3a435d] dark:text-white uppercase tracking-wider">
              {t('menu')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-xl text-[#5c647b] hover:text-[#3a435d] hover:bg-[#f2f3f7] dark:text-gray-300 dark:hover:text-white dark:hover:bg-[#282e38] transition-colors cursor-pointer border border-[#e8e9ed] dark:border-[#30363d]"
            title="Cerrar menú"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Opciones del Menú */}
        <div className="flex-1 p-3.5 sm:p-5 space-y-3 overflow-y-auto scrollbar-thin">
          <div className="px-3.5 py-1.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#5c647b] dark:text-gray-400">
            {t('navegacion_principal')}
          </div>

          {/* MENÚ PADRE: DASHBOARD (DESPLEGABLE) */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setIsDashboardOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-base sm:text-lg font-bold transition-all cursor-pointer ${
                isDashboardSection
                     ? 'bg-[#00acee]/10 dark:bg-[#00acee]/20 text-[#00acee] dark:text-[#38bdf8] shadow-xs'
                     : 'text-[#3a435d] dark:text-gray-300 hover:bg-[#f8f9fc] dark:hover:bg-[#21262d] hover:text-[#00acee] dark:hover:text-[#38bdf8]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <LayoutDashboard className={`w-6 h-6 shrink-0 ${isDashboardSection ? 'text-emerald-500' : 'text-[#5c647b] dark:text-gray-400'}`} />
                <span>{t('dashboard')}</span>
              </div>
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-200 ${
                  isDashboardOpen ? '' : '-rotate-90'
                } ${isDashboardSection ? 'text-[#00acee] dark:text-[#38bdf8]' : 'text-gray-400 dark:text-gray-500'}`}
              />
            </button>

            {/* HIJOS DESPLEGABLES DENTRO DE DASHBOARD */}
            {isDashboardOpen && (
              <div className="ml-4 pl-3 border-l-2 border-[#e8e9ed] dark:border-[#30363d] space-y-1.5 pt-1">
                
                {/* HIJO 1: Dispositivo */}
                <Link
                  href="/dispositivos"
                  prefetch={true}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm sm:text-base font-bold transition-all ${
                    isDispositivosPath
                      ? 'bg-[#00acee]/10 dark:bg-[#00acee]/20 text-[#00acee] dark:text-[#38bdf8] font-extrabold'
                      : 'text-[#3a435d] dark:text-gray-300 hover:bg-[#f8f9fc] dark:hover:bg-[#21262d] hover:text-[#00acee] dark:hover:text-[#38bdf8]'
                  }`}
                >
                  <HardDrive className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${isDispositivosPath ? 'text-[#00acee] dark:text-[#38bdf8]' : 'text-[#5c647b] dark:text-gray-400'}`} />
                  <span>{t('dispositivo')}</span>
                </Link>

                {/* HIJO 2: Tarjeta SIM */}
                <Link
                  href="/simcards"
                  prefetch={true}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm sm:text-base font-bold transition-all ${
                    isSimCardsPath
                      ? 'bg-[#00acee]/10 dark:bg-[#00acee]/20 text-[#00acee] dark:text-[#38bdf8] font-extrabold'
                      : 'text-[#3a435d] dark:text-gray-300 hover:bg-[#f8f9fc] dark:hover:bg-[#21262d] hover:text-[#00acee] dark:hover:text-[#38bdf8]'
                  }`}
                >
                  <Radio className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${isSimCardsPath ? 'text-[#00acee] dark:text-[#38bdf8]' : 'text-[#5c647b] dark:text-gray-400'}`} />
                  <span>{t('tarjeta_sim')}</span>
                </Link>

              </div>
            )}
          </div>


          {/* OPCIÓN 3: INFORMES */}
          <Link
            href="/informes"
            onClick={onClose}
            className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-base sm:text-lg font-bold transition-all ${
              pathname === '/informes'
                ? 'bg-[#00acee]/10 dark:bg-[#00acee]/20 text-[#00acee] dark:text-[#38bdf8] shadow-xs'
                : 'text-[#3a435d] dark:text-gray-300 hover:bg-[#f8f9fc] dark:hover:bg-[#21262d] hover:text-[#00acee] dark:hover:text-[#38bdf8]'
            }`}
          >
            <BarChart3 className={`w-6 h-6 shrink-0 ${pathname === '/informes' ? 'text-[#00acee] dark:text-[#38bdf8]' : 'text-[#5c647b] dark:text-gray-400'}`} />
            <span>{t('informes')}</span>
          </Link>

          {/* OPCIÓN 4: GESTIÓN DE CUENTAS (Exclusiva para Superadmin) */}
          {userRole === 'superadmin' && (
            <Link
              href="/cuentas"
              onClick={onClose}
              className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-base sm:text-lg font-bold transition-all ${
                pathname === '/cuentas'
                  ? 'bg-[#00acee]/10 dark:bg-[#00acee]/20 text-[#00acee] dark:text-[#38bdf8] shadow-xs'
                  : 'text-[#3a435d] dark:text-gray-300 hover:bg-[#f8f9fc] dark:hover:bg-[#21262d] hover:text-[#00acee] dark:hover:text-[#38bdf8]'
              }`}
            >
              <Users className={`w-6 h-6 shrink-0 ${pathname === '/cuentas' ? 'text-[#00acee] dark:text-[#38bdf8]' : 'text-[#5c647b] dark:text-gray-400'}`} />
              <span>{t('cuentas') || 'Cuentas'}</span>
            </Link>
          )}

          {/* OPCIÓN 4: INSTALAR APP PWA (Visible en navegadores para instalar cuando el usuario lo desee) */}
          {!isStandalone && (
            <button
              type="button"
              onClick={async () => {
                onClose();
                await triggerInstallPrompt();
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-base sm:text-lg font-bold text-[#00acee] bg-[#00acee]/10 hover:bg-[#00acee]/20 transition-all cursor-pointer border border-[#00acee]/30 shadow-2xs mt-3 text-left"
            >
              <Smartphone className="w-6 h-6 shrink-0 text-[#00acee]" />
              <span>{t('instalar_app')}</span>
            </button>
          )}

        </div>

        {/* Footer del Menú: Indicador de Sincronización + Versión */}
        <div className="sidebar-footer p-4 sm:p-5 border-t border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#121212]! shrink-0 space-y-3">
          <div className="w-full flex items-center">
            <SyncIndicator />
          </div>
          <div className="text-xs sm:text-sm text-[#5c647b] dark:text-gray-400 font-semibold">
            {t('version')}
          </div>
        </div>
      </aside>
    </div>
  );

  return createPortal(content, document.body);
}

export default function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={null}>
      <SidebarContent {...props} />
    </Suspense>
  );
}
