import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

const Gallery = () => {
  const { i18n } = useTranslation()

  // Mock gallery images - in production, these would be real images
  const galleryItems = [
    {
      id: 1,
      title: { en: 'Main Building', ar: 'المبنى الرئيسي' },
      category: 'facilities'
    },
    {
      id: 2,
      title: { en: 'Classroom', ar: 'الفصل الدراسي' },
      category: 'facilities'
    },
    {
      id: 3,
      title: { en: 'Quran Competition 2024', ar: 'مسابقة القرآن 2024' },
      category: 'events'
    },
    {
      id: 4,
      title: { en: 'Graduation Ceremony', ar: 'حفل التخرج' },
      category: 'events'
    },
    {
      id: 5,
      title: { en: 'Library', ar: 'المكتبة' },
      category: 'facilities'
    },
    {
      id: 6,
      title: { en: 'Eid Celebration', ar: 'احتفال العيد' },
      category: 'events'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-islamic-green text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {i18n.language === 'ar' ? 'معرض الصور' : 'Gallery'}
          </h1>
          <p className="text-xl text-gray-200">
            {i18n.language === 'ar'
              ? 'لمحة عن حياتنا في الكلية'
              : 'A glimpse into our college life'}
          </p>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
                className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer"
              >
                <div className="h-64 bg-gradient-to-br from-islamic-green to-islamic-dark flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="text-6xl mb-2">
                      {item.category === 'facilities' ? '🏫' : '📸'}
                    </div>
                    <p className="text-lg font-semibold">
                      {item.title[i18n.language]}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-sm text-gray-600 text-center">
                    {item.category === 'facilities'
                      ? (i18n.language === 'ar' ? 'المرافق' : 'Facilities')
                      : (i18n.language === 'ar' ? 'الفعاليات' : 'Events')}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Facebook Link */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <p className="text-gray-600 mb-4">
              {i18n.language === 'ar'
                ? 'لمزيد من الصور، تفضل بزيارة صفحتنا على Facebook'
                : 'For more photos, visit our Facebook page'}
            </p>
            <a
              href="https://www.facebook.com/100088419063008"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {i18n.language === 'ar' ? 'تابعنا على Facebook' : 'Follow us on Facebook'}
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Gallery
