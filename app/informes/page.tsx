'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
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
  PackageCheck,
  Package,
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

// Un equipo cuenta como "vendido" cuando está instalado (asignado a empresa/vehículo)
const isSold = (d: DeviceRecord) => Number(d.install) === 1;

const byMostSold = (a: StockGroup, b: StockGroup) =>
  b.sold - a.sold || b.total - a.total || a.label.localeCompare(b.label);

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export default function InformesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('Usuario Vtraxx');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

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
  const brandGroups = useMemo<BrandGroup[]>(() => {
    const brands = new Map<string, { group: BrandGroup; models: Map<string, StockGroup> }>();

    devices.forEach((d) => {
      const brand = String(d.brand ?? '').trim() || 'Sin marca';
      const model = String(d.model ?? '').trim() || 'Sin modelo';
      const sold = isSold(d);

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
        if (sold) g.sold += 1;
        else g.stock += 1;
      }
    });

    return Array.from(brands.values())
      .map(({ group, models }) => ({ ...group, models: Array.from(models.values()).sort(byMostSold) }))
      .sort(byMostSold);
  }, [devices]);

  const totals = useMemo(() => {
    const sold = devices.filter(isSold).length;
    return { total: devices.length, sold, stock: devices.length - sold };
  }, [devices]);

  const topBrand = brandGroups[0] && brandGroups[0].sold > 0 ? brandGroups[0] : null;

  if (!isAuthorized) {
    return <Preloader fullScreen message={t('cargando_informacion') || 'Cargando...'} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0d1117] flex flex-col font-sans w-full max-w-full overflow-x-hidden">
      <Navbar userName={username} onLogout={handleLogout} />

      <main className="w-full max-w-full min-w-0 space-y-6 sm:space-y-8 px-3 sm:px-6 lg:px-10 py-4 sm:py-8 flex-1">

        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#161B22] p-4 sm:p-6 rounded-2xl border border-[#e8e9ed] dark:border-[#30363d] shadow-xs">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00acee]/10 dark:bg-[#00acee]/20 text-[#00acee] shrink-0">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#3a435d] dark:text-white tracking-tight">
                {t('modulo_informes')}
              </h1>
              <p className="text-sm text-[#5c647b] dark:text-gray-400">
                {t('descripcion_informes')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchData()}
            className="self-start md:self-auto p-3 rounded-xl border border-[#e8e9ed] dark:border-[#30363d] text-[#5c647b] dark:text-gray-300 hover:text-[#3a435d] dark:hover:text-white hover:bg-[#f8f9fc] dark:hover:bg-[#21262d] transition-all cursor-pointer shadow-2xs"
            title={t('actualizar')}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-[#00acee]' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="w-full min-h-[40vh] flex flex-col items-center justify-center rounded-2xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#161B22] p-12 shadow-xs">
            <RefreshCw className="w-8 h-8 text-[#00acee] animate-spin mb-3" />
            <span className="text-sm font-medium text-[#5c647b] dark:text-gray-400">Procesando inventario de equipos...</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="w-full p-12 text-center bg-white dark:bg-[#161B22] rounded-2xl border border-[#e8e9ed] dark:border-[#30363d] text-sm text-[#5c647b] dark:text-gray-400 space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-[#3a435d] dark:text-white">No hay equipos registrados.</p>
            <p className="text-xs">Agrega dispositivos en el módulo de Dispositivos para ver el informe.</p>
          </div>
        ) : (
          <>
            {/* Resumen general */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
              <SummaryCard
                icon={<HardDrive className="w-5 h-5" />}
                label="Total de equipos"
                value={totals.total}
                tone="slate"
              />
              <SummaryCard
                icon={<PackageCheck className="w-5 h-5" />}
                label="Vendidos (instalados)"
                value={totals.sold}
                detail={`${percent(totals.sold, totals.total)}% del total`}
                tone="emerald"
              />
              <SummaryCard
                icon={<Package className="w-5 h-5" />}
                label="En stock"
                value={totals.stock}
                detail={`${percent(totals.stock, totals.total)}% del total`}
                tone="amber"
              />
              <SummaryCard
                icon={<Award className="w-5 h-5" />}
                label="Marca más vendida"
                value={topBrand?.label ?? 'N/A'}
                detail={topBrand ? `${topBrand.sold} vendidos · ${topBrand.stock} en stock` : 'Sin ventas registradas'}
                tone="purple"
              />
            </div>

            {/* Tabla agrupada por marca y modelo */}
            <div className="rounded-2xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#161B22] shadow-xs overflow-hidden">
              <div className="px-6 py-4 bg-[#3a435d] dark:bg-[#21262d] text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Layers className="w-5 h-5 text-[#00acee]" />
                  <h3 className="text-xs sm:text-sm font-bold tracking-wide uppercase">
                    Equipos más vendidos por marca
                  </h3>
                </div>
                <span className="text-xs font-semibold text-gray-300 dark:text-gray-400">
                  {brandGroups.length} {brandGroups.length === 1 ? 'marca' : 'marcas'}
                </span>
              </div>

              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[640px] text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#161B22] text-xs font-bold text-[#5c647b] dark:text-gray-400 uppercase">
                      <th className="px-4 py-3 w-12">#</th>
                      <th className="px-4 py-3">Marca / Modelo</th>
                      <th className="px-4 py-3 text-right">Vendidos</th>
                      <th className="px-4 py-3 text-right">En stock</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 w-48">Vendido</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#3a435d] dark:text-gray-200">
                    {brandGroups.map((brand, index) => (
                      <BrandRows key={brand.label} brand={brand} rank={index + 1} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#e8e9ed] dark:border-[#30363d] bg-[#f8f9fc] dark:bg-[#21262d]/50 font-extrabold">
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 uppercase text-xs tracking-wider">Total</td>
                      <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">{totals.sold}</td>
                      <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">{totals.stock}</td>
                      <td className="px-4 py-3 text-right">{totals.total}</td>
                      <td className="px-4 py-3"><SoldBar sold={totals.sold} total={totals.total} /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}

function BrandRows({ brand, rank }: { brand: BrandGroup; rank: number }) {
  return (
    <>
      <tr className="border-t border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#161B22]">
        <td className="px-4 py-3 font-mono font-bold text-[#00acee]">{rank}</td>
        <td className="px-4 py-3 font-extrabold text-[#3a435d] dark:text-white">{brand.label}</td>
        <td className="px-4 py-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400">{brand.sold}</td>
        <td className="px-4 py-3 text-right font-extrabold text-amber-700 dark:text-amber-400">{brand.stock}</td>
        <td className="px-4 py-3 text-right font-extrabold">{brand.total}</td>
        <td className="px-4 py-3"><SoldBar sold={brand.sold} total={brand.total} /></td>
      </tr>
      {brand.models.length > 1 && brand.models.map((model) => (
        <tr key={model.label} className="text-[#5c647b] dark:text-gray-400">
          <td className="px-4 py-2" />
          <td className="px-4 py-2 pl-8 font-medium">↳ {model.label}</td>
          <td className="px-4 py-2 text-right">{model.sold}</td>
          <td className="px-4 py-2 text-right">{model.stock}</td>
          <td className="px-4 py-2 text-right">{model.total}</td>
          <td className="px-4 py-2" />
        </tr>
      ))}
      {brand.models.length === 1 && (
        <tr className="text-[#5c647b] dark:text-gray-400">
          <td className="px-4 pb-2" />
          <td className="px-4 pb-2 pl-8 text-xs font-medium" colSpan={5}>↳ {brand.models[0].label}</td>
        </tr>
      )}
    </>
  );
}

function SoldBar({ sold, total }: { sold: number; total: number }) {
  const pct = percent(sold, total);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-amber-100 dark:bg-amber-950/40 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-9 text-right">{pct}%</span>
    </div>
  );
}

const TONES = {
  slate: 'bg-[#f8f9fc] dark:bg-[#21262d] text-[#3a435d] dark:text-white border-[#e8e9ed] dark:border-[#30363d]',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
  amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  purple: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
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
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e8e9ed] dark:border-[#30363d] bg-white dark:bg-[#161B22] p-5 shadow-xs">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl border shrink-0 ${TONES[tone]}`}>{icon}</div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#5c647b] dark:text-gray-400">{label}</span>
      </div>
      <span className="text-2xl sm:text-3xl font-black text-[#3a435d] dark:text-white truncate">{value}</span>
      {detail && <span className="text-xs font-semibold text-[#5c647b] dark:text-gray-400">{detail}</span>}
    </div>
  );
}
