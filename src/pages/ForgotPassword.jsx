import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const ForgotPassword = () => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isSupabaseConfigured) {
      setError(ar ? 'خدمة المصادقة غير مهيأة' : 'Authentication is not configured');
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-islamic-green">
            {ar ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {ar ? 'سنرسل رابط إعادة التعيين إلى بريدك الإلكتروني' : 'We will email you a reset link'}
          </p>
        </div>

        {sent ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center space-y-4">
            <p className="text-green-700">
              {ar
                ? 'تحقق من بريدك الإلكتروني واتبع الرابط لإعادة تعيين كلمة المرور.'
                : 'Check your email and follow the link to set a new password.'}
            </p>
            <Link to="/login" className="text-islamic-green font-medium hover:underline">
              {ar ? '← العودة لتسجيل الدخول' : '← Back to sign in'}
            </Link>
          </div>
        ) : (
          <form className="bg-white p-8 rounded-lg shadow-md space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {ar ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-islamic-green focus:border-islamic-green"
                placeholder={ar ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-islamic-green text-white rounded-lg font-medium hover:bg-islamic-dark disabled:opacity-50"
            >
              {loading ? (ar ? 'جاري الإرسال...' : 'Sending...') : (ar ? 'إرسال الرابط' : 'Send reset link')}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-gray-600 hover:text-islamic-green">
                {ar ? '← العودة لتسجيل الدخول' : '← Back to sign in'}
              </Link>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
