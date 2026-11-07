import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { useAuth } from '../context/AuthContext'
import {
  DEFAULT_AGE_LIMITS,
  ageFromDob,
  isSriLankanPhone,
  loadAdmissionAgeLimits,
  shiftIso,
  submitAdmission,
  submitPublicAdmission,
  todayIso,
} from '../lib/admissionsApi'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { tx } from '../lib/tx';

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), s)

/** "Age: 12 years 2 months" in the UI language. */
const ageLabel = ({ years, months }) =>
  fill(tx('العمر: {years} سنة و{months} شهر', 'Age: {years} years {months} months'), { years, months })

const ageRangeError = ({ minAge, maxAge }) =>
  fill(tx('يجب أن يكون عمر المتقدم بين {min} و{max} سنة', 'Applicant must be between {min} and {max} years old'), { min: minAge, max: maxAge })

/** Validation schema — built at render so messages follow the UI language and the institution's age limits. */
function makeAdmissionSchema(limits, today) {
  return yup.object().shape({
    studentName: yup.string().trim()
      .required(tx('اسم الطالب مطلوب', 'Student name is required'))
      .min(3, tx('يجب أن يتكون الاسم من 3 أحرف على الأقل', 'Name must be at least 3 characters')),
    dateOfBirth: yup.string()
      .required(tx('تاريخ الميلاد مطلوب', 'Date of birth is required'))
      .test('not-future', tx('لا يمكن أن يكون تاريخ الميلاد في المستقبل', 'Date of birth cannot be in the future'),
        (v) => !v || v <= today)
      .test('age-range', ageRangeError(limits), (v) => {
        if (!v || v > today) return true
        const age = ageFromDob(v, today)
        return !!age && age.years >= limits.minAge && age.years <= limits.maxAge
      }),
    parentName: yup.string().trim()
      .required(tx('اسم ولي الأمر مطلوب', 'Parent name is required'))
      .min(3, tx('يجب أن يتكون الاسم من 3 أحرف على الأقل', 'Name must be at least 3 characters')),
    phone: yup.string()
      .required(tx('رقم الهاتف مطلوب', 'Phone number is required'))
      .test('lk-phone', tx('أدخل رقم هاتف سريلانكي صحيحاً (مثال: 0771234567)', 'Enter a valid Sri Lankan phone number (e.g. 0771234567)'),
        (v) => !v || isSriLankanPhone(v)),
    email: yup.string().trim().email(tx('عنوان البريد الإلكتروني غير صالح', 'Invalid email address')),
    address: yup.string().trim()
      .required(tx('العنوان مطلوب', 'Address is required'))
      .min(5, tx('يجب أن يتكون العنوان من 5 أحرف على الأقل', 'Address must be at least 5 characters')),
    course: yup.string().required(tx('يرجى اختيار دورة', 'Please select a course')),
  })
}

/** Show the database's reason in the UI language when it is one we know. */
function admissionErrorMessage(error) {
  const msg = error?.message || ''
  const range = /between (\d+) and (\d+) years old/.exec(msg)
  if (range) return ageRangeError({ minAge: range[1], maxAge: range[2] })
  const known = [
    [/already received/i, tx('تم استلام هذا الطلب بالفعل. سنتواصل معك قريباً.', 'This application was already received. We will contact you soon.')],
    [/valid Sri Lankan phone/i, tx('أدخل رقم هاتف سريلانكي صحيحاً (مثال: 0771234567)', 'Enter a valid Sri Lankan phone number (e.g. 0771234567)')],
    [/in the future/i, tx('لا يمكن أن يكون تاريخ الميلاد في المستقبل', 'Date of birth cannot be in the future')],
    [/Date of birth is required/i, tx('تاريخ الميلاد مطلوب', 'Date of birth is required')],
    [/names are required/i, tx('اسم الطالب واسم ولي الأمر مطلوبان', 'Student and parent names are required')],
    [/Institution not found/i, tx('لم يتم العثور على المؤسسة', 'Institution not found')],
  ]
  for (const [re, text] of known) if (re.test(msg)) return text
  return msg || tx('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.', 'Error submitting application. Please try again.')
}

