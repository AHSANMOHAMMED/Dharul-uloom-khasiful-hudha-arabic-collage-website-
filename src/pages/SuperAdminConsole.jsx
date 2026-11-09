import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
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
import {
  ROLE_TEMPLATE_KEYS,
  STAFF_HATS,
  addCommunityMember,
  createCommunity,
  createCommunityPost,
  fetchPlatformAuditFeed,
  listCommunities,
  listCommunityMembers,
  listCommunityPosts,
  listRoleFeatures,
  listUserFeatures,
  platformDeactivateUser,
  platformInviteUser,
  platformUpdateUser,
  setRoleFeature,
  setUserFeature,
  clearUserFeature,
} from '../lib/platformControlApi';
import { setActingOrg } from '../lib/erp/governanceApi';
import PageNavBar from '../components/PageNavBar';
import { BroadcastTab, HealthTab, UserAuthActions } from '../components/platform/PlatformOps';

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'tenants', label: 'Institutions', icon: 'apartment' },
  { id: 'users', label: 'Users & roles', icon: 'group' },
  { id: 'features', label: 'Feature access', icon: 'tune' },
  { id: 'communities', label: 'Communities', icon: 'diversity_3' },
  { id: 'erp', label: 'ERP workspace', icon: 'domain' },
  { id: 'finance', label: 'Finance hub', icon: 'account_balance' },
  { id: 'audit', label: 'Audit & deletes', icon: 'history_edu' },
  { id: 'history', label: 'Control log', icon: 'history' },
  { id: 'health', label: 'Health', icon: 'monitor_heart' },
  // Institution chat is per college (the database refuses it for super admins);
  // platform-wide notices go out through Broadcast.
  { id: 'broadcast', label: 'Broadcast', icon: 'campaign' },
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
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function SuperAdminConsole() {
  const auth = useAuth();
  const { refreshFeatures } = useFeatures();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get('section') || params.get('tab') || 'overview';
  const section = requested === 'messages' ? 'broadcast' : NAV.some((n) => n.id === requested) ? requested : 'overview';
  // Push (not replace) so browser Back/Forward move between console sections.
  const setSection = (id) => setParams(id === 'overview' ? {} : { section: id });

  const [controls, setControls] = useState(null);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [audit, setAudit] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [orgId, setOrgId] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [featureScope, setFeatureScope] = useState('global');
  const [roleKey, setRoleKey] = useState('accountant');
  const [roleFeatures, setRoleFeatures] = useState([]);
  const [editUser, setEditUser] = useState(null);
  const [userOverrides, setUserOverrides] = useState([]);
  const [invite, setInvite] = useState({
    email: '', fullName: '', accountType: 'staff', role: 'user', assignedTutorRole: 'none', approve: true,
  });
  const [communities, setCommunities] = useState([]);
  const [communityForm, setCommunityForm] = useState({ kind: 'alumni', name_en: '', name_ar: '', description: '' });
  const [activeCommunity, setActiveCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [postBody, setPostBody] = useState('');
  const [memberUserId, setMemberUserId] = useState('');

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) navigate('/login', { replace: true, state: { from: '/platform' } });
  }, [auth.loading, auth.isAuthenticated, navigate]);

  const loadControls = async () => {
    const data = await fetchPlatformControls();
    setControls(data);
    if (!orgId && data?.organizations?.[0]?.org_id) setOrgId(data.organizations[0].org_id);
  };

  const reloadAll = async () => {
    setBusy(true);
    setError('');
    try {
      await loadControls();
      if (['users', 'overview', 'communities'].includes(section)) setUsers(await fetchPlatformUsers(search));
      if (['history', 'overview'].includes(section)) setHistory(await fetchPlatformControlHistory(40));
      if (section === 'audit') setAudit(await fetchPlatformAuditFeed({ orgId: orgId || null, limit: 80 }));
      if (section === 'features' && featureScope === 'role') setRoleFeatures(await listRoleFeatures(roleKey));
      if (section === 'communities') {
        const rows = await listCommunities(orgId || null);
        setCommunities(rows);
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
  }, [auth.isSuperAdmin, section, featureScope, roleKey]);

  const selectedOrg = useMemo(
    () => (controls?.organizations || []).find((o) => o.org_id === orgId) || null,
    [controls, orgId],
  );

  if (auth.loading || !auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment-50">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!auth.isSuperAdmin) return <Navigate to={auth.isAdmin ? '/admin' : '/dashboard'} replace />;

  const toggleGlobal = async (key, enabled) => {
    setBusy(true); setError('');
    try { await setPlatformFeature(key, enabled); await loadControls(); await refreshFeatures(); }
    catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); }
  };
  const toggleOrg = async (key, enabled) => {
    if (!orgId) return;
    setBusy(true); setError('');
    try { await setOrgFeature(orgId, key, enabled); await loadControls(); }
    catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); }
  };
  const resetOrg = async (key) => {
    if (!orgId) return;
    setBusy(true);
    try { await clearOrgFeature(orgId, key); await loadControls(); }
    catch (e) { setError(e.message || String(e)); }
    finally { setBusy(false); }
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
  const roleEnabled = (key) => {
    const row = roleFeatures.find((r) => r.feature_key === key);
    return row ? row.enabled : true;
  };

  const openUserEditor = async (u) => {
    setEditUser({ ...u, assigned_tutor_role: u.assigned_tutor_role || 'none' });
    try { setUserOverrides(await listUserFeatures(u.id)); }
    catch (e) { setError(e.message || String(e)); setUserOverrides([]); }
  };

  const enterCollege = async (module = 'dashboard') => {
    if (!orgId) return;
    await setActingOrg(orgId);
    window.location.assign(`/erp?module=${module}`);
  };

  const navBtn = (item) => (
    <button
      key={item.id}
      type="button"
      onClick={() => { setSection(item.id); setMobileNav(false); }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
        section === item.id ? 'bg-emerald-700 text-white' : 'text-ink-green-900 hover:bg-parchment-50'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
      {item.label}
    </button>
  );

  return (
    <div dir="ltr" lang="en" className="min-h-screen bg-parchment-50 text-ink-text-primary flex relative overflow-hidden">
      <KhatamPattern className="opacity-[0.03]" strokeColor="#0B3B2E" id="sa-console-khatam" />

      {mobileNav && <div className="fixed inset-0 z-40 bg-ink-green-900/40 lg:hidden" onClick={() => setMobileNav(false)} aria-hidden />}

      <aside className={`fixed inset-y-0 start-0 z-50 w-72 border-e border-sand-border bg-paper-white flex flex-col transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-sand-border bg-ink-green-900 text-paper-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-gold-500">Platform operator</p>
          <h1 className="font-serif text-xl font-semibold mt-1">Super Admin</h1>
          <p className="text-xs text-white/70 mt-1">Full control across colleges, users, ACL, communities & ERP.</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">{NAV.map(navBtn)}</nav>
        <div className="border-t border-sand-border p-3 space-y-2">
          <button type="button" disabled={busy} onClick={reloadAll} className="w-full rounded-lg border border-sand-border px-3 py-2 text-xs font-semibold">Refresh</button>
        </div>
      </aside>

      <div className="flex-1 lg:ms-72 min-w-0 relative z-10">
        <header className="sticky top-0 z-20 border-b border-sand-border bg-paper-white/95 backdrop-blur px-4 py-3 flex items-center gap-3">
          <button type="button" className="lg:hidden rounded-lg border border-sand-border p-2" onClick={() => setMobileNav(true)} aria-label="Open menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-semibold text-ink-green-900 truncate">{NAV.find((n) => n.id === section)?.label || 'Overview'}</h2>
          </div>
          <div className="ms-auto flex flex-wrap gap-2 items-center">
            <select className="rounded-lg border border-sand-border px-2 py-1.5 text-xs" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {(controls?.organizations || []).map((o) => (
                <option key={o.org_id} value={o.org_id}>{o.name_en}</option>
              ))}
            </select>
            <button type="button" className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white" onClick={() => enterCollege('dashboard')}>
              Manage college
            </button>
            <button
              type="button"
              onClick={() => auth.logout()}
              className="inline-flex items-center gap-1 rounded-lg border border-[#991B1B]/20 bg-[#FEE2E2]/70 hover:bg-[#FEE2E2] px-2.5 py-1.5 text-xs font-bold text-[#991B1B]"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              Sign out
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 space-y-6 max-w-[1400px]">
          <PageNavBar
            home={{ onClick: () => setSection('overview'), label: 'Overview' }}
            crumbs={[
              { label: 'Super Admin', onClick: () => setSection('overview') },
              ...(section === 'overview' ? [] : [{ label: NAV.find((n) => n.id === section)?.label || section }]),
            ]}
          />
          {error && <div className="rounded-[12px] border border-feedback-danger/30 bg-feedback-danger/5 px-4 py-3 text-sm text-feedback-danger">{error}</div>}

          {section === 'overview' && (
            <div className="grid gap-4 md:grid-cols-4">
              {[
                ['Institutions', controls?.organizations?.length || 0],
                ['Active', (controls?.organizations || []).filter((o) => ['active', 'trial'].includes(o.status)).length],
                ['Users (sample)', users.length],
                ['Control changes', history.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[14px] border border-sand-border bg-paper-white p-5 shadow-manuscript-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-text-muted">{label}</p>
                  <p className="mt-2 font-serif text-3xl font-semibold text-ink-green-900">{value}</p>
                </div>
              ))}
              <div className="md:col-span-4 rounded-[14px] border border-sand-border bg-paper-white p-5 flex flex-wrap gap-2">
                {[['users', 'Invite / approve users'], ['features', 'Feature ACL'], ['communities', 'Communities'], ['finance', 'Open finance in ERP']].map(([id, label]) => (
                  <button key={id} type="button" className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white" onClick={() => (id === 'finance' ? enterCollege('financehub') : setSection(id))}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {section === 'tenants' && (
            <div className="rounded-[14px] border border-sand-border bg-paper-white p-4 sm:p-6">
              <PlatformPanel />
            </div>
          )}

          {section === 'users' && (
            <section className="space-y-4">
              <div className="rounded-[14px] border border-sand-border bg-paper-white p-4 space-y-3">
                <h3 className="font-serif font-semibold text-ink-green-900">Invite user (any role)</h3>
                <div className="grid sm:grid-cols-3 gap-2">
                  <input className="rounded-lg border border-sand-border px-3 py-2 text-sm" placeholder="Email" value={invite.email} onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))} />
                  <input className="rounded-lg border border-sand-border px-3 py-2 text-sm" placeholder="Full name" value={invite.fullName} onChange={(e) => setInvite((i) => ({ ...i, fullName: e.target.value }))} />
                  <select className="rounded-lg border border-sand-border px-3 py-2 text-sm" value={invite.accountType} onChange={(e) => setInvite((i) => ({ ...i, accountType: e.target.value }))}>
                    {['student', 'parent', 'tutor', 'staff', 'guest'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select className="rounded-lg border border-sand-border px-3 py-2 text-sm" value={invite.role} onChange={(e) => setInvite((i) => ({ ...i, role: e.target.value }))}>
                    {['user', 'librarian', 'admin'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <select className="rounded-lg border border-sand-border px-3 py-2 text-sm" value={invite.assignedTutorRole} onChange={(e) => setInvite((i) => ({ ...i, assignedTutorRole: e.target.value }))}>
                    {STAFF_HATS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !invite.email || !orgId}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
                    onClick={async () => {
                      setBusy(true); setError('');
                      try {
                        const res = await platformInviteUser({
                          orgId, email: invite.email, fullName: invite.fullName,
                          accountType: invite.accountType, role: invite.role,
                          assignedTutorRole: invite.assignedTutorRole, approve: invite.approve,
                        });
                        setInvite((i) => ({ ...i, email: '', fullName: '' }));
                        window.alert(`Invite created. Token: ${res.token}`);
                        setUsers(await fetchPlatformUsers(search));
                      } catch (e) { setError(e.message || String(e)); }
                      finally { setBusy(false); }
                    }}
                  >
                    Send invite
                  </button>
                </div>
              </div>

              <form className="flex flex-wrap gap-2" onSubmit={async (e) => {
                e.preventDefault(); setBusy(true);
                try { setUsers(await fetchPlatformUsers(search)); }
                catch (err) { setError(err.message || String(err)); }
                finally { setBusy(false); }
              }}>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or college…" className="min-w-[240px] flex-1 rounded-[10px] border border-sand-border px-3 py-2 text-sm" />
                <button type="submit" className="rounded-[10px] bg-emerald-700 px-4 py-2 text-xs font-semibold text-white">Search</button>
              </form>

              <div className="overflow-x-auto rounded-[14px] border border-sand-border bg-paper-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-parchment-50 text-left text-xs uppercase tracking-wider text-ink-text-muted">
                    <tr>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">College</th>
                      <th className="px-3 py-2">Status</th>
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
                            {u.is_approved ? 'Approved' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right space-x-1">
                          <button type="button" className="rounded-lg border border-sand-border px-2 py-1 text-[11px] font-semibold" onClick={() => openUserEditor(u)}>Edit</button>
                          <button type="button" disabled={busy} className="rounded-lg border border-sand-border px-2 py-1 text-[11px] font-semibold" onClick={async () => {
                            setBusy(true);
                            try { await setPlatformUserApproved(u.id, !u.is_approved); setUsers(await fetchPlatformUsers(search)); }
                            catch (err) { setError(err.message || String(err)); }
                            finally { setBusy(false); }
                          }}>{u.is_approved ? 'Revoke' : 'Approve'}</button>
                          <button type="button" disabled={busy} className="rounded-lg border border-sand-border px-2 py-1 text-[11px] font-semibold text-feedback-danger" onClick={async () => {
                            const reason = window.prompt('Deactivate reason?') || 'Deactivated by super admin';
                            setBusy(true);
                            try { await platformDeactivateUser(u.id, reason); setUsers(await fetchPlatformUsers(search)); }
                            catch (err) { setError(err.message || String(err)); }
                            finally { setBusy(false); }
                          }}>Deactivate</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editUser && (
                <div className="rounded-[14px] border border-sand-border bg-paper-white p-4 space-y-3">
                  <div className="flex justify-between gap-2">
                    <h3 className="font-serif font-semibold">Edit {editUser.full_name || editUser.email}</h3>
                    <button type="button" className="text-xs underline" onClick={() => setEditUser(null)}>Close</button>
                  </div>
                  <UserAuthActions userId={editUser.id} />
                  <div className="grid sm:grid-cols-3 gap-2">
                    <select className="rounded-lg border border-sand-border px-3 py-2 text-sm" value={editUser.org_id || ''} onChange={(e) => setEditUser((u) => ({ ...u, org_id: e.target.value }))}>
                      {(controls?.organizations || []).map((o) => <option key={o.org_id} value={o.org_id}>{o.name_en}</option>)}
                    </select>
                    <select className="rounded-lg border border-sand-border px-3 py-2 text-sm" value={editUser.account_type} onChange={(e) => setEditUser((u) => ({ ...u, account_type: e.target.value }))}>
                      {['student', 'parent', 'tutor', 'staff', 'guest'].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select className="rounded-lg border border-sand-border px-3 py-2 text-sm" value={editUser.role} onChange={(e) => setEditUser((u) => ({ ...u, role: e.target.value }))}>
                      {['user', 'librarian', 'admin'].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select className="rounded-lg border border-sand-border px-3 py-2 text-sm" value={editUser.assigned_tutor_role || 'none'} onChange={(e) => setEditUser((u) => ({ ...u, assigned_tutor_role: e.target.value }))}>
                      {STAFF_HATS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button type="button" disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white" onClick={async () => {
                      setBusy(true);
                      try {
                        await platformUpdateUser({
                          id: editUser.id, orgId: editUser.org_id, accountType: editUser.account_type,
                          role: editUser.role, assignedTutorRole: editUser.assigned_tutor_role,
                          fullName: editUser.full_name, isApproved: editUser.is_approved,
                        });
                        setUsers(await fetchPlatformUsers(search));
                        setEditUser(null);
                      } catch (e) { setError(e.message || String(e)); }
                      finally { setBusy(false); }
                    }}>Save user</button>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-ink-text-muted mb-2">Per-user feature overrides</h4>
                    <ul className="divide-y divide-sand-border max-h-64 overflow-y-auto">
                      {FEATURE_META.map((f) => {
                        const ov = userOverrides.find((r) => r.feature_key === f.key);
                        const checked = ov ? ov.enabled : true;
                        return (
                          <li key={f.key} className="flex items-center justify-between gap-2 py-2">
                            <span className="text-sm">{f.label[0]}</span>
                            <div className="flex items-center gap-2">
                              {ov && <button type="button" className="text-[11px] underline" onClick={async () => { await clearUserFeature(editUser.id, f.key); setUserOverrides(await listUserFeatures(editUser.id)); }}>Reset</button>}
                              <Toggle checked={checked} disabled={busy} label={f.label[0]} onChange={async (on) => {
                                await setUserFeature(editUser.id, f.key, on);
                                setUserOverrides(await listUserFeatures(editUser.id));
                              }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          )}

          {section === 'features' && (
            <section className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[['global', 'Global'], ['org', 'Per college'], ['role', 'Role templates']].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setFeatureScope(id)} className={`rounded-lg px-3 py-2 text-xs font-semibold border ${featureScope === id ? 'bg-emerald-700 text-white border-emerald-700' : 'border-sand-border bg-white'}`}>{label}</button>
                ))}
              </div>

              {featureScope === 'global' && GROUPS.map((group) => (
                <div key={group.id} className="rounded-[14px] border border-sand-border bg-paper-white overflow-hidden">
                  <div className="border-b border-sand-border bg-parchment-50 px-4 py-3 font-serif font-semibold text-ink-green-900">{group.label}</div>
                  <ul className="divide-y divide-sand-border">
                    {FEATURE_META.filter((f) => f.group === group.id).map((f) => (
                      <li key={f.key} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-green-900">{f.label[0]}</p>
                          <p className="text-[11px] text-ink-text-muted font-mono">{f.key}</p>
                        </div>
                        <Toggle checked={effectiveGlobal(f.key)} disabled={busy} label={f.label[0]} onChange={(on) => toggleGlobal(f.key, on)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {featureScope === 'org' && (
                <div className="space-y-4">
                  {GROUPS.map((group) => (
                    <div key={group.id} className="rounded-[14px] border border-sand-border bg-paper-white overflow-hidden">
                      <div className="border-b border-sand-border bg-parchment-50 px-4 py-3 font-serif font-semibold">{group.label}</div>
                      <ul className="divide-y divide-sand-border">
                        {FEATURE_META.filter((f) => f.group === group.id).map((f) => {
                          const override = orgOverride(f.key);
                          return (
                            <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold">{f.label[0]}</p>
                                <p className="text-[11px] text-ink-text-muted">
                                  {override === null ? 'Follows global' : override ? 'Forced on' : 'Forced off'} · Effective: <b>{orgEffective(f.key) ? 'On' : 'Off'}</b>
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {override !== null && <button type="button" disabled={busy} onClick={() => resetOrg(f.key)} className="rounded-lg border border-sand-border px-2 py-1 text-[11px] font-semibold">Reset</button>}
                                <Toggle checked={orgEffective(f.key)} disabled={busy || !orgId} label={f.label[0]} onChange={(on) => toggleOrg(f.key, on)} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {featureScope === 'role' && (
                <div className="space-y-3">
                  <select className="rounded-lg border border-sand-border px-3 py-2 text-sm" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
                    {ROLE_TEMPLATE_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <div className="rounded-[14px] border border-sand-border bg-paper-white overflow-hidden">
                    <ul className="divide-y divide-sand-border max-h-[60vh] overflow-y-auto">
                      {FEATURE_META.map((f) => (
                        <li key={f.key} className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="text-sm font-semibold">{f.label[0]}</span>
                          <Toggle checked={roleEnabled(f.key)} disabled={busy} label={f.label[0]} onChange={async (on) => {
                            setBusy(true);
                            try {
                              await setRoleFeature(roleKey, f.key, on);
                              setRoleFeatures(await listRoleFeatures(roleKey));
                            } catch (e) { setError(e.message || String(e)); }
                            finally { setBusy(false); }
                          }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          )}

          {section === 'communities' && (
            <section className="space-y-4">
              <div className="rounded-[14px] border border-sand-border bg-paper-white p-4 grid sm:grid-cols-4 gap-2">
                <select className="rounded-lg border border-sand-border px-3 py-2 text-sm" value={communityForm.kind} onChange={(e) => setCommunityForm((c) => ({ ...c, kind: e.target.value }))}>
                  {['alumni', 'staff_team', 'club', 'custom'].map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <input className="rounded-lg border border-sand-border px-3 py-2 text-sm" placeholder="Name (EN)" value={communityForm.name_en} onChange={(e) => setCommunityForm((c) => ({ ...c, name_en: e.target.value }))} />
                <input className="rounded-lg border border-sand-border px-3 py-2 text-sm" placeholder="Name (AR)" value={communityForm.name_ar} onChange={(e) => setCommunityForm((c) => ({ ...c, name_ar: e.target.value }))} />
                <button type="button" disabled={busy || !orgId || !communityForm.name_en.trim()} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white" onClick={async () => {
                  setBusy(true);
                  try {
                    await createCommunity({ org_id: orgId, ...communityForm, created_by: auth.user?.id });
                    setCommunityForm({ kind: 'alumni', name_en: '', name_ar: '', description: '' });
                    setCommunities(await listCommunities(orgId));
                  } catch (e) { setError(e.message || String(e)); }
                  finally { setBusy(false); }
                }}>Create community</button>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-[14px] border border-sand-border bg-paper-white overflow-hidden">
                  <ul className="divide-y divide-sand-border">
                    {communities.map((c) => (
                      <li key={c.id}>
                        <button type="button" className={`w-full text-start px-4 py-3 hover:bg-parchment-50 ${activeCommunity?.id === c.id ? 'bg-mint-wash-100/40' : ''}`} onClick={async () => {
                          setActiveCommunity(c);
                          setMembers(await listCommunityMembers(c.id));
                          setPosts(await listCommunityPosts(c.id));
                        }}>
                          <div className="font-semibold text-sm">{c.name_en}</div>
                          <div className="text-xs text-ink-text-muted">{c.kind} · {c.is_active ? 'active' : 'inactive'}</div>
                        </button>
                      </li>
                    ))}
                    {!communities.length && <li className="px-4 py-8 text-center text-xs text-ink-text-muted">No communities yet for this college.</li>}
                  </ul>
                </div>
                <div className="rounded-[14px] border border-sand-border bg-paper-white p-4 space-y-3">
                  {!activeCommunity ? <p className="text-sm text-ink-text-muted">Select a community.</p> : (
                    <>
                      <h3 className="font-serif font-semibold">{activeCommunity.name_en}</h3>
                      <div className="flex flex-wrap gap-2">
                        <select className="rounded-lg border border-sand-border px-2 py-1.5 text-xs flex-1 min-w-[160px]" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
                          <option value="">Add member…</option>
                          {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                        </select>
                        <button type="button" disabled={!memberUserId} className="rounded-lg border border-sand-border px-2 py-1.5 text-xs font-semibold" onClick={async () => {
                          await addCommunityMember(activeCommunity.id, memberUserId);
                          setMembers(await listCommunityMembers(activeCommunity.id));
                          setMemberUserId('');
                        }}>Add</button>
                      </div>
                      <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                        {members.map((m) => <li key={m.user_id}>{m.profiles?.full_name || m.user_id} · {m.member_role}</li>)}
                      </ul>
                      <textarea className="w-full rounded-lg border border-sand-border px-3 py-2 text-sm" rows={3} placeholder="Announcement…" value={postBody} onChange={(e) => setPostBody(e.target.value)} />
                      <button type="button" disabled={!postBody.trim()} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white" onClick={async () => {
                        await createCommunityPost(activeCommunity.id, activeCommunity.org_id, postBody.trim());
                        setPostBody('');
                        setPosts(await listCommunityPosts(activeCommunity.id));
                      }}>Post</button>
                      <ul className="text-sm space-y-2 max-h-48 overflow-y-auto">
                        {posts.map((p) => <li key={p.id} className="rounded-lg bg-parchment-50 px-3 py-2 text-xs">{p.body}<div className="text-[10px] text-ink-text-muted mt-1">{new Date(p.created_at).toLocaleString()}</div></li>)}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {section === 'erp' && (
            <div className="rounded-[14px] border border-sand-border bg-paper-white p-6 space-y-4">
              <p className="text-sm text-ink-text-secondary">Enter the selected college as acting org and open the full ERP. Hard deletes remain Super Admin only.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white" onClick={() => enterCollege('dashboard')}>Open ERP overview</button>
                <button type="button" className="rounded-lg border border-sand-border px-4 py-2 text-xs font-semibold" onClick={() => enterCollege('students')}>Students</button>
                <button type="button" className="rounded-lg border border-sand-border px-4 py-2 text-xs font-semibold" onClick={() => enterCollege('fees')}>Fees</button>
                <button type="button" className="rounded-lg border border-sand-border px-4 py-2 text-xs font-semibold" onClick={() => enterCollege('audit')}>College audit log</button>
              </div>
            </div>
          )}

          {section === 'finance' && (
            <div className="rounded-[14px] border border-sand-border bg-paper-white p-6 space-y-3">
              <p className="text-sm text-ink-text-secondary">Billing jobs, unified bills (fees/donations/sadaqah/items), letterhead quotations, and WhatsApp/SMS share links live in the ERP Finance Hub.</p>
              <button type="button" className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white" onClick={() => enterCollege('financehub')}>
                Open Finance Hub in ERP
              </button>
            </div>
          )}

          {section === 'audit' && (
            <div className="overflow-x-auto rounded-[14px] border border-sand-border bg-paper-white">
              <table className="min-w-full text-sm">
                <thead className="bg-parchment-50 text-left text-xs uppercase tracking-wider text-ink-text-muted">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Table</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Record</th>
                    <th className="px-3 py-2">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row) => (
                    <tr key={row.id} className="border-t border-sand-border">
                      <td className="px-3 py-2 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.table_name}</td>
                      <td className="px-3 py-2 text-xs font-semibold">{row.action}</td>
                      <td className="px-3 py-2 text-xs">{row.record_id}</td>
                      <td className="px-3 py-2 text-xs">{row.actor_role || row.actor_id || '—'}</td>
                    </tr>
                  ))}
                  {!audit.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-ink-text-muted">No audit rows.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {section === 'history' && (
            <div className="overflow-x-auto rounded-[14px] border border-sand-border bg-paper-white">
              <table className="min-w-full text-sm">
                <thead className="bg-parchment-50 text-left text-xs uppercase tracking-wider text-ink-text-muted">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Scope</th>
                    <th className="px-3 py-2">Feature</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Note</th>
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

          {section === 'health' && <HealthTab />}
          {section === 'broadcast' && <BroadcastTab organizations={controls?.organizations || []} />}
        </main>
      </div>
    </div>
  );
}
