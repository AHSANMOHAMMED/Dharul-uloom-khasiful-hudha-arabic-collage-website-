import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function RoleSwitcher() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { isTreasurer, isPrincipal, isVP, isTutor } = useAuth();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || (isTreasurer ? 'treasurer' : isPrincipal ? 'principal' : isVP ? 'vp' : 'tutor');

  const roles = [];
  if (isTreasurer) roles.push({ key: 'treasurer', label: isRTL ? 'أمين الصندوق' : 'Treasurer', color: 'bg-gold-wash-100 text-brass-gold-500 border-brass-gold-500/40' });
  if (isPrincipal) roles.push({ key: 'principal', label: isRTL ? 'المدير' : 'Principal', color: 'bg-mint-wash-100 text-ink-green-900 border-ink-green-900/30' });
  if (isVP) roles.push({ key: 'vp', label: isRTL ? 'نائب المدير' : 'Vice Principal', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' });
  if (isTutor) roles.push({ key: 'tutor', label: isRTL ? 'المعلم' : 'Class Tutor', color: 'bg-mint-wash-100 text-emerald-700 border-emerald-700/30' });

  if (roles.length <= 1) return null;

  return (
    <div className="bg-paper-white/90 border-b border-sand-border px-4 py-2.5 backdrop-blur-xs">
      <div className="max-w-[1200px] mx-auto flex flex-wrap gap-2 items-center text-xs">
        <span className="text-ink-text-muted uppercase tracking-wider font-semibold text-[11px] mr-1">
          {isRTL ? 'التبديل بين الصلاحيات:' : 'Active Role View:'}
        </span>
        {roles.map((r) => {
          const isActive = view === r.key;
          return (
            <Link
              key={r.key}
              to={`/dashboard?view=${r.key}`}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? `${r.color} shadow-xs ring-1 ring-emerald-700/40`
                  : 'bg-parchment-50 text-ink-text-secondary border-sand-border hover:bg-sand-border/20'
              }`}
            >
              {r.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
