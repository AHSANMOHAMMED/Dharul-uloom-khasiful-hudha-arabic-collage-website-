import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureFlagsContext';
import KhatamPattern from '../components/KhatamPattern';
import PlatformPanel from '../components/erp/campus/PlatformPanel';
import {
  FEATURE_META,
  clearOrgFeature,
  fetchPlatformControlHistory,
  fetchPlatformControls,
  fetchPlatformUsers,
  setOrgFeature,
  setPlatformFeature,
  setPlatformUserApproved,
} from '../lib/platformApi';
import { setActingOrg } from '../lib/erp/governanceApi';

// Platform operator console stays English + LTR so RTL never truncates labels (e.g. "Disabled" → "bled").
const en = (_ar, english) => english;

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'features', label: 'Global features', icon: 'toggle_on' },
  { id: 'tenants', label: 'Institutions', icon: 'apartment' },
  { id: 'org-features', label: 'Per-college features', icon: 'tune' },
  { id: 'users', label: 'All users', icon: 'group' },
  { id: 'history', label: 'Control log', icon: 'history' },
];

const GROUPS = [
  { id: 'public', label: 'Public site' },
  { id: 'access', label: 'Access & portals' },
  { id: 'finance', label: 'Payments' },
  { id: 'erp', label: 'Campus ERP modules' },
];

