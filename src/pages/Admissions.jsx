import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Validation schema
const admissionSchema = yup.object().shape({
  studentName: yup.string().required('Student name is required').min(3, 'Name must be at least 3 characters'),
  age: yup.number()
    .required('Age is required')
    .min(5, 'Age must be at least 5')
    .max(15, 'Age must not exceed 15')
    .typeError('Age must be a number'),
  parentName: yup.string().required('Parent name is required').min(3, 'Name must be at least 3 characters'),
  phone: yup.string()
    .required('Phone number is required')
    .matches(/^[0-9]{10}$/, 'Phone number must be 10 digits'),
  email: yup.string().email('Invalid email address'),
  address: yup.string().required('Address is required').min(10, 'Address must be at least 10 characters'),
  course: yup.string().required('Please select a course'),
})

const Admissions = () => {
  const { t, i18n } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: yupResolver(admissionSchema)
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      if (isAuthenticated) {
        // Submit to authenticated endpoint
        await axios.post('/api/user/admissions', data)
        toast.success(i18n.language === 'ar' 
          ? 'تم تقديم طلبك بنجاح! يمكنك متابعة حالته من لوحة التحكم.'
          : 'Application submitted successfully! Track it in your dashboard.')
      } else {
        // Submit as guest
        await axios.post('/api/contact', {
          name: data.parentName,
          email: data.email,
          phone: data.phone,
          message: `Admission Application:\nStudent: ${data.studentName}\nAge: ${data.age}\nCourse: ${data.course}\nAddress: ${data.address}\nPrevious Education: ${data.previousEducation || 'N/A'}`
        })
        toast.success(i18n.language === 'ar'
          ? 'تم إرسال طلبك بنجاح! سنتواصل معك قريباً.'
          : 'Application sent successfully! We will contact you soon.')
      }
      setSubmitted(true)
      reset()
      setTimeout(() => setSubmitted(false), 5000)
    } catch (error) {
      toast.error(i18n.language === 'ar'
        ? 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.'
        : 'Error submitting application. Please try again.')
      console.error('Submission error:', error)
    } finally {
      setLoading(false)
    }
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

            {!isAuthenticated && (
              <div className="mb-6 p-4 bg-blue-100 text-blue-700 rounded-lg">
                {i18n.language === 'ar'
                  ? 'لتتبع حالة طلبك، يرجى تسجيل الدخول أو إنشاء حساب.'
                  : 'To track your application status, please login or create an account.'}
              </div>
            )}
            
            {submitted && (
              <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
                {i18n.language === 'ar'
                  ? 'شكرا لك! تم إرسال طلبك بنجاح. سنتواصل معك قريبًا.'
                  : 'Thank you! Your application has been submitted successfully. We will contact you soon.'}
              </div>
            )}

            <ToastContainer position="top-right" autoClose={5000} />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {i18n.language === 'ar' ? 'اسم الطالب *' : 'Student Name *'}
                </label>
                <input
                  type="text"
                  {...register('studentName')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent ${
                    errors.studentName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.studentName && (
                  <p className="mt-1 text-sm text-red-600">{errors.studentName.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    {i18n.language === 'ar' ? 'العمر *' : 'Age *'}
                  </label>
                  <input
                    type="number"
                    {...register('age')}
                    min="5"
                    max="15"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent ${
                      errors.age ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.age && (
                    <p className="mt-1 text-sm text-red-600">{errors.age.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    {i18n.language === 'ar' ? 'اسم ولي الأمر *' : 'Parent Name *'}
                  </label>
                  <input
                    type="text"
                    {...register('parentName')}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent ${
                      errors.parentName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.parentName && (
                    <p className="mt-1 text-sm text-red-600">{errors.parentName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    {i18n.language === 'ar' ? 'الهاتف *' : 'Phone *'}
                  </label>
                  <input
                    type="tel"
                    {...register('phone')}
                    placeholder="0701234567"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    {i18n.language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {i18n.language === 'ar' ? 'العنوان *' : 'Address *'}
                </label>
                <textarea
                  {...register('address')}
                  rows="3"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent ${
                    errors.address ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {i18n.language === 'ar' ? 'التعليم السابق' : 'Previous Education'}
                </label>
                <input
                  type="text"
                  {...register('previousEducation')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {i18n.language === 'ar' ? 'الدورة المطلوبة *' : 'Desired Course *'}
                </label>
                <select
                  {...register('course')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent ${
                    errors.course ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">
                    {i18n.language === 'ar' ? 'اختر دورة' : 'Select a course'}
                  </option>
                  <option value="quran">
                    {i18n.language === 'ar' ? 'حفظ القرآن' : 'Quran Memorization'}
                  </option>
                  <option value="arabic">
                    {i18n.language === 'ar' ? 'قواعد اللغة العربية' : 'Arabic Grammar'}
                  </option>
                  <option value="hadith">
                    {i18n.language === 'ar' ? 'دراسات الحديث' : 'Hadith Studies'}
                  </option>
                  <option value="fiqh">
                    {i18n.language === 'ar' ? 'الفقه الإسلامي' : 'Islamic Jurisprudence'}
                  </option>
                  <option value="islamic">
                    {i18n.language === 'ar' ? 'الدراسات الإسلامية' : 'Islamic Studies'}
                  </option>
                </select>
                {errors.course && (
                  <p className="mt-1 text-sm text-red-600">{errors.course.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-islamic-green text-white py-3 px-6 rounded-lg font-semibold hover:bg-islamic-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? (i18n.language === 'ar' ? 'جاري الإرسال...' : 'Submitting...')
                  : (i18n.language === 'ar' ? 'إرسال الطلب' : 'Submit Application')
                }
              </button>
            </form>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Admissions
