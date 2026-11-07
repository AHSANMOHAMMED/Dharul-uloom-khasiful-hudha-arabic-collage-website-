import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import RoleSwitcher from '../components/RoleSwitcher';
import StudentDashboard from './StudentDashboard';
import ParentDashboard from './ParentDashboard';
import TutorDashboard from './TutorDashboard';
import TreasurerDashboard from './TreasurerDashboard';
import PrincipalDashboard from './PrincipalDashboard';
import LibrarianDashboard from './LibrarianDashboard';
import { tx } from '../lib/tx';

const UserDashboard = () => {
  const {
    isAuthenticated, isApproved,
    isStudent, isParent, isTutor, isTreasurer,
    isPrincipal, isVP, isLibrarian, isAdmin, isNonTeachingStaff,
    logout, loading: authLoading
  } = useAuth();
  useTranslation(); // subscribe: re-render on language change
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (isAdmin) {
      navigate('/admin');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div>
      </div>
    );
  }

  if (isAuthenticated && !isApproved) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-900/20 rounded-full blur-[100px]"></div>
        <div className="max-w-md w-full glass-card p-10 rounded-3xl text-center space-y-8 relative z-10">
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 border-t-2 border-r-2 border-amber-500 rounded-full animate-spin"></div>
            <div className="h-20 w-20 bg-gradient-to-br from-amber-500/20 to-amber-900/40 text-amber-500 rounded-full flex items-center justify-center text-4xl border border-amber-500/30 shadow-glow-amber">
              ⏳
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold font-arabic text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
              {tx('الحساب قيد المراجعة', 'Pending Approval')}
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed font-light">
              {tx('شكراً لتسجيلك. حسابك حالياً قيد المراجعة والتحقق من قبل إدارة الكلية. ستتمكن من تسجيل الدخول فور تفعيل حسابك.', 'Thank you for registering. Your credentials are pending review by the administration. You will have full access once approved.')}
            </p>
          </div>
          <button
            onClick={logout}
            className="w-full py-3.5 bg-gray-900/80 hover:bg-gray-800 text-gray-300 font-bold rounded-2xl text-sm transition-all border border-gray-700 shadow-lg hover:-translate-y-1"
          >
            {tx('تسجيل الخروج', 'Logout / Switch Account')}
          </button>
        </div>
      </div>
    );
  }

  const view = searchParams.get('view');
  const defaultSpecialView = isTreasurer ? 'treasurer' : isPrincipal ? 'principal' : isVP ? 'vp' : null;
  const activeView = view || defaultSpecialView || 'tutor';

  const wrapWithSwitcher = (dashboard) => (
    <>
      <RoleSwitcher />
      {dashboard}
    </>
  );

  if (isLibrarian) return <LibrarianDashboard />;

  if (isTutor && (isTreasurer || isPrincipal || isVP)) {
    if (activeView === 'treasurer' && isTreasurer) return wrapWithSwitcher(<TreasurerDashboard />);
    if (activeView === 'principal' && isPrincipal) return wrapWithSwitcher(<PrincipalDashboard vpMode={false} />);
    if (activeView === 'vp' && isVP) return wrapWithSwitcher(<PrincipalDashboard vpMode={true} />);
    if (activeView === 'tutor') return wrapWithSwitcher(<TutorDashboard />);
    if (isTreasurer) return wrapWithSwitcher(<TreasurerDashboard />);
    if (isPrincipal) return wrapWithSwitcher(<PrincipalDashboard vpMode={false} />);
    if (isVP) return wrapWithSwitcher(<PrincipalDashboard vpMode={true} />);
  }

  if (isPrincipal) return <PrincipalDashboard vpMode={false} />;
  if (isVP) return <PrincipalDashboard vpMode={true} />;
  if (isTreasurer) return <TreasurerDashboard />;
  if (isTutor) return <TutorDashboard />;
  if (isStudent) return <StudentDashboard />;
  if (isParent) return <ParentDashboard />;
  // Non-teaching employees (accountant, HR, admissions, warden…) work in the ERP.
  if (isNonTeachingStaff) return <Navigate to="/erp" replace />;

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 rounded-3xl text-center space-y-4">
          <div className="text-4xl">👋</div>
          <h2 className="text-xl font-bold">
            {tx('حساب زائر', 'Visitor account')}
          </h2>
          <p className="text-sm text-gray-400">
            {tx('يمكنك تقديم طلب القبول أو تصفح المكتبة. يتم تفعيل بوابات الطلاب وأولياء الأمور والموظفين من قبل الكلية.', 'You can apply for admission or browse the library. Student, parent and staff portals are activated by the college.')}
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/admissions" className="px-4 py-2 bg-emerald-600 rounded-xl text-sm font-bold">
              {tx('طلب القبول', 'Apply now')}
            </Link>
            <Link to="/library" className="px-4 py-2 bg-gray-800 rounded-xl text-sm font-bold">
              {tx('المكتبة', 'Library')}
            </Link>
          </div>
          <button onClick={logout} className="text-xs text-gray-500 underline">
            {tx('تسجيل الخروج', 'Logout')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="text-4xl animate-pulse">🔄</div>
        <p className="text-gray-400 text-sm">
          {tx('تحميل لوحة التحكم...', 'Loading your dashboard...')}
        </p>
        <button onClick={logout} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-750 transition text-sm">
          {tx('تسجيل الخروج', 'Logout')}
        </button>
      </div>
    </div>
  );
};

export default UserDashboard;
