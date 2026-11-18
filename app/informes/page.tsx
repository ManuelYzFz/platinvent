'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Preloader from '@/components/layout/Preloader';
import { useTranslation } from '@/lib/i18n';
import type { DeviceRecord } from '@/lib/types/inventory';
import { extractDevicesArray } from '@/lib/utils/data-extractors';
import { getSession, getUsername, clearSession } from '@/lib/utils/storage';
import {
  BarChart3,
  RefreshCw,
  HardDrive,
  AlertTriangle,
  Award,
  Layers,
  Truck,
  Package,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  X,
} from 'lucide-react';

interface StockGroup {
  label: string;
  sold: number;
  stock: number;
  total: number;
}

interface BrandGroup extends StockGroup {
  models: StockGroup[];
}

// Un equipo cuenta como "instalado" cuando está asignado a empresa/vehículo
const isInstalled = (d: DeviceRecord) => Number(d.install) === 1;

const byMostInstalled = (a: StockGroup, b: StockGroup) =>
  b.sold - a.sold || b.total - a.total || a.label.localeCompare(b.label);

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export default function InformesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('Usuario Vtraxx');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});

  const handleLogout = () => {
    clearSession();
    try {
      router.push('/login');
    } catch {
      window.location.replace('/login');
    }
  };

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/local-devices?t=${Date.now()}`, { cache: 'no-store' });
      const data = res.ok ? await res.json() : null;
      setDevices(extractDevicesArray(data));
    } catch (err) {
      console.error('Error al cargar datos para la página de Informes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const initAndFetch = async () => {
      await Promise.resolve();
      if (ignore) return;
      const savedSession = getSession();
      if (!savedSession || savedSession.startsWith('offline-')) {
        try {
          router.replace('/login');
        } catch {
          window.location.replace('/login');
        }
        return;
      }

      setIsAuthorized(true);
      const savedUser = getUsername();
      if (savedUser) setUsername(savedUser);

      await fetchData(false);
    };

    void initAndFetch();
    return () => {
      ignore = true;
    };
  }, [router, fetchData]);

  // Agrupación de equipos por marca (y modelo dentro de cada marca)
  const allBrandGroups = useMemo<BrandGroup[]>(() => {
    const brands = new Map<string, { group: BrandGroup; models: Map<string, StockGroup> }>();

    devices.forEach((d) => {
      const brand = String(d.brand ?? '').trim() || 'Sin marca';
      const model = String(d.model ?? '').trim() || 'Sin modelo';
      const installed = isInstalled(d);

      let entry = brands.get(brand.toLowerCase());
      if (!entry) {
        entry = { group: { label: brand, sold: 0, stock: 0, total: 0, models: [] }, models: new Map() };
        brands.set(brand.toLowerCase(), entry);
      }

      let modelGroup = entry.models.get(model.toLowerCase());
      if (!modelGroup) {
        modelGroup = { label: model, sold: 0, stock: 0, total: 0 };
        entry.models.set(model.toLowerCase(), modelGroup);
      }

      for (const g of [entry.group, modelGroup]) {
        g.total += 1;
        if (installed) g.sold += 1;
        else g.stock += 1;
      }
    });

    return Array.from(brands.values())
      .map(({ group, models }) => ({ ...group, models: Array.from(models.values()).sort(byMostInstalled) }))
      .sort(byMostInstalled);
  }, [devices]);

  // Filtrado por buscador
  const filteredBrandGroups = useMemo<BrandGroup[]>(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return allBrandGroups;

    return allBrandGroups
      .map((brand) => {
        const brandMatch = brand.label.toLowerCase().includes(query);
        const matchingModels = brand.models.filter((m) => m.label.toLowerCase().includes(query));

        if (brandMatch) {
          return brand;
        }

        if (matchingModels.length > 0) {
          return {
            ...brand,
            models: matchingModels,
          };
        }

        return null;
      })
      .filter((b): b is BrandGroup => b !== null);
  }, [allBrandGroups, searchTerm]);

  const totals = useMemo(() => {
    const sold = devices.filter(isInstalled).length;
    return { total: devices.length, sold, stock: devices.length - sold };
  }, [devices]);

  const topBrand = allBrandGroups[0] && allBrandGroups[0].sold > 0 ? allBrandGroups[0] : null;

  const toggleBrand = useCallback((brandLabel: string) => {
    setExpandedBrands((prev) => ({
      ...prev,
      [brandLabel]: !prev[brandLabel],
    }));
  }, []);

  const expandAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    allBrandGroups.forEach((b) => {
      all[b.label] = true;
    });
    setExpandedBrands(all);
  }, [allBrandGroups]);

  const collapseAll = useCallback(() => {
    setExpandedBrands({});
  }, []);

  // Si hay término de búsqueda activo, expandir automáticamente las marcas coincidentes
  const isBrandExpanded = useCallback(
    (brandLabel: string) => {
      if (searchTerm.trim() !== '') return true;
      return Boolean(expandedBrands[brandLabel]);
    },
    [searchTerm, expandedBrands]
  );

  if (!isAuthorized) {
    return <Preloader fullScreen message={t('cargando_informacion') || 'Cargando...'} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B111E] flex flex-col font-sans w-full max-w-full overflow-x-hidden transition-colors">
      <Navbar userName={username} onLogout={handleLogout} />

      <main className="w-full max-w-full min-w-0 space-y-6 sm:space-y-8 px-3 sm:px-6 lg:px-10 py-4 sm:py-8 flex-1">
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#162032] p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00A3E0]/10 border border-[#00A3E0]/20 text-[#00A3E0] shrink-0">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {t('modulo_informes') || 'Módulo de Informes Estadísticos'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Control de rotación de hardware: equipos operativos en flota vs. disponibilidad en bodega
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchData()}
            className="self-start md:self-auto p-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E293B] transition-all cursor-pointer shadow-xs min-h-11 min-w-11 flex items-center justify-center"
            title={t('actualizar') || 'Actualizar informe'}
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin text-[#00A3E0]' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="w-full min-h-[40vh] flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#162032] p-12 shadow-sm">
            <div className="w-10 h-10 rounded-full border-3 border-[#00A3E0]/20 border-t-[#00A3E0] animate-spin mb-4" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 animate-pulse">
              Analizando inventario de equipos...
            </span>
          </div>
        ) : devices.length === 0 ? (
          <div className="w-full p-12 text-center bg-white dark:bg-[#162032] rounded-2xl border border-slate-200 dark:border-white/10 text-sm text-slate-500 dark:text-slate-400 space-y-2 shadow-sm">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-slate-900 dark:text-white">No hay equipos registrados.</p>
            <p className="text-xs">Agrega dispositivos en el módulo de Dispositivos para ver el informe estadístico.</p>
          </div>
        ) : (
          <>
            {/* Resumen general con terminología clara */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
              <SummaryCard
                icon={<HardDrive className="w-5 h-5" />}
                label="Total Equipos Registrados"
                value={totals.total}
                detail="Parque total de hardware"
                tone="slate"
              />
              <SummaryCard
                icon={<Truck className="w-5 h-5" />}
                label="Instalados en Vehículos"
                value={totals.sold}
                detail={`${percent(totals.sold, totals.total)}% operando en flota`}
                tone="emerald"
              />
              <SummaryCard
                icon={<Package className="w-5 h-5" />}
                label="Disponibles en Bodega"
                value={totals.stock}
                detail={`${percent(totals.stock, totals.total)}% en stock libre`}
                tone="amber"
              />
              <SummaryCard
                icon={<Award className="w-5 h-5" />}
                label="Marca con Mayor Despliegue"
                value={topBrand?.label ?? 'N/A'}
                detail={topBrand ? `${topBrand.sold} instalados · ${topBrand.stock} en bodega` : 'Sin datos'}
                tone="cyan"
              />
            </div>

            {/* Tabla con Acordeón y Buscador */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#162032] shadow-sm overflow-hidden">
              {/* Barra superior de herramientas de la tabla */}
              <div className="p-4 sm:p-5 bg-white dark:bg-[#162032] border-b border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#00A3E0]/10 text-[#00A3E0] border border-[#00A3E0]/20 shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                      Desglose de Hardware por Marca y Modelo
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Haz clic en cualquier marca para expandir o contraer sus modelos
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Buscador Rápido */}
                  <div className="relative min-w-[220px] sm:min-w-[260px] flex-1 sm:flex-initial">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Buscar marca o modelo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-[#0B111E] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00A3E0] transition-colors"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Botones de Expandir / Contraer Todo */}
                  <div className="inline-flex rounded-xl border border-slate-200 dark:border-white/10 p-0.5 bg-slate-50 dark:bg-[#0B111E]">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#00A3E0] dark:hover:text-white transition-colors cursor-pointer"
                      title="Expandir todas las marcas"
                    >
                      Expandir
                    </button>
                    <span className="w-px bg-slate-200 dark:bg-white/10 my-1" />
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#00A3E0] dark:hover:text-white transition-colors cursor-pointer"
                      title="Contraer todas las marcas"
                    >
                      Contraer
                    </button>
                  </div>
                </div>
              </div>

              {/* Contenido de la Tabla */}
              {filteredBrandGroups.length === 0 ? (
                <div className="p-8 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  No se encontraron marcas o modelos que coincidan con &quot;<span className="font-bold text-slate-800 dark:text-slate-200">{searchTerm}</span>&quot;.
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[700px] text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121927] text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="px-4 py-3.5 w-12 text-center">#</th>
                        <th className="px-4 py-3.5">Marca / Modelo</th>
                        <th className="px-4 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Instalados
                          </span>
                        </th>
                        <th className="px-4 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            En Bodega
                          </span>
                        </th>
                        <th className="px-4 py-3.5 text-right font-black">Total</th>
                        <th className="px-4 py-3.5 w-52 text-center">% Ocupación Flota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredBrandGroups.map((brand, index) => (
                        <BrandAccordionGroup
                          key={brand.label}
                          brand={brand}
                          rank={index + 1}
                          isExpanded={isBrandExpanded(brand.label)}
                          onToggle={() => toggleBrand(brand.label)}
                        />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121927] font-black text-slate-900 dark:text-white">
                        <td className="px-4 py-4 text-center font-mono font-bold text-slate-400">∑</td>
                        <td className="px-4 py-4 uppercase text-xs tracking-wider">
                          Total General ({filteredBrandGroups.length} {filteredBrandGroups.length === 1 ? 'marca' : 'marcas'})
                        </td>
                        <td className="px-4 py-4 text-right text-emerald-600 dark:text-emerald-400 font-black text-sm sm:text-base">
                          {totals.sold}
                        </td>
                        <td className="px-4 py-4 text-right text-amber-600 dark:text-amber-400 font-black text-sm sm:text-base">
                          {totals.stock}
                        </td>
                        <td className="px-4 py-4 text-right font-black text-sm sm:text-base">{totals.total}</td>
                        <td className="px-4 py-4">
                          <SoldBar sold={totals.sold} total={totals.total} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function BrandAccordionGroup({
  brand,
  rank,
  isExpanded,
  onToggle,
}: {
  brand: BrandGroup;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const modelCount = brand.models.length;

  return (
    <>
      {/* Fila Principal de la Marca (Clickable) */}
      <tr
        onClick={onToggle}
        className="bg-white dark:bg-[#162032] hover:bg-slate-50/80 dark:hover:bg-[#1E293B]/70 transition-colors cursor-pointer group/brand select-none"
      >
        <td className="px-4 py-3.5 text-center font-mono font-bold text-[#00A3E0]">{rank}</td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 group-hover/brand:text-[#00A3E0] transition-colors"
              aria-label={isExpanded ? 'Contraer' : 'Expandir'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-[#00A3E0]" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            <span className="font-black text-slate-900 dark:text-white text-sm sm:text-base tracking-tight">
              {brand.label}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
              {modelCount} {modelCount === 1 ? 'modelo' : 'modelos'}
            </span>
          </div>
        </td>
        <td className="px-4 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">{brand.sold}</td>
        <td className="px-4 py-3.5 text-right font-black text-amber-600 dark:text-amber-400">{brand.stock}</td>
        <td className="px-4 py-3.5 text-right font-black text-slate-800 dark:text-slate-200">{brand.total}</td>
        <td className="px-4 py-3.5">
          <SoldBar sold={brand.sold} total={brand.total} />
        </td>
      </tr>

      {/* Filas Anidadas de Modelos (Visibles si está expandido) */}
      {isExpanded &&
        brand.models.map((model) => (
          <tr
            key={model.label}
            className="bg-slate-50/60 dark:bg-[#0F1726]/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-[#1E293B]/50 transition-colors border-t border-slate-100 dark:border-white/5"
          >
            <td className="px-4 py-2.5" />
            <td className="px-4 py-2.5 pl-11">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">↳</span>
                <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                  {model.label}
                </span>
              </div>
            </td>
            <td className="px-4 py-2.5 text-right font-semibold text-emerald-600/90 dark:text-emerald-400/90">
              {model.sold}
            </td>
            <td className="px-4 py-2.5 text-right font-semibold text-amber-600/90 dark:text-amber-400/90">
              {model.stock}
            </td>
            <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">
              {model.total}
            </td>
            <td className="px-4 py-2.5">
              <SoldBar sold={model.sold} total={model.total} size="sm" />
            </td>
          </tr>
        ))}
    </>
  );
}

function SoldBar({ sold, total, size = 'md' }: { sold: number; total: number; size?: 'sm' | 'md' }) {
  const pct = percent(sold, total);
  const isSm = size === 'sm';

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex-1 bg-slate-200/70 dark:bg-white/10 rounded-full overflow-hidden ${
          isSm ? 'h-2' : 'h-2.5'
        }`}
      >
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-[#00A3E0] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`font-mono font-bold w-10 text-right ${
          isSm ? 'text-[11px] text-slate-500 dark:text-slate-400' : 'text-xs text-slate-700 dark:text-slate-200'
        }`}
      >
        {pct}%
      </span>
    </div>
  );
}

const TONES = {
  slate: 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  cyan: 'bg-[#00A3E0]/10 text-[#00A3E0] border-[#00A3E0]/20',
} as const;

function SummaryCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  detail?: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#162032] p-5 sm:p-6 shadow-sm hover:border-[#00A3E0]/30 transition-all">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl border shrink-0 ${TONES[tone]}`}>{icon}</div>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate tracking-tight">
        {value}
      </span>
      {detail && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{detail}</span>}
    </div>
  );
}
