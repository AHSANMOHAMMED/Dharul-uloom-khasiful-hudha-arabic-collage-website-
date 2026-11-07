import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildDriveDownloadUrl, buildDrivePreviewUrl } from '../../lib/booksApi';

export default function BookReader({ book }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [theme, setTheme] = useState('paper'); // paper | sepia | dark
  const [embedFailed, setEmbedFailed] = useState(false);

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
        No manuscript selected.
      </div>
    );
  }

  const themeClasses = {
    paper: 'bg-paper-white text-ink-text-primary',
    sepia: 'bg-[#F4ECD8] text-[#433422]',
    dark: 'bg-dark-canvas text-dark-text-primary'
  };

  return (
    <div className="overflow-hidden rounded-[14px] border border-sand-border shadow-manuscript-md bg-paper-white">
      
      {/* Distraction-Free Top Chrome */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-border bg-parchment-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-mint-wash-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
            PDF
          </div>
          <div>
            <h3 dir="rtl" className="font-arabic text-sm sm:text-base font-bold text-ink-green-900 line-clamp-1">
              {book.title_ar}
            </h3>
            <p className="text-[11px] text-ink-text-muted font-sans line-clamp-1">
              {book.author || 'Classical Author'}
            </p>
          </div>
        </div>

        {/* Action Controls: Themes & External Links */}
        <div className="flex items-center gap-2">
          
          {/* Reading Themes */}
          <div className="flex items-center bg-sand-border/30 rounded-lg p-0.5 border border-sand-border text-xs">
            <button
              type="button"
              onClick={() => setTheme('paper')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                theme === 'paper' ? 'bg-paper-white text-ink-green-900 shadow-xs' : 'text-ink-text-muted'
              }`}
            >
              Paper
            </button>
            <button
              type="button"
              onClick={() => setTheme('sepia')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                theme === 'sepia' ? 'bg-[#F4ECD8] text-[#433422] shadow-xs' : 'text-ink-text-muted'
              }`}
            >
              Sepia
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                theme === 'dark' ? 'bg-dark-surface text-dark-text-primary shadow-xs' : 'text-ink-text-muted'
              }`}
            >
              Dark
            </button>
          </div>

          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-sand-border hover:bg-parchment-50 text-xs font-semibold text-ink-text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              <span className="hidden sm:inline">Drive</span>
            </a>
          )}

          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
        </div>
      </div>

      {/* Reader Canvas Area */}
      <div className={`relative min-h-[75vh] flex items-center justify-center p-2 sm:p-4 ${themeClasses[theme]}`}>
        {embedFailed || !previewUrl ? (
          /* Clean Fallback State Card */
          <div className="max-w-md w-full p-8 rounded-[14px] bg-paper-white border border-sand-border text-center shadow-manuscript space-y-4">
            <span className="material-symbols-outlined text-4xl text-brass-gold-500">menu_book</span>
            <h4 className="font-serif text-lg font-semibold text-ink-green-900">
              Direct In-Browser Preview Restricted
            </h4>
            <p className="text-xs text-ink-text-secondary leading-relaxed">
              Google Drive or your browser privacy settings prevented direct inline embedding for this folio. You can open it in an isolated Drive tab or download the validated PDF.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-10 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Open in Drive</span>
                </a>
              )}
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-10 rounded-[10px] border border-sand-border hover:bg-parchment-50 text-ink-text-primary text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Download PDF</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          /* Live Reader Frame */
          <iframe
            src={previewUrl}
            title={book.title_ar}
            onError={() => setEmbedFailed(true)}
            className="w-full h-[75vh] rounded-lg border border-sand-border shadow-xs"
            allow="fullscreen"
          />
        )}
      </div>

      {/* Bottom Information Footer */}
      <div className="p-3 border-t border-sand-border bg-parchment-50 flex items-center justify-between text-xs text-ink-text-muted">
        <span>Verified Shamela / Waqf Catalog Asset</span>
        <span>ID: {book.id}</span>
      </div>

    </div>
  );
}
