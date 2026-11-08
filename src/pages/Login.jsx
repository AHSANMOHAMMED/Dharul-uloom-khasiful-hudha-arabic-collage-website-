import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import KhatamPattern from '../components/KhatamPattern';
import { tx } from '../lib/tx';
import { safeRedirectPath } from '../lib/useTabParam';
import MfaChallenge from '../components/security/MfaChallenge';

export default function Login() {
  useTranslation();
  const { login, user, mfaChallengeNeeded } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info] = useState(location.state?.message || '');
  const [loading, setLoading] = useState(false);
  const [signedInUser, setSignedInUser] = useState(null);

  // Send each role to its workspace, or back to the page that sent them here.
  const goToWorkspace = (u) => {
    const back = safeRedirectPath(location.state?.from);
    if (back) navigate(back, { replace: true });
    else if (u?.role === 'admin' || u?.role === 'super_admin') navigate('/admin');
    else if (u?.role === 'librarian') navigate('/library-admin');
    else navigate('/dashboard');
  };

  // Password accepted but the account has 2FA: ask for the code before routing.
  if (user && mfaChallengeNeeded) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6 relative">
        <KhatamPattern className="opacity-[0.05]" strokeColor="#0B3B2E" id="mfa-login-khatam" />
        <div className="relative z-10 max-w-md w-full bg-paper-white rounded-[14px] border border-sand-border p-6 sm:p-8 shadow-manuscript-md">
          <MfaChallenge onVerified={() => goToWorkspace(signedInUser || user)} onCancel={() => setSignedInUser(null)} />
        </div>
      </div>
    );
  }

  // If user is already logged in but not approved, show pending screen
  if (user && user.isApproved === false) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6 relative">
        <KhatamPattern className="opacity-[0.05]" strokeColor="#0B3B2E" id="pending-khatam" />
        <div className="relative z-10 max-w-md w-full bg-paper-white rounded-[14px] border border-sand-border p-8 text-center shadow-manuscript-md space-y-5">
          <div className="w-16 h-16 rounded-full bg-gold-wash-100 text-brass-gold-500 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">{'hourglass_top'}</span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brass-gold-500 block mb-1">
              {tx('حالة الحساب: بانتظار التحقق', 'Account Status: Verification Pending')}
            </span>
            <h2 className="font-serif text-2xl font-semibold text-ink-green-900">
              {tx('الحساب قيد المراجعة والاعتماد', 'Application Pending Approval')}
            </h2>
          </div>
          <p className="text-xs text-ink-text-secondary leading-relaxed font-sans">
            {tx('يجري التحقق من تسجيلك من قِبل المدير ومسجّل الشؤون الإدارية. ستحصل على صلاحية الوصول إلى سجلات الطلاب وكشوف الرسوم بعد تفعيل الحساب.', 'Your registration is being verified by the Principal and Administrative registrar. You will receive access to student records and fee ledgers upon activation.')}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              {tx('التحقق من حالة الاعتماد', 'Check Approval Status')}
            </button>
            <Link
              to="/"
              className="w-full h-11 rounded-[10px] border border-sand-border flex items-center justify-center text-ink-text-secondary hover:bg-sand-border/20 text-xs font-medium"
            >
              {tx('العودة إلى الموقع', 'Return to Website')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      setSignedInUser(result.user);
      // With 2FA the challenge screen above takes over and routes on success.
      if (!result.mfaRequired) goToWorkspace(result.user);
    } else {
      setError(result.error || tx('فشل تسجيل الدخول. يرجى التحقق من بيانات الدخول.', 'Authentication failed. Please verify credentials.'));
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-parchment-50">
      
      {/* Left Scholarly Branding Column (Desktop) */}
      <div className="lg:w-1/2 bg-ink-green-900 text-paper-white p-8 sm:p-14 lg:p-20 flex flex-col justify-between relative overflow-hidden">
        <KhatamPattern className="opacity-[0.05]" strokeColor="#FBF8F0" id="login-left-khatam" />

        <div className="relative z-10 space-y-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <img 
              src="/images/logo.svg" 
              alt={tx('شعار دار العلوم كاشف الهدى', 'D.U. Kashiful Hudha Arabic College Emblem')}
              className="w-11 h-11 object-contain rounded-lg border border-sand-border/30 bg-paper-white/10"
            />
            <div className="flex flex-col">
              <span className="font-serif text-xl font-semibold text-paper-white tracking-tight">
                {tx('دار العلوم كاشف الهدى', 'Dharul Uloom Kashiful Hudha')}
              </span>
              <span className="text-xs text-gold-wash-100/90 font-arabic leading-none mt-0.5" dir="rtl">
                دار العلوم كاشف الهدى
              </span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 my-12 lg:my-0 space-y-6 max-w-lg">
          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 block">
            {tx('البوابة المؤسسية', 'Institutional Gateway')}
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white leading-tight">
            {tx('علمٌ يُنير الطريق.', 'Knowledge that lights the way.')}
          </h2>
          <blockquote className="font-serif italic text-sm text-dark-text-primary/80 border-l-2 border-brass-gold-500 pl-4 py-1 leading-relaxed">
            «مَنْ سَلَكَ طَرِيقاً يَلْتَمِسُ فِيهِ عِلْماً سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقاً إِلَى الْجَنَّةِ»
          </blockquote>
          <p className="text-xs text-dark-text-primary/70 leading-relaxed font-sans">
            {tx('بوابة موحّدة للطلاب وأولياء الأمور والأساتذة والإدارة. تابع السجلات الأكاديمية وسجلات الحلقات وتسديد الرسوم والمخطوطات الرقمية.', 'Centralized portal access for students, parents, tutors, and administration. Monitor academic ledgers, halaqah logs, fee settlements, and digital manuscripts.')}
          </p>
        </div>

        <div className="relative z-10 text-xs text-dark-text-primary/60 flex items-center justify-between">
          <span>{tx('موداليبالي، كلبيتيا · سريلانكا', 'Mudalippalli, Kalpitiya · Sri Lanka')}</span>
          <span>{tx('بروتوكول الأمان 2.4', 'Security Protocol v2.4')}</span>
        </div>
      </div>

      {/* Right Authentication Form Column */}
      <div className="lg:w-1/2 p-6 sm:p-12 lg:p-20 flex items-center justify-center">
        <div className="max-w-md w-full rounded-[14px] bg-paper-white border border-sand-border p-8 sm:p-10 shadow-manuscript-md space-y-6">
          
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              {tx('دخول موثَّق', 'Authenticated Access')}
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
              {tx('تسجيل الدخول إلى البوابة', 'Sign in to Portal')}
            </h1>
            <p className="text-xs text-ink-text-secondary">
              {tx('أدخل بريدك الإلكتروني المسجّل لدى الكلية.', 'Enter your registered collegiate email or index credential.')}
            </p>
          </div>

          {info && (
            <div className="p-3.5 rounded-lg bg-mint-wash-100 border border-emerald-700/20 text-emerald-800 text-xs font-medium">
              {info}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-lg bg-feedback-danger/10 border border-feedback-danger/30 text-feedback-danger text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">{'error'}</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                {tx('البريد الإلكتروني *', 'Email / Index Identifier *')}
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder={'student@kashifulhudha.edu.lk'}
                className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary placeholder:text-ink-text-muted"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-ink-text-primary">
                  {tx('كلمة المرور *', 'Password *')}
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-emerald-700 hover:text-ink-green-900 font-medium"
                >
                  {tx('نسيت كلمة المرور؟', 'Forgot password?')}
                </Link>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  className="w-full h-11 px-3.5 pr-10 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-text-muted hover:text-ink-text-primary"
                  aria-label={tx('إظهار/إخفاء كلمة المرور', 'Toggle password visibility')}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 active:bg-ink-green-900 text-white text-xs sm:text-sm font-semibold shadow-manuscript transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? tx('جارٍ التحقق...', 'Authenticating...') : tx('تسجيل الدخول إلى البوابة', 'Sign in to Portal')}
            </button>
          </form>

          <div className="pt-4 border-t border-sand-border text-center text-xs text-ink-text-secondary">
            {tx('ليس لديك حساب في البوابة؟', 'Don’t have an authenticated portal login?')}{' '}
            <Link to="/register" className="font-semibold text-emerald-700 hover:text-ink-green-900">
              {tx('سجّل هنا', 'Register here')}
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
}
