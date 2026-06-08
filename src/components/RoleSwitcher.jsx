import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

/**
 * Lets tutors with special assigned roles switch between dashboards.
 */
const RoleSwitcher = () => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const { isTreasurer, isPrincipal, isVP, isTutor } = useAuth();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || (isTreasurer ? 'treasurer' : isPrincipal ? 'principal' : isVP ? 'vp' : 'tutor');

  const roles = [];
  if (isTreasurer) roles.push({ key: 'treasurer', label: ar ? 'أمين الصندوق' : 'Treasurer' });
  if (isPrincipal) roles.push({ key: 'principal', label: ar ? 'المدير' : 'Principal' });
  if (isVP) roles.push({ key: 'vp', label: ar ? 'نائب المدير' : 'Vice Principal' });
  if (isTutor) roles.push({ key: 'tutor', label: ar ? 'المعلم' : 'Class Teacher' });

  if (roles.length <= 1) return null;

  return (
    <div className="bg-gray-900/90 border-b border-gray-800 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 uppercase tracking-wider me-2">
          {ar ? 'لوحة:' : 'Portal:'}
        </span>
        {roles.map((r) => (
          <Link
            key={r.key}
            to={`/dashboard?view=${r.key}`}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              view === r.key
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RoleSwitcher;
