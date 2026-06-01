import { useState, useEffect } from 'react';

/**
 * OfflineIndicator — shows a sticky banner when the user loses network connectivity.
 * Listens to the native online/offline browser events.
 */
const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowRestored(true);
        // Hide the "Back Online" toast after 3 seconds
        setTimeout(() => setShowRestored(false), 3000);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (isOnline && !showRestored) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold border transition-all duration-300 ${
        isOnline
          ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-200'
          : 'bg-red-950/90 border-red-500/40 text-red-200'
      } backdrop-blur-md`}
    >
      {isOnline ? (
        <>
          <span className="text-lg animate-bounce">📶</span>
          <span>Back online! Changes will sync automatically.</span>
        </>
      ) : (
        <>
          <span className="text-lg">📵</span>
          <div>
            <span className="block">You are offline.</span>
            <span className="block text-xs font-normal text-red-300 mt-0.5">
              Some features may be unavailable. Cached content is still accessible.
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
