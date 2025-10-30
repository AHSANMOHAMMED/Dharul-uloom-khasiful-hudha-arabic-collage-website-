import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import axios from 'axios'

const News = () => {
  const { t, i18n } = useTranslation()
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await axios.get('/api/news')
        setNews(response.data.data || [])
      } catch (error) {
        console.error('Error fetching news:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchNews()
  }, [])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getCategoryBadge = (category) => {
    const colors = {
      admissions: 'bg-blue-100 text-blue-800',
      events: 'bg-green-100 text-green-800',
      announcements: 'bg-yellow-100 text-yellow-800',
      general: 'bg-gray-100 text-gray-800'
    }
    return colors[category] || colors.general
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-islamic-green text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('news.title')}</h1>
          <p className="text-xl text-gray-200">
            {i18n.language === 'ar'
              ? 'ابق على اطلاع بأحدث الأخبار والفعاليات'
              : 'Stay updated with our latest news and events'}
          </p>
        </div>
      </section>

      {/* News Items */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center text-gray-600">
              {i18n.language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : news.length === 0 ? (
            <div className="text-center text-gray-600">
              {i18n.language === 'ar' ? 'لا توجد أخبار حالياً' : 'No news available at the moment'}
            </div>
          ) : (
            <div className="space-y-8">
              {news.map((item, index) => (
                <motion.article
                  key={item._id}
                  initial={{ y: 50, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-lg shadow-lg overflow-hidden"
                >
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryBadge(item.category)}`}>
                        {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(item.date)}
                      </span>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-islamic-green mb-3">
                      {item.title[i18n.language] || item.title.en}
                    </h2>
                    
                    <p className="text-gray-700 leading-relaxed">
                      {item.content[i18n.language] || item.content.en}
                    </p>
                    
                    {item.author && (
                      <p className="mt-4 text-sm text-gray-500">
                        {i18n.language === 'ar' ? 'بواسطة ' : 'By '}{item.author}
                      </p>
                    )}
                  </div>
                </motion.article>
              ))}
            </div>
          )}

          {/* Social Media Section */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mt-12 bg-islamic-green text-white rounded-lg shadow-lg p-8 text-center"
          >
            <h3 className="text-2xl font-bold mb-4">
              {i18n.language === 'ar' ? 'تابعنا على وسائل التواصل' : 'Follow Us on Social Media'}
            </h3>
            <p className="mb-6">
              {i18n.language === 'ar'
                ? 'ابق على اطلاع بأحدث الأخبار والفعاليات على Facebook'
                : 'Stay updated with our latest news and events on Facebook'}
            </p>
            <a
              href="https://www.facebook.com/100088419063008"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-islamic-green rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {i18n.language === 'ar' ? 'Facebook' : 'Facebook'}
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default News
