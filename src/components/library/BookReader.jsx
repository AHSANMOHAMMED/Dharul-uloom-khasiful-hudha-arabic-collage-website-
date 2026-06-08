import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildDriveDownloadUrl, buildDrivePreviewUrl } from '../../lib/booksApi';

/**
 * Google Drive based reader:
 * 1) Try the shared Drive preview iframe.
 * 2) Fall back to a direct PDF embed/object.
 * 3) Show a clear download/open message if the browser blocks embedding.
 */
const BookReader = ({ book }) => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [mode, setMode] = useState('iframe');

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
        {ar ? 'لا يوجد كتاب لعرضه.' : 'No book selected.'}
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
            {ar ? 'القراءة المباشرة من Google Drive' : 'Direct reading from Google Drive'}
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
            {ar ? 'العرض المباشر' : 'Preview'}
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
        </div>
      </div>

      <div className="bg-slate-50 p-3">
        {previewUrl ? (
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
                      {ar ? 'تعذر عرض الملف داخل الصفحة.' : 'This file could not be embedded.'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {ar
                        ? 'يمكنك فتح معاينة Google Drive أو تنزيل الملف لقراءته على جهازك.'
                        : 'Open the Google Drive preview or download the PDF to read it locally.'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
                      >
                        {ar ? 'فتح المعاينة' : 'Open preview'}
                      </a>
                      {downloadUrl && (
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-700"
                        >
                          {ar ? 'تنزيل PDF' : 'Download PDF'}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </object>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 pb-1">
              <p className="text-xs text-gray-500">
                {ar
                  ? 'إذا كان العرض داخل الصفحة بطيئاً، افتح الملف مباشرة في Google Drive.'
                  : 'If embedded reading feels slow, open the file directly in Google Drive.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800"
                >
                  {ar ? 'فتح Drive' : 'Open Drive'}
                </a>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                  >
                    {ar ? 'تنزيل' : 'Download'}
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[78vh] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-gray-500">
            {ar ? 'لا يوجد رابط معاينة صالح لهذا الكتاب.' : 'No valid preview link is available for this book.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookReader;
