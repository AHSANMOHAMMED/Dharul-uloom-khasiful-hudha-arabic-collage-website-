import { useState } from 'react';
import { Button, Field, Input, Modal, Select, useLang } from '../ui';
import { SLIP_MODES, SLIP_PAPERS, getSlipSettings, normalizeSlipSettings, saveSlipSettings } from '../../../lib/slip/slipSettings';
import { printAlignmentTest, printSlip } from '../../../lib/slip/slipRender';
import { sampleSlip } from '../../../lib/slip/slipModels';

/** Counter printer settings (Epson LQ-310 driver / raw ESC/P / laser), stored on this computer. */
export function SlipPrinterSettings({ open, onClose, org }) {
  const { t } = useLang();
  const [s, setS] = useState(getSlipSettings);
  const set = (patch) => setS((cur) => normalizeSlipSettings({ ...cur, ...patch }));
  const save = () => {
    saveSlipSettings(s);
    onClose?.();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Slip printer (this computer)', 'طابعة الإيصالات (هذا الجهاز)')}
      footer={
        <>
          <Button variant="secondary" onClick={() => printAlignmentTest(s)}>{t('Alignment test', 'اختبار المحاذاة')}</Button>
          <Button variant="secondary" onClick={() => printSlip(sampleSlip(org || {}), s)}>{t('Sample slip', 'إيصال تجريبي')}</Button>
          <Button onClick={save}>{t('Save', 'حفظ')}</Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={t('Printer type', 'نوع الطابعة')}>
          <Select value={s.mode} onChange={(e) => set({ mode: e.target.value })} options={SLIP_MODES.map((m) => ({ value: m.value, label: t(m.en, m.ar) }))} />
        </Field>
        <Field label={t('Paper / form', 'الورق / النموذج')}>
          <Select value={s.paper} onChange={(e) => set({ paper: e.target.value })} options={SLIP_PAPERS.map((p) => ({ value: p.value, label: t(p.en, p.ar) }))} />
        </Field>
        {s.paper === 'custom' && (
          <>
            <Field label={t('Width (mm)', 'العرض (مم)')} hint={t('LQ-310: up to 254 mm', 'حتى 254 مم')}>
              <Input type="number" step="0.1" value={s.widthMm} onChange={(e) => set({ widthMm: e.target.value })} />
            </Field>
            <Field label={t('Height (mm)', 'الارتفاع (مم)')}>
              <Input type="number" step="0.1" value={s.heightMm} onChange={(e) => set({ heightMm: e.target.value })} />
            </Field>
          </>
        )}
        <Field label={t('Copies per slip', 'عدد النسخ')} hint={t('Use 1 for carbon / multi-part forms', 'نسخة واحدة للورق الكربوني')}>
          <Select value={String(s.copies)} onChange={(e) => set({ copies: Number(e.target.value) })}
            options={[{ value: '1', label: t('1 (multi-part form)', '1 (ورق متعدد الطبقات)') }, { value: '2', label: t('2 (office + customer)', '2 (المكتب + العميل)') }]} />
        </Field>
        <Field label={t('Margin inside the form (mm)', 'الهامش داخل النموذج (مم)')}>
          <Input type="number" step="0.5" value={s.marginMm} onChange={(e) => set({ marginMm: e.target.value })} />
        </Field>
        <Field label={t('Move right (mm)', 'إزاحة يمين (مم)')} hint={t('From the alignment test; negative moves left', 'من اختبار المحاذاة')}>
          <Input type="number" step="0.5" value={s.offsetXmm} onChange={(e) => set({ offsetXmm: e.target.value })} />
        </Field>
        <Field label={t('Move down (mm)', 'إزاحة أسفل (مم)')} hint={t('Negative moves up', 'السالب للأعلى')}>
          <Input type="number" step="0.5" value={s.offsetYmm} onChange={(e) => set({ offsetYmm: e.target.value })} />
        </Field>
        {s.mode !== 'raw' ? (
          <>
            <Field label={t('Font size (pt)', 'حجم الخط')}>
              <Input type="number" step="0.5" value={s.fontPt} onChange={(e) => set({ fontPt: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input type="checkbox" checked={s.showLogo} onChange={(e) => set({ showLogo: e.target.checked })} />
              {t('Print logo (slower on dot-matrix)', 'طباعة الشعار (أبطأ)')}
            </label>
          </>
        ) : (
          <>
            <Field label={t('Characters per inch', 'حرف لكل بوصة')}>
              <Select value={String(s.cpi)} onChange={(e) => set({ cpi: Number(e.target.value) })}
                options={[{ value: '10', label: '10 cpi (pica)' }, { value: '12', label: '12 cpi (elite)' }]} />
            </Field>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input type="checkbox" checked={s.boxChars} onChange={(e) => set({ boxChars: e.target.checked })} />
              {t('Line-drawing characters (PC437)', 'رموز الخطوط')}
            </label>
          </>
        )}
      </div>
      <div className="rounded-xl border border-sand-border bg-parchment-50 p-3 text-xs text-ink-text-secondary space-y-1">
        {s.mode === 'lq310' && (
          <>
            <p className="font-semibold">{t('One-time setup for the Epson LQ-310 driver', 'إعداد لمرة واحدة لتعريف Epson LQ-310')}</p>
            <p>{t('1. Windows: Printers → Print server properties → Create a new form named "KH Slip" with the size above. Linux (CUPS): add a custom page size.', '1. أنشئ نموذج ورق بالمقاس أعلاه في إعدادات الطابعة.')}</p>
            <p>{t('2. In the LQ-310 preferences choose that form, paper source Tractor (continuous) or Manual (cut sheet).', '2. اختر هذا النموذج ومصدر الورق في تفضيلات الطابعة.')}</p>
            <p>{t('3. In the browser print dialog: margins None, scale 100%, headers and footers off. Print the alignment test and enter the offsets.', '3. في نافذة الطباعة: بلا هوامش، 100%، دون رأس وتذييل.')}</p>
          </>
        )}
        {s.mode === 'raw' && (
          <p>{t('Raw mode downloads a .prn file in the printer\'s own fonts (English letters only). Send it unchanged: Windows "copy /b slip.prn \\\\localhost\\LQ310" (share the printer as LQ310), Linux "lp -d LQ310 -o raw slip.prn".', 'يُنزَّل ملف ‎.prn بخطوط الطابعة (حروف إنجليزية فقط).')}</p>
        )}
        {s.mode === 'laser' && <p>{t('Colour slip for laser / inkjet printers on the paper chosen above.', 'إيصال ملون لطابعات الليزر أو الحبر.')}</p>}
      </div>
    </Modal>
  );
}

/** Small "Printer" button that opens the settings dialog. */
export function SlipPrinterButton({ org, size = 'sm' }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant="secondary" onClick={() => setOpen(true)} title={t('Slip printer settings', 'إعدادات طابعة الإيصالات')}>
        {t('Printer settings', 'إعدادات الطابعة')}
      </Button>
      {open && <SlipPrinterSettings open onClose={() => setOpen(false)} org={org} />}
    </>
  );
}
