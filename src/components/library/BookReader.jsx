import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildDriveDownloadUrl, buildDrivePreviewUrl } from '../../lib/booksApi';
import {
  addBookmark,
  addNote,
  isFavorite,
  listBookmarks,
  listNotes,
  removeBookmark,
  removeNote,
  toggleFavorite,
} from '../../lib/libraryUserApi';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { tx } from '../../lib/tx';
import TextReader from './TextReader';
import WordMeaningPanel from './WordMeaningPanel';
import Icon from '../Icon';

/**
 * Google Drive based reader:
 * 1) Drive preview iframe (default).
 * 2) Direct PDF embed/object.
 * 3) "Text + meanings" mode for books with imported page text (book_pages),
 *    with a floating "Word meaning" panel.
 */
export default function BookReader({ book }) {
  useTranslation(); // subscribe: re-render on language change
  const [theme, setTheme] = useState('paper'); // paper | sepia | dark
  const [mode, setMode] = useState('iframe'); // iframe | embed | text
  const [embedFailed, setEmbedFailed] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [meaning, setMeaning] = useState(null); // { word, context } when the panel is open
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [bmLabel, setBmLabel] = useState('');
  const [noteText, setNoteText] = useState('');
  const [savingEngage, setSavingEngage] = useState(false);

  const handlePageChange = useCallback((p) => setCurrentPage(p), []);

  // Load user engagement (favorite, bookmarks, notes) for this book.
  useEffect(() => {
    setFavorite(false);
    setBookmarks([]);
    setNotes([]);
    setCurrentPage(1);
    setJumpPage(null);
    if (!book?.id) return undefined;
    let alive = true;
    Promise.all([isFavorite(book.id), listBookmarks(book.id), listNotes(book.id)]).then(
      ([fav, bms, nts]) => {
        if (!alive) return;
        setFavorite(fav);
        setBookmarks(bms);
        setNotes(nts);
      },
    );
    return () => {
      alive = false;
    };
  }, [book?.id]);

  const onToggleFavorite = async () => {
    if (!book?.id || favBusy) return;
    setFavBusy(true);
    try {
      const next = await toggleFavorite(book.id);
      setFavorite(next);
    } finally {
      setFavBusy(false);
    }
  };

  const onAddBookmark = async (e) => {
    e.preventDefault();
    if (!book?.id || savingEngage) return;
    setSavingEngage(true);
    try {
      const created = await addBookmark(book.id, currentPage, bmLabel.trim() || null);
      if (created) {
        setBookmarks((prev) =>
          [...prev.filter((b) => b.page_number !== created.page_number), created].sort(
            (a, b) => (a.page_number || 0) - (b.page_number || 0),
          ),
        );
        setBmLabel('');
      }
    } finally {
      setSavingEngage(false);
    }
  };

  const onRemoveBookmark = async (id) => {
    await removeBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const onAddNote = async (e) => {
    e.preventDefault();
    const content = noteText.trim();
    if (!book?.id || !content || savingEngage) return;
    setSavingEngage(true);
    try {
      const created = await addNote(book.id, currentPage, content);
      if (created) {
        setNotes((prev) => [created, ...prev]);
        setNoteText('');
      }
    } finally {
      setSavingEngage(false);
    }
  };

  const onRemoveNote = async (id) => {
    await removeNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const openAtPage = (pageNum) => {
    if (!pageNum || pageCount <= 0) return;
    setMode('text');
    setJumpPage({ page: pageNum, key: Date.now() });
  };

  // "Text + meanings" mode is offered only for books with imported page text.
  useEffect(() => {
    setPageCount(0);
    if (!book?.id || !isSupabaseConfigured) return undefined;
    let alive = true;
    supabase
      .from('book_pages')
      .select('id', { count: 'exact', head: true })
      .eq('book_id', book.id)
      .then(({ count, error }) => {
        if (alive && !error) setPageCount(count || 0);
      });
    return () => {
      alive = false;
    };
  }, [book?.id]);

  const previewUrl = useMemo(
    () => book?.drive_preview_url || buildDrivePreviewUrl(book?.drive_file_id),
    [book]
  );
  const downloadUrl = useMemo(
    () => buildDriveDownloadUrl(book?.drive_file_id || book?.drive_preview_url),
    [book]
  );

  if (!book) {
    return (
      <div className="rounded-[14px] border border-dashed border-sand-border bg-paper-white p-12 text-center text-ink-text-muted">
        {tx('لا يوجد كتاب لعرضه.', 'No book selected.')}
      </div>
    );
  }

  const themeClasses = {
    paper: 'bg-paper-white text-ink-text-primary',
    sepia: 'bg-[#F4ECD8] text-[#433422]',
    dark: 'bg-dark-canvas text-dark-text-primary'
  };

  const themes = [
    { id: 'paper', label: tx('فاتح', 'Light'), active: 'bg-paper-white text-ink-green-900 shadow-xs' },
    { id: 'sepia', label: tx('بني فاتح', 'Sepia'), active: 'bg-[#F4ECD8] text-[#433422] shadow-xs' },
    { id: 'dark', label: tx('داكن', 'Dark'), active: 'bg-dark-surface text-dark-text-primary shadow-xs' },
  ];

  const modes = [
    { id: 'iframe', label: tx('العرض المباشر', 'Preview') },
    { id: 'embed', label: 'PDF' },
    ...(pageCount > 0 ? [{ id: 'text', label: tx('النص + المعاني', 'Text + meanings') }] : []),
  ];

  const fallbackCard = (
    <div className="max-w-md w-full p-8 rounded-[14px] bg-paper-white border border-sand-border text-center shadow-manuscript space-y-4">
      <Icon name="menu_book" className="text-4xl text-brass-gold-500" />
      <h4 className="font-serif text-lg font-semibold text-ink-green-900">
        {tx('تعذر عرض الملف داخل الصفحة', 'In-browser preview unavailable')}
      </h4>
      <p className="text-xs text-ink-text-secondary leading-relaxed">
        {tx(
          'منعت إعدادات Google Drive أو خصوصية المتصفح عرض هذا الملف داخل الصفحة. يمكنك فتحه في Google Drive أو تنزيل ملف PDF.',
          'Google Drive or your browser privacy settings prevented embedding this file. You can open it in Google Drive or download the PDF.'
        )}
      </p>
      <div className="pt-2 flex flex-col sm:flex-row gap-3">
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-10 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-xs"
          >
            <Icon name="open_in_new" className="text-[16px]" />
            <span>{tx('فتح Drive', 'Open Drive')}</span>
          </a>
        )}
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-10 rounded-[10px] border border-sand-border hover:bg-parchment-50 text-ink-text-primary text-xs font-semibold flex items-center justify-center gap-1"
          >
            <Icon name="download" className="text-[16px]" />
            <span>{tx('تنزيل PDF', 'Download PDF')}</span>
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[14px] border border-sand-border shadow-manuscript-md bg-paper-white">

      {/* Distraction-Free Top Chrome */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-border bg-parchment-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-mint-wash-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
            {'PDF'}
          </div>
          <div>
            <h3 dir="rtl" className="font-arabic text-sm sm:text-base font-bold text-ink-green-900 line-clamp-1">
              {book.title_ar}
            </h3>
            <p className="text-[11px] text-ink-text-muted font-sans line-clamp-1">
              {book.author || tx('القراءة المباشرة من Google Drive', 'Direct reading from Google Drive')}
            </p>
          </div>
        </div>

        {/* Action Controls: Modes, Themes & External Links */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Reader modes */}
          <div className="flex items-center bg-sand-border/30 rounded-lg p-0.5 border border-sand-border text-xs">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  mode === m.id ? 'bg-emerald-700 text-white shadow-xs' : 'text-ink-text-muted'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Reading Themes */}
          <div className="flex items-center bg-sand-border/30 rounded-lg p-0.5 border border-sand-border text-xs">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                  theme === t.id ? t.active : 'text-ink-text-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={favBusy}
            aria-pressed={favorite}
            title={favorite ? tx('إزالة من المفضلة', 'Remove from favorites') : tx('إضافة إلى المفضلة', 'Add to favorites')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              favorite
                ? 'border-rose-300 bg-rose-50 text-rose-700'
                : 'border-sand-border hover:bg-parchment-50 text-ink-text-secondary'
            }`}
          >
            <Icon name={favorite ? 'favorite' : 'favorite_border'} className="text-[15px]" />
            <span className="hidden md:inline">{favorite ? tx('مفضل', 'Saved') : tx('مفضلة', 'Save')}</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              drawerOpen
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-sand-border hover:bg-parchment-50 text-ink-text-secondary'
            }`}
          >
            <Icon name="bookmark" className="text-[15px]" />
            <span className="hidden md:inline">{tx('إشارات وملاحظات', 'Bookmarks & Notes')}</span>
            {(bookmarks.length + notes.length) > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${drawerOpen ? 'bg-white/20 text-white' : 'bg-mint-wash-100 text-emerald-800'}`}>
                {bookmarks.length + notes.length}
              </span>
            )}
          </button>

          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-sand-border hover:bg-parchment-50 text-xs font-semibold text-ink-text-secondary transition-colors"
            >
              <Icon name="open_in_new" className="text-[15px]" />
              <span className="hidden sm:inline">{'Drive'}</span>
            </a>
          )}

          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Icon name="download" className="text-[15px]" />
              <span className="hidden sm:inline">{tx('تنزيل', 'Download')}</span>
            </a>
          )}
        </div>
      </div>

      {/* Bookmarks & Notes Drawer */}
      {drawerOpen && (
        <div className="border-b border-sand-border bg-parchment-50/70 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-ink-green-900 uppercase tracking-wider">
              {tx('الإشارات المرجعية', 'Bookmarks')}
            </h4>
            <form onSubmit={onAddBookmark} className="flex gap-2">
              <input
                type="text"
                value={bmLabel}
                onChange={(e) => setBmLabel(e.target.value)}
                placeholder={tx(`إشارة للصفحة ${currentPage} (اختياري)`, `Bookmark page ${currentPage} (optional)`)}
                className="flex-1 rounded-lg border border-sand-border bg-paper-white px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={savingEngage}
                className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {tx('إضافة', 'Add')}
              </button>
            </form>
            {bookmarks.length === 0 ? (
              <p className="text-xs text-ink-text-muted">{tx('لا توجد إشارات بعد.', 'No bookmarks yet.')}</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {bookmarks.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-sand-border bg-paper-white px-2.5 py-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => openAtPage(b.page_number)}
                      disabled={pageCount <= 0}
                      className="text-start flex-1 truncate font-medium text-emerald-800 hover:underline disabled:no-underline disabled:text-ink-text-primary"
                    >
                      {tx('صفحة', 'Page')} {b.page_number || 1}{b.label ? ` — ${b.label}` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveBookmark(b.id)}
                      className="text-ink-text-muted hover:text-rose-700 text-[11px] font-semibold"
                    >
                      {tx('حذف', 'Remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-ink-green-900 uppercase tracking-wider">
              {tx('ملاحظات الدراسة', 'Study Notes')}
            </h4>
            <form onSubmit={onAddNote} className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={tx(`أضف ملاحظة للصفحة ${currentPage}...`, `Add note for page ${currentPage}...`)}
                className="flex-1 rounded-lg border border-sand-border bg-paper-white px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={savingEngage || !noteText.trim()}
                className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {tx('حفظ', 'Save')}
              </button>
            </form>
            {notes.length === 0 ? (
              <p className="text-xs text-ink-text-muted">{tx('لا توجد ملاحظات بعد.', 'No notes yet.')}</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {notes.map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-2 rounded-lg border border-sand-border bg-paper-white px-2.5 py-1.5 text-xs">
                    <div className="flex-1 space-y-0.5">
                      {n.page_number != null && (
                        <button
                          type="button"
                          onClick={() => openAtPage(n.page_number)}
                          disabled={pageCount <= 0}
                          className="text-[11px] font-semibold text-emerald-700 hover:underline disabled:no-underline"
                        >
                          {tx('صفحة', 'Page')} {n.page_number}
                        </button>
                      )}
                      <p className="text-ink-text-primary whitespace-pre-wrap">{n.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveNote(n.id)}
                      className="text-ink-text-muted hover:text-rose-700 text-[11px] font-semibold shrink-0"
                    >
                      {tx('حذف', 'Remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Reader Canvas Area */}
      <div className={`relative min-h-[75vh] flex items-center justify-center p-2 sm:p-4 ${themeClasses[theme]}`}>
        {mode === 'text' && pageCount > 0 ? (
          <div className="w-full">
            <TextReader
              bookId={book.id}
              totalPages={pageCount}
              externalPage={jumpPage}
              onPageChange={handlePageChange}
              onWord={(word, context) => setMeaning({ word, context })}
            />
          </div>
        ) : embedFailed || !previewUrl ? (
          fallbackCard
        ) : mode === 'embed' ? (
          <object
            data={downloadUrl || previewUrl}
            type="application/pdf"
            className="w-full h-[75vh] rounded-lg border border-sand-border shadow-xs bg-paper-white"
          >
            {fallbackCard}
          </object>
        ) : (
          /* Live Reader Frame */
          <iframe
            src={previewUrl}
            title={book.title_ar}
            onError={() => setEmbedFailed(true)}
            className="w-full h-[75vh] rounded-lg border border-sand-border shadow-xs"
            allow="autoplay; fullscreen"
          />
        )}
      </div>

      {/* Bottom Information Footer */}
      <div className="p-3 border-t border-sand-border bg-parchment-50 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-text-muted">
        <span>
          {tx('إذا كان العرض داخل الصفحة بطيئاً، افتح الملف مباشرة في Google Drive.', 'If embedded reading feels slow, open the file directly in Google Drive.')}
        </span>
        <span>{tx('المعرّف', 'ID')}: {book.id}</span>
      </div>

      {/* Floating word-meaning panel */}
      {meaning ? (
        <div className="fixed bottom-4 end-4 z-40 w-[min(92vw,26rem)] max-h-[85vh] overflow-y-auto rounded-[14px] shadow-manuscript-md">
          <WordMeaningPanel
            initialWord={meaning.word}
            initialContext={meaning.context}
            onClose={() => setMeaning(null)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMeaning({ word: '', context: '' })}
          className="fixed bottom-4 end-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-manuscript-md hover:bg-emerald-500"
        >
          <Icon name="translate" className="text-[18px]" />
          {tx('معنى كلمة', 'Word meaning')}
        </button>
      )}
    </div>
  );
}
