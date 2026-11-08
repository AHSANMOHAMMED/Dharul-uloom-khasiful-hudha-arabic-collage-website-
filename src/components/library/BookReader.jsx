import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildDriveDownloadUrl, buildDrivePreviewUrl } from '../../lib/booksApi';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { tx } from '../../lib/tx';
import TextReader from './TextReader';
import WordMeaningPanel from './WordMeaningPanel';

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
      <span className="material-symbols-outlined text-4xl text-brass-gold-500">{'menu_book'}</span>
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
            <span className="material-symbols-outlined text-[16px]">{'open_in_new'}</span>
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
            <span className="material-symbols-outlined text-[16px]">{'download'}</span>
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

          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-sand-border hover:bg-parchment-50 text-xs font-semibold text-ink-text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">{'open_in_new'}</span>
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
              <span className="material-symbols-outlined text-[15px]">{'download'}</span>
              <span className="hidden sm:inline">{tx('تنزيل', 'Download')}</span>
            </a>
          )}
        </div>
      </div>

      {/* Reader Canvas Area */}
      <div className={`relative min-h-[75vh] flex items-center justify-center p-2 sm:p-4 ${themeClasses[theme]}`}>
        {mode === 'text' && pageCount > 0 ? (
          <div className="w-full">
            <TextReader bookId={book.id} totalPages={pageCount} onWord={(word, context) => setMeaning({ word, context })} />
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
          <span className="material-symbols-outlined text-[18px]">{'translate'}</span>
          {tx('معنى كلمة', 'Word meaning')}
        </button>
      )}
    </div>
  );
}
