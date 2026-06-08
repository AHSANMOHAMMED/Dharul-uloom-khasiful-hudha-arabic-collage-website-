import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { listGalleryItems } from '../lib/contentApi'

const Gallery = () => {
  const { i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    listGalleryItems().then(setItems).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-islamic-green text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {ar ? 'معرض الصور' : 'Gallery'}
          </h1>
          <p className="text-xl text-gray-200">
            {ar ? 'لمحة عن حياتنا في الكلية' : 'A glimpse into our college life'}
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <p className="text-center text-gray-600">{ar ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : items.length === 0 ? (
            <p className="text-center text-gray-600">{ar ? 'لا توجد صور بعد' : 'No gallery photos yet'}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item, index) => (
                <motion.button
                  key={item.id}
                  type="button"
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  viewport={{ once: true }}
                  onClick={() => item.imageUrl && setLightbox(item)}
                  className="group relative overflow-hidden rounded-lg shadow-lg aspect-[4/3] text-left"
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title.en} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-islamic-green to-islamic-dark flex items-center justify-center">
                      <span className="text-6xl opacity-30">{item.category === 'events' ? '🎉' : '🏫'}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-end">
                    <div className="p-4 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <h3 className="font-bold text-lg">{item.title[ar ? 'ar' : 'en'] || item.title.en}</h3>
                      <span className="text-sm opacity-90 capitalize">{item.category}</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mt-12 bg-islamic-green text-white rounded-lg shadow-lg p-8 text-center"
          >
            <h3 className="text-2xl font-bold mb-4">
              {ar ? 'تابعنا على Facebook' : 'Follow Us on Facebook'}
            </h3>
            <a
              href="https://www.facebook.com/100088419063008"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-islamic-green rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Facebook
            </a>
          </motion.div>
        </div>
      </section>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)} role="presentation">
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()} role="presentation">
            <img src={lightbox.imageUrl} alt={lightbox.title.en} className="w-full max-h-[80vh] object-contain rounded-lg" />
            <p className="text-white text-center mt-4 text-lg">{lightbox.title[ar ? 'ar' : 'en'] || lightbox.title.en}</p>
            <button type="button" onClick={() => setLightbox(null)} className="mt-4 mx-auto block text-gray-300 hover:text-white">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Gallery
