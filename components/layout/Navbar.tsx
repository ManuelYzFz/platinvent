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

      <header className="w-full bg-white dark:bg-[#161B22] border-b border-[#e8e9ed] dark:border-[#30363d] sticky top-0 z-40 shadow-xs">
        <div className="w-full px-3 sm:px-6 lg:px-10 h-16 sm:h-20 flex items-center justify-between gap-2">
          
          {/* Izquierda: Botón Menú Lateral + Logo y Plataforma de Inventario */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl text-[#3a435d] dark:text-gray-200 hover:bg-[#f2f3f7] dark:hover:bg-[#21262d] hover:text-[#00acee] dark:hover:text-[#00acee] transition-all cursor-pointer border border-[#e8e9ed] dark:border-[#30363d] shadow-2xs"
              title="Abrir menú lateral"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <Image
              id="main-logo"
              src="/images/logo.png"
              alt="Vtraxx Logo"
              width={170}
              height={46}
              className="h-7 sm:h-10 md:h-11 w-auto object-contain"
              style={{ width: 'auto' }}
              priority
            />
            <div className="h-6 w-px bg-[#e8e9ed] dark:bg-[#30363d] hidden md:block" />
            <span className="text-xs sm:text-base font-extrabold text-[#3a435d] dark:text-white tracking-tight hidden md:inline truncate">
              {t('plataforma_inventario')}
            </span>
          </div>

          {/* Derecha: Acciones Rápidas, Notificaciones, Usuario, Idioma y Salir */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">


            {/* Nombre de la Cuenta del Usuario y Rol */}
            <div className="hidden sm:flex items-center gap-2 text-left">
              <span 
                className="text-xs sm:text-sm font-bold text-[#3a435d] dark:text-white leading-tight max-w-40 xl:max-w-55 truncate"
                suppressHydrationWarning
              >
                {userName || t('usuario_vtraxx')}
              </span>
              <span
                suppressHydrationWarning
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                  userRole === 'superadmin'
                    ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
                    : userRole === 'solo_lectura'
                      ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                      : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                }`}
              >
                {userRole === 'superadmin' ? 'Superadmin' : userRole === 'solo_lectura' ? 'Lectura' : 'Admin'}
              </span>
            </div>

            <div className="h-6 w-px bg-[#e8e9ed] dark:bg-[#30363d] hidden sm:block" />
 
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
                className="flex items-center gap-1.5 p-2 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-bold text-gray-700 hover:text-red-600 hover:bg-red-50 dark:text-gray-200 dark:border-[#30363d] dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:hover:border-red-900/60 rounded-xl border border-[#e8e9ed] hover:border-red-200 transition-all duration-200 cursor-pointer shadow-2xs group"
                title={t('cerrar_sesion')}
              >
                <LogOut className="w-4 h-4 text-[#3a435d] dark:text-gray-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                <span className="hidden md:inline">{t('cerrar_sesion')}</span>
              </button>
            )}
          </div>

        </div>
      </header>
    </>
  );
}
