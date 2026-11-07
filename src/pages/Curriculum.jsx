import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listCurriculum } from '../lib/contentApi';
import KhatamPattern from '../components/KhatamPattern';

const STAGES = [
  {
    id: 'foundation',
    title_en: '1. Foundation Stage',
    title_ar: 'المرحلة التأسيسية',
    years: 'Years 1 - 3 (Ages 10-13)',
    focus: 'Memorization of the Quran, Tajweed mastery, and primary Arabic vocabulary.',
    subjects: [
      { code: 'QRN-101', name: 'Hifz al-Quran', hours: '18 hrs/wk', desc: 'Daily Sabaq recitation and comprehensive Sabqi repetition cycles under certified Huffaz.' },
      { code: 'TAJ-101', name: 'Tajweed & Makharij', hours: '4 hrs/wk', desc: 'Study of Tuhfat al-Atfal text with practical phonetic correction of vocal articulation.' },
      { code: 'ARB-101', name: 'Mabadi al-Arabiyyah', hours: '6 hrs/wk', desc: 'Foundational Arabic reading, dictation, vocabulary acquisition, and penmanship.' },
      { code: 'ISL-101', name: 'Fiqh al-Ibadat (Taharah & Salah)', hours: '3 hrs/wk', desc: 'Practical rules of purification, ablution, prayer times, and congregation etiquettes.' },
      { code: 'ENG-101', name: 'English & Basic Mathematics', hours: '4 hrs/wk', desc: 'Fundamental grammar, arithmetic, and digital literacy required for contemporary communication.' }
    ]
  },
  {
    id: 'intermediate',
    title_en: '2. Intermediate Stage',
    title_ar: 'المرحلة المتوسطة',
    years: 'Years 4 - 5 (Ages 14-16)',
    focus: 'Grammatical syntax, morphology, jurisprudence texts, and Prophetic biography.',
    subjects: [
      { code: 'NAH-201', name: 'Al-Ajrumiyyah & Qatr al-Nada', hours: '7 hrs/wk', desc: 'In-depth parsing (I’rab), grammatical governing agents, and sentence structure.' },
      { code: 'SRF-201', name: 'Ilm al-Sarf (Morphology)', hours: '4 hrs/wk', desc: 'Analysis of Arabic verbal paradigms, non-derived roots, and morphological weights.' },
      { code: 'FQH-201', name: 'Matn Abi Shuja (Ghayat al-Taqrib)', hours: '5 hrs/wk', desc: 'Detailed Shafi’i jurisprudence covering zakat, fasting, hajj, and core obligations.' },
      { code: 'AQD-201', name: 'Aqeedah al-Tahawiyyah', hours: '3 hrs/wk', desc: 'Orthodox creed of Ahl al-Sunnah wal-Jama’ah and protection against theological extremes.' },
      { code: 'SRH-201', name: 'Al-Seerah al-Nabawiyyah', hours: '3 hrs/wk', desc: 'Comprehensive study of the life of the Prophet ﷺ from early Makkah to the Madinan era.' }
    ]
  },
  {
    id: 'advanced',
    title_en: '3. Advanced Stage',
    title_ar: 'المرحلة العالية',
    years: 'Years 6 - 7 (Ages 17-19)',
    focus: 'Alfiyyah Ibn Malik, Usul al-Fiqh, Balaghah, and Hadith terminology.',
    subjects: [
      { code: 'ALF-301', name: 'Alfiyyah Ibn Malik & Sharh Ibn Aqil', hours: '6 hrs/wk', desc: 'Advanced poetic grammatical synthesis, syntactic disputations, and Arabic prose analysis.' },
      { code: 'USL-301', name: 'Al-Waraqat & Usul al-Fiqh', hours: '5 hrs/wk', desc: 'Legal hermeneutics, abrogation, consensus (Ijma), and analogical deduction (Qiyas).' },
      { code: 'BLG-301', name: 'Al-Balaghah (Bayan, Ma’ani, Badi’)', hours: '4 hrs/wk', desc: 'Classical rhetoric, metaphorical expressions, and Quranic stylistic miracles.' },
      { code: 'MST-301', name: 'Mustalah al-Hadith (Nukhbat al-Fikar)', hours: '4 hrs/wk', desc: 'Classification of hadith chains, hidden defects (Ilal), and narrator reliability.' },
      { code: 'LOG-301', name: 'Ilm al-Mantiq (Classical Logic)', hours: '3 hrs/wk', desc: 'Definitions, syllogistic reasoning, and classical polemical defense of orthodox faith.' }
    ]
  },
  {
    id: 'graduation',
    title_en: '4. Graduation & Dawrah',
    title_ar: 'دورة الحديث الشريف والتخرج',
    years: 'Final Dawrah Year',
    focus: 'Exhaustive reading of the Sahih Sitta compendiums and formal Sanad grant.',
    subjects: [
      { code: 'BKH-401', name: 'Sahih al-Bukhari (Full Text)', hours: '10 hrs/wk', desc: 'Comprehensive chapter-by-chapter exegesis and sanad recitation with senior scholars.' },
      { code: 'MSL-401', name: 'Sahih Muslim & Sunan Abu Dawud', hours: '8 hrs/wk', desc: 'Comparative chapter headings, legal rulings, and critical narrator appraisal.' },
      { code: 'TRM-401', name: 'Jami’ al-Tirmidhi, Nasa’i & Ibn Majah', hours: '6 hrs/wk', desc: 'Hadith gradings, regional traditions, and practical juristic applications.' },
      { code: 'FTW-401', name: 'Fatwa Procedures & Islamic Finance', hours: '4 hrs/wk', desc: 'Principles of answering contemporary queries, waqf covenants, and halal transactions.' }
    ]
  }
];

