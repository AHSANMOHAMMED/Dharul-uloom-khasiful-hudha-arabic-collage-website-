import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import OfflineIndicator from './components/OfflineIndicator'
import InstallPrompt from './components/InstallPrompt'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Home from './pages/Home'
import About from './pages/About'
import Courses from './pages/Courses'
import Admissions from './pages/Admissions'
import Faculty from './pages/Faculty'
import Gallery from './pages/Gallery'
import News from './pages/News'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import NewsDetail from './pages/NewsDetail'
import UserDashboard from './pages/UserDashboard'
import AdminDashboard from './pages/AdminDashboard'
import LibrarianDashboard from './pages/LibrarianDashboard'
import Curriculum from './pages/Curriculum'
import Library from './pages/Library'
import BookReaderPage from './pages/BookReaderPage'
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentCancel from './pages/PaymentCancel'
import NotFound from './pages/NotFound'

function App() {
  const { i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  useEffect(() => {
    const onSwUpdate = () => {
      toast.info(
        i18n.language === 'ar'
          ? 'تحديث جديد متاح — أعد تحميل الصفحة'
          : 'Update available — reload to get the latest version',
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
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-grow">
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
              <Route path="/library-admin" element={<LibrarianDashboard />} />
              <Route path="/curriculum" element={<Curriculum />} />
              <Route path="/library"    element={<Library />} />
              <Route path="/library/:id" element={<BookReaderPage />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/cancel"  element={<PaymentCancel />} />
              <Route path="*"           element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
          {/* Global offline banner — shown automatically when user loses connectivity */}
          <OfflineIndicator />
          <InstallPrompt />
          <ToastContainer position="bottom-center" theme="colored" autoClose={5000} />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
