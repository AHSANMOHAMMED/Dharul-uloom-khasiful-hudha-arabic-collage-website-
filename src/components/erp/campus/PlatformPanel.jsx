import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, Table, useAsync, useLang } from '../ui';
import { formatDate, formatMoney, rpc } from '../../../lib/erp/rpc';
import { updatePlatformOrg } from '../../../lib/platformApi';
import { OrgAdminsDialog, OrgDetailsDialog } from '../../platform/PlatformOps';
import { setActingOrg } from '../../../lib/erp/governanceApi';
import { useAction } from './hooks';

const PLANS = ['free', 'standard', 'premium', 'enterprise'];
const STATUSES = ['trial', 'active', 'suspended', 'archived'];
const EMPTY = { slug: '', name_en: '', name_ar: '', code: '', admin_email: '', plan: 'standard', max_students: '' };

export default function PlatformPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [create, setCreate] = useState(null);
  const [created, setCreated] = useState(null);
  const [edit, setEdit] = useState(null);
  const [details, setDetails] = useState(null);
  const [admins, setAdmins] = useState(null);
  const statusLabel = (s) => ({
    trial: t('Trial', 'تجريبي'),
    active: t('Active', 'نشطة'),
    suspended: t('Suspended', 'موقوفة'),
    archived: t('Archived', 'مؤرشفة'),
  })[s] || s;
  const planLabel = (p) => ({
    free: t('Free', 'مجاني'),
    standard: t('Standard', 'قياسي'),
    premium: t('Premium', 'مميز'),
    enterprise: t('Enterprise', 'مؤسسي'),
  })[p] || p;
  const [state, reload] = useAsync(() => (auth.isSuperAdmin ? rpc('platform_overview').then((r) => r ?? []) : Promise.resolve([])), [auth.isSuperAdmin]);

  if (!auth.isSuperAdmin) {
    return <Card><p className="text-sm text-gray-400">{t('Platform administration is restricted to the SaaS operator.', 'إدارة المنصة مقتصرة على مشغل المنصة.')}</p></Card>;
  }

  const submit = async () => {
    const slug = create.slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(slug)) {
      window.alert(t('Slug: 3–41 chars, lowercase letters, digits and hyphens.', 'المعرف: 3–41 حرفًا صغيرًا وأرقامًا وشرطات.'));
      return;
    }
    const res = await run(() => rpc('create_organization', {
      p_slug: slug, p_name_en: create.name_en.trim(), p_code: create.code.trim().toUpperCase(), p_admin_email: create.admin_email.trim().toLowerCase(),
      p_name_ar: create.name_ar.trim() || null, p_plan: create.plan, p_max_students: create.max_students ? Number(create.max_students) : null,
    }), t('Organization created', 'تم إنشاء المؤسسة'));
    if (res.ok) {
      setCreated({ ...res.data, admin_email: create.admin_email.trim().toLowerCase() });
      setCreate(null);
      reload();
    }
  };
  const setStatus = async (o, status) => {
    if (status === o.status) return;
    const head = `${o.name_en} → ${statusLabel(status)}?`;
    const warn = ['suspended', 'archived'].includes(status)
      ? `${head} ${t('All its users lose access to tenant data immediately.', 'سيفقد جميع المستخدمين الوصول فورًا.')}`
      : head;
    if (!window.confirm(warn)) return;
    const res = await run(() => rpc('set_organization_status', { p_org: o.org_id, p_status: status }), t('Status updated', 'تم تحديث الحالة'));
    if (res.ok) reload();
  };
  const manage = async (o) => {
    if (!window.confirm(`${t('Manage this institution', 'إدارة هذه المؤسسة')}: ${o.name_en}?`)) return;
    const res = await run(() => setActingOrg(o.org_id));
    if (res.ok) window.location.assign('/erp?module=dashboard');
  };
  const saveEdit = async () => {
    // Through the audited platform function (0036) rather than a direct table write.
    const res = await run(() => updatePlatformOrg(edit.org_id, { plan: edit.plan, max_students: edit.max_students === '' ? '' : String(Number(edit.max_students)) }), t('Plan updated', 'تم تحديث الخطة'));
    if (res.ok) { setEdit(null); reload(); }
  };

  return (
    <div>
      <PageHeader title={t('SaaS platform', 'المنصة')} subtitle={t('Tenants, subscriptions and onboarding.', 'المؤسسات والاشتراكات والتهيئة.')}
        actions={<><Button variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button><Button onClick={() => setCreate({ ...EMPTY })}>{t('New organization', 'مؤسسة جديدة')}</Button></>} />
      {created && (
        <div className="mb-6 rounded-2xl border border-emerald-700 bg-emerald-950/40 p-4 text-sm text-emerald-100">
          <div className="font-bold mb-1">{t('Organization', 'المؤسسة')} “{created.slug}” {t('created.', 'أنشئت.')}</div>
          {t('Ask', 'اطلب من')} <b>{created.admin_email}</b> {t('to sign up with that e-mail; they become the organization admin automatically. Admin invite token:', 'التسجيل بهذا البريد ليصبح مسؤول المؤسسة تلقائيًا. رمز الدعوة:')}
          <div className="font-mono break-all mt-1 text-emerald-300">{created.admin_invite_token}</div>
          <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={() => setCreated(null)}>{t('Dismiss', 'إغلاق')}</Button></div>
        </div>
      )}
      <AsyncView state={state}>
        {(rows) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label={t('Organizations', 'المؤسسات')} value={rows.length} tone="gray" />
              <Stat label={t('Active', 'نشطة')} value={rows.filter((o) => ['active', 'trial'].includes(o.status)).length} />
              <Stat label={t('Students', 'الطلاب')} value={rows.reduce((s, o) => s + Number(o.students), 0)} tone="blue" />
              <Stat label={t('Employees', 'الموظفون')} value={rows.reduce((s, o) => s + Number(o.employees), 0)} tone="blue" />
              <Stat label={t('Collected (all)', 'المحصل (الكل)')} value={formatMoney(rows.reduce((s, o) => s + Number(o.collected), 0))} />
            </div>
            <Card title={t('Tenants', 'المؤسسات')}>
              <Table rows={rows} rowKey="org_id" empty={t('No organizations.', 'لا توجد مؤسسات.')} columns={[
                { key: 'name_en', label: t('Organization', 'المؤسسة'), render: (o) => <div><div className="font-semibold">{o.name_en}</div><div className="text-xs text-gray-500">{o.slug} · {o.code}</div></div> },
                { key: 'plan', label: t('Plan', 'الخطة'), render: (o) => planLabel(o.plan) },
                { key: 'students', label: t('Students', 'الطلاب'), render: (o) => (
                  <span className={o.max_students && Number(o.students) >= o.max_students ? 'text-red-400 font-bold' : ''}>{o.students}{o.max_students ? ` / ${o.max_students}` : ''}</span>
                ) },
                { key: 'employees', label: t('Employees', 'الموظفون') },
                { key: 'parents', label: t('Parents', 'الأولياء') },
                { key: 'invoiced', label: t('Invoiced', 'المفوتر'), render: (o) => formatMoney(o.invoiced) },
                { key: 'collected', label: t('Collected', 'المحصل'), render: (o) => formatMoney(o.collected) },
                { key: 'created_at', label: t('Since', 'منذ'), render: (o) => formatDate(o.created_at) },
                { key: 'status', label: t('Status', 'الحالة'), render: (o) => (
                  <div className="space-y-1 min-w-[130px]">
                    <Badge tone={{ active: 'green', trial: 'amber', suspended: 'red' }[o.status] || 'gray'}>{statusLabel(o.status)}</Badge>
                    <Select value={o.status} disabled={busy} onChange={(e) => setStatus(o, e.target.value)} options={STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))} />
                  </div>
                ) },
                { key: 'act', label: '', render: (o) => (
                  <div className="flex flex-wrap gap-1 justify-end">
                    <Button size="sm" disabled={busy} onClick={() => manage(o)}>{t('Manage this institution', 'إدارة هذه المؤسسة')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEdit({ org_id: o.org_id, name_en: o.name_en, plan: o.plan, max_students: o.max_students ?? '' })}>{t('Plan', 'الخطة')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setDetails(o)}>{t('Details', 'التفاصيل')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setAdmins(o)}>{t('Admins', 'المسؤولون')}</Button>
                  </div>
                ) },
              ]} />
            </Card>
          </div>
        )}
      </AsyncView>
      <Modal open={Boolean(create)} title={t('New organization', 'مؤسسة جديدة')} onClose={() => setCreate(null)}
        footer={<><Button variant="ghost" onClick={() => setCreate(null)}>{t('Cancel', 'إلغاء')}</Button>
          <Button disabled={busy || !create?.slug || !create?.name_en || !create?.code || !create?.admin_email} onClick={submit}>{t('Create', 'إنشاء')}</Button></>}>
        {create && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('Slug (URL id)', 'المعرف')} hint={`${t('e.g.', 'مثال:')} al-noor-college`}><Input value={create.slug} onChange={(e) => setCreate({ ...create, slug: e.target.value })} /></Field>
            <Field label={t('Short code', 'الرمز المختصر')} hint={t('Used in document numbers', 'يستخدم في أرقام المستندات')}><Input value={create.code} maxLength={6} onChange={(e) => setCreate({ ...create, code: e.target.value })} /></Field>
            <Field label={t('Name (English)', 'الاسم (إنجليزي)')}><Input value={create.name_en} onChange={(e) => setCreate({ ...create, name_en: e.target.value })} /></Field>
            <Field label={t('Name (Arabic)', 'الاسم (عربي)')}><Input dir="rtl" value={create.name_ar} onChange={(e) => setCreate({ ...create, name_ar: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label={t('Admin e-mail', 'بريد المسؤول')}><Input type="email" value={create.admin_email} onChange={(e) => setCreate({ ...create, admin_email: e.target.value })} /></Field></div>
            <Field label={t('Plan', 'الخطة')}><Select value={create.plan} onChange={(e) => setCreate({ ...create, plan: e.target.value })} options={PLANS.map((p) => ({ value: p, label: planLabel(p) }))} /></Field>
            <Field label={t('Max students', 'الحد الأقصى للطلاب')} hint={t('Blank = unlimited', 'فارغ = غير محدود')}><Input type="number" min="1" value={create.max_students} onChange={(e) => setCreate({ ...create, max_students: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(edit)} title={`${t('Subscription', 'الاشتراك')} · ${edit?.name_en || ''}`} onClose={() => setEdit(null)}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy} onClick={saveEdit}>{t('Save', 'حفظ')}</Button></>}>
        {edit && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Plan', 'الخطة')}><Select value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })} options={PLANS.map((p) => ({ value: p, label: planLabel(p) }))} /></Field>
            <Field label={t('Max students', 'الحد الأقصى للطلاب')}><Input type="number" min="1" value={edit.max_students} onChange={(e) => setEdit({ ...edit, max_students: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
      {details && <OrgDetailsDialog org={details} onClose={() => setDetails(null)} onSaved={reload} />}
      {admins && <OrgAdminsDialog org={admins} onClose={() => setAdmins(null)} />}
    </div>
  );
}
