'use client';

import { useState } from 'react';
import GoogleTranslator from './GoogleTranslator';
import ThemeToggle from './ThemeToggle';
import Sidebar from './Sidebar';
import Image from 'next/image';
import { LogOut, Menu } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useIdleLogout } from '@/lib/utils/useIdleLogout';
import { useUserRole } from '@/lib/utils/useUserRole';

interface NavbarProps {
  userName?: string;
  onLogout?: () => void;
}

export default function Navbar({ userName = 'Usuario Vtraxx', onLogout }: NavbarProps) {
  useIdleLogout();
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const userRole = useUserRole();


  return (
    <>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <header className="w-full bg-white dark:bg-[#121927] border-b border-[#e2e8f0] dark:border-white/10 sticky top-0 z-40 shadow-xs transition-colors">
        <div className="w-full px-3 sm:px-6 lg:px-10 h-16 sm:h-18 flex items-center justify-between gap-2">
          
          {/* Izquierda: Botón Menú Lateral + Logo Corporativo Vtraxx + Título */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl text-[#0F172A] dark:text-gray-200 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] hover:text-[#00A3E0] dark:hover:text-[#00A3E0] transition-all cursor-pointer border border-[#E2E8F0] dark:border-white/15 shadow-2xs"
              title="Abrir menú lateral"
            >
              <Menu className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
            </button>

            {/* Logo Oficial VTRAXX Adaptativo */}
            <div className="flex items-center">
              <Image
                id="main-logo-light"
                src="/images/VtraxxOscuro.png"
                alt="VTRAXX"
                width={150}
                height={38}
                className="h-7 sm:h-8.5 w-auto object-contain dark:hidden"
                priority
              />
              <Image
                id="main-logo-dark"
                src="/images/VtraxxBlanco.png"
                alt="VTRAXX"
                width={150}
                height={38}
                className="h-7 sm:h-8.5 w-auto object-contain hidden dark:block"
                priority
              />
            </div>

            <div className="h-6 w-px bg-[#E2E8F0] dark:bg-white/15 hidden md:block" />
            
            <span className="text-xs sm:text-sm font-bold text-[#334155] dark:text-slate-300 tracking-tight hidden md:inline truncate">
              {t('plataforma_inventario')}
            </span>
          </div>

          {/* Derecha: Acciones Rápidas, Usuario estilo FacturApp, Idioma, Tema y Salir */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">

            {/* Cápsula de Usuario Oficial VTRAXX (estilo FacturApp) */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[#E2E8F0] dark:border-white/15 bg-[#F8FAFC] dark:bg-[#162032] shadow-2xs">
              <div 
                suppressHydrationWarning
                className="w-6 h-6 rounded-full bg-[#00A3E0] text-white flex items-center justify-center text-[11px] font-black uppercase shrink-0"
              >
                {(userName || 'V').charAt(0)}
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span 
                  className="text-xs font-bold text-[#0F172A] dark:text-white max-w-36 xl:max-w-48 truncate"
                  suppressHydrationWarning
                >
                  {userName || t('usuario_vtraxx')}
                </span>
                <span
                  suppressHydrationWarning
                  className="text-[10px] font-semibold text-[#00A3E0] dark:text-[#00A3E0] tracking-wide"
                >
                  {userRole === 'superadmin' ? 'Superadmin' : userRole === 'solo_lectura' ? 'Solo Lectura' : 'Administrador'}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-[#E2E8F0] dark:bg-white/15 hidden sm:block" />
 
            {/* Modo Oscuro / Claro */}
            <ThemeToggle />

            {/* Selector de Idiomas en el Navbar */}
            <div className="scale-90 sm:scale-100 origin-right">
              <GoogleTranslator />
            </div>

            {/* Botón Cerrar Sesión */}
            {onLogout && (
              <button
                onClick={onLogout}
                type="button"
                className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs font-bold text-slate-700 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-300 dark:border-white/15 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 dark:hover:border-rose-900/60 rounded-xl border border-[#E2E8F0] hover:border-rose-200 transition-all duration-200 cursor-pointer shadow-2xs group"
                title={t('cerrar_sesion')}
              >
                <LogOut className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
                <span className="hidden md:inline">{t('cerrar_sesion')}</span>
              </button>
            )}
          </div>

        </div>
      </header>
    </>
  );
}
