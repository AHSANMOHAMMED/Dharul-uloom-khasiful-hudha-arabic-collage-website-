import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import KhatamPattern from '../components/KhatamPattern'
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

/** Fields validated on each step of the form (step 4 = review). */
const STEP_FIELDS = {
  1: ['studentName', 'dateOfBirth'],
  2: ['parentName', 'phone', 'email', 'address'],
  3: ['course'],
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

/** Hijri year of a Gregorian date (Umm al-Qura), with an arithmetic fallback. */
function hijriYear(date) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric' }).formatToParts(date)
    const y = parts.find((p) => p.type === 'year')?.value
    if (y && /^\d+$/.test(y)) return y
  } catch {
    /* calendar not supported — fall through */
  }
  return String(Math.floor((date.getFullYear() - 622) * (33 / 32)))
}

const inputBase = 'w-full h-11 px-3.5 rounded-[10px] bg-paper-white border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary placeholder:text-ink-text-muted'
const areaBase = 'w-full p-3 rounded-[10px] bg-paper-white border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary placeholder:text-ink-text-muted'
const borderFor = (bad) => (bad ? 'border-feedback-danger' : 'border-sand-border')
const labelCls = 'block text-xs font-semibold text-ink-text-primary mb-1.5'

export default function Admissions() {
  useTranslation() // subscribe: re-render on language change
  const { isAuthenticated } = useAuth()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null) // { ref, tracked }
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [limits, setLimits] = useState(DEFAULT_AGE_LIMITS)

  useEffect(() => {
    let alive = true
    loadAdmissionAgeLimits().then((l) => { if (alive) setLimits(l) })
    return () => { alive = false }
  }, [])

  const today = todayIso()
  // oldest allowed: the day after the (maxAge + 1)th birthday would fall on today
  const minDob = shiftIso(today, { years: -(limits.maxAge + 1), days: 1 })
  // the January intake: from July onwards applications are for next year
  const now = new Date()
  const intakeYear = now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0)
  const intakeHijri = hijriYear(new Date(intakeYear, 0, 15))

  // rebuilt every render so messages follow the current language (cheap)
  const schema = makeAdmissionSchema(limits, today)

  const [formData, setFormData] = useState({
    // Step 1: Student Details
    studentName: '',
    dateOfBirth: '',
    hifzStatus: 'None',
    // Step 2: Guardian Details
    parentName: '',
    relationship: 'Father',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    // Step 3: Education & Program
    course: 'quran',
    previousEducation: '',
    notes: '',
  })

  const courseOptions = [
    { value: 'quran', label: tx('تحفيظ القرآن والتجويد (المرحلة التأسيسية، ٣ سنوات)', 'Hifz al-Quran & Tajweed (Foundation, 3 Years)') },
    { value: 'arabic', label: tx('النحو والصرف والعربية الفصحى (المرحلة المتوسطة، ٤ سنوات)', 'Classical Arabic Grammar & Nahw (Intermediate, 4 Years)') },
    { value: 'hadith', label: tx('العالمية ودراسات الحديث (المرحلة العالية، ٧ سنوات)', 'Alim & Hadith Studies (Advanced, 7 Years)') },
    { value: 'fiqh', label: tx('الفقه الشافعي المسائي (تعليم مستمر للكبار)', 'Evening Shafi’i Fiqh (Continuing Adult Education)') },
  ]
  const hifzOptions = [
    { value: 'None', label: tx('لا يوجد (مبتدئ)', 'None (Beginner)') },
    { value: '1-5 Juz', label: tx('حفظ من ١ إلى ٥ أجزاء', '1 to 5 Juz memorized') },
    { value: '6-15 Juz', label: tx('حفظ من ٦ إلى ١٥ جزءاً', '6 to 15 Juz memorized') },
    { value: '16-30 Juz', label: tx('من ١٦ إلى ٣٠ جزءاً (مكتمل)', '16 to 30 Juz (Completed)') },
  ]
  const relationshipOptions = [
    { value: 'Father', label: tx('الأب', 'Father') },
    { value: 'Mother', label: tx('الأم', 'Mother') },
    { value: 'Grandfather', label: tx('الجد / أحد الأكابر', 'Grandfather / Elder') },
    { value: 'Legal Guardian', label: tx('الوصي الشرعي', 'Legal Guardian') },
  ]
  const optionLabel = (options, value) => options.find((o) => o.value === value)?.label || value

  const liveAge = formData.dateOfBirth ? ageFromDob(formData.dateOfBirth, today) : null
  const liveAgeOutOfRange = !!liveAge && (liveAge.years < limits.minAge || liveAge.years > limits.maxAge)

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }))
    if (submitError) setSubmitError('')
  }

  /** Validate the given step's fields; returns true when they pass. */
  const validateStep = (step) => {
    const fields = STEP_FIELDS[step] || []
    try {
      schema.pick(fields).validateSync(formData, { abortEarly: false })
      setErrors((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, null])) }))
      return true
    } catch (err) {
      const next = Object.fromEntries(fields.map((f) => [f, null]))
      for (const e of err.inner?.length ? err.inner : [err]) if (e.path && !next[e.path]) next[e.path] = e.message
      setErrors((prev) => ({ ...prev, ...next }))
      return false
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) setCurrentStep((prev) => prev + 1)
  }

  const prevStep = () => setCurrentStep((prev) => Math.max(1, prev - 1))

  const handleSubmit = async (e) => {
    e.preventDefault()
    for (const step of [1, 2, 3]) {
      if (!validateStep(step)) {
        setCurrentStep(step)
        return
      }
    }

    setLoading(true)
    setSubmitError('')
    const hifz = formData.hifzStatus !== 'None' ? `Hifz: ${formData.hifzStatus}` : ''
    const payload = {
      studentName: formData.studentName.trim(),
      dateOfBirth: formData.dateOfBirth,
      parentName: formData.parentName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      course: formData.course,
      previousEducation: [formData.previousEducation.trim(), hifz].filter(Boolean).join(' · '),
    }

    try {
      let id
      if (isAuthenticated) {
        // Persist as a tracked application for the signed-in user.
        const age = ageFromDob(payload.dateOfBirth, today)?.years
        const row = await submitAdmission({ ...payload, age })
        id = row?._id
      } else {
        // Guests: public RPC (site institution) → CRM pipeline + admissions staff notified.
        const res = await submitPublicAdmission(payload)
        id = res?.id
      }
      const ref = id ? `KH-${intakeYear}-${String(id).replace(/-/g, '').slice(0, 6).toUpperCase()}` : null
      setSuccess({ ref, tracked: isAuthenticated })
    } catch (err) {
      console.error('Admission submit error:', err)
      setSubmitError(admissionErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const fieldError = (field) => errors[field] && (
    <p className="text-xs text-feedback-danger mt-1" role="alert">{errors[field]}</p>
  )

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">

      {/* 1. Slim Header */}
      <section className="w-full bg-paper-white border-b border-sand-border py-8">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-xs text-ink-text-muted mb-3" aria-label={tx('مسار التنقل', 'Breadcrumb')}>
            <Link to="/" className="hover:text-emerald-700 transition-colors">{tx('الرئيسية', 'Home')}</Link>
            <span>/</span>
            <span className="text-ink-green-900 font-semibold">{tx('القبول', 'Admissions')}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-semibold tracking-wider text-brass-gold-500 block mb-1">
                {fill(tx('دورة القبول {year}', 'Intake Cycle {year}'), { year: intakeYear })}
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
                {tx('طلب الالتحاق بدار العلوم كاشف الهدى', 'Admission Application Form')}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-text-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse"></span>
              <span>{tx('بوابة القبول مفتوحة', 'Intake Portal Active')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Split Layout: Left Info Panel + Right Form */}
      <section className="w-full py-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Sticky Info Panel */}
            <aside className="lg:col-span-4 sticky top-24 rounded-[14px] bg-ink-green-900 text-paper-white p-7 border border-sand-border/20 shadow-manuscript-md overflow-hidden relative space-y-6">
              <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="admissions-sidebar-khatam" />

              <div className="relative z-10 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-brass-gold-500">
                  {tx('المتطلبات', 'Requirements')}
                </span>
                <h3 className="font-serif text-xl font-semibold text-paper-white leading-snug">
                  {tx('شروط القبول وإرشاداته', 'Admission Prerequisites & Guidelines')}
                </h3>
                <p className="text-xs text-dark-text-primary/75 leading-relaxed">
                  {tx('يرجى مراجعة القائمة قبل تقديم الطلب. سيتم التحقق من جميع الشهادات الأصلية أثناء المقابلة في الحرم الجامعي.', 'Please review the checklist before submitting the dossier. All original certificates will be verified during the campus interview.')}
                </p>
              </div>

              {/* Checklist */}
              <div className="relative z-10 space-y-3 pt-3 border-t border-sand-border/15 text-xs text-dark-text-primary/85">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">{'check_circle'}</span>
                  <span>
                    <strong>{tx('حدود العمر:', 'Age limits:')}</strong>{' '}
                    {fill(tx('من {min} إلى {max} سنة حسب تاريخ الميلاد.', '{min} to {max} years, by date of birth.'), { min: limits.minAge, max: limits.maxAge })}
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">{'check_circle'}</span>
                  <span>
                    <strong>{tx('شهادة الميلاد الأصلية', 'Original birth certificate')}</strong>{' '}
                    {tx('وخطاب إقامة مصدق من الغراما نيلادهاري.', 'and certified Grama Niladhari residence letter.')}
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">{'check_circle'}</span>
                  <span>
                    <strong>{tx('اختبار التلاوة الشفهي:', 'Oral recitation test:')}</strong>{' '}
                    {tx('طلاقة أساسية في قراءة القرآن بالتجويد.', 'Basic fluency in reading the Quran with Tajweed.')}
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">{'check_circle'}</span>
                  <span>
                    <strong>{tx('الاستعداد للإقامة:', 'Residential readiness:')}</strong>{' '}
                    {tx('الرغبة في الإقامة في السكن الداخلي للطلاب.', 'Willingness to reside in student boarding halls.')}
                  </span>
                </div>
              </div>

              {/* Key Dates Box */}
              <div className="relative z-10 p-4 rounded-xl bg-dark-canvas/60 border border-sand-border/15 text-xs space-y-2">
                <div className="flex justify-between items-center text-brass-gold-500 font-semibold">
                  <span>{fill(tx('قبول شوال {hijri}', 'Intake Shawwal {hijri}'), { hijri: intakeHijri })}</span>
                  <span className="text-[11px]">{intakeYear}</span>
                </div>
                <p className="text-[11px] text-dark-text-primary/70">
                  {fill(tx('تُجرى اختبارات القبول كل يوم سبت من شهر شعبان {hijri} في حرم مدلپلّي.', 'Entrance examinations conducted every Saturday of Sha’ban {hijri} at the Mudalippalli campus.'), { hijri: intakeHijri })}
                </p>
              </div>

              {/* Admissions Hotline */}
              <div className="relative z-10 pt-2 border-t border-sand-border/15 text-xs text-dark-text-primary/75">
                <span className="block text-[11px] uppercase tracking-wider text-dark-text-primary/60 mb-1">{tx('خط الاستفسارات', 'Inquiry Hotline')}</span>
                <p className="font-semibold text-paper-white text-sm" dir="ltr">032-5612355 / 070-5668463</p>
                <p className="text-[11px] text-dark-text-primary/60 mt-0.5" dir="ltr">{'admissions@kashifulhudha.edu.lk'}</p>
              </div>
            </aside>

            {/* Right Multi-Step Form */}
            <main className="lg:col-span-8 rounded-[14px] bg-paper-white border border-sand-border p-6 sm:p-10 shadow-manuscript">

              {/* Success View */}
              {success ? (
                <div className="py-8 text-center space-y-5">
                  <div className="w-16 h-16 rounded-full bg-mint-wash-100 text-emerald-700 mx-auto flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">{'check_circle'}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs uppercase font-semibold text-emerald-700 tracking-wider">
                      {tx('تم تقديم الطلب بنجاح', 'Application Submitted Successfully')}
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
                      {tx('تم استلام طلب الالتحاق بنجاح', 'Registration Dossier Received')}
                    </h2>
                  </div>

                  <p className="text-xs sm:text-sm text-ink-text-secondary max-w-md mx-auto leading-relaxed">
                    {success.tracked
                      ? tx('تم تقديم طلبك بنجاح! يمكنك متابعة حالته من لوحة التحكم.', 'Application submitted successfully! Track it in your dashboard.')
                      : tx('تم إرسال طلبك بنجاح! سنتواصل معك قريباً.', 'Application sent successfully! We will contact you soon.')}
                  </p>

                  {success.ref && (
                    <div className="p-4 rounded-xl bg-parchment-50 border border-sand-border max-w-xs mx-auto">
                      <span className="text-[11px] text-ink-text-muted uppercase tracking-wider block mb-1">{tx('رقم مرجع الطلب', 'Application Reference')}</span>
                      <span className="font-mono text-xl font-bold text-ink-green-900 tracking-wider" dir="ltr">{success.ref}</span>
                      <p className="text-[11px] text-ink-text-muted mt-2">{tx('يرجى ذكر هذا الرقم في جميع المراسلات.', 'Please quote this number in all correspondence.')}</p>
                    </div>
                  )}

                  <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                    {success.tracked ? (
                      <Link
                        to="/dashboard"
                        className="px-5 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
                      >
                        {tx('الذهاب إلى لوحة التحكم', 'Go to Dashboard')}
                      </Link>
                    ) : (
                      <Link
                        to="/"
                        className="px-5 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
                      >
                        {tx('العودة إلى الصفحة الرئيسية', 'Return to Homepage')}
                      </Link>
                    )}
                    <Link
                      to="/curriculum"
                      className="px-5 py-2.5 rounded-[10px] border border-sand-border hover:bg-parchment-50 text-ink-text-primary text-xs font-medium"
                    >
                      {tx('عرض تفاصيل المنهج', 'View Curriculum Details')}
                    </Link>
                  </div>
                </div>
              ) : (
                /* Form Steps */
                <form onSubmit={handleSubmit} noValidate className="space-y-8">

                  {/* Step Progress Stepper Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-ink-text-muted mb-2">
                      <span className={currentStep >= 1 ? 'text-emerald-700' : ''}>{tx('١. الطالب', '1. Student')}</span>
                      <span className={currentStep >= 2 ? 'text-emerald-700' : ''}>{tx('٢. ولي الأمر', '2. Guardian')}</span>
                      <span className={currentStep >= 3 ? 'text-emerald-700' : ''}>{tx('٣. البرنامج', '3. Program')}</span>
                      <span className={currentStep === 4 ? 'text-emerald-700' : ''}>{tx('٤. المراجعة', '4. Review')}</span>
                    </div>
                    <div className="w-full bg-sand-border/40 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-700 h-full transition-all duration-300"
                        style={{ width: `${(currentStep / 4) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* STEP 1: Student Details */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div className="border-b border-sand-border pb-3">
                        <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                          {tx('الخطوة ١: بيانات الطالب المتقدم', 'Step 1: Prospective Student Details')}
                        </h3>
                        <p className="text-xs text-ink-text-muted">{tx('أدخل بيانات الطالب كما هي مسجلة في شهادة الميلاد المدنية.', 'Enter student identity as registered in civil birth certificate.')}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                          <label htmlFor="adm-student-name" className={labelCls}>
                            {tx('الاسم الكامل (بالإنجليزية / السنهالية كما في الشهادة) *', 'Full Name (English / Sinhala as in Certificate) *')}
                          </label>
                          <input
                            id="adm-student-name"
                            type="text"
                            value={formData.studentName}
                            onChange={(e) => handleChange('studentName', e.target.value)}
                            placeholder={tx('مثال: محمد أسلم محمد رضوان', 'e.g. Mohamed Aslam Mohamed Rizwan')}
                            aria-invalid={!!errors.studentName}
                            className={`${inputBase} ${borderFor(errors.studentName)}`}
                          />
                          {fieldError('studentName')}
                        </div>

                        <div>
                          <label htmlFor="adm-dob" className={labelCls}>
                            {tx('تاريخ الميلاد *', 'Date of Birth *')}
                          </label>
                          <input
                            id="adm-dob"
                            type="date"
                            value={formData.dateOfBirth}
                            min={minDob}
                            max={today}
                            onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                            aria-invalid={!!errors.dateOfBirth || liveAgeOutOfRange}
                            className={`${inputBase} ${borderFor(errors.dateOfBirth || liveAgeOutOfRange)}`}
                          />
                          {errors.dateOfBirth ? fieldError('dateOfBirth') : liveAgeOutOfRange && (
                            <p className="text-xs text-feedback-danger mt-1" role="alert">{ageRangeError(limits)}</p>
                          )}
                        </div>

                        <div>
                          <span className={labelCls}>{tx('العمر (محسوب تلقائياً)', 'Age (calculated)')}</span>
                          <div
                            className={`w-full h-11 px-3.5 rounded-[10px] border flex items-center text-xs sm:text-sm ${
                              liveAgeOutOfRange
                                ? 'bg-paper-white border-feedback-danger text-feedback-danger'
                                : 'bg-parchment-50 border-sand-border text-ink-text-primary'
                            }`}
                            aria-live="polite"
                          >
                            {liveAge ? ageLabel(liveAge) : (
                              <span className="text-ink-text-muted">{tx('اختر تاريخ الميلاد', 'Select date of birth')}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-ink-text-muted mt-1">
                            {fill(tx('العمر المسموح: {min}-{max} سنة', 'Allowed age: {min}-{max} years'), { min: limits.minAge, max: limits.maxAge })}
                          </p>
                        </div>

                        <div>
                          <label htmlFor="adm-hifz" className={labelCls}>
                            {tx('مستوى الحفظ الحالي', 'Current Hifz Status')}
                          </label>
                          <select
                            id="adm-hifz"
                            value={formData.hifzStatus}
                            onChange={(e) => handleChange('hifzStatus', e.target.value)}
                            className={`${inputBase} border-sand-border`}
                          >
                            {hifzOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="adm-gender" className={labelCls}>
                            {tx('الجنس', 'Gender')}
                          </label>
                          <input
                            id="adm-gender"
                            type="text"
                            value={tx('ذكر (كلية داخلية للبنين)', 'Male (Residential Boys College)')}
                            disabled
                            className="w-full h-11 px-3.5 rounded-[10px] bg-parchment-50 border border-sand-border text-xs text-ink-text-muted"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Guardian Details */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div className="border-b border-sand-border pb-3">
                        <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                          {tx('الخطوة ٢: بيانات ولي الأمر والتواصل', 'Step 2: Guardian / Parental Contact')}
                        </h3>
                        <p className="text-xs text-ink-text-muted">{tx('جهة الاتصال الأساسية لتحديد موعد المقابلة وموافقات السكن الداخلي.', 'Primary contact for interview scheduling and boarding approvals.')}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label htmlFor="adm-parent" className={labelCls}>
                            {tx('اسم الوالد / ولي الأمر *', 'Parent / Guardian Name *')}
                          </label>
                          <input
                            id="adm-parent"
                            type="text"
                            value={formData.parentName}
                            onChange={(e) => handleChange('parentName', e.target.value)}
                            placeholder={tx('مثال: الحاج محمد رضوان', 'e.g. Al-Haj Mohamed Rizwan')}
                            aria-invalid={!!errors.parentName}
                            className={`${inputBase} ${borderFor(errors.parentName)}`}
                          />
                          {fieldError('parentName')}
                        </div>

                        <div>
                          <label htmlFor="adm-relationship" className={labelCls}>
                            {tx('صلة القرابة *', 'Relationship *')}
                          </label>
                          <select
                            id="adm-relationship"
                            value={formData.relationship}
                            onChange={(e) => handleChange('relationship', e.target.value)}
                            className={`${inputBase} border-sand-border`}
                          >
                            {relationshipOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="adm-phone" className={labelCls}>
                            {tx('رقم الهاتف الأساسي *', 'Primary Phone Number *')}
                          </label>
                          <input
                            id="adm-phone"
                            type="tel"
                            dir="ltr"
                            value={formData.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            placeholder={tx('مثال: 0771234567', 'e.g. 0771234567')}
                            aria-invalid={!!errors.phone}
                            className={`${inputBase} ${borderFor(errors.phone)}`}
                          />
                          {fieldError('phone')}
                        </div>

                        <div>
                          <label htmlFor="adm-whatsapp" className={labelCls}>
                            {tx('رقم الواتساب', 'WhatsApp Contact')}
                          </label>
                          <input
                            id="adm-whatsapp"
                            type="tel"
                            dir="ltr"
                            value={formData.whatsapp}
                            onChange={(e) => handleChange('whatsapp', e.target.value)}
                            placeholder={tx('مثال: 0771234567', 'e.g. 0771234567')}
                            className={`${inputBase} border-sand-border`}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label htmlFor="adm-email" className={labelCls}>
                            {tx('البريد الإلكتروني (اختياري)', 'Email Address (Optional)')}
                          </label>
                          <input
                            id="adm-email"
                            type="email"
                            dir="ltr"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder={'parent@example.com'}
                            aria-invalid={!!errors.email}
                            className={`${inputBase} ${borderFor(errors.email)}`}
                          />
                          {fieldError('email')}
                        </div>

                        <div className="sm:col-span-2">
                          <label htmlFor="adm-address" className={labelCls}>
                            {tx('عنوان السكن الدائم *', 'Residential Permanent Address *')}
                          </label>
                          <textarea
                            id="adm-address"
                            rows={3}
                            value={formData.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            placeholder={tx('رقم المنزل، الشارع، القرية، المنطقة (مثال: مدلپلّي، كالبيتيا)', 'House No., Street, Village, District (e.g., Mudalippalli, Kalpitiya)')}
                            aria-invalid={!!errors.address}
                            className={`${areaBase} ${borderFor(errors.address)}`}
                          />
                          {fieldError('address')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Education & Course Choice */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div className="border-b border-sand-border pb-3">
                        <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                          {tx('الخطوة ٣: اختيار البرنامج الأكاديمي', 'Step 3: Academic Program Selection')}
                        </h3>
                        <p className="text-xs text-ink-text-muted">{tx('اختر المسار المطلوب واذكر خلفية الدراسة السابقة.', 'Select desired track and provide previous schooling background.')}</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label htmlFor="adm-course" className={labelCls}>
                            {tx('البرنامج المطلوب *', 'Target Program *')}
                          </label>
                          <select
                            id="adm-course"
                            value={formData.course}
                            onChange={(e) => handleChange('course', e.target.value)}
                            aria-invalid={!!errors.course}
                            className={`${inputBase} ${borderFor(errors.course)}`}
                          >
                            {courseOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {fieldError('course')}
                        </div>

                        <div>
                          <label htmlFor="adm-prev" className={labelCls}>
                            {tx('المدرسة / المدرسة الدينية السابقة', 'Previous School / Madrasa Attended')}
                          </label>
                          <input
                            id="adm-prev"
                            type="text"
                            value={formData.previousEducation}
                            onChange={(e) => handleChange('previousEducation', e.target.value)}
                            placeholder={tx('مثال: مدرسة الأقصى الإسلامية، كالبيتيا', 'e.g. Al-Aqsa Muslim Vidyalaya, Kalpitiya')}
                            className={`${inputBase} border-sand-border`}
                          />
                        </div>

                        <div>
                          <label htmlFor="adm-notes" className={labelCls}>
                            {tx('ملاحظات تربوية أو طبية خاصة (اختياري)', 'Special Tarbiyyah or Medical Notes (Optional)')}
                          </label>
                          <textarea
                            id="adm-notes"
                            rows={3}
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder={tx('أي قيود غذائية أو تاريخ طبي أو ملاحظات خاصة لمشرف السكن.', 'Any dietary restrictions, medical history, or specific notes for the boarding warden.')}
                            className={`${areaBase} border-sand-border`}
                          />
                          <p className="text-[11px] text-ink-text-muted mt-1">
                            {tx('ستتم مناقشة هذه الملاحظات خلال المقابلة.', 'These notes will be discussed at the interview.')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Review & Final Submission */}
                  {currentStep === 4 && (
                    <div className="space-y-6">
                      <div className="border-b border-sand-border pb-3">
                        <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                          {tx('الخطوة ٤: المراجعة والتأكيد', 'Step 4: Review & Confirmation')}
                        </h3>
                        <p className="text-xs text-ink-text-muted">{tx('تحقق من جميع البيانات قبل الإرسال النهائي إلى مسجل القبول.', 'Verify all details before final transmission to admissions registrar.')}</p>
                      </div>

                      <div className="rounded-xl bg-parchment-50 border border-sand-border p-5 space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">{tx('اسم الطالب:', 'Student Name:')}</span>
                          <span className="font-semibold text-ink-green-900">{formData.studentName}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">{tx('العمر / تاريخ الميلاد:', 'Age / DOB:')}</span>
                          <span className="font-semibold text-ink-green-900">
                            {liveAge ? ageLabel(liveAge) : ''} (<span dir="ltr">{formData.dateOfBirth}</span>)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">{tx('البرنامج المطلوب:', 'Target Program:')}</span>
                          <span className="font-semibold text-emerald-700">{optionLabel(courseOptions, formData.course)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">{tx('ولي الأمر:', 'Guardian:')}</span>
                          <span className="font-semibold text-ink-green-900">
                            {formData.parentName} ({optionLabel(relationshipOptions, formData.relationship)})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">{tx('الهاتف:', 'Phone:')}</span>
                          <span className="font-semibold text-ink-green-900" dir="ltr">{formData.phone}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">{tx('العنوان:', 'Address:')}</span>
                          <span className="font-semibold text-ink-green-900">{formData.address}</span>
                        </div>
                      </div>

                      {!isAuthenticated && (
                        <div className="p-3.5 rounded-lg bg-parchment-50 border border-sand-border text-xs text-ink-text-secondary leading-relaxed">
                          {tx('لتتبع حالة طلبك، يرجى تسجيل الدخول أو إنشاء حساب.', 'To track your application status, please login or create an account.')}{' '}
                          <Link to="/login" className="font-semibold text-emerald-700 hover:text-ink-green-900">{tx('تسجيل الدخول', 'Login')}</Link>
                          {' · '}
                          <Link to="/register" className="font-semibold text-emerald-700 hover:text-ink-green-900">{tx('إنشاء حساب', 'Create Account')}</Link>
                        </div>
                      )}

                      <div className="p-3.5 rounded-lg bg-mint-wash-100/70 border border-emerald-700/20 text-xs text-emerald-800 leading-relaxed">
                        {tx('بتقديم هذا الطلب، تقر بأن جميع المعلومات المقدمة صحيحة وتوافق على الالتزام بقواعد السلوك في السكن الداخلي وإرشادات التربية في دار العلوم كاشف الهدى.', 'By submitting this application, you certify that all information provided is accurate and agree to adhere to the residential code of conduct and Tarbiyyah guidelines of Dharul Uloom Kashiful Hudha.')}
                      </div>
                    </div>
                  )}

                  {submitError && (
                    <div className="p-3.5 rounded-lg border border-feedback-danger/30 bg-feedback-danger/5 text-xs text-feedback-danger flex items-start gap-2" role="alert">
                      <span className="material-symbols-outlined text-[18px] shrink-0">{'error'}</span>
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-6 border-t border-sand-border">
                    {currentStep > 1 ? (
                      <button
                        type="button"
                        onClick={prevStep}
                        className="px-5 py-2.5 rounded-[10px] border border-sand-border hover:bg-sand-border/30 text-xs font-semibold text-ink-text-primary"
                      >
                        {tx('رجوع', 'Back')}
                      </button>
                    ) : (
                      <div></div>
                    )}

                    {currentStep < 4 ? (
                      <button
                        type="button"
                        onClick={nextStep}
                        className="px-6 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
                      >
                        {tx('المتابعة إلى الخطوة التالية', 'Continue to Next Step')}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                      >
                        {loading ? tx('جاري الإرسال...', 'Submitting...') : tx('إرسال الطلب', 'Submit Application')}
                      </button>
                    )}
                  </div>

                </form>
              )}

            </main>

          </div>
        </div>
      </section>

    </div>
  )
}
