import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import KhatamPattern from '../components/KhatamPattern';
import { listCurriculum } from '../lib/contentApi';
import { localized } from '../lib/localized';
import { tx } from '../lib/tx';

const hrs = (n) => tx('{n} ساعات/أسبوع', '{n} hrs/wk').replace('{n}', n);

/** Default four-stage outline, shown until the CMS has curriculum rows (built at render so text follows the UI language). */
const defaultStages = () => [
  {
    id: 'foundation',
    title: tx('المرحلة التأسيسية', 'Foundation Stage'),
    years: tx('السنوات ١ - ٣ (الأعمار ١٠-١٣)', 'Years 1 - 3 (Ages 10-13)'),
    focus: tx('حفظ القرآن الكريم وإتقان التجويد ومبادئ المفردات العربية.', 'Memorization of the Quran, Tajweed mastery, and primary Arabic vocabulary.'),
    subjects: [
      { code: 'QRN-101', name: tx('حفظ القرآن', 'Hifz al-Quran'), hours: hrs(18), desc: tx('تسميع السبق اليومي ودورات مراجعة السبقي الشاملة على يد حفاظ مجازين.', 'Daily Sabaq recitation and comprehensive Sabqi repetition cycles under certified Huffaz.') },
      { code: 'TAJ-101', name: tx('التجويد ومخارج الحروف', 'Tajweed & Makharij'), hours: hrs(4), desc: tx('دراسة متن تحفة الأطفال مع التصحيح العملي لمخارج الحروف.', 'Study of Tuhfat al-Atfal text with practical phonetic correction of vocal articulation.') },
      { code: 'ARB-101', name: tx('مبادئ العربية', 'Mabadi al-Arabiyyah'), hours: hrs(6), desc: tx('القراءة العربية الأساسية والإملاء واكتساب المفردات وتحسين الخط.', 'Foundational Arabic reading, dictation, vocabulary acquisition, and penmanship.') },
      { code: 'ISL-101', name: tx('فقه العبادات (الطهارة والصلاة)', 'Fiqh al-Ibadat (Taharah & Salah)'), hours: hrs(3), desc: tx('الأحكام العملية للطهارة والوضوء وأوقات الصلاة وآداب الجماعة.', 'Practical rules of purification, ablution, prayer times, and congregation etiquettes.') },
      { code: 'ENG-101', name: tx('اللغة الإنجليزية والرياضيات الأساسية', 'English & Basic Mathematics'), hours: hrs(4), desc: tx('قواعد اللغة الأساسية والحساب ومهارات الحاسوب اللازمة للتواصل المعاصر.', 'Fundamental grammar, arithmetic, and digital literacy required for contemporary communication.') },
    ],
  },
  {
    id: 'intermediate',
    title: tx('المرحلة المتوسطة', 'Intermediate Stage'),
    years: tx('السنوات ٤ - ٥ (الأعمار ١٤-١٦)', 'Years 4 - 5 (Ages 14-16)'),
    focus: tx('النحو والصرف ومتون الفقه والسيرة النبوية.', 'Grammatical syntax, morphology, jurisprudence texts, and Prophetic biography.'),
    subjects: [
      { code: 'NAH-201', name: tx('الآجرومية وقطر الندى', 'Al-Ajrumiyyah & Qatr al-Nada'), hours: hrs(7), desc: tx('الإعراب المفصل والعوامل النحوية وتركيب الجملة.', 'In-depth parsing (I’rab), grammatical governing agents, and sentence structure.') },
      { code: 'SRF-201', name: tx('علم الصرف', 'Ilm al-Sarf (Morphology)'), hours: hrs(4), desc: tx('تحليل أبنية الأفعال العربية والجذور والأوزان الصرفية.', 'Analysis of Arabic verbal paradigms, non-derived roots, and morphological weights.') },
      { code: 'FQH-201', name: tx('متن أبي شجاع (غاية التقريب)', 'Matn Abi Shuja (Ghayat al-Taqrib)'), hours: hrs(5), desc: tx('الفقه الشافعي المفصل في الزكاة والصيام والحج والفرائض الأساسية.', 'Detailed Shafi’i jurisprudence covering zakat, fasting, hajj, and core obligations.') },
      { code: 'AQD-201', name: tx('العقيدة الطحاوية', 'Aqeedah al-Tahawiyyah'), hours: hrs(3), desc: tx('عقيدة أهل السنة والجماعة والوقاية من الغلو العقدي.', 'Orthodox creed of Ahl al-Sunnah wal-Jama’ah and protection against theological extremes.') },
      { code: 'SRH-201', name: tx('السيرة النبوية', 'Al-Seerah al-Nabawiyyah'), hours: hrs(3), desc: tx('دراسة شاملة لحياة النبي ﷺ من مكة إلى العهد المدني.', 'Comprehensive study of the life of the Prophet ﷺ from early Makkah to the Madinan era.') },
    ],
  },
  {
    id: 'advanced',
    title: tx('المرحلة العالية', 'Advanced Stage'),
    years: tx('السنوات ٦ - ٧ (الأعمار ١٧-١٩)', 'Years 6 - 7 (Ages 17-19)'),
    focus: tx('ألفية ابن مالك وأصول الفقه والبلاغة ومصطلح الحديث.', 'Alfiyyah Ibn Malik, Usul al-Fiqh, Balaghah, and Hadith terminology.'),
    subjects: [
      { code: 'ALF-301', name: tx('ألفية ابن مالك وشرح ابن عقيل', 'Alfiyyah Ibn Malik & Sharh Ibn Aqil'), hours: hrs(6), desc: tx('النحو المتقدم من خلال المنظومات والمسائل الخلافية وتحليل النثر العربي.', 'Advanced poetic grammatical synthesis, syntactic disputations, and Arabic prose analysis.') },
      { code: 'USL-301', name: tx('الورقات وأصول الفقه', 'Al-Waraqat & Usul al-Fiqh'), hours: hrs(5), desc: tx('قواعد الاستنباط والنسخ والإجماع والقياس.', 'Legal hermeneutics, abrogation, consensus (Ijma), and analogical deduction (Qiyas).') },
      { code: 'BLG-301', name: tx('البلاغة (البيان والمعاني والبديع)', 'Al-Balaghah (Bayan, Ma’ani, Badi’)'), hours: hrs(4), desc: tx('البلاغة العربية والمجاز وأسرار الإعجاز البياني في القرآن.', 'Classical rhetoric, metaphorical expressions, and Quranic stylistic miracles.') },
      { code: 'MST-301', name: tx('مصطلح الحديث (نخبة الفكر)', 'Mustalah al-Hadith (Nukhbat al-Fikar)'), hours: hrs(4), desc: tx('تصنيف الأسانيد والعلل الخفية وأحوال الرواة.', 'Classification of hadith chains, hidden defects (Ilal), and narrator reliability.') },
      { code: 'LOG-301', name: tx('علم المنطق', 'Ilm al-Mantiq (Classical Logic)'), hours: hrs(3), desc: tx('التعريفات والقياس المنطقي والدفاع عن العقيدة بالحجة.', 'Definitions, syllogistic reasoning, and classical polemical defense of orthodox faith.') },
    ],
  },
  {
    id: 'graduation',
    title: tx('دورة الحديث الشريف والتخرج', 'Graduation & Dawrah'),
    years: tx('سنة دورة الحديث الأخيرة', 'Final Dawrah Year'),
    focus: tx('القراءة الكاملة للكتب الستة ونيل الإجازة بالسند.', 'Exhaustive reading of the Sahih Sitta compendiums and formal Sanad grant.'),
    subjects: [
      { code: 'BKH-401', name: tx('صحيح البخاري (كاملاً)', 'Sahih al-Bukhari (Full Text)'), hours: hrs(10), desc: tx('شرح شامل باباً باباً مع قراءة السند على كبار العلماء.', 'Comprehensive chapter-by-chapter exegesis and sanad recitation with senior scholars.') },
      { code: 'MSL-401', name: tx('صحيح مسلم وسنن أبي داود', 'Sahih Muslim & Sunan Abu Dawud'), hours: hrs(8), desc: tx('مقارنة التراجم والأحكام الفقهية ونقد الرواة.', 'Comparative chapter headings, legal rulings, and critical narrator appraisal.') },
      { code: 'TRM-401', name: tx('جامع الترمذي والنسائي وابن ماجه', 'Jami’ al-Tirmidhi, Nasa’i & Ibn Majah'), hours: hrs(6), desc: tx('درجات الحديث والروايات وتطبيقاتها الفقهية العملية.', 'Hadith gradings, regional traditions, and practical juristic applications.') },
      { code: 'FTW-401', name: tx('أصول الفتوى والاقتصاد الإسلامي', 'Fatwa Procedures & Islamic Finance'), hours: hrs(4), desc: tx('قواعد الإجابة عن المسائل المعاصرة وأحكام الوقف والمعاملات الحلال.', 'Principles of answering contemporary queries, waqf covenants, and halal transactions.') },
    ],
  },
];

