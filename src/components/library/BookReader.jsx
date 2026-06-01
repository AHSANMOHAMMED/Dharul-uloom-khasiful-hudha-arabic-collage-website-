import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addBookmark,
  addNote,
  getReadingProgress,
  listBookmarks,
  listNotes,
  removeBookmark,
  saveReadingProgress,
} from '../../lib/libraryUserApi';

const FONT_STEPS = [16, 18, 20, 24, 28, 32];

/**
 * In-app reader supporting two modes:
 *   - text/HTML pages (from book_pages) with RTL, font-size, night mode,
 *     bookmarks and notes.
 *   - a PDF artifact rendered in an iframe via a signed URL.
 *
 * Engagement helpers are auth-aware and no-op when the user is signed out.
 */
const BookReader = ({ book, pages = [], fileUrl }) => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  const hasPages = pages.length > 0;
  const [index, setIndex] = useState(0);
  const [fontSize, setFontSize] = useState(20);
  const [night, setNight] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');

  const currentPage = hasPages ? pages[Math.min(index, pages.length - 1)] : null;
  const pageNumber = currentPage?.page_index ?? index + 1;

  // Load engagement state + restore last-read page.
  useEffect(() => {
    if (!book?.id) return;
    let active = true;
    (async () => {
      const [progress, bm, nt] = await Promise.all([
        getReadingProgress(book.id),
        listBookmarks(book.id),
        listNotes(book.id),
      ]);
      if (!active) return;
      setBookmarks(bm);
      setNotes(nt);
      if (progress?.last_page && hasPages) {
        const restore = pages.findIndex((p) => p.page_index === progress.last_page);
        if (restore >= 0) setIndex(restore);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, pages.length]);

  // Persist progress as the reader moves.
  useEffect(() => {
    if (!book?.id || !hasPages) return;
    const pct = pages.length > 1 ? Math.round(((index + 1) / pages.length) * 100) : 100;
    saveReadingProgress(book.id, pageNumber, pct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, book?.id]);

  const isBookmarked = useMemo(
    () => bookmarks.some((b) => b.page_number === pageNumber),
    [bookmarks, pageNumber]
  );

  const toggleBookmark = async () => {
    const existing = bookmarks.find((b) => b.page_number === pageNumber);
    if (existing) {
      await removeBookmark(existing.id);
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
    } else {
      const created = await addBookmark(book.id, pageNumber, `${ar ? 'صفحة' : 'Page'} ${pageNumber}`);
      if (created) setBookmarks((prev) => [...prev, created]);
    }
  };

  const submitNote = async (e) => {
    e.preventDefault();
    if (!noteDraft.trim()) return;
    const created = await addNote(book.id, pageNumber, noteDraft.trim());
    if (created) setNotes((prev) => [created, ...prev]);
    setNoteDraft('');
  };

  const go = (delta) => setIndex((i) => Math.max(0, Math.min(pages.length - 1, i + delta)));

  // ---- PDF mode -----------------------------------------------------------
  if (!hasPages && fileUrl) {
    return (
      <div className="h-[80vh] w-full overflow-hidden rounded-lg border border-gray-200">
        <iframe title={book?.title_ar || 'book'} src={fileUrl} className="h-full w-full" />
      </div>
    );
  }

  if (!hasPages) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500">
        {ar ? 'لا يتوفر نص لهذا الكتاب بعد.' : 'No readable content for this book yet.'}
      </div>
    );
  }

  // ---- Text mode ----------------------------------------------------------
  return (
    <div className={`rounded-xl border ${night ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900'}`}>
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b p-3 ${night ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFontSize((s) => FONT_STEPS[Math.max(0, FONT_STEPS.indexOf(s) - 1)] || s)}
            className="rounded border px-3 py-1 text-sm"
            aria-label={ar ? 'تصغير الخط' : 'Decrease font'}
          >
            A-
          </button>
          <button
            onClick={() => setFontSize((s) => FONT_STEPS[Math.min(FONT_STEPS.length - 1, FONT_STEPS.indexOf(s) + 1)] || s)}
            className="rounded border px-3 py-1 text-sm"
            aria-label={ar ? 'تكبير الخط' : 'Increase font'}
          >
            A+
          </button>
          <button onClick={() => setNight((n) => !n)} className="rounded border px-3 py-1 text-sm">
            {night ? (ar ? 'الوضع النهاري' : 'Day') : (ar ? 'الوضع الليلي' : 'Night')}
          </button>
        </div>
        <button
          onClick={toggleBookmark}
          className={`rounded px-3 py-1 text-sm font-semibold ${isBookmarked ? 'bg-islamic-gold text-islamic-dark' : 'border'}`}
        >
          {isBookmarked ? (ar ? '★ مُعلَّم' : '★ Bookmarked') : (ar ? '☆ علّم الصفحة' : '☆ Bookmark')}
        </button>
      </div>

      {/* Page content */}
      <article
        dir="rtl"
        className="font-arabic whitespace-pre-wrap px-6 py-8 leading-loose"
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.9 }}
      >
        {currentPage.content}
      </article>

      {/* Pager */}
      <div className={`flex items-center justify-between border-t p-3 ${night ? 'border-gray-700' : 'border-gray-200'}`}>
        <button onClick={() => go(-1)} disabled={index === 0} className="rounded border px-4 py-2 text-sm disabled:opacity-40">
          {ar ? 'السابق' : 'Previous'}
        </button>
        <span className="text-sm">
          {ar ? 'صفحة' : 'Page'} {currentPage.page_label || pageNumber} / {pages.length}
        </span>
        <button onClick={() => go(1)} disabled={index >= pages.length - 1} className="rounded border px-4 py-2 text-sm disabled:opacity-40">
          {ar ? 'التالي' : 'Next'}
        </button>
      </div>

      {/* Notes */}
      <div className={`border-t p-4 ${night ? 'border-gray-700' : 'border-gray-200'}`}>
        <h4 className="mb-2 font-semibold">{ar ? 'ملاحظاتي' : 'My notes'}</h4>
        <form onSubmit={submitNote} className="mb-3 flex gap-2">
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder={ar ? 'أضف ملاحظة لهذه الصفحة...' : 'Add a note for this page...'}
            dir={ar ? 'rtl' : 'ltr'}
            className="flex-1 rounded border px-3 py-2 text-sm text-gray-800"
          />
          <button type="submit" className="rounded bg-islamic-green px-4 py-2 text-sm font-semibold text-white">
            {ar ? 'حفظ' : 'Save'}
          </button>
        </form>
        <ul className="space-y-2 text-sm">
          {notes.map((n) => (
            <li key={n.id} className={`rounded p-2 ${night ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <span className="me-2 text-xs text-gray-400">
                {ar ? 'صفحة' : 'p.'} {n.page_number}
              </span>
              {n.content}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BookReader;
