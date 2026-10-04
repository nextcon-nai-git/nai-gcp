import { useEffect, useState } from "react";

/**
 * Hook para debouncing de valores.
 * Atrasa a atualização do valor até que deixe de mudar por `delay` ms.
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para debouncing de callbacks/funções.
 * Atrasa a execução até que deixe de ser chamada por `delay` ms.
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);
    setTimeoutId(newTimeoutId);
  };
}
