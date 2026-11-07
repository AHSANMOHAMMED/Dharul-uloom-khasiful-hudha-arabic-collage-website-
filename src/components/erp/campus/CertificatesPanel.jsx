import { useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Button, Card, Field, Input, Modal, PageHeader, Select, StatusBadge, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { formatDate, query, rpc, updateRow } from '../../../lib/erp/rpc';
import { CERTIFICATE_TYPES, errMsg, escapeHtml, fetchMyOrg, labelOf, openPrintWindow, studentLabel, toOptions } from '../../../lib/erp/campusApi';
import { StudentPicker } from './common';
import { useAction, useStudents } from './hooks';

const CERT_CSS = `
  .cert { border: 10px double #1a5c38; padding: 40px 48px; text-align: center; min-height: 640px; position: relative; }
  .cert .ar { direction: rtl; font-size: 26px; color: #c9a227; font-weight: 700; }
  .cert .org { font-size: 24px; font-weight: 900; color: #1a5c38; margin-top: 6px; }
  .cert .title { font-size: 30px; margin: 30px 0 6px; color: #1a5c38; letter-spacing: 2px; text-transform: uppercase; }
  .cert .title-ar { direction: rtl; font-size: 24px; color: #444; margin-bottom: 26px; }
  .cert .lead { font-size: 15px; color: #555; }
  .cert .name { font-size: 30px; font-weight: 800; margin: 12px 0; border-bottom: 1px solid #ccc; display: inline-block; padding: 0 30px 6px; }
  .cert .body { font-size: 15px; line-height: 1.7; margin: 14px auto; max-width: 600px; }
  .cert .body-ar { direction: rtl; font-size: 17px; line-height: 1.9; margin: 8px auto; max-width: 600px; color: #333; }
  .cert .sigs { display: flex; justify-content: space-around; margin-top: 50px; font-size: 12px; color: #555; }
  .cert .sigs .line { border-top: 1px solid #888; width: 180px; margin: 0 auto 4px; }
  .cert .verify { position: absolute; bottom: 18px; left: 0; right: 0; font-size: 11px; color: #666; }
  .cert .code { font-family: monospace; font-size: 13px; color: #1a5c38; font-weight: 700; }
`;

function printCertificate(c, org) {
  const url = `${window.location.origin}/verify/${c.verification_code}`;
  const typeAr = labelOf(CERTIFICATE_TYPES, c.certificate_type, true);
  const d = c.details || {};
  const extra = [d.course && `Programme: ${d.course}`, d.grade && `Grade: ${d.grade}`, d.period && `Period: ${d.period}`].filter(Boolean).join(' · ');
  const body = `<div class="cert">
  ${c.status === 'revoked' ? '<div style="position:absolute;top:40%;left:0;right:0;font-size:80px;color:rgba(200,0,0,.2);transform:rotate(-20deg);font-weight:900">REVOKED</div>' : ''}
  <div class="ar">${escapeHtml(org?.name_ar || 'دار العلوم كاشف الهدى')}</div>
  <div class="org">${escapeHtml(org?.name_en || 'Dharul Uloom Kashiful Hudha')}</div>
  <div class="title">${escapeHtml(c.title)}</div>
  <div class="title-ar">شهادة ${escapeHtml(typeAr)}</div>
  <div class="lead">This is to certify that · نشهد بأن</div>
  <div class="name">${escapeHtml(c.student?.full_name || '')}</div>
  <div class="lead">${c.student?.index_number ? `Index no. ${escapeHtml(c.student.index_number)}` : ''}</div>
  <div class="body">${escapeHtml(d.statement || `has been awarded this ${CERTIFICATE_TYPES.find((x) => x.value === c.certificate_type)?.en.toLowerCase() || ''} certificate by the institution.`)}</div>
  ${d.statement_ar ? `<div class="body-ar">${escapeHtml(d.statement_ar)}</div>` : ''}
  ${extra ? `<div class="body">${escapeHtml(extra)}</div>` : ''}
  <div class="body">Issued on ${escapeHtml(formatDate(c.issued_date))} · Serial ${escapeHtml(c.serial_no)}</div>
  <div class="sigs"><div><div class="line"></div>Principal · المدير</div><div><div class="line"></div>Registrar · المسجل</div></div>
  <div class="verify">Verify at ${escapeHtml(url)} · Code <span class="code">${escapeHtml(c.verification_code)}</span></div>
</div>`;
  openPrintWindow(`${c.title} — ${c.student?.full_name || ''}`, body, { css: CERT_CSS });
}

function IssueModal({ open, initial, students, onClose, onIssued }) {
  const { t, ar } = useLang();
  const [busy, run] = useAction();
  const [form, setForm] = useState(initial);
  if (!open || !form) return null;
  const typeLabel = (v) => `${CERTIFICATE_TYPES.find((x) => x.value === v)?.en || v} Certificate`;
  const issue = async () => {
    const details = {};
    ['statement', 'statement_ar', 'course', 'grade', 'period'].forEach((k) => {
      if (form[k]?.trim()) details[k] = form[k].trim();
    });
    const res = await run(() => rpc('issue_certificate', {
      p_student: form.student_id, p_type: form.certificate_type, p_title: form.title.trim() || typeLabel(form.certificate_type),
      p_details: details, p_request: form.request_id || null,
    }), (r) => `${t('Certificate issued', 'تم إصدار الشهادة')} ${r?.serial_no || ''}`);
    if (res.ok) onIssued(res.data);
  };
  return (
    <Modal open title={t('Issue certificate', 'إصدار شهادة')} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !form.student_id} onClick={issue}>{t('Issue', 'إصدار')}</Button></>}>
      <div className="space-y-3">
        <Field label={t('Student', 'الطالب')}>
          {form.request_id ? <Input value={form.student_name || ''} disabled /> : <StudentPicker students={students} value={form.student_id} onChange={(v) => setForm({ ...form, student_id: v })} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Type', 'النوع')}><Select value={form.certificate_type} onChange={(e) => setForm({ ...form, certificate_type: e.target.value })} options={toOptions(CERTIFICATE_TYPES, ar)} /></Field>
          <Field label={t('Title', 'العنوان')}><Input value={form.title} placeholder={typeLabel(form.certificate_type)} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label={t('Programme / course', 'البرنامج')}><Input value={form.course || ''} onChange={(e) => setForm({ ...form, course: e.target.value })} /></Field>
          <Field label={t('Grade / result', 'التقدير')}><Input value={form.grade || ''} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></Field>
        </div>
        <Field label={t('Period (e.g. 2021–2026)', 'الفترة')}><Input value={form.period || ''} onChange={(e) => setForm({ ...form, period: e.target.value })} /></Field>
        <Field label={t('Statement (English)', 'النص (إنجليزي)')}><Textarea value={form.statement || ''} onChange={(e) => setForm({ ...form, statement: e.target.value })} /></Field>
        <Field label={t('Statement (Arabic)', 'النص (عربي)')}><Textarea dir="rtl" value={form.statement_ar || ''} onChange={(e) => setForm({ ...form, statement_ar: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function Issued({ canIssue, students, orgPromise }) {
  const { t, ar } = useLang();
  const [busy, run] = useAction();
  const [status, setStatus] = useState('issued');
  const [q, setQ] = useState('');
  const [issueForm, setIssueForm] = useState(null);
  const [state, reload] = useAsync(
    () => query('certificates', (b) => {
      let x = b.select('*, student:profiles!student_id(full_name, index_number, class_number), issuer:profiles!issued_by(full_name)');
      if (status) x = x.eq('status', status);
      return x.order('created_at', { ascending: false }).limit(1000);
    }),
    [status]
  );
  const onPrint = async (c) => {
    try {
      printCertificate(c, await orgPromise());
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const revoke = async (c) => {
    const reason = window.prompt(t(`Reason for revoking ${c.serial_no}:`, `سبب إلغاء ${c.serial_no}:`), '');
    if (reason === null) return;
    if (!reason.trim()) { toast.error(t('A reason is required.', 'السبب مطلوب.')); return; }
    const res = await run(() => rpc('revoke_certificate', { p_certificate: c.id, p_reason: reason.trim() }), t('Certificate revoked', 'تم إلغاء الشهادة'));
    if (res.ok) reload();
  };
  const needle = q.trim().toLowerCase();
  return (
    <Card title={t('Certificates', 'الشهادات')} actions={
      <div className="flex gap-2 items-center">
        <div className="w-48"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Serial, code, name…', 'الرقم، الرمز، الاسم…')} /></div>
        <div className="w-32"><Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t('All', 'الكل')} options={[{ value: 'issued', label: t('Issued', 'صادرة') }, { value: 'revoked', label: t('Revoked', 'ملغاة') }]} /></div>
        {canIssue && <Button onClick={() => setIssueForm({ student_id: '', certificate_type: 'character', title: '' })}>{t('Issue certificate', 'إصدار شهادة')}</Button>}
      </div>
    }>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows.filter((c) => !needle || [c.serial_no, c.verification_code, c.title, c.student?.full_name].some((v) => (v || '').toLowerCase().includes(needle)))}
            empty={t('No certificates.', 'لا توجد شهادات.')} columns={[
              { key: 'serial_no', label: t('Serial', 'الرقم التسلسلي') },
              { key: 'student', label: t('Student', 'الطالب'), render: (c) => studentLabel(c.student) },
              { key: 'type', label: t('Type', 'النوع'), render: (c) => labelOf(CERTIFICATE_TYPES, c.certificate_type, ar) },
              { key: 'title', label: t('Title', 'العنوان') },
              { key: 'issued_date', label: t('Issued', 'الإصدار'), render: (c) => formatDate(c.issued_date) },
              { key: 'verification_code', label: t('Code', 'الرمز'), render: (c) => <span className="font-mono text-xs">{c.verification_code}</span> },
              { key: 'status', label: t('Status', 'الحالة'), render: (c) => <div><StatusBadge status={c.status} />{c.revoked_reason && <div className="text-xs text-gray-500">{c.revoked_reason}</div>}</div> },
              { key: 'act', label: '', render: (c) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onPrint(c)}>{t('Print', 'طباعة')}</Button>
                  <a className="text-xs text-emerald-400 hover:underline self-center" href={`/verify/${c.verification_code}`} target="_blank" rel="noreferrer">{t('Verify', 'تحقق')}</a>
                  {canIssue && c.status === 'issued' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => revoke(c)}>{t('Revoke', 'إلغاء')}</Button>}
                </div>
              ) },
            ]} />
        )}
      </AsyncView>
      <IssueModal key={issueForm ? 'open' : 'closed'} open={Boolean(issueForm)} initial={issueForm} students={students} onClose={() => setIssueForm(null)} onIssued={() => { setIssueForm(null); reload(); }} />
    </Card>
  );
}

