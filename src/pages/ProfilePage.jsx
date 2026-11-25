import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { tx } from '../lib/tx';
import PageNavBar from '../components/PageNavBar';
import Icon from '../components/Icon';
import { portalHomeFor } from '../lib/useHistoryNav';

export default function ProfilePage() {
  const { i18n } = useTranslation();
  const auth = useAuth();
  const { user, loading, isAuthenticated, refreshUser, logout } = auth;
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [prefLang, setPrefLang] = useState(i18n.language || 'en');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [notifyPush, setNotifyPush] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured || !supabase) return;
    setFullName(user.username || '');
    setPhone(user.phone || '');
    setAvatarUrl(user.avatarUrl || '');
    supabase
      .from('profiles')
      .select('full_name, phone, avatar_url, preferred_language, notify_email, notify_whatsapp, notify_push')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.full_name) setFullName(data.full_name);
        setPhone(data.phone || '');
        setAvatarUrl(data.avatar_url || '');
        if (data.preferred_language) setPrefLang(data.preferred_language);
        if (typeof data.notify_email === 'boolean') setNotifyEmail(data.notify_email);
        if (typeof data.notify_whatsapp === 'boolean') setNotifyWhatsapp(data.notify_whatsapp);
        if (typeof data.notify_push === 'boolean') setNotifyPush(data.notify_push);
      });
  }, [user?.id, user?.username, user?.phone, user?.avatarUrl]);

  if (loading) {
    return <div className="min-h-[60vh] bg-[#F8FAFC]" />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: '/profile' }} />;
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !supabase || !user?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tx('حجم الصورة يجب أن يكون أقل من 5 ميجابايت', 'Photo must be under 5 MB'));
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/avatar-${Date.now()}.${ext || 'jpg'}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = pub?.publicUrl || '';
      const { error: rpcErr } = await supabase.rpc('update_my_profile', { p_avatar_url: url });
      if (rpcErr) throw rpcErr;
      setAvatarUrl(url);
      await refreshUser?.();
      toast.success(tx('تم تحديث صورة الملف الشخصي', 'Profile photo updated'));
    } catch (err) {
      toast.error(err.message || tx('تعذر رفع الصورة', 'Could not upload photo'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!supabase) return;
    setUploadingPhoto(true);
    try {
      const { error } = await supabase.rpc('update_my_profile', { p_avatar_url: '' });
      if (error) throw error;
      setAvatarUrl('');
      await refreshUser?.();
      toast.success(tx('تمت إزالة الصورة', 'Photo removed'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!supabase || !fullName.trim()) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.rpc('update_my_profile', {
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_preferred_language: prefLang,
        p_notify_email: notifyEmail,
        p_notify_whatsapp: notifyWhatsapp,
        p_notify_push: notifyPush,
      });
      if (error) throw error;
      if (prefLang && i18n.language !== prefLang) {
        await i18n.changeLanguage(prefLang);
      }
      await refreshUser?.();
      toast.success(tx('تم حفظ إعدادات الملف الشخصي بنجاح', 'Profile & UI settings saved'));
    } catch (err) {
      toast.error(err.message || tx('تعذر حفظ الملف الشخصي', 'Could not save profile'));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    if (newPassword.length < 8) {
      toast.error(tx('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'Password must be at least 8 characters'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(tx('كلمتا المرور غير متطابقتين', 'Passwords do not match'));
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      toast.success(tx('تم تحديث كلمة المرور', 'Password updated'));
    } catch (err) {
      toast.error(err.message || tx('تعذر تحديث كلمة المرور', 'Could not update password'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (fullName || user?.username || user?.email || 'U').trim().slice(0, 1).toUpperCase();

  return (
    <main className="min-h-screen bg-[#F8FAFC] py-6 sm:py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageNavBar
          home={{ to: portalHomeFor(auth), label: tx('بوابتي', 'My portal') }}
          crumbs={[
            { label: tx('بوابتي', 'My portal'), to: portalHomeFor(auth) },
            { label: tx('الملف الشخصي والإعدادات', 'Profile & Settings') },
          ]}
        />

        {/* Top Profile Identity Header with Photo, Name, Roles & Sign Out */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#11694A]" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || user?.username}
                    className="h-20 w-20 rounded-2xl object-cover border border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-[#E3F1EA] text-[#11694A] border border-[#11694A]/20 flex items-center justify-center text-2xl font-bold">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#0B3B2E] truncate">
                    {fullName || user?.username || user?.email}
                  </h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E3F1EA] text-[#11694A] border border-[#11694A]/20 capitalize">
                    {user?.accountType || user?.role || 'user'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate" dir="ltr">{user?.email}</p>
                {user?.indexNumber && (
                  <p className="text-xs font-mono text-slate-600">{tx('رقم القيد:', 'ID:')} {user.indexNumber}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
                  <button
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#11694A] hover:bg-[#0B3B2E] text-white text-xs font-semibold transition disabled:opacity-50"
                  >
                    <Icon name="image" className="text-[14px]" />
                    <span>{uploadingPhoto ? tx('جارٍ الرفع…', 'Uploading…') : tx('تغيير الصورة', 'Upload Photo')}</span>
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={handleRemovePhoto}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
                    >
                      {tx('إزالة', 'Remove')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#991B1B] border border-red-200 text-xs font-bold transition"
              >
                <Icon name="logout" className="text-[16px]" />
                <span>{tx('تسجيل الخروج', 'Sign Out')}</span>
              </button>
              <Link
                to={portalHomeFor(auth)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-[#0B3B2E] text-xs font-semibold transition"
              >
                <Icon name="arrow_back" className="text-[15px] rtl:rotate-180" />
                <span>{tx('العودة للبوابة', 'Back to Portal')}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Personal Details & UI Setup Form */}
        <form onSubmit={saveProfile} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#0B3B2E] border-b border-slate-100 pb-3">
              {tx('المعلومات الشخصية', 'Personal Information')}
            </h2>
            <label className="block text-sm">
              <span className="block text-slate-600 font-medium mb-1">{tx('الاسم الكامل', 'Full Name')}</span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#11694A] focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-slate-600 font-medium mb-1">{tx('رقم الهاتف / واتساب', 'Phone / WhatsApp')}</span>
              <input
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+94..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#11694A] focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-slate-600 font-medium mb-1">{tx('البريد الإلكتروني', 'Email Address')}</span>
              <input
                value={user?.email || ''}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-base font-bold text-[#0B3B2E] border-b border-slate-100 pb-3">
                {tx('إعدادات الواجهة والإشعارات', 'UI & Notification Setup')}
              </h2>
              <label className="block text-sm">
                <span className="block text-slate-600 font-medium mb-1">{tx('لغة الواجهة', 'Interface Language')}</span>
                <select
                  value={prefLang}
                  onChange={(e) => setPrefLang(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#11694A] focus:outline-none"
                >
                  <option value="en">{tx('الإنجليزية', 'English')}</option>
                  <option value="ar">{tx('العربية', 'Arabic')}</option>
                  <option value="ta">{tx('التاميل', 'Tamil')}</option>
                </select>
              </label>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm">
                  <span className="font-medium text-slate-700">{tx('تنبيهات البريد الإلكتروني', 'Email Notifications')}</span>
                  <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} className="rounded text-[#11694A]" />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm">
                  <span className="font-medium text-slate-700">{tx('تنبيهات واتساب', 'WhatsApp Notifications')}</span>
                  <input type="checkbox" checked={notifyWhatsapp} onChange={(e) => setNotifyWhatsapp(e.target.checked)} className="rounded text-[#11694A]" />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm">
                  <span className="font-medium text-slate-700">{tx('إشعارات الدفع الفوري', 'Push Notifications')}</span>
                  <input type="checkbox" checked={notifyPush} onChange={(e) => setNotifyPush(e.target.checked)} className="rounded text-[#11694A]" />
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 rounded-xl bg-[#11694A] hover:bg-[#0B3B2E] text-white text-sm font-semibold shadow-xs transition disabled:opacity-50"
              >
                {savingProfile ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ التغييرات', 'Save Profile & Setup')}
              </button>
            </div>
          </section>
        </form>

        {/* Password & Two-Step Verification */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-[#0B3B2E]">{tx('الأمان وكلمة المرور', 'Security & Password')}</h2>
            <Link
              to="/account/security"
              className="text-xs font-semibold text-[#11694A] hover:underline flex items-center gap-1"
            >
              <Icon name="verified_user" className="text-[16px]" />
              <span>{tx('إدارة التحقق بخطوتين (2FA)', 'Manage Two-Step Verification (2FA)')}</span>
            </Link>
          </div>
          <form onSubmit={savePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <label className="block text-sm">
              <span className="block text-slate-600 font-medium mb-1">{tx('كلمة المرور الجديدة', 'New Password')}</span>
              <input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#11694A] focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-slate-600 font-medium mb-1">{tx('تأكيد كلمة المرور', 'Confirm Password')}</span>
              <input
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#11694A] focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={savingPassword || !newPassword}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0B3B2E] text-sm font-semibold transition disabled:opacity-50"
            >
              {savingPassword ? tx('جارٍ التحديث…', 'Updating…') : tx('تحديث كلمة المرور', 'Update Password')}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
