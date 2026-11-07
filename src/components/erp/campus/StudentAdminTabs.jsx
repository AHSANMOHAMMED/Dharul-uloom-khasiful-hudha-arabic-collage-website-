import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Select, Table, Textarea, useAsync, useLang } from '../ui';
import { deleteRow, formatDate, insertRow, insertRows, query, rpc } from '../../../lib/erp/rpc';
import { classOptions, parsePastedRows } from '../../../lib/erp/campusApi';
import { useAction } from './hooks';

/** Unapproved student / tutor / staff accounts → approve_account. */
export function ApprovalsTab({ canApprove }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [type, setType] = useState('');
  const [state, reload] = useAsync(
    () =>
      query('profiles', (q) => {
        let b = q
          .select('id, full_name, email, phone, account_type, index_number, class_number, created_at')
          .eq('is_approved', false)
          .in('account_type', ['student', 'tutor', 'staff']);
        if (type) b = b.eq('account_type', type);
        return b.order('created_at', { ascending: true });
      }),
    [type]
  );
  const decide = async (p, approve) => {
    if (!approve && !window.confirm(t('Reject this account request?', 'رفض طلب الحساب هذا؟'))) return;
    const res = await run(
      () => rpc('approve_account', { p_profile_id: p.id, p_approve: approve }),
      approve ? t('Account approved', 'تم اعتماد الحساب') : t('Marked as rejected', 'تم الرفض')
    );
    if (res.ok) reload();
  };
  return (
    <Card
      title={t('Pending account approvals', 'الحسابات بانتظار الاعتماد')}
      actions={
        <div className="w-44">
          <Select value={type} onChange={(e) => setType(e.target.value)} placeholder={t('All types', 'كل الأنواع')} options={[
            { value: 'student', label: t('Students', 'الطلاب') },
            { value: 'tutor', label: t('Tutors', 'المعلمون') },
            { value: 'staff', label: t('Staff', 'الموظفون') },
          ]} />
        </div>
      }
    >
      {!canApprove && (
        <p className="text-sm text-amber-300 mb-3">{t('Only administrators, the principal or vice principal can approve accounts.', 'يمكن للمسؤول أو المدير أو نائبه فقط اعتماد الحسابات.')}</p>
      )}
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No accounts awaiting approval.', 'لا توجد حسابات معلقة.')} columns={[
            { key: 'full_name', label: t('Name', 'الاسم') },
            { key: 'account_type', label: t('Type', 'النوع'), render: (r) => <Badge tone="blue">{r.account_type}</Badge> },
            { key: 'email', label: t('E-mail', 'البريد') },
            { key: 'phone', label: t('Phone', 'الهاتف') },
            { key: 'index_number', label: t('Index', 'الرقم') },
            { key: 'class_number', label: t('Class', 'الصف') },
            { key: 'created_at', label: t('Signed up', 'التسجيل'), render: (r) => formatDate(r.created_at) },
            {
              key: 'act', label: '', render: (r) => (
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy || !canApprove} onClick={() => decide(r, true)}>{t('Approve', 'اعتماد')}</Button>
                  <Button size="sm" variant="danger" disabled={busy || !canApprove} onClick={() => decide(r, false)}>{t('Reject', 'رفض')}</Button>
                </div>
              ),
            },
          ]} />
        )}
      </AsyncView>
    </Card>
  );
}

