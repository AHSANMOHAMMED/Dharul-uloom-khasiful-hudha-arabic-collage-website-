import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { verifySignInCode } from '../../lib/mfaApi';
import { tx } from '../../lib/tx';
import CodeInput from './CodeInput';

/** Second sign-in step: the 6-digit code from the user's authenticator app. */
export default function MfaChallenge({ onVerified, onCancel }) {
  useTranslation();
  const { refreshUser, logout } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(tx('أدخل الرمز المكوّن من 6 أرقام', 'Enter the 6-digit code'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verifySignInCode(code);
      await refreshUser();
      onVerified?.();
    } catch {
      setCode('');
      setError(tx('الرمز غير صحيح أو منتهي الصلاحية. حاول مرة أخرى.', 'That code is incorrect or expired. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await logout();
    onCancel?.();
  };

  return (
    <form onSubmit={submit} className="space-y-5" aria-labelledby="mfa-challenge-title">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[28px] text-emerald-700" aria-hidden>{'shield_lock'}</span>
        <div>
          <h2 id="mfa-challenge-title" className="font-serif text-xl font-semibold text-ink-green-900">
            {tx('التحقق بخطوتين', 'Two-step verification')}
          </h2>
          <p className="text-sm text-ink-text-secondary mt-1">
            {tx('افتح تطبيق المصادقة على هاتفك وأدخل الرمز المعروض.', 'Open the authenticator app on your phone and enter the code it shows.')}
          </p>
        </div>
      </div>

      <CodeInput value={code} onChange={setCode} autoFocus disabled={busy} />

      {error && (
        <p role="alert" className="text-sm text-feedback-danger bg-red-50 border border-red-200 rounded-[10px] px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full h-11 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-50"
      >
        {busy ? tx('جارٍ التحقق…', 'Verifying…') : tx('تحقق', 'Verify')}
      </button>
      <button type="button" onClick={cancel} className="w-full text-xs text-ink-text-muted hover:text-feedback-danger underline">
        {tx('تسجيل الخروج واستخدام حساب آخر', 'Sign out and use another account')}
      </button>
      <p className="text-[11px] text-ink-text-muted leading-relaxed">
        {tx(
          'فقدت هاتفك؟ اطلب من مسؤول النظام إعادة تعيين التحقق بخطوتين لحسابك.',
          'Lost your phone? Ask the system administrator to reset two-step verification for your account.'
        )}
      </p>
    </form>
  );
}
