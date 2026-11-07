import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { tx } from '../lib/tx';

/**
 * OfflineIndicator — shows a sticky banner when the user loses network connectivity.
 * Listens to the native online/offline browser events.
 */
const OfflineIndicator = () => {
  useTranslation(); // subscribe: re-render on language change
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
          <span>{tx('عاد الاتصال! ستتم مزامنة التغييرات تلقائياً.', 'Back online! Changes will sync automatically.')}</span>
        </>
      ) : (
        <>
          <span className="text-lg">📵</span>
          <div>
            <span className="block">{tx('أنت غير متصل بالإنترنت.', 'You are offline.')}</span>
            <span className="block text-xs font-normal text-red-300 mt-0.5">
              {tx('قد تكون بعض الميزات غير متاحة. لا يزال المحتوى المخزّن متاحاً.', 'Some features may be unavailable. Cached content is still accessible.')}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
