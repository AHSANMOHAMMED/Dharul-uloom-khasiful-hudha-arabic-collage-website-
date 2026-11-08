import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cleanArabicWord, lookupArabicWord, posLabel } from '../../lib/dictionaryApi';
import { tx } from '../../lib/tx';

function ResultCard({ r }) {
  const ai = r.source === 'ai';
  return (
    <li className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div dir="rtl" lang="ar" className="font-arabic text-3xl leading-relaxed text-emerald-950">
          {r.arabic}
        </div>
        <div className="flex flex-wrap gap-1">
          {r.verified ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{tx('موثّق', 'Verified')}</span>
          ) : ai ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              {tx('اقتراح آلي – غير موثّق', 'AI suggestion – unverified')}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{tx('غير موثّق', 'Unverified')}</span>
          )}
          {r.match && r.match !== 'exact' && (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
              {r.match === 'root' ? tx('مطابقة بالجذر', 'Root match') : tx('مطابقة بالجذع', 'Stem match')}
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {r.root && (
          <span>
            {tx('الجذر', 'Root')}:{' '}
            <span dir="rtl" lang="ar" className="font-arabic text-base text-slate-800">
              {r.root}
            </span>
          </span>
        )}
        {r.part_of_speech && <span>{posLabel(r.part_of_speech)}</span>}
      </div>
      <p lang="ta" className="mt-2 text-lg font-bold leading-snug text-emerald-800">
        {r.tamil}
      </p>
      {r.english && (
        <p lang="en" dir="ltr" className="text-sm text-slate-600">
          {r.english}
        </p>
      )}
      {(r.example_ar || r.example_ta) && (
        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
          {r.example_ar && (
            <p dir="rtl" lang="ar" className="font-arabic text-base text-slate-800">
              {r.example_ar}
            </p>
          )}
          {r.example_ta && (
            <p lang="ta" className="text-slate-600">
              {r.example_ta}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Arabic word → Tamil meaning panel. Looks the word up via translate-word
 * (dictionary first, AI fallback) or the lookup_arabic_word RPC.
 */
export default function WordMeaningPanel({ initialWord = '', initialContext = '', onClose, className = '' }) {
  useTranslation();
  const [word, setWord] = useState(initialWord);
  const [context, setContext] = useState(initialContext);
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const seq = useRef(0);

  const lookup = useCallback(async (w, ctx) => {
    const clean = cleanArabicWord(w);
    if (!clean) {
      setState({ loading: false, data: null, error: new Error(tx('أدخل كلمة عربية واحدة.', 'Enter one Arabic word.')) });
      return;
    }
    const id = ++seq.current;
    setState({ loading: true, data: null, error: null });
    try {
      const data = await lookupArabicWord(clean, ctx);
      if (id === seq.current) setState({ loading: false, data, error: null });
    } catch (error) {
      if (id === seq.current) setState({ loading: false, data: null, error });
    }
  }, []);

  useEffect(() => {
    setWord(initialWord);
    setContext(initialContext);
    if (initialWord) lookup(initialWord, initialContext);
  }, [initialWord, initialContext, lookup]);

  const submit = (e) => {
    e.preventDefault();
    lookup(word, context);
  };

  const results = state.data?.results || [];

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-emerald-900">{tx('معنى الكلمة (عربي ← تاميل)', 'Word meaning (Arabic → Tamil)')}</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-slate-900 flex items-center justify-center" aria-label={tx('إغلاق', 'Close')}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
      <form onSubmit={submit} className="space-y-2">
        <label className="block text-xs font-semibold text-slate-600" htmlFor="wm-word">
          {tx('الكلمة العربية', 'Arabic word')}
        </label>
        <div className="flex gap-2">
          <input
            id="wm-word"
            dir="rtl"
            lang="ar"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="الكتاب"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 font-arabic text-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={state.loading || !word.trim()}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {state.loading ? tx('جارٍ البحث…', 'Searching…') : tx('ابحث', 'Look up')}
          </button>
        </div>
        <label className="block text-xs font-semibold text-slate-600" htmlFor="wm-context">
          {tx('السياق (اختياري)', 'Context sentence (optional)')}
        </label>
        <textarea
          id="wm-context"
          dir="rtl"
          lang="ar"
          rows={2}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-arabic text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </form>

      <div aria-live="polite" className="min-h-[3rem]">
        {state.loading && (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-600">
            <div className="h-5 w-5 animate-spin rounded-full border-t-2 border-emerald-600" />
            {tx('جارٍ البحث عن المعنى…', 'Looking up the meaning…')}
          </div>
        )}
        {state.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error.message || String(state.error)}</div>
        )}
        {state.data && !state.loading && (
          <div className="space-y-2">
            {state.data.from === 'ai' && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                {tx(
                  'لم توجد الكلمة في القاموس؛ هذا اقتراح آلي لم يراجعه أمين المكتبة بعد.',
                  'Not in the dictionary yet; this is an AI suggestion that a librarian has not reviewed.',
                )}
              </p>
            )}
            {results.length === 0 ? (
              <p className="py-3 text-center text-sm text-slate-600">
                {tx('لم يُعثر على معنى لهذه الكلمة.', 'No meaning found for this word.')}
                {state.data.note ? ` (${state.data.note})` : ''}
              </p>
            ) : (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                {results.map((r, i) => (
                  <ResultCard key={r.id ?? i} r={r} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
