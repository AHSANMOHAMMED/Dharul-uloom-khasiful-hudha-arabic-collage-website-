import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import KhatamPattern from '../components/KhatamPattern';
import { tx } from '../lib/tx';

export default function ResetPassword() {
  useTranslation();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkReady, setLinkReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCheckingLink(false);
      return;
    }

    let active = true;

    const verifyRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session) {
        setLinkReady(true);
        setCheckingLink(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        setLinkReady(true);
        setCheckingLink(false);
      }
    });

    verifyRecoverySession();
    const timer = setTimeout(async () => {
      if (!active) return;
      const { data: { session } } = await supabase.auth.getSession();
      setLinkReady(Boolean(session));
      setCheckingLink(false);
    }, 800);

    return () => {
      active = false;
      clearTimeout(timer);
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Compute password strength
  const getStrength = (pass) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = getStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(tx('كلمات المرور غير متطابقة', 'Passwords do not match'));
      return;
    }

    if (password.length < 8) {
      setError(tx('يجب أن تكون كلمة المرور 8 أحرف على الأقل', 'Password must be at least 8 characters'));
      return;
    }

    if (!isSupabaseConfigured) {
      setError(tx('خدمة المصادقة غير مهيأة حالياً', 'Authentication service is not configured'));
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      navigate('/login', {
        state: { message: tx('تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول.', 'Password updated. You may now sign in.') }
      });
    }, 2000);
  };

  if (checkingLink) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6 relative overflow-hidden">
      <KhatamPattern className="opacity-[0.05]" strokeColor="#0B3B2E" id="reset-khatam" />

      <div className="relative z-10 max-w-md w-full rounded-[14px] bg-paper-white border border-sand-border p-8 sm:p-10 shadow-manuscript-md space-y-6">
        
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-mint-wash-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-700/20">
            <span className="material-symbols-outlined text-2xl">{'key'}</span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block">
            {tx('بيانات الأمان', 'Security Credential')}
          </span>
          <h1 className="font-serif text-2xl font-semibold text-ink-green-900">
            {tx('تعيين كلمة المرور الجديدة', 'Set New Password')}
          </h1>
          <p className="text-xs text-ink-text-secondary">
            {tx('احرص على أن تحتوي كلمة المرور الجديدة على مزيج من الحروف والأرقام والرموز.', 'Ensure your new password contains a combination of letters, numbers, and symbols.')}
          </p>
        </div>

        {success ? (
          <div className="p-4 rounded-xl bg-mint-wash-100 border border-emerald-700/20 text-center space-y-2">
            <span className="material-symbols-outlined text-3xl text-emerald-700">{'check_circle'}</span>
            <p className="text-xs text-emerald-900 font-semibold">
              {tx('تم تحديث كلمة المرور بنجاح. جارٍ التحويل إلى صفحة الدخول...', 'Password updated successfully. Redirecting to login...')}
            </p>
          </div>
        ) : !linkReady ? (
          <div className="p-4 rounded-xl bg-gold-wash-100/50 border border-brass-gold-500/30 text-center space-y-3">
            <p className="text-xs text-ink-text-secondary leading-relaxed">
              {tx('رابط الاستعادة هذا غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.', 'This recovery link is invalid or has expired. Please request a fresh reset link.')}
            </p>
            <Link to="/forgot-password" className="text-xs font-semibold text-emerald-700 hover:underline block">
              {tx('طلب رابط جديد', 'Request new link')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-feedback-danger/10 border border-feedback-danger/30 text-feedback-danger text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                {tx('كلمة المرور الجديدة (8 أحرف على الأقل) *', 'New Password (min 8 chars) *')}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
              />

              {/* Strength Meter */}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1.5 w-full">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 rounded-full transition-colors ${
                          strength >= step
                            ? strength <= 2
                              ? 'bg-feedback-warning'
                              : 'bg-emerald-700'
                            : 'bg-sand-border/40'
                        }`}
                      ></div>
                    ))}
                  </div>
                  <span className="text-[10px] text-ink-text-muted block">
                    {tx('القوة:', 'Strength:')} {strength <= 1 ? tx('ضعيفة', 'Weak') : strength <= 3 ? tx('متوسطة', 'Medium') : tx('قوية', 'Strong')}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                {tx('تأكيد كلمة المرور الجديدة *', 'Confirm New Password *')}
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-manuscript transition-colors disabled:opacity-50"
            >
              {loading ? tx('جارٍ حفظ كلمة المرور الجديدة...', 'Saving New Password...') : tx('حفظ كلمة المرور', 'Save Password')}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
