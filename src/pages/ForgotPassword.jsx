import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import KhatamPattern from '../components/KhatamPattern';

export default function ForgotPassword() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isSupabaseConfigured) {
      setError(isRTL ? 'خدمة المصادقة غير مهيأة حالياً' : 'Authentication service is not configured');
      return;
    }
    setLoading(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6 relative overflow-hidden">
      <KhatamPattern className="opacity-[0.05]" strokeColor="#0B3B2E" id="forgot-khatam" />

      <div className="relative z-10 max-w-md w-full rounded-[14px] bg-paper-white border border-sand-border p-8 sm:p-10 shadow-manuscript-md space-y-6">
        
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-mint-wash-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-700/20">
            <span className="material-symbols-outlined text-2xl">lock_reset</span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block">
            Account Recovery
          </span>
          <h1 className="font-serif text-2xl font-semibold text-ink-green-900">
            {isRTL ? 'استعادة كلمة المرور' : 'Reset Portal Password'}
          </h1>
          <p className="text-xs text-ink-text-secondary">
            Enter your collegiate registered email address and we will dispatch a secure recovery token.
          </p>
        </div>

        {sent ? (
          <div className="p-5 rounded-xl bg-mint-wash-100 border border-emerald-700/20 text-center space-y-3">
            <span className="material-symbols-outlined text-3xl text-emerald-700">mark_email_read</span>
            <p className="text-xs text-emerald-900 font-medium leading-relaxed">
              {isRTL
                ? 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني. تفقد صندوق الوارد.'
                : 'A recovery link has been dispatched to your email. Please follow the instructions to set a new password.'}
            </p>
            <div className="pt-2">
              <Link to="/login" className="text-xs font-semibold text-emerald-700 hover:underline">
                Return to Sign In
              </Link>
            </div>
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
                Collegiate Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@kashifulhudha.edu.lk"
                className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-manuscript transition-colors disabled:opacity-50"
            >
              {loading ? 'Dispatching Link...' : 'Email Reset Link'}
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-sand-border text-center text-xs text-ink-text-muted">
          Remembered your password?{' '}
          <Link to="/login" className="text-emerald-700 font-semibold hover:text-ink-green-900">
            Sign in
          </Link>
        </div>

      </div>
    </div>
  );
}
