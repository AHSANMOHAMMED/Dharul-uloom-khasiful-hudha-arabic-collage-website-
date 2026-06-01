import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CATEGORIES = [
  'Fiqh (فقه)',
  'Hadith (حديث)',
  'Tafseer (تفسير)',
  'Aqeedah (عقيدة)',
  'Seerah (سيرة)',
  'Arabic Grammar (نحو)',
  'Morphology (صرف)',
  'Rhetoric (بلاغة)',
  'Logic (منطق)',
  'History (تاريخ)',
  'Other',
];

const LibrarianDashboard = () => {
  const { user, logout } = useAuth();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState('books');
  const [loading, setLoading] = useState(true);

  // Books list
  const [books, setBooks] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterPublished, setFilterPublished] = useState('all'); // 'all' | 'published' | 'draft'

  // Upload form
  const [uploadForm, setUploadForm] = useState({
    title: '', author: '', category: CATEGORIES[0], description: '', language: 'ar', shamela_id: '',
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Shamela import form
  const [shamelaId, setShamelaId] = useState('');
  const [shamelaImporting, setShamelaImporting] = useState(false);
  const [shamelaResult, setShamelaResult] = useState(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0, categories: 0 });

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('books').select('*').order('created_at', { ascending: false });
      if (filterCat !== 'all') query = query.eq('category', filterCat);
      if (filterPublished === 'published') query = query.eq('is_published', true);
      if (filterPublished === 'draft') query = query.eq('is_published', false);
      if (searchQ.trim()) query = query.ilike('title', `%${searchQ}%`);

      const { data, error } = await query;
      if (error) throw error;
      setBooks(data || []);

      // Compute stats from all books
      const { data: allBooks } = await supabase.from('books').select('is_published, category');
      const published = allBooks?.filter(b => b.is_published).length ?? 0;
      const cats = new Set(allBooks?.map(b => b.category).filter(Boolean)).size;
      setStats({ total: allBooks?.length ?? 0, published, drafts: (allBooks?.length ?? 0) - published, categories: cats });
    } catch (err) {
      toast.error('Failed to fetch books: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQ, filterCat, filterPublished]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  // Toggle publish status
  const handleTogglePublish = async (book) => {
    const { error } = await supabase.from('books').update({ is_published: !book.is_published }).eq('id', book.id);
    if (error) { toast.error(error.message); return; }
    toast.success(book.is_published ? 'Book unpublished' : 'Book published ✅');
    fetchBooks();
  };

  // Delete book
  const handleDeleteBook = async (book) => {
    if (!window.confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
    if (book.storage_path) {
      await supabase.storage.from('books').remove([book.storage_path]);
    }
    const { error } = await supabase.from('books').delete().eq('id', book.id);
    if (error) { toast.error(error.message); return; }
    toast.info('Book deleted');
    fetchBooks();
  };

  // Upload a new book
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.title.trim()) { toast.warning('Title is required'); return; }
    setUploading(true);
    setUploadProgress(0);

    try {
      let storagePath = null;

      if (uploadFile) {
        const fileExt = uploadFile.name.split('.').pop();
        const fileName = `${Date.now()}_${uploadForm.title.replace(/\s+/g, '_').slice(0, 30)}.${fileExt}`;
        storagePath = `books/${fileName}`;

        // Simulate progress (supabase-js v2 doesn't emit upload progress natively)
        setUploadProgress(30);

        const { error: storageErr } = await supabase.storage.from('books').upload(storagePath, uploadFile, {
          cacheControl: '3600',
          upsert: false,
        });
        if (storageErr) throw storageErr;
        setUploadProgress(70);
      }

      const { error: dbErr } = await supabase.from('books').insert({
        title: uploadForm.title.trim(),
        author: uploadForm.author.trim() || null,
        category: uploadForm.category,
        description: uploadForm.description.trim() || null,
        language: uploadForm.language,
        shamela_id: uploadForm.shamela_id ? parseInt(uploadForm.shamela_id) : null,
        storage_path: storagePath,
        is_published: false,
        uploaded_by: user.id,
      });
      if (dbErr) throw dbErr;

      setUploadProgress(100);
      toast.success('Book added! Set it to Published when ready.');
      setUploadForm({ title: '', author: '', category: CATEGORIES[0], description: '', language: 'ar', shamela_id: '' });
      setUploadFile(null);
      setUploadProgress(0);
      fetchBooks();
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Shamela import (placeholder — triggers backend script via Edge Function in production)
  const handleShamelaImport = async (e) => {
    e.preventDefault();
    if (!shamelaId.trim()) return;
    setShamelaImporting(true);
    setShamelaResult(null);
    try {
      // In production: call Edge Function that runs importShamela.mjs
      // For now: create a stub book record with the Shamela ID
      const { data, error } = await supabase.from('books').insert({
        title: `Shamela Book #${shamelaId}`,
        shamela_id: parseInt(shamelaId),
        language: 'ar',
        is_published: false,
        uploaded_by: user.id,
        category: 'Other',
        description: `Imported from Al-Shamela library. ID: ${shamelaId}. Please update title and category.`,
      }).select().single();
      if (error) throw error;
      setShamelaResult({ success: true, title: data.title, id: data.id });
      toast.success('Shamela book record created! Update the details then publish.');
      setShamelaId('');
      fetchBooks();
    } catch (err) {
      setShamelaResult({ success: false, error: err.message });
      toast.error('Import failed: ' + err.message);
    } finally {
      setShamelaImporting(false);
    }
  };

  const filteredBooks = books;

  const tabs = [
    { id: 'books',    label: ar ? 'المكتبة' : 'Book Inventory',   icon: '📚' },
    { id: 'upload',   label: ar ? 'رفع كتاب' : 'Upload Book',      icon: '⬆️' },
    { id: 'shamela',  label: ar ? 'استيراد شاملة' : 'Shamela Import', icon: '🕌' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[140px] pointer-events-none"></div>

      <ToastContainer position="top-right" theme="dark" />
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">

        {/* Header */}
        <div className="glass-panel p-8 rounded-[2rem] border border-purple-500/20 shadow-glass flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-purple-500/40 transition-all duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

          <div className="relative z-10 flex items-center gap-6">
            <div className="hidden sm:flex w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-900 items-center justify-center shadow-glow-purple">
              <span className="text-4xl text-white font-arabic">م</span>
            </div>
            <div>
              <span className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-glow-purple border border-purple-500/20">
                {ar ? 'بوابة أمين المكتبة' : 'Librarian Portal'}
              </span>
              <h1 className="mt-3 text-3xl font-extrabold font-arabic text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-purple-500">
                {ar ? `أهلاً، ${user?.username}` : `Welcome, ${user?.username}`}
              </h1>
              <p className="text-sm text-gray-400 mt-1 font-medium">
                {ar ? 'إدارة الكتب، الفهارس، والمحتوى الرقمي' : 'Manage books, catalogues & digital content'}
              </p>
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap gap-4">
            <Link to="/library" className="px-6 py-3 bg-gray-900/80 border border-gray-700 hover:bg-gray-800 text-gray-200 rounded-2xl text-sm font-bold transition-all shadow-lg hover:-translate-y-1 flex items-center gap-2">
              <span className="text-xl">👁</span> {ar ? 'معاينة المكتبة' : 'Preview Library'}
            </Link>
            <button onClick={logout} className="px-6 py-3 bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 rounded-2xl text-sm font-bold transition-all shadow-lg hover:-translate-y-1">
              {ar ? 'خروج' : 'Logout'}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: ar ? 'إجمالي الكتب' : 'Total Books', value: stats.total, icon: '📚', color: 'purple' },
            { label: ar ? 'منشورة' : 'Published', value: stats.published, icon: '✅', color: 'emerald' },
            { label: ar ? 'مسودات' : 'Drafts', value: stats.drafts, icon: '📝', color: 'amber' },
            { label: ar ? 'التصنيفات' : 'Categories', value: stats.categories, icon: '🏷️', color: 'blue' },
          ].map((s, i) => (
            <div key={i} className="glass-card rounded-3xl p-6 text-center space-y-3 group hover:border-gray-600 transition-all duration-300 hover:-translate-y-1">
              <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-3xl bg-${s.color}-500/10 text-${s.color}-400 border border-${s.color}-500/20 group-hover:scale-110 transition-transform duration-300`}>
                {s.icon}
              </div>
              <div className="text-2xl font-extrabold text-white font-mono tracking-tight">{s.value}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="glass-panel p-2 rounded-2xl flex overflow-x-auto gap-2 relative z-10 hide-scrollbar border border-gray-800/60 shadow-lg">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-glow-purple border-purple-400/20 text-white border'
                  : 'bg-transparent text-gray-400 hover:bg-gray-800/50 hover:text-white border border-transparent'
              }`}>
              <span className="text-lg">{tab.icon}</span> <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── BOOK INVENTORY TAB ──────────────────────────────────────── */}
        {activeTab === 'books' && (
          <div className="space-y-5">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder={ar ? 'بحث بالعنوان...' : 'Search by title...'}
                className="flex-1 min-w-[200px] bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="bg-gray-950 border border-gray-800 text-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                <option value="all">{ar ? 'كل التصنيفات' : 'All Categories'}</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterPublished} onChange={e => setFilterPublished(e.target.value)}
                className="bg-gray-950 border border-gray-800 text-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none">
                <option value="all">{ar ? 'الكل' : 'All Status'}</option>
                <option value="published">{ar ? 'منشور' : 'Published'}</option>
                <option value="draft">{ar ? 'مسودة' : 'Draft'}</option>
              </select>
            </div>

            {/* Books table */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 rounded-full border-t-2 border-purple-500"></div>
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-800 bg-gray-950/50">
                      <th className="py-3 px-4">{ar ? 'العنوان' : 'Title'}</th>
                      <th className="py-3 px-4 hidden md:table-cell">{ar ? 'المؤلف' : 'Author'}</th>
                      <th className="py-3 px-4 hidden lg:table-cell">{ar ? 'التصنيف' : 'Category'}</th>
                      <th className="py-3 px-4">{ar ? 'الحالة' : 'Status'}</th>
                      <th className="py-3 px-4">{ar ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {filteredBooks.map(book => (
                      <tr key={book.id} className="hover:bg-gray-900/40 transition group">
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{book.title}</div>
                          {book.shamela_id && <span className="text-[10px] text-gray-500 font-mono">Shamela #{book.shamela_id}</span>}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell text-gray-400">{book.author || '—'}</td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          {book.category ? (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{book.category}</span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            book.is_published ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {book.is_published ? (ar ? 'منشور' : 'Published') : (ar ? 'مسودة' : 'Draft')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button onClick={() => handleTogglePublish(book)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                                book.is_published
                                  ? 'bg-amber-800/40 text-amber-300 hover:bg-amber-700/50'
                                  : 'bg-emerald-800/40 text-emerald-300 hover:bg-emerald-700/50'
                              }`}>
                              {book.is_published ? (ar ? 'إلغاء النشر' : 'Unpublish') : (ar ? 'نشر' : 'Publish')}
                            </button>
                            {book.storage_path && (
                              <Link to={`/library/${book.id}`}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-800 text-gray-300 hover:text-white transition">
                                {ar ? 'عرض' : 'View'}
                              </Link>
                            )}
                            <button onClick={() => handleDeleteBook(book)}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-red-900/30 text-red-400 hover:bg-red-800/40 transition">
                              {ar ? 'حذف' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredBooks.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-500">
                          <div className="text-4xl mb-2">📭</div>
                          <p className="text-sm">{ar ? 'لا توجد كتب مطابقة' : 'No books found.'}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── UPLOAD BOOK TAB ─────────────────────────────────────────── */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 space-y-6">
              <h2 className="text-xl font-bold text-white">{ar ? 'رفع كتاب جديد' : 'Upload New Book'}</h2>
              <form onSubmit={handleUpload} className="space-y-5">
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-1.5">{ar ? 'عنوان الكتاب *' : 'Book Title *'}</label>
                  <input value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
                    required placeholder={ar ? 'مثال: متن الأجرومية' : 'e.g. Matn al-Ajurrumiyyah'}
                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-1.5">{ar ? 'المؤلف' : 'Author'}</label>
                  <input value={uploadForm.author} onChange={e => setUploadForm(f => ({ ...f, author: e.target.value }))}
                    placeholder={ar ? 'اسم المؤلف' : 'Author name'}
                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-1.5">{ar ? 'التصنيف' : 'Category'}</label>
                    <select value={uploadForm.category} onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full bg-gray-950 border border-gray-800 text-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-1.5">{ar ? 'اللغة' : 'Language'}</label>
                    <select value={uploadForm.language} onChange={e => setUploadForm(f => ({ ...f, language: e.target.value }))}
                      className="w-full bg-gray-950 border border-gray-800 text-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                      <option value="ar">Arabic (عربي)</option>
                      <option value="en">English</option>
                      <option value="ur">Urdu (اردو)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-1.5">{ar ? 'الوصف' : 'Description'}</label>
                  <textarea value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} rows={3}
                    placeholder={ar ? 'وصف مختصر للكتاب...' : 'Brief description of the book...'}
                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-1.5">{ar ? 'ملف الكتاب (PDF)' : 'Book File (PDF)'}</label>
                  <input type="file" accept=".pdf,.html,.txt"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-purple-700 file:text-white hover:file:bg-purple-600 file:cursor-pointer" />
                  <p className="text-xs text-gray-500 mt-1">{ar ? 'اختياري — يمكن الإضافة لاحقاً' : 'Optional — can be added later'}</p>
                </div>

                {uploading && uploadProgress > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{ar ? 'جار الرفع...' : 'Uploading...'}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={uploading}
                  className="w-full py-3 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-800 text-white font-bold rounded-xl text-sm transition">
                  {uploading ? (ar ? 'جار الرفع...' : 'Uploading...') : (ar ? 'إضافة الكتاب' : 'Add Book')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── SHAMELA IMPORT TAB ──────────────────────────────────────── */}
        {activeTab === 'shamela' && (
          <div className="max-w-xl space-y-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  🕌 {ar ? 'استيراد من مكتبة الشاملة' : 'Import from Al-Shamela Library'}
                </h2>
                <p className="text-sm text-gray-400 mt-2">
                  {ar
                    ? 'أدخل معرّف الكتاب من قاعدة بيانات الشاملة لاستيراده تلقائياً إلى مكتبتنا الرقمية.'
                    : 'Enter the Shamela Book ID to automatically import it into the digital library.'}
                </p>
              </div>

              <form onSubmit={handleShamelaImport} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-1.5">{ar ? 'معرّف كتاب الشاملة' : 'Shamela Book ID'}</label>
                  <input value={shamelaId} onChange={e => setShamelaId(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 12345"
                    className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-purple-500" />
                </div>
                <button type="submit" disabled={shamelaImporting || !shamelaId}
                  className="w-full py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-800 text-white font-bold rounded-xl text-sm transition">
                  {shamelaImporting ? (ar ? 'جار الاستيراد...' : 'Importing...') : (ar ? 'استيراد الكتاب' : 'Import Book')}
                </button>
              </form>

              {shamelaResult && (
                <div className={`p-4 rounded-xl border text-sm ${shamelaResult.success ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300' : 'bg-red-950/30 border-red-500/30 text-red-300'}`}>
                  {shamelaResult.success
                    ? `✅ ${ar ? 'تم إنشاء سجل الكتاب:' : 'Book record created:'} "${shamelaResult.title}". ${ar ? 'يرجى تحديث التفاصيل والنشر.' : 'Update details then publish.'}`
                    : `❌ ${shamelaResult.error}`}
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="bg-gray-900/30 border border-gray-800/50 rounded-2xl p-6 text-xs text-gray-500 space-y-2">
              <p className="font-bold text-gray-400">{ar ? 'معلومات مهمة' : 'Important Notes'}</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{ar ? 'يتطلب الاستيراد الكامل تشغيل سكريبت backend على الخادم.' : 'Full import requires the backend Shamela import script to run on the server.'}</li>
                <li>{ar ? 'يمكنك إدارة الكتب من خلال الأمر:' : 'You can also manage books via the CLI:'} <code className="bg-gray-900 px-1 rounded">npm run import:shamela</code></li>
                <li>{ar ? 'تأكد من التحقق من حقوق النشر قبل الإضافة.' : 'Ensure copyright compliance before publishing.'}</li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default LibrarianDashboard;
