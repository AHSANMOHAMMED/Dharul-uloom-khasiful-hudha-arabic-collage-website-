import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  adminListNews,
  adminUpsertNews,
  adminDeleteNews,
  adminListFaculty,
  adminUpsertFaculty,
  adminDeleteFaculty,
  adminListCurriculum,
  adminUpsertCurriculum,
  adminListGallery,
  adminUpsertGallery,
  adminDeleteGallery,
  adminListCoursePrograms,
  adminUpsertCourseProgram,
  adminDeleteCourseProgram,
  uploadContentImage,
  uploadGalleryImage,
  resolveGalleryUrl,
} from '../lib/contentApi';
import { tx } from '../lib/tx';

const inputCls = 'w-full bg-white border border-[#E8E1D0] text-xs sm:text-sm text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#11694A]';

const AdminContentCMS = ({ section }) => {
  useTranslation(); // re-render on language change

  if (section === 'news') return <NewsCMS />;
  if (section === 'faculty') return <FacultyCMS />;
  if (section === 'curriculum') return <CurriculumCMS />;
  if (section === 'gallery') return <GalleryCMS />;
  if (section === 'courses') return <CoursesCMS />;
  return null;
};

function NewsCMS() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyNews());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await adminListNews());
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await adminUpsertNews(form);
      toast.success(tx('تم الحفظ', 'Saved'));
      setForm(emptyNews());
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const path = await uploadContentImage(file, 'news');
      setForm((f) => ({ ...f, image: path }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <p className="text-[#4A5E56] text-xs py-4">{tx('جاري التحميل...', 'Loading news...')}</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={save} className="space-y-3 bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0]">
        <h3 className="text-base font-serif font-bold text-[#0B3B2E]">{form.id ? (tx('تعديل مقال', 'Edit News Article')) : (tx('مقال إخباري جديد', 'New News Article'))}</h3>
        <input className={inputCls} placeholder={tx('العنوان (إنجليزي)', 'Title EN')} value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} required />
        <input className={inputCls} placeholder={tx('العنوان (عربي)', 'Title AR')} dir="rtl" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
        <input className={inputCls} placeholder={tx('العنوان (تاميلي)', 'Title TA')} lang="ta" value={form.title_ta} onChange={(e) => setForm({ ...form, title_ta: e.target.value })} />
        <textarea className={inputCls} rows={3} placeholder={tx('المحتوى (إنجليزي)', 'Content EN')} value={form.content_en} onChange={(e) => setForm({ ...form, content_en: e.target.value })} required />
        <textarea className={inputCls} rows={3} placeholder={tx('المحتوى (عربي)', 'Content AR')} dir="rtl" value={form.content_ar} onChange={(e) => setForm({ ...form, content_ar: e.target.value })} />
        <textarea className={inputCls} rows={3} placeholder={tx('المحتوى (تاميلي)', 'Content TA')} lang="ta" value={form.content_ta} onChange={(e) => setForm({ ...form, content_ta: e.target.value })} />
        <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {['general', 'admissions', 'events', 'announcements'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="block text-[11px] text-[#4A5E56] font-bold uppercase">{tx('صورة المقال', 'Article Image')}</label>
        <input type="file" accept="image/*" onChange={onImage} className="text-xs text-[#4A5E56]" />
        <label className="flex items-center gap-2 text-xs text-[#0B3B2E] font-medium cursor-pointer">
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
          {tx('منشور للعامة', 'Published on public portal')}
        </label>
        <div className="flex gap-2 pt-1">
          <button type="submit" className="flex-1 py-2 bg-[#11694A] hover:bg-[#0B3B2E] rounded-xl text-white text-xs font-bold transition">{tx('حفظ', 'Save Article')}</button>
          {form.id && <button type="button" onClick={() => setForm(emptyNews())} className="px-4 py-2 bg-white border border-[#E8E1D0] rounded-xl text-xs">{tx('إلغاء', 'Cancel')}</button>}
        </div>
      </form>
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="p-3 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl flex justify-between gap-2">
            <div>
              <div className="font-bold text-[#0B3B2E] text-xs sm:text-sm">{item.title_en}</div>
              <div className="text-[10px] text-[#4A5E56] mt-0.5">{item.category} · <span className={item.is_published ? 'text-[#11694A] font-bold' : 'text-[#C29A3A]'}>{item.is_published ? tx('منشور', 'Published') : tx('مسودة', 'Draft')}</span></div>
            </div>
            <div className="flex gap-2 shrink-0 items-center">
              <button type="button" onClick={() => setForm({ ...item })} className="text-xs font-bold text-[#11694A] hover:underline">{tx('تعديل', 'Edit')}</button>
              <button type="button" onClick={async () => { await adminDeleteNews(item.id); load(); }} className="text-xs font-bold text-[#B91C1C] hover:underline">{tx('حذف', 'Del')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FacultyCMS() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyFaculty());
  const load = async () => setItems(await adminListFaculty());
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await adminUpsertFaculty({ ...form, qualifications: form.qualificationsText.split(',').map((s) => s.trim()).filter(Boolean) });
      toast.success(tx('تم الحفظ', 'Saved'));
      setForm(emptyFaculty());
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={save} className="space-y-3 bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0]">
        <h3 className="text-base font-serif font-bold text-[#0B3B2E]">{tx('عضو هيئة التدريس', 'Faculty Member Profile')}</h3>
        <input className={inputCls} placeholder={tx('الاسم (إنجليزي)', 'Name EN')} value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} required />
        <input className={inputCls} placeholder={tx('الاسم (عربي)', 'Name AR')} dir="rtl" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
        <input className={inputCls} placeholder={tx('الاسم (تاميلي)', 'Name TA')} lang="ta" value={form.name_ta} onChange={(e) => setForm({ ...form, name_ta: e.target.value })} />
        <input className={inputCls} placeholder={tx('الدور (إنجليزي)', 'Role EN')} value={form.role_en} onChange={(e) => setForm({ ...form, role_en: e.target.value })} required />
        <input className={inputCls} placeholder={tx('الدور (عربي)', 'Role AR')} dir="rtl" value={form.role_ar} onChange={(e) => setForm({ ...form, role_ar: e.target.value })} />
        <input className={inputCls} placeholder={tx('الدور (تاميلي)', 'Role TA')} lang="ta" value={form.role_ta} onChange={(e) => setForm({ ...form, role_ta: e.target.value })} />
        <textarea className={inputCls} rows={2} placeholder={tx('نبذة (إنجليزي)', 'Bio EN')} value={form.bio_en} onChange={(e) => setForm({ ...form, bio_en: e.target.value })} />
        <input className={inputCls} placeholder={tx('المؤهلات (مفصولة بفواصل)', 'Qualifications (comma-separated)')} value={form.qualificationsText} onChange={(e) => setForm({ ...form, qualificationsText: e.target.value })} />
        <input type="number" className={inputCls} placeholder={tx('ترتيب العرض', 'Sort order')} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
        <button type="submit" className="w-full py-2 bg-[#11694A] hover:bg-[#0B3B2E] rounded-xl text-white text-xs font-bold transition">{tx('حفظ', 'Save Member')}</button>
      </form>
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="p-3 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl flex justify-between items-center">
            <div>
              <span className="font-bold text-[#0B3B2E] text-xs sm:text-sm">{item.name_en}</span>
              <span className="text-[11px] text-[#4A5E56] block">{item.role_en}</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setForm({ ...item, qualificationsText: (item.qualifications || []).join(', ') })} className="text-xs font-bold text-[#11694A] hover:underline">{tx('تعديل', 'Edit')}</button>
              <button type="button" onClick={async () => { await adminDeleteFaculty(item.id); load(); }} className="text-xs font-bold text-[#B91C1C] hover:underline">{tx('حذف', 'Del')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CurriculumCMS() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id: null, class_number: 1, json: '{}' });
  const load = async () => setItems(await adminListCurriculum());
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(form.json);
      await adminUpsertCurriculum({ id: form.id, class_number: form.class_number, ...parsed });
      toast.success(tx('تم الحفظ', 'Saved'));
      load();
    } catch (err) {
      toast.error(err.message || tx('JSON غير صالح', 'Invalid JSON'));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#4A5E56]">{tx('عدّل JSON للمنهج (class_name, age_range, modules, objectives)', 'Configure structured class curriculum JSON definitions')}</p>
      <form onSubmit={save} className="space-y-3 bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0]">
        <select className={inputCls} value={form.class_number} onChange={(e) => setForm({ ...form, class_number: parseInt(e.target.value) })}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{tx('الفصل {n}', 'Class {n}').replace('{n}', n)}</option>)}
        </select>
        <textarea className={`${inputCls} font-mono text-xs`} rows={10} value={form.json} onChange={(e) => setForm({ ...form, json: e.target.value })} />
        <button type="submit" className="py-2 px-6 bg-[#11694A] hover:bg-[#0B3B2E] rounded-xl text-white text-xs font-bold transition">{tx('حفظ المنهج', 'Save Curriculum')}</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setForm({
              id: item.id,
              class_number: item.class_number,
              json: JSON.stringify({
                class_name: item.class_name,
                age_range: item.age_range,
                modules: item.modules,
                objectives: item.objectives,
                assessment_methods: item.assessment_methods,
              }, null, 2),
            })}
            className="px-3 py-1.5 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl text-xs font-bold text-[#0B3B2E] hover:bg-white"
          >
            {tx('الفصل {n}', 'Class {n}').replace('{n}', item.class_number)}
          </button>
        ))}
      </div>
    </div>
  );
}

