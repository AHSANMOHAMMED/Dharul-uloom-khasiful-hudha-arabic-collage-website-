import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loading, useLang } from '../../components/erp/ui';
import KhatamPattern from '../../components/KhatamPattern';
import { tx } from '../../lib/tx';

/**
 * ERP workspace shell: Modern Manuscript design system.
 * Visibility here is UX only — the database enforces every permission (RLS + RPC checks).
 */
const MODULES = [
  { id: 'dashboard', en: 'Overview', ar: 'نظرة عامة', icon: 'analytics', group: 'core',
    show: (a) => a.isAdmin || a.isFinanceViewer || a.isAcademicAdmin || a.isHrStaff,
    load: () => import('../../components/erp/campus/ErpDashboard') },
  { id: 'self', en: 'My workspace', ar: 'مساحتي', icon: 'badge', group: 'core',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/MySelfServicePanel') },
  { id: 'students', en: 'Students', ar: 'الطلاب', icon: 'school', group: 'academic',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/StudentsPanel') },
  { id: 'academics', en: 'Academics & Exams', ar: 'الشؤون الأكاديمية', icon: 'menu_book', group: 'academic',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/AcademicsPanel') },
  { id: 'crm', en: 'Admissions CRM', ar: 'إدارة القبول', icon: 'explore', group: 'academic',
    show: (a) => a.isAdmissionsStaff,
    load: () => import('../../components/erp/campus/CrmPanel') },
  { id: 'fees', en: 'Student Fees', ar: 'رسوم الطلاب', icon: 'credit_card', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/finance/FeeManagement') },
  { id: 'accounting', en: 'Accounting', ar: 'المحاسبة', icon: 'account_balance', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/finance/AccountingPanel') },
  { id: 'expenses', en: 'Expenses', ar: 'المصروفات', icon: 'receipt_long', group: 'finance',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/finance/ExpensesPanel') },
  { id: 'donations', en: 'Donations', ar: 'التبرعات', icon: 'volunteer_activism', group: 'finance',
    show: (a) => a.isFinanceViewer,
    load: () => import('../../components/erp/finance/DonationsPanel') },
  { id: 'payroll', en: 'Payroll', ar: 'الرواتب', icon: 'payments', group: 'people',
    show: (a) => a.isHrStaff || a.isFinanceViewer,
    load: () => import('../../components/erp/finance/PayrollPanel') },
  { id: 'hr', en: 'HR & Staff', ar: 'الموارد البشرية', icon: 'groups', group: 'people',
    show: (a) => a.isHrStaff || a.isPrincipal || a.isVP,
    load: () => import('../../components/erp/campus/StaffHrPanel') },
  { id: 'hostel', en: 'Hostel', ar: 'السكن', icon: 'apartment', group: 'campus',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/HostelPanel') },
  { id: 'welfare', en: 'Discipline & Welfare', ar: 'الانضباط والرعاية', icon: 'health_and_safety', group: 'campus',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/WelfarePanel') },
  { id: 'certificates', en: 'Certificates', ar: 'الشهادات', icon: 'workspace_premium', group: 'campus',
    show: (a) => a.isEmployee,
    load: () => import('../../components/erp/campus/CertificatesPanel') },
  { id: 'audit', en: 'Audit Log', ar: 'سجل التدقيق', icon: 'history_edu', group: 'admin',
    show: (a) => a.isAdmin || a.isAccountant,
    load: () => import('../../components/erp/finance/AuditLogPanel') },
  { id: 'platform', en: 'SaaS Platform', ar: 'المنصة', icon: 'public', group: 'admin',
    show: (a) => a.isSuperAdmin,
    load: () => import('../../components/erp/campus/PlatformPanel') },
];

const GROUPS = {
  core: ['Workspace', 'المساحة'],
  academic: ['Academic', 'الأكاديمي'],
  finance: ['Finance', 'المالية'],
  people: ['People', 'الموظفون'],
  campus: ['Campus', 'الحرم'],
  admin: ['Administration', 'الإدارة'],
};

const lazyCache = new Map();
function getLazy(mod) {
  if (!lazyCache.has(mod.id)) lazyCache.set(mod.id, lazy(mod.load));
  return lazyCache.get(mod.id);
}

export default function ErpWorkspace() {
  const auth = useAuth();
  const { t, ar } = useLang();
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
    <div className="min-h-screen bg-parchment-50 text-ink-text-primary py-8 relative overflow-hidden" dir={tx('rtl', 'ltr')}>
      <KhatamPattern className="opacity-[0.03]" strokeColor="#0B3B2E" id="erp-bg-khatam" />

      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 flex flex-col lg:flex-row gap-6 pb-12 relative z-10">
        <aside className="lg:w-64 shrink-0">
          <div className="rounded-[14px] bg-paper-white border border-sand-border p-3.5 shadow-manuscript-sm lg:sticky lg:top-24 space-y-2">
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
                    {ar ? GROUPS[g][1] : GROUPS[g][0]}
                  </div>
                  {items.map((m) => {
                    const isSelected = active.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setParams({ module: m.id })}
                        className={`flex items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-xs text-start transition font-medium ${
                          isSelected
                            ? 'bg-mint-wash-100 text-emerald-700 font-semibold border border-emerald-700/20'
                            : 'text-ink-text-secondary hover:bg-parchment-50 hover:text-ink-green-900'
                        }`}
                      >
                        <span aria-hidden className="material-symbols-outlined text-[18px]">{m.icon}</span>
                        <span>{ar ? m.ar : m.en}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="hidden lg:block border-t border-sand-border/60 mt-2 pt-3 px-3">
              <Link
                to={auth.isAdmin ? '/admin' : '/dashboard'}
                className="text-xs text-ink-text-muted hover:text-emerald-700 font-medium flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>{t('Back to portal', 'العودة إلى البوابة')}</span>
              </Link>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <Suspense fallback={<Loading />}>
            <ActiveModule key={active.id} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
