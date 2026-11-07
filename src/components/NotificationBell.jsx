import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { listMyNotifications, markNotificationRead, updateNotifyPrefs } from '../lib/notifyApi';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

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

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={ar ? 'الإشعارات' : 'Notifications'}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-800">{ar ? 'الإشعارات' : 'Notifications'}</span>
            <button type="button" className="text-xs text-emerald-700 font-semibold" onClick={() => setPrefsOpen((v) => !v)}>
              {ar ? 'التفضيلات' : 'Prefs'}
            </button>
          </div>

          {prefsOpen && (
            <div className="px-3 py-2 border-b border-slate-100 space-y-2 bg-slate-50">
              {[
                ['notify_sms', 'SMS'],
                ['notify_whatsapp', 'WhatsApp'],
                ['notify_email', 'Email'],
                ['notify_push', 'Push'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[key])}
                    onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
              <button type="button" onClick={savePrefs} className="text-xs font-bold text-white bg-emerald-600 px-2 py-1 rounded-lg">
                Save
              </button>
            </div>
          )}

          <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-slate-400">
                {ar ? 'لا إشعارات' : 'No notifications'}
              </li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onOpenItem(n)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-emerald-50/60 ${n.is_read ? 'opacity-70' : ''}`}
                >
                  <div className="text-sm font-semibold text-slate-800">{n.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
