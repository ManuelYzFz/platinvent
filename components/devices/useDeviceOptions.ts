'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface DeviceOptions {
  brands: string[];
  models: { brand: string; model: string }[];
}

const UNASSIGNED = 'Sin Asignar';

/**
 * Marcas y modelos ya registrados (desde /api/local-device-options) para los comboboxes,
 * incluyendo siempre "Sin Asignar" al inicio de cada lista.
 * Se recarga cada vez que el modal se abre.
 */
export function useDeviceOptions(isOpen: boolean) {
  const [options, setOptions] = useState<DeviceOptions>({ brands: [], models: [] });

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    fetch(`/api/local-device-options?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore || !data) return;
        setOptions({
          brands: Array.isArray(data.brands) ? data.brands : [],
          models: Array.isArray(data.models) ? data.models : [],
        });
      })
      .catch((err) => console.warn('Error cargando marcas y modelos:', err));
    return () => {
      ignore = true;
    };
  }, [isOpen]);

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

  return { brands, modelsForBrand };
}
