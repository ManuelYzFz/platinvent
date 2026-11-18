'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { User, Lock, Eye, EyeOff, LogIn, CheckCircle2, AlertCircle, WifiOff, Info } from 'lucide-react';
import GoogleTranslator from '@/components/layout/GoogleTranslator';
import ThemeToggle from '@/components/layout/ThemeToggle';
import Preloader from '@/components/layout/Preloader';
import Footer from '@/components/layout/Footer';
import { useTranslation } from '@/lib/i18n';
import { getSession, getRememberedUsername, saveSession } from '@/lib/utils/storage';

const subscribeOnline = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

const getOfflineSnapshot = () => (typeof navigator !== 'undefined' ? !navigator.onLine : false);
const getServerOfflineSnapshot = () => false;

const subscribeSession = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('online', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('online', callback);
  };
};

const getSessionSnapshot = () => Boolean(getSession());
const getServerSessionSnapshot = () => false;

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const isOffline = useSyncExternalStore(subscribeOnline, getOfflineSnapshot, getServerOfflineSnapshot);
  const hasStoredSession = useSyncExternalStore(subscribeSession, getSessionSnapshot, getServerSessionSnapshot);
  const [manualSession, setManualSession] = useState(false);
  const hasSession = manualSession || hasStoredSession;

  const rememberedUsername = useSyncExternalStore(
    subscribeSession,
    () => getRememberedUsername(),
    () => ''
  );

  const [manualUsername, setManualUsername] = useState<string | null>(null);
  const [manualRememberMe, setManualRememberMe] = useState<boolean | null>(null);

  const username = manualUsername !== null ? manualUsername : rememberedUsername;
  const rememberMe = manualRememberMe !== null ? manualRememberMe : false;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForgotTooltip, setShowForgotTooltip] = useState(false);
  const forgotTooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showForgotTooltip) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (forgotTooltipRef.current && !forgotTooltipRef.current.contains(event.target as Node)) {
        setShowForgotTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showForgotTooltip]);

  useEffect(() => {
    if (hasSession) {
      router.replace('/dispositivos');
    }
  }, [hasSession, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('Se requiere conexión a internet para iniciar sesión.');
      return;
    }

    if (!username.trim() || !password.trim()) {
      setErrorMessage(t('error_campos'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/opentraxx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', account: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar sesión en OpenTraxx');

      // Guardar información completa de la sesión a través de storage.ts
      saveSession({
        session: data.session,
        username: username.trim(),
        role: data.role || 'admin',
        remember: rememberMe,
        dashboardData: data,
      });

      setSuccessMessage(t('sesion_iniciada'));
      setTimeout(() => {
        setManualSession(true);
        router.replace('/dispositivos');
      }, 400);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      setErrorMessage(error instanceof Error ? error.message : t('error_conexion'));
      setIsLoading(false);
    }
  };

  if (hasSession) {
    return <Preloader fullScreen message={t('cargando_informacion') || 'Redirigiendo a la plataforma...'} />;
  }

  return (
    <div className="min-h-screen w-full bg-[#f2f3f7] dark:bg-[#0b1329] flex flex-col font-sans selection:bg-[#00acee]/20 relative">
      {/* Botón flotante para cambiar de tema (Modo Oscuro / Claro) */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-30">
        <ThemeToggle />
      </div>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        {/* Cuadro central blanco */}
        <div className="w-full max-w-md bg-white border border-[#e8e9ed] rounded-2xl p-8 sm:p-10 shadow-sm transition-all duration-300 hover:shadow-md relative">
        
        {/* Logo Vtraxx y Encabezado */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Logo en Modo Claro (letras oscuras) */}
          <Image 
            src="/images/openvtraxx.png" 
            alt="Logo Vtraxx" 
            width={180} 
            height={48} 
            className="login-logo-light h-12 w-auto object-contain mb-4"
            style={{ width: 'auto' }}
            priority
          />
          {/* Logo en Modo Oscuro (letras blancas) */}
          <Image 
            src="/images/vtraxx.png" 
            alt="Logo Vtraxx" 
            width={180} 
            height={48} 
            className="login-logo-dark h-12 w-auto object-contain mb-4"
            style={{ width: 'auto' }}
            priority
          />
          <h1 className="text-2xl font-bold text-[#3a435d] tracking-tight">
            {t('iniciar_sesion')}
          </h1>
          <p className="text-sm text-[#5c647b] mt-1 font-medium">
            {t('plataforma_inventariado')}
          </p>
        </div>

        {/* Mensajes de Alerta */}
        {isOffline && (
          <div className="mb-6 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Modo sin conexión. Conéctate a internet para iniciar sesión.</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Campo Usuario */}
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-[#3a435d] uppercase tracking-wider mb-2">
              {t('usuario')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <User className="w-4 h-4 text-[#3a435d]/60" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setManualUsername(e.target.value)}
                placeholder={t('ingresa_usuario')}
                className="w-full pl-10 pr-4 py-3 bg-white border border-[#e8e9ed] rounded-xl text-sm text-[#3a435d] placeholder-gray-400 focus:outline-none focus:border-[#00acee] focus:ring-2 focus:ring-[#00acee]/20 transition-all duration-200"
                required
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-xs font-semibold text-[#3a435d] uppercase tracking-wider">
                {t('contrasena')}
              </label>
              <div
                ref={forgotTooltipRef}
                className="relative inline-block"
                onMouseEnter={() => setShowForgotTooltip(true)}
                onMouseLeave={() => setShowForgotTooltip(false)}
              >
                <button
                  type="button"
                  onClick={() => setShowForgotTooltip((prev) => !prev)}
                  className="text-xs text-[#00acee] hover:underline transition-colors font-medium cursor-pointer focus:outline-none select-none"
                  aria-expanded={showForgotTooltip}
                >
                  {t('olvidaste_contrasena')}
                </button>

                {showForgotTooltip && (
                  <div
                    role="tooltip"
                    className="absolute right-0 bottom-full mb-2.5 w-64 sm:w-72 p-3.5 bg-white dark:bg-[#161B22] border border-[#e8e9ed] dark:border-[#30363d] rounded-2xl shadow-xl text-xs text-[#3a435d] dark:text-gray-200 z-50 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#00acee] shrink-0 mt-0.5" />
                      <p className="leading-relaxed font-normal">
                        {t('olvidaste_contrasena_ayuda')}
                      </p>
                    </div>
                    {/* Flecha indicadora apuntando al enlace */}
                    <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white dark:bg-[#161B22] border-b border-r border-[#e8e9ed] dark:border-[#30363d] transform rotate-45" />
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4 text-[#3a435d]/60" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-white border border-[#e8e9ed] rounded-xl text-sm text-[#3a435d] placeholder-gray-400 focus:outline-none focus:border-[#00acee] focus:ring-2 focus:ring-[#00acee]/20 transition-all duration-200"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-[#3a435d] dark:hover:text-white focus:outline-none transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Recordarme */}
          <div className="flex flex-col gap-1 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[#5c647b] select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setManualRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#e8e9ed] text-[#3a435d] focus:ring-[#00acee] accent-[#3a435d] cursor-pointer"
              />
              <span className="text-xs font-medium">{t('recordarme')}</span>
            </label>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 pl-6.5">
              {t('recordarme_ayuda')}
            </span>
          </div>

          {/* Botón de Ingreso */}
          <button
            type="submit"
            disabled={isLoading || isOffline}
            className={`w-full mt-2 py-3 px-4 text-white font-medium text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed ${
              isOffline
                ? 'bg-gray-500 hover:bg-gray-500'
                : 'bg-[#000000] hover:bg-[#374046] active:bg-[#000000] dark:bg-[#21262d] dark:hover:bg-[#30363d] dark:border dark:border-[#30363d]'
            }`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isOffline ? (
              <>
                <span>Sin conexión a internet</span>
                <WifiOff className="w-4 h-4 text-gray-300" />
              </>
            ) : (
              <>
                <span>{t('iniciar_sesion')}</span>
                <LogIn className="w-4 h-4 text-[#00acee]" />
              </>
            )}
          </button>

          {/* Selector de Idioma */}
          <div className="pt-2 flex items-center justify-center">
            <GoogleTranslator />
          </div>
        </form>
      </div>
      </main>

      <Footer />
    </div>
  );
}
