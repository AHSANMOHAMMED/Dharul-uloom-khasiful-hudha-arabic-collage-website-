/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  fetchOrgInvitations, fetchPlatformHealth, inviteOrgAdmin, platformBroadcast,
  platformUserAction, revokeInvitation, updatePlatformOrg,
} from '../../lib/platformApi';

// The platform console is English + LTR by design (see SuperAdminConsole).
export const en = (_ar, english) => english;

const pretty = (s) => String(s || '').replace(/_/g, ' ');

const inputCls = 'mt-1 block w-full rounded-[10px] border border-sand-border bg-paper-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-700';
const btn = 'rounded-[10px] px-3 py-2 text-xs font-semibold disabled:opacity-50';
const primary = `${btn} bg-emerald-700 text-white hover:bg-emerald-600`;
const secondary = `${btn} border border-sand-border bg-paper-white text-ink-green-900 hover:bg-parchment-50`;
const danger = `${btn} border border-feedback-danger/40 text-feedback-danger hover:bg-red-50`;

export function Dialog({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-green-900/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} space-y-4 rounded-[14px] border border-sand-border bg-paper-white p-6 shadow-manuscript-lg`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={onClose} className={secondary} aria-label={en('رجوع', 'Back')}>
              <span className="material-symbols-outlined text-[16px] align-[-3px]" aria-hidden>arrow_back</span> {en('رجوع', 'Back')}
            </button>
            <h3 className="truncate font-serif text-lg font-semibold text-ink-green-900">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={en('إغلاق', 'Close')} className="text-ink-text-muted hover:text-ink-green-900">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>close</span>
          </button>
        </div>
        {children}
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-sand-border pt-3">{footer}</div>}
      </div>
    </div>
  );
}

function Notice({ kind = 'ok', children }) {
  if (!children) return null;
  const cls = kind === 'error' ? 'border-feedback-danger/30 bg-red-50 text-feedback-danger' : 'border-emerald-700/20 bg-mint-wash-100 text-emerald-700';
  return <p role={kind === 'error' ? 'alert' : 'status'} className={`rounded-[10px] border px-3 py-2 text-sm ${cls}`}>{children}</p>;
}

// ---------------------------------------------------------------------------
/** Sign-in & security actions for one user (Supabase Auth admin API via platform-user-admin). */
export function UserAuthActions({ userId }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const act = async (action, extra, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await platformUserAction(action, userId, extra);
      const text = {
        reset_mfa: `${en('', 'Two-step verification reset')} (${r.removed ?? 0} ${en('', 'device(s) removed')}).`,
        send_password_reset: en('', 'Password-reset e-mail sent.'),
        set_sign_in: extra?.enabled ? en('', 'Sign-in enabled.') : en('', 'Sign-in disabled.'),
      }[action];
      setMsg({ kind: 'ok', text });
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-[12px] border border-sand-border bg-parchment-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-text-muted">{en('', 'Sign-in & security')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondary} disabled={busy} onClick={() => act('send_password_reset')}>{en('', 'Send password reset')}</button>
        <button type="button" className={secondary} disabled={busy} onClick={() => act('reset_mfa', {}, en('', 'Remove all two-step verification devices for this user?'))}>{en('', 'Reset two-step verification')}</button>
        <button type="button" className={danger} disabled={busy} onClick={() => act('set_sign_in', { enabled: false }, en('', 'Block this user from signing in?'))}>{en('', 'Disable sign-in')}</button>
        <button type="button" className={secondary} disabled={busy} onClick={() => act('set_sign_in', { enabled: true })}>{en('', 'Enable sign-in')}</button>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}

// ---------------------------------------------------------------------------
const ORG_FIELDS = [
  ['name_en', 'Name (English)'], ['name_ar', 'Name (Arabic)'], ['code', 'Short code'], ['contact_email', 'Contact e-mail'],
  ['contact_phone', 'Contact phone'], ['address', 'Address'], ['country', 'Country'], ['currency', 'Currency'],
  ['timezone', 'Time zone'], ['custom_domain', 'Custom domain'],
];

/** Edit an institution's details and admission-age rules (loads the full record). */
export function OrgDetailsDialog({ org: summary, onClose, onSaved }) {
  const orgId = summary.org_id || summary.id;
  const [org, setOrg] = useState(null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    supabase.from('organizations').select('*').eq('id', orgId).single()
      .then(({ data, error }) => (error ? setLoadError(error.message) : setOrg(data)));
  }, [orgId]);
  if (loadError) return <Dialog title={summary.name_en} onClose={onClose}><Notice kind="error">{loadError}</Notice></Dialog>;
  if (!org) return <Dialog title={summary.name_en} onClose={onClose}><p className="text-sm text-ink-text-muted">{en('', 'Loading…')}</p></Dialog>;
  return <OrgDetailsForm org={org} onClose={onClose} onSaved={onSaved} />;
}

function OrgDetailsForm({ org, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(ORG_FIELDS.map(([k]) => [k, org[k] ?? ''])),
    admission_min_age: org.settings?.admission_min_age ?? '',
    admission_max_age: org.settings?.admission_max_age ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const save = async () => {
    const patch = {};
    for (const [k] of ORG_FIELDS) if ((form[k] ?? '') !== (org[k] ?? '')) patch[k] = k === 'code' ? String(form[k]).toUpperCase() : form[k];
    for (const k of ['admission_min_age', 'admission_max_age']) {
      if (String(form[k]) !== String(org.settings?.[k] ?? '') && form[k] !== '') patch[k] = Number(form[k]);
    }
    if (!Object.keys(patch).length) return onClose();
    setBusy(true);
    setMsg(null);
    try {
      await updatePlatformOrg(org.id, patch);
      onSaved?.();
      onClose();
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog wide title={`${en('', 'Institution details')} · ${org.name_en}`} onClose={onClose}
      footer={<><button type="button" className={secondary} onClick={onClose}>{en('', 'Cancel')}</button><button type="button" className={primary} disabled={busy} onClick={save}>{en('', 'Save')}</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {ORG_FIELDS.map(([k, label]) => (
          <label key={k} className="text-sm font-semibold text-ink-green-900">{en('', label)}
            <input className={inputCls} dir={k === 'name_ar' ? 'rtl' : 'ltr'} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
          </label>
        ))}
        <label className="text-sm font-semibold text-ink-green-900">{en('', 'Minimum admission age')}
          <input type="number" min="3" max="80" className={inputCls} value={form.admission_min_age} onChange={(e) => setForm((f) => ({ ...f, admission_min_age: e.target.value }))} />
        </label>
        <label className="text-sm font-semibold text-ink-green-900">{en('', 'Maximum admission age')}
          <input type="number" min="3" max="80" className={inputCls} value={form.admission_max_age} onChange={(e) => setForm((f) => ({ ...f, admission_max_age: e.target.value }))} />
        </label>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </Dialog>
  );
}

/** Institution admins: pending invitations, invite another admin, revoke. */
export function OrgAdminsDialog({ org, onClose }) {
  const [rows, setRows] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => {
    fetchOrgInvitations(org.org_id || org.id).then(setRows).catch((e) => setMsg({ kind: 'error', text: e.message }));
  }, [org]);
  useEffect(() => {
    load();
  }, [load]);
  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await inviteOrgAdmin(org.org_id || org.id, email, name);
      setMsg({ kind: 'ok', text: `${en('', 'Invitation created. Ask')} ${r.email} ${en('', 'to register with that e-mail; they become an admin of this institution automatically.')}` });
      setEmail('');
      setName('');
      load();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const status = (r) => (r.accepted_at ? en('', 'Accepted') : r.revoked_at ? en('', 'Revoked') : new Date(r.expires_at) < new Date() ? en('', 'Expired') : en('', 'Pending'));
  return (
    <Dialog wide title={`${en('', 'Admins & invitations')} · ${org.name_en}`} onClose={onClose}>
      <form onSubmit={invite} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
        <label className="text-sm font-semibold text-ink-green-900">{en('', 'Admin e-mail')}
          <input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="text-sm font-semibold text-ink-green-900">{en('', 'Full name (optional)')}
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className={primary} disabled={busy || !email}>{en('', 'Invite admin')}</button>
      </form>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="overflow-x-auto rounded-[12px] border border-sand-border">
        <table className="min-w-full text-sm">
          <thead className="bg-parchment-50 text-left text-xs uppercase tracking-wider text-ink-text-muted">
            <tr><th className="px-3 py-2">{en('', 'E-mail')}</th><th className="px-3 py-2">{en('', 'Role')}</th><th className="px-3 py-2">{en('', 'Status')}</th><th className="px-3 py-2">{en('', 'Sign-up link')}</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {(rows || []).map((r) => {
              const pending = !r.accepted_at && !r.revoked_at && new Date(r.expires_at) > new Date();
              const link = `${window.location.origin}/register?email=${encodeURIComponent(r.email)}`;
              return (
                <tr key={r.id} className="border-t border-sand-border">
                  <td className="px-3 py-2">{r.email}{r.full_name ? <div className="text-xs text-ink-text-muted">{r.full_name}</div> : null}</td>
                  <td className="px-3 py-2 text-xs">{pretty(r.role === 'user' ? r.account_type : r.role)}</td>
                  <td className="px-3 py-2 text-xs font-semibold">{status(r)}</td>
                  <td className="px-3 py-2 text-xs">
                    {pending && (
                      <button type="button" className="text-emerald-700 underline" onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg({ kind: 'ok', text: en('', 'Sign-up link copied.') }))}>
                        {en('', 'Copy link')}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {pending && (
                      <button type="button" className={danger} onClick={() => revokeInvitation(r.id).then(load).catch((e) => setMsg({ kind: 'error', text: e.message }))}>
                        {en('', 'Revoke')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows && !rows.length && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-text-muted">{en('', 'No invitations yet.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
export function HealthTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    fetchPlatformHealth().then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-ink-text-muted">{en('', 'Loading…')}</p>;
  const channels = [...new Set(data.outbox.map((r) => r.channel))];
  const count = (c, s) => data.outbox.filter((r) => r.channel === c && r.status === s).reduce((a, r) => a + r.count, 0);
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-text-secondary">{en('', 'Message delivery over the last 7 days, failures, and what needs attention in each college.')}</p>
        <button type="button" className={secondary} onClick={load}>{en('', 'Refresh')}</button>
      </div>
      {data.stuck > 0 && (
        <Notice kind="error">{data.stuck} {en('', 'messages have been waiting more than an hour — check the send-outbound job and provider credentials.')}</Notice>
      )}
      <div className="overflow-x-auto rounded-[14px] border border-sand-border bg-paper-white">
        <table className="min-w-full text-sm">
          <thead className="bg-parchment-50 text-left text-xs uppercase tracking-wider text-ink-text-muted">
            <tr><th className="px-3 py-2">{en('', 'Channel')}</th><th className="px-3 py-2">{en('', 'Sent')}</th><th className="px-3 py-2">{en('', 'Waiting')}</th><th className="px-3 py-2">{en('', 'Failed')}</th><th className="px-3 py-2">{en('', 'Skipped')}</th></tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c} className="border-t border-sand-border">
                <td className="px-3 py-2 font-semibold uppercase">{c}</td>
                <td className="px-3 py-2">{count(c, 'sent')}</td>
                <td className="px-3 py-2">{count(c, 'pending') + count(c, 'sending')}</td>
                <td className={`px-3 py-2 ${count(c, 'failed') ? 'font-bold text-feedback-danger' : ''}`}>{count(c, 'failed')}</td>
                <td className="px-3 py-2">{count(c, 'skipped')}</td>
              </tr>
            ))}
            {!channels.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-text-muted">{en('', 'No messages in the last 7 days.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-[14px] border border-sand-border bg-paper-white">
        <table className="min-w-full text-sm">
          <thead className="bg-parchment-50 text-left text-xs uppercase tracking-wider text-ink-text-muted">
            <tr><th className="px-3 py-2">{en('', 'College')}</th><th className="px-3 py-2">{en('', 'Status')}</th><th className="px-3 py-2">{en('', 'Pending approvals')}</th><th className="px-3 py-2">{en('', 'New users (7d)')}</th><th className="px-3 py-2">{en('', 'Failed messages (7d)')}</th><th className="px-3 py-2">{en('', 'Open invitations')}</th></tr>
          </thead>
          <tbody>
            {data.colleges.map((c) => (
              <tr key={c.id} className="border-t border-sand-border">
                <td className="px-3 py-2 font-semibold text-ink-green-900">{c.name_en}</td>
                <td className="px-3 py-2 text-xs">{c.status}</td>
                <td className={`px-3 py-2 ${c.pending_approvals ? 'font-bold text-amber-800' : ''}`}>{c.pending_approvals}</td>
                <td className="px-3 py-2">{c.new_users_7d}</td>
                <td className={`px-3 py-2 ${c.failed_messages_7d ? 'font-bold text-feedback-danger' : ''}`}>{c.failed_messages_7d}</td>
                <td className="px-3 py-2">{c.open_invitations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-[14px] border border-sand-border bg-paper-white p-4">
        <h3 className="mb-2 font-serif font-semibold text-ink-green-900">{en('', 'Recent delivery failures')}</h3>
        {!data.recent_failures.length ? (
          <p className="text-sm text-ink-text-muted">{en('', 'No failures.')}</p>
        ) : (
          <ul className="divide-y divide-sand-border text-sm">
            {data.recent_failures.map((f, i) => (
              <li key={i} className="py-2">
                <span className="font-semibold uppercase">{f.channel}</span> · {f.org || '—'} · <span className="font-mono">{f.to_masked}</span> · {new Date(f.created_at).toLocaleString()}
                <div className="text-xs text-feedback-danger">{f.error}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function BroadcastTab({ organizations = [] }) {
  const [form, setForm] = useState({ title: '', message: '', audience: 'admins', orgs: [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    const scope = form.orgs.length ? `${form.orgs.length} ${en('', 'selected college(s)')}` : en('', 'every active college');
    if (!window.confirm(`${en('', 'Send this notice to')} ${pretty(form.audience)} ${en('', 'in')} ${scope}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const n = await platformBroadcast(form.title, form.message, form.audience, form.orgs);
      setMsg({ kind: 'ok', text: `${en('', 'Sent to')} ${n} ${en('', 'people.')}` });
      setForm((f) => ({ ...f, title: '', message: '' }));
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const toggleOrg = (id) => setForm((f) => ({ ...f, orgs: f.orgs.includes(id) ? f.orgs.filter((x) => x !== id) : [...f.orgs, id] }));
  return (
    <form onSubmit={send} className="max-w-3xl space-y-4 rounded-[14px] border border-sand-border bg-paper-white p-5">
      <p className="text-sm text-ink-text-secondary">{en('', 'Notices appear in each recipient\'s notification bell and are pushed to their phone. Use them for maintenance windows, new features or policy changes.')}</p>
      <label className="block text-sm font-semibold text-ink-green-900">{en('', 'Title')}
        <input required maxLength={200} className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </label>
      <label className="block text-sm font-semibold text-ink-green-900">{en('', 'Message')}
        <textarea required rows={4} maxLength={4000} className={inputCls} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
      </label>
      <label className="block text-sm font-semibold text-ink-green-900">{en('', 'Who receives it')}
        <select className={inputCls} value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}>
          <option value="admins">{en('', 'College admins')}</option>
          <option value="staff">{en('', 'Admins and all approved staff')}</option>
          <option value="everyone">{en('', 'Everyone (students, parents, staff)')}</option>
        </select>
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink-green-900">{en('', 'Colleges (none selected = all active colleges)')}</legend>
        <div className="flex flex-wrap gap-2">
          {organizations.map((o) => (
            <button key={o.org_id} type="button" onClick={() => toggleOrg(o.org_id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${form.orgs.includes(o.org_id) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-sand-border text-ink-text-secondary'}`}>
              {o.name_en}
            </button>
          ))}
        </div>
      </fieldset>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <button type="submit" className={primary} disabled={busy || !form.title.trim() || !form.message.trim()}>{en('', 'Send notice')}</button>
    </form>
  );
}
