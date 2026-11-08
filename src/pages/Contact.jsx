import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { sendContactMessage } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'
import { tx } from '../lib/tx';

/** Built at render so text follows the UI language. */
const faqs = () => [
  {
    q: tx('ما هي شروط السن للقبول في السكن الداخلي؟', 'What are the minimum age criteria for residential admission?'),
    a: tx('يشترط لبرنامج حفظ القرآن الكريم أن يكون عمر المتقدم بين ١٠ و ١٤ عاماً، وللمرحلة المتوسطة ١٣ عاماً فما فوق مع اجتياز اختبار القراءة والتلاوة.', 'For the foundational Hifz al-Quran program, candidates must be between 10 and 14 years old. For Intermediate Nahw & Sarf or Alim studies, students aged 13 and above with foundational reading proficiency are considered.')
  },
  {
    q: tx('هل تتوفر منح دراسية وكفالات للأيتام وطلاب العلم؟', 'Are scholarships and boarding waqf subsidies available?'),
    a: tx('نعم، توفر دار العلوم عبر أوقاف الكلية رعاية كاملة وجزئية تشمل السكن والإعاشة والكتب للطلاب المستحقين والأيتام بعد دراسة الحالة.', 'Yes. Through our community Waqf endowment, full and partial tuition waivers covering residential meals, boarding lodging, and kitabs are provided to deserving and orphaned students.')
  },
  {
    q: tx('ما هي مواعيد الزيارة المسموحة لأولياء الأمور؟', 'Can parents visit residential students during term time?'),
    a: tx('تُتاح الزيارات في عطلات نهاية الأسبوع المحددة (من عصر الجمعة إلى مغرب السبت)، ويتم تقديم طلبات الإجازات والخروج مسبقاً عبر بوابة ولي الأمر.', 'Parents may visit on designated alternate weekends (Fridays after Asr through Saturday Maghrib). All exeat leaves must be pre-approved via the Parent Portal.')
  },
  {
    q: tx('هل شهادات الكلية معتمدة رسمياً؟', 'Is the curriculum officially recognized by religious education authorities?'),
    a: tx('نعم، الكلية مسجلة رسمياً لدى إدارة الشؤون الدينية والثقافية الإسلامية بسريلانكا وتمنح إجازات بالسند المتصل في الكتب الستة.', 'Dharul Uloom Kashiful Hudha is officially registered under the Department of Muslim Religious & Cultural Affairs of Sri Lanka (MRCA/13/1/PAS/187) and awards authenticated traditional Sanad chains.')
  },
  {
    q: tx('كيف يمكن للباحثين الاطلاع على المخطوطات النادرة؟', 'How can external scholars access rare manuscripts in the Maktabah?'),
    a: tx('المخطوطات المفهرسة متاحة رقمياً عبر مستودع المكتبة في الموقع، وللاطلاع الميداني يُرجى التنسيق المسبق مع أمين المكتبة.', 'High-resolution digital scans are accessible publicly via our online Digital Library vault. Physical archival consultation requires advance appointment with the Chief Librarian.')
  }
]

