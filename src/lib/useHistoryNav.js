import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

/**
 * In-app Back / Forward that mirror the browser buttons.
 *
 * React Router stores the position in the session history as
 * window.history.state.idx. We remember the furthest position reached so the
 * Forward button can be enabled only when there is somewhere to go; a new
 * navigation (PUSH) discards the forward entries, exactly like the browser.
 */
let maxIdx = 0;
const currentIdx = () => (typeof window !== 'undefined' && window.history.state && Number.isInteger(window.history.state.idx) ? window.history.state.idx : 0);

export function useHistoryNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const type = useNavigationType();
  const [idx, setIdx] = useState(currentIdx);

  useEffect(() => {
    const i = currentIdx();
    if (type === 'PUSH') maxIdx = i;
    else maxIdx = Math.max(maxIdx, i);
    setIdx(i);
  }, [location.key, type]);

  const back = useCallback(() => navigate(-1), [navigate]);
  const forward = useCallback(() => navigate(1), [navigate]);
  return { canBack: idx > 0, canForward: idx < maxIdx, back, forward };
}

/** The landing page of the signed-in user's own portal. */
export function portalHomeFor(auth) {
  if (auth?.isSuperAdmin) return '/platform';
  if (auth?.isAdmin) return '/admin';
  return '/dashboard';
}
