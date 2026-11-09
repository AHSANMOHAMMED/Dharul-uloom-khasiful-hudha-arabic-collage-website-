import { useEffect } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureFlagsContext';
import RoleSwitcher from '../components/RoleSwitcher';
import StudentDashboard from './StudentDashboard';
import ParentDashboard from './ParentDashboard';
import TutorDashboard from './TutorDashboard';
import LibrarianDashboard from './LibrarianDashboard';
import TreasurerPortal from './portals/TreasurerPortal';
import PrincipalPortal from './portals/PrincipalPortal';
import AccountantPortal from './portals/AccountantPortal';
import HrPortal from './portals/HrPortal';
import AdmissionsPortal from './portals/AdmissionsPortal';
import WardenPortal from './portals/WardenPortal';
import CounselorPortal from './portals/CounselorPortal';
import ExamPortal from './portals/ExamPortal';
import KhatamPattern from '../components/KhatamPattern';
import { tx } from '../lib/tx';

export default function UserDashboard() {
  const {
    isAuthenticated, isApproved,
    isStudent, isParent, isTutor, isTreasurer,
    isPrincipal, isVP, isLibrarian, isAdmin, isSuperAdmin, isNonTeachingStaff,
    hasRole,
    logout, loading: authLoading,
  } = useAuth();
  const { enabled } = useFeatures();
  useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const featureBlocked = (key) => (
    <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-[14px] border border-sand-border bg-paper-white p-8 text-center shadow-manuscript-md space-y-3">
        <h2 className="font-serif text-xl font-semibold text-ink-green-900">
          {tx('هذه البوابة غير مفعّلة حالياً', 'This portal is currently disabled')}
        </h2>
        <p className="text-sm text-ink-text-secondary">
          {tx('عطّل مدير المنصة هذه الميزة. تواصل مع إدارة الكلية.', 'The platform operator turned this feature off. Contact college administration.')}
        </p>
        <p className="text-[11px] font-mono text-ink-text-muted">{key}</p>
      </div>
    </div>
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { from: `/dashboard${window.location.search}` } });
      return;
    }
    if (isSuperAdmin) {
      navigate('/platform', { replace: true });
      return;
    }
    if (isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [authLoading, isAuthenticated, isAdmin, isSuperAdmin, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment-50 text-ink-text-primary">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated && !isApproved) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6 relative overflow-hidden">
        <KhatamPattern className="opacity-[0.05]" strokeColor="#0B3B2E" id="pending-dashboard-khatam" />
        <div className="max-w-md w-full bg-paper-white rounded-[14px] border border-sand-border p-8 text-center space-y-6 shadow-manuscript-md relative z-10">
          <div className="w-16 h-16 rounded-full bg-gold-wash-100 text-brass-gold-500 mx-auto flex items-center justify-center border border-brass-gold-500/30">
            <span className="material-symbols-outlined text-3xl">hourglass_top</span>
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brass-gold-500 block">
              {tx('التدقيق والاعتماد', 'Dossier Verification')}
            </span>
            <h2 className="font-serif text-2xl font-semibold text-ink-green-900">
              {tx('الحساب قيد المراجعة والاعتماد', 'Registration Pending Approval')}
            </h2>
            <p className="text-xs text-ink-text-secondary leading-relaxed font-sans">
              {tx(
                'شكراً لتسجيلك في بوابة دار العلوم. حسابك حالياً قيد التدقيق والاعتماد من قبل إدارة الكلية. ستتمكن من الاطلاع على السجلات بمجرد تفعيل الحساب.',
                'Thank you for registering. Your credentials are under review by college administration. Once approved, you will have direct access to your academic and financial ledgers.',
              )}
            </p>
          </div>
          <button
            onClick={logout}
            className="w-full h-11 bg-paper-white hover:bg-parchment-50 text-ink-text-primary font-semibold rounded-[10px] text-xs transition-all border border-sand-border shadow-xs"
          >
            {tx('تسجيل الخروج / تبديل الحساب', 'Logout / Switch Account')}
          </button>
        </div>
      </div>
    );
  }

  // Duty hats must use explicit staffRoles — isAccountant/isAdmissionsStaff also
  // return true for admins/principals and would wrongly multi-route leadership.
  const isAccountantRole = hasRole?.('accountant');
  const isHr = hasRole?.('hr_manager');
  const isAdmissions = hasRole?.('admissions_officer');
  const isWarden = hasRole?.('warden');
  const isCounselor = hasRole?.('counselor');
  const isExam = hasRole?.('exam_officer');

  const view = searchParams.get('view');
  const defaultSpecialView = isTreasurer
    ? 'treasurer'
    : isPrincipal
      ? 'principal'
      : isVP
        ? 'vp'
        : isAccountantRole
          ? 'accountant'
          : isHr
            ? 'hr'
            : isAdmissions
              ? 'admissions'
              : isWarden
                ? 'warden'
                : isCounselor
                  ? 'counselor'
                  : isExam
                    ? 'exam'
                    : isLibrarian
                      ? 'librarian'
                      : null;
  const activeView = view || defaultSpecialView || 'tutor';

  // RolePortalShell embeds RoleSwitcher; Tutor/Librarian keep a top bar.
  const wrapWithSwitcher = (dashboard, { topBar = false } = {}) => (
    <div className="w-full bg-parchment-50 min-h-screen">
      {topBar ? <RoleSwitcher /> : null}
      {dashboard}
    </div>
  );

  const portalForView = (v) => {
    if (v === 'treasurer' && isTreasurer) return <TreasurerPortal />;
    if (v === 'principal' && isPrincipal) return <PrincipalPortal vpMode={false} />;
    if (v === 'vp' && isVP) return <PrincipalPortal vpMode />;
    if (v === 'accountant' && isAccountantRole) return <AccountantPortal />;
    if (v === 'hr' && isHr) return <HrPortal />;
    if (v === 'admissions' && isAdmissions) return <AdmissionsPortal />;
    if (v === 'warden' && (isWarden || hasRole?.('warden'))) return <WardenPortal />;
    if (v === 'counselor' && isCounselor) return <CounselorPortal />;
    if (v === 'exam' && isExam) return <ExamPortal />;
    if (v === 'librarian' && isLibrarian) return <LibrarianDashboard />;
    if (v === 'tutor' && isTutor) return <TutorDashboard />;
    return null;
  };

  const hatFlags = [
    isTreasurer,
    isPrincipal,
    isVP,
    isLibrarian,
    isTutor,
    isAccountantRole,
    isHr,
    isAdmissions,
    hasRole?.('warden'),
    isCounselor,
    isExam,
  ].filter(Boolean);
  const multiHat = hatFlags.length > 1;

  if (multiHat) {
    const chosen = portalForView(activeView);
    const needsTopBar = activeView === 'tutor' || activeView === 'librarian';
    if (chosen) return wrapWithSwitcher(chosen, { topBar: needsTopBar });
    const fallback =
      portalForView('treasurer') ||
      portalForView('principal') ||
      portalForView('vp') ||
      portalForView('accountant') ||
      portalForView('hr') ||
      portalForView('admissions') ||
      portalForView('warden') ||
      portalForView('counselor') ||
      portalForView('exam') ||
      portalForView('librarian') ||
      portalForView('tutor');
    if (fallback) {
      return wrapWithSwitcher(fallback, {
        topBar: !portalForView(activeView) && (isTutor || isLibrarian) && !(isTreasurer || isPrincipal || isVP || isAccountantRole),
      });
    }
  }

  if (isLibrarian) {
    if (!enabled('library')) return featureBlocked('library');
    return <LibrarianDashboard />;
  }
  if (isPrincipal) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <PrincipalPortal vpMode={false} />;
  }
  if (isVP) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <PrincipalPortal vpMode />;
  }
  if (isTreasurer) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <TreasurerPortal />;
  }
  if (isAccountantRole) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <AccountantPortal />;
  }
  if (isHr) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <HrPortal />;
  }
  if (isAdmissions) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <AdmissionsPortal />;
  }
  if (hasRole?.('warden')) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <WardenPortal />;
  }
  if (isCounselor) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <CounselorPortal />;
  }
  if (isExam) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <ExamPortal />;
  }
  if (isTutor) {
    if (!enabled('staff_portal')) return featureBlocked('staff_portal');
    return <TutorDashboard />;
  }
  if (isStudent) {
    if (!enabled('student_portal')) return featureBlocked('student_portal');
    return <StudentDashboard />;
  }
  if (isParent) {
    if (!enabled('parent_portal')) return featureBlocked('parent_portal');
    return <ParentDashboard />;
  }

  if (isNonTeachingStaff) {
    if (!enabled('erp') || !enabled('staff_portal')) return featureBlocked('erp');
    return <Navigate to="/erp" replace />;
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-parchment-50 text-ink-text-primary flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-paper-white border border-sand-border p-8 rounded-[14px] text-center space-y-4 shadow-manuscript-md">
          <div className="w-16 h-16 rounded-full bg-mint-wash-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-700/20">
            <span className="material-symbols-outlined text-3xl">waving_hand</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-ink-green-900">
            {tx('حساب زائر', 'Visitor account')}
          </h2>
          <p className="text-sm text-ink-text-secondary leading-relaxed">
            {tx(
              'يمكنك تقديم طلب القبول أو تصفح المكتبة. يتم تفعيل بوابات الطلاب وأولياء الأمور والموظفين من قبل الكلية.',
              'You can apply for admission or browse the library. Student, parent and staff portals are activated by the college.',
            )}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/admissions" className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-500 text-white rounded-[10px] text-xs font-semibold shadow-xs">
              {tx('طلب القبول', 'Apply now')}
            </Link>
            <Link to="/library" className="px-5 py-2.5 bg-paper-white border border-sand-border hover:bg-parchment-50 text-ink-text-primary rounded-[10px] text-xs font-semibold">
              {tx('المكتبة', 'Library')}
            </Link>
          </div>
          <button onClick={logout} className="text-xs text-ink-text-muted hover:text-feedback-danger underline pt-2">
            {tx('تسجيل الخروج', 'Logout')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment-50 text-ink-text-primary flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-ink-text-muted">
          {tx('جاري تحميل مساحة البوابة...', 'Loading portal workspace...')}
        </p>
        <button onClick={logout} className="text-xs text-ink-text-muted hover:text-feedback-danger underline">
          {tx('تسجيل الخروج', 'Logout')}
        </button>
      </div>
    </div>
  );
}
