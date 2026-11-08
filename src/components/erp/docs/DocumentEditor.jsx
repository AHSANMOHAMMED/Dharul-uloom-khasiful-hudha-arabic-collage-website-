import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Button, ErrorNote, Field, Input, Loading, Select, useLang } from '../ui';
import { ChipMultiSelect, Checkbox } from '../campus/common';
import { STAFF_ROLES, toOptions } from '../../../lib/erp/campusApi';
import {
  DOC_KINDS, PAPER_STATUSES, letterheadUrl, listLetterheads, listVersions, openDocument, paperEvents, paperForDocument,
  paperTransition, sanitizeHtml, saveDocument,
} from '../../../lib/erp/documentsApi';
import { rpcJson } from '../../../lib/erp/reportsApi';
import { docxToHtml, htmlToDocxBlob, safeFilename, downloadBlob, shareOrDownload } from '../../../lib/wordFiles';
import { printDocument } from '../../../lib/printReport';
import A4Page from './A4Page';

const MAX_IMAGE_BYTES = 1024 * 1024;

/** Rich-text editor on an A4 letterhead, with sharing, versions and the exam-paper workflow. */
export default function DocumentEditor({ docId, onClose }) {
  const auth = useAuth();
  const { t, lang } = useLang();
  const tt = (pair) => t(pair[0], pair[1]);
  const editorRef = useRef(null);
  const importRef = useRef(null);
  const imageRef = useRef(null);

  const [doc, setDoc] = useState(null);
  const [paper, setPaper] = useState(null);
  const [events, setEvents] = useState([]);
  const [letterheads, setLetterheads] = useState([]);
  const [bgUrl, setBgUrl] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [versions, setVersions] = useState(null);

  const isPaper = doc?.kind === 'exam_paper';
  const letterhead = letterheads.find((l) => l.id === doc?.letterhead_id) || null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, lhs, editable] = await Promise.all([
        openDocument(docId, 'viewed'),
        listLetterheads().catch(() => []),
        rpcJson('can_edit_document', { p_doc: docId }).catch(() => false),
      ]);
      setDoc(d);
      setLetterheads(lhs);
      setCanEdit(Boolean(editable));
      setDirty(false);
      if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(d.body_html);
      if (d.kind === 'exam_paper') {
        const p = await paperForDocument(docId);
        setPaper(p);
        if (p) setEvents(await paperEvents(p.id).catch(() => []));
      }
    } catch (e) {
      setError(e);
    }
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  // Fill the editor once its element exists (first render after loading).
  // Later reloads set it in load(); re-applying on every save would move the caret.
  useEffect(() => {
    if (doc && editorRef.current) editorRef.current.innerHTML = sanitizeHtml(doc.body_html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  useEffect(() => {
    let live = true;
    if (letterhead?.storage_path) {
      letterheadUrl(letterhead.storage_path)
        .then((u) => live && setBgUrl(u))
        .catch(() => live && setBgUrl(null));
    } else {
      setBgUrl(null);
    }
    return () => {
      live = false;
    };
  }, [letterhead?.storage_path]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!doc || !canEdit) return;
    setBusy(true);
    try {
      const patch = { body_html: editorRef.current?.innerHTML || '', title: doc.title, letterhead_id: doc.letterhead_id };
      if (!isPaper) Object.assign(patch, { kind: doc.kind, status: doc.status, share_roles: doc.share_roles, share_users: doc.share_users });
      const res = await saveDocument(doc.id, patch);
      setDoc((d) => ({ ...d, ...patch, version: res.version, updated_at: res.updated_at }));
      setDirty(false);
      setVersions(null);
      toast.success(t('Saved', 'تم الحفظ'));
      if (isPaper && paper?.status === 'assigned') setPaper((p) => ({ ...p, status: 'drafting' }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }, [doc, canEdit, isPaper, paper?.status, t]);

  // Ctrl/Cmd + S
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [save]);

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorNote error={error} />
        <Button variant="secondary" onClick={onClose}>{t('Back to documents', 'العودة إلى المستندات')}</Button>
      </div>
    );
  }
  if (!doc) return <Loading />;

  const exec = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    setDirty(true);
  };
  const toggleDir = () => {
    const sel = window.getSelection();
    let node = sel?.anchorNode;
    while (node && node !== editorRef.current && !(node.nodeType === 1 && /^(P|DIV|H\d|LI|TD|BLOCKQUOTE)$/.test(node.tagName))) node = node.parentNode;
    const target = node && node !== editorRef.current ? node : editorRef.current;
    target.setAttribute('dir', target.getAttribute('dir') === 'rtl' ? 'ltr' : 'rtl');
    setDirty(true);
  };
  const insertTable = () => {
    const rows = Number(window.prompt(t('Rows', 'الصفوف'), '3')) || 0;
    const cols = Number(window.prompt(t('Columns', 'الأعمدة'), '3')) || 0;
    if (rows < 1 || cols < 1 || rows > 50 || cols > 12) return;
    const cells = '<td>&nbsp;</td>'.repeat(cols);
    exec('insertHTML', `<table style="width:100%;border-collapse:collapse"><tbody>${`<tr>${cells}</tr>`.repeat(rows)}</tbody></table><p><br></p>`);
  };
  const onImage = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) return toast.error(t('Choose a PNG, JPG, GIF or WEBP image', 'اختر صورة PNG أو JPG أو GIF أو WEBP'));
    if (file.size > MAX_IMAGE_BYTES) return toast.error(t('Images must be smaller than 1 MB', 'يجب أن تكون الصورة أصغر من 1 ميغابايت'));
    const reader = new FileReader();
    reader.onload = () => exec('insertHTML', `<img src="${reader.result}" alt="" style="max-width:100%">`);
    reader.readAsDataURL(file);
  };
  const onPaste = (e) => {
    // Keep pasted content clean (Word/web formatting, scripts, hot-linked images).
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html));
    else document.execCommand('insertText', false, text);
    setDirty(true);
  };
  const importDocx = async (file) => {
    if (!file) return;
    try {
      const html = await docxToHtml(file);
      if (editorRef.current.innerText.trim() && !window.confirm(t('Replace the current content with the Word file?', 'استبدال المحتوى الحالي بملف Word؟'))) return;
      editorRef.current.innerHTML = html;
      setDirty(true);
      toast.info(t('Word file imported. Check the layout, then save.', 'تم استيراد ملف Word. راجع التنسيق ثم احفظ.'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const status = paper?.status;
  const isExaminer = paper?.examiner_id === auth.user?.id;
  const paperExportAllowed =
    !isPaper || auth.isAcademicAdmin || isExaminer || (auth.isItOfficer && ['it_review', 'approved', 'printed', 'released'].includes(status));
  const shareAllowed = !isPaper || status === 'released';
  const watermark = isPaper && status !== 'released' ? (['approved', 'printed'].includes(status) ? t('CONFIDENTIAL', 'سري') : t('DRAFT — CONFIDENTIAL', 'مسودة — سري')) : '';

  const currentHtml = () => sanitizeHtml(editorRef.current?.innerHTML || doc.body_html);
  const lhForExport = async () => (letterhead ? { ...letterhead, url: letterhead.storage_path ? await letterheadUrl(letterhead.storage_path) : null } : null);

  const doPrint = async () => {
    try {
      await openDocument(doc.id, 'printed');
      printDocument({ title: doc.title, html: currentHtml(), letterhead: await lhForExport(), dir: document.documentElement.dir || 'ltr', lang, watermark });
    } catch (e) {
      toast.error(e.message);
    }
  };
  const doWord = async (share) => {
    try {
      await openDocument(doc.id, share ? 'shared' : 'downloaded');
      const blob = await htmlToDocxBlob({ title: doc.title, html: currentHtml(), letterhead: await lhForExport() });
      const name = safeFilename(doc.title, 'docx');
      if (share) await shareOrDownload(blob, name, doc.title);
      else downloadBlob(blob, name);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const copyLink = async () => {
    const url = `${window.location.origin}/erp?module=documents&doc=${doc.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('Link copied. Only people with access can open it.', 'تم نسخ الرابط. لا يفتحه إلا من لديه صلاحية.'));
    } catch {
      window.prompt(t('Copy this link', 'انسخ هذا الرابط'), url);
    }
  };

  const transition = async (action, needsNote) => {
    let note = null;
    if (needsNote) {
      note = window.prompt(action === 'return' ? t('What should the examiner change?', 'ما الذي يجب على الممتحن تغييره؟') : t('Reason', 'السبب'));
      if (!note) return;
    }
    if (dirty && canEdit) await save();
    setBusy(true);
    try {
      await paperTransition(paper.id, action, note);
      toast.success(t('Updated', 'تم التحديث'));
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const setMeta = (patch) => {
    setDoc((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const tool = (icon, label, onClick) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      disabled={!canEdit}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-ink-green-900 hover:bg-mint-wash-100 disabled:opacity-40"
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden>{icon}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => (!dirty || window.confirm(t('Discard unsaved changes?', 'تجاهل التغييرات غير المحفوظة؟'))) && onClose()}>
          <span className="material-symbols-outlined text-[16px] align-[-3px] me-1" aria-hidden>{'arrow_back'}</span>
          {t('Documents', 'المستندات')}
        </Button>
        <div className="flex-1 min-w-[200px]">
          <Input
            value={doc.title}
            onChange={(e) => setMeta({ title: e.target.value })}
            disabled={!canEdit}
            aria-label={t('Title', 'العنوان')}
          />
        </div>
        {doc.ref_no && <Badge>{doc.ref_no}</Badge>}
        <Badge tone={doc.locked ? 'amber' : 'gray'}>
          {doc.locked ? t('Locked', 'مقفل') : `v${doc.version}`}
        </Badge>
        {dirty && <Badge tone="amber">{t('Unsaved', 'غير محفوظ')}</Badge>}
        {canEdit && (
          <Button onClick={save} disabled={busy || !dirty}>
            {busy ? t('Saving…', 'جارٍ الحفظ…') : t('Save', 'حفظ')}
          </Button>
        )}
      </div>

      {!canEdit && (
        <p className="text-xs rounded-[10px] bg-parchment-50 border border-sand-border px-3 py-2 text-ink-text-secondary">
          {isPaper
            ? t('Read only at this stage of the exam paper workflow.', 'للقراءة فقط في هذه المرحلة من سير عمل ورقة الامتحان.')
            : t('Read only: you can view, print and download this document.', 'للقراءة فقط: يمكنك عرض هذا المستند وطباعته وتنزيله.')}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-2 min-w-0">
          <div className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 rounded-[12px] border border-sand-border bg-paper-white/95 backdrop-blur px-2 py-1 shadow-manuscript-sm">
            {tool('undo', t('Undo', 'تراجع'), () => exec('undo'))}
            {tool('redo', t('Redo', 'إعادة'), () => exec('redo'))}
            <span className="w-px h-6 bg-sand-border mx-1" />
            <select
              aria-label={t('Paragraph style', 'نمط الفقرة')}
              disabled={!canEdit}
              onChange={(e) => {
                exec('formatBlock', e.target.value);
                e.target.value = '';
              }}
              defaultValue=""
              className="h-8 rounded-lg border border-sand-border bg-white text-xs px-2"
            >
              <option value="" disabled>{t('Style', 'النمط')}</option>
              <option value="P">{t('Paragraph', 'فقرة')}</option>
              <option value="H1">{t('Heading 1', 'عنوان 1')}</option>
              <option value="H2">{t('Heading 2', 'عنوان 2')}</option>
              <option value="H3">{t('Heading 3', 'عنوان 3')}</option>
              <option value="BLOCKQUOTE">{t('Quote', 'اقتباس')}</option>
            </select>
            {tool('format_bold', t('Bold', 'غامق'), () => exec('bold'))}
            {tool('format_italic', t('Italic', 'مائل'), () => exec('italic'))}
            {tool('format_underlined', t('Underline', 'تسطير'), () => exec('underline'))}
            {tool('strikethrough_s', t('Strikethrough', 'يتوسطه خط'), () => exec('strikeThrough'))}
            <span className="w-px h-6 bg-sand-border mx-1" />
            {tool('format_list_bulleted', t('Bulleted list', 'قائمة نقطية'), () => exec('insertUnorderedList'))}
            {tool('format_list_numbered', t('Numbered list', 'قائمة مرقمة'), () => exec('insertOrderedList'))}
            {tool('format_indent_increase', t('Indent', 'زيادة المسافة'), () => exec('indent'))}
            {tool('format_indent_decrease', t('Outdent', 'إنقاص المسافة'), () => exec('outdent'))}
            <span className="w-px h-6 bg-sand-border mx-1" />
            {tool('format_align_left', t('Align left', 'محاذاة لليسار'), () => exec('justifyLeft'))}
            {tool('format_align_center', t('Center', 'توسيط'), () => exec('justifyCenter'))}
            {tool('format_align_right', t('Align right', 'محاذاة لليمين'), () => exec('justifyRight'))}
            {tool('format_align_justify', t('Justify', 'ضبط'), () => exec('justifyFull'))}
            {tool('format_textdirection_r_to_l', t('Right-to-left paragraph', 'فقرة من اليمين لليسار'), toggleDir)}
            <span className="w-px h-6 bg-sand-border mx-1" />
            {tool('table', t('Insert table', 'إدراج جدول'), insertTable)}
            {tool('image', t('Insert image', 'إدراج صورة'), () => imageRef.current?.click())}
            {tool('horizontal_rule', t('Horizontal line', 'خط أفقي'), () => exec('insertHorizontalRule'))}
            {tool('format_clear', t('Clear formatting', 'مسح التنسيق'), () => exec('removeFormat'))}
            <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => onImage(e.target.files?.[0])} />
          </div>

          <div className="rounded-[14px] bg-[#e9e6dd] p-3 sm:p-6 overflow-x-auto">
            <A4Page letterhead={letterhead} bgUrl={bgUrl}>
              <div
                ref={editorRef}
                contentEditable={canEdit}
                suppressContentEditableWarning
                onInput={() => setDirty(true)}
                onPaste={onPaste}
                role="textbox"
                aria-multiline="true"
                aria-label={t('Document text', 'نص المستند')}
                className="doc-body min-h-[60vh] outline-none text-[15px] leading-relaxed text-[#111] [&_table]:w-full [&_td]:border [&_td]:border-gray-400 [&_td]:p-1 [&_th]:border [&_th]:border-gray-400 [&_th]:p-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6 [&_blockquote]:border-s-4 [&_blockquote]:border-sand-border [&_blockquote]:ps-3 [&_hr]:my-3 [&_hr]:border-gray-400"
              />
            </A4Page>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[14px] border border-sand-border bg-paper-white p-4 space-y-3">
            <h3 className="font-serif font-semibold text-ink-green-900">{t('Print & share', 'الطباعة والمشاركة')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={doPrint} disabled={!paperExportAllowed}>{t('PDF / Print', 'PDF / طباعة')}</Button>
              <Button variant="secondary" onClick={() => doWord(false)} disabled={!paperExportAllowed}>{t('Word (.docx)', 'Word (.docx)')}</Button>
              <Button variant="secondary" onClick={() => doWord(true)} disabled={!shareAllowed || !paperExportAllowed}>{t('Share file', 'مشاركة الملف')}</Button>
              <Button variant="secondary" onClick={copyLink}>{t('Copy link', 'نسخ الرابط')}</Button>
            </div>
            {canEdit && (
              <>
                <Button variant="ghost" onClick={() => importRef.current?.click()}>
                  <span className="material-symbols-outlined text-[16px] align-[-3px] me-1" aria-hidden>{'upload_file'}</span>
                  {t('Import from Word (.docx)', 'استيراد من Word (.docx)')}
                </Button>
                <input ref={importRef} type="file" accept=".docx" hidden onChange={(e) => importDocx(e.target.files?.[0])} />
              </>
            )}
            {isPaper && !shareAllowed && (
              <p className="text-xs text-ink-text-muted">
                {t('Exam papers cannot be sent outside the system until they are released after the exam.', 'لا يمكن إرسال أوراق الامتحان خارج النظام قبل نشرها بعد الامتحان.')}
              </p>
            )}
          </section>

          <section className="rounded-[14px] border border-sand-border bg-paper-white p-4 space-y-3">
            <h3 className="font-serif font-semibold text-ink-green-900">{t('Details', 'التفاصيل')}</h3>
            <Field label={t('Letterhead', 'الترويسة')}>
              <Select
                value={doc.letterhead_id || ''}
                onChange={(e) => setMeta({ letterhead_id: e.target.value || null })}
                disabled={!canEdit}
                placeholder={t('Plain paper', 'ورق عادي')}
                options={letterheads.map((l) => ({ value: l.id, label: l.name }))}
              />
            </Field>
            {!isPaper && (
              <>
                <Field label={t('Type', 'النوع')}>
                  <Select value={doc.kind} onChange={(e) => setMeta({ kind: e.target.value })} disabled={!canEdit} options={DOC_KINDS.map(([v, l]) => ({ value: v, label: tt(l) }))} />
                </Field>
                <Field label={t('Status', 'الحالة')}>
                  <Select
                    value={doc.status}
                    onChange={(e) => setMeta({ status: e.target.value })}
                    disabled={!canEdit}
                    options={[
                      { value: 'draft', label: t('Draft', 'مسودة') },
                      { value: 'final', label: t('Final', 'نهائي') },
                      { value: 'archived', label: t('Archived', 'مؤرشف') },
                    ]}
                  />
                </Field>
                <div className="space-y-2">
                  <div className="text-sm text-ink-text-secondary">{t('Shared with', 'مشارك مع')}</div>
                  <Checkbox
                    checked={(doc.share_roles || []).includes('all_staff')}
                    disabled={!canEdit}
                    onChange={(on) =>
                      setMeta({ share_roles: on ? [...new Set([...(doc.share_roles || []), 'all_staff'])] : (doc.share_roles || []).filter((r) => r !== 'all_staff') })
                    }
                    label={t('All staff', 'كل الموظفين')}
                  />
                  <ChipMultiSelect
                    disabled={!canEdit}
                    options={toOptions(STAFF_ROLES)}
                    value={(doc.share_roles || []).filter((r) => r !== 'all_staff')}
                    onChange={(roles) => setMeta({ share_roles: [...roles, ...((doc.share_roles || []).includes('all_staff') ? ['all_staff'] : [])] })}
                  />
                </div>
              </>
            )}
          </section>

          {isPaper && paper && (
            <ExamPaperBox
              paper={paper}
              events={events}
              busy={busy}
              isExaminer={isExaminer}
              onAction={transition}
            />
          )}

          <section className="rounded-[14px] border border-sand-border bg-paper-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-semibold text-ink-green-900">{t('Version history', 'سجل الإصدارات')}</h3>
              {versions === null && (
                <Button variant="ghost" onClick={() => listVersions(doc.id).then(setVersions).catch((e) => toast.error(e.message))}>
                  {t('Show', 'عرض')}
                </Button>
              )}
            </div>
            {versions?.length === 0 && <p className="text-xs text-ink-text-muted">{t('No earlier versions.', 'لا توجد إصدارات سابقة.')}</p>}
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {(versions || []).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 text-xs border-b border-sand-border/60 py-1.5">
                  <span>
                    <b>v{v.version}</b> · {new Date(v.saved_at).toLocaleString()} · {v.profiles?.full_name || '—'}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="text-emerald-700 font-semibold hover:underline"
                      onClick={() => {
                        if (!window.confirm(t('Load this version into the editor? Save to keep it.', 'تحميل هذا الإصدار في المحرر؟ احفظ للاحتفاظ به.'))) return;
                        editorRef.current.innerHTML = sanitizeHtml(v.body_html);
                        setDirty(true);
                      }}
                    >
                      {t('Restore', 'استعادة')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ExamPaperBox({ paper, events, busy, isExaminer, onAction }) {
  const auth = useAuth();
  const { t } = useLang();
  const tt = (pair) => t(pair[0], pair[1]);
  const s = paper.status;
  const admin = auth.isAcademicAdmin;
  const it = auth.isItOfficer;
  const actions = [];
  if ((isExaminer || admin) && ['assigned', 'drafting'].includes(s)) actions.push(['submit', t('Submit to exam office', 'تقديم لمكتب الامتحانات'), false, 'primary']);
  if ((it || admin) && s === 'submitted') actions.push(['start_review', t('Start IT review', 'بدء المراجعة التقنية'), false, 'secondary']);
  if ((it || admin) && ['submitted', 'it_review'].includes(s)) actions.push(['return', t('Return to examiner', 'إعادة للممتحن'), true, 'secondary']);
  if (admin && ['submitted', 'it_review'].includes(s)) actions.push(['approve', t('Approve & lock', 'اعتماد وقفل'), false, 'primary']);
  if ((it || admin) && ['approved', 'printed'].includes(s)) actions.push(['printed', t('Record printing', 'تسجيل الطباعة'), false, 'secondary']);
  if (admin && ['approved', 'printed'].includes(s)) actions.push(['release', t('Release after exam', 'نشر بعد الامتحان'), false, 'secondary']);
  if (admin && ['approved', 'printed'].includes(s)) actions.push(['unlock', t('Reopen for changes', 'إعادة فتح للتعديل'), true, 'danger']);

  return (
    <section className="rounded-[14px] border border-brass-gold-500/40 bg-gold-wash-100/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif font-semibold text-ink-green-900">{t('Exam paper', 'ورقة الامتحان')}</h3>
        <Badge tone={['approved', 'printed', 'released'].includes(s) ? 'green' : s === 'submitted' || s === 'it_review' ? 'blue' : 'amber'}>
          {tt(PAPER_STATUSES[s] || [s, s])}
        </Badge>
      </div>
      <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-ink-text-muted">{t('Exam', 'الامتحان')}</dt><dd>{paper.exams?.name}</dd>
        <dt className="text-ink-text-muted">{t('Subject', 'المادة')}</dt><dd>{paper.subjects?.name_en || paper.subjects?.code}</dd>
        <dt className="text-ink-text-muted">{t('Examiner', 'الممتحن')}</dt><dd>{paper.examiner?.full_name}</dd>
        {paper.due_date && (<><dt className="text-ink-text-muted">{t('Due', 'الموعد')}</dt><dd>{paper.due_date}</dd></>)}
        {paper.printed_count > 0 && (<><dt className="text-ink-text-muted">{t('Printed', 'طُبع')}</dt><dd>{paper.printed_count}×</dd></>)}
      </dl>
      {paper.instructions && <p className="text-xs text-ink-text-secondary">{paper.instructions}</p>}
      <div className="flex flex-col gap-2">
        {actions.map(([id, label, note, variant]) => (
          <Button key={id} variant={variant} disabled={busy} onClick={() => onAction(id, note)}>{label}</Button>
        ))}
      </div>
      {events.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-ink-green-900">{t('Activity log', 'سجل النشاط')} ({events.length})</summary>
          <ul className="mt-2 space-y-1 max-h-56 overflow-y-auto">
            {events.map((e) => (
              <li key={e.id} className="border-b border-sand-border/60 pb-1">
                <b>{e.action}</b> · {e.actor?.full_name || '—'} · {new Date(e.created_at).toLocaleString()}
                {e.note && <div className="text-ink-text-secondary">{e.note}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

