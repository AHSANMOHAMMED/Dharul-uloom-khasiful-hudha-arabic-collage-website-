import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { tx } from '../../lib/tx';

const ACCENTS = {
  emerald: {
    bar: 'bg-emerald-700',
    chip: 'bg-mint-wash-100 text-emerald-700 border-emerald-700/20',
    dot: 'bg-emerald-700',
    avatar: 'bg-mint-wash-100 text-emerald-700 border-emerald-700/20',
  },
  gold: {
    bar: 'bg-brass-gold-500',
    chip: 'bg-gold-wash-100 text-brass-gold-500 border-brass-gold-500/30',
    dot: 'bg-brass-gold-500',
    avatar: 'bg-gold-wash-100 text-brass-gold-500 border-brass-gold-500/30',
  },
};

/**
 * Thin welcome banner for branded staff role portals.
 */
export default function OverviewBanner({
  portal_en,
  portal_ar,
  greeting_en = 'Welcome, {name}',
  greeting_ar = 'مرحباً، {name}',
  hint_en,
  hint_ar,
  accent = 'emerald',
  erpLink = false,
}) {
  const { user } = useAuth();
  const a = ACCENTS[accent] || ACCENTS.emerald;
  const name = user?.username || user?.email || tx('الموظف', 'Colleague');
  const heading = tx(greeting_ar.replace('{name}', name), greeting_en.replace('{name}', name));

  return (
    <div className="rounded-[14px] border border-[#E8E1D0] bg-white p-5 sm:p-6 shadow-xs relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 ${a.bar}`} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center font-serif text-xl font-bold shrink-0 border ${a.avatar}`}
        >
          {(name[0] || 'د').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border mb-1.5 ${a.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
            {tx(portal_ar, portal_en)}
          </span>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#0B3B2E]">{heading}</h1>
          {(hint_en || hint_ar) && (
            <p className="text-xs sm:text-sm text-[#4A5E56] mt-1 leading-relaxed">{tx(hint_ar, hint_en)}</p>
          )}
        </div>
        {erpLink && (
          <Link
            to="/erp"
            className="shrink-0 text-xs font-semibold text-emerald-700 hover:text-emerald-500 border border-[#E8E1D0] rounded-lg px-3 py-2 bg-[#FBF8F0]"
          >
            {tx('فتح ERP الكامل', 'Open full ERP')}
          </Link>
        )}
      </div>
    </div>
  );
}
