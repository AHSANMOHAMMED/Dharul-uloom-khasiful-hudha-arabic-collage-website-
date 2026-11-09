import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AsyncView, Button, Card, PageHeader, Stat, useAsync, useLang } from '../ui';
import { formatMoney, rpc } from '../../../lib/erp/rpc';
import { CRM_STAGES, labelOf } from '../../../lib/erp/campusApi';
import { usePortalNav } from '../../../context/PortalNavContext';

const BAR = '#10b981';
const GRID = '#1f2937';
const AXIS = '#9ca3af';

function Tile({ label, value, hint, tone, module, go }) {
  const inner = <Stat label={label} value={value} hint={hint} tone={tone} />;
  if (!module) return inner;
  return (
    <button type="button" onClick={() => go(module)} className="text-start rounded-2xl hover:ring-2 hover:ring-emerald-600/60 transition">
      {inner}
    </button>
  );
}

function ChartTooltip({ active, payload, label, money }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-gray-100">
      <div className="text-gray-400">{label}</div>
      <div className="font-bold">{money ? formatMoney(payload[0].value) : payload[0].value}</div>
    </div>
  );
}

export default function ErpDashboard() {
  const { t, ar } = useLang();
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const portalNav = usePortalNav();
  const [state, reload] = useAsync(async () => (await rpc('org_dashboard_stats')) ?? {}, []);
  const go = (module) => {
    if (portalNav?.goErpModule?.(module)) return;
    // Inside /erp workspace: module query drives the shell.
    if (window.location.pathname.startsWith('/erp')) {
      setParams({ module });
      return;
    }
    navigate(`/erp?module=${encodeURIComponent(module)}`);
  };

  return (
    <div>
      <PageHeader
        title={t('Institution overview', 'نظرة عامة على المؤسسة')}
        subtitle={t('Live KPIs across academics, finance, HR and campus services.', 'مؤشرات مباشرة للشؤون الأكاديمية والمالية والموارد البشرية والخدمات.')}
        actions={<Button variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button>}
      />
      <AsyncView state={state}>
        {(s) => {
          const att = s.attendance_today || {};
          const fees = s.fees_month || {};
          const hostel = s.hostel || {};
          const pay = s.last_payroll;
          const pipeline = CRM_STAGES.map((st) => ({
            name: labelOf(CRM_STAGES, st.value, ar),
            value: Number(s.admissions_pipeline?.[st.value] || 0),
          }));
          const feeBars = [
            { name: t('Invoiced', 'المفوتر'), value: Number(fees.invoiced || 0) },
            { name: t('Collected', 'المحصل'), value: Number(fees.collected || 0) },
            { name: t('Outstanding', 'المتبقي'), value: Number(fees.outstanding || 0) },
          ];
          const occRate = hostel.beds ? Math.round((hostel.occupied * 100) / hostel.beds) : null;
          return (
            <div className="space-y-6">
              <section>
                <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3">{t('People', 'الأشخاص')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <Tile go={go} module="students" label={t('Students', 'الطلاب')} value={s.students ?? 0} />
                  <Tile go={go} module="hr" label={t('Employees', 'الموظفون')} value={s.employees ?? 0} tone="blue" />
                  <Tile go={go} module="students" label={t('Parents', 'أولياء الأمور')} value={s.parents ?? 0} tone="gray" />
                  <Tile go={go} module="students" label={t('Pending approvals', 'بانتظار الموافقة')} value={s.pending_approvals ?? 0}
                    hint={`${s.pending_parent_links ?? 0} ${t('parent link requests', 'طلبات ربط')}`} tone={s.pending_approvals ? 'amber' : 'gray'} />
                  <Tile go={go} module="academics" label={t('Attendance today', 'حضور اليوم')}
                    value={att.rate != null ? `${att.rate}%` : '—'} hint={`${att.present ?? 0}/${att.marked ?? 0} ${t('marked', 'مسجل')}`} />
                  <Tile go={go} module="hr" label={t('Leave pending', 'إجازات معلقة')} value={(s.staff_leave_pending ?? 0) + (s.student_leave_pending ?? 0)}
                    hint={`${t('Staff', 'موظفون')} ${s.staff_leave_pending ?? 0} · ${t('Students', 'طلاب')} ${s.student_leave_pending ?? 0}`} tone="amber" />
                </div>
              </section>

              <section>
                <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3">{t('Finance', 'المالية')} · {fees.month}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <Tile go={go} module="fees" label={t('Fees invoiced', 'الرسوم المفوترة')} value={formatMoney(fees.invoiced)} tone="gray" />
                  <Tile go={go} module="fees" label={t('Fees collected', 'الرسوم المحصلة')} value={formatMoney(fees.collected)} />
                  <Tile go={go} module="fees" label={t('Outstanding (month)', 'المتبقي (الشهر)')} value={formatMoney(fees.outstanding)}
                    hint={`${t('All time', 'الإجمالي')}: ${formatMoney(s.fees_outstanding_total)}`} tone="red" />
                  <Tile go={go} module="fees" label={t('Collections 30 days', 'تحصيل 30 يومًا')} value={formatMoney(s.collections_30d)} />
                  <Tile go={go} module="expenses" label={t('Expenses (month)', 'المصروفات (الشهر)')} value={formatMoney(s.expenses_month)}
                    hint={`${s.expenses_pending ?? 0} ${t('awaiting approval', 'بانتظار الموافقة')}`} tone="amber" />
                  <Tile go={go} module="donations" label={t('Donations (month)', 'التبرعات (الشهر)')} value={formatMoney(s.donations_month)} tone="blue" />
                  <Tile go={go} module="payroll" label={t('Last payroll', 'آخر رواتب')}
                    value={pay ? formatMoney(pay.net) : '—'} hint={pay ? `${pay.period} · ${pay.status} · ${pay.staff} ${t('staff', 'موظف')}` : t('No payroll yet', 'لا رواتب بعد')} tone="gray" />
                </div>
              </section>

              <section>
                <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3">{t('Campus & admissions', 'الحرم والقبول')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <Tile go={go} module="crm" label={t('Overdue follow-ups', 'متابعات متأخرة')} value={s.followups_overdue ?? 0} tone={s.followups_overdue ? 'red' : 'gray'} />
                  <Tile go={go} module="welfare" label={t('Open discipline cases', 'حالات انضباط مفتوحة')} value={s.discipline_open ?? 0} tone="amber" />
                  <Tile go={go} module="hostel" label={t('Hostel occupancy', 'إشغال السكن')}
                    value={occRate != null ? `${occRate}%` : '—'} hint={`${hostel.occupied ?? 0}/${hostel.beds ?? 0} ${t('beds', 'سرير')}`} tone="blue" />
                  <Tile go={go} module="certificates" label={t('Document requests', 'طلبات الوثائق')} value={s.document_requests_pending ?? 0} tone="amber" />
                </div>
              </section>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card title={t('Admissions pipeline', 'مسار القبول')} actions={<Button size="sm" variant="ghost" onClick={() => go('crm')}>{t('Open CRM', 'فتح CRM')} →</Button>}>
                  <div className="h-64" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pipeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid stroke={GRID} vertical={false} />
                        <XAxis dataKey="name" stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<ChartTooltip />} />
                        <Bar dataKey="value" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title={`${t('Fees this month', 'رسوم هذا الشهر')} (${fees.month || ''})`} actions={<Button size="sm" variant="ghost" onClick={() => go('fees')}>{t('Open fees', 'فتح الرسوم')} →</Button>}>
                  <div className="h-64" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={feeBars} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                        <CartesianGrid stroke={GRID} vertical={false} />
                        <XAxis dataKey="name" stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => Number(v).toLocaleString('en-LK')} />
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={<ChartTooltip money />} />
                        <Bar dataKey="value" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={56} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}
