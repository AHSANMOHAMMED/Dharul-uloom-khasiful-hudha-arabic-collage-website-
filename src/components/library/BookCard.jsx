import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const LANGUAGE_LABELS = {
  ar: { ar: 'عربي', en: 'Arabic' },
  ur: { ar: 'أردو', en: 'Urdu' },
  en: { ar: 'إنجليزي', en: 'English' },
  mixed: { ar: 'متعدد اللغات', en: 'Multilingual' },
};

const BookCard = ({ book }) => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const languageLabel = LANGUAGE_LABELS[book.language]?.[ar ? 'ar' : 'en'];
  const primaryCategory = book.categories?.[0];

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group h-full overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm transition-shadow hover:shadow-lg"
    >
      <Link to={`/library/${book.id}`} className="flex h-full flex-col">
        <div className="relative aspect-[3/4] bg-gradient-to-br from-emerald-900 via-emerald-800 to-amber-900">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title_ar}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-5 text-center">
              <div>
                <div className="mb-3 text-5xl">📚</div>
                <span dir="rtl" className="font-arabic text-lg font-bold leading-relaxed text-white line-clamp-4">
                  {book.title_ar}
                </span>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          {languageLabel && (
            <span className="absolute start-2 top-2 rounded-full bg-islamic-gold/95 px-2 py-0.5 text-xs font-semibold text-islamic-dark">
              {languageLabel}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
          <h3 dir="rtl" className="font-arabic text-sm sm:text-base font-bold leading-snug text-islamic-dark line-clamp-2">
            {book.title_ar}
          </h3>
          {book.title_en && <p className="text-xs sm:text-sm text-gray-500 line-clamp-1">{book.title_en}</p>}
          <p dir="rtl" className="font-arabic text-xs sm:text-sm text-gray-600 line-clamp-1">
            {book.author}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-[11px] sm:text-xs text-gray-500">
            {primaryCategory && (
              <span dir="rtl" className="rounded-full bg-emerald-50 px-2 py-0.5 font-arabic text-emerald-700">
                {primaryCategory}
              </span>
            )}
            {book.year ? <span>{book.year}</span> : null}
            {book.pages ? <span>{book.pages} pages</span> : null}
          </div>
        </div>
      </Link>
    </motion.article>
  );
};

export default BookCard;
