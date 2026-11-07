import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { value: '', ar: 'كل اللغات', en: 'All Languages' },
  { value: 'ar', ar: 'عربي', en: 'Arabic' },
  { value: 'ur', ar: 'أردو', en: 'Urdu' },
  { value: 'en', ar: 'إنجليزي', en: 'English' },
  { value: 'mixed', ar: 'متعدد اللغات', en: 'Multilingual' },
];

export default function AdvancedSearch({ categories = [], value, onChange }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [draftQuery, setDraftQuery] = useState(value.query ?? '');
  const [showFilters, setShowFilters] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    onChange({ ...value, query: draftQuery, page: 1 });
  };

  const update = (patch) => onChange({ ...value, ...patch, page: 1 });

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Search Input Bar */}
      <div className="flex items-center bg-paper-white p-2 rounded-[14px] border border-sand-border shadow-manuscript">
        <span className="material-symbols-outlined text-ink-text-muted mx-3 text-[20px]">search</span>
        <input
          type="text"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          placeholder={isRTL ? 'ابحث بالعنوان، المؤلف، أو الكلمات المفتاحية...' : 'Search by title, author, or keyword (e.g. Sahih al-Bukhari)...'}
          className="w-full bg-transparent text-xs sm:text-sm text-ink-text-primary focus:outline-none placeholder:text-ink-text-muted"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 rounded-lg border border-sand-border hover:bg-parchment-50 text-xs text-ink-text-secondary flex items-center gap-1 font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span className="hidden sm:inline">Filters</span>
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            {isRTL ? 'بحث' : 'Search'}
          </button>
        </div>
      </div>

      {/* Collapsible Filter Row */}
      {showFilters && (
        <div className="p-4 rounded-[12px] bg-paper-white border border-sand-border shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider mb-1">
              Language
            </label>
            <select
              value={value.language ?? ''}
              onChange={(e) => update({ language: e.target.value || null })}
              className="w-full h-9 px-2.5 rounded-[8px] bg-parchment-50 border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {isRTL ? l.ar : l.en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-text-muted uppercase tracking-wider mb-1">
              Category / Discipline
            </label>
            <select
              value={value.category ?? ''}
              onChange={(e) => update({ category: e.target.value || null })}
              className="w-full h-9 px-2.5 rounded-[8px] bg-parchment-50 border border-sand-border focus:border-emerald-700 focus:outline-none text-xs text-ink-text-primary"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setDraftQuery('');
                onChange({ query: '', language: null, category: null, author: null, page: 1 });
              }}
              className="w-full h-9 rounded-[8px] border border-sand-border hover:bg-parchment-50 text-xs font-medium text-ink-text-secondary"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