export default function Contact() {
  useTranslation() // re-render on language change
  const subjects = [
    { value: 'Admissions Inquiry', label: tx('استفسار عن القبول', 'Admissions Inquiry') },
    { value: 'Maktabah & Manuscripts', label: tx('المكتبة والمخطوطات', 'Maktabah & Manuscripts') },
    { value: 'Waqf & Financial Contribution', label: tx('الوقف والمساهمات المالية', 'Waqf & Financial Contribution') },
    { value: 'Parent Welfare', label: tx('شؤون أولياء الأمور', 'Parent Welfare') },
    { value: 'General Question', label: tx('سؤال عام', 'General Question') },
  ]

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'Admissions Inquiry',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [openFaq, setOpenFaq] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
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
      setError(tx('تعذر إرسال الرسالة. يرجى المحاولة مرة أخرى أو الاتصال بنا هاتفياً.', 'Failed to send message. Please try again or call us.'))
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
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label={tx('مسار التنقل', 'Breadcrumb')}>
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">{tx('الرئيسية', 'Home')}</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">{tx('اتصل بنا', 'Contact')}</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {tx('التواصل والاستفسار', 'Get in Touch')}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {tx('تواصل مع إدارة الكلية', 'Contact Administration & Campus Directory')}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {tx('نسعد باستقبال استفساراتكم المتعلقة بالقبول والتسجيل، رعاية الأوقاف، وزيارة مرافق الكلية ومكتبتها التراثية.', 'Our administrative desk is at your service for admissions queries, student pastoral welfare, and campus visits.')}
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
                {tx('استفسار مباشر', 'Direct Inquiry')}
              </span>
              <h2 className="font-serif text-2xl font-semibold text-ink-green-900 mb-2">
                {tx('أرسل رسالة إلكترونية', 'Send an Electronic Message')}
              </h2>
              <p className="text-xs text-ink-text-secondary mb-6">
                {tx('املأ البيانات أدناه وسيرد عليك المكتب الإداري خلال ٢٤–٤٨ ساعة.', 'Fill in the details below and our administrative office will reply within 24–48 hours.')}
              </p>

              {submitted && (
                <div className="p-4 rounded-xl bg-mint-wash-100 border border-emerald-700/20 text-emerald-800 text-xs font-medium mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">{'check_circle'}</span>
                  <span>{tx('تم استلام رسالتك بأمان. جزاكم الله خيراً.', 'Your message has been safely received. Jazakumullahu Khayran.')}</span>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-xl bg-feedback-danger/5 border border-feedback-danger/30 text-feedback-danger text-xs font-medium mb-6 flex items-center gap-2" role="alert">
                  <span className="material-symbols-outlined text-lg">{'error'}</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-semibold text-ink-text-primary mb-1">
                      {tx('الاسم الكامل *', 'Your Full Name *')}
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={tx('مثال: محمد أسلم', 'e.g. Mohamed Aslam')}
                      className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-phone" className="block text-xs font-semibold text-ink-text-primary mb-1">
                      {tx('رقم الهاتف *', 'Phone Number *')}
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      dir="ltr"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder={tx('مثال: 0771234567', 'e.g. 0771234567')}
                      className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-semibold text-ink-text-primary mb-1">
                      {tx('البريد الإلكتروني *', 'Email Address *')}
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      dir="ltr"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder={'name@example.com'}
                      className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-subject" className="block text-xs font-semibold text-ink-text-primary mb-1">
                      {tx('الموضوع', 'Subject')}
                    </label>
                    <select
                      id="contact-subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full h-10 px-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                    >
                      {subjects.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-semibold text-ink-text-primary mb-1">
                    {tx('الرسالة *', 'Message *')}
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={tx('اكتب سؤالك أو استفسارك مع ذكر رقم قيد الطالب إن وجد...', 'State your question or inquiry with relevant student index numbers if applicable...')}
                    className="w-full p-3 rounded-[10px] bg-paper-white border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {loading ? tx('جاري الإرسال...', 'Transmitting...') : tx('إرسال الرسالة', 'Send Message')}
                </button>
              </form>
            </div>

            {/* Right Campus Directory & Hours */}
            <div className="lg:col-span-5 space-y-6">
              
              <div className="p-6 sm:p-8 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript space-y-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-brass-gold-500 block">
                  {tx('عنوان الحرم', 'Campus Address')}
                </span>
                <h3 className="font-serif text-xl font-semibold text-ink-green-900">
                  {tx('الحرم الرئيسي في مدلپلّي', 'Mudalippalli Central Campus')}
                </h3>

                <ul className="space-y-4 text-xs text-ink-text-secondary">
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px] shrink-0 mt-0.5">{'location_on'}</span>
                    <div>
                      <strong className="text-ink-text-primary block">{tx('العنوان', 'Physical Address')}</strong>
                      <span>{tx('مدلپلّي، كالبيتيا 61360', 'Mudalippalli, Kalpitiya 61360')}</span>
                      <span className="block text-ink-text-muted">{tx('مقاطعة بوتلام، المحافظة الشمالية الغربية، سريلانكا', 'Puttalam District, North Western Province, Sri Lanka')}</span>
                      <span className="block text-ink-text-muted font-mono" dir="ltr">5P2C+VMC</span>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px] shrink-0 mt-0.5">{'call'}</span>
                    <div>
                      <strong className="text-ink-text-primary block">{tx('الهاتف المباشر', 'Direct Telephony')}</strong>
                      <span>{tx('المكتب الرئيسي:', 'Main Office:')} <a href="tel:+94325612355" className="hover:text-emerald-700" dir="ltr">032-5612355</a></span>
                      <span className="block">
                        {tx('الجوال / واتساب:', 'Mobile / WhatsApp:')}{' '}
                        <a href="https://wa.me/94705668463" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline" dir="ltr">070-5668463</a>
                        {' · '}
                        <a href="tel:+94715576060" className="hover:text-emerald-700" dir="ltr">071-5576060</a>
                      </span>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px] shrink-0 mt-0.5">{'schedule'}</span>
                    <div>
                      <strong className="text-ink-text-primary block">{tx('ساعات عمل المكتب الإداري', 'Administrative Desk Hours')}</strong>
                      <span>{tx('الأحد – الخميس: ٨:٠٠ صباحاً – ٤:٠٠ مساءً', 'Sunday – Thursday: 8:00 AM – 4:00 PM')}</span>
                      <span className="block text-ink-text-muted">{tx('مغلق أثناء صلاة الجمعة', 'Closed during Friday Jumu’ah prayers')}</span>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-emerald-700 text-[20px] shrink-0 mt-0.5">{'mail'}</span>
                    <div>
                      <strong className="text-ink-text-primary block">{tx('المراسلات الإلكترونية', 'Electronic Correspondence')}</strong>
                      <a href="mailto:info@kashifulhudha.edu.lk" className="block hover:text-emerald-700" dir="ltr">{'info@kashifulhudha.edu.lk'}</a>
                      <a href="https://www.facebook.com/100088419063008" target="_blank" rel="noopener noreferrer" className="block text-emerald-700 hover:underline">{tx('فيسبوك', 'Facebook')}</a>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Campus Map Placeholder */}
              <div className="p-4 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript text-center">
                <div className="h-56 rounded-xl overflow-hidden bg-parchment-50 border border-sand-border">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3950.123!2d79.725!3d8.236!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zOMKwMTQnMTAuMCJOIDc5wrA0MyczMC4wIkU!5e0!3m2!1sen!2slk!4v1234567890"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={tx('موقع الكلية', 'College Location')}
                  ></iframe>
                </div>
                <div className="pt-3 flex flex-col items-center text-ink-text-muted">
                  <span className="text-xs font-semibold text-ink-text-primary">{tx('موقع شبه جزيرة كالبيتيا', 'Kalpitiya Peninsula Location')}</span>
                  <span className="text-[11px]">{tx('8.2255° شمالاً، 79.7656° شرقاً (قرب بحيرة داتش باي)', '8.2255° N, 79.7656° E (Near Dutch Bay Lagoon)')}</span>
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
              {tx('استفسارات متكررة', 'Frequent Queries')}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
              {tx('الأسئلة الشائعة والإجابات', 'Frequently Asked Inquiries')}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs().map((faq, idx) => {
              const isOpen = openFaq === idx
              const question = faq.q
              const answer = faq.a

              return (
                <div
                  key={idx}
                  className="rounded-[12px] bg-paper-white border border-sand-border overflow-hidden shadow-xs transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={isOpen}
                    className="w-full p-4 sm:p-5 text-start flex items-center justify-between gap-4 font-serif text-sm sm:text-base font-semibold text-ink-green-900 hover:text-emerald-700"
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
