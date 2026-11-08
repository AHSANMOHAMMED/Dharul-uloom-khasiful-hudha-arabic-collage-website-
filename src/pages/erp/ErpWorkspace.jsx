import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loading, useLang } from '../../components/erp/ui';
import KhatamPattern from '../../components/KhatamPattern';
import { fetchActingOrg, setActingOrg } from '../../lib/erp/governanceApi';

/**
 * ERP workspace shell: Modern Manuscript design system.
 * Visibility here is UX only — the database enforces every permission (RLS + RPC checks).
 */
const MODULES = [
  { id: 'dashboard', label: (t) => t('Overview', 'نظرة عامة'), icon: 'analytics', group: 'core',
    show: (a) => a.isAdmin || a.isFinanceViewer || a.isAcademicAdmin || a.isHrStaff,
    load: () => import('../../components/erp/campus/ErpDashboard') },
  { id: 'analytics', label: (t) => t('Analytics', 'التحليلات'), icon: 'insights', group: 'core',
    show: (a) => a.isAdmin || a.isFinanceViewer || a.isAcademicAdmin,
    load: () => import('../../components/erp/ops/AnalyticsPanel') },
  { id: 'tasks', label: (t) => t('Task board', 'لوحة المهام'), icon: 'view_kanban', group: 'core',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/governance/TaskBoard') },
  { id: 'self', label: (t) => t('My workspace', 'مساحتي'), icon: 'badge', group: 'core',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/MySelfServicePanel') },
  { id: 'students', label: (t) => t('Students', 'الطلاب'), icon: 'school', group: 'academic',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/StudentsPanel') },
  { id: 'academics', label: (t) => t('Academics & Exams', 'الشؤون الأكاديمية'), icon: 'menu_book', group: 'academic',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/AcademicsPanel') },
  { id: 'crm', label: (t) => t('Admissions CRM', 'إدارة القبول'), icon: 'explore', group: 'academic',
    show: (a) => a.isAdmissionsStaff,
    load: () => import('../../components/erp/campus/CrmPanel') },
  { id: 'financetoday', label: (t) => t('Finance today', 'المالية اليوم'), icon: 'point_of_sale', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/ops/FinanceTodayPanel') },
  { id: 'fees', label: (t) => t('Student Fees', 'رسوم الطلاب'), icon: 'credit_card', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/finance/FeeManagement') },
  { id: 'accounting', label: (t) => t('Accounting', 'المحاسبة'), icon: 'account_balance', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/finance/AccountingPanel') },
  { id: 'expenses', label: (t) => t('Expenses', 'المصروفات'), icon: 'receipt_long', group: 'finance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/finance/ExpensesPanel') },
  { id: 'donations', label: (t) => t('Donations', 'التبرعات'), icon: 'volunteer_activism', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/finance/DonationsPanel') },
  { id: 'payroll', label: (t) => t('Payroll', 'الرواتب'), icon: 'payments', group: 'people',
    show: (a) => a.isHrStaff || a.isFinanceViewer,
    load: () => import('../../components/erp/finance/PayrollPanel') },
  { id: 'hr', label: (t) => t('HR & Staff', 'الموارد البشرية'), icon: 'groups', group: 'people',
    show: (a) => a.isHrStaff || a.isPrincipal || a.isVP,
    load: () => import('../../components/erp/campus/StaffHrPanel') },
  { id: 'hostel', label: (t) => t('Hostel', 'السكن'), icon: 'apartment', group: 'campus',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/HostelPanel') },
  { id: 'welfare', label: (t) => t('Discipline & Welfare', 'الانضباط والرعاية'), icon: 'health_and_safety', group: 'campus',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/WelfarePanel') },
  { id: 'certificates', label: (t) => t('Certificates', 'الشهادات'), icon: 'workspace_premium', group: 'campus',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/CertificatesPanel') },
  { id: 'duties', label: (t) => t('Duties', 'المسؤوليات'), icon: 'assignment_ind', group: 'governance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/governance/DutiesPanel') },
  { id: 'activities', label: (t) => t('Activities', 'الأنشطة'), icon: 'event', group: 'governance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/ops/ActivitiesPanel') },
  { id: 'mashoora', label: (t) => t('Mashoora', 'الشورى'), icon: 'diversity_3', group: 'governance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/governance/MashooraPanel') },
  { id: 'pettycash', label: (t) => t('Petty cash', 'النثرية'), icon: 'account_balance_wallet', group: 'governance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/governance/PettyCashPanel') },
  { id: 'audit', label: (t) => t('Audit Log', 'سجل التدقيق'), icon: 'history_edu', group: 'admin',
    show: (a) => a.isAdmin || a.isAccountant,
    load: () => import('../../components/erp/finance/AuditLogPanel') },
  { id: 'platform', label: (t) => t('SaaS Platform', 'المنصة'), icon: 'public', group: 'admin',
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-manuscript-sm">
      <span>
        {t('You are managing this institution as super admin:', 'أنت تدير هذه المؤسسة بصفتك مشرفًا عامًا:')} <b className="font-serif">{name}</b>
      </span>
      <button type="button" disabled={busy} onClick={exit} className="rounded-[10px] bg-amber-700 hover:bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50">
        {t('Exit', 'خروج')}
      </button>
    </div>
  );
}

export default function ErpWorkspace() {
  const auth = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const visible = useMemo(() => MODULES.filter((m) => m.show(auth)), [auth]);
  const activeId = params.get('module');
  const active = visible.find((m) => m.id === activeId) || visible[0];

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) {
      navigate('/login', { replace: true, state: { from: `/erp${window.location.search}` } });
    }
  }, [auth.loading, auth.isAuthenticated, navigate]);

  if (auth.loading || !auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!visible.length) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center px-4">
        <div className="rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript-md p-8 text-center max-w-md space-y-4">
          <p className="text-ink-text-secondary text-sm">
            {t('The ERP workspace is available to approved staff accounts.', 'مساحة الإدارة متاحة لحسابات الموظفين المعتمدة.')}
          </p>
          <Link to="/dashboard" className="text-emerald-700 font-semibold underline text-sm">
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
    <div className="min-h-screen bg-parchment-50 text-ink-text-primary pt-6 relative overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <KhatamPattern className="opacity-[0.03]" strokeColor="#0B3B2E" id="erp-bg-khatam" />

      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 flex flex-col lg:flex-row gap-6 pb-12 relative z-10">
        <aside className="lg:w-64 shrink-0">
          <div className="rounded-[14px] bg-paper-white border border-sand-border p-3.5 shadow-manuscript-sm lg:sticky lg:top-20 space-y-2">
            <div className="px-3 py-2 border-b border-sand-border/60">
              <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold font-serif">
                {t('College ERP', 'نظام إدارة الكلية')}
              </div>
              <div className="text-xs text-ink-text-muted truncate mt-0.5">{auth.user?.username}</div>
            </div>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {grouped.map(({ g, items }) => (
                <div key={g} className="flex lg:flex-col gap-1 lg:mb-2">
                  <div className="hidden lg:block px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-text-muted">
                    {GROUPS[g](t)}
                  </div>
                  {items.map((m) => {
                    const isSelected = active.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-current={isSelected ? 'page' : undefined}
                        onClick={() => {
                          setParams({ module: m.id });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-xs text-start transition font-medium ${
                          isSelected
                            ? 'bg-mint-wash-100 text-emerald-700 font-semibold border border-emerald-700/20'
                            : 'text-ink-text-secondary hover:bg-parchment-50 hover:text-ink-green-900'
                        }`}
                      >
                        <span aria-hidden className="material-symbols-outlined text-[18px]">{m.icon}</span>
                        <span>{m.label(t)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="border-t border-sand-border/60 mt-2 pt-3 px-3">
              <Link
                to={auth.isAdmin ? '/admin' : '/dashboard'}
                className="text-xs text-ink-text-muted hover:text-emerald-700 font-medium flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">{'arrow_back'}</span>
                <span>{t('Back to portal', 'العودة إلى البوابة')}</span>
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
