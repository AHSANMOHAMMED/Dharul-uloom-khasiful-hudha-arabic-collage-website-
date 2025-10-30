import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const Login = () => {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
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
    setLoading(true);

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      // Redirect based on role
      if (result.user.role === 'admin') {
        navigate('/admin');
      } else {
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
            {i18n.language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {i18n.language === 'ar' ? 'أو ' : 'Or '}
            <Link to="/register" className="font-medium text-islamic-green hover:text-islamic-dark">
              {i18n.language === 'ar' ? 'إنشاء حساب جديد' : 'create a new account'}
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
                {i18n.language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green focus:z-10 sm:text-sm"
                placeholder={i18n.language === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
              />
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
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-islamic-green focus:border-islamic-green focus:z-10 sm:text-sm"
                placeholder={i18n.language === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password'}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-islamic-green hover:text-islamic-dark"
            >
              {i18n.language === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-islamic-green hover:bg-islamic-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-islamic-green disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading 
              ? (i18n.language === 'ar' ? 'جاري تسجيل الدخول...' : 'Signing in...')
              : (i18n.language === 'ar' ? 'تسجيل الدخول' : 'Sign in')
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

export default Login;