function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}: ${checked ? 'Enabled' : 'Disabled'}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      dir="ltr"
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
        checked ? 'border-emerald-700 bg-emerald-700' : 'border-sand-border bg-parchment-50'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SuperAdminConsole() {
  const auth = useAuth();
  const { refreshFeatures } = useFeatures();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const setTab = (id) => setParams({ tab: id }, { replace: true });

  const [controls, setControls] = useState(null);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [orgId, setOrgId] = useState('');

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) {
      navigate('/login', { replace: true, state: { from: '/platform' } });
    }
  }, [auth.loading, auth.isAuthenticated, navigate]);

  const loadControls = async () => {
    const data = await fetchPlatformControls();
    setControls(data);
    if (!orgId && data?.organizations?.[0]?.org_id) {
      setOrgId(data.organizations[0].org_id);
    }
  };

  const reloadAll = async () => {
    setBusy(true);
    setError('');
    try {
      await loadControls();
      if (tab === 'users' || tab === 'overview') {
        setUsers(await fetchPlatformUsers(search));
      }
      if (tab === 'history' || tab === 'overview') {
        setHistory(await fetchPlatformControlHistory(40));
      }
      await refreshFeatures();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!auth.isSuperAdmin) return undefined;
    reloadAll();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isSuperAdmin, tab]);

  const selectedOrg = useMemo(
    () => (controls?.organizations || []).find((o) => o.org_id === orgId) || null,
    [controls, orgId]
  );

  if (auth.loading || !auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment-50">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // College admins stay on /admin — only platform operators use this console.
  if (!auth.isSuperAdmin) {
    return <Navigate to={auth.isAdmin ? '/admin' : '/dashboard'} replace />;
  }

  const toggleGlobal = async (key, enabled) => {
    setBusy(true);
    setError('');
    try {
      await setPlatformFeature(key, enabled);
      await loadControls();
      await refreshFeatures();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleOrg = async (key, enabled) => {
    if (!orgId) return;
    setBusy(true);
    setError('');
    try {
      await setOrgFeature(orgId, key, enabled);
      await loadControls();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const resetOrg = async (key) => {
    if (!orgId) return;
    setBusy(true);
    try {
      await clearOrgFeature(orgId, key);
      await loadControls();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const effectiveGlobal = (key) => {
    const g = controls?.global?.[key];
    if (typeof g === 'boolean') return g;
    return controls?.defaults?.[key] !== false;
  };

  const orgOverride = (key) => {
    const v = selectedOrg?.features?.[key];
    return typeof v === 'boolean' ? v : null;
  };

  const orgEffective = (key) => {
    const v = selectedOrg?.effective?.[key];
    if (typeof v === 'boolean') return v;
    return effectiveGlobal(key);
  };

  return (
    <div dir="ltr" lang="en" className="min-h-screen bg-parchment-50 text-ink-text-primary relative overflow-hidden">
      <KhatamPattern className="opacity-[0.03]" strokeColor="#0B3B2E" id="sa-console-khatam" />
      <header className="relative z-10 border-b border-sand-border bg-ink-green-900 text-paper-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-gold-500">
              {en('مشغل المنصة', 'Platform operator')}
            </p>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">
              {en('لوحة المدير العام الأعلى', 'Super Admin Console')}
            </h1>
            <p className="mt-1 text-xs text-dark-text-primary/75">
              {en(
                'تحكم كامل بالمؤسسات والميزات والمستخدمين عبر كل الكليات.',
                'Full control of institutions, features and users across every college.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={reloadAll}
              className="rounded-[10px] border border-sand-border/30 bg-paper-white/10 px-3 py-2 text-xs font-semibold hover:bg-paper-white/20"
            >
              {en('تحديث', 'Refresh')}
            </button>
            <Link
              to="/erp?module=dashboard"
              className="rounded-[10px] bg-[#e77835] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ce6327]"
            >
              {en('فتح ERP كمؤسسة', 'Open ERP (acting org)')}
            </Link>
            <button
              type="button"
              onClick={() => auth.logout()}
              className="rounded-[10px] border border-sand-border/30 px-3 py-2 text-xs font-semibold hover:bg-paper-white/10"
            >
              {en('تسجيل الخروج', 'Sign out')}
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                tab === item.id
                  ? 'bg-paper-white text-ink-green-900'
                  : 'text-dark-text-primary/80 hover:bg-paper-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="rounded-[12px] border border-feedback-danger/30 bg-feedback-danger/5 px-4 py-3 text-sm text-feedback-danger">
            {error}
          </div>
        )}

        {tab === 'overview' && (
          <div className="grid gap-4 md:grid-cols-4">
            {[
              [en('المؤسسات', 'Institutions'), controls?.organizations?.length || 0],
              [en('نشطة', 'Active'), (controls?.organizations || []).filter((o) => ['active', 'trial'].includes(o.status)).length],
              [en('المستخدمون', 'Users'), users.length],
              [en('آخر تغييرات التحكم', 'Recent control changes'), history.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[14px] border border-sand-border bg-paper-white p-5 shadow-manuscript-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-text-muted">{label}</p>
                <p className="mt-2 font-serif text-3xl font-semibold text-ink-green-900">{value}</p>
              </div>
            ))}
            <div className="md:col-span-4 rounded-[14px] border border-sand-border bg-paper-white p-5">
              <h2 className="font-serif text-lg font-semibold text-ink-green-900 mb-3">
                {en('مسارات سريعة', 'Quick paths')}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white" onClick={() => setTab('features')}>
                  {en('تفعيل / تعطيل الميزات', 'Enable / disable features')}
                </button>
                <button type="button" className="rounded-lg border border-sand-border px-3 py-2 text-xs font-semibold" onClick={() => setTab('tenants')}>
                  {en('إدارة المؤسسات', 'Manage institutions')}
                </button>
                <button type="button" className="rounded-lg border border-sand-border px-3 py-2 text-xs font-semibold" onClick={() => setTab('users')}>
                  {en('اعتماد المستخدمين', 'Approve users')}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'features' && (
          <section className="space-y-5">
            <p className="text-sm text-ink-text-secondary">
              {en(
                'التعطيل العام يغلق الميزة لكل الكليات ما لم تُفعَّل صراحة لكل كلية.',
                'A global off switch disables the feature for every college unless that college has an explicit on override.'
              )}
            </p>
            {GROUPS.map((group) => (
              <div key={group.id} className="rounded-[14px] border border-sand-border bg-paper-white overflow-hidden">
                <div className="border-b border-sand-border bg-parchment-50 px-4 py-3 font-serif font-semibold text-ink-green-900">
                  {group.label}
                </div>
                <ul className="divide-y divide-sand-border">
                  {FEATURE_META.filter((f) => f.group === group.id).map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-ink-green-900">{f.label[0]}</p>
                        <p className="text-[11px] text-ink-text-muted font-mono">{f.key}</p>
                      </div>
                      <Toggle
                        checked={effectiveGlobal(f.key)}
                        disabled={busy}
                        label={f.label[0]}
                        onChange={(on) => toggleGlobal(f.key, on)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {tab === 'tenants' && (
          <div className="rounded-[14px] border border-sand-border bg-paper-white p-4 sm:p-6">
            <PlatformPanel />
          </div>
        )}

        {tab === 'org-features' && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold text-ink-green-900">
                {en('الكلية', 'College')}
                <select
                  className="mt-1 block min-w-[240px] rounded-[10px] border border-sand-border bg-paper-white px-3 py-2 text-sm"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                >
                  {(controls?.organizations || []).map((o) => (
                    <option key={o.org_id} value={o.org_id}>
                      {o.name_en} ({o.slug})
                    </option>
                  ))}
                </select>
              </label>
              {selectedOrg && (
                <button
                  type="button"
                  className="rounded-[10px] bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
                  onClick={async () => {
                    await setActingOrg(selectedOrg.org_id);
                    window.location.assign('/erp?module=dashboard');
                  }}
                >
                  {en('إدارة هذه المؤسسة الآن', 'Manage this college now')}
                </button>
              )}
            </div>
            {GROUPS.map((group) => (
              <div key={group.id} className="rounded-[14px] border border-sand-border bg-paper-white overflow-hidden">
                <div className="border-b border-sand-border bg-parchment-50 px-4 py-3 font-serif font-semibold text-ink-green-900">
                  {group.label}
                </div>
                <ul className="divide-y divide-sand-border">
                  {FEATURE_META.filter((f) => f.group === group.id).map((f) => {
                    const override = orgOverride(f.key);
                    return (
                      <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-green-900">{f.label[0]}</p>
                          <p className="text-[11px] text-ink-text-muted">
                            {override === null
                              ? en('يتبع الإعداد العام', 'Follows global')
                              : override
                                ? en('مفعّل لهذه الكلية', 'Forced on for this college')
                                : en('معطّل لهذه الكلية', 'Forced off for this college')}
                            {' · '}
                            {en('الفعلي:', 'Effective:')}{' '}
                            <b>{orgEffective(f.key) ? en('تشغيل', 'On') : en('إيقاف', 'Off')}</b>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {override !== null && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => resetOrg(f.key)}
                              className="rounded-lg border border-sand-border px-2 py-1 text-[11px] font-semibold"
                            >
                              {en('إعادة للافتراضي', 'Reset')}
                            </button>
                          )}
                          <Toggle
                            checked={orgEffective(f.key)}
                            disabled={busy || !orgId}
                            label={f.label[0]}
                            onChange={(on) => toggleOrg(f.key, on)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        )}

        {tab === 'users' && (
          <section className="space-y-4">
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  setUsers(await fetchPlatformUsers(search));
                } catch (err) {
                  setError(err.message || String(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={en('بحث بالاسم أو البريد أو الكلية…', 'Search name, email or college…')}
                className="min-w-[240px] flex-1 rounded-[10px] border border-sand-border px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-[10px] bg-emerald-700 px-4 py-2 text-xs font-semibold text-white">
                {en('بحث', 'Search')}
              </button>
            </form>
            <div className="overflow-x-auto rounded-[14px] border border-sand-border bg-paper-white">
              <table className="min-w-full text-sm">
                <thead className="bg-parchment-50 text-left text-xs uppercase tracking-wider text-ink-text-muted">
                  <tr>
                    <th className="px-3 py-2">{en('المستخدم', 'User')}</th>
                    <th className="px-3 py-2">{en('الدور', 'Role')}</th>
                    <th className="px-3 py-2">{en('الكلية', 'College')}</th>
                    <th className="px-3 py-2">{en('الحالة', 'Status')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-sand-border">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-ink-green-900">{u.full_name || '—'}</div>
                        <div className="text-xs text-ink-text-muted">{u.email}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {u.account_type}
                        {u.assigned_tutor_role && u.assigned_tutor_role !== 'none' ? ` · ${u.assigned_tutor_role}` : ''}
                        {u.role !== 'user' ? ` · ${u.role}` : ''}
                      </td>
                      <td className="px-3 py-2 text-xs">{u.org_name || u.org_slug || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.is_approved ? 'bg-mint-wash-100 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                          {u.is_approved ? en('معتمد', 'Approved') : en('قيد الانتظار', 'Pending')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-lg border border-sand-border px-2 py-1 text-[11px] font-semibold"
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await setPlatformUserApproved(u.id, !u.is_approved);
                              setUsers(await fetchPlatformUsers(search));
                            } catch (err) {
                              setError(err.message || String(err));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {u.is_approved ? en('إلغاء الاعتماد', 'Revoke') : en('اعتماد', 'Approve')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'history' && (
          <div className="overflow-x-auto rounded-[14px] border border-sand-border bg-paper-white">
            <table className="min-w-full text-sm">
              <thead className="bg-parchment-50 text-left text-xs uppercase tracking-wider text-ink-text-muted">
                <tr>
                  <th className="px-3 py-2">{en('الوقت', 'When')}</th>
                  <th className="px-3 py-2">{en('النطاق', 'Scope')}</th>
                  <th className="px-3 py-2">{en('الميزة', 'Feature')}</th>
                  <th className="px-3 py-2">{en('القيمة', 'Value')}</th>
                  <th className="px-3 py-2">{en('ملاحظة', 'Note')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-t border-sand-border">
                    <td className="px-3 py-2 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{row.scope}{row.org_id ? ` · ${String(row.org_id).slice(0, 8)}` : ''}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.feature_key}</td>
                    <td className="px-3 py-2 text-xs font-semibold">{row.enabled ? 'ON' : 'OFF'}</td>
                    <td className="px-3 py-2 text-xs text-ink-text-muted">{row.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
