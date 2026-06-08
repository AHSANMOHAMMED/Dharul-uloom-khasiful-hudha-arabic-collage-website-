import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { buildDrivePreviewUrl, getDriveFileIdFromUrl, searchBooks } from '../lib/booksApi';

const emptyForm = {
  shamela_id: '',
  title_ar: '',
  title_en: '',
  author: '',
  categories: '',
  description: '',
  language: 'ar',
  year: '',
  pages: '',
  drive_file_id: '',
  drive_preview_url: '',
  cover_url: '',
};

const LibrarianDashboard = () => {
  const { user, isAdmin, isLibrarian, logout } = useAuth();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const canManage = isAdmin || isLibrarian;

  const loadBooks = async () => {
    setLoading(true);
    const result = await searchBooks({ query, page: 1, pageSize: 50 });
    setBooks(result.books);
    setLoading(false);
  };

  useEffect(() => {
    if (!canManage) return;
    loadBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const stats = useMemo(() => {
    return {
      total: books.length,
      arabic: books.filter((book) => book.language === 'ar').length,
      withCover: books.filter((book) => Boolean(book.cover_url)).length,
    };
  }, [books]);

  if (!canManage) {
    return (
      <div className="min-h-screen bg-gray-50 py-20 text-center text-gray-600">
        {ar ? 'ليس لديك صلاحية الوصول إلى هذه الصفحة.' : 'You do not have permission to access this page.'}
      </div>
    );
  }

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const uploadCover = async () => {
    if (!coverFile) return null;
    setCoverUploading(true);
    try {
      const extension = coverFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeName = `${Date.now()}_${form.shamela_id || 'cover'}.${extension}`;
      const storagePath = `book-covers/${safeName}`;
      const { error: uploadError } = await supabase.storage.from('covers').upload(storagePath, coverFile, {
        cacheControl: '3600',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('covers').getPublicUrl(storagePath);
      return data?.publicUrl || null;
    } finally {
      setCoverUploading(false);
    }
  };

  const handlePreviewAutofill = () => {
    const fileId = getDriveFileIdFromUrl(form.drive_preview_url || form.drive_file_id);
    if (fileId && !form.drive_preview_url) {
      updateForm({ drive_preview_url: buildDrivePreviewUrl(fileId), drive_file_id: fileId });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.shamela_id.trim() || !form.title_ar.trim() || !form.author.trim() || !form.drive_file_id.trim()) {
      toast.error(ar ? 'يرجى تعبئة الحقول المطلوبة.' : 'Please fill in the required fields.');
      return;
    }

    setSaving(true);
    try {
      let coverUrl = form.cover_url.trim() || null;
      if (!coverUrl && coverFile) {
        coverUrl = await uploadCover();
      }

      const payload = {
        shamela_id: form.shamela_id.trim(),
        title_ar: form.title_ar.trim(),
        title_en: form.title_en.trim() || null,
        author: form.author.trim(),
        categories: form.categories
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        description: form.description.trim() || null,
        language: form.language || 'ar',
        year: form.year ? Number(form.year) : null,
        pages: form.pages ? Number(form.pages) : null,
        drive_file_id: getDriveFileIdFromUrl(form.drive_file_id) || form.drive_file_id.trim(),
        drive_preview_url: form.drive_preview_url.trim() || buildDrivePreviewUrl(form.drive_file_id),
        cover_url: coverUrl,
      };

      const { error } = await supabase.from('books').upsert(payload, { onConflict: 'shamela_id' });
      if (error) throw error;

      toast.success(ar ? 'تم حفظ الكتاب بنجاح.' : 'Book saved successfully.');
      setForm(emptyForm);
      setCoverFile(null);
      loadBooks();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (book) => {
    if (!window.confirm(`${ar ? 'حذف الكتاب؟' : 'Delete this book?'} ${book.title_ar}`)) return;
    const { error } = await supabase.from('books').delete().eq('id', book.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.info(ar ? 'تم حذف الكتاب.' : 'Book deleted.');
    loadBooks();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50 py-10 px-4">
      <ToastContainer position="top-right" theme="dark" />
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-3xl bg-emerald-900 px-6 py-8 text-white shadow-lg">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em]">
                {ar ? 'إدارة المكتبة' : 'Library Admin'}
              </span>
              <h1 className="mt-3 font-arabic text-3xl font-bold">
                {ar ? `مرحباً، ${user?.username || ''}` : `Welcome, ${user?.username || ''}`}
              </h1>
              <p className="mt-2 max-w-2xl text-emerald-50/90">
                {ar
                  ? 'أضف الكتب أو حدّثها مباشرة في Supabase باستخدام رابط معاينة Google Drive.'
                  : 'Add or update books directly in Supabase using Google Drive preview links.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/library" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-900">
                {ar ? 'عرض المكتبة' : 'View Library'}
              </Link>
              <button onClick={logout} className="rounded-xl border border-white/30 px-4 py-2 text-sm font-bold">
                {ar ? 'خروج' : 'Logout'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-white p-5">
            <div className="text-sm text-gray-500">{ar ? 'إجمالي الكتب' : 'Total books'}</div>
            <div className="mt-2 text-3xl font-bold text-emerald-800">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-5">
            <div className="text-sm text-gray-500">{ar ? 'كتب عربية' : 'Arabic books'}</div>
            <div className="mt-2 text-3xl font-bold text-emerald-800">{stats.arabic}</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-5">
            <div className="text-sm text-gray-500">{ar ? 'مع أغلفة' : 'With covers'}</div>
            <div className="mt-2 text-3xl font-bold text-emerald-800">{stats.withCover}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">{ar ? 'إضافة / تعديل كتاب' : 'Add / Update Book'}</h2>
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-bold">{ar ? 'نصيحة سريعة' : 'Quick tip'}</div>
              <p className="mt-1 leading-relaxed">
                {ar
                  ? 'يمكنك تحضير البيانات في ملف JSON مطابق للنموذج الموجود في docs/books.sample.json ثم استخدامه مع سكربت الاستيراد.'
                  : 'You can prepare a JSON file using the structure in docs/books.sample.json, then import it with the resumable script.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/docs/library-setup-guide.md"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-900"
                >
                  {ar ? 'دليل الإعداد' : 'Setup guide'}
                </Link>
                <span className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold">
                  node scripts/library/importBooks.mjs --input ./books.json
                </span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                ['shamela_id', ar ? 'رقم الشاملة' : 'Shamela ID'],
                ['title_ar', ar ? 'العنوان العربي' : 'Arabic title'],
                ['title_en', ar ? 'العنوان الإنجليزي' : 'English title'],
                ['author', ar ? 'المؤلف' : 'Author'],
                ['categories', ar ? 'التصنيفات مفصولة بفواصل' : 'Categories, comma separated'],
                ['year', ar ? 'السنة' : 'Year'],
                ['pages', ar ? 'عدد الصفحات' : 'Pages'],
                ['drive_file_id', ar ? 'Google Drive File ID' : 'Google Drive File ID'],
                ['drive_preview_url', ar ? 'رابط المعاينة' : 'Preview URL'],
                ['cover_url', ar ? 'رابط الغلاف (اختياري)' : 'Cover URL (optional)'],
              ].map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-sm font-medium text-gray-700 md:col-span-1">
                  {label}
                  <input
                    value={form[key]}
                    onChange={(e) => updateForm({ [key]: e.target.value })}
                    onBlur={key === 'drive_preview_url' ? handlePreviewAutofill : undefined}
                    className="rounded-xl border border-gray-200 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                    dir={ar ? 'rtl' : 'ltr'}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 md:col-span-2">
                {ar ? 'الوصف' : 'Description'}
                <textarea
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  rows={4}
                  className="rounded-xl border border-gray-200 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  dir={ar ? 'rtl' : 'ltr'}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                {ar ? 'اللغة' : 'Language'}
                <select
                  value={form.language}
                  onChange={(e) => updateForm({ language: e.target.value })}
                  className="rounded-xl border border-gray-200 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ar">Arabic</option>
                  <option value="ur">Urdu</option>
                  <option value="en">English</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 md:col-span-2">
                {ar ? 'غلاف الكتاب (صورة)' : 'Book cover (image)'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  className="rounded-xl border border-gray-200 px-4 py-3 focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-xs text-gray-500">
                  {ar
                    ? 'يمكنك رفع صورة الغلاف هنا، أو وضع رابط مباشر في خانة الغلاف.'
                    : 'You can upload a cover image here, or paste a direct cover URL in the cover field.'}
                </span>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || coverUploading}
                className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving || coverUploading
                  ? ar
                    ? 'جارٍ الحفظ...'
                    : 'Saving...'
                  : ar
                    ? 'حفظ الكتاب'
                    : 'Save Book'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm);
                  setCoverFile(null);
                }}
                className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700"
              >
                {ar ? 'مسح النموذج' : 'Reset'}
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-gray-900">{ar ? 'آخر الكتب' : 'Latest books'}</h2>
              <button
                type="button"
                onClick={loadBooks}
                className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800"
              >
                {ar ? 'تحديث' : 'Refresh'}
              </button>
            </div>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                loadBooks();
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ar ? 'ابحث بعنوان أو مؤلف' : 'Search by title or author'}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <button type="submit" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
                {ar ? 'بحث' : 'Search'}
              </button>
            </form>
            <div className="mt-4">
              {loading ? (
                <div className="py-16 text-center text-gray-500">{ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
              ) : (
                <div className="space-y-3">
                  {books.map((book) => (
                    <div key={book.id} className="rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 dir="rtl" className="font-arabic text-lg font-bold text-gray-900 line-clamp-2">
                            {book.title_ar}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">{book.author}</p>
                          <p className="mt-2 text-xs text-gray-400">
                            {book.shamela_id} · {book.language} · {book.pages || '—'} pages
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setForm({
                                shamela_id: book.shamela_id || '',
                                title_ar: book.title_ar || '',
                                title_en: book.title_en || '',
                                author: book.author || '',
                                categories: (book.categories || []).join(', '),
                                description: book.description || '',
                                language: book.language || 'ar',
                                year: book.year || '',
                                pages: book.pages || '',
                                drive_file_id: book.drive_file_id || '',
                                drive_preview_url: book.drive_preview_url || '',
                                cover_url: book.cover_url || '',
                              })
                              setCoverFile(null)
                            }}
                            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white"
                          >
                            {ar ? 'تعديل' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(book)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700"
                          >
                            {ar ? 'حذف' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {books.length === 0 && (
                    <div className="py-16 text-center text-gray-500">
                      {ar ? 'لا توجد كتب بعد.' : 'No books yet.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibrarianDashboard;
