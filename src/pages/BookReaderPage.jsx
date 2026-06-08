import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import BookReader from '../components/library/BookReader';
import { getBook } from '../lib/booksApi';

function InfoBadge({ label, value }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">{label}</div>
      <div className="mt-1 text-sm font-semibold text-emerald-950">{value}</div>
    </div>
  )
}

const BookReaderPage = () => {
  const { id } = useParams();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';

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
    return <div className="py-20 text-center text-gray-400">{ar ? 'جارٍ التحميل...' : 'Loading...'}</div>;
  }

  if (!book) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-gray-500">{ar ? 'لم يتم العثور على الكتاب.' : 'Book not found.'}</p>
        <Link to="/library" className="text-islamic-green underline">
          {ar ? 'العودة إلى المكتبة' : 'Back to library'}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50 px-4 py-8">
      <Helmet>
        <title>{book.title_ar}</title>
        <meta
          name="description"
          content={book.description || book.title_en || book.title_ar}
        />
      </Helmet>
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link to="/library" className="inline-block text-sm text-islamic-green hover:underline">
            {ar ? '← العودة إلى المكتبة' : '← Back to library'}
          </Link>
          {book.drive_preview_url && (
            <a
              href={book.drive_preview_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800 shadow-sm"
            >
              {ar ? 'فتح في Google Drive' : 'Open in Google Drive'}
            </a>
          )}
        </div>

        <header className="mb-6 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 px-6 py-8 text-white">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                {book.language || 'ar'}
              </span>
              {book.shamela_id && (
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">
                  Shamela #{book.shamela_id}
                </span>
              )}
            </div>
            <h1 dir="rtl" className="mt-4 font-arabic text-3xl font-bold leading-tight md:text-4xl">
              {book.title_ar}
            </h1>
            {book.title_en && <p className="mt-2 max-w-3xl text-emerald-50/90">{book.title_en}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <InfoBadge label={ar ? 'المؤلف' : 'Author'} value={book.author} />
            <InfoBadge label={ar ? 'اللغة' : 'Language'} value={book.language || 'ar'} />
            <InfoBadge label={ar ? 'الصفحات' : 'Pages'} value={book.pages ? String(book.pages) : '—'} />
            <InfoBadge label={ar ? 'السنة' : 'Year'} value={book.year ? String(book.year) : '—'} />
          </div>

          {book.categories?.length > 0 && (
            <div className="px-6 pb-6">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                {ar ? 'التصنيفات' : 'Categories'}
              </div>
              <div className="flex flex-wrap gap-2">
                {book.categories.map((category) => (
                  <span
                    key={category}
                    dir="rtl"
                    className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          )}

          {book.description && (
            <div className="border-t border-emerald-100 px-6 py-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                {ar ? 'الوصف' : 'Description'}
              </div>
              <p dir="rtl" className="font-arabic leading-relaxed text-gray-700">
                {book.description}
              </p>
            </div>
          )}
        </header>

        <BookReader book={book} />
      </div>
    </div>
  );
};

export default BookReaderPage;
