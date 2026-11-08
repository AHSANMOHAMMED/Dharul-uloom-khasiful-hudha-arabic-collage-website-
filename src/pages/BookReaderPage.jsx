import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import BookReader from '../components/library/BookReader';
import { getBook } from '../lib/booksApi';
import { tx } from '../lib/tx';

function MetaCell({ label, value, arabic = false, accent = false }) {
  return (
    <div className="p-3 rounded-lg bg-parchment-50 border border-sand-border/60">
      <span className="text-ink-text-muted block text-[11px] uppercase tracking-wider">{label}</span>
      <span
        dir={arabic ? 'rtl' : undefined}
        className={`mt-0.5 block ${arabic ? 'font-arabic font-bold text-sm text-ink-green-900' : accent ? 'font-semibold text-emerald-700' : 'font-semibold text-ink-green-900'}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function BookReaderPage() {
  const { id } = useParams();
  const { i18n } = useTranslation();

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
          <p className="text-xs text-ink-text-muted">{tx('جارٍ فتح الكتاب...', 'Opening book...')}</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-parchment-50 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <span className="material-symbols-outlined text-4xl text-ink-text-muted">{'auto_stories'}</span>
        <h2 className="font-serif text-2xl font-semibold text-ink-green-900">
          {tx('لم يتم العثور على الكتاب.', 'Book not found.')}
        </h2>
        <p className="text-xs text-ink-text-secondary max-w-sm">
          {tx('تعذر العثور على الكتاب المطلوب، أو ربما نُقل داخل فهرس المكتبة الرقمية.', 'The requested book could not be found or may have been moved within the digital catalog.')}
        </p>
        <Link
          to="/library"
          className="px-5 py-2.5 rounded-[10px] bg-emerald-700 text-white text-xs font-semibold"
        >
          {tx('العودة إلى المكتبة', 'Back to library')}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen py-8">
      <Helmet>
        <title>{`${book.title_ar} — ${tx('المكتبة الكاشفية', 'Maktabah Kashifiyyah')}`}</title>
        <meta
          name="description"
          content={book.description || book.title_en || book.title_ar}
        />
      </Helmet>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Navigation Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-sand-border">
          <Link
            to="/library"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-ink-green-900"
          >
            <span className="material-symbols-outlined text-[16px]">
              {i18n.dir() === 'rtl' ? 'arrow_forward' : 'arrow_back'}
            </span>
            <span>{tx('العودة إلى المكتبة', 'Back to library')}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            {book.drive_preview_url && (
              <a
                href={book.drive_preview_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-sand-border bg-paper-white hover:bg-parchment-50 text-xs font-semibold text-ink-text-secondary"
              >
                <span className="material-symbols-outlined text-[15px]">{'open_in_new'}</span>
                {tx('فتح في Google Drive', 'Open in Google Drive')}
              </a>
            )}
            <span className="text-xs text-ink-text-muted">
              {tx('رقم الفهرس', 'Catalog ID')}: <span className="font-mono text-ink-text-primary">{book.id}</span>
            </span>
          </div>
        </div>

        {/* Reader Component */}
        <BookReader book={book} />

        {/* Book Metadata */}
        <div className="p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl font-semibold text-ink-green-900">
              {tx('بيانات الكتاب', 'Book details')}
            </h3>
            {book.shamela_id && (
              <span className="px-2 py-0.5 rounded bg-mint-wash-100 text-emerald-700 text-[11px] font-semibold">
                {tx('الشاملة #{n}', 'Shamela #{n}').replace('{n}', book.shamela_id)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <MetaCell label={tx('العنوان العربي', 'Arabic title')} value={book.title_ar} arabic />
            <MetaCell label={tx('العنوان الإنجليزي', 'English title')} value={book.title_en || '—'} />
            <MetaCell label={tx('المؤلف', 'Author')} value={book.author || '—'} arabic={Boolean(book.author)} />
            <MetaCell label={tx('اللغة', 'Language')} value={book.language || 'ar'} />
            <MetaCell label={tx('الصفحات', 'Pages')} value={book.pages ? String(book.pages) : '—'} />
            <MetaCell label={tx('السنة', 'Year')} value={book.year ? String(book.year) : '—'} />
            <MetaCell label={tx('التصنيف', 'Category')} value={book.categories?.[0] || '—'} accent />
          </div>

          {book.categories?.length > 1 && (
            <div>
              <span className="text-ink-text-muted block text-[11px] uppercase tracking-wider mb-2">{tx('التصنيفات', 'Categories')}</span>
              <div className="flex flex-wrap gap-2">
                {book.categories.map((category) => (
                  <span key={category} dir="rtl" className="px-2.5 py-1 rounded-full bg-mint-wash-100 text-emerald-700 text-xs font-medium">
                    {category}
                  </span>
                ))}
              </div>
            </div>
          )}

          {book.description && (
            <p dir="rtl" className="font-arabic text-sm text-ink-text-secondary leading-relaxed pt-2">
              {book.description}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
