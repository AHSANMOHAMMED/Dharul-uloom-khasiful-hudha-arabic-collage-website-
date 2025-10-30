import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

const Courses = () => {
  const { i18n } = useTranslation()

  const courses = [
    {
      title: { en: 'Quran Memorization (Hifz)', ar: 'حفظ القرآن' },
      duration: { en: '3-5 years', ar: '3-5 سنوات' },
      description: {
        en: 'Complete memorization of the Holy Quran with proper Tajweed and recitation techniques.',
        ar: 'حفظ كامل للقرآن الكريم مع التجويد الصحيح وتقنيات التلاوة.'
      }
    },
    {
      title: { en: 'Arabic Grammar', ar: 'النحو العربي' },
      duration: { en: '2 years', ar: 'سنتان' },
      description: {
        en: 'Comprehensive study of Arabic grammar including Nahw and Sarf.',
        ar: 'دراسة شاملة للنحو العربي بما في ذلك النحو والصرف.'
      }
    },
    {
      title: { en: 'Hadith Studies', ar: 'دراسة الحديث' },
      duration: { en: '1-2 years', ar: '1-2 سنة' },
      description: {
        en: 'Study of authentic Hadith collections including Sahih al-Bukhari and Muslim.',
        ar: 'دراسة مجموعات الأحاديث الصحيحة بما في ذلك صحيح البخاري ومسلم.'
      }
    },
    {
      title: { en: 'Islamic Jurisprudence (Fiqh)', ar: 'الفقه الإسلامي' },
      duration: { en: '1-2 years', ar: '1-2 سنة' },
      description: {
        en: 'Basic Islamic law and jurisprudence for daily life applications.',
        ar: 'الفقه الإسلامي الأساسي وتطبيقاته في الحياة اليومية.'
      }
    },
    {
      title: { en: 'Islamic Studies', ar: 'الدراسات الإسلامية' },
      duration: { en: '1 year', ar: 'سنة واحدة' },
      description: {
        en: 'Comprehensive Islamic education including Aqeedah, Tafseer, and Islamic history.',
        ar: 'تعليم إسلامي شامل بما في ذلك العقيدة والتفسير والتاريخ الإسلامي.'
      }
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-islamic-green text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {i18n.language === 'ar' ? 'دوراتنا' : 'Our Courses'}
          </h1>
          <p className="text-xl text-gray-200">
            {i18n.language === 'ar'
              ? 'برامج تعليمية شاملة في الدراسات الإسلامية والعربية'
              : 'Comprehensive educational programs in Islamic and Arabic studies'}
          </p>
        </div>
      </section>

      {/* Courses */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {courses.map((course, index) => (
              <motion.div
                key={index}
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-lg shadow-lg p-8"
              >
                <h3 className="text-2xl font-bold text-islamic-green mb-2">
                  {course.title[i18n.language]}
                </h3>
                <p className="text-islamic-gold font-semibold mb-4">
                  {i18n.language === 'ar' ? 'المدة: ' : 'Duration: '}
                  {course.duration[i18n.language]}
                </p>
                <p className="text-gray-700 leading-relaxed">
                  {course.description[i18n.language]}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Additional Info */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mt-12 bg-islamic-green text-white rounded-lg shadow-lg p-8"
          >
            <h2 className="text-2xl font-bold mb-4">
              {i18n.language === 'ar' ? 'معلومات إضافية' : 'Additional Information'}
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-islamic-gold mr-2">•</span>
                <span>
                  {i18n.language === 'ar'
                    ? 'جميع الدورات تُدرس باللغة العربية'
                    : 'All courses are taught in Arabic'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-islamic-gold mr-2">•</span>
                <span>
                  {i18n.language === 'ar'
                    ? 'الفصول الصغيرة للاهتمام الفردي'
                    : 'Small class sizes for individual attention'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-islamic-gold mr-2">•</span>
                <span>
                  {i18n.language === 'ar'
                    ? 'أساتذة مؤهلون وذوو خبرة'
                    : 'Qualified and experienced instructors'}
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-islamic-gold mr-2">•</span>
                <span>
                  {i18n.language === 'ar'
                    ? 'التعليم القائم على التبرعات'
                    : 'Donation-based education'}
                </span>
              </li>
            </ul>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Courses
