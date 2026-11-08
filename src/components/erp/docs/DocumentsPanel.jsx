import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Button, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Table, Tabs, Textarea, useLang } from '../ui';
import { Checkbox } from '../campus/common';
import { query } from '../../../lib/erp/rpc';
import {
  DOC_KINDS, PAPER_STATUSES, assignExamPaper, createDocument, createLetterhead, deleteDocument, deleteLetterhead,
  letterheadUrl, listDocuments, listExamPapers, listLetterheads, updateLetterhead,
} from '../../../lib/erp/documentsApi';
import { docxToHtml } from '../../../lib/wordFiles';
import DocumentEditor from './DocumentEditor';
import A4Page from './A4Page';

/** ERP "Documents": library, exam papers and letterheads. Deep link: ?module=documents&doc=<id> */
export default function DocumentsPanel() {
  const auth = useAuth();
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const openId = params.get('doc');
  const tab = params.get('dtab') || 'library';

  const setTab = (id) => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('dtab', id);
    n.delete('doc');
    return n;
  });
  const open = (id) => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set('doc', id);
    return n;
  });
  const close = () => setParams((p) => {
    const n = new URLSearchParams(p);
    n.delete('doc');
    return n;
  });

  if (openId) return <DocumentEditor key={openId} docId={openId} onClose={close} />;

  const tabs = [
    { id: 'library', label: t('Library', 'المكتبة') },
    { id: 'papers', label: t('Exam papers', 'أوراق الامتحان') },
    ...(auth.isDocumentAdmin ? [{ id: 'letterheads', label: t('Letterheads', 'الترويسات') }] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('Documents', 'المستندات')}
        subtitle={t(
          'Letters, notices and exam papers on the college letterhead. Edit here, print to PDF, or download for Word.',
          'الرسائل والإعلانات وأوراق الامتحان على ترويسة الكلية. حرّر هنا واطبع PDF أو نزّل لملف Word.'
        )}
      />
      <Tabs tabs={tabs} active={tabs.some((x) => x.id === tab) ? tab : 'library'} onChange={setTab} />
      {tab === 'papers' ? <ExamPapersTab onOpen={open} /> : tab === 'letterheads' && auth.isDocumentAdmin ? <LetterheadsTab /> : <LibraryTab onOpen={open} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function LibraryTab({ onOpen }) {
  const { t } = useLang();
  const tt = (pair) => t(pair[0], pair[1]);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    setError(null);
    listDocuments({ search, kind }).then(setRows).catch(setError);
  }, [search, kind]);
  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const fromWord = async (file) => {
    if (!file) return;
    try {
      const html = await docxToHtml(file);
      const lhs = await listLetterheads().catch(() => []);
      const doc = await createDocument({
        title: file.name.replace(/\.docx$/i, ''),
        kind: 'letter',
        body_html: html,
        letterhead_id: lhs.find((l) => l.is_default)?.id || null,
      });
      onOpen(doc.id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="rounded-[14px] border border-sand-border bg-paper-white p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Field label={t('Search', 'بحث')}>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Title…', 'العنوان…')} />
          </Field>
        </div>
        <div className="w-48">
          <Field label={t('Type', 'النوع')}>
            <Select value={kind} onChange={(e) => setKind(e.target.value)} placeholder={t('All types', 'كل الأنواع')}
              options={[...DOC_KINDS, ['exam_paper', ['Exam paper', 'ورقة امتحان']]].map(([v, l]) => ({ value: v, label: tt(l) }))} />
          </Field>
        </div>
        <Button onClick={() => setCreating(true)}>
          <span className="material-symbols-outlined text-[16px] align-[-3px] me-1" aria-hidden>{'note_add'}</span>
          {t('New document', 'مستند جديد')}
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <span className="material-symbols-outlined text-[16px] align-[-3px] me-1" aria-hidden>{'upload_file'}</span>
          {t('Open Word file', 'فتح ملف Word')}
        </Button>
        <input ref={fileRef} type="file" accept=".docx" hidden onChange={(e) => fromWord(e.target.files?.[0])} />
      </div>
      <ErrorNote error={error} />
      {!rows && !error ? (
        <Loading />
      ) : (
        <Table
          rows={rows || []}
          empty={t('No documents yet. Create one or open a Word file.', 'لا توجد مستندات بعد. أنشئ مستنداً أو افتح ملف Word.')}
          columns={[
            {
              key: 'title',
              label: t('Title', 'العنوان'),
              render: (r) => (
                <button type="button" className="text-start font-semibold text-emerald-700 hover:underline" onClick={() => onOpen(r.id)}>
                  {r.title}
                </button>
              ),
            },
            { key: 'kind', label: t('Type', 'النوع'), render: (r) => tt((DOC_KINDS.find(([v]) => v === r.kind) || [null, r.kind === 'exam_paper' ? ['Exam paper', 'ورقة امتحان'] : [r.kind, r.kind]])[1]) },
            { key: 'ref_no', label: t('Ref.', 'المرجع') },
            { key: 'owner', label: t('Author', 'الكاتب'), render: (r) => r.profiles?.full_name || '—' },
            {
              key: 'status',
              label: t('Status', 'الحالة'),
              render: (r) => (r.locked ? <Badge tone="amber">{t('Locked', 'مقفل')}</Badge> : <Badge tone={r.status === 'final' ? 'green' : 'gray'}>{r.status}</Badge>),
            },
            { key: 'shared', label: t('Shared', 'مشارك'), render: (r) => (r.share_roles?.length ? r.share_roles.join(', ') : '—') },
            { key: 'updated_at', label: t('Updated', 'آخر تحديث'), render: (r) => new Date(r.updated_at).toLocaleString() },
            {
              key: 'actions',
              label: '',
              render: (r) =>
                r.kind !== 'exam_paper' && (
                  <DeleteButton
                    onConfirm={async () => {
                      try {
                        await deleteDocument(r.id);
                        load();
                      } catch (e) {
                        toast.error(e.message);
                      }
                    }}
                  />
                ),
            },
          ]}
        />
      )}
      <NewDocumentModal open={creating} onClose={() => setCreating(false)} onCreated={onOpen} />
    </section>
  );
}

function DeleteButton({ onConfirm }) {
  const { t } = useLang();
  return (
    <button
      type="button"
      aria-label={t('Delete', 'حذف')}
      className="text-feedback-danger hover:underline text-xs"
      onClick={() => window.confirm(t('Delete this document and its history?', 'حذف هذا المستند وسجله؟')) && onConfirm()}
    >
      {t('Delete', 'حذف')}
    </button>
  );
}

function NewDocumentModal({ open, onClose, onCreated }) {
  const { t } = useLang();
  const tt = (pair) => t(pair[0], pair[1]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('letter');
  const [letterheadId, setLetterheadId] = useState('');
  const [letterheads, setLetterheads] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    listLetterheads()
      .then((l) => {
        setLetterheads(l);
        setLetterheadId(l.find((x) => x.is_default)?.id || '');
      })
      .catch(() => setLetterheads([]));
  }, [open]);
  const create = async () => {
    if (!title.trim()) return toast.error(t('Enter a title', 'أدخل عنواناً'));
    setBusy(true);
    try {
      const d = await createDocument({ title: title.trim(), kind, letterhead_id: letterheadId || null, body_html: '<p><br></p>' });
      onClose();
      setTitle('');
      onCreated(d.id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('New document', 'مستند جديد')}
      footer={<Button onClick={create} disabled={busy}>{t('Create', 'إنشاء')}</Button>}
    >
      <Field label={t('Title', 'العنوان')}><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
      <Field label={t('Type', 'النوع')}>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} options={DOC_KINDS.map(([v, l]) => ({ value: v, label: tt(l) }))} />
      </Field>
      <Field label={t('Letterhead', 'الترويسة')}>
        <Select value={letterheadId} onChange={(e) => setLetterheadId(e.target.value)} placeholder={t('Plain paper', 'ورق عادي')}
          options={letterheads.map((l) => ({ value: l.id, label: l.name }))} />
      </Field>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function ExamPapersTab({ onOpen }) {
  const auth = useAuth();
  const { t } = useLang();
  const tt = (pair) => t(pair[0], pair[1]);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const load = useCallback(() => {
    setError(null);
    listExamPapers().then(setRows).catch(setError);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-[14px] border border-sand-border bg-paper-white p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-text-secondary max-w-2xl">
          {t(
            'Papers move from the examiner to the exam office and IT for formatting, then are approved and locked for printing. Only the examiner, the exam office and IT can open a paper before it is released, and every opening is logged.',
            'تنتقل الأوراق من الممتحن إلى مكتب الامتحانات وقسم التقنية للتنسيق، ثم تُعتمد وتُقفل للطباعة. لا يفتح الورقة قبل نشرها إلا الممتحن ومكتب الامتحانات والتقنية، ويُسجَّل كل فتح.'
          )}
        </p>
        {auth.isAcademicAdmin && <Button onClick={() => setAssigning(true)}>{t('Assign a paper', 'إسناد ورقة')}</Button>}
      </div>
      <ErrorNote error={error} />
      {!rows && !error ? (
        <Loading />
      ) : (
        <Table
          rows={rows || []}
          empty={t('No exam papers you can see.', 'لا توجد أوراق امتحان متاحة لك.')}
          columns={[
            { key: 'exam', label: t('Exam', 'الامتحان'), render: (r) => `${r.exams?.name || ''}${r.exams?.class_number ? ` · ${t('Class', 'الصف')} ${r.exams.class_number}` : ''}` },
            { key: 'subject', label: t('Subject', 'المادة'), render: (r) => r.subjects?.name_en || r.subjects?.code },
            { key: 'examiner', label: t('Examiner', 'الممتحن'), render: (r) => r.examiner?.full_name },
            { key: 'due_date', label: t('Due', 'الموعد') },
            {
              key: 'status',
              label: t('Status', 'الحالة'),
              render: (r) => <Badge tone={['approved', 'printed', 'released'].includes(r.status) ? 'green' : ['submitted', 'it_review'].includes(r.status) ? 'blue' : 'amber'}>{tt(PAPER_STATUSES[r.status] || [r.status, r.status])}</Badge>,
            },
            {
              key: 'open',
              label: '',
              render: (r) => (
                <Button variant="secondary" onClick={() => onOpen(r.document_id)}>
                  {r.examiner_id === auth.user?.id && ['assigned', 'drafting'].includes(r.status) ? t('Write paper', 'كتابة الورقة') : t('Open', 'فتح')}
                </Button>
              ),
            },
          ]}
        />
      )}
      {assigning && <AssignPaperModal onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); load(); }} />}
    </section>
  );
}

function AssignPaperModal({ onClose, onDone }) {
  const { t } = useLang();
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [staff, setStaff] = useState([]);
  const [letterheads, setLetterheads] = useState([]);
  const [form, setForm] = useState({ exam: '', subject: '', examiner: '', due: '', duration: '', totalMarks: '', instructions: '', letterhead: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    query('exams', (q) => q.select('id, name, class_number, status').neq('status', 'published').order('created_at', { ascending: false }).limit(200)).then(setExams).catch(() => {});
    query('profiles', (q) => q.select('id, full_name').in('account_type', ['tutor', 'staff']).eq('is_approved', true).order('full_name').limit(500)).then(setStaff).catch(() => {});
    listLetterheads().then((l) => {
      setLetterheads(l);
      setForm((f) => ({ ...f, letterhead: l.find((x) => x.is_default)?.id || '' }));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!form.exam) return setSubjects([]);
    query('exam_subjects', (q) => q.select('max_marks, subjects(id, code, name_en)').eq('exam_id', form.exam))
      .then((rows) => setSubjects(rows.map((r) => ({ ...r.subjects, max_marks: r.max_marks }))))
      .catch(() => setSubjects([]));
  }, [form.exam]);

  const submit = async () => {
    if (!form.exam || !form.subject || !form.examiner) return toast.error(t('Choose the exam, subject and examiner', 'اختر الامتحان والمادة والممتحن'));
    setBusy(true);
    try {
      await assignExamPaper(form);
      toast.success(t('Paper assigned; the examiner has been notified.', 'تم إسناد الورقة وإشعار الممتحن.'));
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={t('Assign an exam paper', 'إسناد ورقة امتحان')} footer={<Button onClick={submit} disabled={busy}>{t('Assign', 'إسناد')}</Button>}>
      <Field label={`${t('Exam', 'الامتحان')} *`}>
        <Select value={form.exam} onChange={(e) => setForm((f) => ({ ...f, exam: e.target.value, subject: '' }))} placeholder={t('Choose an exam', 'اختر امتحاناً')}
          options={exams.map((e) => ({ value: e.id, label: `${e.name}${e.class_number ? ` · ${t('Class', 'الصف')} ${e.class_number}` : ''}` }))} />
      </Field>
      <Field label={`${t('Subject', 'المادة')} *`} hint={form.exam && !subjects.length ? t('Add subjects to this exam first (Academics & Exams).', 'أضف المواد إلى هذا الامتحان أولاً.') : undefined}>
        <Select value={form.subject} onChange={(e) => {
          const s = subjects.find((x) => x.id === e.target.value);
          setForm((f) => ({ ...f, subject: e.target.value, totalMarks: f.totalMarks || (s?.max_marks ?? '') }));
        }} placeholder="—" options={subjects.map((s) => ({ value: s.id, label: `${s.code} · ${s.name_en}` }))} />
      </Field>
      <Field label={`${t('Examiner', 'الممتحن')} *`}>
        <Select value={form.examiner} onChange={set('examiner')} placeholder="—" options={staff.map((s) => ({ value: s.id, label: s.full_name }))} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t('Due date', 'تاريخ التسليم')}><Input type="date" value={form.due} onChange={set('due')} /></Field>
        <Field label={t('Minutes', 'الدقائق')}><Input type="number" min="1" value={form.duration} onChange={set('duration')} /></Field>
        <Field label={t('Total marks', 'الدرجة الكلية')}><Input type="number" min="1" value={form.totalMarks} onChange={set('totalMarks')} /></Field>
      </div>
      <Field label={t('Letterhead', 'الترويسة')}>
        <Select value={form.letterhead} onChange={set('letterhead')} placeholder={t('Plain paper', 'ورق عادي')} options={letterheads.map((l) => ({ value: l.id, label: l.name }))} />
      </Field>
      <Field label={t('Instructions to the examiner', 'تعليمات للممتحن')}><Textarea value={form.instructions} onChange={set('instructions')} /></Field>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function LetterheadsTab() {
  const auth = useAuth();
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState({});
  const [form, setForm] = useState({ name: '', file: null, top: 45, bottom: 30, left: 20, right: 20, orientation: 'portrait', isDefault: true });
  const [busy, setBusy] = useState(false);
  const [localUrl, setLocalUrl] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    listLetterheads()
      .then(async (l) => {
        setRows(l);
        const urls = {};
        await Promise.all(l.map(async (x) => { urls[x.id] = await letterheadUrl(x.storage_path).catch(() => null); }));
        setPreview(urls);
      })
      .catch(setError);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!form.file) return setLocalUrl(null);
    const u = URL.createObjectURL(form.file);
    setLocalUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [form.file]);

  const add = async () => {
    if (!form.name.trim()) return toast.error(t('Enter a name', 'أدخل اسماً'));
    setBusy(true);
    try {
      await createLetterhead({
        orgId: auth.user?.orgId,
        name: form.name.trim(),
        file: form.file,
        orientation: form.orientation,
        isDefault: form.isDefault,
        margins: { top: Number(form.top), bottom: Number(form.bottom), left: Number(form.left), right: Number(form.right) },
      });
      toast.success(t('Letterhead added', 'تمت إضافة الترويسة'));
      setForm((f) => ({ ...f, name: '', file: null }));
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const draft = { margin_top_mm: Number(form.top), margin_bottom_mm: Number(form.bottom), margin_left_mm: Number(form.left), margin_right_mm: Number(form.right), orientation: form.orientation };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-[14px] border border-sand-border bg-paper-white p-4 sm:p-5 space-y-3">
        <h3 className="font-serif font-semibold text-ink-green-900">{t('Add a letterhead', 'إضافة ترويسة')}</h3>
        <p className="text-xs text-ink-text-secondary">
          {t(
            'Upload your printed letterhead or paper design as an image of the whole A4 page (PNG or JPG, at least 1240×1754 px). If you have it as PDF or Word, export the page as an image first. Then set the margins so the text sits inside the empty area.',
            'ارفع الترويسة أو تصميم الورق كصورة لصفحة A4 كاملة (PNG أو JPG بدقة 1240×1754 على الأقل). إن كانت PDF أو Word فصدّر الصفحة كصورة أولاً، ثم اضبط الهوامش لتقع الكتابة في المساحة الفارغة.'
          )}
        </p>
        <Field label={t('Name', 'الاسم')}><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('Official letterhead', 'الترويسة الرسمية')} /></Field>
        <Field label={t('A4 image', 'صورة A4')}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
            className="block w-full text-sm file:me-3 file:rounded-[10px] file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:text-white file:font-semibold" />
        </Field>
        <div className="grid grid-cols-4 gap-2">
          {[['top', t('Top mm', 'أعلى مم')], ['bottom', t('Bottom mm', 'أسفل مم')], ['left', t('Left mm', 'يسار مم')], ['right', t('Right mm', 'يمين مم')]].map(([k, l]) => (
            <Field key={k} label={l}><Input type="number" min="0" max="150" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} /></Field>
          ))}
        </div>
        <Field label={t('Orientation', 'الاتجاه')}>
          <Select value={form.orientation} onChange={(e) => setForm((f) => ({ ...f, orientation: e.target.value }))}
            options={[{ value: 'portrait', label: t('Portrait', 'عمودي') }, { value: 'landscape', label: t('Landscape', 'أفقي') }]} />
        </Field>
        <Checkbox checked={form.isDefault} onChange={(v) => setForm((f) => ({ ...f, isDefault: v }))} label={t('Use as the default letterhead', 'استخدامها كترويسة افتراضية')} />
        <Button onClick={add} disabled={busy || !form.file}>{busy ? t('Uploading…', 'جارٍ الرفع…') : t('Add letterhead', 'إضافة الترويسة')}</Button>
      </section>

      <section className="rounded-[14px] bg-[#e9e6dd] p-4">
        <div className="text-xs text-ink-text-secondary mb-2">{t('Preview — the dashed box is where text will go', 'معاينة — المربع المتقطع هو مكان النص')}</div>
        <A4Page letterhead={draft} bgUrl={localUrl}>
          <div className="h-full min-h-[40vh] border-2 border-dashed border-emerald-700/60 rounded p-2 text-[11px] text-ink-text-muted">
            {t('Letter text appears here.', 'يظهر نص الرسالة هنا.')}
          </div>
        </A4Page>
      </section>

      <section className="lg:col-span-2 rounded-[14px] border border-sand-border bg-paper-white p-4 sm:p-5 space-y-3">
        <h3 className="font-serif font-semibold text-ink-green-900">{t('Letterheads', 'الترويسات')}</h3>
        <ErrorNote error={error} />
        {!rows ? <Loading /> : !rows.length ? <p className="text-sm text-ink-text-muted">{t('No letterheads yet.', 'لا توجد ترويسات بعد.')}</p> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((l) => (
              <div key={l.id} className="space-y-2">
                <A4Page letterhead={l} bgUrl={preview[l.id]}><div /></A4Page>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-ink-green-900 truncate">{l.name}</span>
                  {l.is_default ? <Badge tone="green">{t('Default', 'افتراضية')}</Badge> : (
                    <button type="button" className="text-xs text-emerald-700 hover:underline" onClick={() => updateLetterhead(l.id, { is_default: true }).then(load).catch((e) => toast.error(e.message))}>
                      {t('Make default', 'جعلها افتراضية')}
                    </button>
                  )}
                </div>
                <button type="button" className="text-xs text-feedback-danger hover:underline"
                  onClick={() => window.confirm(t('Delete this letterhead? Documents using it will print on plain paper.', 'حذف هذه الترويسة؟ ستُطبع المستندات المرتبطة بها على ورق عادي.')) && deleteLetterhead(l).then(load).catch((e) => toast.error(e.message))}>
                  {t('Delete', 'حذف')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
