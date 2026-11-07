import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loading, useLang } from '../../components/erp/ui';
import { tx } from '../../lib/tx';
import { fetchActingOrg, setActingOrg } from '../../lib/erp/governanceApi';

/**
 * ERP workspace shell: one place for every institution-management module.
 * Each module is a self-contained component (lazy loaded). Visibility here is
 * UX only — the database enforces every permission (RLS + RPC checks).
 */
const MODULES = [
  { id: 'dashboard', label: (t) => t('Overview', 'نظرة عامة'), icon: '📊', group: 'core',
    show: (a) => a.isAdmin || a.isFinanceViewer || a.isAcademicAdmin || a.isHrStaff,
    load: () => import('../../components/erp/campus/ErpDashboard') },
  { id: 'tasks', label: (t) => t('Task board', 'لوحة المهام'), icon: '🗂️', group: 'core',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/governance/TaskBoard') },
  { id: 'self', label: (t) => t('My workspace', 'مساحتي'), icon: '🙋', group: 'core',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/MySelfServicePanel') },
  { id: 'students', label: (t) => t('Students', 'الطلاب'), icon: '🎓', group: 'academic',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/StudentsPanel') },
  { id: 'academics', label: (t) => t('Academics & Exams', 'الشؤون الأكاديمية'), icon: '📚', group: 'academic',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/AcademicsPanel') },
  { id: 'crm', label: (t) => t('Admissions CRM', 'إدارة القبول'), icon: '🧭', group: 'academic',
    show: (a) => a.isAdmissionsStaff,
    load: () => import('../../components/erp/campus/CrmPanel') },
  { id: 'fees', label: (t) => t('Student Fees', 'رسوم الطلاب'), icon: '💳', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/finance/FeeManagement') },
  { id: 'accounting', label: (t) => t('Accounting', 'المحاسبة'), icon: '📒', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/finance/AccountingPanel') },
  { id: 'expenses', label: (t) => t('Expenses', 'المصروفات'), icon: '🧾', group: 'finance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/finance/ExpensesPanel') },
  { id: 'donations', label: (t) => t('Donations', 'التبرعات'), icon: '🤲', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/finance/DonationsPanel') },
  { id: 'payroll', label: (t) => t('Payroll', 'الرواتب'), icon: '💼', group: 'people',
    show: (a) => a.isHrStaff || a.isFinanceViewer,
    load: () => import('../../components/erp/finance/PayrollPanel') },
  { id: 'hr', label: (t) => t('HR & Staff', 'الموارد البشرية'), icon: '👥', group: 'people',
    show: (a) => a.isHrStaff || a.isPrincipal || a.isVP,
    load: () => import('../../components/erp/campus/StaffHrPanel') },
  { id: 'hostel', label: (t) => t('Hostel', 'السكن'), icon: '🏠', group: 'campus',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/HostelPanel') },
  { id: 'welfare', label: (t) => t('Discipline & Welfare', 'الانضباط والرعاية'), icon: '🛡️', group: 'campus',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/WelfarePanel') },
  { id: 'certificates', label: (t) => t('Certificates', 'الشهادات'), icon: '📜', group: 'campus',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/CertificatesPanel') },
  { id: 'duties', label: (t) => t('Duties', 'المسؤوليات'), icon: '🧩', group: 'governance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/governance/DutiesPanel') },
  { id: 'mashoora', label: (t) => t('Mashoora', 'الشورى'), icon: '🤝', group: 'governance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/governance/MashooraPanel') },
  { id: 'pettycash', label: (t) => t('Petty cash', 'النثرية'), icon: '👛', group: 'governance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/governance/PettyCashPanel') },
  { id: 'audit', label: (t) => t('Audit Log', 'سجل التدقيق'), icon: '🔍', group: 'admin',
    show: (a) => a.isAdmin || a.isAccountant,
    load: () => import('../../components/erp/finance/AuditLogPanel') },
  { id: 'platform', label: (t) => t('SaaS Platform', 'المنصة'), icon: '🌐', group: 'admin',
    show: (a) => a.isSuperAdmin,
    load: () => import('../../components/erp/campus/PlatformPanel') },
];

const GROUPS = {
  core: (t) => t('Workspace', 'المساحة'),
  governance: (t) => t('Governance', 'الإدارة والشورى'),
  academic: (t) => t('Academic', 'الأكاديمي'),
  finance: (t) => t('Finance', 'المالية'),
  people: (t) => t('People', 'الموظفون'),
  campus: (t) => t('Campus', 'الحرم'),
  admin: (t) => t('Administration', 'الإدارة'),
};

const lazyCache = new Map();
function getLazy(mod) {
  if (!lazyCache.has(mod.id)) lazyCache.set(mod.id, lazy(mod.load));
  return lazyCache.get(mod.id);
}

/** Super admins "acting as" another institution see which one, with an exit. */
function ActingOrgBanner({ userId }) {
  const { t, lang } = useLang();
  const [org, setOrg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetchActingOrg(userId)
      .then((o) => live && setOrg(o))
      .catch(() => live && setOrg(null));
    return () => {
      live = false;
    };
  }, [userId]);
  if (!org) return null;
  const exit = async () => {
    setBusy(true);
    try {
      await setActingOrg(null);
      window.location.reload();
    } catch (e) {
      setBusy(false);
      window.alert(e.message || String(e));
    }
  };
  const name = (lang === 'ar' && org.name_ar) || org.name_en || org.slug;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-700 bg-amber-950/50 px-4 py-3 text-sm text-amber-100">
      <span>
        {t('You are managing this institution as super admin:', 'أنت تدير هذه المؤسسة بصفتك مشرفًا عامًا:')} <b>{name}</b>
      </span>
      <button type="button" disabled={busy} onClick={exit} className="rounded-xl bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
        {t('Exit', 'خروج')}
      </button>
    </div>
  );
}

export default function ErpWorkspace() {
  const auth = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const visible = useMemo(() => MODULES.filter((m) => m.show(auth)), [auth]);
  const activeId = params.get('module');
  const active = visible.find((m) => m.id === activeId) || visible[0];

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) navigate('/login');
  }, [auth.loading, auth.isAuthenticated, navigate]);

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!visible.length) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl p-8 text-center max-w-md space-y-4">
          <p className="text-gray-300">
            {t('The ERP workspace is available to approved staff accounts.', 'مساحة الإدارة متاحة لحسابات الموظفين المعتمدة.')}
          </p>
          <Link to="/dashboard" className="text-emerald-400 underline">
            {t('Go to my portal', 'الذهاب إلى بوابتي')}
          </Link>
        </div>
      </div>
    );
  }

  const ActiveModule = getLazy(active);
  const grouped = Object.keys(GROUPS)
    .map((g) => ({ g, items: visible.filter((m) => m.group === g) }))
    .filter((x) => x.items.length);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pt-20" dir={tx('rtl', 'ltr')}>
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 flex flex-col lg:flex-row gap-6 pb-12">
        <aside className="lg:w-64 shrink-0">
          <div className="glass-card rounded-2xl p-3 border border-gray-800 lg:sticky lg:top-24">
            <div className="px-3 py-2 mb-2">
              <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold">{t('College ERP', 'نظام الإدارة')}</div>
              <div className="text-sm text-gray-400 truncate">{auth.user?.username}</div>
            </div>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {grouped.map(({ g, items }) => (
                <div key={g} className="flex lg:flex-col gap-1 lg:mb-3">
                  <div className="hidden lg:block px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-gray-500">
                    {GROUPS[g](t)}
                  </div>
                  {items.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setParams({ module: m.id })}
                      className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-start transition ${
                        active.id === m.id ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <span aria-hidden>{m.icon}</span>
                      <span>{m.label(t)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="hidden lg:block border-t border-gray-800 mt-2 pt-3 px-3">
              <Link to={auth.isAdmin ? '/admin' : '/dashboard'} className="text-xs text-gray-400 hover:text-emerald-400">
                ← {t('Back to portal', 'العودة إلى البوابة')}
              </Link>
            </div>
          </div>
        </aside>
        <main className="flex-1 min-w-0">
          {auth.isSuperAdmin && <ActingOrgBanner userId={auth.user?.id} />}
          <Suspense fallback={<Loading />}>
            <ActiveModule key={active.id} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