const Admissions = () => {
  useTranslation() // subscribe: re-render on language change
  const { isAuthenticated } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [limits, setLimits] = useState(DEFAULT_AGE_LIMITS)

  useEffect(() => {
    let alive = true
    loadAdmissionAgeLimits().then((l) => { if (alive) setLimits(l) })
    return () => { alive = false }
  }, [])

  const today = todayIso()
  // oldest allowed: the day after the (maxAge + 1)th birthday would fall on today
  const minDob = shiftIso(today, { years: -(limits.maxAge + 1), days: 1 })
  const year = new Date().getFullYear()

  // rebuilt every render so messages follow the current language (cheap)
  const schema = makeAdmissionSchema(limits, today)

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    resolver: yupResolver(schema)
  })

  const dob = watch('dateOfBirth')
  const liveAge = dob ? ageFromDob(dob, today) : null
  const liveAgeOutOfRange = !!liveAge && (liveAge.years < limits.minAge || liveAge.years > limits.maxAge)

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const age = ageFromDob(data.dateOfBirth, today)?.years
      if (isAuthenticated) {
        // Persist as a tracked application for the signed-in user.
        await submitAdmission({ ...data, age })
        toast.success(tx('تم تقديم طلبك بنجاح! يمكنك متابعة حالته من لوحة التحكم.', 'Application submitted successfully! Track it in your dashboard.'))
      } else {
        // Guests: public RPC → CRM pipeline + admissions staff notified.
        await submitPublicAdmission(data)
        toast.success(tx('تم إرسال طلبك بنجاح! سنتواصل معك قريباً.', 'Application sent successfully! We will contact you soon.'))
      }
      setSubmitted(true)
      reset()
      setTimeout(() => setSubmitted(false), 5000)
    } catch (error) {
      toast.error(admissionErrorMessage(error))
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
            {tx('القبول', 'Admissions')}
          </h1>
          <p className="text-xl text-gray-200">
            {fill(tx('التسجيل الآن مفتوح للعام {year}', 'Admissions now open for {year}'), { year: `${year} / ${year + 1}` })}
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
              {tx('معلومات القبول', 'Admission Information')}
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>{tx('العمر المطلوب:', 'Age Requirement:')}</strong>{' '}
                {fill(tx('{min}-{max} سنة', '{min}-{max} years'), { min: limits.minAge, max: limits.maxAge })}
              </p>
              <p>
                <strong>{tx('الرسوم:', 'Fees:')}</strong>{' '}
                {tx('التعليم القائم على التبرعات - لا توجد رسوم إلزامية', 'Donation-based education - No mandatory fees')}
              </p>
              <p>
                <strong>{tx('الاتصال:', 'Contact:')}</strong>{' '}
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
              {tx('نموذج التقديم', 'Application Form')}
            </h2>

            {!isAuthenticated && (
              <div className="mb-6 p-4 bg-blue-100 text-blue-700 rounded-lg">
                {tx('لتتبع حالة طلبك، يرجى تسجيل الدخول أو إنشاء حساب.', 'To track your application status, please login or create an account.')}
              </div>
            )}
            
            {submitted && (
              <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
                {tx('شكرا لك! تم إرسال طلبك بنجاح. سنتواصل معك قريبًا.', 'Thank you! Your application has been submitted successfully. We will contact you soon.')}
              </div>
            )}

            <ToastContainer position="top-right" autoClose={5000} />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {tx('اسم الطالب *', 'Student Name *')}
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
                  <label htmlFor="admission-dob" className="block text-gray-700 font-semibold mb-2">
                    {tx('تاريخ الميلاد *', 'Date of Birth *')}
                  </label>
                  <input
                    id="admission-dob"
                    type="date"
                    {...register('dateOfBirth')}
                    min={minDob}
                    max={today}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent ${
                      errors.dateOfBirth || liveAgeOutOfRange ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {liveAge && (
                    <p className={`mt-1 text-sm ${liveAgeOutOfRange ? 'text-red-600' : 'text-gray-600'}`} aria-live="polite">
                      {ageLabel(liveAge)}
                    </p>
                  )}
                  {errors.dateOfBirth ? (
                    <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
                  ) : liveAgeOutOfRange && (
                    <p className="mt-1 text-sm text-red-600">{ageRangeError(limits)}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    {tx('اسم ولي الأمر *', 'Parent Name *')}
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
                    {tx('الهاتف *', 'Phone *')}
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
                    {tx('البريد الإلكتروني', 'Email')}
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
                  {tx('العنوان *', 'Address *')}
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
                  {tx('التعليم السابق', 'Previous Education')}
                </label>
                <input
                  type="text"
                  {...register('previousEducation')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  {tx('الدورة المطلوبة *', 'Desired Course *')}
                </label>
                <select
                  {...register('course')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-islamic-green focus:border-transparent ${
                    errors.course ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">
                    {tx('اختر دورة', 'Select a course')}
                  </option>
                  <option value="quran">
                    {tx('حفظ القرآن', 'Quran Memorization')}
                  </option>
                  <option value="arabic">
                    {tx('قواعد اللغة العربية', 'Arabic Grammar')}
                  </option>
                  <option value="hadith">
                    {tx('دراسات الحديث', 'Hadith Studies')}
                  </option>
                  <option value="fiqh">
                    {tx('الفقه الإسلامي', 'Islamic Jurisprudence')}
                  </option>
                  <option value="islamic">
                    {tx('الدراسات الإسلامية', 'Islamic Studies')}
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
                  ? (tx('جاري الإرسال...', 'Submitting...'))
                  : (tx('إرسال الطلب', 'Submit Application'))
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
