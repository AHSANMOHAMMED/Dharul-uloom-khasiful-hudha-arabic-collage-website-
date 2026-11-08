import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { startTotpEnrollment, verifyTotp } from '../../lib/mfaApi';
import { tx } from '../../lib/tx';
import CodeInput from './CodeInput';

/** Set up an authenticator app: scan QR (or type the key), confirm one code. */
export default function MfaEnroll({ onDone, onCancel }) {
  useTranslation();
  const { refreshUser } = useAuth();
  const [factor, setFactor] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    let live = true;
    startTotpEnrollment()
      .then((f) => live && setFactor(f))
      .catch((e) => live && setError(e.message || tx('تعذر بدء الإعداد', 'Could not start setup')));
    return () => {
      live = false;
    };
  }, []);

  const confirm = async (e) => {
    e?.preventDefault();
    if (!factor) return;
    setBusy(true);
    setError('');
    try {
      await verifyTotp(factor.id, code);
      await refreshUser();
      onDone?.();
    } catch {
      setCode('');
      setError(tx('الرمز غير صحيح. تأكد من ضبط وقت الهاتف تلقائياً ثم حاول مجدداً.', 'Incorrect code. Make sure your phone clock is set automatically, then try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={confirm} className="space-y-5">
      <ol className="space-y-4 text-sm text-ink-text-primary">
        <li className="flex gap-3">
          <Step n={1} />
          <span>
            {tx(
              'ثبّت تطبيق مصادقة مثل Google Authenticator أو Microsoft Authenticator على هاتفك.',
              'Install an authenticator app such as Google Authenticator or Microsoft Authenticator on your phone.'
            )}
          </span>
        </li>
        <li className="flex gap-3">
          <Step n={2} />
          <div className="flex-1 space-y-3">
            <span>{tx('امسح رمز QR بالتطبيق.', 'Scan this QR code with the app.')}</span>
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-[12px] border border-sand-border bg-white p-2 flex items-center justify-center">
                {factor ? (
                  <img src={factor.qrCode} alt={tx('رمز QR للتحقق بخطوتين', 'Two-step verification QR code')} className="w-full h-full" />
                ) : (
                  !error && <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </div>
            {factor && (
              <div className="text-xs">
                <button type="button" className="text-emerald-700 font-semibold underline" onClick={() => setShowKey((v) => !v)}>
                  {tx('لا يمكنك المسح؟ أدخل المفتاح يدوياً', "Can't scan? Enter the key manually")}
                </button>
                {showKey && (
                  <code dir="ltr" className="mt-2 block break-all rounded-lg bg-parchment-50 border border-sand-border px-3 py-2 font-mono text-[13px] tracking-wider select-all">
                    {factor.secret}
                  </code>
                )}
              </div>
            )}
          </div>
        </li>
        <li className="flex gap-3">
          <Step n={3} />
          <div className="flex-1">
            <span className="block mb-2">{tx('أدخل الرمز المكوّن من 6 أرقام الذي يظهر في التطبيق.', 'Enter the 6-digit code the app shows.')}</span>
            <CodeInput id="enroll-code" value={code} onChange={setCode} disabled={!factor || busy} />
          </div>
        </li>
      </ol>

      {error && (
        <p role="alert" className="text-sm text-feedback-danger bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 h-11 rounded-[10px] border border-sand-border text-sm font-semibold text-ink-text-primary hover:bg-parchment-50">
            {tx('إلغاء', 'Cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={!factor || busy || code.length !== 6}
          className="flex-1 h-11 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50"
        >
          {busy ? tx('جارٍ التحقق…', 'Verifying…') : tx('تفعيل التحقق بخطوتين', 'Turn on two-step verification')}
        </button>
      </div>
    </form>
  );
}

function Step({ n }) {
  return (
    <span className="shrink-0 w-6 h-6 rounded-full bg-mint-wash-100 text-emerald-700 border border-emerald-700/20 text-xs font-bold flex items-center justify-center">
      {n}
    </span>
  );
}
