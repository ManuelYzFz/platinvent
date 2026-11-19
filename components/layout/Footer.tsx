'use client';

import React from 'react';
import Image from 'next/image';
import { Mail, Phone } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[#0b1329] dark:bg-[#080d1c] border-t border-[#1e2a4a] text-slate-300 py-10 px-4 sm:px-6 lg:px-12 mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
        
        {/* Columna 1: Logo y Derechos */}
        <div className="flex flex-col items-start gap-4">
          <Image
            src="/images/VtraxxBlanco.png"
            alt="Logo Vtraxx"
            width={160}
            height={42}
            className="h-9 w-auto object-contain"
          />
          <div className="text-[11px] leading-relaxed text-slate-400 font-medium tracking-wider">
            <p className="flex items-center gap-1.5">
              <span>●</span> DERECHOS RESERVADOS
            </p>
            <p className="pl-3 text-slate-400">EN VTRAXX CHILE</p>
          </div>
        </div>

        {/* Columna 2: Sobre Nosotros */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-bold text-white tracking-wide">
            Sobre Nosotros
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            VTRAXX CHILE ofrece una solución integral con tecnología de punta en equipos de POSICIONAMIENTO, MONITOREO, VIDEO VIGILANCIA MÓVIL, TELEMETRÍA
          </p>
          <a
            href="/docs/politica-de-etica-y-cumplimiento.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-300 hover:text-[#00acee] underline decoration-slate-500 hover:decoration-[#00acee] transition-colors w-fit font-medium"
          >
            Política de Ética y Cumplimiento
          </a>
        </div>

        {/* Columna 3: Horario */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-bold text-white tracking-wide">
            Horario
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            En nuestra oficina podemos dar solución a tus problemas
          </p>
          <p className="text-xs font-semibold text-white">
            Lun-Vie: 9 am a 5 pm
          </p>
        </div>

        {/* Columna 4: Contacto */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-bold text-white tracking-wide">
            Contacto
          </h4>
          <div className="flex flex-col gap-2.5">
            <a
              href="mailto:ventas@vtraxx.cl"
              className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-[#00acee] transition-colors group"
            >
              <Mail className="w-4 h-4 text-[#00acee] shrink-0 group-hover:scale-110 transition-transform" />
              <span>ventas@vtraxx.cl</span>
            </a>
            <a
              href="tel:+56981572635"
              className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-[#00acee] transition-colors group"
            >
              <Phone className="w-4 h-4 text-[#00acee] shrink-0 group-hover:scale-110 transition-transform" />
              <span>+56 9 8157 2635</span>
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
