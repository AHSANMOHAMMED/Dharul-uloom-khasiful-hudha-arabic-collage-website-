import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Runs an async loader, tracks loading / refreshing / error, and reloads when
 * the screen regains focus (e.g. after returning from PayHere).
 */
export function useAsync(loader, deps = [], { reloadOnFocus = true, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const firstFocus = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(
    async (mode = 'load') => {
      if (!enabled) return;
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'load') setLoading(true);
      try {
        const result = await loaderRef.current();
        if (mounted.current) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (mounted.current) setError(e?.message || String(e));
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, ...deps],
  );

  useEffect(() => {
    mounted.current = true;
    run('load');
    return () => {
      mounted.current = false;
    };
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (reloadOnFocus) run('silent');
    }, [run, reloadOnFocus]),
  );

  return {
    data,
    setData,
    error,
    loading,
    refreshing,
    refresh: () => run('refresh'),
    reload: () => run('silent'),
  };
}
