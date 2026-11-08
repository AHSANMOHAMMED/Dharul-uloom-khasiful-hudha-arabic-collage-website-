import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import KhatamPattern from './KhatamPattern'
import { tx } from '../lib/tx'

export default function Footer() {
  useTranslation()
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
                alt={tx('شعار دار العلوم كاشف الهدى', 'Dharul Uloom Kashiful Hudha Logo')} 
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
              <a
                href="https://www.facebook.com/100088419063008"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tx('فيسبوك', 'Facebook')}
                className="w-9 h-9 rounded-full bg-paper-white/5 border border-sand-border/20 flex items-center justify-center text-dark-text-primary/75 hover:text-gold-wash-100 hover:border-brass-gold-500/50 transition-colors"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a
                href="https://wa.me/94705668463"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tx('واتساب', 'WhatsApp')}
                className="w-9 h-9 rounded-full bg-paper-white/5 border border-sand-border/20 flex items-center justify-center text-dark-text-primary/75 hover:text-gold-wash-100 hover:border-brass-gold-500/50 transition-colors"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="font-serif text-base font-semibold text-paper-white mb-4 flex items-center gap-2">
              <span className="w-4 h-[1px] bg-brass-gold-500"></span>
              <span>{tx('دليل الاتصال', 'Contact Directory')}</span>
            </h4>
            <ul className="space-y-3.5 text-xs sm:text-sm text-dark-text-primary/80">
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-500 text-[18px] mt-0.5 shrink-0">{'call'}</span>
                <div>
                  <div className="text-xs uppercase tracking-wider text-dark-text-primary/60 font-semibold mb-0.5">
                    {tx('الهواتف', 'Hotlines')}
                  </div>
                  <div className="hover:text-gold-wash-100 transition-colors">032-5612355</div>
                  <div className="hover:text-gold-wash-100 transition-colors">070-5668463 · 071-5576060</div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-500 text-[18px] mt-0.5 shrink-0">{'location_on'}</span>
                <div>
                  <div className="text-xs uppercase tracking-wider text-dark-text-primary/60 font-semibold mb-0.5">
                    {tx('مقر الكلية', 'Campus Grounds')}
                  </div>
                  <div>{tx('موداليبالي، كلبيتيا', 'Mudalippalli, Kalpitiya')}</div>
                  <div>{tx('منطقة بوتلام، سريلانكا', 'Puttalam District, Sri Lanka')}</div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-500 text-[18px] mt-0.5 shrink-0">{'mail'}</span>
                <div>
                  <div className="text-xs uppercase tracking-wider text-dark-text-primary/60 font-semibold mb-0.5">
                    {tx('البريد الإلكتروني', 'Electronic Inquiries')}
                  </div>
                  <div className="hover:text-gold-wash-100 transition-colors">{'info@kashifulhudha.edu.lk'}</div>
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
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">{'chevron_right'}</span>
                  <span>{tx('التقديم للقبول', 'Admission Application')}</span>
                </Link>
              </li>
              <li>
                <Link to="/library" className="hover:text-gold-wash-100 transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">{'chevron_right'}</span>
                  <span>{tx('المكتبة الرقمية (مكتبة)', 'Maktabah Islamic Library')}</span>
                </Link>
              </li>
              <li>
                <Link to="/curriculum" className="hover:text-gold-wash-100 transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">{'chevron_right'}</span>
                  <span>{tx('المنهج الدراسي والسند', 'Curriculum & Sanad')}</span>
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-gold-wash-100 transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">{'chevron_right'}</span>
                  <span>{tx('دخول الطلاب وأولياء الأمور', 'Student & Parent Portal Login')}</span>
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-gold-wash-100 transition-colors flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-brass-gold-500">{'chevron_right'}</span>
                  <span>{tx('اتصل بنا', 'Contact Us')}</span>
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Footer Sub-Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-dark-text-primary/60">
          <p>
            © {currentYear} {tx('كلية دار العلوم كاشف الهدى العربية.', 'Dharul Uloom Kashiful Hudha Arabic College.')} {tx('جميع الحقوق محفوظة.', 'All rights reserved.')}
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{tx('واجهة المخطوطة الحديثة 2.0', 'Modern Manuscript UI v2.0')}</span>
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
