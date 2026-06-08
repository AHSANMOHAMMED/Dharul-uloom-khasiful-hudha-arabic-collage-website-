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

const inputCls = 'w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 p-2.5 rounded focus:outline-none focus:border-emerald-600';

const AdminContentCMS = ({ section }) => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  if (section === 'news') return <NewsCMS ar={ar} />;
  if (section === 'faculty') return <FacultyCMS ar={ar} />;
  if (section === 'curriculum') return <CurriculumCMS ar={ar} />;
  if (section === 'gallery') return <GalleryCMS ar={ar} />;
  if (section === 'courses') return <CoursesCMS ar={ar} />;
  return null;
};

function NewsCMS({ ar }) {
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
      toast.success(ar ? 'تم الحفظ' : 'Saved');
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

  if (loading) return <p className="text-gray-500 text-sm">{ar ? 'جاري التحميل...' : 'Loading...'}</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <form onSubmit={save} className="space-y-3 bg-gray-950/40 p-6 rounded-xl border border-gray-800">
        <h3 className="text-lg font-bold text-white">{form.id ? (ar ? 'تعديل خبر' : 'Edit news') : (ar ? 'خبر جديد' : 'New article')}</h3>
        <input className={inputCls} placeholder="Title EN" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} required />
        <input className={inputCls} placeholder="Title AR" dir="rtl" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
        <textarea className={inputCls} rows={3} placeholder="Content EN" value={form.content_en} onChange={(e) => setForm({ ...form, content_en: e.target.value })} required />
        <textarea className={inputCls} rows={3} placeholder="Content AR" dir="rtl" value={form.content_ar} onChange={(e) => setForm({ ...form, content_ar: e.target.value })} />
        <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {['general', 'admissions', 'events', 'announcements'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="block text-xs text-gray-400">{ar ? 'صورة' : 'Image'}</label>
        <input type="file" accept="image/*" onChange={onImage} className="text-xs text-gray-400" />
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
          {ar ? 'منشور' : 'Published'}
        </label>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 py-2 bg-emerald-700 rounded text-white text-sm font-bold">{ar ? 'حفظ' : 'Save'}</button>
          {form.id && <button type="button" onClick={() => setForm(emptyNews())} className="px-4 py-2 bg-gray-800 rounded text-sm">{ar ? 'إلغاء' : 'Cancel'}</button>}
        </div>
      </form>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="p-4 bg-gray-950/40 border border-gray-800 rounded-lg flex justify-between gap-2">
            <div>
              <div className="font-semibold text-white">{item.title_en}</div>
              <div className="text-xs text-gray-500">{item.category} · {item.is_published ? 'live' : 'draft'}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={() => setForm({ ...item })} className="text-xs text-emerald-400">Edit</button>
              <button type="button" onClick={async () => { await adminDeleteNews(item.id); load(); }} className="text-xs text-red-400">Del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FacultyCMS({ ar }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyFaculty());
  const load = async () => setItems(await adminListFaculty());
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await adminUpsertFaculty({ ...form, qualifications: form.qualificationsText.split(',').map((s) => s.trim()).filter(Boolean) });
      toast.success('Saved');
      setForm(emptyFaculty());
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <form onSubmit={save} className="space-y-3 bg-gray-950/40 p-6 rounded-xl border border-gray-800">
        <h3 className="text-lg font-bold text-white">{ar ? 'عضو هيئة التدريس' : 'Faculty member'}</h3>
        <input className={inputCls} placeholder="Name EN" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} required />
        <input className={inputCls} placeholder="Name AR" dir="rtl" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
        <input className={inputCls} placeholder="Role EN" value={form.role_en} onChange={(e) => setForm({ ...form, role_en: e.target.value })} required />
        <input className={inputCls} placeholder="Role AR" dir="rtl" value={form.role_ar} onChange={(e) => setForm({ ...form, role_ar: e.target.value })} />
        <textarea className={inputCls} rows={2} placeholder="Bio EN" value={form.bio_en} onChange={(e) => setForm({ ...form, bio_en: e.target.value })} />
        <input className={inputCls} placeholder="Qualifications (comma-separated)" value={form.qualificationsText} onChange={(e) => setForm({ ...form, qualificationsText: e.target.value })} />
        <input type="number" className={inputCls} placeholder="Sort order" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
        <button type="submit" className="w-full py-2 bg-emerald-700 rounded text-white text-sm font-bold">{ar ? 'حفظ' : 'Save'}</button>
      </form>
      <div className="space-y-2">{items.map((item) => (
        <div key={item.id} className="p-4 bg-gray-950/40 border border-gray-800 rounded-lg flex justify-between">
          <span className="text-white">{item.name_en} — {item.role_en}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...item, qualificationsText: (item.qualifications || []).join(', ') })} className="text-xs text-emerald-400">Edit</button>
            <button type="button" onClick={async () => { await adminDeleteFaculty(item.id); load(); }} className="text-xs text-red-400">Del</button>
          </div>
        </div>
      ))}</div>
    </div>
  );
}