function GalleryCMS() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyGallery());
  const load = async () => setItems(await adminListGallery());
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await adminUpsertGallery(form);
      toast.success(tx('تم الحفظ', 'Saved'));
      setForm(emptyGallery());
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const path = await uploadGalleryImage(file);
      setForm((f) => ({ ...f, image_url: path }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={save} className="space-y-3 bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0]">
        <h3 className="text-base font-serif font-bold text-[#0B3B2E]">{tx('إضافة صورة للمعرض', 'Add Gallery Photograph')}</h3>
        <input className={inputCls} placeholder={tx('العنوان (إنجليزي)', 'Title EN')} value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} required />
        <input className={inputCls} placeholder={tx('العنوان (عربي)', 'Title AR')} dir="rtl" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
        <input className={inputCls} placeholder={tx('العنوان (تاميلي)', 'Title TA')} lang="ta" value={form.title_ta} onChange={(e) => setForm({ ...form, title_ta: e.target.value })} />
        <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="facilities">{tx('المرافق', 'facilities')}</option>
          <option value="events">{tx('الفعاليات', 'events')}</option>
        </select>
        <input type="file" accept="image/*" onChange={onImage} className="text-xs text-[#4A5E56]" />
        {form.image_url && <img src={resolveGalleryUrl(form.image_url)} alt="" className="h-20 rounded-xl object-cover border border-[#E8E1D0]" />}
        <button type="submit" className="w-full py-2 bg-[#11694A] hover:bg-[#0B3B2E] rounded-xl text-white text-xs font-bold transition">{tx('حفظ الصورة', 'Save Photo')}</button>
      </form>
      <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="p-2.5 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl">
            {item.image_url ? (
              <img src={resolveGalleryUrl(item.image_url)} alt="" className="w-full h-24 object-cover rounded-lg mb-1.5" />
            ) : (
              <div className="h-24 bg-white rounded-lg mb-1.5 flex items-center justify-center text-[#4A5E56] text-[10px]">{tx('لا توجد صورة', 'No photo')}</div>
            )}
            <div className="text-xs font-bold text-[#0B3B2E] truncate">{item.title_en}</div>
            <div className="flex gap-2 mt-1.5">
              <button type="button" onClick={() => setForm({ ...item })} className="text-[11px] font-bold text-[#11694A] hover:underline">{tx('تعديل', 'Edit')}</button>
              <button type="button" onClick={async () => { await adminDeleteGallery(item.id); load(); }} className="text-[11px] font-bold text-[#B91C1C] hover:underline">{tx('حذف', 'Del')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoursesCMS() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyCourse());
  const load = async () => setItems(await adminListCoursePrograms());
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await adminUpsertCourseProgram(form);
      toast.success(tx('تم الحفظ', 'Saved'));
      setForm(emptyCourse());
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={save} className="space-y-3 bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0]">
        <h3 className="text-base font-serif font-bold text-[#0B3B2E]">{tx('إدارة البرامج الدراسية', 'Course Program Configuration')}</h3>
        <input className={inputCls} placeholder={tx('المعرّف slug (فريد)', 'slug (unique)')} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
        <input className={inputCls} placeholder={tx('العنوان (إنجليزي)', 'Title EN')} value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} required />
        <input className={inputCls} placeholder={tx('العنوان (عربي)', 'Title AR')} dir="rtl" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
        <input className={inputCls} placeholder={tx('العنوان (تاميلي)', 'Title TA')} lang="ta" value={form.title_ta} onChange={(e) => setForm({ ...form, title_ta: e.target.value })} />
        <input className={inputCls} placeholder={tx('المدة (إنجليزي)', 'Duration EN')} value={form.duration_en} onChange={(e) => setForm({ ...form, duration_en: e.target.value })} />
        <textarea className={inputCls} rows={2} placeholder={tx('الوصف (إنجليزي)', 'Description EN')} value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} />
        <select className={inputCls} value={form.admission_code || ''} onChange={(e) => setForm({ ...form, admission_code: e.target.value || null })}>
          <option value="">{tx('— رمز القبول —', '— admission code —')}</option>
          {['quran', 'arabic', 'hadith', 'fiqh', 'islamic'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="w-full py-2 bg-[#11694A] hover:bg-[#0B3B2E] rounded-xl text-white text-xs font-bold transition">{tx('حفظ البرنامج', 'Save Course')}</button>
      </form>
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="p-3 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl flex justify-between items-center">
            <span className="font-bold text-[#0B3B2E] text-xs sm:text-sm">{item.title_en}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...item })} className="text-xs font-bold text-[#11694A] hover:underline">{tx('تعديل', 'Edit')}</button>
              <button type="button" onClick={async () => { await adminDeleteCourseProgram(item.id); load(); }} className="text-xs font-bold text-[#B91C1C] hover:underline">{tx('حذف', 'Del')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function emptyNews() {
  return { id: null, title_en: '', title_ar: '', title_ta: '', content_en: '', content_ar: '', content_ta: '', category: 'general', is_published: true, author: 'Admin', image: null };
}
function emptyFaculty() {
  return { id: null, name_en: '', name_ar: '', name_ta: '', role_en: '', role_ar: '', role_ta: '', bio_en: '', bio_ar: '', bio_ta: '', qualificationsText: '', sort_order: 0, image: null };
}
function emptyGallery() {
  return { id: null, title_en: '', title_ar: '', title_ta: '', category: 'facilities', image_url: null, sort_order: 0, is_published: true };
}
function emptyCourse() {
  return { id: null, slug: '', title_en: '', title_ar: '', title_ta: '', duration_en: '', duration_ar: '', duration_ta: '', description_en: '', description_ar: '', description_ta: '', icon: 'menu_book', admission_code: null, sort_order: 0, is_published: true };
}

export default AdminContentCMS;
