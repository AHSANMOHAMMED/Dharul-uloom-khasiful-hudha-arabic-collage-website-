import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchMyFeatures, isFeatureOn } from '../lib/platformApi';

const FeatureFlagsContext = createContext({
  features: {},
  // Default off so unit tests / pages without a provider still render (all features on).
  loading: false,
  enabled: () => true,
  refreshFeatures: async () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export function useFeatures() {
  return useContext(FeatureFlagsContext);
}

export function FeatureFlagsProvider({ children }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(true);

  const refreshFeatures = useCallback(async () => {
    if (!isAuthenticated) {
      setFeatures({});
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMyFeatures();
      setFeatures(data && typeof data === 'object' ? data : {});
    } catch {
      setFeatures({});
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    refreshFeatures();
  }, [authLoading, refreshFeatures, user?.id, user?.orgId]);

  const enabled = useCallback((key) => isFeatureOn(features, key), [features]);

  const value = useMemo(
    () => ({ features, loading, enabled, refreshFeatures }),
    [features, loading, enabled, refreshFeatures]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}
