import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import KhatamPattern from './KhatamPattern'
import { tx } from '../lib/tx'

export default function Footer() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full bg-ink-green-900 text-dark-text-primary relative overflow-hidden border-t border-sand-border/20">
      {/* Subtle Khatam Sulayman Watermark */}
      <KhatamPattern className="opacity-[0.03]" strokeColor="#FBF8F0" id="footer-khatam" />

      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 pb-12 border-b border-sand-border/15">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center gap-3">
              <img 
                src="/images/logo.jpg" 
                alt="Kashiful Hudha Emblem" 
                className="w-12 h-12 object-contain rounded-lg border border-sand-border/30 bg-paper-white/10"
              />
              <div className="flex flex-col">
                <span className="font-serif text-xl sm:text-2xl font-semibold text-paper-white tracking-tight">
                  {tx('دار العلوم كاشف الهدى', 'Dharul Uloom Kashiful Hudha')}
                </span>
                <span className="text-sm text-gold-wash-100/90 font-arabic leading-none mt-1" dir="rtl">
                  دار العلوم كاشف الهدى — الكلية العربية
                </span>
              </div>
            </Link>
            <p className="text-dark-text-primary/75 text-sm leading-relaxed max-w-md font-sans">
              {tx(
                'مؤسسة تعليمية إسلامية رائدة تُعنى بترسيخ أصول العلم الشرعي الأصيل وحفظ كتاب الله وتخريج علماء عاملين يخدمون المجتمع بأمانة واعتدال.',
                'Cultivating authentic Islamic scholarship, spiritual excellence, and traditional transmission rooted in classical sources and contemporary community leadership.'
              )}
            </p>
            <div className="flex items-center gap-4 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-paper-white/5 border border-sand-border/20 text-xs text-brass-gold-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-brass-gold-500"></span>
                <span>{tx('تأسست في كلبيتيا، سريلانكا', 'Established Kalpitiya, Sri Lanka')}</span>
              </span>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="font-serif text-base font-semibold text-paper-white mb-4 flex items-center gap-2">
              <span className="w-4 h-[1px] bg-brass-gold-500"></span>
              <span>{tx('دليل الاتصال', t('contact.title') || 'Contact Directory')}</span>
            </h4>
            <ul className="space-y-3.5 text-xs sm:text-sm text-dark-text-primary/80">
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-500 text-[18px] mt-0.5 shrink-0">
                  call
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wider text-dark-text-primary/60 font-semibold mb-0.5">
                    {tx('الهواتف', 'Hotlines')}
                  </div>
                  <div className="hover:text-gold-wash-100 transition-colors">032-5612355</div>
                  <div className="hover:text-gold-wash-100 transition-colors">070-5668463 · 071-5576060</div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-500 text-[18px] mt-0.5 shrink-0">
                  location_on
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wider text-dark-text-primary/60 font-semibold mb-0.5">
                    {tx('مقر الكلية', 'Campus Grounds')}
                  </div>
                  <div>{tx('موداليبالي، كلبيتيا', 'Mudalippalli, Kalpitiya')}</div>
                  <div>{tx('منطقة بوتلام، سريلانكا', 'Puttalam District, Sri Lanka')}</div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-500 text-[18px] mt-0.5 shrink-0">
                  mail
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wider text-dark-text-primary/60 font-semibold mb-0.5">
                    {tx('البريد الإلكتروني', 'Electronic Inquiries')}
                  </div>
                  <div className="hover:text-gold-wash-100 transition-colors">info@kashifulhudha.edu.lk</div>
                </div>
              </li>
            </ul>
          </div>

          {/* Portals & Direct Links */}
          <div>
            <h4 className="font-serif text-base font-semibold text-paper-white mb-4 flex items-center gap-2">
              <span className="w-4 h-[1px] bg-brass-gold-500"></span>
              <span>{tx('بوابات الكلية', 'Institutional Portals')}</span>
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-dark-text-primary/80">
              <li>
                <Link to="/admissions" className="hover:text-gold-wash-100 transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">chevron_right</span>
                  <span>{tx('التقديم للقبول', t('nav.admissions') || 'Admission Application')}</span>
                </Link>
              </li>
              <li>
                <Link to="/library" className="hover:text-gold-wash-100 transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">chevron_right</span>
                  <span>{tx('المكتبة الرقمية (مكتبة)', t('nav.library') || 'Maktabah Islamic Library')}</span>
                </Link>
              </li>
              <li>
                <Link to="/curriculum" className="hover:text-gold-wash-100 transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">chevron_right</span>
                  <span>{tx('المنهج الدراسي والسند', t('nav.curriculum') || 'Curriculum & Sanad')}</span>
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-gold-wash-100 transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">chevron_right</span>
                  <span>{tx('دخول الطلاب وأولياء الأمور', 'Student & Parent Portal Login')}</span>
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-gold-wash-100 transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">chevron_right</span>
                  <span>{tx('اتصل بنا', t('nav.contact') || 'Contact Us')}</span>
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Footer Sub-Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-dark-text-primary/60">
          <p>
            © {currentYear} Dharul Uloom Kashiful Hudha Arabic College. {tx('جميع الحقوق محفوظة.', 'All rights reserved.')}
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Modern Manuscript UI v2.0</span>
            </span>
            <span>·</span>
            <Link to="/about" className="hover:text-gold-wash-100 transition-colors">{tx('من نحن', 'About Us')}</Link>
            <span>·</span>
            <Link to="/contact" className="hover:text-gold-wash-100 transition-colors">{tx('خريطة المقر', 'Campus Map')}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
