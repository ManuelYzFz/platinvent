import { useState, useEffect } from 'react';

/**
 * Retrasa la actualizacion de un valor hasta que el usuario deja de escribir.
 * Util para campos de busqueda en movil donde cada keystroke es costoso.
 *
 * @param value - El valor a debouncear
 * @param delayMs - Milisegundos de espera tras el ultimo cambio (default 250ms)
 */
export function useDebounce<T>(value: T, delayMs: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
