import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { FeatureFlagsProvider } from './context/FeatureFlagsContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import OfflineIndicator from './components/OfflineIndicator'
import InstallPrompt from './components/InstallPrompt'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { tx } from './lib/tx';
import MfaGate from './components/security/MfaGate';

/**
 * Routes that are standalone authenticated workspaces.
 * When a user is on one of these paths the public Navbar and Footer
 * are suppressed so the dashboard fills the full viewport.
 */
const DASHBOARD_ROUTES = [
  '/admin',
  '/platform',
  '/dashboard',
  '/library-admin',
  '/erp',
  '/messages',
  '/payment/success',
  '/payment/cancel',
  '/verify',
  '/r/',
  '/receipt/',
  '/account',
];

/** Routes that require a signed-in user (public receipt/verify links excluded). */
const PROTECTED_ROUTES = ['/admin', '/platform', '/dashboard', '/library-admin', '/erp', '/messages', '/account'];

function isDashboardPath(pathname) {
  return DASHBOARD_ROUTES.some((r) => pathname === r || pathname.startsWith(r));
}

const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Courses = lazy(() => import('./pages/Courses'))
const Admissions = lazy(() => import('./pages/Admissions'))
const Faculty = lazy(() => import('./pages/Faculty'))
const Gallery = lazy(() => import('./pages/Gallery'))
const News = lazy(() => import('./pages/News'))
const Contact = lazy(() => import('./pages/Contact'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const NewsDetail = lazy(() => import('./pages/NewsDetail'))
const UserDashboard = lazy(() => import('./pages/UserDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const LibrarianDashboard = lazy(() => import('./pages/LibrarianDashboard'))
const Curriculum = lazy(() => import('./pages/Curriculum'))
const Library = lazy(() => import('./pages/Library'))
const BookReaderPage = lazy(() => import('./pages/BookReaderPage'))
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'))
const PaymentCancel = lazy(() => import('./pages/PaymentCancel'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Keep public pages and authenticated workspaces out of the initial bundle.
const ErpWorkspace = lazy(() => import('./pages/erp/ErpWorkspace'))
const SuperAdminConsole = lazy(() => import('./pages/SuperAdminConsole'))
const VerifyCertificate = lazy(() => import('./pages/erp/VerifyCertificate'))
const ReceiptPublic = lazy(() => import('./pages/ReceiptPublic'))
const AccountSecurity = lazy(() => import('./pages/AccountSecurity'))
const Messages = lazy(() => import('./pages/Messages'))

/**
 * AppShell — conditionally renders the public Navbar + Footer only when
 * the user is NOT on a full-screen authenticated dashboard route.
 */
function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const onDashboardRoute = isDashboardPath(location.pathname);

  // Signing out from any workspace (top bar, dashboard header, pending screen…)
  // lands on the login page instead of leaving a blank/forbidden dashboard.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (loading) return;
    const signedOut = wasAuthenticated.current && !isAuthenticated;
    wasAuthenticated.current = isAuthenticated;
    if (signedOut && PROTECTED_ROUTES.some((r) => location.pathname.startsWith(r))) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, loading, location.pathname, navigate]);

  // Start each page at the top (SPA navigation keeps the old scroll offset otherwise).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Hide public chrome when any logged-in user is on their workspace.
  const hideChrome = onDashboardRoute && isAuthenticated;
  const onProtectedRoute = PROTECTED_ROUTES.some((r) => location.pathname.startsWith(r));
  // Workspaces only render once the session has passed two-step verification.
  const content = onProtectedRoute ? <MfaGate>{children}</MfaGate> : children;

  if (hideChrome) {
    return (
      <div className="min-h-screen w-full min-w-0 flex flex-col bg-[#FBF8F0]">
        <main className="w-full min-w-0 flex-grow">{content}</main>
        <OfflineIndicator />
        <InstallPrompt />
        <ToastContainer position="bottom-center" theme="colored" autoClose={5000} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full min-w-0 flex flex-col">
      <Navbar />
      <main className="w-full min-w-0 flex-grow">{content}</main>
      <Footer />
      <OfflineIndicator />
      <InstallPrompt />
      <ToastContainer position="bottom-center" theme="colored" autoClose={5000} />
    </div>
  );
}

function App() {
  const { i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.dir = tx('rtl', 'ltr')
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  useEffect(() => {
    const onSwUpdate = () => {
      toast.info(
        tx('تحديث جديد متاح — أعد تحميل الصفحة', 'Update available — reload to get the latest version'),
        {
          onClick: () => window.location.reload(),
          autoClose: false,
        }
      )
    }
    window.addEventListener('sw-update-available', onSwUpdate)
    return () => window.removeEventListener('sw-update-available', onSwUpdate)
  }, [i18n.language])

  return (
    <AuthProvider>
      <FeatureFlagsProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppShell>
            <Suspense fallback={<div className="min-h-[50vh]" />}>
              <Routes>
                <Route path="/"           element={<Home />} />
                <Route path="/about"      element={<About />} />
                <Route path="/courses"    element={<Courses />} />
                <Route path="/admissions" element={<Admissions />} />
                <Route path="/faculty"    element={<Faculty />} />
                <Route path="/gallery"    element={<Gallery />} />
                <Route path="/news"       element={<News />} />
                <Route path="/contact"    element={<Contact />} />
                <Route path="/login"            element={<Login />} />
                <Route path="/register"         element={<Register />} />
                <Route path="/forgot-password"  element={<ForgotPassword />} />
                <Route path="/reset-password"   element={<ResetPassword />} />
                <Route path="/news/:id"         element={<NewsDetail />} />
                <Route path="/dashboard"  element={<UserDashboard />} />
                <Route path="/admin"      element={<AdminDashboard />} />
                <Route path="/platform"   element={<SuperAdminConsole />} />
                <Route path="/library-admin" element={<LibrarianDashboard />} />
                <Route path="/curriculum" element={<Curriculum />} />
                <Route path="/library"    element={<Library />} />
                <Route path="/library/:id" element={<BookReaderPage />} />
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/payment/cancel"  element={<PaymentCancel />} />
                {/* Fee-reminder notifications (0025) link to /fees; fees live in the portal. */}
                <Route path="/fees"       element={<Navigate to="/dashboard" replace />} />
                <Route path="/erp"        element={<ErpWorkspace />} />
                <Route path="/messages"   element={<Messages />} />
                <Route path="/account/security" element={<AccountSecurity />} />
                <Route path="/verify"     element={<VerifyCertificate />} />
                <Route path="/verify/:code" element={<VerifyCertificate />} />
                <Route path="/r/:token"   element={<ReceiptPublic />} />
                <Route path="/receipt/:id" element={<ReceiptPublic />} />
                <Route path="*"           element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppShell>
        </Router>
      </FeatureFlagsProvider>
    </AuthProvider>
  )
}

export default App
