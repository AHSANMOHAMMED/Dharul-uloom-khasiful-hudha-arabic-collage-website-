import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { getOrgSecurity, listTotpFactors, removeFactor, setOrgRequiresMfa } from '../lib/mfaApi';
import MfaEnroll from '../components/security/MfaEnroll';
import KhatamPattern from '../components/KhatamPattern';
import { tx } from '../lib/tx';

/** /account/security — manage two-step verification (and the org policy for admins). */
export default function AccountSecurity() {
  useTranslation();
  const { user, loading, isAdmin, mfa, refreshUser } = useAuth();
  const [factors, setFactors] = useState([]);
  const [enrolling, setEnrolling] = useState(false);
  const [org, setOrg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setFactors((await listTotpFactors()).filter((f) => f.status === 'verified'));
    } catch (e) {
      toast.error(e.message);
    }
    if (isAdmin && user.orgId) {
      try {
        setOrg(await getOrgSecurity(user.orgId));
      } catch {
        setOrg(null);
      }
    }
  }, [user, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="min-h-[60vh]" />;
  if (!user) return <Navigate to="/login" replace state={{ from: '/account/security' }} />;

  const isAal2 = mfa.currentLevel === 'aal2';

  const remove = async (f) => {
    if (!isAal2) {
      toast.warn(tx('سجّل الدخول باستخدام رمز التحقق أولاً لإزالة جهاز.', 'Sign in with a verification code first to remove a device.'));
      return;
    }
    if (mfa.required && factors.length <= 1) {
      toast.warn(tx('دورك يتطلب التحقق بخطوتين. أضف جهازاً آخر قبل إزالة هذا الجهاز.', 'Your role requires two-step verification. Add another device before removing this one.'));
      return;
    }
    if (!window.confirm(tx('إزالة هذا الجهاز من التحقق بخطوتين؟', 'Remove this device from two-step verification?'))) return;
    setBusy(true);
    try {
      await removeFactor(f.id);
      await refreshUser();
      await load();
      toast.success(tx('تمت إزالة الجهاز', 'Device removed'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleOrg = async () => {
    if (!org) return;
    const next = !org.require_mfa_for_staff;
    if (next && !isAal2) {
      toast.warn(tx('فعّل التحقق بخطوتين لحسابك وسجّل الدخول به أولاً.', 'Turn on two-step verification for your own account and sign in with it first.'));
      return;
    }
    setBusy(true);
    try {
      await setOrgRequiresMfa(org.id, next);
      setOrg({ ...org, require_mfa_for_staff: next });
      toast.success(next ? tx('أصبح التحقق بخطوتين إلزامياً للموظفين', 'Two-step verification is now required for staff') : tx('أصبح التحقق بخطوتين اختيارياً', 'Two-step verification is now optional'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment-50 relative overflow-hidden py-8 sm:py-12">
      <KhatamPattern className="opacity-[0.04]" strokeColor="#0B3B2E" id="security-khatam" />
      <div className="relative z-10 max-w-2xl mx-auto px-4 space-y-6">
        <header>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">{tx('الحساب', 'Account')}</span>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">{tx('الأمان وتسجيل الدخول', 'Security & sign-in')}</h1>
          <p className="text-sm text-ink-text-secondary mt-1">{user.email}</p>
        </header>

        <section className="rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript-sm p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-lg font-semibold text-ink-green-900">{tx('التحقق بخطوتين', 'Two-step verification')}</h2>
              <p className="text-sm text-ink-text-secondary mt-1">
                {tx(
                  'بعد كلمة المرور، اطلب رمزاً من تطبيق على هاتفك. يمنع ذلك أي شخص يعرف كلمة مرورك من الدخول.',
                  'After your password, ask for a code from an app on your phone. Someone who learns your password still cannot sign in.'
                )}
              </p>
            </div>
            <StatusPill on={factors.length > 0} />
          </div>

          {mfa.required && factors.length === 0 && (
            <p className="text-sm rounded-[10px] bg-gold-wash-100 border border-brass-gold-500/30 text-ink-green-900 px-3 py-2">
              {tx('دورك في الكلية يتطلب التحقق بخطوتين.', 'Your role at the college requires two-step verification.')}
            </p>
          )}

          {factors.length > 0 && (
            <ul className="divide-y divide-sand-border border border-sand-border rounded-[12px]">
              {factors.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-emerald-700" aria-hidden>{'smartphone'}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink-green-900 truncate">{f.friendly_name || tx('تطبيق المصادقة', 'Authenticator app')}</div>
                      <div className="text-[11px] text-ink-text-muted">
                        {tx('أضيف في', 'Added')} {new Date(f.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(f)}
                    className="text-xs font-semibold text-feedback-danger hover:underline disabled:opacity-50"
                  >
                    {tx('إزالة', 'Remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {enrolling ? (
            <div className="border-t border-sand-border pt-4">
              <MfaEnroll
                onCancel={() => setEnrolling(false)}
                onDone={async () => {
                  setEnrolling(false);
                  await load();
                  toast.success(tx('تم تفعيل التحقق بخطوتين', 'Two-step verification is on'));
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEnrolling(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>{'add'}</span>
              {factors.length ? tx('إضافة جهاز احتياطي', 'Add a backup device') : tx('تفعيل التحقق بخطوتين', 'Turn on two-step verification')}
            </button>
          )}
        </section>

        {isAdmin && org && (
          <section className="rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript-sm p-5 sm:p-6 space-y-3">
            <h2 className="font-serif text-lg font-semibold text-ink-green-900">{tx('سياسة المؤسسة', 'Institution policy')}</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 rounded text-emerald-700 focus:ring-emerald-700"
                checked={Boolean(org.require_mfa_for_staff)}
                disabled={busy}
                onChange={toggleOrg}
              />
              <span className="text-sm text-ink-text-primary">
                <span className="font-semibold block">{tx('إلزام الموظفين ذوي الصلاحيات بالتحقق بخطوتين', 'Require two-step verification for privileged staff')}</span>
                <span className="text-ink-text-secondary">
                  {tx(
                    'المسؤولون وأمين الصندوق والمحاسب والمدير ونائبه ومسؤول الامتحانات والموارد البشرية. لن يتمكنوا من الوصول إلى البيانات حتى يفعّلوه.',
                    'Admins, treasurer, accountant, principal, vice principal, exam officer and HR. They cannot reach protected data until they set it up.'
                  )}
                </span>
              </span>
            </label>
          </section>
        )}
      </div>
    </div>
  );
}

function StatusPill({ on }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
        on ? 'bg-mint-wash-100 text-emerald-700 border-emerald-700/20' : 'bg-parchment-50 text-ink-text-muted border-sand-border'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {on ? tx('مفعّل', 'On') : tx('غير مفعّل', 'Off')}
    </span>
  );
}
