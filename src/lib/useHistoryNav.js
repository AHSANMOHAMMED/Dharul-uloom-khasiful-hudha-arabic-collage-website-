import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

/**
 * In-app Back / Forward that mirror the browser buttons.
 *
 * React Router stores the position in the session history as window.history.state.idx.
 * We remember the furthest position reached (persisted in sessionStorage) so the
 * Forward button can be enabled whenever the user navigated backwards, even across
 * chunk loads and page reloads.
 */
const STORAGE_KEY = 'kh_history_max_idx';

const getStoredMaxIdx = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const val = sessionStorage.getItem(STORAGE_KEY);
    return val !== null && !isNaN(Number(val)) ? Number(val) : 0;
  } catch {
    return 0;
  }
};

const setStoredMaxIdx = (val) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(val));
  } catch {
    // ignore quota/storage restrictions
  }
};

const currentIdx = () =>
  typeof window !== 'undefined' && window.history?.state && Number.isInteger(window.history.state.idx)
    ? window.history.state.idx
    : 0;

export function useHistoryNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const type = useNavigationType();
  const [idx, setIdx] = useState(currentIdx);
  const [maxIdx, setMaxIdx] = useState(getStoredMaxIdx);

  useEffect(() => {
    const i = currentIdx();
    let nextMax = getStoredMaxIdx();
    if (type === 'PUSH') {
      nextMax = i;
    } else {
      nextMax = Math.max(nextMax, i);
    }
    setStoredMaxIdx(nextMax);
    setMaxIdx(nextMax);
    setIdx(i);
  }, [location.key, location.search, type]);

  const back = useCallback(() => {
    if (idx > 0) {
      navigate(-1);
    }
  }, [navigate, idx]);

  const forward = useCallback(() => {
    if (idx < maxIdx) {
      navigate(1);
    }
  }, [navigate, idx, maxIdx]);

  const canBack = idx > 0;
  const canForward = idx < maxIdx;

  return { canBack, canForward, back, forward };
}

/** The landing page of the signed-in user's own portal. */
export function portalHomeFor(auth) {
  if (auth?.isSuperAdmin) return '/platform';
  if (auth?.isAdmin) return '/admin';
  return '/dashboard';
}
