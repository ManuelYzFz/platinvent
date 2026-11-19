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
        className="fixed top-0 bottom-0 left-0 h-dvh w-[85vw] max-w-xs sm:w-80 bg-white dark:bg-[#0B111E] z-50 shadow-2xl flex flex-col border-r border-[#E2E8F0] dark:border-white/10 animate-in slide-in-from-left duration-200 font-sans overscroll-contain select-none transition-colors"
        style={{ touchAction: 'pan-y' }}
      >
        
        {/* Encabezado del Menú estilo VTRAXX */}
        <div className="sidebar-header h-18 sm:h-20 px-5 sm:px-6 border-b border-[#E2E8F0] dark:border-white/10 flex items-center justify-between shrink-0 bg-[#F8FAFC] dark:bg-[#121927]">
          <div className="flex items-center gap-3">
            <Image
              src="/images/VtraxxOscuro.png"
              alt="VTRAXX"
              width={140}
              height={36}
              className="h-8 sm:h-9 w-auto object-contain dark:hidden"
            />
            <Image
              src="/images/VtraxxBlanco.png"
              alt="VTRAXX"
              width={140}
              height={36}
              className="h-8 sm:h-9 w-auto object-contain hidden dark:block"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-[#E2E8F0] dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#1E293B] transition-colors cursor-pointer border border-[#E2E8F0] dark:border-white/15"
            title="Cerrar menú"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Opciones del Menú */}
        <div className="flex-1 p-3.5 sm:p-5 space-y-3 overflow-y-auto scrollbar-thin">
          <div className="px-3.5 py-1.5 text-xs sm:text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
            {t('navegacion_principal')}
          </div>

          {/* MENÚ PADRE: DASHBOARD (DESPLEGABLE) */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setIsDashboardOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer ${
                isDashboardSection
                     ? 'bg-[#00A3E0]/15 dark:bg-[#00A3E0]/20 text-[#00A3E0] dark:text-[#00A3E0] border border-[#00A3E0]/30 shadow-xs'
                     : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#162032] hover:text-[#00A3E0] dark:hover:text-[#00A3E0]'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className={`w-5 h-5 shrink-0 ${isDashboardSection ? 'text-[#00A3E0]' : 'text-slate-400'}`} />
                <span>{t('dashboard')}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isDashboardOpen ? '' : '-rotate-90'
                } ${isDashboardSection ? 'text-[#00A3E0]' : 'text-slate-400'}`}
              />
            </button>

            {/* HIJOS DESPLEGABLES DENTRO DE DASHBOARD */}
            {isDashboardOpen && (
              <div className="ml-4 pl-3 border-l-2 border-[#E2E8F0] dark:border-white/15 space-y-1.5 pt-1">
                
                {/* HIJO 1: Dispositivo */}
                <Link
                  href="/dispositivos"
                  prefetch={true}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isDispositivosPath
                      ? 'bg-[#00A3E0]/15 dark:bg-[#00A3E0]/20 text-[#00A3E0] dark:text-[#00A3E0] border border-[#00A3E0]/30 font-extrabold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162032] hover:text-[#00A3E0] dark:hover:text-[#00A3E0]'
                  }`}
                >
                  <HardDrive className={`w-4 h-4 shrink-0 ${isDispositivosPath ? 'text-[#00A3E0]' : 'text-slate-400'}`} />
                  <span>{t('dispositivo')}</span>
                </Link>

                {/* HIJO 2: Tarjeta SIM */}
                <Link
                  href="/simcards"
                  prefetch={true}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isSimCardsPath
                      ? 'bg-[#00A3E0]/15 dark:bg-[#00A3E0]/20 text-[#00A3E0] dark:text-[#00A3E0] border border-[#00A3E0]/30 font-extrabold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#162032] hover:text-[#00A3E0] dark:hover:text-[#00A3E0]'
                  }`}
                >
                  <Radio className={`w-4 h-4 shrink-0 ${isSimCardsPath ? 'text-[#00A3E0]' : 'text-slate-400'}`} />
                  <span>{t('tarjeta_sim')}</span>
                </Link>

              </div>
            )}
          </div>


          {/* OPCIÓN 3: INFORMES */}
          <Link
            href="/informes"
            onClick={onClose}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm sm:text-base font-bold transition-all ${
              pathname === '/informes'
                ? 'bg-[#00A3E0]/15 dark:bg-[#00A3E0]/20 text-[#00A3E0] dark:text-[#00A3E0] border border-[#00A3E0]/30 shadow-xs'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#162032] hover:text-[#00A3E0] dark:hover:text-[#00A3E0]'
            }`}
          >
            <BarChart3 className={`w-5 h-5 shrink-0 ${pathname === '/informes' ? 'text-[#00A3E0]' : 'text-slate-400'}`} />
            <span>{t('informes')}</span>
          </Link>

          {/* OPCIÓN 4: GESTIÓN DE CUENTAS (Exclusiva para Superadmin) */}
          {userRole === 'superadmin' && (
            <Link
              href="/cuentas"
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm sm:text-base font-bold transition-all ${
                pathname === '/cuentas'
                  ? 'bg-[#00A3E0]/15 dark:bg-[#00A3E0]/20 text-[#00A3E0] dark:text-[#00A3E0] border border-[#00A3E0]/30 shadow-xs'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#162032] hover:text-[#00A3E0] dark:hover:text-[#00A3E0]'
              }`}
            >
              <Users className={`w-5 h-5 shrink-0 ${pathname === '/cuentas' ? 'text-[#00A3E0]' : 'text-slate-400'}`} />
              <span>{t('cuentas') || 'Cuentas'}</span>
            </Link>
          )}

          {/* OPCIÓN 5: INSTALAR APP PWA */}
          {!isStandalone && (
            <button
              type="button"
              onClick={async () => {
                onClose();
                await triggerInstallPrompt();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm sm:text-base font-bold text-[#00A3E0] bg-[#00A3E0]/10 hover:bg-[#00A3E0]/20 transition-all cursor-pointer border border-[#00A3E0]/30 shadow-2xs mt-3 text-left"
            >
              <Smartphone className="w-5 h-5 shrink-0 text-[#00A3E0]" />
              <span>{t('instalar_app')}</span>
            </button>
          )}

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