function Requests({ canIssue, students }) {
  const { t, ar } = useLang();
  const { user } = useAuth();
  const [busy, run] = useAction();
  const [status, setStatus] = useState('pending');
  const [issueForm, setIssueForm] = useState(null);
  const [state, reload] = useAsync(
    () => query('document_requests', (q) =>
      q.select('*, student:profiles!student_id(full_name, index_number, class_number), requester:profiles!requested_by(full_name, account_type)')
        .eq('status', status).order('created_at', { ascending: true }).limit(500)),
    [status]
  );
  const reject = async (r) => {
    const note = window.prompt(t('Reason for rejection:', 'سبب الرفض:'), '');
    if (note === null) return;
    const res = await run(() => updateRow('document_requests', r.id, { status: 'rejected', review_note: note || null, reviewed_by: user?.id }), t('Request rejected', 'تم رفض الطلب'));
    if (res.ok) reload();
  };
  const approve = async (r) => {
    const res = await run(() => updateRow('document_requests', r.id, { status: 'approved', reviewed_by: user?.id }), t('Request approved — issue when ready', 'تمت الموافقة — أصدر الشهادة عند الجاهزية'));
    if (res.ok) reload();
  };
  const validType = (v) => (CERTIFICATE_TYPES.some((x) => x.value === v) ? v : 'other');
  return (
    <Card title={t('Document requests', 'طلبات الوثائق')} actions={
      <div className="w-36"><Select value={status} onChange={(e) => setStatus(e.target.value)} options={['pending', 'approved', 'issued', 'rejected'].map((s) => ({ value: s, label: s }))} /></div>
    }>
      {!canIssue && <p className="text-sm text-amber-300 mb-3">{t('Only academic administrators can process requests.', 'معالجة الطلبات للإدارة الأكاديمية فقط.')}</p>}
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No requests.', 'لا توجد طلبات.')} columns={[
            { key: 'created_at', label: t('Requested', 'الطلب'), render: (r) => formatDate(r.created_at) },
            { key: 'student', label: t('Student', 'الطالب'), render: (r) => studentLabel(r.student) },
            { key: 'requester', label: t('By', 'بواسطة'), render: (r) => (r.requester ? `${r.requester.full_name} (${r.requester.account_type})` : '—') },
            { key: 'type', label: t('Document', 'الوثيقة'), render: (r) => labelOf(CERTIFICATE_TYPES, r.certificate_type, ar) },
            { key: 'purpose', label: t('Purpose', 'الغرض') },
            { key: 'review_note', label: t('Note', 'ملاحظة') },
            { key: 'act', label: '', render: (r) => canIssue && ['pending', 'approved'].includes(r.status) ? (
              <div className="flex gap-2">
                {r.status === 'pending' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => approve(r)}>{t('Approve', 'موافقة')}</Button>}
                <Button size="sm" disabled={busy} onClick={() => setIssueForm({
                  request_id: r.id, student_id: r.student_id, student_name: studentLabel(r.student), certificate_type: validType(r.certificate_type), title: '',
                })}>{t('Issue', 'إصدار')}</Button>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => reject(r)}>{t('Reject', 'رفض')}</Button>
              </div>
            ) : null },
          ]} />
        )}
      </AsyncView>
      <IssueModal key={issueForm?.request_id || 'closed'} open={Boolean(issueForm)} initial={issueForm} students={students} onClose={() => setIssueForm(null)} onIssued={() => { setIssueForm(null); reload(); }} />
    </Card>
  );
}

export default function CertificatesPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const [tab, setTab] = useState('issued');
  const [students] = useStudents();
  const [org] = useAsync(() => fetchMyOrg(auth.user?.orgId), [auth.user?.orgId]);
  const orgPromise = async () => org.data;
  const canIssue = auth.isAcademicAdmin;
  return (
    <div>
      <PageHeader title={t('Certificates', 'الشهادات')} subtitle={t('Issue verifiable certificates and process document requests.', 'إصدار شهادات قابلة للتحقق ومعالجة طلبات الوثائق.')}
        actions={<a href="/verify" target="_blank" rel="noreferrer"><Button variant="secondary">{t('Public verification page', 'صفحة التحقق العامة')}</Button></a>} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'issued', label: t('Certificates', 'الشهادات') },
        { id: 'requests', label: t('Document requests', 'طلبات الوثائق') },
      ]} />
      {tab === 'issued' && <Issued canIssue={canIssue} students={students.data || []} orgPromise={orgPromise} />}
      {tab === 'requests' && <Requests canIssue={canIssue} students={students.data || []} />}
    </div>
  );
}