function CurriculumCMS({ ar }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id: null, class_number: 1, json: '{}' });
  const load = async () => setItems(await adminListCurriculum());
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(form.json);
      await adminUpsertCurriculum({ id: form.id, class_number: form.class_number, ...parsed });
      toast.success('Saved');
      load();
    } catch (err) {
      toast.error(err.message || 'Invalid JSON');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">{ar ? 'عدّل JSON للفصل (class_name, age_range, modules, objectives, assessment_methods)' : 'Edit class JSON (class_name, age_range, modules, objectives, assessment_methods)'}</p>
      <form onSubmit={save} className="space-y-3 bg-gray-950/40 p-6 rounded-xl border border-gray-800">
        <select className={inputCls} value={form.class_number} onChange={(e) => setForm({ ...form, class_number: parseInt(e.target.value) })}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>Class {n}</option>)}
        </select>
        <textarea className={`${inputCls} font-mono text-xs`} rows={12} value={form.json} onChange={(e) => setForm({ ...form, json: e.target.value })} />
        <button type="submit" className="py-2 px-6 bg-emerald-700 rounded text-white text-sm font-bold">{ar ? 'حفظ' : 'Save'}</button>
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
            className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300"
          >
            Class {item.class_number}
          </button>
        ))}
      </div>
    </div>
  );
}

function GalleryCMS({ ar }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyGallery());
  const load = async () => setItems(await adminListGallery());
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await adminUpsertGallery(form);
      toast.success('Saved');
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <form onSubmit={save} className="space-y-3 bg-gray-950/40 p-6 rounded-xl border border-gray-800">
        <input className={inputCls} placeholder="Title EN" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} required />
        <input className={inputCls} placeholder="Title AR" dir="rtl" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
        <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="facilities">facilities</option>
          <option value="events">events</option>
        </select>
        <input type="file" accept="image/*" onChange={onImage} className="text-xs text-gray-400" />
        {form.image_url && <img src={resolveGalleryUrl(form.image_url)} alt="" className="h-24 rounded object-cover" />}
        <button type="submit" className="w-full py-2 bg-emerald-700 rounded text-white text-sm font-bold">{ar ? 'حفظ' : 'Save'}</button>
      </form>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.id} className="p-3 bg-gray-950/40 border border-gray-800 rounded-lg">
            {item.image_url ? <img src={resolveGalleryUrl(item.image_url)} alt="" className="w-full h-24 object-cover rounded mb-2" /> : <div className="h-24 bg-gray-800 rounded mb-2 flex items-center justify-center text-gray-600 text-xs">No photo</div>}
            <div className="text-sm text-white truncate">{item.title_en}</div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setForm({ ...item })} className="text-xs text-emerald-400">Edit</button>
              <button type="button" onClick={async () => { await adminDeleteGallery(item.id); load(); }} className="text-xs text-red-400">Del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoursesCMS({ ar }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyCourse());
  const load = async () => setItems(await adminListCoursePrograms());
  useEffect(() => { load().catch((e) => toast.error(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await adminUpsertCourseProgram(form);
      toast.success('Saved');
      setForm(emptyCourse());
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <form onSubmit={save} className="space-y-3 bg-gray-950/40 p-6 rounded-xl border border-gray-800">
        <input className={inputCls} placeholder="slug (unique)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
        <input className={inputCls} placeholder="Title EN" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} required />
        <input className={inputCls} placeholder="Title AR" dir="rtl" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
        <input className={inputCls} placeholder="Duration EN" value={form.duration_en} onChange={(e) => setForm({ ...form, duration_en: e.target.value })} />
        <textarea className={inputCls} rows={3} placeholder="Description EN" value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} />
        <select className={inputCls} value={form.admission_code || ''} onChange={(e) => setForm({ ...form, admission_code: e.target.value || null })}>
          <option value="">— admission code —</option>
          {['quran', 'arabic', 'hadith', 'fiqh', 'islamic'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="w-full py-2 bg-emerald-700 rounded text-white text-sm font-bold">{ar ? 'حفظ' : 'Save'}</button>
      </form>
      <div className="space-y-2">{items.map((item) => (
        <div key={item.id} className="p-4 bg-gray-950/40 border border-gray-800 rounded-lg flex justify-between">
          <span className="text-white">{item.icon} {item.title_en}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...item })} className="text-xs text-emerald-400">Edit</button>
            <button type="button" onClick={async () => { await adminDeleteCourseProgram(item.id); load(); }} className="text-xs text-red-400">Del</button>
          </div>
        </div>
      ))}</div>
    </div>
  );
}

function emptyNews() {
  return { id: null, title_en: '', title_ar: '', content_en: '', content_ar: '', category: 'general', is_published: true, author: 'Admin', image: null };
}
function emptyFaculty() {
  return { id: null, name_en: '', name_ar: '', role_en: '', role_ar: '', bio_en: '', bio_ar: '', qualificationsText: '', sort_order: 0, image: null };
}
function emptyGallery() {
  return { id: null, title_en: '', title_ar: '', category: 'facilities', image_url: null, sort_order: 0, is_published: true };
}
function emptyCourse() {
  return { id: null, slug: '', title_en: '', title_ar: '', duration_en: '', duration_ar: '', description_en: '', description_ar: '', icon: '📚', admission_code: null, sort_order: 0, is_published: true };
}

export default AdminContentCMS;
