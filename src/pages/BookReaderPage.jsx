import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import BookReader from '../components/library/BookReader';
import { getBook } from '../lib/booksApi';

export default function BookReaderPage() {
  const { id } = useParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const result = await getBook(id);
      if (!active) return;
      setBook(result);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-ink-text-muted">Opening manuscript folio...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-parchment-50 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <span className="material-symbols-outlined text-4xl text-ink-text-muted">auto_stories</span>
        <h2 className="font-serif text-2xl font-semibold text-ink-green-900">
          Manuscript Not Found
        </h2>
        <p className="text-xs text-ink-text-secondary max-w-sm">
          The requested book folio could not be found or may have been moved within the digital catalog.
        </p>
        <Link
          to="/library"
          className="px-5 py-2.5 rounded-[10px] bg-emerald-700 text-white text-xs font-semibold"
        >
          Return to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen py-8">
      <Helmet>
        <title>{book.title_ar} — Maktabah Kashifiyyah</title>
        <meta
          name="description"
          content={book.description || book.title_en || book.title_ar}
        />
      </Helmet>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between pb-4 border-b border-sand-border">
          <Link
            to="/library"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-ink-green-900"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isRTL ? 'arrow_forward' : 'arrow_back'}
            </span>
            <span>Back to Digital Library Catalog</span>
          </Link>

          <span className="text-xs text-ink-text-muted">
            Catalog ID: <span className="font-mono text-ink-text-primary">{book.id}</span>
          </span>
        </div>

        {/* Reader Component */}
        <BookReader book={book} />

        {/* Manuscript Metadata Drawer */}
        <div className="p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript space-y-4">
          <h3 className="font-serif text-xl font-semibold text-ink-green-900">
            Manuscript Dossier & Catalog Metadata
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-parchment-50 border border-sand-border/60">
              <span className="text-ink-text-muted block text-[11px] uppercase tracking-wider">Arabic Title</span>
              <span className="font-arabic font-bold text-ink-green-900 text-sm mt-0.5 block" dir="rtl">{book.title_ar}</span>
            </div>
            <div className="p-3 rounded-lg bg-parchment-50 border border-sand-border/60">
              <span className="text-ink-text-muted block text-[11px] uppercase tracking-wider">English Title</span>
              <span className="font-semibold text-ink-green-900 mt-0.5 block">{book.title_en || 'Classical Text'}</span>
            </div>
            <div className="p-3 rounded-lg bg-parchment-50 border border-sand-border/60">
              <span className="text-ink-text-muted block text-[11px] uppercase tracking-wider">Author / Transmitter</span>
              <span className="font-arabic font-medium text-ink-green-900 mt-0.5 block" dir="rtl">{book.author || 'Scholarly Attributed'}</span>
            </div>
            <div className="p-3 rounded-lg bg-parchment-50 border border-sand-border/60">
              <span className="text-ink-text-muted block text-[11px] uppercase tracking-wider">Primary Category</span>
              <span className="font-semibold text-emerald-700 mt-0.5 block">{book.categories?.[0] || 'General Studies'}</span>
            </div>
          </div>
          {book.description && (
            <p className="text-xs text-ink-text-secondary leading-relaxed pt-2">
              {book.description}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
