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
  actions = null,
}) {
  const { user } = useAuth();
  const a = ACCENTS[accent] || ACCENTS.emerald;
  const name = user?.username || user?.email || tx('الموظف', 'Colleague');
  const heading = tx(greeting_ar, greeting_en).replace('{name}', name);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface p-5 sm:p-6 shadow-sm relative overflow-hidden">
      <div className={`absolute inset-y-0 start-0 w-1 ${a.bar}`} aria-hidden="true" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 ps-1">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={name}
            width="48"
            height="48"
            className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200 shadow-xs"
          />
        ) : (
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center font-serif text-xl font-bold shrink-0 border ${a.avatar}`}
          >
            {(name[0] || 'د').toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border mb-1.5 ${a.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} aria-hidden="true" />
            {tx(portal_ar, portal_en)}
          </span>
          <h1 className="font-sans text-xl sm:text-2xl font-semibold text-slate-900 dark:text-dark-text-primary text-balance">{heading}</h1>
          {(hint_en || hint_ar) && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">{tx(hint_ar, hint_en)}</p>
          )}
        </div>
        {(erpLink || actions) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
            {erpLink && (
              <Link
                to="/erp"
                className="shrink-0 text-xs font-semibold text-emerald-800 hover:text-emerald-700 border border-slate-200 rounded-xl px-3.5 py-2 bg-slate-50 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
              >
                {tx('فتح ERP الكامل', 'Open full ERP')}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
