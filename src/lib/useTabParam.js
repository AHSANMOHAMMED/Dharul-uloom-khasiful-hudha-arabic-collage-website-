import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keep a dashboard's active tab in the URL (?tab=<id>) so refreshes, the
 * browser back button and deep links (e.g. from notifications) land on the
 * same panel. Unknown ids fall back to `fallback`.
 */
export function useTabParam(validIds, fallback, key = 'tab') {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const active = raw && validIds.includes(raw) ? raw : fallback;

  const setActive = useCallback(
    (id) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id === fallback) next.delete(key);
          else next.set(key, id);
          return next;
        },
        { replace: false }
      );
    },
    [setParams, fallback, key]
  );

  return [active, setActive];
}

/** Only allow same-origin, in-app redirect targets (blocks //evil.com and URLs). */
export function safeRedirectPath(path) {
  if (typeof path !== 'string') return null;
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  if (path.startsWith('/login') || path.startsWith('/register')) return null;
  return path;
}
