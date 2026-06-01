import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';
import BookReader from '../components/library/BookReader';
import { getBook, getBookFileUrl, getBookPages } from '../lib/booksApi';

const PAGE_BATCH = 200;

const BookReaderPage = () => {
  const { id } = useParams();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const b = await getBook(id);
      if (!active) return;
      setBook(b);
      if (b) {
        const [bookPages, signedUrl] = await Promise.all([
          getBookPages(id, { from: 0, to: PAGE_BATCH - 1 }),
          b.file_path ? getBookFileUrl(b.file_path) : Promise.resolve(null),
        ]);
        if (!active) return;
        setPages(bookPages);
        setFileUrl(signedUrl);
      }
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
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <Helmet>
        <title>{book.title_ar}</title>
      </Helmet>
      <div className="mx-auto max-w-4xl">
        <Link to="/library" className="mb-4 inline-block text-sm text-islamic-green hover:underline">
          {ar ? '← العودة إلى المكتبة' : '← Back to library'}
        </Link>

        <header className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h1 dir="rtl" className="font-arabic text-3xl font-bold text-islamic-dark">
            {book.title_ar}
          </h1>
          {book.title_en && <p className="mt-1 text-gray-500">{book.title_en}</p>}
          {book.author_name && (
            <p dir="rtl" className="mt-2 font-arabic text-gray-600">
              {book.author_name}
            </p>
          )}
          {book.description && (
            <p dir="rtl" className="mt-3 font-arabic leading-relaxed text-gray-700">
              {book.description}
            </p>
          )}
        </header>

        <BookReader book={book} pages={pages} fileUrl={fileUrl} />
      </div>
    </div>
  );
};

export default BookReaderPage;
