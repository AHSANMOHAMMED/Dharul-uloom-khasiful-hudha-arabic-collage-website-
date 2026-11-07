import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { cleanArabicWord } from '../../lib/dictionaryApi';
import { tx } from '../../lib/tx';

const HAS_ARABIC = /[ء-يٱ-ۓ]/;
const SENTENCE_SPLIT = /(?<=[.!?؟؛:।])\s+/;

/** paragraphs → sentences → tokens (words + whitespace), each word knowing its sentence. */
function tokenize(content) {
  return String(content || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((para) =>
      para.split(SENTENCE_SPLIT).map((sentence) => ({
        sentence,
        tokens: sentence.split(/(\s+)/).filter((x) => x !== ''),
      })),
    );
}

/**
 * Paginated Arabic page text (book_pages) where every Arabic word is clickable.
 * onWord(word, sentence) is called when the reader taps a word.
 */
export default function TextReader({ bookId, totalPages: knownTotal, onWord }) {
  useTranslation();
  const [index, setIndex] = useState(1); // 1-based position in page_index order
  const [total, setTotal] = useState(knownTotal || 0);
  const [jump, setJump] = useState('');
  const [state, setState] = useState({ loading: true, page: null, error: null });

  useEffect(() => {
    setIndex(1);
  }, [bookId]);

  useEffect(() => {
    if (knownTotal) setTotal(knownTotal);
  }, [knownTotal]);

  useEffect(() => {
    if (knownTotal || !bookId || !isSupabaseConfigured) return undefined;
    let alive = true;
    supabase
      .from('book_pages')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', bookId)
      .then(({ count }) => alive && setTotal(count || 0));
    return () => {
      alive = false;
    };
  }, [bookId, knownTotal]);

  const load = useCallback(async () => {
    if (!bookId || !isSupabaseConfigured) {
      setState({ loading: false, page: null, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase
      .from('book_pages')
      .select('id, page_index, page_label, part, content')
      .eq('book_id', bookId)
      .order('page_index')
      .range(index - 1, index - 1);
    if (error) setState({ loading: false, page: null, error });
    else setState({ loading: false, page: data?.[0] || null, error: null });
  }, [bookId, index]);

  useEffect(() => {
    load();
  }, [load]);

  const paragraphs = useMemo(() => tokenize(state.page?.content), [state.page]);

  const go = (n) => {
    const max = total || 1;
    const next = Math.min(Math.max(1, n), max);
    setIndex(next);
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const onClick = (e) => {
    const el = e.target.closest?.('[data-w]');
    if (!el) return;
    const word = cleanArabicWord(el.textContent);
    if (word) onWord?.(word, el.getAttribute('data-s') || '');
  };

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const el = e.target.closest?.('[data-w]');
      if (el) {
        e.preventDefault();
        onClick(e);
      }
    }
  };

  const submitJump = (e) => {
    e.preventDefault();
    const n = parseInt(jump, 10);
    if (Number.isFinite(n)) go(n);
    setJump('');
  };

  const nav = (
    <div className="flex flex-wrap items-center justify-between gap-2" dir="ltr">
      <button
        type="button"
        onClick={() => go(index - 1)}
        disabled={index <= 1 || state.loading}
        className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-40"
      >
        ‹ {tx('السابق', 'Previous')}
      </button>
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <span>
          {tx('صفحة', 'Page')} {index}
          {total ? ` / ${total}` : ''}
          {state.page?.page_label ? ` · ${tx('رقم الطبعة', 'Printed page')} ${state.page.page_label}` : ''}
          {state.page?.part ? ` · ${tx('الجزء', 'Part')} ${state.page.part}` : ''}
        </span>
        <form onSubmit={submitJump} className="flex items-center gap-1">
          <label className="sr-only" htmlFor={`jump-${bookId}`}>
            {tx('انتقل إلى صفحة', 'Go to page')}
          </label>
          <input
            id={`jump-${bookId}`}
            type="number"
            min="1"
            max={total || undefined}
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            placeholder="#"
            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs"
          />
          <button type="submit" className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-bold text-white">
            {tx('اذهب', 'Go')}
          </button>
        </form>
      </div>
      <button
        type="button"
        onClick={() => go(index + 1)}
        disabled={(total && index >= total) || state.loading}
        className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-40"
      >
        {tx('التالي', 'Next')} ›
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {nav}
      <p className="text-xs text-slate-500">{tx('اضغط على أي كلمة لمعرفة معناها بالتاميلية.', 'Tap any word to see its Tamil meaning.')}</p>
      <div className="min-h-[60vh] rounded-xl border border-gray-200 bg-white p-5 sm:p-8">
        {state.loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-emerald-600" />
          </div>
        ) : state.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {state.error.message || String(state.error)}
            <button type="button" onClick={load} className="ms-3 font-semibold underline">
              {tx('إعادة المحاولة', 'Retry')}
            </button>
          </div>
        ) : !state.page ? (
          <p className="py-16 text-center text-slate-500">{tx('لا يوجد نص لهذه الصفحة.', 'No text for this page.')}</p>
        ) : (
          <div dir="rtl" lang="ar" className="font-arabic text-2xl leading-loose text-slate-900" onClick={onClick} onKeyDown={onKey}>
            {paragraphs.map((sentences, pi) => (
              <p key={pi} className="mb-4">
                {sentences.map((s, si) =>
                  s.tokens.map((tok, ti) =>
                    HAS_ARABIC.test(tok) ? (
                      <span
                        key={`${si}-${ti}`}
                        data-w=""
                        data-s={s.sentence.slice(0, 400)}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer rounded px-0.5 transition hover:bg-amber-100 focus:bg-amber-100 focus:outline-none"
                      >
                        {tok}
                      </span>
                    ) : (
                      <span key={`${si}-${ti}`}>{tok}</span>
                    ),
                  ).concat(si < sentences.length - 1 ? [<span key={`${si}-sp`}> </span>] : []),
                )}
              </p>
            ))}
          </div>
        )}
      </div>
      {nav}
    </div>
  );
}
