import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { tx } from '../lib/tx';

const ROLE_DEFS = [
  { key: 'treasurer', label_ar: 'أمين الصندوق', label_en: 'Treasurer', color: 'bg-gold-wash-100 text-brass-gold-500 border-brass-gold-500/40', match: (a) => a.isTreasurer },
  { key: 'accountant', label_ar: 'المحاسب', label_en: 'Accountant', color: 'bg-gold-wash-100 text-brass-gold-500 border-brass-gold-500/40', match: (a) => a.hasRole?.('accountant') },
  { key: 'hr', label_ar: 'الموارد البشرية', label_en: 'HR', color: 'bg-mint-wash-100 text-ink-green-900 border-ink-green-900/30', match: (a) => a.hasRole?.('hr_manager') },
  { key: 'admissions', label_ar: 'القبول', label_en: 'Admissions', color: 'bg-gold-wash-100 text-brass-gold-500 border-brass-gold-500/40', match: (a) => a.hasRole?.('admissions_officer') },
  { key: 'warden', label_ar: 'مشرف السكن', label_en: 'Warden', color: 'bg-mint-wash-100 text-emerald-700 border-emerald-700/30', match: (a) => a.hasRole?.('warden') },
  { key: 'counselor', label_ar: 'المرشد', label_en: 'Counselor', color: 'bg-mint-wash-100 text-ink-green-900 border-ink-green-900/30', match: (a) => a.hasRole?.('counselor') },
  { key: 'exam', label_ar: 'الامتحانات', label_en: 'Exams', color: 'bg-gold-wash-100 text-brass-gold-500 border-brass-gold-500/40', match: (a) => a.hasRole?.('exam_officer') },
  { key: 'principal', label_ar: 'المدير', label_en: 'Principal', color: 'bg-mint-wash-100 text-ink-green-900 border-ink-green-900/30', match: (a) => a.isPrincipal },
  { key: 'vp', label_ar: 'نائب المدير', label_en: 'Vice Principal', color: 'bg-mint-wash-100 text-emerald-700 border-emerald-700/30', match: (a) => a.isVP },
  { key: 'librarian', label_ar: 'أمين المكتبة', label_en: 'Librarian', color: 'bg-mint-wash-100 text-emerald-700 border-emerald-700/30', match: (a) => a.isLibrarian },
  { key: 'tutor', label_ar: 'المعلم', label_en: 'Class Tutor', color: 'bg-mint-wash-100 text-emerald-700 border-emerald-700/30', match: (a) => a.isTutor },
];

export default function RoleSwitcher({ compact = false }) {
  useTranslation();
  const auth = useAuth();
  const [searchParams] = useSearchParams();

  const roles = ROLE_DEFS.filter((r) => r.match(auth)).map((r) => ({
    key: r.key,
    label: tx(r.label_ar, r.label_en),
    color: r.color,
  }));

  const defaultView =
    roles[0]?.key ||
    (auth.isTreasurer
      ? 'treasurer'
      : auth.isPrincipal
        ? 'principal'
        : auth.isVP
          ? 'vp'
          : auth.isLibrarian
            ? 'librarian'
            : 'tutor');
  const view = searchParams.get('view') || defaultView;

  if (roles.length <= 1) return null;

  const chips = roles.map((r) => {
    const isActive = view === r.key;
    return (
      <Link
        key={r.key}
        to={`/dashboard?view=${r.key}`}
        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
          isActive
            ? `${r.color} shadow-xs ring-1 ring-emerald-700/40`
            : 'bg-parchment-50 text-ink-text-secondary border-sand-border hover:bg-sand-border/20'
        }`}
      >
        {r.label}
      </Link>
    );
  });

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] text-ink-text-muted uppercase tracking-wider font-semibold">
          {tx('دور', 'Role')}
        </span>
        {chips}
      </div>
    );
  }

  return (
    <div className="bg-paper-white/90 border-b border-sand-border px-4 py-2.5 backdrop-blur-xs">
      <div className="max-w-[1200px] mx-auto flex flex-wrap gap-2 items-center text-xs">
        <span className="text-ink-text-muted uppercase tracking-wider font-semibold text-[11px] mr-1">
          {tx('التبديل بين الصلاحيات:', 'Active Role View:')}
        </span>
        {chips}
      </div>
    </div>
  );
}
