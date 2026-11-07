import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';
import { useAuth } from './auth';

/**
 * Supabase Realtime helpers.
 *
 * The server publishes notifications, student_fees, fee_receipts, attendance,
 * announcements, leave_requests, staff_leave_requests and payslips. Realtime
 * applies RLS, so a client only receives rows it could SELECT anyway.
 */

let channelSeq = 0;

/**
 * Subscribe to postgres_changes on one table.
 *   useLiveTable({ table: 'student_fees', filter: `student_id=eq.${id}`, onChange })
 * Returns { status, live } where live is true while the channel is SUBSCRIBED.
 * The channel is removed on unmount or when table / filter / event change.
 */
export function useLiveTable({ table, filter, event = '*', onChange, enabled = true }) {
  const [status, setStatus] = useState('idle');
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!supabase || !enabled || !table) return undefined;
    channelSeq += 1;
    const name = `live:${table}:${filter || 'all'}:${channelSeq}`;
    const opts = { event, schema: 'public', table };
    if (filter) opts.filter = filter;
    const channel = supabase
      .channel(name)
      .on('postgres_changes', opts, (payload) => cb.current?.(payload))
      .subscribe((s) => setStatus(s));
    return () => {
      setStatus('idle');
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled]);

  return { status, live: status === 'SUBSCRIBED' };
}

/**
 * Re-run `reload` (debounced) whenever any of the given tables change for a
 * student. Returns true while every channel is SUBSCRIBED.
 *   const live = useLiveReload(['student_fees', 'fee_receipts'], `student_id=eq.${id}`, q.reload, !!id)
 * Supports up to three tables (hooks must be called a fixed number of times).
 */
export function useLiveReload(tables, filter, reload, enabled = true) {
  const timer = useRef(null);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const onChange = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => reloadRef.current?.(), 350);
  }, []);
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const [a, b, c] = tables;
  const s1 = useLiveTable({ table: a, filter, onChange, enabled: enabled && !!a });
  const s2 = useLiveTable({ table: b, filter, onChange, enabled: enabled && !!b });
  const s3 = useLiveTable({ table: c, filter, onChange, enabled: enabled && !!c });
  return [a && s1, b && s2, c && s3].filter(Boolean).every((s) => s.live);
}

// ── App-wide live notifications ────────────────────────────────────────────

const LiveContext = createContext({ unread: 0, live: false, toast: null, dismissToast: () => {}, refreshUnread: () => {} });

/**
 * Subscribes to the signed-in user's notifications. New rows raise an in-app
 * toast; the unread count is kept fresh for header badges.
 */
export function LiveProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.id;
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);

  const refreshUnread = useCallback(async () => {
    if (!supabase || !uid) {
      setUnread(0);
      return;
    }
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('is_read', false);
    if (!error) setUnread(count || 0);
  }, [uid]);

  useEffect(() => {
    refreshUnread();
    if (!uid) setToast(null);
  }, [uid, refreshUnread]);

  // Refresh after returning from background (pushes may have arrived).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshUnread();
    });
    return () => sub.remove();
  }, [refreshUnread]);

  const { live } = useLiveTable({
    table: 'notifications',
    filter: uid ? `user_id=eq.${uid}` : undefined,
    enabled: !!uid,
    onChange: (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        const n = payload.new;
        setToast({ id: n.id, title: n.title, message: n.message, data: n.data || {}, link: n.link || null });
      }
      refreshUnread();
    },
  });

  const value = useMemo(
    () => ({ unread, live, toast, dismissToast: () => setToast(null), refreshUnread }),
    [unread, live, toast, refreshUnread],
  );
  return createElement(LiveContext.Provider, { value }, children);
}

export function useLive() {
  return useContext(LiveContext);
}
