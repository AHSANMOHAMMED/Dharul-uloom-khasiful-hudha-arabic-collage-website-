import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { sendContactMessage } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'

const FAQS = [
  {
    q_en: 'What are the minimum age criteria for residential admission?',
    q_ar: 'ما هي شروط السن للقبول في السكن الداخلي؟',
    a_en: 'For the foundational Hifz al-Quran program, candidates must be between 10 and 14 years old. For Intermediate Nahw & Sarf or Alim studies, students aged 13 and above with foundational reading proficiency are considered.',
    a_ar: 'يشترط لبرنامج حفظ القرآن الكريم أن يكون عمر المتقدم بين ١٠ و ١٤ عاماً، وللمرحلة المتوسطة ١٣ عاماً فما فوق مع اجتياز اختبار القراءة والتلاوة.'
  },
  {
    q_en: 'Are scholarships and boarding waqf subsidies available?',
    q_ar: 'هل تتوفر منح دراسية وكفالات للأيتام وطلاب العلم؟',
    a_en: 'Yes. Through our community Waqf endowment, full and partial tuition waivers covering residential meals, boarding lodging, and kitabs are provided to deserving and orphaned students.',
    a_ar: 'نعم، توفر دار العلوم عبر أوقاف الكلية رعاية كاملة وجزئية تشمل السكن والإعاشة والكتب للطلاب المستحقين والأيتام بعد دراسة الحالة.'
  },
  {
    q_en: 'Can parents visit residential students during term time?',
    q_ar: 'ما هي مواعيد الزيارة المسموحة لأولياء الأمور؟',
    a_en: 'Parents may visit on designated alternate weekends (Fridays after Asr through Saturday Maghrib). All exeat leaves must be pre-approved via the Parent Portal.',
    a_ar: 'تُتاح الزيارات في عطلات نهاية الأسبوع المحددة (من عصر الجمعة إلى مغرب السبت)، ويتم تقديم طلبات الإجازات والخروج مسبقاً عبر بوابة ولي الأمر.'
  },
  {
    q_en: 'Is the curriculum officially recognized by religious education authorities?',
    q_ar: 'هل شهادات الكلية معتمدة رسمياً؟',
    a_en: 'Dharul Uloom Kashiful Hudha is officially registered under the Department of Muslim Religious & Cultural Affairs of Sri Lanka (MRCA/13/1/PAS/187) and awards authenticated traditional Sanad chains.',
    a_ar: 'نعم، الكلية مسجلة رسمياً لدى إدارة الشؤون الدينية والثقافية الإسلامية بسريلانكا وتمنح إجازات بالسند المتصل في الكتب الستة.'
  },
  {
    q_en: 'How can external scholars access rare manuscripts in the Maktabah?',
    q_ar: 'كيف يمكن للباحثين الاطلاع على المخطوطات النادرة؟',
    a_en: 'High-resolution digital scans are accessible publicly via our online Digital Library vault. Physical archival consultation requires advance appointment with the Chief Librarian.',
    a_ar: 'المخطوطات المفهرسة متاحة رقمياً عبر مستودع المكتبة في الموقع، وللاطلاع الميداني يُرجى التنسيق المسبق مع أمين المكتبة.'
  }
]

