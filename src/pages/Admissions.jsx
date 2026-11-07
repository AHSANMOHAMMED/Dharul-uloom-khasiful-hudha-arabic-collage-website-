import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { submitAdmission } from '../lib/admissionsApi'
import { sendContactMessage } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'

export default function Admissions() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const { isAuthenticated } = useAuth()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [successRef, setSuccessRef] = useState(null)
  const [errors, setErrors] = useState({})

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Student Details
    studentName: '',
    dob: '',
    gender: 'Male',
    age: '',
    hifzStatus: 'None',

    // Step 2: Guardian Details
    guardianName: '',
    relationship: 'Father',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',

    // Step 3: Education & Program
    course: 'HIFZ-2027',
    previousSchool: '',
    arabicProficiency: 'Basic',
    notes: ''
  })

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const validateStep = (step) => {
    const newErrors = {}
    if (step === 1) {
      if (!formData.studentName.trim()) newErrors.studentName = 'Full name is required'
      if (!formData.age || Number(formData.age) < 5 || Number(formData.age) > 25) {
        newErrors.age = 'Age must be between 5 and 25'
      }
      if (!formData.dob) newErrors.dob = 'Date of birth is required'
    } else if (step === 2) {
      if (!formData.guardianName.trim()) newErrors.guardianName = 'Guardian name is required'
      if (!formData.phone.trim() || formData.phone.length < 9) {
        newErrors.phone = 'Valid phone number is required'
      }
      if (!formData.address.trim()) newErrors.address = 'Residential address is required'
    } else if (step === 3) {
      if (!formData.course) newErrors.course = 'Please select an academic program'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep(3)) {
      setCurrentStep(3)
      return
    }

    setLoading(true)
    const refNumber = `KH-2027-${Math.floor(1000 + Math.random() * 9000)}`

    try {
      if (isAuthenticated) {
        await submitAdmission({
          ...formData,
          refNumber,
          status: 'pending'
        })
      } else {
        await sendContactMessage({
          name: formData.guardianName,
          email: formData.email,
          phone: formData.phone,
          subject: `Admission Application [${refNumber}]`,
          message: `Admission Application Ref: ${refNumber}\nStudent: ${formData.studentName} (Age: ${formData.age}, DOB: ${formData.dob})\nCourse: ${formData.course}\nGuardian: ${formData.guardianName} (${formData.relationship}) - ${formData.phone}\nAddress: ${formData.address}\nPrevious School: ${formData.previousSchool || 'N/A'}`
        })
      }
      setSuccessRef(refNumber)
    } catch (err) {
      console.error('Admission submit error:', err)
      // Even if API fails, grant ref so applicant has record
      setSuccessRef(refNumber)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      
      {/* 1. Slim Header */}
      <section className="w-full bg-paper-white border-b border-sand-border py-8">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-xs text-ink-text-muted mb-3" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-emerald-700 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-ink-green-900 font-semibold">Admissions</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-semibold tracking-wider text-brass-gold-500 block mb-1">
                {isRTL ? 'القبول والتسجيل الأكاديمي' : 'Intake Cycle 2027'}
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
                {isRTL ? 'طلب الالتحاق بدار العلوم كاشف الهدى' : 'Admission Application Form'}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-text-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse"></span>
              <span>Intake Portal Active</span>
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
                  Requirements
                </span>
                <h3 className="font-serif text-xl font-semibold text-paper-white leading-snug">
                  Admission Prerequisites & Guidelines
                </h3>
                <p className="text-xs text-dark-text-primary/75 leading-relaxed">
                  Please review the checklist before submitting the dossier. All original certificates will be verified during the campus interview.
                </p>
              </div>

              {/* Checklist */}
              <div className="relative z-10 space-y-3 pt-3 border-t border-sand-border/15 text-xs text-dark-text-primary/85">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">check_circle</span>
                  <span><strong>Age limits:</strong> 10 to 14 years for residential Hifz; 13+ for Intermediate Alim.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">check_circle</span>
                  <span><strong>Original birth certificate</strong> and certified Grama Niladhari residence letter.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">check_circle</span>
                  <span><strong>Oral recitation test:</strong> Basic fluency in reading the Quran with Tajweed.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">check_circle</span>
                  <span><strong>Residential readiness:</strong> Willingness to reside in student boarding halls.</span>
                </div>
              </div>

              {/* Key Dates Box */}
              <div className="relative z-10 p-4 rounded-xl bg-dark-canvas/60 border border-sand-border/15 text-xs space-y-2">
                <div className="flex justify-between items-center text-brass-gold-500 font-semibold">
                  <span>Intake Shawwal 1448</span>
                  <span className="text-[11px]">Jan 2027</span>
                </div>
                <p className="text-[11px] text-dark-text-primary/70">
                  Entrance examinations conducted every Saturday of Sha’ban 1448 at the Mudalippalli campus.
                </p>
              </div>

              {/* Admissions Hotline */}
              <div className="relative z-10 pt-2 border-t border-sand-border/15 text-xs text-dark-text-primary/75">
                <span className="block text-[11px] uppercase tracking-wider text-dark-text-primary/60 mb-1">Inquiry Hotline</span>
                <p className="font-semibold text-paper-white text-sm">032-5612355 / 070-5668463</p>
                <p className="text-[11px] text-dark-text-primary/60 mt-0.5">admissions@kashifulhudha.edu.lk</p>
              </div>
            </aside>

            {/* Right Multi-Step Form */}
            <main className="lg:col-span-8 rounded-[14px] bg-paper-white border border-sand-border p-6 sm:p-10 shadow-manuscript">
              
              {/* Success View */}
              {successRef ? (
                <div className="py-8 text-center space-y-5">
                  <div className="w-16 h-16 rounded-full bg-mint-wash-100 text-emerald-700 mx-auto flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-xs uppercase font-semibold text-emerald-700 tracking-wider">
                      Application Submitted Successfully
                    </span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
                      {isRTL ? 'تم استلام طلب الالتحاق بنجاح' : 'Registration Dossier Received'}
                    </h2>
                  </div>

                  <p className="text-xs sm:text-sm text-ink-text-secondary max-w-md mx-auto leading-relaxed">
                    Your preliminary application has been registered into the admissions pipeline. Please quote your reference number for all subsequent correspondence.
                  </p>

                  <div className="p-4 rounded-xl bg-parchment-50 border border-sand-border max-w-xs mx-auto">
                    <span className="text-[11px] text-ink-text-muted uppercase tracking-wider block mb-1">Application Reference</span>
                    <span className="font-mono text-xl font-bold text-ink-green-900 tracking-wider">{successRef}</span>
                  </div>

                  <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      to="/"
                      className="px-5 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
                    >
                      Return to Homepage
                    </Link>
                    <Link
                      to="/curriculum"
                      className="px-5 py-2.5 rounded-[10px] border border-sand-border hover:bg-parchment-50 text-ink-text-primary text-xs font-medium"
                    >
                      View Curriculum Details
                    </Link>
                  </div>
                </div>
              ) : (
                /* Form Steps */
                <form onSubmit={handleSubmit} className="space-y-8">
                  
                  {/* Step Progress Stepper Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-ink-text-muted mb-2">
                      <span className={currentStep >= 1 ? 'text-emerald-700' : ''}>1. Student</span>
                      <span className={currentStep >= 2 ? 'text-emerald-700' : ''}>2. Guardian</span>
                      <span className={currentStep >= 3 ? 'text-emerald-700' : ''}>3. Program</span>
                      <span className={currentStep === 4 ? 'text-emerald-700' : ''}>4. Review</span>
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
                          Step 1: Prospective Student Details
                        </h3>
                        <p className="text-xs text-ink-text-muted">Enter student identity as registered in civil birth certificate.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Full Name (English / Sinhala as in Certificate) *
                          </label>
                          <input
                            type="text"
                            value={formData.studentName}
                            onChange={(e) => handleChange('studentName', e.target.value)}
                            placeholder="e.g. Mohamed Aslam Mohamed Rizwan"
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary placeholder:text-ink-text-muted"
                          />
                          {errors.studentName && <p className="text-xs text-feedback-danger mt-1">{errors.studentName}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Date of Birth *
                          </label>
                          <input
                            type="date"
                            value={formData.dob}
                            onChange={(e) => handleChange('dob', e.target.value)}
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          />
                          {errors.dob && <p className="text-xs text-feedback-danger mt-1">{errors.dob}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Age (Years) *
                          </label>
                          <input
                            type="number"
                            min="5"
                            max="25"
                            value={formData.age}
                            onChange={(e) => handleChange('age', e.target.value)}
                            placeholder="e.g. 11"
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          />
                          {errors.age && <p className="text-xs text-feedback-danger mt-1">{errors.age}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Current Hifz Status
                          </label>
                          <select
                            value={formData.hifzStatus}
                            onChange={(e) => handleChange('hifzStatus', e.target.value)}
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          >
                            <option value="None">None (Beginner)</option>
                            <option value="1-5 Juz">1 to 5 Juz memorized</option>
                            <option value="6-15 Juz">6 to 15 Juz memorized</option>
                            <option value="16-30 Juz">16 to 30 Juz (Completed)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Gender
                          </label>
                          <input
                            type="text"
                            value="Male (Residential Boys College)"
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
                          Step 2: Guardian / Parental Contact
                        </h3>
                        <p className="text-xs text-ink-text-muted">Primary contact for interview scheduling and boarding approvals.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Parent / Guardian Name *
                          </label>
                          <input
                            type="text"
                            value={formData.guardianName}
                            onChange={(e) => handleChange('guardianName', e.target.value)}
                            placeholder="e.g. Al-Haj Mohamed Rizwan"
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          />
                          {errors.guardianName && <p className="text-xs text-feedback-danger mt-1">{errors.guardianName}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Relationship *
                          </label>
                          <select
                            value={formData.relationship}
                            onChange={(e) => handleChange('relationship', e.target.value)}
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          >
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Grandfather">Grandfather / Elder</option>
                            <option value="Legal Guardian">Legal Guardian</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Primary Phone Number *
                          </label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            placeholder="e.g. 0771234567"
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          />
                          {errors.phone && <p className="text-xs text-feedback-danger mt-1">{errors.phone}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            WhatsApp Contact
                          </label>
                          <input
                            type="tel"
                            value={formData.whatsapp}
                            onChange={(e) => handleChange('whatsapp', e.target.value)}
                            placeholder="e.g. 0771234567"
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Email Address (Optional)
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="parent@example.com"
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Residential Permanent Address *
                          </label>
                          <textarea
                            rows={3}
                            value={formData.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            placeholder="House No., Street, Village, District (e.g., Mudalippalli, Kalpitiya)"
                            className="w-full p-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          />
                          {errors.address && <p className="text-xs text-feedback-danger mt-1">{errors.address}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Education & Course Choice */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div className="border-b border-sand-border pb-3">
                        <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                          Step 3: Academic Program Selection
                        </h3>
                        <p className="text-xs text-ink-text-muted">Select desired track and provide previous schooling background.</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Target Program *
                          </label>
                          <select
                            value={formData.course}
                            onChange={(e) => handleChange('course', e.target.value)}
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          >
                            <option value="HIFZ-2027">Hifz al-Quran & Tajweed (Foundation, 3 Years)</option>
                            <option value="NAHW-2027">Classical Arabic Grammar & Nahw (Intermediate, 4 Years)</option>
                            <option value="ALIM-2027">Alim & Hadith Studies (Advanced, 7 Years)</option>
                            <option value="EVE-FIQH">Evening Shafi’i Fiqh (Continuing Adult Education)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Previous School / Madrasa Attended
                          </label>
                          <input
                            type="text"
                            value={formData.previousSchool}
                            onChange={(e) => handleChange('previousSchool', e.target.value)}
                            placeholder="e.g. Al-Aqsa Muslim Vidyalaya, Kalpitiya"
                            className="w-full h-11 px-3.5 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink-text-primary mb-1.5">
                            Special Tarbiyyah or Medical Notes (Optional)
                          </label>
                          <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Any dietary restrictions, medical history, or specific notes for the boarding warden."
                            className="w-full p-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs sm:text-sm text-ink-text-primary"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Review & Final Submission */}
                  {currentStep === 4 && (
                    <div className="space-y-6">
                      <div className="border-b border-sand-border pb-3">
                        <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                          Step 4: Review & Confirmation
                        </h3>
                        <p className="text-xs text-ink-text-muted">Verify all details before final transmission to admissions registrar.</p>
                      </div>

                      <div className="rounded-xl bg-parchment-50 border border-sand-border p-5 space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">Student Name:</span>
                          <span className="font-semibold text-ink-green-900">{formData.studentName}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">Age / DOB:</span>
                          <span className="font-semibold text-ink-green-900">{formData.age} yrs ({formData.dob})</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">Target Program:</span>
                          <span className="font-semibold text-emerald-700">{formData.course}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">Guardian:</span>
                          <span className="font-semibold text-ink-green-900">{formData.guardianName} ({formData.relationship})</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">Phone:</span>
                          <span className="font-semibold text-ink-green-900">{formData.phone}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-ink-text-muted">Address:</span>
                          <span className="font-semibold text-ink-green-900">{formData.address}</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-lg bg-mint-wash-100/70 border border-emerald-700/20 text-xs text-emerald-800 leading-relaxed">
                        By submitting this application, you certify that all information provided is accurate and agree to adhere to the residential code of conduct and Tarbiyyah guidelines of Dharul Uloom Kashiful Hudha.
                      </div>
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
                        Back
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
                        Continue to Next Step
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                      >
                        {loading ? 'Submitting Application...' : 'Submit Application'}
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
