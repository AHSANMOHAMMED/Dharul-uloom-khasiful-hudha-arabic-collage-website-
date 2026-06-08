import { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import AdvancedSearch from '../components/library/AdvancedSearch';
import BookCard from '../components/library/BookCard';
import { getCategories, searchBooks } from '../lib/booksApi';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const PAGE_SIZE = 24;

const Library = () => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [filters, setFilters] = useState({ query: '', language: null, category: null, author: null, page: 1 });
  const [categories, setCategories] = useState([]);
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef(null);
  const featuredCategories = ['حديث', 'فقه', 'تفسير', 'عقيدة', 'نحو'];

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    searchBooks({ ...filters, pageSize: PAGE_SIZE }).then(({ books: rows, total: count }) => {
      if (!active) return;
      setTotal(count);
      setBooks((prev) => (filters.page === 1 ? rows : [...prev, ...rows]));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [filters]);

  const hasMore = books.length < total;
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setFilters((f) => ({ ...f, page: f.page + 1 }));
  }, [loading, hasMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
      rootMargin: '400px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50">
      <Helmet>
        <title>{ar ? 'المكتبة الإسلامية الرقمية' : 'Digital Islamic Library'}</title>
        <meta
          name="description"
          content={ar ? 'مكتبة رقمية للكتب الإسلامية' : 'A digital Islamic library for students and teachers'}
        />
      </Helmet>

      <section className="border-b border-emerald-100 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-7xl text-center">
          <span className="mb-4 inline-flex rounded-full border border-emerald-300/30 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">
            {ar ? 'المكتبة الرقمية' : 'Digital Library'}
          </span>
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-4 font-arabic text-4xl font-bold md:text-5xl"
          >
            {ar ? 'اقرأ آلاف الكتب الإسلامية داخل الموقع' : 'Read thousands of Islamic books inside the website'}
          </motion.h1>
          <p className="mx-auto max-w-3xl text-lg text-emerald-50/90">
            {ar
              ? 'ابحث، صفِّ، وافتح كتب المكتبة الشاملة مباشرة عبر Google Drive على الهاتف أو الحاسوب.'
              : 'Search, filter, and open Al-Maktaba al-Shamela books directly from Google Drive on mobile or desktop.'}
          </p>
        </div>
      </section>

      <section className="border-b border-gray-200 bg-white px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <AdvancedSearch categories={categories} value={filters} onChange={setFilters} />
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilters({ query: '', language: null, category: null, author: null, page: 1 })}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              {ar ? 'الكل' : 'All'}
            </button>
            {featuredCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, category, page: 1 }))}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-800"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-8">
        <div className="mx-auto max-w-7xl">
          {!isSupabaseConfigured && (
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
              {ar
                ? 'Supabase غير مضبوط. أضف بيانات البيئة لعرض الكتب.'
                : 'Supabase is not configured yet. Add the environment variables to load books.'}
            </div>
          )}

          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              {total > 0 ? (ar ? `${total} كتاب` : `${total} books`) : ar ? 'ابدأ البحث عن كتاب' : 'Start searching for a book'}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="rounded-full bg-white px-3 py-1 shadow-sm">{ar ? 'قراءة عبر Google Drive' : 'Google Drive reading'}</span>
              {loading && <span>{ar ? 'جارٍ التحميل...' : 'Loading...'}</span>}
            </div>
          </div>

          {books.length === 0 && !loading ? (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-white py-16 text-center text-gray-500">
              {ar ? 'لا توجد كتب مطابقة.' : 'No matching books found.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="h-1" />
        </div>
      </section>
    </div>
  );
};

export default Library;
