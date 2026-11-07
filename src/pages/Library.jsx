import { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdvancedSearch from '../components/library/AdvancedSearch';
import BookCard from '../components/library/BookCard';
import { getCategories, searchBooks } from '../lib/booksApi';
import KhatamPattern from '../components/KhatamPattern';

const PAGE_SIZE = 24;

export default function Library() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    query: searchParams.get('q') || '',
    language: null,
    category: searchParams.get('category') || null,
    author: null,
    page: 1,
  });

  const [categories, setCategories] = useState([]);
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef(null);

  const featuredDisciplines = [
    { en: 'Tafseer', ar: 'تفسير' },
    { en: 'Hadith', ar: 'حديث' },
    { en: 'Fiqh', ar: 'فقه' },
    { en: 'Aqeedah', ar: 'عقيدة' },
    { en: 'Arabic Grammar', ar: 'نحو وصرف' },
    { en: 'Seerah', ar: 'سيرة' }
  ];

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

  const selectDiscipline = (disc) => {
    setFilters((prev) => ({
      ...prev,
      category: prev.category === disc ? null : disc,
      page: 1
    }));
  };

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      <Helmet>
        <title>{isRTL ? 'المكتبة الإسلامية الرقمية — كاشف الهدى' : 'Digital Islamic Library — Kashiful Hudha'}</title>
        <meta
          name="description"
          content={isRTL ? 'مكتبة رقمية لأمهات الكتب والمخطوطات الإسلامية' : 'Digital Islamic library catalog of classical texts and commentaries.'}
        />
      </Helmet>

      {/* 1. Compact Ink-Green Header with Khatam Pattern */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-14 overflow-hidden border-b border-sand-border/20">
        <KhatamPattern className="opacity-[0.05]" strokeColor="#FBF8F0" id="library-header-khatam" />
        
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">Digital Library</span>
          </nav>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-paper-white/10 border border-sand-border/20 text-xs font-semibold text-brass-gold-500 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-brass-gold-500"></span>
              <span>Maktabah Kashifiyyah Digital Vault</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
              {isRTL ? 'المكتبة الإسلامية الرقمية' : 'Digital Islamic Library'}
            </h1>
            <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-2 leading-relaxed">
              {isRTL
                ? 'فهرس رقمي متكامل يربط طلاب العلم بأمهات الكتب التراثية وشروح الحديث وتفاسير القرآن الكريم.'
                : 'Over 12,500 indexed classical texts, manuscript scans, and Shamela commentaries preserved for scholarly consultation.'}
            </p>
          </div>

          {/* Search Box Component */}
          <div className="max-w-3xl pt-2">
            <AdvancedSearch
              categories={categories}
              value={filters}
              onChange={(next) => setFilters(next)}
            />
          </div>

          {/* Discipline Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-dark-text-primary/60 uppercase tracking-wider font-semibold mr-1">
              Disciplines:
            </span>
            {featuredDisciplines.map((d) => {
              const active = filters.category === d.ar || filters.category === d.en;
              return (
                <button
                  key={d.en}
                  type="button"
                  onClick={() => selectDiscipline(isRTL ? d.ar : d.en)}
                  className={`px-3 py-1 rounded-full border transition-colors ${
                    active
                      ? 'bg-brass-gold-500 text-ink-green-900 border-brass-gold-500 font-semibold'
                      : 'bg-paper-white/10 text-dark-text-primary/80 border-sand-border/20 hover:bg-paper-white/20'
                  }`}
                >
                  {isRTL ? d.ar : d.en}
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* 2. Book Listing Grid (6 Columns on Large Screens) */}
      <section className="w-full py-12">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="flex items-center justify-between text-xs text-ink-text-muted pb-3 border-b border-sand-border">
            <span>
              Showing <strong className="text-ink-text-primary tabular-nums">{books.length}</strong> of{' '}
              <strong className="text-ink-text-primary tabular-nums">{total}</strong> classical works
            </span>
            {filters.category && (
              <span className="px-2.5 py-0.5 rounded-full bg-gold-wash-100 text-brass-gold-500 font-semibold">
                Filter: {filters.category}
              </span>
            )}
          </div>

          {/* Empty State */}
          {!loading && books.length === 0 && (
            <div className="p-16 text-center rounded-[14px] bg-paper-white border border-sand-border max-w-md mx-auto my-12 space-y-3">
              <span className="material-symbols-outlined text-4xl text-ink-text-muted">search_off</span>
              <h3 className="font-serif text-lg font-semibold text-ink-green-900">
                {isRTL ? 'لم يتم العثور على نتائج' : 'No Kitab Found in Catalog'}
              </h3>
              <p className="text-xs text-ink-text-secondary">
                Try refining your search keyword, selecting a broader discipline, or clearing all filters.
              </p>
              <button
                type="button"
                onClick={() => setFilters({ query: '', language: null, category: null, author: null, page: 1 })}
                className="mt-2 px-4 py-2 rounded-[10px] bg-emerald-700 text-white text-xs font-semibold"
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Dense 6-Column Responsive Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}

            {/* Skeletons while loading more */}
            {loading &&
              Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={`skeleton-${idx}`}
                  className="rounded-[14px] bg-paper-white border border-sand-border aspect-[3/4] animate-pulse p-3 flex flex-col justify-between"
                >
                  <div className="bg-sand-border/30 h-3/4 rounded-lg"></div>
                  <div className="space-y-1.5 pt-2">
                    <div className="bg-sand-border/40 h-3 rounded w-3/4"></div>
                    <div className="bg-sand-border/30 h-2.5 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
          </div>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-10" />

        </div>
      </section>

    </div>
  );
}
