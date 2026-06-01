import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

const NotFound = () => {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <p className="text-7xl md:text-9xl font-bold text-islamic-green">404</p>
        <h1 className="mt-4 text-2xl md:text-3xl font-bold text-islamic-dark">
          {isAr ? 'الصفحة غير موجودة' : 'Page Not Found'}
        </h1>
        <p className="mt-2 text-gray-600 max-w-md mx-auto">
          {isAr
            ? 'عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.'
            : "Sorry, the page you are looking for doesn't exist or has been moved."}
        </p>
        <Link
          to="/"
          className="inline-block mt-8 px-6 py-3 bg-islamic-green text-white rounded-lg font-semibold hover:bg-islamic-dark transition-colors"
        >
          {isAr ? 'العودة إلى الرئيسية' : 'Back to Home'}
        </Link>
      </motion.div>
    </div>
  )
}

export default NotFound
