'use client';

import React from 'react';
import Image from 'next/image';
import { Mail, Phone, MapPin, Clock, ShieldCheck } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#F1F5F9] dark:bg-[#080D17] border-t border-[#E2E8F0] dark:border-white/10 text-slate-600 dark:text-slate-400 py-10 px-4 sm:px-6 lg:px-12 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
        
        {/* Columna 1: Logo Oficial y Derechos */}
        <div className="flex flex-col items-start gap-3.5">
          <div className="flex items-center">
            <Image
              src="/images/VtraxxOscuro.png"
              alt="VTRAXX Chile"
              width={160}
              height={40}
              className="h-8.5 w-auto object-contain dark:hidden"
            />
            <Image
              src="/images/VtraxxBlanco.png"
              alt="VTRAXX Chile"
              width={160}
              height={40}
              className="h-8.5 w-auto object-contain hidden dark:block"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            © {currentYear} VTRAXX Chile. Todos los derechos reservados.
          </p>
          <a
            href="/docs/politica-de-etica-y-cumplimiento.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#00A3E0] hover:underline font-semibold"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Política de Ética y Cumplimiento</span>
          </a>
        </div>

        {/* Columna 2: Sobre Nosotros */}
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
            Sobre Nosotros
          </h4>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            VTRAXX Chile ofrece soluciones integrales en equipos de posicionamiento satelital, telemetría avanzada, monitoreo continuo y video vigilancia móvil adaptadas al mercado nacional.
          </p>
        </div>

        {/* Columna 3: Dirección */}
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
            Dirección
          </h4>
          <div className="flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="w-4 h-4 text-[#00A3E0] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p>Pasaje 1, Villa Sallustro</p>
              <p>Rancagua, Región de O&apos;Higgins</p>
              <p className="text-[#00A3E0] font-semibold">Chile</p>
            </div>
          </div>
        </div>

        {/* Columna 4: Contacto */}
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
            Contacto
          </h4>
          <div className="flex flex-col gap-2 text-xs">
            <a
              href="mailto:ventas@vtraxx.cl"
              className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-[#00A3E0] transition-colors group"
            >
              <Mail className="w-4 h-4 text-[#00A3E0] shrink-0 group-hover:scale-110 transition-transform" />
              <span>ventas@vtraxx.cl</span>
            </a>
            <a
              href="tel:+56981572635"
              className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-[#00A3E0] transition-colors group"
            >
              <Phone className="w-4 h-4 text-[#00A3E0] shrink-0 group-hover:scale-110 transition-transform" />
              <span>+56 9 8157 2635</span>
            </a>
            <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
              <Clock className="w-4 h-4 text-[#00A3E0] shrink-0" />
              <span>Lun - Vie: 9:00 a 17:00 hrs</span>
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
