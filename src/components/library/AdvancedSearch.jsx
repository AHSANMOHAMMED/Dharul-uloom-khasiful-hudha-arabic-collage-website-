import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { value: '', ar: 'كل اللغات', en: 'All languages' },
  { value: 'ar', ar: 'عربي', en: 'Arabic' },
  { value: 'ur', ar: 'أردو', en: 'Urdu' },
  { value: 'en', ar: 'إنجليزي', en: 'English' },
  { value: 'mixed', ar: 'متعدد اللغات', en: 'Multilingual' },
];

const AdvancedSearch = ({ categories = [], value, onChange }) => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [draftQuery, setDraftQuery] = useState(value.query ?? '');

  const submit = (e) => {
    e.preventDefault();
    onChange({ ...value, query: draftQuery, page: 1 });
  };

  const update = (patch) => onChange({ ...value, ...patch, page: 1 });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          type="text"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          placeholder={ar ? 'ابحث بالعنوان أو المؤلف...' : 'Search by title or author...'}
          dir={ar ? 'rtl' : 'ltr'}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-islamic-gold"
        />
        <button
          type="submit"
          className="rounded-xl bg-islamic-green px-6 py-3 font-semibold text-white transition-colors hover:bg-islamic-dark"
        >
          {ar ? 'بحث' : 'Search'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          {ar ? 'اللغة' : 'Language'}
          <select
            value={value.language ?? ''}
            onChange={(e) => update({ language: e.target.value || null })}
            className="rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-islamic-gold"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {ar ? l.ar : l.en}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-600">
          {ar ? 'التصنيف' : 'Category'}
          <select
            value={value.category ?? ''}
            onChange={(e) => update({ category: e.target.value || null })}
            className="rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-islamic-gold"
          >
            <option value="">{ar ? 'كل التصنيفات' : 'All categories'}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-600">
          {ar ? 'المؤلف' : 'Author'}
          <input
            type="text"
            value={value.author ?? ''}
            onChange={(e) => update({ author: e.target.value || null })}
            placeholder={ar ? 'اسم المؤلف' : 'Author name'}
            dir={ar ? 'rtl' : 'ltr'}
            className="rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-islamic-gold"
          />
        </label>
      </div>
    </form>
  );
};

export default AdvancedSearch;