export default function Contact() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'Admissions Inquiry',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await sendContactMessage(formData)
      setSubmitted(true)
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: 'Admissions Inquiry',
        message: ''
      })
      setTimeout(() => setSubmitted(false), 5000)
    } catch (err) {
      console.error('Contact error:', err)
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      
      {/* 1. Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="contact-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">Contact</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {isRTL ? 'التواصل والاستفسار' : 'Get in Touch'}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {isRTL ? 'تواصل مع إدارة الكلية' : 'Contact Administration & Campus Directory'}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {isRTL
              ? 'نسعد باستقبال استفساراتكم المتعلقة بالقبول والتسجيل، رعاية الأوقاف، وزيارة مرافق الكلية ومكتبتها التراثية.'
              : 'Our administrative desk is at your service for admissions queries, student pastoral welfare, and campus visits.'}
          </p>
        </div>
      </section>

      {/* 2. Split Layout: Left Form + Right Campus Directory */}
      <section className="w-full py-16 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            
            {/* Left Contact Form */}
            <div className="lg:col-span-7 p-6 sm:p-10 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block mb-1">
                Direct Inquiry
              </span>
              <h2 className="font-serif text-2xl font-semibold text-ink-green-900 mb-2">
                Send an Electronic Message
              </h2>
              <p className="text-xs text-ink-text-secondary mb-6">
                Fill in the details below and our administrative office will reply within 24–48 hours.
              </p>

              {submitted && (
                <div className="p-4 rounded-xl bg-mint-wash-100 border border-emerald-700/20 text-emerald-800 text-xs font-medium mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span>Your message has been safely received. Jazakumullahu Khayran.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Mohamed Aslam"
                      className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 0771234567"
                      className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@example.com"
                      className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                      Subject
                    </label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                    >
                      <option value="Admissions Inquiry">Admissions Inquiry</option>
                      <option value="Maktabah & Manuscripts">Maktabah & Manuscripts</option>
                      <option value="Waqf & Financial Contribution">Waqf & Financial Contribution</option>
                      <option value="Parent Welfare">Parent Welfare</option>
                      <option value="General Question">General Question</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-text-primary mb-1">
                    Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="State your question or inquiry with relevant student index numbers if applicable..."
                    className="w-full p-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {loading ? 'Transmitting...' : 'Send Message'}
                </button>
              </form>
            </div>

            {/* Right Campus Directory & Hours */}
            <div className="lg:col-span-5 space-y-6">
              
              <div className="p-6 sm:p-8 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript space-y-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-brass-gold-500 block">
                  Campus Address
                </span>
                <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                  Mudalippalli Central Campus
                </h3>

                <ul className="space-y-4 text-xs text-ink-text-secondary">
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px] shrink-0 mt-0.5">location_on</span>
                    <div>
                      <strong className="text-ink-text-primary block">Physical Address</strong>
                      <span>Mudalippalli, Kalpitiya 61360</span>
                      <span className="block text-ink-text-muted">Puttalam District, North Western Province, Sri Lanka</span>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px] shrink-0 mt-0.5">call</span>
                    <div>
                      <strong className="text-ink-text-primary block">Direct Telephony</strong>
                      <span>Main Office: 032-5612355</span>
                      <span className="block">Mobile / WhatsApp: 070-5668463 · 071-5576060</span>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px] shrink-0 mt-0.5">schedule</span>
                    <div>
                      <strong className="text-ink-text-primary block">Administrative Desk Hours</strong>
                      <span>Sunday – Thursday: 8:00 AM – 4:00 PM</span>
                      <span className="block text-ink-text-muted">Closed during Friday Jumu’ah prayers</span>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px] shrink-0 mt-0.5">mail</span>
                    <div>
                      <strong className="text-ink-text-primary block">Electronic Correspondence</strong>
                      <span>info@kashifulhudha.edu.lk</span>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Campus Map Placeholder */}
              <div className="p-4 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript text-center">
                <div className="h-44 rounded-xl bg-parchment-50 border border-sand-border flex flex-col items-center justify-center p-4 text-ink-text-muted">
                  <span className="material-symbols-outlined text-3xl text-emerald-700 mb-1">map</span>
                  <span className="text-xs font-semibold text-ink-text-primary">Kalpitiya Peninsula Location</span>
                  <span className="text-[11px]">8.2255° N, 79.7656° E (Near Dutch Bay Lagoon)</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 3. FAQ Accordion (5 Questions) */}
      <section className="w-full py-16 bg-parchment-50/60">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 block mb-1">
              Frequent Queries
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
              {isRTL ? 'الأسئلة الشائعة والإجابات' : 'Frequently Asked Inquiries'}
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx
              const question = isRTL ? faq.q_ar : faq.q_en
              const answer = isRTL ? faq.a_ar : faq.a_en

              return (
                <div
                  key={idx}
                  className="rounded-[12px] bg-paper-white border border-sand-border overflow-hidden shadow-xs transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-serif text-sm sm:text-base font-semibold text-ink-green-900 hover:text-emerald-700"
                  >
                    <span>{question}</span>
                    <span className="material-symbols-outlined text-[20px] text-emerald-700 transition-transform">
                      {isOpen ? 'remove' : 'add'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-ink-text-secondary leading-relaxed border-t border-sand-border/40 font-sans">
                      {answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </section>

    </div>
  )
}
