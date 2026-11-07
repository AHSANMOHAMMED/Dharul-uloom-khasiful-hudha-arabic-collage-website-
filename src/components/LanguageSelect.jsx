import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage, tx } from '../lib/tx';

/** EN / العربية / தமிழ் selector (Tamil dictionary loads on demand). */
export default function LanguageSelect({ className = '' }) {
  const { i18n } = useTranslation();
  return (
    <select
      aria-label={tx('اللغة', 'Language')}
      value={SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language) ? i18n.language : 'en'}
      onChange={(e) => setLanguage(e.target.value)}
      className={`px-2 py-1.5 rounded-lg bg-slate-100 text-emerald-800 font-bold text-xs border border-slate-200 hover:bg-slate-200 transition-all cursor-pointer ${className}`}
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
