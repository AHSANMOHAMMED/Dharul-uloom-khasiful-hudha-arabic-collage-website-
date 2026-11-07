import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import KhatamPattern from '../components/KhatamPattern';

export default function Register() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'parent',
    indexNumber: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const roles = [
    {
      id: 'parent',
      label_en: 'Parent / Guardian',
      label_ar: 'ولي أمر طالب',
      desc: 'Monitor child progress, exeat leaves, and fees.',
      icon: 'family_restroom'
    },
    {
      id: 'student',
      label_en: 'Student',
      label_ar: 'طالب منتظم',
      desc: 'Access syllabus, grades, and Hifz logs.',
      icon: 'school'
    },
    {
      id: 'tutor',
      label_en: 'Faculty / Tutor',
      label_ar: 'أستاذ / مدرس',
      desc: 'Log halaqah attendance and student appraisals.',
      icon: 'menu_book'
    }
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleRoleSelect = (roleId) => {
    setFormData((prev) => ({ ...prev, role: roleId }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError(isRTL ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }

    if (formData.role === 'student' && !formData.indexNumber.trim()) {
      setError(isRTL ? 'رقم القيد مطلوب للطلاب' : 'Index number is required for student registration');
      return;
    }

    setLoading(true);

    const result = await register(
      formData.username,
      formData.email,
      formData.password,
      formData.role,
      formData.indexNumber,
      formData.phone
    );

    if (result.success) {
      if (result.needsConfirmation) {
        navigate('/login', {
          state: {
            message: isRTL
              ? 'تم إنشاء حسابك. يرجى تأكيد بريدك الإلكتروني ثم تسجيل الدخول.'
              : 'Account created. Please confirm your email, then sign in.'
          }
        });
      } else if (!result.user.isApproved) {
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error || 'Registration failed. Please check your details.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-parchment-50">
      
      {/* Left Scholarly Branding Column */}
      <div className="lg:w-1/2 bg-ink-green-900 text-paper-white p-8 sm:p-14 lg:p-20 flex flex-col justify-between relative overflow-hidden">
        <KhatamPattern className="opacity-[0.05]" strokeColor="#FBF8F0" id="reg-left-khatam" />

        <div className="relative z-10 space-y-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <img 
              src="/images/logo.jpg" 
              alt="Kashiful Hudha Emblem" 
              className="w-11 h-11 object-contain rounded-lg border border-sand-border/30 bg-paper-white/10"
            />
            <div className="flex flex-col">
              <span className="font-serif text-xl font-semibold text-paper-white tracking-tight">
                Dharul Uloom Kashiful Hudha
              </span>
              <span className="text-xs text-gold-wash-100/90 font-arabic leading-none mt-0.5" dir="rtl">
                دار العلوم كاشف الهدى
              </span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 my-10 lg:my-0 space-y-6 max-w-lg">
          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 block">
            Portal Registration
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white leading-tight">
            Join our scholarly collegiate community.
          </h2>
          <p className="text-xs text-dark-text-primary/75 leading-relaxed font-sans">
            Account registration is subject to administrative authentication. Students must supply their college index number (e.g., KH-2026-0147). Parents can link wards once approved.
          </p>
        </div>

        <div className="relative z-10 text-xs text-dark-text-primary/60 flex items-center justify-between">
          <span>Official Registration Gateway</span>
          <span>Kalpitiya, Sri Lanka</span>
        </div>
      </div>

      {/* Right Form Column */}
      <div className="lg:w-1/2 p-6 sm:p-10 lg:p-16 flex items-center justify-center">
        <div className="max-w-lg w-full rounded-[14px] bg-paper-white border border-sand-border p-6 sm:p-10 shadow-manuscript-md space-y-6">
          
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              New Account
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
              {isRTL ? 'تسجيل حساب جديد' : 'Register Portal Account'}
            </h1>
            <p className="text-xs text-ink-text-secondary">
              Select your academic role to tailor your dashboard tools.
            </p>
          </div>

          {/* Role Selector Cards */}
          <div>
            <label className="block text-xs font-semibold text-ink-text-primary mb-2">
              Select Your Role *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {roles.map((r) => {
                const isSelected = formData.role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleRoleSelect(r.id)}
                    className={`p-3 rounded-[12px] text-center border transition-all ${
                      isSelected
                        ? 'bg-mint-wash-100 border-emerald-700 ring-1 ring-emerald-700'
                        : 'bg-paper-white border-sand-border hover:bg-parchment-50'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[24px] block mb-1 ${isSelected ? 'text-emerald-700' : 'text-ink-text-muted'}`}>
                      {r.icon}
                    </span>
                    <span className="font-serif text-xs font-semibold text-ink-green-900 block leading-tight">
                      {isRTL ? r.label_ar : r.label_en}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-lg bg-feedback-danger/10 border border-feedback-danger/30 text-feedback-danger text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                Full Name *
              </label>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder="e.g. Mohamed Aslam"
                className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="0771234567"
                  className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                />
              </div>
            </div>

            {/* Student Index Number Field */}
            {formData.role === 'student' && (
              <div className="p-3.5 rounded-xl bg-gold-wash-100/40 border border-brass-gold-500/30">
                <label className="block text-xs font-semibold text-ink-green-900 mb-1">
                  College Index Number * (Format: KH-YYYY-XXXX)
                </label>
                <input
                  type="text"
                  name="indexNumber"
                  required
                  value={formData.indexNumber}
                  onChange={handleChange}
                  placeholder="e.g. KH-2026-0147"
                  className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-brass-gold-500/50 focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary font-mono"
                />
                <span className="text-[11px] text-ink-text-muted mt-1 block">
                  Found on your admission slip or college marksheet.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                  Password (min 8 chars) *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                  Confirm Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 active:bg-ink-green-900 text-white text-xs sm:text-sm font-semibold shadow-manuscript transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? 'Submitting Registration...' : 'Create Portal Account'}
            </button>
          </form>

          <div className="pt-4 border-t border-sand-border text-center text-xs text-ink-text-secondary">
            Already have an active account?{' '}
            <Link to="/login" className="font-semibold text-emerald-700 hover:text-ink-green-900">
              Sign in here
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
}
