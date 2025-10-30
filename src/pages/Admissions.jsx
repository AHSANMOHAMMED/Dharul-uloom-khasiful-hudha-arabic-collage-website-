import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

const Admissions = () => {
  const { t, i18n } = useTranslation()
  const [formData, setFormData] = useState({
    studentName: '',
    age: '',
    parentName: '',
    phone: '',
    email: '',
    address: '',
    previousEducation: '',
    course: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // In a real application, this would send data to backend
    console.log('Admission form submitted:', formData)
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setFormData({
        studentName: '',
        age: '',
        parentName: '',
        phone: '',
        email: '',
        address: '',
        previousEducation: '',
        course: ''
      })
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-islamic-green text-white py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {i18n.language === 'ar' ? 'القبول' : 'Admissions'}
          </h1>
          <p className="text-xl text-gray-200">
            {i18n.language === 'ar'
              ? 'التسجيل الآن مفتوح للعام 2025'
              : 'Admissions now open for 2025'}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Information */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-lg shadow-lg p-8 mb-8"
          >
            <h2 className="text-2xl font-bold text-islamic-green mb-4">
              {i18n.language === 'ar' ? 'معلومات القبول' : 'Admission Information'}
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>{i18n.language === 'ar' ? 'العمر المطلوب:' : 'Age Requirement:'}</strong>{' '}
                {i18n.language === 'ar' ? '5-15 سنة' : '5-15 years'}
              </p>
              <p>
                <strong>{i18n.language === 'ar' ? 'الرسوم:' : 'Fees:'}</strong>{' '}
                {i18n.language === 'ar' 
                  ? 'التعليم القائم على التبرعات - لا توجد رسوم إلزامية'
                  : 'Donation-based education - No mandatory fees'}
              </p>
              <p>
                <strong>{i18n.language === 'ar' ? 'الاتصال:' : 'Contact:'}</strong>{' '}
                032-5612355, 070-5668463, 071-5576060
              </p>
            </div>
          </motion.div>

          {/* Application Form */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow-lg p-8"
          >
            <h2 className="text-2xl font-bold text-islamic-green mb-6">
              {i18n.language === 'ar' ? 'نموذج التقديم' : 'Application Form'}
            </h2>
            
            {submitted && (
              <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
                {i18n.language === 'ar'
                  ? 'شكرا لك! تم إرسال طلبك بنجاح. سنتواصل معك قريبًا.'
                  : 'Thank you! Your application has been submitted successfully. We will contact you soon.'}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {i18n.language === 'ar' ? 'اسم الطالب *' : 'Student Name *'}
                </label>
                <input
                  type="text"
                  name="studentName"
                  value={formData.studentName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    {i18n.language === 'ar' ? 'العمر *' : 'Age *'}
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    required
                    min="5"
                    max="15"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    {i18n.language === 'ar' ? 'اسم ولي الأمر *' : 'Parent Name *'}
                  </label>
                  <input
                    type="text"
                    name="parentName"
                    value={formData.parentName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    {i18n.language === 'ar' ? 'الهاتف *' : 'Phone *'}
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    {i18n.language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {i18n.language === 'ar' ? 'العنوان *' : 'Address *'}
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {i18n.language === 'ar' ? 'الدورة المرغوبة *' : 'Desired Course *'}
                </label>
                <select
                  name="course"
                  value={formData.course}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                >
                  <option value="">
                    {i18n.language === 'ar' ? 'اختر دورة' : 'Select a course'}
                  </option>
                  <option value="quran">
                    {i18n.language === 'ar' ? 'حفظ القرآن' : 'Quran Memorization'}
                  </option>
                  <option value="arabic">
                    {i18n.language === 'ar' ? 'النحو العربي' : 'Arabic Grammar'}
                  </option>
                  <option value="hadith">
                    {i18n.language === 'ar' ? 'دراسة الحديث' : 'Hadith Studies'}
                  </option>
                  <option value="fiqh">
                    {i18n.language === 'ar' ? 'الفقه الإسلامي' : 'Islamic Jurisprudence'}
                  </option>
                  <option value="islamic">
                    {i18n.language === 'ar' ? 'الدراسات الإسلامية' : 'Islamic Studies'}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {i18n.language === 'ar' ? 'التعليم السابق' : 'Previous Education'}
                </label>
                <textarea
                  name="previousEducation"
                  value={formData.previousEducation}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-islamic-green text-white py-3 rounded-lg font-semibold hover:bg-islamic-dark transition-colors"
              >
                {i18n.language === 'ar' ? 'إرسال الطلب' : 'Submit Application'}
              </button>
            </form>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Admissions