export default function Curriculum() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [activeStageId, setActiveStageId] = useState('foundation');

  const currentStage = STAGES.find((s) => s.id === activeStageId) || STAGES[0];

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      
      {/* 1. Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="curriculum-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">Curriculum</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {isRTL ? 'المنهج الدراسي والمسار التعليمي' : 'Pedagogical Framework'}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {isRTL ? 'مراحل المنهج الدراسي وسنوات التحصيل' : 'Staged Scholastic Curriculum'}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {isRTL
              ? 'رحلة علمية منهجية متدرجة تمتد عبر أربع مراحل رئيسية من حفظ القرآن الكريم إلى دورة كتب الحديث ونيل الإجازة بالسند.'
              : 'A 7-year developmental journey structured across four scholarly stages, pairing textual transmission with intellectual rigor.'}
          </p>
        </div>
      </section>

      {/* 2. Horizontal Stage Stepper */}
      <section className="w-full py-12 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block mb-1">
                Select Curriculum Stage
              </span>
              <h2 className="font-serif text-2xl font-semibold text-ink-green-900">
                {isRTL ? currentStage.title_ar : currentStage.title_en}
              </h2>
            </div>

            {/* Download Syllabus PDF Button */}
            <a
              href="/docs/library-setup-guide.md"
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-paper-white border border-sand-border hover:border-emerald-700 text-xs font-semibold text-ink-text-primary shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-emerald-700">download</span>
              <span>Download Syllabus Outline</span>
            </a>
          </div>

          {/* Stepper Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STAGES.map((stage, idx) => {
              const isActive = stage.id === activeStageId;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStageId(stage.id)}
                  className={`p-4 rounded-[12px] text-left border transition-all ${
                    isActive
                      ? 'bg-paper-white border-emerald-700 shadow-manuscript ring-1 ring-emerald-700'
                      : 'bg-paper-white/60 border-sand-border hover:bg-paper-white text-ink-text-secondary'
                  }`}
                >
                  <span className={`text-[11px] font-semibold uppercase block mb-1 ${isActive ? 'text-emerald-700' : 'text-ink-text-muted'}`}>
                    Stage 0{idx + 1}
                  </span>
                  <h4 className="font-serif text-base font-semibold text-ink-green-900 leading-snug">
                    {isRTL ? stage.title_ar : stage.title_en.replace(/^[0-9]\.\s*/, '')}
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
              <span className="text-xs uppercase tracking-wider text-brass-gold-500 font-semibold block mb-0.5">Stage Overview</span>
              <p className="font-serif text-sm sm:text-base text-ink-text-primary">
                {currentStage.focus}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-gold-wash-100 text-brass-gold-500 text-xs font-semibold shrink-0">
              {currentStage.years}
            </span>
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
                    <span className="px-2.5 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 text-xs font-semibold">
                      {sub.hours}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-semibold text-ink-green-900 mb-2">
                    {sub.name}
                  </h3>

                  <p className="text-xs text-ink-text-secondary leading-relaxed font-sans mb-4">
                    {sub.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-sand-border/50 text-[11px] text-ink-text-muted flex items-center justify-between">
                  <span>Weekly Mutala'ah: Included</span>
                  <span className="text-emerald-700 font-semibold">Evaluated Termly</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Admission Prompt */}
          <div className="mt-14 p-8 rounded-[14px] bg-ink-green-900 text-paper-white flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <KhatamPattern className="opacity-[0.03]" strokeColor="#FBF8F0" id="curriculum-cta-khatam" />
            <div className="relative z-10 space-y-1 text-center sm:text-left">
              <h3 className="font-serif text-xl font-semibold text-paper-white">
                Interested in enrolling your son in this curriculum?
              </h3>
              <p className="text-xs text-dark-text-primary/80">
                Admissions for the upcoming academic year are reviewed on a rolling basis.
              </p>
            </div>
            <Link
              to="/admissions"
              className="relative z-10 shrink-0 px-6 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Apply for Admission
            </Link>
          </div>

        </div>
      </section>

    </div>
  );
}