/** valid_index_numbers: list / add / bulk paste. */
export function IndexNumbersTab({ canManage }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [filter, setFilter] = useState('');
  const [single, setSingle] = useState({ index_number: '', student_name: '', class_number: '1' });
  const [bulk, setBulk] = useState('');
  const [state, reload] = useAsync(
    () => query('valid_index_numbers', (q) => q.select('*').order('created_at', { ascending: false }).limit(1000)),
    []
  );
  const addOne = async (e) => {
    e.preventDefault();
    const res = await run(
      () => insertRow('valid_index_numbers', {
        index_number: single.index_number.trim(),
        student_name: single.student_name.trim(),
        class_number: Number(single.class_number),
      }),
      t('Index number added', 'تمت إضافة الرقم')
    );
    if (res.ok) {
      setSingle({ index_number: '', student_name: '', class_number: single.class_number });
      reload();
    }
  };
  const addBulk = async () => {
    const parsed = parsePastedRows(bulk)
      .filter((c) => c[0] && c[0].toLowerCase() !== 'index_number' && c[0].toLowerCase() !== 'index')
      .map((c) => ({ index_number: c[0], student_name: c[1] || '', class_number: Number(c[2] || 1) }));
    const bad = parsed.filter((r) => !r.student_name || !(r.class_number >= 1 && r.class_number <= 20));
    if (!parsed.length) return;
    if (bad.length) {
      window.alert(t(`${bad.length} line(s) are missing a name or have an invalid class (1–20).`, `${bad.length} سطر بدون اسم أو بصف غير صالح.`));
      return;
    }
    const res = await run(() => insertRows('valid_index_numbers', parsed), (r) => `${r?.length ?? parsed.length} ${t('index numbers imported', 'رقم تم استيراده')}`);
    if (res.ok) {
      setBulk('');
      reload();
    }
  };
  const remove = async (r) => {
    if (!window.confirm(t(`Delete index ${r.index_number}?`, `حذف الرقم ${r.index_number}؟`))) return;
    const res = await run(() => deleteRow('valid_index_numbers', r.index_number, 'index_number'), t('Deleted', 'تم الحذف'));
    if (res.ok) reload();
  };
  const needle = filter.trim().toLowerCase();
  return (
    <div className="space-y-6">
      {canManage && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title={t('Add index number', 'إضافة رقم قيد')}>
            <form onSubmit={addOne} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <Field label={t('Index number', 'رقم القيد')}>
                <Input required value={single.index_number} onChange={(e) => setSingle({ ...single, index_number: e.target.value })} />
              </Field>
              <Field label={t('Student name', 'اسم الطالب')}>
                <Input required value={single.student_name} onChange={(e) => setSingle({ ...single, student_name: e.target.value })} />
              </Field>
              <Field label={t('Class', 'الصف')}>
                <Select value={single.class_number} onChange={(e) => setSingle({ ...single, class_number: e.target.value })} options={classOptions(t)} />
              </Field>
              <div className="sm:col-span-3 flex justify-end"><Button type="submit" disabled={busy}>{t('Add', 'إضافة')}</Button></div>
            </form>
          </Card>
          <Card title={t('Bulk import (paste CSV)', 'استيراد جماعي (لصق CSV)')}>
            <Field label={t('One per line: index, name, class', 'سطر لكل طالب: الرقم، الاسم، الصف')}>
              <Textarea rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'KH-2027-001, Ahmed Rizwan, 1\nKH-2027-002, Fathima Nusra, 1'} />
            </Field>
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-gray-500">{parsePastedRows(bulk).length} {t('lines', 'سطر')}</span>
              <Button disabled={busy || !bulk.trim()} onClick={addBulk}>{t('Import', 'استيراد')}</Button>
            </div>
          </Card>
        </div>
      )}
      <Card title={t('Issued index numbers', 'أرقام القيد الصادرة')} actions={<div className="w-56"><Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('Filter…', 'تصفية…')} /></div>}>
        <AsyncView state={state}>
          {(rows) => (
            <Table
              rowKey="index_number"
              rows={rows.filter((r) => !needle || r.index_number.toLowerCase().includes(needle) || (r.student_name || '').toLowerCase().includes(needle))}
              empty={t('No index numbers.', 'لا توجد أرقام.')}
              columns={[
                { key: 'index_number', label: t('Index', 'الرقم') },
                { key: 'student_name', label: t('Name', 'الاسم') },
                { key: 'class_number', label: t('Class', 'الصف') },
                { key: 'is_registered', label: t('Registered', 'مسجل'), render: (r) => (r.is_registered ? <Badge tone="green">{t('Yes', 'نعم')}</Badge> : <Badge tone="amber">{t('Not yet', 'ليس بعد')}</Badge>) },
                { key: 'created_at', label: t('Created', 'الإنشاء'), render: (r) => formatDate(r.created_at) },
                {
                  key: 'act', label: '', render: (r) =>
                    canManage && !r.is_registered ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')}</Button> : null,
                },
              ]}
            />
          )}
        </AsyncView>
      </Card>
    </div>
  );
}

/** parent_link_requests pending → review_child_link. */
export function ParentLinksTab({ canReview }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [status, setStatus] = useState('pending');
  const [state, reload] = useAsync(
    () =>
      query('parent_link_requests', (q) =>
        q.select('*, parent:profiles!parent_id(full_name, email, phone), child:profiles!child_id(full_name, index_number, class_number)')
          .eq('status', status).order('created_at', { ascending: false }).limit(300)
      ),
    [status]
  );
  const decide = async (r, approve) => {
    if (!approve && !window.confirm(t('Reject this link request?', 'رفض طلب الربط؟'))) return;
    const res = await run(() => rpc('review_child_link', { p_request_id: r.id, p_approve: approve }), approve ? t('Parent linked', 'تم الربط') : t('Request rejected', 'تم الرفض'));
    if (res.ok) reload();
  };
  return (
    <Card title={t('Parent ↔ child link requests', 'طلبات ربط ولي الأمر بالطالب')} actions={
      <div className="w-40">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[
          { value: 'pending', label: t('Pending', 'معلقة') },
          { value: 'approved', label: t('Approved', 'مقبولة') },
          { value: 'rejected', label: t('Rejected', 'مرفوضة') },
        ]} />
      </div>
    }>
      {!canReview && <p className="text-sm text-amber-300 mb-3">{t('Only admissions staff can review link requests.', 'مراجعة الطلبات لطاقم القبول فقط.')}</p>}
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No requests.', 'لا توجد طلبات.')} columns={[
            { key: 'parent', label: t('Parent', 'ولي الأمر'), render: (r) => <div><div>{r.parent?.full_name || '—'}</div><div className="text-xs text-gray-500">{r.parent?.email} {r.parent?.phone}</div></div> },
            { key: 'relationship', label: t('Relationship', 'الصلة') },
            { key: 'child_index', label: t('Child index', 'رقم الطالب') },
            { key: 'child', label: t('Student', 'الطالب'), render: (r) => (r.child ? `${r.child.full_name} · C${r.child.class_number ?? '—'}` : <span className="text-amber-400 text-xs">{t('not registered yet', 'لم يسجل بعد')}</span>) },
            { key: 'note', label: t('Note', 'ملاحظة') },
            { key: 'created_at', label: t('Requested', 'الطلب'), render: (r) => formatDate(r.created_at) },
            {
              key: 'act', label: '', render: (r) => r.status === 'pending' && canReview ? (
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => decide(r, true)}>{t('Approve', 'قبول')}</Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => decide(r, false)}>{t('Reject', 'رفض')}</Button>
                </div>
              ) : null,
            },
          ]} />
        )}
      </AsyncView>
    </Card>
  );
}
