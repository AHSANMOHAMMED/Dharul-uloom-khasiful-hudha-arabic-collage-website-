import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import AdvancedSearch from '../components/library/AdvancedSearch';
import BookCard from '../components/library/BookCard';
import { getCategories, searchBooks } from '../lib/booksApi';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const PAGE_SIZE = 24;

const Library = () => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  const [filters, setFilters] = useState({
    query: '',
    language: null,
    category: null,
    author: null,
    page: 1,
  });
  const [categories, setCategories] = useState([]);
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const sentinelRef = useRef(null);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  // Re-fetch when filters change. page === 1 resets the list, otherwise append.
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

  // Infinite scroll via IntersectionObserver.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMore(),
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>{ar ? 'المكتبة الإسلامية الرقمية' : 'Digital Islamic Library'}</title>
        <meta
          name="description"
          content={ar ? 'مكتبة رقمية للكتب الإسلامية والعربية والأردية' : 'A digital library of Islamic, Arabic and Urdu books'}
        />
      </Helmet>

      {/* Header */}
      <section className="bg-gradient-to-br from-islamic-green to-islamic-dark px-4 py-16 text-white">
        <div className="mx-auto max-w-7xl text-center">
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-4 font-arabic text-4xl font-bold md:text-5xl"
          >
            {ar ? 'المكتبة الإسلامية الرقمية' : 'Digital Islamic Library'}
          </motion.h1>
          <motion.p
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-2 text-xl text-gray-200"
          >
            {ar
              ? 'تصفّح آلاف الكتب في التفسير والحديث والفقه والعقيدة والمزيد'
              : 'Browse thousands of books in Tafsir, Hadith, Fiqh, Aqidah and more'}
          </motion.p>
        </div>
      </section>

      {/* Search + filters */}
      <section className="border-b bg-white px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <AdvancedSearch categories={categories} value={filters} onChange={setFilters} />
        </div>
      </section>

      {/* Results */}
      <section className="px-4 py-8">
        <div className="mx-auto max-w-7xl">
          {!isSupabaseConfigured && (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800">
              {ar
                ? 'لم يتم إعداد Supabase بعد. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY لعرض الكتب.'
                : 'Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load books.'}
            </div>
          )}

          {total > 0 && (
            <p className="mb-4 text-sm text-gray-500">
              {ar ? `${total} كتاب` : `${total} books`}
            </p>
          )}

          {books.length === 0 && !loading ? (
            <div className="py-16 text-center text-gray-400">
              {ar ? 'لا توجد كتب مطابقة.' : 'No matching books.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}

          {loading && (
            <div className="py-8 text-center text-gray-400">{ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
          )}

          <div ref={sentinelRef} className="h-1" />
        </div>
      </section>
    </div>
  );
};

export default Library;
