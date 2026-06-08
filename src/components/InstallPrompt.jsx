import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const InstallPrompt = () => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
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
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-islamic-green text-white p-4 rounded-xl shadow-2xl flex flex-col gap-3">
      <p className="text-sm font-semibold">
        {ar ? 'ثبّت تطبيق الكلية على جهازك' : 'Install the college app on your device'}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={install} className="flex-1 py-2 bg-white text-islamic-green rounded-lg text-sm font-bold">
          {ar ? 'تثبيت' : 'Install'}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="px-4 py-2 bg-emerald-800 rounded-lg text-sm">
          {ar ? 'لاحقاً' : 'Later'}
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
