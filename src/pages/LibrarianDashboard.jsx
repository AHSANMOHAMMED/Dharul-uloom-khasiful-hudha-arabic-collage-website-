import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureFlagsContext';
import { portalHomeFor } from '../lib/useHistoryNav';
import PageNavBar from '../components/PageNavBar';
import { supabase } from '../lib/supabaseClient';
import { buildDrivePreviewUrl, getDriveFileIdFromUrl, searchBooks } from '../lib/booksApi';
import { exportToCSV } from '../lib/exportUtils';
import DictionaryAdmin from '../components/library/DictionaryAdmin';
import { tx } from '../lib/tx';
import { useTabParam } from '../lib/useTabParam';
import DashboardSidebarLayout from '../components/DashboardSidebarLayout';
import OverviewBanner from '../components/portals/OverviewBanner';
import { Stat } from '../components/erp/ui';
import RoleSwitcher from '../components/RoleSwitcher';
import Icon from '../components/Icon';
import { ROLE_BADGE } from '../lib/roleTheme';
import { assertSafeImage } from '../lib/contentApi';
import { appConfirm, appPrompt } from '../lib/appDialog';

const TaskBoard = lazy(() => import('../components/erp/governance/TaskBoard'));
const MySelfServicePanel = lazy(() => import('../components/erp/campus/MySelfServicePanel'));
const MessagesPanel = lazy(() => import('./Messages'));

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
  const auth = useAuth();
  const { user, isAdmin, isLibrarian, loading: authLoading } = auth;
  const { enabled } = useFeatures();
  const { i18n } = useTranslation();
  const dir = { ar: 'rtl' }[i18n.language] || 'ltr';
  const [activeTab, setActiveTab] = useTabParam(['catalog', 'add', 'loans', 'dictionary', 'tasks', 'self', 'messages'], 'catalog');
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FBF8F0] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#11694A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/library-admin' }} />;
  }

  const libraryDisabled = !enabled('library');

  if (!canManage || !auth.isApproved || libraryDisabled) {
    const portalUrl = portalHomeFor(auth);
    return (
      <div className="min-h-screen bg-[#FBF8F0] py-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
          <PageNavBar
            home={{ to: portalUrl, label: tx('بوابتي', 'My portal') }}
            crumbs={[
              { label: tx('بوابتي', 'My portal'), to: portalUrl },
              { label: tx('إدارة المكتبة', 'Maktabah Admin') },
            ]}
          />
          <div className="rounded-2xl bg-white border border-[#E8E1D0] p-8 text-center text-[#4A5E56] space-y-3">
            <p className="font-semibold text-[#0B3B2E]">
              {libraryDisabled
                ? tx('المكتبة الرقمية غير مفعّلة حالياً.', 'Digital Library is currently disabled.')
                : tx('ليس لديك صلاحية الوصول إلى هذه الصفحة.', 'You do not have permission to access this page.')}
            </p>
            <Link
              to={portalUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B3B2E] text-[#F5ECD5] text-xs font-semibold"
            >
              {tx('العودة إلى بوابتي', 'Return to My Portal')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const uploadCover = async () => {
    if (!coverFile) return null;
    setCoverUploading(true);
    try {
      const extension = assertSafeImage(coverFile);
      const safeName = `${Date.now()}_${String(form.shamela_id || 'cover').replace(/[^a-z0-9_-]/gi, '')}.${extension}`;
      const storagePath = `book-covers/${safeName}`;
      const { error: uploadError } = await supabase.storage.from('covers').upload(storagePath, coverFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: coverFile.type,
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
    if (!(await appConfirm({ danger: true, message: `${tx('هل أنت متأكد من حذف هذا الكتاب؟', 'Delete this book from the catalog?')} ${book.title_ar}` }))) return;
    const { error } = await supabase.from('books').delete().eq('id', book.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.info(tx('تم حذف الكتاب.', 'Book removed from library catalog.'));
    loadBooks();
  };

  const navItems = [
    { id: 'catalog', label_en: 'Manuscripts Catalog', label_ar: 'فهرس المخطوطات والكتب', icon: 'menu_book', badge: stats.total },
    { id: 'add', label_en: 'Add / Edit Manuscript', label_ar: 'إضافة مخطوط أو كتاب', icon: 'library_add' },
    { id: 'loans', label_en: 'Circulation', label_ar: 'الإعارة', icon: 'swap_horiz' },
    { id: 'dictionary', label_en: 'Arabic–Tamil Dictionary', label_ar: 'القاموس العربي–التاميلي', icon: 'translate' },
    ...(auth.isEmployee && enabled('tasks') ? [{ id: 'tasks', label_en: 'Task Board', label_ar: 'لوحة المهام', icon: 'view_kanban' }] : []),
    ...(auth.isEmployee && enabled('self_service') ? [{ id: 'self', label_en: 'My Workspace', label_ar: 'مساحتي', icon: 'badge' }] : []),
    ...(enabled('messaging') ? [{ id: 'messages', label_en: 'Messages', label_ar: 'الرسائل', icon: 'forum' }] : []),
  ];

  return (
    <DashboardSidebarLayout
      title_en="Maktabah Custodian Console"
      title_ar="إدارة المكتبة والوثائق"
      roleBadge={{
        text_en: 'Librarian Custodian',
        text_ar: 'أمين المكتبة',
        color: ROLE_BADGE.emerald
      }}
      navItems={navItems}
      activeItem={activeTab}
      onSelect={setActiveTab}
      roleSwitcher={<RoleSwitcher compact />}
      topActions={
        <button
          type="button"
          onClick={() => exportToCSV(books)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E1D0] bg-white text-xs font-semibold text-[#0B3B2E] hover:bg-[#FBF8F0] shadow-xs"
        >
          <Icon name="download" className="text-[16px] text-[#11694A]" />
          <span className="hidden sm:inline">{tx('تصدير CSV', 'Export CSV')}</span>
        </button>
      }
    >
      <div className="space-y-8">
        {/* Background Watermark Anchor for Tests */}
        <div id="librarian-khatam" className="hidden" aria-hidden="true" />

        {/* Header Banner */}
        <OverviewBanner
          portal_en="Digital Maktabah Administration"
          portal_ar="أمين المكتبة الرقمية"
          greeting_en="Welcome, {name}"
          greeting_ar="مرحباً، {name}"
          hint_en="Catalog manuscripts, curate Islamic texts & integrate Google Drive preview manifests"
          hint_ar="فهرسة المخطوطات والكتب وربطها بروابط Google Drive للمطالعة والتحميل"
          actions={
            <Link
              to="/library"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-white border border-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors"
            >
              <Icon name="auto_stories" className="text-[16px] text-emerald-700" />
              {tx('عرض المكتبة للعامة', 'Public Library View')}
            </Link>
          }
        />

        {activeTab === 'dictionary' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <DictionaryAdmin />
          </div>
        )}

        {activeTab === 'loans' && <LibraryCirculationPanel books={books} />}

        {activeTab !== 'dictionary' && activeTab !== 'loans' && (
        <>
        {/* 3 KPI Stat Tiles */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat
            label={tx('إجمالي الكتب المفهرسة', 'Total Cataloged Books')}
            value={stats.total}
            hint={tx('فهرس المكتبة الرقمية', 'Digital catalog records')}
            icon="menu_book"
            tone="emerald"
          />
          <Stat
            label={tx('الكتب باللغة العربية', 'Arabic Folios')}
            value={stats.arabic}
            hint={tx('المؤلفات العربية', 'Arabic collection')}
            icon="translate"
            tone="blue"
          />
          <Stat
            label={tx('كتب ذات أغلفة مصورة', 'With Bound Covers')}
            value={stats.withCover}
            hint={tx('أغلفة جاهزة للعرض', 'Cover artwork linked')}
            icon="image"
            tone="amber"
          />
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
                <Icon name="auto_awesome" className="text-[16px] text-[#C29A3A]" />
                <span>{tx('إرشاد الاستيراد الفوري', 'Automated Batch Ingestion')}</span>
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
                        className="p-1 rounded-lg bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FCA5A5] flex items-center justify-center"
                        title={tx('حذف الكتاب', 'Delete book')}
                        aria-label={tx('حذف الكتاب', 'Delete book')}
                      >
                        <Icon name="delete" className="text-[15px]" />
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

        {activeTab === 'tasks' && (
          <div className="erp-theme rounded-2xl border border-[#E8E1D0] bg-white p-4 sm:p-6 shadow-sm">
            <Suspense fallback={<div className="py-12 text-center text-xs text-[#4A5E56]">{tx('جاري التحميل…', 'Loading…')}</div>}>
              <TaskBoard />
            </Suspense>
          </div>
        )}

        {activeTab === 'self' && (
          <div className="erp-theme rounded-2xl border border-[#E8E1D0] bg-white p-4 sm:p-6 shadow-sm">
            <Suspense fallback={<div className="py-12 text-center text-xs text-[#4A5E56]">{tx('جاري التحميل…', 'Loading…')}</div>}>
              <MySelfServicePanel />
            </Suspense>
          </div>
        )}

        {activeTab === 'messages' && (
          <Suspense fallback={<div className="py-12 text-center text-xs text-[#4A5E56]">{tx('جاري التحميل…', 'Loading…')}</div>}>
            <MessagesPanel embedded />
          </Suspense>
        )}

      </div>
    </DashboardSidebarLayout>
  );
};

function LibraryCirculationPanel({ books }) {
  const [loans, setLoans] = useState([]);
  const [bookId, setBookId] = useState('');
  const [borrowerId, setBorrowerId] = useState('');
  const [due, setDue] = useState('');

  const load = async () => {
    await supabase.rpc('mark_overdue_library_loans');
    const { data } = await supabase
      .from('library_loans')
      .select('*, books(title_ar, title_en), profiles:borrower_id(full_name)')
      .in('status', ['out', 'overdue'])
      .order('due_at', { ascending: true })
      .limit(100);
    setLoans(data || []);
  };

  useEffect(() => { load(); }, []);

  const checkout = async (e) => {
    e.preventDefault();
    const { error } = await supabase.rpc('checkout_library_book', {
      p_book: bookId,
      p_borrower: borrowerId,
      p_due: due || null,
      p_notes: null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(tx('تم الإعارة', 'Checked out'));
    setBookId('');
    setBorrowerId('');
    load();
  };

  const ret = async (id) => {
    const { error } = await supabase.rpc('return_library_book', { p_loan: id, p_notes: null });
    if (error) { toast.error(error.message); return; }
    toast.success(tx('تم الإرجاع', 'Returned'));
    load();
  };

  const renew = async (id) => {
    const { error } = await supabase.rpc('renew_library_loan', { p_loan: id, p_due: null });
    if (error) { toast.error(error.message); return; }
    toast.success(tx('تم التجديد', 'Renewed'));
    load();
  };

  const markLost = async (id) => {
    const reason = await appPrompt({ title: tx('تسجيل كتاب مفقود', 'Mark Book Lost'), message: tx('سبب الفقدان', 'Lost reason') });
    if (!reason?.trim()) return;
    const { error } = await supabase.rpc('mark_library_loan_lost', { p_loan: id, p_reason: reason.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success(tx('عُلّم مفقودًا', 'Marked lost'));
    load();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8E1D0] p-4 sm:p-6 space-y-4">
      <h2 className="font-serif font-bold text-[#0B3B2E] text-lg">{tx('إعارة وإرجاع', 'Checkout & return')}</h2>
      <form onSubmit={checkout} className="grid sm:grid-cols-4 gap-2 items-end">
        <label className="text-xs">
          {tx('الكتاب', 'Book')}
          <select className="w-full mt-1 border rounded-xl p-2 text-xs" value={bookId} onChange={(e) => setBookId(e.target.value)} required>
            <option value="">{tx('اختر…', 'Select…')}</option>
            {(books || []).map((b) => (
              <option key={b.id} value={b.id}>{b.title_ar || b.title_en || b.id}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          {tx('معرّف المستعير', 'Borrower UUID')}
          <input className="w-full mt-1 border rounded-xl p-2 text-xs" value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} required />
        </label>
        <label className="text-xs">
          {tx('الاستحقاق', 'Due')}
          <input type="date" className="w-full mt-1 border rounded-xl p-2 text-xs" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <button type="submit" className="px-3 py-2 rounded-xl bg-[#11694A] text-white text-xs font-bold">{tx('إعارة', 'Checkout')}</button>
      </form>
      <ul className="space-y-2 text-xs">
        {loans.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 border border-[#E8E1D0] rounded-xl p-2.5">
            <div>
              <div className="font-bold text-[#0B3B2E]">{l.books?.title_ar || l.books?.title_en || l.book_id}</div>
              <div className="text-[#4A5E56]">
                {l.profiles?.full_name || l.borrower_id} · {l.status}
                {' · '}{tx('الاستحقاق', 'due')} {l.due_at}
                {l.renew_count != null ? ` · ${tx('تجديدات', 'renewals')} ${l.renew_count}` : ''}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {l.status === 'out' && (
                <button type="button" className="text-[#0B3B2E] font-bold" onClick={() => renew(l.id)}>{tx('تجديد', 'Renew')}</button>
              )}
              <button type="button" className="text-[#11694A] font-bold" onClick={() => ret(l.id)}>{tx('إرجاع', 'Return')}</button>
              <button type="button" className="text-red-700 font-bold" onClick={() => markLost(l.id)}>{tx('مفقود', 'Lost')}</button>
            </div>
          </li>
        ))}
        {!loans.length && <li className="text-[#4A5E56]">{tx('لا إعارات مفتوحة', 'No open loans')}</li>}
      </ul>
    </div>
  );
}

export default LibrarianDashboard;
