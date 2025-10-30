import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const Home = () => {
  const { t, i18n } = useTranslation()

  return (
    <div>
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative bg-gradient-to-br from-islamic-green to-islamic-dark text-white py-32 px-4"
      >
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-4xl md:text-6xl font-bold mb-6 font-arabic"
          >
            {t('home.hero.title')}
          </motion.h1>
          <motion.p
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-xl md:text-2xl text-islamic-gold mb-4"
          >
            {t('home.hero.subtitle')}
          </motion.p>
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="text-lg md:text-xl mb-8 text-gray-200"
          >
            {t('home.hero.description')}
          </motion.p>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8 }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <Link
              to="/about"
              className="px-8 py-3 bg-islamic-gold text-islamic-green rounded-lg font-semibold hover:bg-yellow-500 transition-colors"
            >
              {t('home.cta.learn')}
            </Link>
            <Link
              to="/admissions"
              className="px-8 py-3 bg-white text-islamic-green rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              {t('home.cta.apply')}
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Info Cards */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white p-8 rounded-lg shadow-lg text-center"
            >
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-xl font-bold text-islamic-green mb-2">
                {i18n.language === 'ar' ? 'التعليم الإسلامي' : 'Islamic Education'}
              </h3>
              <p className="text-gray-600">
                {i18n.language === 'ar' 
                  ? 'تعليم شامل في القرآن والحديث والفقه'
                  : 'Comprehensive education in Quran, Hadith, and Fiqh'}
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white p-8 rounded-lg shadow-lg text-center"
            >
              <div className="text-4xl mb-4">🕌</div>
              <h3 className="text-xl font-bold text-islamic-green mb-2">
                {i18n.language === 'ar' ? 'مجتمع قوي' : 'Strong Community'}
              </h3>
              <p className="text-gray-600">
                {i18n.language === 'ar'
                  ? 'خدمة مجتمع كالبيتيا منذ 2004'
                  : 'Serving the Kalpitiya community since 2004'}
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-white p-8 rounded-lg shadow-lg text-center"
            >
              <div className="text-4xl mb-4">👨‍🏫</div>
              <h3 className="text-xl font-bold text-islamic-green mb-2">
                {i18n.language === 'ar' ? 'أساتذة مؤهلون' : 'Qualified Faculty'}
              </h3>
              <p className="text-gray-600">
                {i18n.language === 'ar'
                  ? 'معلمون ذوو خبرة في التعليم الإسلامي'
                  : 'Experienced teachers in Islamic education'}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-16 px-4 bg-islamic-green text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-islamic-gold mb-2">20+</div>
              <div className="text-lg">
                {i18n.language === 'ar' ? 'سنوات من التميز' : 'Years of Excellence'}
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-islamic-gold mb-2">100+</div>
              <div className="text-lg">
                {i18n.language === 'ar' ? 'الطلاب' : 'Students'}
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-islamic-gold mb-2">5+</div>
              <div className="text-lg">
                {i18n.language === 'ar' ? 'أساتذة مؤهلون' : 'Qualified Teachers'}
              </div>
            </div>
            <div>
              <div className="text-4xl font-bold text-islamic-gold mb-2">5+</div>
              <div className="text-lg">
                {i18n.language === 'ar' ? 'الدورات المقدمة' : 'Courses Offered'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-islamic-green mb-6">
            {i18n.language === 'ar' ? 'انضم إلينا اليوم' : 'Join Us Today'}
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            {i18n.language === 'ar'
              ? 'ابدأ رحلتك في التعليم الإسلامي. التسجيل الآن مفتوح للعام 2025'
              : 'Start your journey in Islamic education. Admissions now open for 2025'}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/admissions"
              className="px-8 py-3 bg-islamic-green text-white rounded-lg font-semibold hover:bg-islamic-dark transition-colors"
            >
              {t('home.cta.apply')}
            </Link>
            <a
              href="https://wa.me/94705668463"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              {t('contact.whatsapp')}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
