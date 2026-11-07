import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { listMyNotifications, markNotificationRead, updateNotifyPrefs } from '../lib/notifyApi';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { subscribeToPush } from '../lib/registerSW';

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState({
    notify_sms: true,
    notify_whatsapp: true,
    notify_push: true,
    notify_email: true,
  });

  const load = async () => {
    if (!isAuthenticated) return;
    setItems(await listMyNotifications(25));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('notify_sms, notify_whatsapp, notify_push, notify_email')
        .eq('id', user.id)
        .maybeSingle();
      if (data) setPrefs(data);
    })();
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const unread = items.filter((n) => !n.is_read).length;

  const onOpenItem = async (n) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
  };

  const savePrefs = async () => {
    await updateNotifyPrefs(prefs);
    setPrefsOpen(false);
  };

  const enablePush = async () => {
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!key) {
      alert(ar ? 'مفتاح VAPID غير مضبوط' : 'VITE_VAPID_PUBLIC_KEY is not configured');
      return;
    }
    const sub = await subscribeToPush(key);
    if (sub) {
      setPrefs({ ...prefs, notify_push: true });
      await updateNotifyPrefs({ ...prefs, notify_push: true });
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={ar ? 'الإشعارات' : 'Notifications'}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-[#0B3B2E] hover:bg-[#FBF8F0] border border-transparent hover:border-[#E8E1D0] transition"
      >
        <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C29A3A] text-[#0B3B2E] text-[10px] font-bold flex items-center justify-center shadow-xs">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden rounded-2xl border border-[#E8E1D0] bg-white shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E1D0] bg-[#FBF8F0]">
            <span className="text-xs font-serif font-bold text-[#0B3B2E]">{ar ? 'الإشعارات الواردة' : 'Notifications'}</span>
            <button
              type="button"
              className="text-xs text-[#11694A] font-bold hover:underline"
              onClick={() => setPrefsOpen((v) => !v)}
            >
              {ar ? 'التفضيلات' : 'Preferences'}
            </button>
          </div>

          {prefsOpen && (
            <div className="px-4 py-3 border-b border-[#E8E1D0] space-y-2 bg-[#FBF8F0]/60">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['notify_sms', 'SMS'],
                  ['notify_whatsapp', 'WhatsApp'],
                  ['notify_email', 'Email'],
                  ['notify_push', 'Push'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs text-[#14201B] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(prefs[key])}
                      onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                      className="rounded text-[#11694A] focus:ring-[#11694A]"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={savePrefs}
                  className="text-xs font-bold text-white bg-[#11694A] px-3 py-1 rounded-lg"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={enablePush}
                  className="text-xs font-bold text-[#0B3B2E] bg-white border border-[#E8E1D0] px-3 py-1 rounded-lg"
                >
                  Enable Push
                </button>
              </div>
            </div>
          )}

          <ul className="max-h-72 overflow-y-auto divide-y divide-[#E8E1D0]">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-[#4A5E56]">
                {ar ? 'لا توجد إشعارات جديدة' : 'No new notifications'}
              </li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onOpenItem(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-[#FBF8F0] transition ${n.is_read ? 'opacity-60' : 'bg-white'}`}
                >
                  <div className="text-xs font-bold text-[#0B3B2E]">{n.title}</div>
                  <div className="text-[11px] text-[#4A5E56] mt-0.5 line-clamp-2 leading-relaxed">{n.message}</div>
                  <div className="text-[10px] text-[#60736C] font-mono mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
