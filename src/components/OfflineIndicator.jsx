import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { tx } from '../lib/tx';

/**
 * OfflineIndicator — shows a sticky notification when network connectivity is lost/restored.
 */
const OfflineIndicator = () => {
  useTranslation(); // re-render on language change
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowRestored(true);
        setTimeout(() => setShowRestored(false), 3500);
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
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg text-xs font-semibold border transition-all duration-300 ${
        isOnline
          ? 'bg-white border-[#11694A] text-[#11694A]'
          : 'bg-white border-[#B91C1C] text-[#B91C1C]'
      }`}
    >
      {isOnline ? (
        <>
          <div className="w-6 h-6 rounded-full bg-[#E3F1EA] flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="font-sans">{tx('عاد الاتصال! ستتم مزامنة التغييرات تلقائياً.', 'Connection restored. Changes will sync automatically.')}</span>
        </>
      ) : (
        <>
          <div className="w-6 h-6 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <span className="block font-bold">{tx('أنت غير متصل بالإنترنت حالياً.', 'You are currently offline.')}</span>
            <span className="block text-[11px] font-normal text-[#4A5E56] mt-0.5">
              {tx('تبقى الصفحات والكتب المخزّنة متاحة من التخزين دون اتصال.', 'Cached pages and books remain accessible from offline storage.')}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
