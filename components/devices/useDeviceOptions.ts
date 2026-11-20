'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface DeviceOptions {
  brands: string[];
  models: { brand: string; model: string }[];
}

const UNASSIGNED = 'Sin Asignar';

/**
 * Marcas y modelos registrados (desde /api/local-device-options) para los comboboxes,
 * incluyendo siempre "Sin Asignar" al inicio de cada lista.
 * Se recarga cuando el modal se abre o cuando se emite el evento 'device-options-updated'.
 */
export function useDeviceOptions(isOpen = true) {
  const [options, setOptions] = useState<DeviceOptions>({ brands: [], models: [] });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/local-device-options?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setOptions({
          brands: Array.isArray(data.brands) ? data.brands : [],
          models: Array.isArray(data.models) ? data.models : [],
        });
      }
    } catch (err) {
      console.warn('Error cargando marcas y modelos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchOptions();

    const handleUpdate = () => {
      fetchOptions();
    };

    window.addEventListener('device-options-updated', handleUpdate);
    return () => {
      window.removeEventListener('device-options-updated', handleUpdate);
    };
  }, [isOpen, fetchOptions]);

  const brands = useMemo(() => {
    const list = options.brands.filter(
      (b) => b && b.trim().toLowerCase() !== 'sin asignar'
    );
    return [UNASSIGNED, ...list];
  }, [options.brands]);

  // Modelos de la marca indicada (siempre incluye "Sin Asignar" al inicio)
  const modelsForBrand = useCallback(
    (brand: string) => {
      const b = brand.trim().toLowerCase();
      if (!b || b === 'sin asignar') {
        return [UNASSIGNED];
      }
      const list = options.models
        .filter((m) => !m.brand || m.brand.toLowerCase() === b)
        .map((m) => m.model)
        .filter((m) => m && m.trim().toLowerCase() !== 'sin asignar');
      const unique = Array.from(new Set(list));
      return [UNASSIGNED, ...unique];
    },
    [options.models]
  );

  return {
    brands,
    modelsForBrand,
    rawOptions: options,
    reloadOptions: fetchOptions,
    loading,
  };
}
