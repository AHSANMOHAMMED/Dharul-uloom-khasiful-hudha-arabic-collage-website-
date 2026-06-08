import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const ResetPassword = () => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkReady, setLinkReady] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(ar ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError(ar ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    if (!isSupabaseConfigured) {
      setError(ar ? 'خدمة المصادقة غير مهيأة' : 'Authentication is not configured');
      return;
    }
    if (!linkReady) {
      setError(ar ? 'رابط غير صالح أو منتهي. اطلب رابطاً جديداً.' : 'Invalid or expired link. Request a new reset link.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate('/login', { state: { message: ar ? 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.' : 'Password updated. You can sign in now.' } });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full space-y-8">
        <h2 className="text-center text-3xl font-extrabold text-islamic-green">
          {ar ? 'كلمة مرور جديدة' : 'Set New Password'}
        </h2>

        {checkingLink ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center text-gray-600">
            {ar ? 'جاري التحقق من الرابط...' : 'Verifying reset link...'}
          </div>
        ) : !linkReady ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center space-y-4">
            <p className="text-red-700">
              {ar
                ? 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية.'
                : 'This password reset link is invalid or has expired.'}
            </p>
            <Link to="/forgot-password" className="text-islamic-green font-medium hover:underline">
              {ar ? 'طلب رابط جديد' : 'Request a new link'}
            </Link>
          </div>
        ) : (
        <form className="bg-white p-8 rounded-lg shadow-md space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ar ? 'كلمة المرور الجديدة' : 'New password'}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-islamic-green focus:border-islamic-green"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ar ? 'تأكيد كلمة المرور' : 'Confirm password'}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-islamic-green focus:border-islamic-green"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-islamic-green text-white rounded-lg font-medium hover:bg-islamic-dark disabled:opacity-50"
          >
            {loading ? (ar ? 'جاري الحفظ...' : 'Saving...') : (ar ? 'حفظ كلمة المرور' : 'Save password')}
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

export default ResetPassword;
