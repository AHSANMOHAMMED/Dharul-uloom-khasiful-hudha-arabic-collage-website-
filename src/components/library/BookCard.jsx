import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const LANGUAGE_LABELS = {
  ar: { ar: 'عربي', en: 'Arabic' },
  ur: { ar: 'أردو', en: 'Urdu' },
  en: { ar: 'إنجليزي', en: 'English' },
  mixed: { ar: 'متعدد اللغات', en: 'Multilingual' },
};

/**
 * Compact book card for the library grid. Arabic title is the primary label and
 * is always rendered RTL regardless of the active UI language.
 */
const BookCard = ({ book }) => {
  const { i18n } = useTranslation();
  const isArabicUi = i18n.language === 'ar';
  const langLabel = LANGUAGE_LABELS[book.language]?.[isArabicUi ? 'ar' : 'en'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
    >
      <Link to={`/library/${book.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-islamic-beige">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title_ar}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-islamic-green to-islamic-dark p-4 text-center">
              <span dir="rtl" className="font-arabic text-lg font-bold leading-relaxed text-white line-clamp-4">
                {book.title_ar}
              </span>
            </div>
          )}
          {langLabel && (
            <span className="absolute end-2 top-2 rounded-full bg-islamic-gold/90 px-2 py-0.5 text-xs font-semibold text-islamic-dark">
              {langLabel}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3
            dir="rtl"
            className="font-arabic text-base font-bold leading-snug text-islamic-dark line-clamp-2"
            title={book.title_ar}
          >
            {book.title_ar}
          </h3>
          {book.author_name && (
            <p dir="rtl" className="font-arabic text-sm text-gray-500 line-clamp-1">
              {book.author_name}
            </p>
          )}
          {book.title_en && (
            <p className="text-xs text-gray-400 line-clamp-1">{book.title_en}</p>
          )}
          <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-gray-400">
            {book.category_name && (
              <span dir="rtl" className="rounded bg-gray-100 px-2 py-0.5 font-arabic">
                {book.category_name}
              </span>
            )}
            {book.year ? <span>{book.year}</span> : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default BookCard;
