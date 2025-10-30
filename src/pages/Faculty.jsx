import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import axios from 'axios'

const Faculty = () => {
  const { i18n } = useTranslation()
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFaculty = async () => {
      try {
        const response = await axios.get('/api/faculty')
        setFaculty(response.data.data || [])
      } catch (error) {
        console.error('Error fetching faculty:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchFaculty()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-islamic-green text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {i18n.language === 'ar' ? 'أساتذتنا' : 'Our Faculty'}
          </h1>
          <p className="text-xl text-gray-200">
            {i18n.language === 'ar'
              ? 'معلمون مخلصون ومؤهلون'
              : 'Dedicated and qualified educators'}
          </p>
        </div>
      </section>

      {/* Faculty Members */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center text-gray-600">
              {i18n.language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : faculty.length === 0 ? (
            <div className="text-center text-gray-600">
              {i18n.language === 'ar' ? 'لا يوجد بيانات' : 'No data available'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {faculty.map((member, index) => (
                <motion.div
                  key={member._id}
                  initial={{ y: 50, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05 }}
                  className="bg-white rounded-lg shadow-lg overflow-hidden"
                >
                  <div className="h-48 bg-islamic-green flex items-center justify-center">
                    <div className="text-6xl text-white">👨‍🏫</div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-islamic-green mb-2">
                      {member.name[i18n.language] || member.name.en}
                    </h3>
                    <p className="text-islamic-gold font-semibold mb-3">
                      {member.role[i18n.language] || member.role.en}
                    </p>
                    <p className="text-gray-700 text-sm mb-3">
                      {member.bio?.[i18n.language] || member.bio?.en || ''}
                    </p>
                    {member.qualifications && member.qualifications.length > 0 && (
                      <div className="mt-4">
                        <p className="font-semibold text-sm text-gray-600 mb-2">
                          {i18n.language === 'ar' ? 'المؤهلات:' : 'Qualifications:'}
                        </p>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {member.qualifications.map((qual, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-islamic-green mr-2">•</span>
                              <span>{qual}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Faculty
