import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildDriveDownloadUrl, buildDrivePreviewUrl } from '../../lib/booksApi';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { tx } from '../../lib/tx';
import TextReader from './TextReader';
import WordMeaningPanel from './WordMeaningPanel';

/**
 * Google Drive based reader:
 * 1) Try the shared Drive preview iframe.
 * 2) Fall back to a direct PDF embed/object.
 * 3) Show a clear download/open message if the browser blocks embedding.
 */
const BookReader = ({ book }) => {
  useTranslation(); // subscribe: re-render on language change
  const [mode, setMode] = useState('iframe');
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
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
        {tx('لا يوجد كتاب لعرضه.', 'No book selected.')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-emerald-50 px-4 py-3">
        <div>
          <h3 dir="rtl" className="font-arabic text-lg font-bold text-emerald-900">
            {book.title_ar}
          </h3>
          <p className="text-xs text-emerald-700">
            {tx('القراءة المباشرة من Google Drive', 'Direct reading from Google Drive')}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('iframe')}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              mode === 'iframe' ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-700 border border-emerald-200'
            }`}
          >
            {tx('العرض المباشر', 'Preview')}
          </button>
          <button
            type="button"
            onClick={() => setMode('embed')}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              mode === 'embed' ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-700 border border-emerald-200'
            }`}
          >
            PDF
          </button>
          {pageCount > 0 && (
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                mode === 'text' ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-700 border border-emerald-200'
              }`}
            >
              {tx('النص + المعاني', 'Text + meanings')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-50 p-3">
        {mode === 'text' && pageCount > 0 ? (
          <TextReader bookId={book.id} totalPages={pageCount} onWord={(word, context) => setMeaning({ word, context })} />
        ) : previewUrl ? (
          <>
            {mode === 'iframe' ? (
              <iframe
                title={book.title_ar}
                src={previewUrl}
                className="h-[78vh] w-full rounded-xl border border-gray-200 bg-white"
                allow="autoplay; fullscreen"
              />
            ) : (
              <object
                data={downloadUrl || previewUrl}
                type="application/pdf"
                className="h-[78vh] w-full rounded-xl border border-gray-200 bg-white"
              >
                <div className="flex h-[78vh] items-center justify-center rounded-xl border border-gray-200 bg-white p-6 text-center">
                  <div className="max-w-md space-y-3">
                    <p className="font-bold text-gray-800">
                      {tx('تعذر عرض الملف داخل الصفحة.', 'This file could not be embedded.')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {tx('يمكنك فتح معاينة Google Drive أو تنزيل الملف لقراءته على جهازك.', 'Open the Google Drive preview or download the PDF to read it locally.')}
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
                      >
                        {tx('فتح المعاينة', 'Open preview')}
                      </a>
                      {downloadUrl && (
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-700"
                        >
                          {tx('تنزيل PDF', 'Download PDF')}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </object>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 pb-1">
              <p className="text-xs text-gray-500">
                {tx('إذا كان العرض داخل الصفحة بطيئاً، افتح الملف مباشرة في Google Drive.', 'If embedded reading feels slow, open the file directly in Google Drive.')}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800"
                >
                  {tx('فتح Drive', 'Open Drive')}
                </a>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                  >
                    {tx('تنزيل', 'Download')}
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[78vh] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-500">
            {tx('لا يوجد رابط معاينة صالح لهذا الكتاب.', 'No valid preview link is available for this book.')}
          </div>
        )}
      </div>

      {meaning ? (
        <div className="fixed bottom-4 end-4 z-40 w-[min(92vw,26rem)] max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl">
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
          className="fixed bottom-4 end-4 z-40 rounded-full bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-600"
        >
          {tx('معنى كلمة', 'Word meaning')}
        </button>
      )}
    </div>
  );
};

export default BookReader;
