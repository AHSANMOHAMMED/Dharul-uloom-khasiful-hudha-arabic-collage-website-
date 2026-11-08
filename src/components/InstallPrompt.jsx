import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tx } from '../lib/tx';

const InstallPrompt = () => {
  useTranslation(); // re-render on language change
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred || dismissed) return null;

  const install = async () => {
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="fixed bottom-5 left-4 right-4 md:left-auto md:right-5 md:max-w-sm z-50 bg-[#0B3B2E] text-white p-5 rounded-2xl shadow-xl border border-[#E8E1D0]/20 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-[#C29A3A] stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h4 className="text-xs font-serif font-bold text-white">
            {tx('تثبيت تطبيق الكلية على جهازك', 'Install Kashiful Hudha PWA')}
          </h4>
          <p className="text-[11px] text-[#A3B8B0]">
            {tx('وصول فوري للدروس والمكتبة دون اتصال', 'Instant offline access to library & student portal')}
          </p>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={install}
          className="flex-1 py-2 bg-[#C29A3A] hover:bg-[#A8822B] text-[#0B3B2E] rounded-xl text-xs font-bold transition shadow-xs"
        >
          {tx('تثبيت التطبيق', 'Install App')}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium transition"
        >
          {tx('لاحقاً', 'Later')}
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
