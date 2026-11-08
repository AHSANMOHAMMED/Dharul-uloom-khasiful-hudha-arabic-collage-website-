import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { buildDrivePreviewUrl, getDriveFileIdFromUrl, searchBooks } from '../lib/booksApi';
import { exportToCSV } from '../lib/exportUtils';
import KhatamPattern from '../components/KhatamPattern';
import DictionaryAdmin from '../components/library/DictionaryAdmin';
import { tx } from '../lib/tx';

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
  const dir = { ar: 'rtl' }[i18n.language] || 'ltr';
  const [tab, setTab] = useState('books');

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
      <div className="min-h-screen bg-[#FBF8F0] py-20 text-center text-[#4A5E56]">
        {tx('ليس لديك صلاحية الوصول إلى هذه الصفحة.', 'You do not have permission to access this page.')}
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
      toast.error(tx('يرجى تعبئة الحقول المطلوبة.', 'Please fill in the required fields.'));
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

      toast.success(tx('تم حفظ الكتاب بنجاح في المكتبة.', 'Book saved successfully.'));
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
    if (!window.confirm(`${tx('هل أنت متأكد من حذف هذا الكتاب؟', 'Delete this book from the catalog?')} ${book.title_ar}`)) return;
    const { error } = await supabase.from('books').delete().eq('id', book.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.info(tx('تم حذف الكتاب.', 'Book removed from library catalog.'));
    loadBooks();
  };

  return (
    <div className="min-h-screen bg-[#FBF8F0] text-[#14201B] relative overflow-hidden py-8 sm:py-12">
      {/* Background Watermark */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#0B3B2E" id="librarian-khatam" />
      </div>

      <ToastContainer position="top-right" theme="light" autoClose={3000} />

      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header Banner */}
        <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#11694A]"></div>

          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#E3F1EA] text-[#11694A] flex items-center justify-center font-arabic text-2xl sm:text-3xl font-bold shrink-0 shadow-sm border border-[#11694A]/20">
                ك
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E3F1EA] text-[#11694A] border border-[#11694A]/20 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#11694A]"></span>
                  {tx('أمين المكتبة الرقمية', 'Digital Maktabah Administration')}
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#0B3B2E]">
                  {tx('مرحباً، {name}', 'Welcome, {name}').replace('{name}', user?.username || tx('أمين المكتبة', 'Librarian'))}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-[#4A5E56] font-sans">
                  {tx('فهرسة المخطوطات والكتب وربطها بروابط Google Drive للمطالعة والتحميل', 'Catalog manuscripts, curate Islamic texts & integrate Google Drive preview manifests')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/library"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#FBF8F0] border border-[#E8E1D0] text-[#0B3B2E] font-sans font-semibold text-xs sm:text-sm rounded-xl transition shadow-sm"
              >
                <svg className="w-4 h-4 text-[#11694A] stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {tx('عرض المكتبة للعامة', 'Public Library View')}
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FEE2E2] hover:bg-[#FCA5A5] text-[#991B1B] font-sans font-semibold text-xs sm:text-sm rounded-xl transition"
              >
                {tx('خروج', 'Logout')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ['books', tx('الكتب', 'Books')],
            ['dictionary', tx('القاموس العربي–التاميلي', 'Arabic–Tamil dictionary')],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-sans font-semibold transition shadow-sm ${
                tab === id
                  ? 'bg-[#11694A] text-white'
                  : 'bg-white border border-[#E8E1D0] text-[#0B3B2E] hover:bg-[#FBF8F0]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'dictionary' && (
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-4 sm:p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)]">
            <DictionaryAdmin />
          </div>
        )}

        {tab === 'books' && (
        <>
        {/* 3 KPI Stat Tiles */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-5 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#4A5E56]">{tx('إجمالي الكتب المفهرسة', 'Total Cataloged Books')}</div>
              <div className="mt-1 text-3xl font-serif font-bold text-[#0B3B2E] font-mono tabular-nums">{stats.total}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
              <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-5 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#4A5E56]">{tx('الكتب باللغة العربية', 'Arabic Folios')}</div>
              <div className="mt-1 text-3xl font-serif font-bold text-[#11694A] font-mono tabular-nums">{stats.arabic}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#E0F2F1] text-[#0F7C86] flex items-center justify-center font-arabic font-bold text-lg">
              ض
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-5 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#4A5E56]">{tx('كتب ذات أغلفة مصورة', 'With Bound Covers')}</div>
              <div className="mt-1 text-3xl font-serif font-bold text-[#C29A3A] font-mono tabular-nums">{stats.withCover}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center">
              <svg className="w-5 h-5 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Main Content Layout: Form on Left, Latest Books Table on Right */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          
          {/* Add / Update Book Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E8E1D0] p-6 sm:p-8 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-6">
            <div className="pb-3 border-b border-[#E8E1D0] flex justify-between items-center">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('إضافة أو تعديل بيانات كتاب', 'Add / Update Manuscript Record')}
              </h2>
              {form.shamela_id && (
                <span className="text-[10px] font-mono font-bold bg-[#E3F1EA] text-[#11694A] px-2 py-0.5 rounded">
                  {tx('تعديل: {id}', 'Editing: {id}').replace('{id}', form.shamela_id)}
                </span>
              )}
            </div>

            {/* Quick Tip Box */}
            <div className="rounded-xl border border-[#E8E1D0] bg-[#FBF8F0] p-4 text-xs text-[#4A5E56] space-y-2">
              <div className="font-bold text-[#0B3B2E] flex items-center gap-1.5">
                <span className="text-[#C29A3A]">✦</span>
                {tx('إرشاد الاستيراد الفوري', 'Automated Batch Ingestion')}
              </div>
              <p className="leading-relaxed">
                {tx('يمكنك وضع رابط Google Drive للمعاينة وسيقوم النظام تلقائياً باستخراج معرف الملف وتوليد الرابط المتوافق.', 'Paste any Google Drive preview or share link into the Preview URL field. The system will automatically extract the file ID.')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                ['shamela_id', tx('رقم الشاملة / الرمز', 'Shamela ID / Unique Code'), true],
                ['title_ar', tx('العنوان بالعربية', 'Arabic Title'), true],
                ['title_en', tx('العنوان بالإنجليزية (اختياري)', 'English Title (optional)'), false],
                ['author', tx('اسم المؤلف', 'Author'), true],
                ['categories', tx('التصنيفات (مفصولة بفواصل)', 'Categories (comma separated)'), false],
                ['year', tx('سنة النشر أو الوفاة', 'Publication Year / Hijri'), false],
                ['pages', tx('عدد الصفحات', 'Page Count'), false],
                ['drive_file_id', tx('معرف ملف Google Drive', 'Google Drive File ID'), true],
                ['drive_preview_url', tx('رابط المعاينة المباشر', 'Preview URL'), false],
                ['cover_url', tx('رابط الغلاف الخارجي (اختياري)', 'Cover URL (optional)'), false],
              ].map(([key, label, req]) => (
                <label key={key} className="flex flex-col gap-1 text-xs font-bold text-[#4A5E56] uppercase tracking-wider md:col-span-1">
                  <span>
                    {label} {req && <span className="text-[#B91C1C]">*</span>}
                  </span>
                  <input
                    value={form[key]}
                    onChange={(e) => updateForm({ [key]: e.target.value })}
                    onBlur={key === 'drive_preview_url' ? handlePreviewAutofill : undefined}
                    className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] font-normal rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                    dir={key === 'title_ar' ? 'rtl' : 'ltr'}
                    required={req}
                  />
                </label>
              ))}

              <label className="flex flex-col gap-1 text-xs font-bold text-[#4A5E56] uppercase tracking-wider md:col-span-2">
                <span>{tx('الوصف ونبذة عن المخطوط', 'Description & Abstract')}</span>
                <textarea
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  rows={3}
                  className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] font-normal rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#11694A] resize-none"
                  dir={dir}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-[#4A5E56] uppercase tracking-wider">
                <span>{tx('لغة الكتاب', 'Primary Language')}</span>
                <select
                  value={form.language}
                  onChange={(e) => updateForm({ language: e.target.value })}
                  className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] font-normal rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                >
                  <option value="ar">{tx('عربي', 'Arabic')}</option>
                  <option value="ur">{tx('أردو', 'Urdu')}</option>
                  <option value="en">{tx('إنجليزي', 'English')}</option>
                  <option value="mixed">{tx('مختلط', 'Mixed')}</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold text-[#4A5E56] uppercase tracking-wider md:col-span-2">
                <span>{tx('رفع صورة الغلاف (JPG/PNG)', 'Upload Bound Cover Image')}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  className="w-full bg-[#FBF8F0] border border-[#E8E1D0] text-[#14201B] font-normal rounded-xl p-2 text-xs focus:outline-none"
                />
              </label>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || coverUploading}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#11694A] hover:bg-[#0B3B2E] text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-sm disabled:opacity-50"
              >
                {saving || coverUploading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    {tx('جاري الحفظ...', 'Saving to Maktabah...')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {tx('حفظ الكتاب في المكتبة', 'Save Book to Catalog')}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm);
                  setCoverFile(null);
                }}
                className="px-4 py-2.5 bg-white hover:bg-[#FBF8F0] border border-[#E8E1D0] text-[#4A5E56] font-semibold rounded-xl text-xs sm:text-sm transition"
              >
                {tx('مسح النموذج', 'Reset Form')}
              </button>
            </div>
          </form>

          {/* Catalog & Search Drawer */}
          <div className="bg-white rounded-2xl border border-[#E8E1D0] p-6 shadow-[0_2px_8px_-2px_rgba(11,59,46,0.05)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E1D0]">
              <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
                {tx('فهرس الكتب المسجلة', 'Catalog Roster')}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportToCSV(
                      books.map((b) => ({
                        shamela_id: b.shamela_id,
                        title_ar: b.title_ar,
                        title_en: b.title_en,
                        author: b.author,
                        language: b.language,
                        pages: b.pages,
                      })),
                      'kashiful_hudha_books.csv'
                    )
                  }
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#FBF8F0] border border-[#E8E1D0] text-[#0B3B2E] hover:bg-white"
                >
                  {'CSV'}
                </button>
                <button
                  type="button"
                  onClick={loadBooks}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#E3F1EA] text-[#11694A] hover:bg-[#11694A] hover:text-white transition"
                >
                  {tx('تحديث', 'Refresh')}
                </button>
              </div>
            </div>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                loadBooks();
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tx('بحث بالعنوان أو اسم المؤلف...', 'Search by title or author...')}
                className="flex-1 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#11694A]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#11694A] text-white rounded-xl text-xs font-bold hover:bg-[#0B3B2E] transition"
              >
                {tx('بحث', 'Search')}
              </button>
            </form>

            <div className="max-h-[560px] overflow-y-auto space-y-2.5 pr-1">
              {loading ? (
                <div className="py-16 text-center text-xs text-[#4A5E56]">
                  {tx('جاري تحميل الكتب...', 'Loading catalog...')}
                </div>
              ) : books.map((book) => (
                <div key={book.id} className="p-3 bg-[#FBF8F0] rounded-xl border border-[#E8E1D0] space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 dir="rtl" className="font-arabic text-sm font-bold text-[#0B3B2E] line-clamp-1">
                        {book.title_ar}
                      </h3>
                      <p className="text-[11px] text-[#4A5E56] truncate mt-0.5">{book.author}</p>
                      <p className="text-[10px] text-[#C29A3A] font-mono mt-0.5">
                        {book.shamela_id} · {book.language?.toUpperCase()} · {tx('{n} صفحة', '{n} pages').replace('{n}', book.pages || '—')}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
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
                          });
                          setCoverFile(null);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-[#E8E1D0] text-[#11694A] hover:border-[#11694A]"
                      >
                        {tx('تعديل', 'Edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(book)}
                        className="px-2 py-1 text-[11px] font-bold rounded-lg bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FCA5A5]"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!loading && books.length === 0 && (
                <div className="py-12 text-center text-xs text-[#4A5E56]">
                  {tx('لم يتم العثور على كتب مطابقة.', 'No books found matching search.')}
                </div>
              )}
            </div>
          </div>

        </div>
        </>
        )}

      </div>
    </div>
  );
};

export default LibrarianDashboard;
