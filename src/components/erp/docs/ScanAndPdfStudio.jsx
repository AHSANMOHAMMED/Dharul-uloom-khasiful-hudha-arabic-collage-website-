import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, Field, Icon, Input, Select, Textarea, useLang } from '../ui';
import { createDocument, letterheadUrl, listLetterheads } from '../../../lib/erp/documentsApi';
import { openChatConversation, searchChatContacts, sendChatMessage, uploadChatAttachment } from '../../../lib/chatApi';
import { printMultiPageScanPdf } from '../../../lib/printReport';

const FILTERS = [
  { id: 'scan', en: 'Document Scan (B&W)', ar: 'مسح مستند (أبيض وأسود)' },
  { id: 'contrast', en: 'High-Contrast Ink', ar: 'حبر عالي التباين' },
  { id: 'original', en: 'Original Colour', ar: 'الأصل الملون' },
];

const INK_COLORS = [
  { id: '#0F172A', en: 'Black Ink', ar: 'حبر أسود' },
  { id: '#1D4ED8', en: 'Blue Ink', ar: 'حبر أزرق' },
  { id: '#DC2626', en: 'Red Marking', ar: 'تصحيح أحمر' },
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderPageToDataUrl(page) {
  const img = await loadImage(page.src);
  const rot = ((page.rotation || 0) % 360 + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const rawW = swap ? img.height : img.width;
  const rawH = swap ? img.width : img.height;
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
  const w = Math.max(1, Math.round(rawW * scale));
  const h = Math.max(1, Math.round(rawH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rot * Math.PI) / 180);
  const drawW = swap ? h : w;
  const drawH = swap ? w : h;
  if (page.filter === 'scan') {
    ctx.filter = 'grayscale(100%) contrast(155%) brightness(108%)';
  } else if (page.filter === 'contrast') {
    ctx.filter = 'contrast(135%) brightness(105%)';
  }
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
  ctx.filter = 'none';

  // Replay vector pen strokes (stored normalized 0..1)
  for (const stroke of page.strokes || []) {
    if (!stroke.points?.length) continue;
    ctx.strokeStyle = stroke.color || '#0F172A';
    ctx.lineWidth = Math.max(2, (stroke.width || 3) * (w / 700));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    stroke.points.forEach(([nx, ny], i) => {
      const px = nx * w;
      const py = ny * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // Render typed note banner at bottom if present
  if (page.note && page.note.trim()) {
    const pad = Math.round(w * 0.025);
    const fontSize = Math.max(14, Math.round(w * 0.022));
    ctx.font = `600 ${fontSize}px sans-serif`;
    const boxH = fontSize * 2.1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(pad, h - boxH - pad, w - pad * 2, boxH);
    ctx.strokeStyle = '#0B3B2E';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, h - boxH - pad, w - pad * 2, boxH);
    ctx.fillStyle = '#0B3B2E';
    ctx.fillText(page.note.trim(), pad * 1.6, h - boxH / 2 - pad + fontSize * 0.35, w - pad * 3.2);
  }

  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * CamScanner-style Multi-Page Camera Scanner, Handwriting Annotator & Multi-Size PDF Studio.
 * Supports A4 / A5 / A3 Portrait & Landscape, College Letterhead, Document Saving & Direct Examiner Chat Dispatch.
 */
export default function ScanAndPdfStudio({ onSavedDoc }) {
  const auth = useAuth();
  const { t, lang } = useLang();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const overlayRef = useRef(null);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('exam_paper');
  const [paperSize, setPaperSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [includeLetterhead, setIncludeLetterhead] = useState(true);
  const [letterheads, setLetterheads] = useState([]);
  const [selectedLhId, setSelectedLhId] = useState('');
  const [lhUrl, setLhUrl] = useState('');
  const [pages, setPages] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);

  // Pen annotation state
  const [drawMode, setDrawMode] = useState(false);
  const [inkColor, setInkColor] = useState('#0F172A');
  const [drawing, setDrawing] = useState(false);
  const activeStrokeRef = useRef(null);

  // Dispatch to Examiner / Tutor state
  const [contacts, setContacts] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listLetterheads().then((lhs) => {
      setLetterheads(lhs || []);
      const def = (lhs || []).find((l) => l.is_default);
      if (def) setSelectedLhId(def.id);
    }).catch(() => {});
    searchChatContacts('').then((rows) => {
      setContacts((rows || []).filter((c) => ['tutor', 'staff'].includes(c.account_type) || c.role === 'admin'));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const lh = letterheads.find((l) => l.id === selectedLhId);
    if (includeLetterhead && lh?.storage_path) {
      letterheadUrl(lh.storage_path).then(setLhUrl).catch(() => setLhUrl(''));
    } else {
      setLhUrl('');
    }
  }, [includeLetterhead, selectedLhId, letterheads]);

  const activePage = pages[activeIdx] || null;

  const addFiles = (files) => {
    const list = [...(files || [])].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPages((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random()}`, src: reader.result, filter: 'scan', rotation: 0, strokes: [], note: '' },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const patchPage = useCallback((idx, patch) => {
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }, []);

  const movePage = (idx, delta) => {
    const target = idx + delta;
    if (target < 0 || target >= pages.length) return;
    setPages((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
    setActiveIdx(target);
  };

  const removePage = (idx) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((cur) => Math.max(0, Math.min(cur, pages.length - 2)));
  };

  // Draw overlay preview whenever strokes change
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !activePage) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of activePage.strokes || []) {
      if (!stroke.points?.length) continue;
      ctx.strokeStyle = stroke.color || '#0F172A';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      stroke.points.forEach(([nx, ny], i) => {
        const px = nx * canvas.width;
        const py = ny * canvas.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  }, [activePage]);

  const pointerPos = (e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [
      Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    ];
  };

  const startDraw = (e) => {
    if (!drawMode || !activePage) return;
    e.preventDefault();
    const pt = pointerPos(e);
    activeStrokeRef.current = { color: inkColor, width: 3, points: [pt] };
    setDrawing(true);
  };

  const moveDraw = (e) => {
    if (!drawing || !drawMode || !activeStrokeRef.current) return;
    e.preventDefault();
    const pt = pointerPos(e);
    activeStrokeRef.current.points.push(pt);
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    const pts = activeStrokeRef.current.points;
    if (pts.length >= 2) {
      const [x1, y1] = pts[pts.length - 2];
      const [x2, y2] = pts[pts.length - 1];
      ctx.strokeStyle = activeStrokeRef.current.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1 * canvas.width, y1 * canvas.height);
      ctx.lineTo(x2 * canvas.width, y2 * canvas.height);
      ctx.stroke();
    }
  };

  const endDraw = () => {
    if (!drawing || !activeStrokeRef.current) return;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setDrawing(false);
    patchPage(activeIdx, { strokes: [...(activePage?.strokes || []), finished] });
  };

  const compilePages = async () => Promise.all(pages.map(renderPageToDataUrl));

  const exportPdf = async () => {
    if (!pages.length) return;
    setBusy(true);
    try {
      const rendered = await compilePages();
      printMultiPageScanPdf({
        title: title.trim() || t('Scanned Exam Paper', 'ورقة امتحان ممسوحة'),
        pages: rendered,
        paperSize,
        orientation,
        includeLetterhead,
        letterheadUrl: lhUrl,
        dir,
        lang,
      });
    } catch (e) {
      toast.error(e.message || t('Failed to build PDF', 'تعذر إنشاء ملف PDF'));
    } finally {
      setBusy(false);
    }
  };

  const saveToDocuments = async () => {
    if (!pages.length) return;
    setBusy(true);
    try {
      const rendered = await compilePages();
      const bodyHtml = rendered
        .map((src, i) => `<div style="page-break-after: always; text-align: center;"><img src="${src}" alt="Page ${i + 1}" style="max-width:100%;height:auto;" /></div>`)
        .join('');
      const doc = await createDocument({
        title: title.trim() || `${t('Scanned Paper', 'ورقة ممسوحة')} (${pages.length}p)`,
        kind,
        body_html: bodyHtml,
        letterhead_id: includeLetterhead && selectedLhId ? selectedLhId : null,
      });
      toast.success(t('Saved to College Documents', 'تم الحفظ في مستندات الكلية'));
      if (onSavedDoc) onSavedDoc(doc.id);
    } catch (e) {
      toast.error(e.message || t('Could not save document', 'تعذر حفظ المستند'));
    } finally {
      setBusy(false);
    }
  };

  const sendToExaminer = async () => {
    if (!pages.length || !recipientId) return;
    setBusy(true);
    try {
      const rendered = await compilePages();
      const convId = await openChatConversation(recipientId);
      const docTitle = title.trim() || t('Scanned Exam Paper', 'ورقة امتحان ممسوحة');
      for (let i = 0; i < rendered.length; i += 1) {
        const res = await fetch(rendered[i]);
        const blob = await res.blob();
        const file = new File([blob], `${docTitle.replace(/\s+/g, '_')}_p${i + 1}.jpg`, { type: 'image/jpeg' });
        const uploaded = await uploadChatAttachment(auth.user?.orgId, convId, file);
        await sendChatMessage(
          convId,
          `${docTitle} (${t('Page', 'صفحة')} ${i + 1}/${rendered.length})`,
          uploaded,
        );
      }
      toast.success(t('Scanned pages sent to recipient inbox', 'تم إرسال الصفحات الممسوحة إلى صندوق المستلم'));
    } catch (e) {
      toast.error(e.message || t('Failed to send scanned pages', 'تعذر إرسال الصفحات'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card
        title={t('Camera Scanner & Multi-Page PDF Studio', 'ماسح الكاميرا واستوديو PDF متعدد الصفحات')}
        actions={
          <div className="flex flex-wrap gap-2">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <Button size="sm" onClick={() => cameraRef.current?.click()}>
              <span className="inline-flex items-center gap-1.5"><Icon name="photo_camera" className="text-[16px]" />{t('Scan with Camera', 'مسح بالكاميرا')}</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => galleryRef.current?.click()}>
              <span className="inline-flex items-center gap-1.5"><Icon name="photo_library" className="text-[16px]" />{t('Add from Gallery', 'إضافة من المعرض')}</span>
            </Button>
          </div>
        }
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <Field label={t('Document Title', 'عنوان المستند')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Class 3 Fiqh Exam', 'مثال: امتحان الفقه الصف ٣')} />
          </Field>
          <Field label={t('Document Type', 'نوع المستند')}>
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              options={[
                { value: 'exam_paper', label: t('Exam Paper', 'ورقة امتحان') },
                { value: 'letter', label: t('Official Letter', 'خطاب رسمي') },
                { value: 'notice', label: t('Notice / Circular', 'إعلان / تعميم') },
                { value: 'certificate', label: t('Certificate', 'شهادة') },
              ]}
            />
          </Field>
          <Field label={t('Paper Size', 'حجم الورق')}>
            <Select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value)}
              options={[
                { value: 'A4', label: 'A4 (210 × 297 mm)' },
                { value: 'A5', label: 'A5 (148 × 210 mm)' },
                { value: 'A3', label: 'A3 (297 × 420 mm)' },
              ]}
            />
          </Field>
          <Field label={t('Orientation', 'الاتجاه')}>
            <Select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
              options={[
                { value: 'portrait', label: t('Portrait', 'عمودي') },
                { value: 'landscape', label: t('Landscape', 'أفقي') },
              ]}
            />
          </Field>
          <Field label={t('Letterhead', 'الترويسة')}>
            <Select
              value={includeLetterhead ? (selectedLhId || 'builtin') : 'none'}
              onChange={(e) => {
                if (e.target.value === 'none') {
                  setIncludeLetterhead(false);
                } else {
                  setIncludeLetterhead(true);
                  setSelectedLhId(e.target.value === 'builtin' ? '' : e.target.value);
                }
              }}
              options={[
                { value: 'builtin', label: t('Official College Header', 'ترويسة الكلية الرسمية') },
                ...letterheads.map((l) => ({ value: l.id, label: l.name })),
                { value: 'none', label: t('No Letterhead', 'بدون ترويسة') },
              ]}
            />
          </Field>
        </div>

        {!pages.length ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-10 text-center space-y-2">
            <Icon name="document_scanner" className="text-4xl text-emerald-700 mx-auto" />
            <p className="text-sm font-semibold text-ink-green-900">
              {t('Scan 1, 3, or more handwritten pages in seconds', 'امسح صفحة أو ٣ صفحات أو أكثر بخط اليد في ثوانٍ')}
            </p>
            <p className="text-xs text-ink-text-muted max-w-lg mx-auto">
              {t('Capture with your camera or choose images from your gallery, enhance contrast, write notes/marks on any page, and print/export as A4, A5, or A3 PDF.', 'التقط بالكاميرا أو اختر من المعرض، وحسّن التباين، واكتب ملاحظاتك، وصدّر كـ PDF بحجم A4 أو A5 أو A3.')}
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-5">
            {/* Page strip */}
            <div className="lg:col-span-3 space-y-2 max-h-[540px] overflow-y-auto pe-1">
              <div className="text-xs font-semibold text-ink-text-muted uppercase">
                {t('Pages', 'الصفحات')} ({pages.length})
              </div>
              {pages.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`cursor-pointer rounded-xl border p-2 flex items-center gap-2 transition ${
                    idx === activeIdx ? 'border-emerald-700 bg-emerald-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <img src={p.src} alt="" className="w-12 h-16 object-cover rounded border border-slate-200 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-ink-green-900">{t('Page', 'صفحة')} {idx + 1}</div>
                    <div className="text-[11px] text-ink-text-muted truncate">{FILTERS.find((f) => f.id === p.filter)?.en}</div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={(e) => { e.stopPropagation(); movePage(idx, -1); }} className="text-[11px] px-1 hover:text-emerald-700" aria-label={t('Move up', 'تحريك لأعلى')}>▲</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); movePage(idx, 1); }} className="text-[11px] px-1 hover:text-emerald-700" aria-label={t('Move down', 'تحريك لأسفل')}>▼</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Active page preview & annotation canvas */}
            {activePage && (
              <div className="lg:col-span-9 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {FILTERS.map((f) => (
                      <Button
                        key={f.id}
                        size="sm"
                        variant={activePage.filter === f.id ? 'primary' : 'secondary'}
                        onClick={() => patchPage(activeIdx, { filter: f.id })}
                      >
                        {t(f.en, f.ar)}
                      </Button>
                    ))}
                    <Button size="sm" variant="secondary" onClick={() => patchPage(activeIdx, { rotation: (activePage.rotation + 90) % 360 })}>
                      {t('Rotate 90°', 'تدوير 90°')}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant={drawMode ? 'primary' : 'secondary'} onClick={() => setDrawMode((d) => !d)}>
                      {drawMode ? t('Drawing Ink ON', 'الكتابة مفعلة') : t('Write / Draw on Page', 'الكتابة على الورقة')}
                    </Button>
                    {drawMode && INK_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setInkColor(c.id)}
                        aria-label={t(c.en, c.ar)}
                        className={`w-6 h-6 rounded-full border-2 ${inkColor === c.id ? 'border-emerald-700 scale-110' : 'border-white'}`}
                        style={{ backgroundColor: c.id }}
                      />
                    ))}
                    {Boolean(activePage.strokes?.length) && (
                      <Button size="sm" variant="ghost" onClick={() => patchPage(activeIdx, { strokes: activePage.strokes.slice(0, -1) })}>
                        {t('Undo Ink', 'تراجع')}
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => removePage(activeIdx)}>
                      {t('Delete Page', 'حذف الصفحة')}
                    </Button>
                  </div>
                </div>

                <div className="relative mx-auto max-w-xl bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <img
                    src={activePage.src}
                    alt=""
                    className="w-full h-auto block select-none"
                    style={{
                      transform: `rotate(${activePage.rotation}deg)`,
                      filter:
                        activePage.filter === 'scan'
                          ? 'grayscale(100%) contrast(155%) brightness(108%)'
                          : activePage.filter === 'contrast'
                            ? 'contrast(135%) brightness(105%)'
                            : 'none',
                    }}
                  />
                  <canvas
                    ref={overlayRef}
                    width={800}
                    height={1000}
                    onMouseDown={startDraw}
                    onMouseMove={moveDraw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={moveDraw}
                    onTouchEnd={endDraw}
                    className={`absolute inset-0 w-full h-full ${drawMode ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
                  />
                </div>

                <Field label={t('Typed Note / Mark on Page', 'ملاحظة أو درجة مكتوبة على الصفحة')}>
                  <Textarea
                    rows={2}
                    value={activePage.note}
                    onChange={(e) => patchPage(activeIdx, { note: e.target.value })}
                    placeholder={t('Optional examiner comment or instruction printed on this page…', 'تعليق المصحح أو التعليمات المطبوعة على هذه الصفحة…')}
                  />
                </Field>

                {/* Export / Save / Send bar */}
                <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={exportPdf}>
                      {t('Print / Save PDF', 'طباعة / حفظ PDF')} ({paperSize})
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={saveToDocuments}>
                      {t('Save to Exam Papers / Docs', 'حفظ في أوراق الامتحان / المستندات')}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Select
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      placeholder={t('Select Examiner / Tutor…', 'اختر المصحح / المعلم…')}
                      options={contacts.map((c) => ({ value: c.user_id, label: c.full_name }))}
                    />
                    <Button variant="secondary" disabled={busy || !recipientId} onClick={sendToExaminer}>
                      {t('Send to Examiner', 'إرسال للمصحح')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