/** A list stored per language ({ en: [...], ar: [...], ta: [...] }) or a plain list. */
const localizedList = (v) => {
  const list = Array.isArray(v) ? v : localized(v);
  return Array.isArray(list) ? list : [];
};

/** CMS curriculum class (contentApi.listCurriculum) → stage card fields in the UI language. */
function stageFromCms(c) {
  const { min, max } = c.ageRange || {};
  return {
    id: c._id || String(c.classNumber),
    title: localized(c.className) || tx('الصف {n}', 'Class {n}').replace('{n}', c.classNumber),
    years: min != null && max != null ? tx('الأعمار {min}-{max}', 'Ages {min}-{max}').replace('{min}', min).replace('{max}', max) : '',
    focus: localizedList(c.objectives).join(' · '),
    assessment: localizedList(c.assessmentMethods),
    subjects: (c.modules || []).map((m, i) => ({
      code: m.code || `${c.classNumber}.${i + 1}`,
      name: localized(m.name),
      hours: m.hoursPerWeek ? hrs(m.hoursPerWeek) : '',
      desc: localized(m.description),
      books: m.books || [],
    })),
  };
}

export default function Curriculum() {
  useTranslation(); // re-render on language change
  const [cmsClasses, setCmsClasses] = useState(null);
  const [activeStageId, setActiveStageId] = useState(null);

  useEffect(() => {
    let alive = true;
    listCurriculum()
      .then((rows) => { if (alive && rows?.length) setCmsClasses(rows); })
      .catch(() => { /* keep the default outline */ });
    return () => { alive = false; };
  }, []);

  const stages = cmsClasses ? cmsClasses.map(stageFromCms) : defaultStages();
  const currentStage = stages.find((s) => s.id === activeStageId) || stages[0];

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      
      {/* 1. Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="curriculum-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label={tx('مسار التنقل', 'Breadcrumb')}>
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">{tx('الرئيسية', 'Home')}</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">{tx('المنهج الدراسي', 'Curriculum')}</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {tx('المنهج الدراسي والمسار التعليمي', 'Pedagogical Framework')}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {tx('مراحل المنهج الدراسي وسنوات التحصيل', 'Staged Scholastic Curriculum')}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {tx('رحلة علمية منهجية متدرجة تمتد عبر أربع مراحل رئيسية من حفظ القرآن الكريم إلى دورة كتب الحديث ونيل الإجازة بالسند.', 'A 7-year developmental journey structured across four scholarly stages, pairing textual transmission with intellectual rigor.')}
          </p>
        </div>
      </section>

      {/* 2. Horizontal Stage Stepper */}
      <section className="w-full py-12 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block mb-1">
                {tx('اختر المرحلة الدراسية', 'Select Curriculum Stage')}
              </span>
              <h2 className="font-serif text-2xl font-semibold text-ink-green-900">
                {currentStage.title}
              </h2>
            </div>

            {/* Download Syllabus PDF Button */}
            {/* Prints the selected stage (use "Save as PDF" in the print dialog) */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-paper-white border border-sand-border hover:border-emerald-700 text-xs font-semibold text-ink-text-primary shadow-xs transition-colors print:hidden"
            >
              <span className="material-symbols-outlined text-[18px] text-emerald-700">{'print'}</span>
              <span>{tx('تحميل مخطط المنهج', 'Download Syllabus Outline')}</span>
            </button>
          </div>

          {/* Stepper Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stages.map((stage, idx) => {
              const isActive = stage.id === activeStageId;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStageId(stage.id)}
                  className={`p-4 rounded-[12px] text-start border transition-all ${
                    isActive
                      ? 'bg-paper-white border-emerald-700 shadow-manuscript ring-1 ring-emerald-700'
                      : 'bg-paper-white/60 border-sand-border hover:bg-paper-white text-ink-text-secondary'
                  }`}
                >
                  <span className={`text-[11px] font-semibold uppercase block mb-1 ${isActive ? 'text-emerald-700' : 'text-ink-text-muted'}`}>
                    {tx('المرحلة {n}', 'Stage {n}').replace('{n}', String(idx + 1).padStart(2, '0'))}
                  </span>
                  <h4 className="font-serif text-base font-semibold text-ink-green-900 leading-snug">
                    {stage.title}
                  </h4>
                  <p className="text-xs text-ink-text-muted mt-1">{stage.years}</p>
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* 3. Subjects Grid for Selected Stage */}
      <section className="w-full py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-xs mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-brass-gold-500 font-semibold block mb-0.5">{tx('نظرة عامة على المرحلة', 'Stage Overview')}</span>
              <p className="font-serif text-sm sm:text-base text-ink-text-primary">
                {currentStage.focus}
              </p>
            </div>
            {currentStage.years && <span className="px-3 py-1 rounded-full bg-gold-wash-100 text-brass-gold-500 text-xs font-semibold shrink-0">
              {currentStage.years}
            </span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentStage.subjects.map((sub) => (
              <div
                key={sub.code}
                className="p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript flex flex-col justify-between hover:border-emerald-700 hover:-translate-y-0.5 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded bg-sand-border/40 text-ink-text-muted text-[11px] font-mono font-semibold">
                      {sub.code}
                    </span>
                    {sub.hours && <span className="px-2.5 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 text-xs font-semibold">
                      {sub.hours}
                    </span>}
                  </div>

                  <h3 className="font-serif text-lg font-semibold text-ink-green-900 mb-2">
                    {sub.name}
                  </h3>

                  <p className="text-xs text-ink-text-secondary leading-relaxed font-sans mb-4">
                    {sub.desc}
                  </p>

                  {sub.books?.length > 0 && (
                    <div className="mb-4">
                      <span className="text-[11px] font-semibold text-ink-text-muted block mb-1">{tx('الكتب المقررة', 'Assigned Books')}</span>
                      <ul className="space-y-1 text-xs text-ink-text-primary">
                        {sub.books.map((book, i) => (
                          <li key={i}>
                            <span className="font-semibold">{localized(book.title)}</span>
                            {book.author && <span className="text-ink-text-muted"> · {localized(book.author)}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-sand-border/50 text-[11px] text-ink-text-muted flex items-center justify-between">
                  <span>{tx('المطالعة الأسبوعية: مشمولة', 'Weekly Mutala’ah: Included')}</span>
                  <span className="text-emerald-700 font-semibold">{currentStage.assessment?.length ? currentStage.assessment.join(' · ') : tx('تقييم فصلي', 'Evaluated Termly')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Admission Prompt */}
          <div className="mt-14 p-8 rounded-[14px] bg-ink-green-900 text-paper-white flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <KhatamPattern className="opacity-[0.03]" strokeColor="#FBF8F0" id="curriculum-cta-khatam" />
            <div className="relative z-10 space-y-1 text-center sm:text-start">
              <h3 className="font-serif text-xl font-semibold text-paper-white">
                {tx('هل ترغب في تسجيل ابنك في هذا المنهج؟', 'Interested in enrolling your son in this curriculum?')}
              </h3>
              <p className="text-xs text-dark-text-primary/80">
                {tx('تتم مراجعة طلبات القبول للعام الدراسي القادم بشكل مستمر.', 'Admissions for the upcoming academic year are reviewed on a rolling basis.')}
              </p>
            </div>
            <Link
              to="/admissions"
              className="relative z-10 shrink-0 px-6 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              {tx('قدّم طلب الالتحاق', 'Apply for Admission')}
            </Link>
          </div>

        </div>
      </section>

    </div>
  );
}
