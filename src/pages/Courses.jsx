import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { listCoursePrograms } from '../lib/contentApi'

const Courses = () => {
  const { i18n } = useTranslation()
  const ar = i18n.language === 'ar'
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listCoursePrograms().then(setCourses).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-islamic-green text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {ar ? 'دوراتنا' : 'Our Courses'}
          </h1>
          <p className="text-xl text-gray-200">
            {ar
              ? 'برامج تعليمية شاملة في الدراسات الإسلامية والعربية'
              : 'Comprehensive programs in Islamic and Arabic studies'}
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <p className="text-center text-gray-600">{ar ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : courses.length === 0 ? (
            <p className="text-center text-gray-600">{ar ? 'لا توجد دورات بعد' : 'No courses listed yet'}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ y: 50, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div className="bg-islamic-green text-white p-6">
                    <div className="text-4xl mb-3">{course.icon || '📚'}</div>
                    <h3 className="text-xl font-bold mb-2">
                      {course.title[ar ? 'ar' : 'en'] || course.title.en}
                    </h3>
                    <p className="text-sm text-gray-200">
                      {course.duration[ar ? 'ar' : 'en'] || course.duration.en}
                    </p>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-700 leading-relaxed">
                      {course.description[ar ? 'ar' : 'en'] || course.description.en}
                    </p>
                    {course.admissionCode && (
                      <Link
                        to="/admissions"
                        className="inline-block mt-4 text-islamic-green font-semibold hover:text-islamic-dark"
                      >
                        {ar ? 'قدّم طلباً ←' : 'Apply now →'}
                      </Link>
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

export default Courses
