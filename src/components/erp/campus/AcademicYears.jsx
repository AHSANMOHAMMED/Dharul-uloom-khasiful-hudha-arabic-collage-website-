import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, Select, StatusBadge, Table, useAsync, useLang } from '../ui';
import { deleteRow, formatDate, insertRow, query, rpc, updateRow } from '../../../lib/erp/rpc';
import { useAction } from './hooks';

const YEAR_EMPTY = { name: '', start_date: '', end_date: '', status: 'planned' };
const TERM_EMPTY = { name: '', sequence: '1', start_date: '', end_date: '' };

function Terms({ year, canEdit }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [form, setForm] = useState(TERM_EMPTY);
  const [editId, setEditId] = useState(null);
  const [state, reload] = useAsync(
    () => query('terms', (q) => q.select('*').eq('academic_year_id', year.id).order('sequence')),
    [year.id]
  );
  const save = async (e) => {
    e.preventDefault();
    const row = { name: form.name.trim(), sequence: Number(form.sequence) || 1, start_date: form.start_date, end_date: form.end_date };
    const res = await run(
      () => (editId ? updateRow('terms', editId, row) : insertRow('terms', { ...row, academic_year_id: year.id })),
      t('Term saved', 'تم حفظ الفصل')
    );
    if (res.ok) {
      setForm(TERM_EMPTY);
      setEditId(null);
      reload();
    }
  };
  const remove = async (r) => {
    if (!window.confirm(t(`Delete term ${r.name}?`, `حذف الفصل ${r.name}؟`))) return;
    const res = await run(() => deleteRow('terms', r.id), t('Term deleted', 'تم الحذف'));
    if (res.ok) reload();
  };
  return (
    <Card title={`${t('Terms of', 'فصول')} ${year.name}`}>
      {canEdit && (
        <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end mb-4">
          <Field label={t('Name', 'الاسم')}><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('Term 1', 'الفصل 1')} /></Field>
          <Field label={t('Sequence', 'الترتيب')}><Input type="number" min="1" value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} /></Field>
          <Field label={t('Start', 'البداية')}><Input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label={t('End', 'النهاية')}><Input type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{editId ? t('Update', 'تحديث') : t('Add term', 'إضافة')}</Button>
            {editId && <Button variant="ghost" onClick={() => { setEditId(null); setForm(TERM_EMPTY); }}>{t('Cancel', 'إلغاء')}</Button>}
          </div>
        </form>
      )}
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No terms.', 'لا توجد فصول.')} columns={[
            { key: 'sequence', label: '#' },
            { key: 'name', label: t('Name', 'الاسم') },
            { key: 'start_date', label: t('Start', 'البداية'), render: (r) => formatDate(r.start_date) },
            { key: 'end_date', label: t('End', 'النهاية'), render: (r) => formatDate(r.end_date) },
            { key: 'act', label: '', render: (r) => canEdit && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditId(r.id); setForm({ name: r.name, sequence: String(r.sequence), start_date: r.start_date, end_date: r.end_date }); }}>{t('Edit', 'تعديل')}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')}</Button>
              </div>
            ) },
          ]} />
        )}
      </AsyncView>
    </Card>
  );
}

export default function AcademicYears({ canEdit }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [modal, setModal] = useState(null); // { id?, ...form }
  const [selected, setSelected] = useState(null);
  const [state, reload] = useAsync(() => query('academic_years', (q) => q.select('*').order('start_date', { ascending: false })), []);

  const save = async () => {
    const row = { name: modal.name.trim(), start_date: modal.start_date, end_date: modal.end_date, status: modal.status };
    const res = await run(() => (modal.id ? updateRow('academic_years', modal.id, row) : insertRow('academic_years', row)), t('Academic year saved', 'تم حفظ العام الدراسي'));
    if (res.ok) {
      setModal(null);
      reload();
    }
  };
  const makeCurrent = async (y) => {
    if (!window.confirm(t(`Make ${y.name} the current year? The previous current year will be closed.`, `جعل ${y.name} العام الحالي؟ سيتم إغلاق العام السابق.`))) return;
    const res = await run(() => rpc('set_current_academic_year', { p_year_id: y.id }), t('Current year updated', 'تم تحديث العام الحالي'));
    if (res.ok) reload();
  };
  const remove = async (y) => {
    if (!window.confirm(t(`Delete ${y.name}? Its terms and enrolments will be deleted too.`, `حذف ${y.name}؟ ستحذف فصوله وتسجيلاته أيضًا.`))) return;
    const res = await run(() => deleteRow('academic_years', y.id), t('Deleted', 'تم الحذف'));
    if (res.ok) {
      if (selected?.id === y.id) setSelected(null);
      reload();
    }
  };

  return (
    <div className="space-y-6">
      <Card title={t('Academic years', 'الأعوام الدراسية')} actions={canEdit && <Button onClick={() => setModal({ ...YEAR_EMPTY })}>{t('New year', 'عام جديد')}</Button>}>
        <AsyncView state={state}>
          {(rows) => (
            <Table rows={rows} empty={t('No academic years yet.', 'لا توجد أعوام بعد.')} columns={[
              { key: 'name', label: t('Name', 'الاسم'), render: (r) => (
                <button type="button" className="text-emerald-300 hover:underline" onClick={() => setSelected(r)}>{r.name}</button>
              ) },
              { key: 'start_date', label: t('Start', 'البداية'), render: (r) => formatDate(r.start_date) },
              { key: 'end_date', label: t('End', 'النهاية'), render: (r) => formatDate(r.end_date) },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
              { key: 'is_current', label: t('Current', 'الحالي'), render: (r) => (r.is_current ? <Badge tone="green">{t('current', 'الحالي')}</Badge> : null) },
              { key: 'act', label: '', render: (r) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>{t('Terms', 'الفصول')}</Button>
                  {canEdit && !r.is_current && <Button size="sm" variant="secondary" disabled={busy} onClick={() => makeCurrent(r)}>{t('Set current', 'تعيين حالي')}</Button>}
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => setModal({ id: r.id, name: r.name, start_date: r.start_date, end_date: r.end_date, status: r.status })}>{t('Edit', 'تعديل')}</Button>}
                  {canEdit && <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')}</Button>}
                </div>
              ) },
            ]} />
          )}
        </AsyncView>
      </Card>
      {selected && <Terms year={selected} canEdit={canEdit} />}
      <Modal
        open={Boolean(modal)}
        title={modal?.id ? t('Edit academic year', 'تعديل العام') : t('New academic year', 'عام دراسي جديد')}
        onClose={() => setModal(null)}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !modal?.name || !modal?.start_date || !modal?.end_date} onClick={save}>{t('Save', 'حفظ')}</Button></>}
      >
        {modal && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Field label={t('Name', 'الاسم')}><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="2027" /></Field></div>
            <Field label={t('Start date', 'تاريخ البداية')}><Input type="date" value={modal.start_date} onChange={(e) => setModal({ ...modal, start_date: e.target.value })} /></Field>
            <Field label={t('End date', 'تاريخ النهاية')}><Input type="date" value={modal.end_date} onChange={(e) => setModal({ ...modal, end_date: e.target.value })} /></Field>
            <Field label={t('Status', 'الحالة')}>
              <Select value={modal.status} onChange={(e) => setModal({ ...modal, status: e.target.value })} options={[
                { value: 'planned', label: t('Planned', 'مخطط') }, { value: 'active', label: t('Active', 'نشط') }, { value: 'closed', label: t('Closed', 'مغلق') },
              ]} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
