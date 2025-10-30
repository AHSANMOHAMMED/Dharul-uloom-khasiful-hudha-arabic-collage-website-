import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const Register = () => {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'parent'
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
      setError(i18n.language === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError(i18n.language === 'ar' 
        ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل' 
        : 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const result = await register(
      formData.username,
      formData.email,
      formData.password,
      formData.role
    );
    
    if (result.success) {
      navigate('/dashboard');
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
            {i18n.language === 'ar' ? 'إنشاء حساب' : 'Create Account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {i18n.language === 'ar' ? 'أو ' : 'Or '}
            <Link to="/login" className="font-medium text-islamic-green hover:text-islamic-dark">
              {i18n.language === 'ar' ? 'تسجيل الدخول إلى حسابك' : 'sign in to your account'}
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
                {i18n.language === 'ar' ? 'الاسم' : 'Full Name'}
              </label>
              <input
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                placeholder={i18n.language === 'ar' ? 'أدخل اسمك الكامل' : 'Enter your full name'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {i18n.language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                placeholder={i18n.language === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {i18n.language === 'ar' ? 'نوع الحساب' : 'Account Type'}
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
              >
                <option value="parent">{i18n.language === 'ar' ? 'ولي أمر' : 'Parent'}</option>
                <option value="student">{i18n.language === 'ar' ? 'طالب' : 'Student'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {i18n.language === 'ar' ? 'كلمة المرور' : 'Password'}
              </label>
              <input
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                placeholder={i18n.language === 'ar' ? 'أدخل كلمة المرور (8 أحرف على الأقل)' : 'Enter password (min 8 characters)'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {i18n.language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <input
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green sm:text-sm"
                placeholder={i18n.language === 'ar' ? 'أعد إدخال كلمة المرور' : 'Re-enter password'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-islamic-green hover:bg-islamic-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-islamic-green disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading 
              ? (i18n.language === 'ar' ? 'جاري التسجيل...' : 'Creating account...')
              : (i18n.language === 'ar' ? 'إنشاء حساب' : 'Create account')
            }
          </button>

          <div className="text-center">
            <Link
              to="/"
              className="text-sm font-medium text-gray-600 hover:text-islamic-green"
            >
              {i18n.language === 'ar' ? '← العودة إلى الصفحة الرئيسية' : '← Back to home'}
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default Register;
