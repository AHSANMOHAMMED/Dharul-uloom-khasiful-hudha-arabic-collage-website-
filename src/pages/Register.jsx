import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { tx } from '../lib/tx';

const Register = () => {
  useTranslation(); // subscribe: re-render on language change
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(tx('كلمات المرور غير متطابقة', 'Passwords do not match'));
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError(tx('يجب أن تكون كلمة المرور 8 أحرف على الأقل', 'Password must be at least 8 characters'));
      return;
    }

    // Validate index number if student
    if (formData.role === 'student' && !formData.indexNumber.trim()) {
      setError(tx('رقم القيد مطلوب للطلاب', 'Index number is required for students'));
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
        // Email confirmation is enabled on the project; no session yet.
        navigate('/login', {
          state: {
            message: tx('تم إنشاء حسابك. يرجى تأكيد بريدك الإلكتروني ثم تسجيل الدخول.', 'Account created. Please confirm your email, then sign in.')
          }
        });
      } else {
        // Account created, redirect to dashboard.
        // If they are a student or tutor, they will see the pending approval page inside the dashboard.
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-islamic-green">
            {tx('إنشاء حساب', 'Create Account')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {tx('أو ', 'Or ')}
            <Link to="/login" className="font-medium text-islamic-green hover:text-islamic-dark">
              {tx('تسجيل الدخول إلى حسابك', 'sign in to your account')}
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tx('الاسم', 'Full Name')}
              </label>
              <input
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                placeholder={tx('أدخل اسمك الكامل', 'Enter your full name')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tx('البريد الإلكتروني', 'Email Address')}
              </label>
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                placeholder={tx('أدخل بريدك الإلكتروني', 'Enter your email')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tx('نوع الحساب', 'Account Type')}
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
              >
                <option value="parent">{tx('ولي أمر', 'Parent')}</option>
                <option value="student">{tx('طالب', 'Student')}</option>
                <option value="tutor">{tx('معلم / أستاذ', 'Teacher / Tutor')}</option>
                <option value="staff">{tx('موظف إداري', 'Non-teaching staff')}</option>
              </select>
            </div>

            {formData.role === 'student' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tx('رقم القيد', 'Index Number')}
                </label>
                <input
                  name="indexNumber"
                  type="text"
                  required
                  value={formData.indexNumber}
                  onChange={handleChange}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                  placeholder={tx('أدخل رقم القيد الخاص بك (مثال: KASHIF-2026-001)', 'Enter your index number (e.g., KASHIF-2026-001)')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tx('رقم الهاتف', 'Phone Number')}
              </label>
              <input
                name="phone"
                type="tel"
                required={formData.role === 'tutor' || formData.role === 'parent'}
                value={formData.phone}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                placeholder={tx('أدخل رقم الهاتف', 'Enter phone number')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tx('كلمة المرور', 'Password')}
              </label>
              <input
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                placeholder={tx('أدخل كلمة المرور (8 أحرف على الأقل)', 'Enter password (min 8 characters)')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tx('تأكيد كلمة المرور', 'Confirm Password')}
              </label>
              <input
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                placeholder={tx('أعد إدخال كلمة المرور', 'Re-enter password')}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-islamic-green hover:bg-islamic-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-islamic-green disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading 
              ? (tx('جاري التسجيل...', 'Creating account...'))
              : (tx('إنشاء حساب', 'Create account'))
            }
          </button>

          <div className="text-center">
            <Link
              to="/"
              className="text-sm font-medium text-gray-600 hover:text-islamic-green"
            >
              {tx('← العودة إلى الصفحة الرئيسية', '← Back to home')}
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default Register;
