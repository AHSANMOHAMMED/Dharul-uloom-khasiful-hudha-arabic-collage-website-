import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { listMyNotifications, markAllNotificationsRead, markNotificationRead, updateNotifyPrefs } from '../lib/notifyApi';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { subscribeToPush } from '../lib/registerSW';
import { tx } from '../lib/tx';

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  useTranslation(); // re-render on language change
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState({
    notify_sms: true,
    notify_whatsapp: true,
    notify_push: true,
    notify_email: true,
  });

  const load = async () => {
    if (!isAuthenticated) return;
    const result = await listMyNotifications(25);
    // Back-compat if a caller still returns a bare array.
    const rows = Array.isArray(result) ? result : (result?.items || []);
    setItems(rows);
    setLoadError(Array.isArray(result) ? '' : (result?.error || ''));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    // Refresh when the user returns to the tab so the badge isn't a minute stale.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Deliver app notifications as they happen; the minute poll remains a
  // lightweight recovery path for reconnects and missed realtime events.
  useEffect(() => {
    if (!isAuthenticated || !isSupabaseConfigured) return undefined;
    let channel;
    let active = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return;
      channel = supabase.channel(`notifications:${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((current) => [payload.new, ...current.filter((n) => n.id !== payload.new.id)].slice(0, 25));
          } else if (payload.eventType === 'UPDATE') {
            setItems((current) => current.map((n) => n.id === payload.new.id ? { ...n, ...payload.new } : n));
          }
        })
        .subscribe();
    });
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      await markNotificationRead(n.id);
    }
    // Backend notifications carry an in-app deep link (e.g. /erp?module=tasks).
    if (typeof n.link === 'string' && n.link.startsWith('/') && !n.link.startsWith('//')) {
      setOpen(false);
      // Legacy fee reminders used /fees; dashboards expect ?tab=fees.
      const href = n.link === '/fees' || n.link.startsWith('/fees?')
        ? '/dashboard?tab=fees'
        : n.link;
      navigate(href);
    }
  };

  const markAll = async () => {
    const before = items;
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    try {
      await markAllNotificationsRead();
    } catch (e) {
      setItems(before);
      toast.error(e.message || tx('تعذر تحديث الإشعارات', 'Could not update notifications'));
    }
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await updateNotifyPrefs(prefs);
      toast.success(tx('تم حفظ التفضيلات', 'Preferences saved'));
      setPrefsOpen(false);
    } catch (e) {
      toast.error(e.message || tx('تعذر حفظ التفضيلات', 'Could not save preferences'));
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!key) {
      toast.warn(tx('إشعارات الدفع غير مهيأة على هذا الخادم', 'Push notifications are not configured on this server'));
      return;
    }
    try {
      const sub = await subscribeToPush(key);
      if (!sub) {
        toast.warn(tx('لم يتم منح إذن الإشعارات', 'Notification permission was not granted'));
        return;
      }
      setPrefs({ ...prefs, notify_push: true });
      await updateNotifyPrefs({ ...prefs, notify_push: true });
      toast.success(tx('تم تفعيل إشعارات الدفع', 'Push notifications enabled'));
    } catch (e) {
      toast.error(e.message || String(e));
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={tx('الإشعارات', 'Notifications')}
        aria-expanded={open}
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
        <div className="absolute end-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[min(28rem,70vh)] overflow-hidden rounded-2xl border border-[#E8E1D0] bg-white shadow-lg z-[80]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E1D0] bg-[#FBF8F0]">
            <span className="text-xs font-serif font-bold text-[#0B3B2E]">{tx('الإشعارات الواردة', 'Notifications')}</span>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button type="button" className="text-xs text-[#4A5E56] font-semibold hover:underline" onClick={markAll}>
                  {tx('تعليم الكل كمقروء', 'Mark all read')}
                </button>
              )}
              <button
                type="button"
                className="text-xs text-[#11694A] font-bold hover:underline"
                onClick={() => setPrefsOpen((v) => !v)}
              >
                {tx('التفضيلات', 'Preferences')}
              </button>
            </div>
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
                  disabled={saving}
                  className="text-xs font-bold text-white bg-[#11694A] px-3 py-1 rounded-lg disabled:opacity-50"
                >
                  {tx('حفظ', 'Save')}
                </button>
                <button
                  type="button"
                  onClick={enablePush}
                  className="text-xs font-bold text-[#0B3B2E] bg-white border border-[#E8E1D0] px-3 py-1 rounded-lg"
                >
                  {tx('تفعيل إشعارات الدفع', 'Enable push')}
                </button>
              </div>
            </div>
          )}

          <ul className="max-h-72 overflow-y-auto divide-y divide-[#E8E1D0]">
            {loadError && (
              <li className="px-4 py-6 text-center text-xs text-feedback-danger">
                {tx('تعذر تحميل الإشعارات', 'Could not load notifications')}: {loadError}
              </li>
            )}
            {!loadError && items.length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-[#4A5E56]">
                {tx('لا توجد إشعارات جديدة', 'No new notifications')}
              </li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onOpenItem(n)}
                  className={`w-full text-start px-4 py-3 hover:bg-[#FBF8F0] transition ${n.is_read ? 'opacity-60' : 'bg-white'}`}
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
